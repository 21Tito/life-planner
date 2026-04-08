"use client";

import { createClient } from "@/lib/supabase/client";
import { useState, useRef } from "react";
import { useOwnerId } from "@/lib/household-context";
import type { GroceryListItem } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Icons } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

interface Props {
  initialItems: GroceryListItem[];
}

export function MealsClient({ initialItems }: Props) {
  const supabase = createClient();
  const ownerId = useOwnerId();
  const [items, setItems] = useState<GroceryListItem[]>(initialItems);
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);

  const groceries = items.filter((i) => !i.is_staple);
  const staples = items.filter((i) => i.is_staple);
  const checkedCount = groceries.filter((i) => i.checked).length;

  async function addItem(is_staple: boolean) {
    const trimmed = name.trim();
    if (!trimmed) return;

    const { data } = await supabase
      .from("grocery_list_items")
      .insert({ name: trimmed, quantity: quantity.trim() || null, is_staple, user_id: ownerId })
      .select()
      .single();

    if (data) {
      setItems((prev) => [...prev, data]);
      setName("");
      setQuantity("");
      nameRef.current?.focus();
    }
  }

  async function removeItem(id: string) {
    await supabase.from("grocery_list_items").delete().eq("id", id);
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  async function toggleChecked(item: GroceryListItem) {
    const next = !item.checked;
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, checked: next } : i)));
    await supabase.from("grocery_list_items").update({ checked: next }).eq("id", item.id);
  }

  async function clearChecked() {
    const checkedIds = groceries.filter((i) => i.checked).map((i) => i.id);
    if (!checkedIds.length) return;
    await supabase.from("grocery_list_items").delete().in("id", checkedIds);
    setItems((prev) => prev.filter((i) => !checkedIds.includes(i.id)));
  }

  async function addStapleToList(staple: GroceryListItem) {
    const { data } = await supabase
      .from("grocery_list_items")
      .insert({ name: staple.name, quantity: staple.quantity, is_staple: false, user_id: ownerId })
      .select()
      .single();
    if (data) setItems((prev) => [...prev, data]);
  }

  async function addAllStaplesToList() {
    if (!staples.length) return;
    const inserts = staples.map((s) => ({
      name: s.name,
      quantity: s.quantity,
      is_staple: false,
      user_id: ownerId,
    }));
    const { data } = await supabase.from("grocery_list_items").insert(inserts).select();
    if (data) setItems((prev) => [...prev, ...data]);
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl lg:text-3xl font-bold mb-1" style={{ fontFamily: "var(--font-display)" }}>
        Groceries
      </h1>
      <p className="text-sm text-muted-foreground mb-8">
        Build your list as you go. Check things off at the store.
      </p>

      {/* Add item form */}
      <div className="flex gap-2 mb-10">
        <Input
          ref={nameRef}
          placeholder="Add an item…"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addItem(false)}
          className="h-10 text-sm"
        />
        <Input
          placeholder="Qty"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addItem(false)}
          className="w-20 h-10 text-sm shrink-0"
        />
        <Button onClick={() => addItem(false)} className="h-10 gap-1.5 shrink-0">
          <span>{Icons.plus}</span>
          Add
        </Button>
        <Button
          variant="outline"
          onClick={() => addItem(true)}
          className="h-10 shrink-0 text-muted-foreground"
          title="Save as a staple"
        >
          ★ Staple
        </Button>
      </div>

      {/* Grocery List */}
      <section className="mb-10">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Grocery List
          </h2>
          {checkedCount > 0 && (
            <button
              onClick={clearChecked}
              className="text-xs text-muted-foreground hover:text-destructive transition-colors"
            >
              Clear {checkedCount} checked
            </button>
          )}
        </div>

        {groceries.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">Nothing on your list yet.</p>
        ) : (
          <div className="space-y-1.5">
            {groceries.map((item) => (
              <div
                key={item.id}
                className={cn(
                  "flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 transition-colors",
                  item.checked && "opacity-50"
                )}
              >
                <input
                  type="checkbox"
                  checked={item.checked}
                  onChange={() => toggleChecked(item)}
                  className="w-4 h-4 rounded border-border accent-primary shrink-0 cursor-pointer"
                />
                <span className={cn("text-sm font-medium flex-1", item.checked && "line-through")}>
                  {item.name}
                </span>
                {item.quantity && (
                  <span className="text-sm text-muted-foreground shrink-0">· {item.quantity}</span>
                )}
                <button
                  onClick={() => removeItem(item.id)}
                  className="text-muted-foreground hover:text-destructive transition-colors ml-1 shrink-0"
                >
                  {Icons.close}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Staples */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Staples
          </h2>
          {staples.length > 0 && (
            <button
              onClick={addAllStaplesToList}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Add all to list
            </button>
          )}
        </div>

        {staples.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            Save items you always buy as staples — add them all to your list with one tap.
          </p>
        ) : (
          <div className="space-y-1.5">
            {staples.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3"
              >
                <span className="text-muted-foreground text-xs shrink-0">★</span>
                <span className="text-sm font-medium flex-1">{item.name}</span>
                {item.quantity && (
                  <span className="text-sm text-muted-foreground shrink-0">· {item.quantity}</span>
                )}
                <button
                  onClick={() => addStapleToList(item)}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0 ml-1"
                >
                  + Add to list
                </button>
                <button
                  onClick={() => removeItem(item.id)}
                  className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                >
                  {Icons.close}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
