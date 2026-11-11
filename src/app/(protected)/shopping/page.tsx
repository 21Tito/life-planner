import { requirePageSession } from "@/lib/page-session";
import type { MealPlanEntry, PantryItem, RecipeWithIngredients, ShoppingItem } from "@/types";
import { ShoppingClient } from "./shopping-client";

const DAY_MS = 24 * 60 * 60 * 1000;

export default async function ShoppingPage() {
  const { supabase, ownerId } = await requirePageSession();

  // The server clock is UTC; this covers the viewer's next 7 days in any timezone,
  // for the "Needed for the next 7 days" suggestions
  const now = Date.now();
  const entriesFrom = new Date(now - DAY_MS).toISOString().slice(0, 10);
  const entriesTo = new Date(now + 8 * DAY_MS).toISOString().slice(0, 10);

  const [shopping, pantry, recipes, entries] = await Promise.all([
    supabase.from("shopping_items").select("*").eq("user_id", ownerId).order("created_at"),
    supabase.from("pantry_items").select("*").eq("user_id", ownerId).order("name"),
    supabase.from("recipes").select("*, recipe_ingredients(*)").eq("user_id", ownerId).order("title"),
    supabase
      .from("meal_plan_entries")
      .select("*")
      .eq("user_id", ownerId)
      .gte("date", entriesFrom)
      .lte("date", entriesTo),
  ]);

  return (
    <ShoppingClient
      initialItems={(shopping.data ?? []) as ShoppingItem[]}
      loadedAt={now}
      initialPantry={(pantry.data ?? []) as PantryItem[]}
      recipes={(recipes.data ?? []) as RecipeWithIngredients[]}
      entries={(entries.data ?? []) as MealPlanEntry[]}
    />
  );
}
