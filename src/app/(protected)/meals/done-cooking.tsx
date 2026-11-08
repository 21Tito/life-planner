"use client";

import { createClient } from "@/lib/supabase/client";
import { useState } from "react";
import { useOwnerId } from "@/lib/household-context";
import type { MealPlanEntry, PantryItem, RecipeWithIngredients, ShoppingItem } from "@/types";
import { findPantryMatch, isOnList } from "@/lib/meals";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ErrorText, Modal } from "./modal";

type Choice = "have" | "out" | "buy";

const CHOICES: { value: Choice; label: string }[] = [
  { value: "have", label: "Still have" },
  { value: "out", label: "Out" },
  { value: "buy", label: "Out, buy more" },
];

interface Props {
  recipe: RecipeWithIngredients;
  entry: MealPlanEntry | undefined;
  pantry: PantryItem[];
  shoppingItems: ShoppingItem[];
  setPantry: React.Dispatch<React.SetStateAction<PantryItem[]>>;
  setShoppingItems: React.Dispatch<React.SetStateAction<ShoppingItem[]>>;
  setEntries: React.Dispatch<React.SetStateAction<MealPlanEntry[]>>;
  onClose: () => void;
  onDone: () => void;
}

/** After cooking: mark kitchen items as used up, optionally adding them to the shopping list. */
export function DoneCookingModal({
  recipe,
  entry,
  pantry,
  shoppingItems,
  setPantry,
  setShoppingItems,
  setEntries,
  onClose,
  onDone,
}: Props) {
  const supabase = createClient();
  const ownerId = useOwnerId();

  // One row per kitchen item the recipe used, even if several ingredients map to it
  const used = new Map<string, { item: PantryItem; ingredients: string[] }>();
  for (const ing of recipe.recipe_ingredients) {
    const item = findPantryMatch(ing.name, pantry);
    if (!item) continue;
    const row = used.get(item.id) ?? { item, ingredients: [] };
    row.ingredients.push(ing.name);
    used.set(item.id, row);
  }
  const rows = [...used.values()];

  const [choices, setChoices] = useState<Record<string, Choice>>({});
  const [extra, setExtra] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const choiceFor = (id: string) => choices[id] ?? "have";

  async function save() {
    setSaving(true);
    setError(null);

    const outItems = rows.filter((r) => choiceFor(r.item.id) !== "have").map((r) => r.item);
    const names = [
      ...rows.filter((r) => choiceFor(r.item.id) === "buy").map((r) => r.item.name),
      ...extra.split(",").map((s) => s.trim()).filter(Boolean),
    ];
    const toList: string[] = [];
    for (const name of names) {
      if (!isOnList(name, shoppingItems) && !isOnList(name, toList.map((n) => ({ name: n })))) {
        toList.push(name.slice(0, 200));
      }
    }

    // Add to the list first: if a later step fails, nothing has been lost
    if (toList.length > 0) {
      const { data, error } = await supabase
        .from("shopping_items")
        .insert(toList.map((name) => ({ user_id: ownerId, name })))
        .select();
      if (error || !data) {
        setSaving(false);
        setError(error?.message ?? "Couldn't update the shopping list.");
        return;
      }
      setShoppingItems((prev) => [...prev, ...(data as ShoppingItem[])]);
    }

    if (outItems.length > 0) {
      const ids = outItems.map((i) => i.id);
      const { error } = await supabase.from("pantry_items").delete().in("id", ids);
      if (error) {
        setSaving(false);
        setError(error.message);
        return;
      }
      setPantry((prev) => prev.filter((p) => !ids.includes(p.id)));
    }

    if (entry && !entry.cooked_at) {
      const cooked_at = new Date().toISOString();
      const { error } = await supabase.from("meal_plan_entries").update({ cooked_at }).eq("id", entry.id);
      if (!error) setEntries((prev) => prev.map((e) => (e.id === entry.id ? { ...e, cooked_at } : e)));
    }

    setSaving(false);
    onDone();
  }

  const outCount = rows.filter((r) => choiceFor(r.item.id) !== "have").length;
  const buyCount = rows.filter((r) => choiceFor(r.item.id) === "buy").length + (extra.trim() ? 1 : 0);

  return (
    <Modal
      title={`Done cooking ${recipe.title}`}
      onClose={onClose}
      wide
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Back to recipe</Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : outCount || buyCount ? "Save" : entry && !entry.cooked_at ? "Mark as cooked" : "Done"}
          </Button>
        </>
      }
    >
      <div className="space-y-5 text-sm">
        {rows.length === 0 ? (
          <p className="text-muted-foreground">None of this recipe&apos;s ingredients are in your kitchen list.</p>
        ) : (
          <div>
            <p className="text-muted-foreground mb-3">Did you use anything up?</p>
            <ul className="space-y-3">
              {rows.map(({ item, ingredients }) => (
                <li key={item.id} className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{item.name}</p>
                    {ingredients.some((n) => n.toLowerCase() !== item.name.toLowerCase()) && (
                      <p className="text-xs text-muted-foreground truncate">For {ingredients.join(", ")}</p>
                    )}
                  </div>
                  <div className="flex rounded-lg border border-border overflow-hidden text-xs flex-shrink-0 w-fit">
                    {CHOICES.map((c, i) => (
                      <button
                        key={c.value}
                        onClick={() => setChoices((prev) => ({ ...prev, [item.id]: c.value }))}
                        aria-pressed={choiceFor(item.id) === c.value}
                        className={cn(
                          "px-2.5 py-1.5 transition-colors",
                          i > 0 && "border-l border-border",
                          choiceFor(item.id) === c.value
                            ? c.value === "have"
                              ? "bg-secondary font-medium"
                              : "bg-[var(--color-brand-600)] text-white font-medium"
                            : "text-muted-foreground hover:bg-muted"
                        )}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-1.5">
            Need anything else?{" "}
            <span className="text-muted-foreground font-normal">(adds to the shopping list)</span>
          </label>
          <Input
            value={extra}
            onChange={(e) => setExtra(e.target.value)}
            placeholder="e.g. chili oil, scallions"
            maxLength={500}
            className="h-10 text-sm"
          />
        </div>

        {error && <ErrorText>{error}</ErrorText>}
      </div>
    </Modal>
  );
}
