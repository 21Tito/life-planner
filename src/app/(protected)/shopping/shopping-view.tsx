"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useRef, useState } from "react";
import { useOwnerId } from "@/lib/household-context";
import type { MealPlanEntry, PantryItem, RecipeWithIngredients, ShoppingCategory, ShoppingItem } from "@/types";
import {
  SHOPPING_CATEGORIES,
  STORE_CATEGORY_ORDER,
  buildShoppingList,
  guessCategory,
  guessShoppingCategory,
  isOnList,
  toDateStr,
} from "@/lib/meals";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Icons } from "@/components/ui/icons";
import { CategoryHeading } from "@/components/ui/category-icon";
import { ErrorText, FieldLabel, Modal, nativeSelectClass } from "../meals/modal";
import { useShoppingSync } from "./use-shopping-sync";
import { useOnline } from "@/components/offline/offline-support";

interface Props {
  items: ShoppingItem[];
  /** The list as the server last sent it; a new one arrives when the page refreshes */
  serverItems: ShoppingItem[];
  setItems: React.Dispatch<React.SetStateAction<ShoppingItem[]>>;
  setPantry: React.Dispatch<React.SetStateAction<PantryItem[]>>;
  /** The days shown on This Week; suggestions cover the same range */
  days: Date[] | null;
  entries: MealPlanEntry[];
  recipes: RecipeWithIngredients[];
  pantry: PantryItem[];
}

const CATEGORY_LABELS = new Map(SHOPPING_CATEGORIES.map((c) => [c.value, c.label]));

const categoryOf = (item: ShoppingItem) => item.category ?? guessShoppingCategory(item.name);
/** Household supplies come off the list but never go into the kitchen */
const isHousehold = (item: ShoppingItem) => categoryOf(item) === "household";

function groupForStore(items: ShoppingItem[]) {
  const byCategory = new Map<ShoppingCategory, ShoppingItem[]>();
  for (const item of items) {
    const category = categoryOf(item);
    byCategory.set(category, [...(byCategory.get(category) ?? []), item]);
  }
  return STORE_CATEGORY_ORDER.filter((c) => byCategory.has(c)).map((c) => ({
    category: c,
    label: CATEGORY_LABELS.get(c) ?? "Other",
    items: byCategory.get(c)!.sort((a, b) => a.name.localeCompare(b.name)),
  }));
}

export function ShoppingView({ items, serverItems, setItems, setPantry, days, entries, recipes, pantry }: Props) {
  const supabase = createClient();
  const ownerId = useOwnerId();

  const [name, setName] = useState("");
  const [category, setCategory] = useState<ShoppingCategory>("other");
  const [categoryTouched, setCategoryTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Changes show immediately and sync in the background, waiting out lost signal
  const sync = useShoppingSync(setItems, setError);
  // A refreshed list from the server replaces ours, with unsynced changes kept on top
  const firstServerItems = useRef(serverItems);
  useEffect(() => {
    if (serverItems !== firstServerItems.current) sync.adopt(serverItems);
    // sync.adopt is a new function each render but always the same ShoppingSync
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverItems]);
  const online = useOnline();
  const offline = { offline: !online || sync.offline, changes: sync.waiting };
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState<ShoppingItem | null>(null);
  const [shopping, setShopping] = useState(false);
  const [finishing, setFinishing] = useState(false);

  const toBuy = items.filter((i) => !i.checked);
  const inCart = items.filter((i) => i.checked);

  function addItems(rows: { name: string; category: ShoppingCategory }[]) {
    setError(null);
    sync.add(rows);
  }

  function addFromForm(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    addItems([{ name: trimmed, category }]);
    setName("");
    setCategory("other");
    setCategoryTouched(false);
  }

  function toggle(item: ShoppingItem) {
    sync.update(item.id, { checked: !item.checked });
  }

  function remove(item: ShoppingItem) {
    sync.remove([item.id]);
  }

  async function saveEdit(updated: ShoppingItem): Promise<string | null> {
    sync.update(updated.id, { name: updated.name, category: updated.category });
    return null;
  }

  /** Adds the chosen checked items to the kitchen and clears every checked item off the list. */
  async function finish(toKitchen: ShoppingItem[]): Promise<string | null> {
    // The kitchen isn't kept offline, so putting away waits for a connection
    if (!(await sync.sync())) {
      return "You're offline. Your list is saved on this phone; put groceries away once you're back online.";
    }
    if (toKitchen.length > 0) {
      const { data, error } = await supabase
        .from("pantry_items")
        .insert(
          toKitchen.map((i) => ({
            user_id: ownerId,
            name: i.name,
            category: i.category && i.category !== "household" ? i.category : guessCategory(i.name),
          }))
        )
        .select();
      if (error || !data) return error?.message ?? "Couldn't add to your kitchen.";
      setPantry((prev) => [...prev, ...(data as PantryItem[])]);
    }
    sync.remove(inCart.map((i) => i.id));
    setShopping(false);
    return null;
  }

  async function copyList() {
    const text = groupForStore(toBuy)
      .flatMap((g) => g.items.map((i) => i.name))
      .join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Couldn't copy to the clipboard.");
    }
  }

  // Keep the phone screen on while shopping
  useEffect(() => {
    if (!shopping || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    navigator.wakeLock.request("screen").then((l) => (lock = l)).catch(() => {});
    return () => {
      lock?.release().catch(() => {});
    };
  }, [shopping]);

  // Ingredients upcoming meals need that aren't in the kitchen or already on the list
  let suggestions: ReturnType<typeof buildShoppingList> = [];
  if (days && days.length > 0) {
    const from = toDateStr(days[0]);
    const to = toDateStr(days[days.length - 1]);
    const upcoming = entries.filter((e) => e.date >= from && e.date <= to);
    suggestions = buildShoppingList(upcoming, recipes, pantry).filter(
      (l) => !l.match && !isOnList(l.name, items)
    );
  }
  const suggestionRow = (l: (typeof suggestions)[number]) => ({
    name: l.name,
    category: guessCategory(l.name),
  });

  if (shopping) {
    return (
      <ShoppingMode
        toBuy={toBuy}
        inCart={inCart}
        onToggle={toggle}
        onExit={() => setShopping(false)}
        onFinish={() => setFinishing(true)}
        finishing={finishing}
        onCloseFinish={() => setFinishing(false)}
        finish={finish}
        error={error}
        offline={offline}
      />
    );
  }

  return (
    <div className="max-w-2xl">
      <OfflineNotice {...offline} />
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Button onClick={() => setShopping(true)} disabled={toBuy.length === 0 && inCart.length === 0} className="h-10 px-4 gap-1.5">
          {Icons.check}
          Start shopping
        </Button>
        {toBuy.length > 0 && (
          <Button variant="outline" onClick={copyList} className="h-10 px-4">
            {copied ? "Copied" : "Copy list"}
          </Button>
        )}
      </div>

      <Card className="mb-6">
        <CardContent>
          <form onSubmit={addFromForm} className="flex flex-col sm:flex-row gap-2">
            <Input
              placeholder="Add an item, e.g. tofu or paper towels"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!categoryTouched) setCategory(guessShoppingCategory(e.target.value));
              }}
              maxLength={200}
              className="h-10 text-sm flex-1"
            />
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value as ShoppingCategory);
                setCategoryTouched(true);
              }}
              className={`${nativeSelectClass} sm:w-40`}
              aria-label="Category"
            >
              {SHOPPING_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
            <Button type="submit" disabled={!name.trim()} className="h-10 px-4 gap-1.5">
              {Icons.plus}
              Add
            </Button>
          </form>
          {error && <div className="mt-3"><ErrorText>{error}</ErrorText></div>}
        </CardContent>
      </Card>

      {items.length === 0 ? (
        <EmptyState
          icon={Icons.check}
          title="Your shopping list is empty"
          description="Add items here, from this week's recipes below, or when you run out of something after cooking."
          className="py-10"
        />
      ) : (
        <div className="space-y-6">
          {groupForStore(toBuy).map((group) => (
            <section key={group.category}>
              <CategoryHeading category={group.category} label={group.label} />
              <ul className="rounded-xl ring-1 ring-foreground/10 bg-card divide-y divide-border">
                {group.items.map((item) => (
                  <li key={item.id} className="flex items-center gap-2 pl-2 pr-2 py-1">
                    <button
                      onClick={() => toggle(item)}
                      aria-label={`Mark ${item.name} as in the cart`}
                      className="w-9 h-9 flex items-center justify-center flex-shrink-0"
                    >
                      <span className="w-5 h-5 rounded-full border-2 border-muted-foreground/40" />
                    </button>
                    <button onClick={() => setEditing(item)} className="flex-1 min-w-0 text-left py-1.5 text-sm">
                      <span className="font-medium">{item.name}</span>
                    </button>
                    <button
                      onClick={() => remove(item)}
                      aria-label={`Remove ${item.name}`}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    >
                      {Icons.close}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}

          {inCart.length > 0 && (
            <section>
              <div className="flex items-center justify-between gap-3 mb-2">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  In the cart ({inCart.length})
                </h2>
                <Button variant="outline" size="sm" onClick={() => setFinishing(true)}>
                  Put groceries away
                </Button>
              </div>
              <ul className="rounded-xl ring-1 ring-foreground/10 bg-card divide-y divide-border">
                {inCart.map((item) => (
                  <li key={item.id} className="flex items-center gap-2 pl-2 pr-4 py-1">
                    <button
                      onClick={() => toggle(item)}
                      aria-label={`Put ${item.name} back on the list`}
                      className="w-9 h-9 flex items-center justify-center flex-shrink-0 text-green-600"
                    >
                      {Icons.check}
                    </button>
                    <span className="flex-1 min-w-0 text-sm text-muted-foreground line-through">{item.name}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      {suggestions.length > 0 && (
        <section className="mt-8">
          <div className="flex items-center justify-between gap-3 mb-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Needed for the next {days?.length ?? 7} days
            </h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => addItems(suggestions.map(suggestionRow))}
            >
              Add all
            </Button>
          </div>
          <ul className="rounded-xl ring-1 ring-foreground/10 bg-card divide-y divide-border">
            {suggestions.map((line) => (
              <li key={line.key} className="flex items-center gap-3 px-4 py-2.5">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{line.name}</p>
                  <p className="text-xs text-muted-foreground truncate">For {line.recipes.join(", ")}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => addItems([suggestionRow(line)])}
                  className="flex-shrink-0 gap-1"
                >
                  {Icons.plus}
                  Add
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {editing && <EditItemModal item={editing} onClose={() => setEditing(null)} onSave={saveEdit} />}
      {finishing && (
        <FinishModal inCart={inCart} onClose={() => setFinishing(false)} finish={finish} />
      )}
    </div>
  );
}

/** Shown without a connection; the list keeps working and changes wait on the device */
function OfflineNotice({ offline, changes }: { offline: boolean; changes: number }) {
  if (!offline) return null;
  return (
    <div role="status" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
      <span className="font-medium">You&apos;re offline.</span>{" "}
      {changes > 0
        ? `${changes} change${changes === 1 ? " is" : "s are"} saved on this device and will sync when you're back online.`
        : "Your list still works; changes sync when you're back online."}
    </div>
  );
}

// ── At the store: big tap targets, one item at a time ────────────────────────

function ShoppingMode({
  toBuy,
  inCart,
  onToggle,
  onExit,
  onFinish,
  finishing,
  onCloseFinish,
  finish,
  error,
  offline,
}: {
  toBuy: ShoppingItem[];
  inCart: ShoppingItem[];
  onToggle: (item: ShoppingItem) => void;
  onExit: () => void;
  onFinish: () => void;
  finishing: boolean;
  onCloseFinish: () => void;
  finish: (toKitchen: ShoppingItem[]) => Promise<string | null>;
  error: string | null;
  offline: { offline: boolean; changes: number };
}) {
  const total = toBuy.length + inCart.length;

  return (
    <div className="max-w-xl">
      <div className="sticky top-[calc(3.5rem_+_env(safe-area-inset-top)_+_var(--page-tabs-h,0px))] lg:top-[var(--page-tabs-h,0px)] z-20 -mx-4 px-4 py-3 mb-4 bg-background/95 backdrop-blur border-b border-border flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-semibold">Shopping</p>
          <p className="text-xs text-muted-foreground">
            {inCart.length} of {total} in the cart
          </p>
        </div>
        <Button variant="ghost" onClick={onExit}>
          Exit
        </Button>
        <Button onClick={onFinish} disabled={inCart.length === 0}>
          Done
        </Button>
      </div>

      <OfflineNotice {...offline} />
      {error && <div className="mb-3"><ErrorText>{error}</ErrorText></div>}

      {toBuy.length === 0 ? (
        <p className="text-sm text-muted-foreground mb-6">Everything&apos;s in the cart. Tap Done to put it away.</p>
      ) : (
        <div className="space-y-5 mb-8">
          {groupForStore(toBuy).map((group) => (
            <section key={group.category}>
              <CategoryHeading category={group.category} label={group.label} />
              <ul className="space-y-2">
                {group.items.map((item) => (
                  <li key={item.id}>
                    <button
                      onClick={() => onToggle(item)}
                      className="w-full min-h-14 flex items-center gap-4 rounded-xl ring-1 ring-foreground/10 bg-card px-4 py-3 text-left active:bg-muted transition-colors"
                    >
                      <span className="w-6 h-6 rounded-full border-2 border-muted-foreground/40 flex-shrink-0" />
                      <span className="flex-1 min-w-0">
                        <span className="text-base font-medium">{item.name}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {inCart.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">In the cart</h2>
          <ul className="space-y-2">
            {inCart.map((item) => (
              <li key={item.id}>
                <button
                  onClick={() => onToggle(item)}
                  className="w-full min-h-12 flex items-center gap-4 rounded-xl bg-muted/50 px-4 py-2.5 text-left"
                >
                  <span className="w-6 h-6 rounded-full bg-green-600 text-white flex items-center justify-center flex-shrink-0">
                    {Icons.check}
                  </span>
                  <span className="flex-1 min-w-0 text-muted-foreground line-through">{item.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {finishing && <FinishModal inCart={inCart} onClose={onCloseFinish} finish={finish} />}
    </div>
  );
}

function FinishModal({
  inCart,
  onClose,
  finish,
}: {
  inCart: ShoppingItem[];
  onClose: () => void;
  finish: (toKitchen: ShoppingItem[]) => Promise<string | null>;
}) {
  const groceries = inCart.filter((i) => !isHousehold(i));
  const householdCount = inCart.length - groceries.length;
  const [selected, setSelected] = useState<Set<string>>(() => new Set(groceries.map((i) => i.id)));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function done() {
    setSaving(true);
    const err = await finish(groceries.filter((i) => selected.has(i.id)));
    setSaving(false);
    if (err) setError(err);
    else onClose();
  }

  return (
    <Modal
      title="Put groceries away"
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={done} disabled={saving}>
            {saving ? "Saving…" : `Done${selected.size ? ` · add ${selected.size} to kitchen` : ""}`}
          </Button>
        </>
      }
    >
      <p className="text-sm text-muted-foreground mb-3">
        Everything in the cart comes off the list.
        {groceries.length > 0 && " Uncheck anything you don't want to track in your kitchen."}
        {householdCount > 0 &&
          ` ${householdCount === 1 ? "The household item doesn't" : `The ${householdCount} household items don't`} go into the kitchen.`}
      </p>
      <ul className="space-y-1">
        {groceries.map((item) => (
          <li key={item.id}>
            <label className="flex items-center gap-3 py-1.5 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={selected.has(item.id)}
                onChange={() => toggle(item.id)}
                className="w-4 h-4 accent-[var(--color-brand-600)]"
              />
              {item.name}
            </label>
          </li>
        ))}
      </ul>
      {error && <div className="mt-3"><ErrorText>{error}</ErrorText></div>}
    </Modal>
  );
}

function EditItemModal({
  item,
  onClose,
  onSave,
}: {
  item: ShoppingItem;
  onClose: () => void;
  onSave: (item: ShoppingItem) => Promise<string | null>;
}) {
  const [name, setName] = useState(item.name);
  const [category, setCategory] = useState<ShoppingCategory>(categoryOf(item));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    const err = await onSave({ ...item, name: name.trim(), category });
    setSaving(false);
    if (err) setError(err);
    else onClose();
  }

  return (
    <Modal
      title="Edit item"
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving || !name.trim()}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <FieldLabel>Name</FieldLabel>
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={200} className="h-10 text-sm" />
        </div>
        <div>
          <FieldLabel>Category</FieldLabel>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as ShoppingCategory)}
            className={nativeSelectClass}
          >
            {SHOPPING_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>
        {error && <ErrorText>{error}</ErrorText>}
      </div>
    </Modal>
  );
}
