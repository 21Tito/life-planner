import { createClient } from "@/lib/supabase/server";
import { getSessionIds } from "@/lib/get-owner-id";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { ownerId } = await getSessionIds(supabase);

    const { tripId, name, location, maps_url, check_in_date, check_out_date, notes } =
      await request.json();

    if (!tripId || !name || !check_in_date || !check_out_date) {
      return NextResponse.json(
        { error: "tripId, name, check_in_date, check_out_date required" },
        { status: 400 }
      );
    }

    const { data: hotel, error } = await supabase
      .from("trip_hotels")
      .insert({
        trip_id: tripId,
        user_id: ownerId,
        name: name.trim(),
        location: location?.trim() || null,
        maps_url: maps_url?.trim() || null,
        check_in_date,
        check_out_date,
        notes: notes?.trim() || null,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ hotel });
  } catch (error) {
    console.error("Hotel create error:", error);
    return NextResponse.json({ error: "Failed to create hotel" }, { status: 500 });
  }
}
