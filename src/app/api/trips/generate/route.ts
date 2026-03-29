import { createClient } from "@/lib/supabase/server";
import { generateTripItinerary } from "@/lib/claude";
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

    const body = await request.json();
    const { destination, start_date, end_date, interests, budget, notes } = body;

    // Generate itinerary via Claude
    const itinerary = await generateTripItinerary({
      destination,
      start_date,
      end_date,
      interests,
      budget,
      notes,
    });

    // Save trip
    const { data: trip, error: tripError } = await supabase
      .from("trips")
      .insert({
        user_id: user.id,
        title: itinerary.title,
        destination,
        start_date,
        end_date,
        notes,
        budget_cents: budget ? Math.round(parseFloat(budget) * 100) : null,
      })
      .select()
      .single();

    if (tripError) throw tripError;

    // Save days and activities
    for (const day of itinerary.days) {
      const { data: tripDay, error: dayError } = await supabase
        .from("trip_days")
        .insert({
          trip_id: trip.id,
          user_id: user.id,
          day_number: day.day_number,
          date: day.date,
          title: day.title,
          notes: day.notes,
        })
        .select()
        .single();

      if (dayError) throw dayError;

      if (day.activities?.length > 0) {
        const activitiesToInsert = day.activities.map(
          (activity: {
            title: string;
            description: string;
            category: string;
            start_time: string;
            end_time: string;
            location: string;
            cost_cents: number;
            booking_url: string | null;
            sort_order: number;
          }) => ({
            trip_day_id: tripDay.id,
            user_id: user.id,
            title: activity.title,
            description: activity.description,
            category: activity.category,
            start_time: activity.start_time,
            end_time: activity.end_time,
            location: activity.location,
            cost_cents: activity.cost_cents,
            booking_url: activity.booking_url,
            sort_order: activity.sort_order,
          })
        );

        const { error: actError } = await supabase
          .from("trip_activities")
          .insert(activitiesToInsert);

        if (actError) throw actError;
      }
    }

    return NextResponse.json({ trip, itinerary });
  } catch (error) {
    console.error("Trip generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate trip itinerary" },
      { status: 500 }
    );
  }
}
