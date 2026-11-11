import { createClient } from "@/lib/supabase/server";
import { getVerifiedIds } from "@/lib/get-owner-id";
import type { MealPlanEntry, PantryItem, RecipeWithIngredients, ShoppingItem } from "@/types";
import { redirect } from "next/navigation";
import { MealsClient, type MealsTab } from "./meals-client";

const DAY_MS = 24 * 60 * 60 * 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TABS: MealsTab[] = ["week", "recipes", "kitchen"];

export default async function MealsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; recipe?: string; entry?: string }>;
}) {
  const { tab: requestedTab, recipe, entry } = await searchParams;
  // Shopping used to be a Meals tab; it has its own page now
  if (requestedTab === "shopping") redirect("/shopping");
  // The Kitchen tab used to be called Fridge; keep old links working
  const tab = requestedTab === "fridge" ? "kitchen" : requestedTab;
  const supabase = await createClient();
  const { ownerId } = await getVerifiedIds(supabase);

  // The server clock is UTC; this window covers the viewer's current week in any timezone
  const now = Date.now();
  const entriesFrom = new Date(now - 8 * DAY_MS).toISOString().slice(0, 10);
  const entriesTo = new Date(now + 8 * DAY_MS).toISOString().slice(0, 10);

  const [pantry, status, recipes, entries, shopping] = await Promise.all([
    supabase.from("pantry_items").select("*").eq("user_id", ownerId).order("name"),
    supabase.from("pantry_status").select("reviewed_at").eq("user_id", ownerId).maybeSingle(),
    supabase.from("recipes").select("*, recipe_ingredients(*)").eq("user_id", ownerId).order("title"),
    supabase
      .from("meal_plan_entries")
      .select("*")
      .eq("user_id", ownerId)
      .gte("date", entriesFrom)
      .lte("date", entriesTo),
    supabase.from("shopping_items").select("*").eq("user_id", ownerId).order("created_at"),
  ]);

  return (
    <MealsClient
      initialTab={TABS.includes(tab as MealsTab) ? (tab as MealsTab) : "week"}
      initialPantry={(pantry.data ?? []) as PantryItem[]}
      initialReviewedAt={status.data?.reviewed_at ?? null}
      initialRecipes={(recipes.data ?? []) as RecipeWithIngredients[]}
      initialEntries={(entries.data ?? []) as MealPlanEntry[]}
      initialEntriesRange={{ from: entriesFrom, to: entriesTo }}
      initialShopping={(shopping.data ?? []) as ShoppingItem[]}
      initialOpenRecipe={recipe && UUID.test(recipe) ? { id: recipe, entryId: entry && UUID.test(entry) ? entry : undefined } : null}
    />
  );
}
