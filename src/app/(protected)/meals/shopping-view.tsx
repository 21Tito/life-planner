"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { useOwnerId } from "@/lib/household-context";
import type { MealPlanEntry, PantryCategory, PantryItem, RecipeWithIngredients, ShoppingItem } from "@/types";
import {
  PANTRY_CATEGORIES,
  PLANNED_WEEKDAYS,
  STORE_CATEGORY_ORDER,
  addDays,
  buildShoppingList,
  guessCategory,
  isOnList,
  toDateStr,
} from "@/lib/meals";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Icons } from "@/components/ui/icons";
import { ErrorText, FieldLabel, Modal } from "./modal";

interface Props {
  items: ShoppingItem[];
  setItems: React.Dispatch<React.SetStateAction<ShoppingItem[]>>;
  setPantry: React.Dispatch<React.SetStateAction<PantryItem[]>>;
  weekStart: Date | null;
  entries: MealPlanEntry[];
  recipes: RecipeWithIngredients[];
  pantry: PantryItem[];
}

const CATEGORY_LABELS = new Map(PANTRY_CATEGORIES.map((c) => [c.value, c.label]));

function groupForStore(items: ShoppingItem[]) {
  const byCategory = new Map<PantryCategory, ShoppingItem[]>();
  for (const item of items) {
    const category = guessCategory(item.name);
    byCategory.set(category, [...(byCategory.get(category) ?? []), item]);
  }
  return STORE_CATEGORY_ORDER.filter((c) => byCategory.has(c)).map((c) => ({
    category: c,
    label: CATEGORY_LABELS.get(c) ?? "Other",
    items: byCategory.get(c)!.sort((a, b) => a.name.localeCompare(b.name)),
  }));
}

function itemText(item: { name: string; quantity: string | null }) {
  return item.quantity ? `${item.name} (${item.quantity})` : item.name;
}

export function ShoppingView({ items, setItems, setPantry, weekStart, entries, recipes, pantry }: Props) {
  const supabase = createClient();
  const ownerId = useOwnerId();

  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState<ShoppingItem | null>(null);
  const [shopping, setShopping] = useState(false);
  const [finishing, setFinishing] = useState(false);

  const toBuy = items.filter((i) => !i.checked);
  const inCart = items.filter((i) => i.checked);

  async function addItems(rows: { name: string; quantity: string | null }[]) {
    if (rows.length === 0) return;
    setBusy(true);
    setError(null);
    const { data, error } = await supabase
      .from("shopping_items")
      .insert(rows.map((r) => ({ user_id: ownerId, name: r.name, quantity: r.quantity })))
      .select();
    setBusy(false);
    if (error || !data) {
      setError(error?.message ?? "Couldn't add to the list.");
      return false;
    }
    setItems((prev) => [...prev, ...(data as ShoppingItem[])]);
    return true;
  }

  async function addFromForm(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    if (await addItems([{ name: trimmed, quantity: quantity.trim() || null }])) {
      setName("");
      setQuantity("");
    }
  }

  async function toggle(item: ShoppingItem) {
    const checked = !item.checked;
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, checked } : i)));
    const { error } = await supabase.from("shopping_items").update({ checked }).eq("id", item.id);
    if (error) {
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, checked: item.checked } : i)));
      setError(error.message);
    }
  }

  async function remove(item: ShoppingItem) {
    const { error } = await supabase.from("shopping_items").delete().eq("id", item.id);
    if (error) {
      setError(error.message);
      return;
    }
    setItems((prev) => prev.filter((i) => i.id !== item.id));
  }

  async function saveEdit(updated: ShoppingItem): Promise<string | null> {
    const { error } = await supabase
      .from("shopping_items")
      .update({ name: updated.name, quantity: updated.quantity })
      .eq("id", updated.id);
    if (error) return error.message;
    setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
    return null;
  }

  /** Moves the chosen checked items into the fridge and clears every checked item off the list. */
  async function finish(toFridge: ShoppingItem[]): Promise<string | null> {
    if (toFridge.length > 0) {
      const { data, error } = await supabase
        .from("pantry_items")
        .insert(
          toFridge.map((i) => ({
            user_id: ownerId,
            name: i.name,
            quantity: i.quantity,
            category: guessCategory(i.name),
          }))
        )
        .select();
      if (error || !data) return error?.message ?? "Couldn't add to the fridge.";
      setPantry((prev) => [...prev, ...(data as PantryItem[])]);
    }
    const ids = inCart.map((i) => i.id);
    const { error } = await supabase.from("shopping_items").delete().in("id", ids);
    if (error) return error.message;
    setItems((prev) => prev.filter((i) => !ids.includes(i.id)));
    setShopping(false);
    return null;
  }

  async function copyList() {
    const text = groupForStore(toBuy)
      .flatMap((g) => g.items.map(itemText))
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

  // Ingredients this week's recipes need that aren't in the fridge or already on the list
  let suggestions: ReturnType<typeof buildShoppingList> = [];
  let weekLabel = "";
  if (weekStart) {
    const from = toDateStr(weekStart);
    const to = toDateStr(addDays(weekStart, PLANNED_WEEKDAYS - 1));
    const weekEntries = entries.filter((e) => e.date >= from && e.date <= to);
    suggestions = buildShoppingList(weekEntries, recipes, pantry).filter(
      (l) => !l.match && !isOnList(l.name, items)
    );
    weekLabel = weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  const suggestionRow = (l: (typeof suggestions)[number]) => ({
    name: l.name,
    quantity: l.quantities.length ? l.quantities.join(" + ").slice(0, 100) : null,
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
      />
    );
  }

  return (
    <div className="max-w-2xl">
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
              placeholder="Add an item, e.g. tofu"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={200}
              className="h-10 text-sm flex-1"
            />
            <Input
              placeholder="Amount (optional)"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              maxLength={100}
              className="h-10 text-sm sm:w-36"
            />
            <Button type="submit" disabled={!name.trim() || busy} className="h-10 px-4 gap-1.5">
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
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                {group.label}
              </h2>
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
                      {item.quantity && <span className="text-muted-foreground"> · {item.quantity}</span>}
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
                    <span className="flex-1 min-w-0 text-sm text-muted-foreground line-through">{itemText(item)}</span>
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
              Needed for the week of {weekLabel}
            </h2>
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => addItems(suggestions.map(suggestionRow))}
            >
              Add all
            </Button>
          </div>
          <ul className="rounded-xl ring-1 ring-foreground/10 bg-card divide-y divide-border">
            {suggestions.map((line) => (
              <li key={line.key} className="flex items-center gap-3 px-4 py-2.5">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">
                    {line.name}
                    {line.quantities.length > 0 && (
                      <span className="font-normal text-muted-foreground"> · {line.quantities.join(" + ")}</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">For {line.recipes.join(", ")}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
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
}: {
  toBuy: ShoppingItem[];
  inCart: ShoppingItem[];
  onToggle: (item: ShoppingItem) => void;
  onExit: () => void;
  onFinish: () => void;
  finishing: boolean;
  onCloseFinish: () => void;
  finish: (toFridge: ShoppingItem[]) => Promise<string | null>;
  error: string | null;
}) {
  const total = toBuy.length + inCart.length;

  return (
    <div className="max-w-xl">
      <div className="sticky top-14 lg:top-0 z-10 -mx-4 px-4 py-3 mb-4 bg-background/95 backdrop-blur border-b border-border flex items-center gap-3">
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

      {error && <div className="mb-3"><ErrorText>{error}</ErrorText></div>}

      {toBuy.length === 0 ? (
        <p className="text-sm text-muted-foreground mb-6">Everything&apos;s in the cart. Tap Done to put it away.</p>
      ) : (
        <div className="space-y-5 mb-8">
          {groupForStore(toBuy).map((group) => (
            <section key={group.category}>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                {group.label}
              </h2>
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
                        {item.quantity && <span className="block text-sm text-muted-foreground">{item.quantity}</span>}
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
                  <span className="flex-1 min-w-0 text-muted-foreground line-through">{itemText(item)}</span>
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
  finish: (toFridge: ShoppingItem[]) => Promise<string | null>;
}) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(inCart.map((i) => i.id)));
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
    const err = await finish(inCart.filter((i) => selected.has(i.id)));
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
            {saving ? "Saving…" : `Done${selected.size ? ` · ${selected.size} to fridge` : ""}`}
          </Button>
        </>
      }
    >
      <p className="text-sm text-muted-foreground mb-3">
        Everything in the cart comes off the list. Uncheck anything that shouldn&apos;t go in the fridge or pantry.
      </p>
      <ul className="space-y-1">
        {inCart.map((item) => (
          <li key={item.id}>
            <label className="flex items-center gap-3 py-1.5 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={selected.has(item.id)}
                onChange={() => toggle(item.id)}
                className="w-4 h-4 accent-[var(--color-brand-600)]"
              />
              {itemText(item)}
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
  const [quantity, setQuantity] = useState(item.quantity ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    const err = await onSave({ ...item, name: name.trim(), quantity: quantity.trim() || null });
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
          <FieldLabel optional>Amount</FieldLabel>
          <Input
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            maxLength={100}
            placeholder="e.g. 2 blocks"
            className="h-10 text-sm"
          />
        </div>
        {error && <ErrorText>{error}</ErrorText>}
      </div>
    </Modal>
  );
}
