"use client";

import { useEffect, useRef, useState } from "react";
import { useServerState } from "@/lib/use-server-state";
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
  // Refreshed lists from the server are taken in by ShoppingView, which keeps unsynced changes
  const [items, setItems] = useState<ShoppingItem[]>(initialItems);
  const [pantry, setPantry] = useServerState<PantryItem[]>(initialPantry);
  useSyncShoppingCount(items);

  // This page may open from a saved copy, older than the list you last saw. The device keeps
  // that list too; whichever is newer wins. Only on arrival: a refresh brings current data.
  // (Declared before the save below.)
  const firstLoadedAt = useRef(loadedAt);
  useEffect(() => {
    const snapshot = readSnapshot(listSnapshotKey(ownerId));
    if (snapshot && snapshot.savedAt > firstLoadedAt.current && Array.isArray(snapshot.items)) {
      setItems(snapshot.items);
    }
  }, [ownerId]);

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
        serverItems={initialItems}
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
