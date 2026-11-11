import type { SupabaseClient } from "@supabase/supabase-js";
import type { ShoppingCategory, ShoppingItem } from "@/types";

/**
 * Shopping list changes apply on screen immediately and are saved on the device, then
 * synced in the background. Without signal (a store's back aisles), they wait and retry
 * when the connection returns, so checking things off never bounces back.
 */

export type ShoppingPatch = Partial<Pick<ShoppingItem, "name" | "category" | "checked">>;

/** Changes not yet saved to the database, merged per item */
export interface PendingChanges {
  /** Items added on this device, keyed by their temporary id */
  inserts: Record<string, ShoppingItem>;
  updates: Record<string, ShoppingPatch>;
  deletes: string[];
}

interface Callbacks {
  setItems: (update: (prev: ShoppingItem[]) => ShoppingItem[]) => void;
  /** A change the server refused (not a lost connection); it has been dropped */
  onError: (message: string) => void;
  onStatus: (status: { waiting: number; offline: boolean }) => void;
}

/** Device storage, swappable in tests */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const TEMP_PREFIX = "local-";
const emptyPending = (): PendingChanges => ({ inserts: {}, updates: {}, deletes: [] });

export const countPending = (p: PendingChanges) =>
  Object.keys(p.inserts).length + Object.keys(p.updates).length + p.deletes.length;

// crypto.randomUUID needs a secure context, which a phone testing over the LAN doesn't have
const tempId = () => `${TEMP_PREFIX}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

export function isNetworkError(error: { message?: string }): boolean {
  return (
    (typeof navigator !== "undefined" && navigator.onLine === false) ||
    /fetch|network|load failed|timed? ?out/i.test(error.message ?? "")
  );
}

/** The list as the server sent it, with this device's unsynced changes on top. */
export function applyPending(items: ShoppingItem[], p: PendingChanges): ShoppingItem[] {
  const deleted = new Set(p.deletes);
  const ids = new Set(items.map((i) => i.id));
  return [
    ...items.filter((i) => !deleted.has(i.id)).map((i) => (p.updates[i.id] ? { ...i, ...p.updates[i.id] } : i)),
    ...Object.values(p.inserts).filter((i) => !ids.has(i.id)),
  ];
}

export class ShoppingSync {
  private pending: PendingChanges;
  /** Temporary ids of synced items → their real ids, for screens still holding the old ones */
  private idMap = new Map<string, string>();
  private running: Promise<boolean> | null = null;
  private again = false;
  private offline = false;

  constructor(
    private db: SupabaseClient,
    private ownerId: string,
    private callbacks: Callbacks,
    private store: KeyValueStore | null
  ) {
    this.pending = this.load();
  }

  private get storageKey() {
    return `shopping-pending:${this.ownerId}`;
  }

  private load(): PendingChanges {
    try {
      const raw = this.store?.getItem(this.storageKey);
      if (!raw) return emptyPending();
      const p = JSON.parse(raw) as Partial<PendingChanges>;
      return { inserts: p.inserts ?? {}, updates: p.updates ?? {}, deletes: p.deletes ?? [] };
    } catch {
      return emptyPending();
    }
  }

  private persist() {
    try {
      if (countPending(this.pending) === 0) this.store?.removeItem(this.storageKey);
      else this.store?.setItem(this.storageKey, JSON.stringify(this.pending));
    } catch {
      // Storage blocked (private mode): changes still sync while the page is open
    }
    this.report();
  }

  private report() {
    const waiting = countPending(this.pending);
    this.callbacks.onStatus({ waiting, offline: this.offline && waiting > 0 });
  }

  get waiting() {
    return countPending(this.pending);
  }

  /** Puts changes saved on this device earlier on top of the list and starts sending them. */
  restore() {
    if (this.waiting === 0) return;
    this.callbacks.setItems((prev) => applyPending(prev, this.pending));
    this.report();
    void this.flush();
  }

  /** Takes a fresh list from the server, keeping this device's unsynced changes on top. */
  adopt(serverItems: ShoppingItem[]) {
    this.callbacks.setItems(() => applyPending(serverItems, this.pending));
  }

  private resolve(id: string) {
    return this.idMap.get(id) ?? id;
  }

  add(rows: { name: string; category: ShoppingCategory }[]) {
    if (rows.length === 0) return;
    const created_at = new Date().toISOString();
    const added: ShoppingItem[] = rows.map((r) => ({
      id: tempId(),
      user_id: this.ownerId,
      name: r.name,
      category: r.category,
      checked: false,
      created_at,
    }));
    for (const item of added) this.pending.inserts[item.id] = item;
    this.persist();
    this.callbacks.setItems((prev) => [...prev, ...added]);
    void this.flush();
  }

  update(itemId: string, patch: ShoppingPatch) {
    const id = this.resolve(itemId);
    const p = this.pending;
    if (p.inserts[id]) p.inserts[id] = { ...p.inserts[id], ...patch };
    else p.updates[id] = { ...p.updates[id], ...patch };
    this.persist();
    this.callbacks.setItems((prev) => prev.map((i) => (i.id === id || i.id === itemId ? { ...i, ...patch } : i)));
    void this.flush();
  }

  remove(itemIds: string[]) {
    const ids = itemIds.map((id) => this.resolve(id));
    const p = this.pending;
    for (const id of ids) {
      if (p.inserts[id]) {
        delete p.inserts[id];
      } else {
        delete p.updates[id];
        if (!id.startsWith(TEMP_PREFIX) && !p.deletes.includes(id)) p.deletes.push(id);
      }
    }
    this.persist();
    const gone = new Set([...ids, ...itemIds]);
    this.callbacks.setItems((prev) => prev.filter((i) => !gone.has(i.id)));
    void this.flush();
  }

  /** Sends pending changes. Resolves true once nothing is left waiting. */
  flush(): Promise<boolean> {
    // A run in progress loops until it has also sent anything changed meanwhile
    if (this.running) {
      this.again = true;
      return this.running;
    }
    this.running = this.send().then(() => this.waiting === 0).finally(() => {
      this.running = null;
    });
    return this.running;
  }

  private async send(): Promise<void> {
    const p = this.pending;
    let refused: string | null = null;
    try {
      do {
        this.again = false;

        if (p.deletes.length > 0) {
          const ids = [...p.deletes];
          const { error } = await this.db.from("shopping_items").delete().in("id", ids);
          if (error && isNetworkError(error)) return;
          if (error) refused = error.message;
          p.deletes = p.deletes.filter((id) => !ids.includes(id));
          this.persist();
        }

        for (const [id, patch] of Object.entries(p.updates)) {
          const { error } = await this.db.from("shopping_items").update(patch).eq("id", id);
          if (error && isNetworkError(error)) return;
          if (error) refused = error.message;
          // Only clear it if nothing changed while the request was out
          if (p.updates[id] === patch) delete p.updates[id];
          this.persist();
        }

        for (const [temp, sent] of Object.entries(p.inserts)) {
          const { data, error } = await this.db
            .from("shopping_items")
            .insert({ user_id: this.ownerId, name: sent.name, category: sent.category, checked: sent.checked })
            .select()
            .single();
          if (error && isNetworkError(error)) return;
          const current = p.inserts[temp];
          delete p.inserts[temp];
          if (error || !data) {
            refused = error?.message ?? "Couldn't add to the list.";
            this.persist();
            continue;
          }
          const saved = data as ShoppingItem;
          this.idMap.set(temp, saved.id);
          if (!current) {
            // Removed while it was being added
            p.deletes.push(saved.id);
            this.again = true;
          } else if (current !== sent) {
            // Edited while it was being added
            p.updates[saved.id] = { name: current.name, category: current.category, checked: current.checked };
            this.again = true;
          }
          this.persist();
          this.callbacks.setItems((prev) =>
            prev.map((i) => (i.id === temp ? { ...saved, name: i.name, category: i.category, checked: i.checked } : i))
          );
        }
      } while (this.again);
    } finally {
      this.offline = this.waiting > 0;
      this.report();
      if (refused) {
        this.callbacks.onError(refused);
        void this.reload();
      }
    }
  }

  /** Reloads the list after a change the server refused, so the screen matches what's saved. */
  private async reload() {
    const { data } = await this.db
      .from("shopping_items")
      .select("*")
      .eq("user_id", this.ownerId)
      .order("created_at");
    if (data) {
      const items = data as ShoppingItem[];
      this.callbacks.setItems(() => applyPending(items, this.pending));
    }
  }
}
