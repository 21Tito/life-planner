import { createClient } from "@/lib/supabase/server";
import { getSessionIds } from "@/lib/get-owner-id";
import { NextResponse } from "next/server";

function dateRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const current = new Date(start + "T00:00:00");
  const endDate = new Date(end + "T00:00:00");
  while (current <= endDate) {
    dates.push(current.toISOString().split("T")[0]);
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    const { ownerId } = await getSessionIds(supabase);

    const { tripId, destination, start_date, end_date, notes } =
      await request.json();

    if (!tripId || !destination || !start_date || !end_date) {
      return NextResponse.json({ error: "tripId, destination, start_date, end_date required" }, { status: 400 });
    }

    // Verify the trip belongs to this household
    const { data: trip, error: fetchError } = await supabase
      .from("trips")
      .select("id, start_date, end_date")
      .eq("id", tripId)
      .eq("user_id", ownerId)
      .single();

    if (fetchError || !trip) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    // Update the trip row
    const { error: tripError } = await supabase
      .from("trips")
      .update({
        destination: destination.trim(),
        title: `${destination.trim()} Trip`,
        start_date,
        end_date,
        notes: notes?.trim() || null,
      })
      .eq("id", tripId);

    if (tripError) throw tripError;

    // Reconcile trip_days
    const newDates = new Set(dateRange(start_date, end_date));

    // Fetch existing days
    const { data: existingDays } = await supabase
      .from("trip_days")
      .select("id, date, day_number")
      .eq("trip_id", tripId)
      .order("day_number");

    const existingDates = new Set((existingDays ?? []).map((d) => d.date));

    // Delete days outside the new range
    const toDelete = (existingDays ?? []).filter((d) => !newDates.has(d.date));
    if (toDelete.length > 0) {
      await supabase
        .from("trip_days")
        .delete()
        .in("id", toDelete.map((d) => d.id));
    }

    // Insert missing days
    const toInsert = [...newDates]
      .filter((date) => !existingDates.has(date))
      .sort();

    if (toInsert.length > 0) {
      // Renumber all days by the full new date range order
      const allDates = dateRange(start_date, end_date);
      const inserts = toInsert.map((date) => ({
        trip_id: tripId,
        user_id: ownerId,
        day_number: allDates.indexOf(date) + 1,
        date,
        title: null,
        notes: null,
      }));
      const { error: insertError } = await supabase
        .from("trip_days")
        .insert(inserts);
      if (insertError) throw insertError;
    }

    // Renumber all remaining days in date order
    const { data: allDays } = await supabase
      .from("trip_days")
      .select("id, date")
      .eq("trip_id", tripId)
      .order("date");

    if (allDays && allDays.length > 0) {
      await Promise.all(
        allDays.map((d, i) =>
          supabase
            .from("trip_days")
            .update({ day_number: i + 1 })
            .eq("id", d.id)
        )
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Trip update error:", error);
    return NextResponse.json({ error: "Failed to update trip" }, { status: 500 });
  }
}
