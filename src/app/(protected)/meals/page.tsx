import { createClient } from "@/lib/supabase/server";
import { getSessionIds } from "@/lib/get-owner-id";
import type { MealPlanEntry, PantryItem, RecipeWithIngredients } from "@/types";
import { MealsClient, type MealsTab } from "./meals-client";

const DAY_MS = 24 * 60 * 60 * 1000;
const TABS: MealsTab[] = ["week", "recipes", "fridge"];

export default async function MealsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const supabase = await createClient();
  const { ownerId } = await getSessionIds(supabase);

  // The server clock is UTC; this window covers the viewer's current week in any timezone
  const now = Date.now();
  const entriesFrom = new Date(now - 8 * DAY_MS).toISOString().slice(0, 10);
  const entriesTo = new Date(now + 8 * DAY_MS).toISOString().slice(0, 10);

  const [pantry, status, recipes, entries] = await Promise.all([
    supabase.from("pantry_items").select("*").eq("user_id", ownerId).order("name"),
    supabase.from("pantry_status").select("reviewed_at").eq("user_id", ownerId).maybeSingle(),
    supabase.from("recipes").select("*, recipe_ingredients(*)").eq("user_id", ownerId).order("title"),
    supabase
      .from("meal_plan_entries")
      .select("*")
      .eq("user_id", ownerId)
      .gte("date", entriesFrom)
      .lte("date", entriesTo),
  ]);

  return (
    <MealsClient
      initialTab={TABS.includes(tab as MealsTab) ? (tab as MealsTab) : "week"}
      initialPantry={(pantry.data ?? []) as PantryItem[]}
      initialReviewedAt={status.data?.reviewed_at ?? null}
      initialRecipes={(recipes.data ?? []) as RecipeWithIngredients[]}
      initialEntries={(entries.data ?? []) as MealPlanEntry[]}
      initialEntriesRange={{ from: entriesFrom, to: entriesTo }}
    />
  );
}
