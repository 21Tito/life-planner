import { createClient } from "@/lib/supabase/server";
import { getOwnerId } from "@/lib/get-owner-id";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const ownerId = await getOwnerId(supabase, user.id);

    const { destination, start_date, end_date, budget, notes } =
      await request.json();

    if (!destination || !start_date || !end_date) {
      return NextResponse.json(
        { error: "destination, start_date, and end_date are required" },
        { status: 400 }
      );
    }

    // Create trip with a simple default title
    const { data: trip, error: tripError } = await supabase
      .from("trips")
      .insert({
        user_id: ownerId,
        title: `${destination} Trip`,
        destination,
        start_date,
        end_date,
        notes: notes || null,
        budget_cents: budget
          ? Math.round(parseFloat(budget.replace(/[^0-9.]/g, "")) * 100)
          : null,
      })
      .select()
      .single();

    if (tripError) throw tripError;

    // Create one empty day per date in the range
    const start = new Date(start_date + "T00:00:00");
    const end = new Date(end_date + "T00:00:00");
    const daysToInsert = [];
    const current = new Date(start);
    let dayNumber = 1;

    while (current <= end) {
      daysToInsert.push({
        trip_id: trip.id,
        user_id: ownerId,
        day_number: dayNumber,
        date: current.toISOString().split("T")[0],
        title: null,
        notes: null,
      });
      current.setDate(current.getDate() + 1);
      dayNumber++;
    }

    const { error: daysError } = await supabase
      .from("trip_days")
      .insert(daysToInsert);

    if (daysError) throw daysError;

    return NextResponse.json({ trip });
  } catch (error) {
    console.error("Manual trip creation error:", error);
    return NextResponse.json(
      { error: "Failed to create trip" },
      { status: 500 }
    );
  }
}
