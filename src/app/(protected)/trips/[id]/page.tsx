import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { TripDay, TripActivity } from "@/types";

const CATEGORY_ICONS: Record<string, string> = {
  flight: "✈️",
  hotel: "🏨",
  restaurant: "🍴",
  activity: "⭐",
  transport: "🚌",
  shopping: "🛍️",
  rest: "😴",
  other: "📌",
};

export default async function TripDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: trip } = await supabase
    .from("trips")
    .select("*")
    .eq("id", id)
    .single();

  if (!trip) notFound();

  const { data: days } = await supabase
    .from("trip_days")
    .select("*, trip_activities(*)")
    .eq("trip_id", id)
    .order("day_number");

  const tripDays: (TripDay & { trip_activities: TripActivity[] })[] = days || [];

  function formatTime(time: string | null) {
    if (!time) return "";
    const [h, m] = time.split(":");
    const hour = parseInt(h);
    const ampm = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${m} ${ampm}`;
  }

  function formatCost(cents: number | null) {
    if (!cents) return null;
    return `$${(cents / 100).toFixed(0)}`;
  }

  return (
    <div className="max-w-4xl">
      <Link
        href="/trips"
        className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] mb-4 inline-block transition-colors"
      >
        ← Back to trips
      </Link>

      <h1
        className="text-3xl font-bold mb-1"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {trip.title}
      </h1>
      <p className="text-[var(--color-text-muted)] mb-8">
        {trip.destination} ·{" "}
        {new Date(trip.start_date + "T00:00:00").toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
        })}{" "}
        –{" "}
        {new Date(trip.end_date + "T00:00:00").toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        })}
        {trip.budget_cents && ` · Budget: $${(trip.budget_cents / 100).toFixed(0)}`}
      </p>

      {/* Day-by-day itinerary */}
      <div className="space-y-8">
        {tripDays.map((day) => (
          <div key={day.id}>
            <div className="flex items-baseline gap-3 mb-4">
              <span className="text-sm font-bold text-[var(--color-brand-600)]">
                DAY {day.day_number}
              </span>
              <h2 className="text-lg font-semibold">{day.title || `Day ${day.day_number}`}</h2>
              <span className="text-sm text-[var(--color-text-muted)]">
                {new Date(day.date + "T00:00:00").toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </div>

            {day.notes && (
              <p className="text-sm text-[var(--color-text-muted)] mb-4 italic">
                {day.notes}
              </p>
            )}

            <div className="space-y-2 ml-4 border-l-2 border-[var(--color-border)] pl-6">
              {day.trip_activities
                ?.sort((a: TripActivity, b: TripActivity) => a.sort_order - b.sort_order)
                .map((activity: TripActivity) => (
                  <div
                    key={activity.id}
                    className="rounded-lg border border-[var(--color-border)] bg-white p-4"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <span className="text-lg mt-0.5">
                          {CATEGORY_ICONS[activity.category] || "📌"}
                        </span>
                        <div>
                          <h3 className="font-medium text-sm">{activity.title}</h3>
                          {activity.description && (
                            <p className="text-xs text-[var(--color-text-muted)] mt-1">
                              {activity.description}
                            </p>
                          )}
                          {activity.location && (
                            <p className="text-xs text-[var(--color-text-muted)] mt-1">
                              📍 {activity.location}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-4">
                        {activity.start_time && (
                          <p className="text-xs font-medium">
                            {formatTime(activity.start_time)}
                            {activity.end_time && ` – ${formatTime(activity.end_time)}`}
                          </p>
                        )}
                        {activity.cost_cents && (
                          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                            {formatCost(activity.cost_cents)}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
