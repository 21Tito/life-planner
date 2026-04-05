import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { getSessionIds } from "@/lib/get-owner-id";
import { NextResponse } from "next/server";

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    const { ownerId } = await getSessionIds(supabase);

    const { hotelId, name, location, maps_url, check_in_date, check_out_date, notes } =
      await request.json();

    if (!hotelId || !name || !check_in_date || !check_out_date) {
      return NextResponse.json(
        { error: "hotelId, name, check_in_date, check_out_date required" },
        { status: 400 }
      );
    }

    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { error } = await admin
      .from("trip_hotels")
      .update({
        name: name.trim(),
        location: location?.trim() || null,
        maps_url: maps_url?.trim() || null,
        check_in_date,
        check_out_date,
        notes: notes?.trim() || null,
      })
      .eq("id", hotelId)
      .eq("user_id", ownerId);

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Hotel update error:", error);
    return NextResponse.json({ error: "Failed to update hotel" }, { status: 500 });
  }
}
