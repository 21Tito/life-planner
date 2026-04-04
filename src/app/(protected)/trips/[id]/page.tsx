import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
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
    <div className="w-full min-w-0 overflow-hidden -mb-24 lg:mb-0">
      {tripDays.length === 0 ? (
        <p className="text-[var(--color-text-muted)]">
          No itinerary generated yet.
        </p>
      ) : (
        <TripCalendarView
          days={tripDays}
          tripId={trip.id}
          initialTimezone={trip.timezone || "UTC"}
        />
      )}
    </div>
  );
}
