import { createClient } from "@/lib/supabase/server";
import { getSessionIds } from "@/lib/get-owner-id";
import { NextResponse } from "next/server";

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();
    const { ownerId } = await getSessionIds(supabase);

    const { hotelId } = await request.json();

    if (!hotelId) {
      return NextResponse.json({ error: "hotelId required" }, { status: 400 });
    }

    const { error } = await supabase
      .from("trip_hotels")
      .delete()
      .eq("id", hotelId)
      .eq("user_id", ownerId);

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Hotel delete error:", error);
    return NextResponse.json({ error: "Failed to delete hotel" }, { status: 500 });
  }
}
