"use client";

import { useEffect, useState } from "react";
import type { MealPlanEntry, PantryItem, RecipeWithIngredients, ShoppingItem } from "@/types";
import { PLANNED_DAYS, dayRange } from "@/lib/meals";
import { useOwnerId } from "@/lib/household-context";
import { listSnapshotKey } from "@/lib/offline";
import { useSyncShoppingCount } from "@/lib/shopping-count-context";
import { ShoppingView } from "./shopping-view";

interface Props {
  initialItems: ShoppingItem[];
  /** When the server loaded initialItems; a saved offline copy of the page keeps an old one */
  loadedAt: number;
  initialPantry: PantryItem[];
  recipes: RecipeWithIngredients[];
  entries: MealPlanEntry[];
}

interface ListSnapshot {
  savedAt: number;
  items: ShoppingItem[];
}

function readSnapshot(key: string): ListSnapshot | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as ListSnapshot) : null;
  } catch {
    return null;
  }
}

export function ShoppingClient({ initialItems, loadedAt, initialPantry, recipes, entries }: Props) {
  const ownerId = useOwnerId();
  const [items, setItems] = useState<ShoppingItem[]>(initialItems);
  const [pantry, setPantry] = useState<PantryItem[]>(initialPantry);
  useSyncShoppingCount(items);

  // Offline, this page may be a saved copy from earlier, older than the list you last saw.
  // The device keeps that list too; whichever is newer wins. (Declared before the save below.)
  useEffect(() => {
    const snapshot = readSnapshot(listSnapshotKey(ownerId));
    if (snapshot && snapshot.savedAt > loadedAt && Array.isArray(snapshot.items)) setItems(snapshot.items);
  }, [ownerId, loadedAt]);

  useEffect(() => {
    try {
      localStorage.setItem(listSnapshotKey(ownerId), JSON.stringify({ savedAt: Date.now(), items }));
    } catch {
      // Storage blocked or full: offline reloads fall back to the saved page
    }
  }, [ownerId, items]);

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
