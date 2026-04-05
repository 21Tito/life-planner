import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import type { TripDay, TripActivity, TripHotel } from "@/types";
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

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const [{ data: days }, { data: hotels }] = await Promise.all([
    supabase
      .from("trip_days")
      .select("*, trip_activities(*)")
      .eq("trip_id", id)
      .order("day_number"),
    admin
      .from("trip_hotels")
      .select("*")
      .eq("trip_id", id)
      .order("check_in_date"),
  ]);

  const tripDays: (TripDay & { trip_activities: TripActivity[] })[] = days || [];
  const tripHotels: TripHotel[] = hotels || [];

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
          initialTimezone={trip.timezone ?? null}
          initialHotels={tripHotels}
          tripStartDate={trip.start_date}
          tripEndDate={trip.end_date}
        />
      )}
    </div>
  );
}
