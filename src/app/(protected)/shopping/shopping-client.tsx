"use client";

import { useEffect, useState } from "react";
import type { MealPlanEntry, PantryItem, RecipeWithIngredients, ShoppingItem } from "@/types";
import { PLANNED_DAYS, dayRange } from "@/lib/meals";
import { useSyncShoppingCount } from "@/lib/shopping-count-context";
import { ShoppingView } from "./shopping-view";

interface Props {
  initialItems: ShoppingItem[];
  initialPantry: PantryItem[];
  recipes: RecipeWithIngredients[];
  entries: MealPlanEntry[];
}

export function ShoppingClient({ initialItems, initialPantry, recipes, entries }: Props) {
  const [items, setItems] = useState<ShoppingItem[]>(initialItems);
  const [pantry, setPantry] = useState<PantryItem[]>(initialPantry);
  useSyncShoppingCount(items);

  // Dates depend on the viewer's timezone, so they're only computed after mount
  const [days, setDays] = useState<Date[] | null>(null);
  useEffect(() => {
    const today = new Date();
    setDays(dayRange(new Date(today.getFullYear(), today.getMonth(), today.getDate()), PLANNED_DAYS));
  }, []);

  return (
    <div className="max-w-5xl">
      <h1 className="sr-only">Shopping list</h1>
      <ShoppingView
        items={items}
        setItems={setItems}
        setPantry={setPantry}
        days={days}
        entries={entries}
        recipes={recipes}
        pantry={pantry}
      />
    </div>
  );
}
