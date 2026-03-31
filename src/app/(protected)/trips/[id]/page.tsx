import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { TripDay, TripActivity } from "@/types";
import { TripCalendarView } from "@/components/ui/trip-calendar-view";

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

  return (
    <div className="w-full min-w-0 overflow-hidden">
      <Link
        href="/trips"
        className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] mb-4 inline-block transition-colors"
      >
        ← Back to trips
      </Link>

      <div className="mb-6">
        <h1
          className="text-3xl font-bold mb-1"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {trip.title}
        </h1>
        <p className="text-[var(--color-text-muted)]">
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
          {trip.budget_cents &&
            ` · Budget: $${(trip.budget_cents / 100).toFixed(0)}`}
        </p>
      </div>

      {tripDays.length === 0 ? (
        <p className="text-[var(--color-text-muted)]">
          No itinerary generated yet.
        </p>
      ) : (
        <TripCalendarView days={tripDays} />
      )}
    </div>
  );
}
