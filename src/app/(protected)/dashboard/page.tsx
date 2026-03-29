import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { StatCard } from "@/components/ui/stat-card";
import { Icons } from "@/components/ui/icons";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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

  const mealCount = mealPlans?.length ?? 0;
  const tripCount = trips?.length ?? 0;

  return (
    <div className="max-w-4xl">
      <h1
        className="text-2xl lg:text-3xl font-bold mb-1"
        style={{ fontFamily: "var(--font-display)" }}
      >
        Good {getGreeting()}
      </h1>
      <p className="text-sm text-[var(--color-text-muted)] mb-6 lg:mb-8">
        Here&apos;s what&apos;s on your plate — literally and figuratively.
      </p>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 lg:gap-4 mb-6 lg:mb-10">
        <StatCard
          label="Meal Plans"
          value={mealCount}
          icon={Icons.clipboard}
          trend={mealCount > 0 ? `${mealCount} created` : undefined}
        />
        <StatCard
          label="Trips Planned"
          value={tripCount}
          icon={Icons.map}
          trend={tripCount > 0 ? `${tripCount} planned` : undefined}
        />
      </div>

      {/* Feature cards */}
      <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-3 lg:mb-4">
        Quick Actions
      </h2>
      <div className="grid gap-3 lg:gap-4 grid-cols-1 sm:grid-cols-2">
        <Link
          href="/meals"
          className="group rounded-xl border border-[var(--color-border)] bg-white p-5 lg:p-6 shadow-sm hover:shadow-md transition-all hover:border-[var(--color-brand-300)] flex items-start gap-4 sm:flex-col sm:items-start"
        >
          <div className="w-10 h-10 rounded-lg bg-[var(--color-brand-50)] flex items-center justify-center text-[var(--color-brand-400)] flex-shrink-0">
            {Icons.clipboard}
          </div>
          <div>
            <h3 className="text-base font-semibold mb-1">Meal Planner</h3>
            <p className="text-sm text-[var(--color-text-muted)]">
              Plan your week&apos;s meals based on what&apos;s in your fridge
            </p>
            {mealCount > 0 && (
              <p className="text-xs font-medium text-[var(--color-brand-600)] mt-2">
                {mealCount} plan{mealCount !== 1 ? "s" : ""} created →
              </p>
            )}
          </div>
        </Link>

        <Link
          href="/trips"
          className="group rounded-xl border border-[var(--color-border)] bg-white p-5 lg:p-6 shadow-sm hover:shadow-md transition-all hover:border-[var(--color-brand-300)] flex items-start gap-4 sm:flex-col sm:items-start"
        >
          <div className="w-10 h-10 rounded-lg bg-[var(--color-brand-50)] flex items-center justify-center text-[var(--color-brand-400)] flex-shrink-0">
            {Icons.map}
          </div>
          <div>
            <h3 className="text-base font-semibold mb-1">Trip Planner</h3>
            <p className="text-sm text-[var(--color-text-muted)]">
              Plan your next adventure with a day-by-day itinerary
            </p>
            {tripCount > 0 && (
              <p className="text-xs font-medium text-[var(--color-brand-600)] mt-2">
                {tripCount} trip{tripCount !== 1 ? "s" : ""} planned →
              </p>
            )}
          </div>
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
