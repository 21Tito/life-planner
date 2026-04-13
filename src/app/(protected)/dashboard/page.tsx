import { createClient } from "@/lib/supabase/server";
import { getSessionIds } from "@/lib/get-owner-id";
import Link from "next/link";
import { StatCard } from "@/components/ui/stat-card";
import { Icons } from "@/components/ui/icons";
import { Card, CardContent } from "@/components/ui/card";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { ownerId } = await getSessionIds(supabase);

  const [{ data: mealPlans }, { data: trips }] = await Promise.all([
    supabase
      .from("meal_plans")
      .select("*")
      .eq("user_id", ownerId)
      .order("created_at", { ascending: false })
      .limit(3),
    supabase
      .from("trips")
      .select("*")
      .eq("user_id", ownerId)
      .order("start_date", { ascending: true }),
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
      <p className="text-sm text-muted-foreground mb-6 lg:mb-8">
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

      {/* Trips */}
      <div className="flex items-center justify-between mb-3 lg:mb-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Your Trips
        </h2>
        <Link href="/trips" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
          View all →
        </Link>
      </div>
      {trips && trips.length > 0 ? (
        <div className="space-y-3">
          {trips.map((trip) => (
            <Link key={trip.id} href={`/trips/${trip.id}`} className="block">
              <Card className="hover:ring-primary/30 hover:shadow-md transition-all cursor-pointer">
                <CardContent className="py-4 px-5">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center text-primary/70 flex-shrink-0">
                      {Icons.map}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold truncate">{trip.destination}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatDate(trip.start_date)} – {formatDate(trip.end_date)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Link href="/trips">
          <Card className="hover:ring-primary/30 hover:shadow-md transition-all cursor-pointer border-dashed">
            <CardContent className="py-6 px-5 flex items-center justify-center gap-2 text-muted-foreground">
              {Icons.map}
              <span className="text-sm">Plan your first trip</span>
            </CardContent>
          </Card>
        </Link>
      )}
    </div>
  );
}

function formatDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}
