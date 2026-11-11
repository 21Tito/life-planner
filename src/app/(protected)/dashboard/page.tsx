import { requirePageSession } from "@/lib/page-session";
import type { MealPlanEntry, PantryItem, RecipeWithIngredients, Trip } from "@/types";
import { DashboardClient } from "./dashboard-client";

const DAY_MS = 24 * 60 * 60 * 1000;

export default async function DashboardPage() {
  const { supabase, ownerId } = await requirePageSession();

  // The server clock is UTC; this window covers the viewer's current week in any timezone
  const now = Date.now();
  const from = new Date(now - 8 * DAY_MS).toISOString().slice(0, 10);
  const to = new Date(now + 8 * DAY_MS).toISOString().slice(0, 10);

  const [entries, recipes, pantry, shopping, trips, status] = await Promise.all([
    supabase.from("meal_plan_entries").select("*").eq("user_id", ownerId).gte("date", from).lte("date", to),
    supabase.from("recipes").select("*, recipe_ingredients(*)").eq("user_id", ownerId),
    supabase.from("pantry_items").select("*").eq("user_id", ownerId),
    supabase.from("shopping_items").select("id").eq("user_id", ownerId).eq("checked", false),
    supabase.from("trips").select("*").eq("user_id", ownerId).gte("end_date", from).order("start_date"),
    supabase.from("pantry_status").select("reviewed_at").eq("user_id", ownerId).maybeSingle(),
  ]);

  return (
    <DashboardClient
      entries={(entries.data ?? []) as MealPlanEntry[]}
      recipes={(recipes.data ?? []) as RecipeWithIngredients[]}
      pantry={(pantry.data ?? []) as PantryItem[]}
      shoppingCount={shopping.data?.length ?? 0}
      trips={(trips.data ?? []) as Trip[]}
      reviewedAt={status.data?.reviewed_at ?? null}
    />
  );
}
