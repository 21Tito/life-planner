import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fetch recent data
  const [{ data: mealPlans }, { data: trips }] = await Promise.all([
    supabase
      .from("meal_plans")
      .select("*")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false })
      .limit(3),
    supabase
      .from("trips")
      .select("*")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false })
      .limit(3),
  ]);

  return (
    <div className="max-w-4xl">
      <h1
        className="text-3xl font-bold mb-1"
        style={{ fontFamily: "var(--font-display)" }}
      >
        Good {getGreeting()}
      </h1>
      <p className="text-[var(--color-text-muted)] mb-10">
        Here&apos;s what&apos;s on your plate — literally and figuratively.
      </p>

      <div className="grid gap-6 sm:grid-cols-2">
        {/* Meal Planner Card */}
        <Link
          href="/meals"
          className="group relative rounded-2xl border border-[var(--color-border)] bg-white p-6 shadow-sm hover:shadow-md transition-all hover:border-[var(--color-brand-300)]"
        >
          <span className="text-3xl mb-3 block">🍽</span>
          <h2 className="text-lg font-semibold mb-1">Meal Planner</h2>
          <p className="text-sm text-[var(--color-text-muted)] mb-4">
            Plan your week&apos;s meals based on what&apos;s in your fridge
          </p>
          {mealPlans && mealPlans.length > 0 ? (
            <p className="text-xs text-[var(--color-brand-600)] font-medium">
              {mealPlans.length} plan{mealPlans.length !== 1 ? "s" : ""} created
            </p>
          ) : (
            <p className="text-xs text-[var(--color-text-muted)]">
              No plans yet — create your first one
            </p>
          )}
        </Link>

        {/* Trip Planner Card */}
        <Link
          href="/trips"
          className="group relative rounded-2xl border border-[var(--color-border)] bg-white p-6 shadow-sm hover:shadow-md transition-all hover:border-[var(--color-brand-300)]"
        >
          <span className="text-3xl mb-3 block">✈️</span>
          <h2 className="text-lg font-semibold mb-1">Trip Planner</h2>
          <p className="text-sm text-[var(--color-text-muted)] mb-4">
            Plan your next adventure with a day-by-day itinerary
          </p>
          {trips && trips.length > 0 ? (
            <p className="text-xs text-[var(--color-brand-600)] font-medium">
              {trips.length} trip{trips.length !== 1 ? "s" : ""} planned
            </p>
          ) : (
            <p className="text-xs text-[var(--color-text-muted)]">
              No trips yet — start planning
            </p>
          )}
        </Link>
      </div>
    </div>
  );
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}
