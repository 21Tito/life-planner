"use client";

import { createClient } from "@/lib/supabase/client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useOwnerId } from "@/lib/household-context";
import type { MealPlanEntry, MealSlot, PantryItem, RecipeWithIngredients, ShoppingItem } from "@/types";
import {
  PANTRY_REVIEW_INTERVAL_DAYS,
  PLANNED_DAYS,
  addDays,
  daysSince,
  dayRange,
  toDateStr,
} from "@/lib/meals";
import { StickyTabs } from "@/components/ui/sticky-tabs";
import { WeekView } from "./week-view";
import { RecipesView } from "./recipes-view";
import { KitchenView } from "./kitchen-view";
import { ShoppingView } from "./shopping-view";

const MAX_DAYS_SHOWN = 35;

export type MealsTab = "week" | "recipes" | "kitchen" | "shopping";
export type OpenRecipe = { id: string; entryId?: string } | null;
export type EditingSlot = { date: string; slot: MealSlot } | null;

const TAB_LABELS: { value: MealsTab; label: string }[] = [
  { value: "week", label: "This Week" },
  { value: "recipes", label: "Recipes" },
  { value: "kitchen", label: "Kitchen" },
  { value: "shopping", label: "Shopping" },
];

interface Props {
  initialTab: MealsTab;
  initialPantry: PantryItem[];
  initialReviewedAt: string | null;
  initialRecipes: RecipeWithIngredients[];
  initialEntries: MealPlanEntry[];
  initialEntriesRange: { from: string; to: string };
  initialShopping: ShoppingItem[];
  /** Opens a recipe on arrival, e.g. from the Home page */
  initialOpenRecipe?: OpenRecipe;
}

function sortIngredients(recipes: RecipeWithIngredients[]): RecipeWithIngredients[] {
  return recipes.map((r) => ({
    ...r,
    recipe_ingredients: [...r.recipe_ingredients].sort((a, b) => a.sort_order - b.sort_order),
  }));
}

export function MealsClient({
  initialTab,
  initialPantry,
  initialReviewedAt,
  initialRecipes,
  initialEntries,
  initialEntriesRange,
  initialShopping,
  initialOpenRecipe = null,
}: Props) {
  const supabase = createClient();
  const ownerId = useOwnerId();

  const [tab, setTab] = useState<MealsTab>(initialTab);
  const [pantry, setPantry] = useState<PantryItem[]>(initialPantry);
  const [reviewedAt, setReviewedAt] = useState<string | null>(initialReviewedAt);
  const [recipes, setRecipes] = useState<RecipeWithIngredients[]>(() => sortIngredients(initialRecipes));
  const [entries, setEntries] = useState<MealPlanEntry[]>(initialEntries);
  const [shoppingItems, setShoppingItems] = useState<ShoppingItem[]>(initialShopping);
  const [openRecipe, setOpenRecipe] = useState<OpenRecipe>(initialOpenRecipe);
  const [editingSlot, setEditingSlot] = useState<EditingSlot>(null);

  // Dates depend on the viewer's timezone, so they're only computed after mount
  const [now, setNow] = useState<Date | null>(null);
  // This Week is a rolling window from today; "Show more" extends it a week at a time
  const [dayCount, setDayCount] = useState(PLANNED_DAYS);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadedThrough = useRef(initialEntriesRange.to);

  useEffect(() => {
    const today = new Date();
    setNow(new Date(today.getFullYear(), today.getMonth(), today.getDate()));

    // A deep-linked recipe opens once; drop the params so a reload doesn't reopen it
    const url = new URL(window.location.href);
    if (url.searchParams.has("recipe")) {
      url.searchParams.delete("recipe");
      url.searchParams.delete("entry");
      window.history.replaceState(null, "", url);
    }
  }, []);

  const days = now ? dayRange(now, dayCount) : null;

  const showMoreDays = useCallback(async () => {
    if (!now) return;
    const nextCount = Math.min(dayCount + PLANNED_DAYS, MAX_DAYS_SHOWN);
    setDayCount(nextCount);
    const end = toDateStr(addDays(now, nextCount - 1));
    if (end <= loadedThrough.current) return;

    // Only fetch the dates that haven't been loaded yet
    const from = toDateStr(addDays(new Date(`${loadedThrough.current}T00:00:00`), 1));
    setLoadingMore(true);
    const { data, error } = await supabase
      .from("meal_plan_entries")
      .select("*")
      .eq("user_id", ownerId)
      .gte("date", from)
      .lte("date", end);
    if (!error && data) {
      loadedThrough.current = end;
      setEntries((prev) => {
        const ids = new Set(data.map((e) => e.id));
        return [...prev.filter((e) => !ids.has(e.id)), ...(data as MealPlanEntry[])];
      });
    }
    setLoadingMore(false);
  }, [now, dayCount, supabase, ownerId]);

  function switchTab(next: MealsTab) {
    setTab(next);
    const url = new URL(window.location.href);
    if (next === "week") url.searchParams.delete("tab");
    else url.searchParams.set("tab", next);
    window.history.replaceState(null, "", url);
  }

  const reviewAge = reviewedAt && now ? daysSince(reviewedAt, now) : null;
  const needsReview =
    now !== null && pantry.length > 0 && (reviewAge === null || reviewAge >= PANTRY_REVIEW_INTERVAL_DAYS);

  const toBuyCount = shoppingItems.filter((i) => !i.checked).length;

  return (
    <div className="max-w-5xl">
      <h1 className="sr-only">Meal Planner</h1>
      <StickyTabs
        label="Meal planner sections"
        value={tab}
        onChange={switchTab}
        tabs={TAB_LABELS.map((t) => ({ ...t, badge: t.value === "shopping" ? toBuyCount : undefined }))}
      />

      {needsReview && tab !== "kitchen" && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
          <p className="text-amber-900">
            {reviewAge === null
              ? "Your kitchen hasn't been reviewed yet."
              : `Your kitchen was last reviewed ${reviewAge} days ago.`}{" "}
            Check what you have before planning.
          </p>
          <button
            onClick={() => switchTab("kitchen")}
            className="font-medium text-amber-900 underline underline-offset-2 hover:no-underline"
          >
            Review kitchen
          </button>
        </div>
      )}

      {tab === "week" && (
        <WeekView
          now={now}
          days={days}
          loadingMore={loadingMore}
          canShowMore={dayCount < MAX_DAYS_SHOWN}
          onShowMore={showMoreDays}
          onShowFewer={dayCount > PLANNED_DAYS ? () => setDayCount(PLANNED_DAYS) : undefined}
          entries={entries}
          setEntries={setEntries}
          recipes={recipes}
          pantry={pantry}
          shoppingItems={shoppingItems}
          editingSlot={editingSlot}
          setEditingSlot={setEditingSlot}
          onOpenRecipe={(id, entryId) => setOpenRecipe({ id, entryId })}
          onGoToTab={switchTab}
        />
      )}
      {tab === "kitchen" && (
        <KitchenView
          pantry={pantry}
          setPantry={setPantry}
          reviewAge={reviewAge}
          onReviewed={setReviewedAt}
          now={now}
        />
      )}
      {tab === "shopping" && (
        <ShoppingView
          items={shoppingItems}
          setItems={setShoppingItems}
          setPantry={setPantry}
          days={days}
          entries={entries}
          recipes={recipes}
          pantry={pantry}
        />
      )}
      {/* Recipes view also hosts the recipe modals opened from the week grid */}
      <RecipesView
        visible={tab === "recipes"}
        recipes={recipes}
        setRecipes={setRecipes}
        entries={entries}
        setEntries={setEntries}
        pantry={pantry}
        setPantry={setPantry}
        shoppingItems={shoppingItems}
        setShoppingItems={setShoppingItems}
        openRecipe={openRecipe}
        onOpenRecipe={setOpenRecipe}
        onChangeMeal={(entry) => {
          setOpenRecipe(null);
          setEditingSlot({ date: entry.date, slot: entry.slot });
          switchTab("week");
        }}
      />
    </div>
  );
}
