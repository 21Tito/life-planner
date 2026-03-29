import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// POST — create (or regenerate) an invite link for the current user's household.
// Deletes any existing pending invite first so there's always one active link.
export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Delete old invites so we keep one clean link
    await supabase.from("household_invites").delete().eq("owner_id", user.id);

    const { data: invite, error } = await supabase
      .from("household_invites")
      .insert({ owner_id: user.id })
      .select("token")
      .single();

    if (error) throw error;

    return NextResponse.json({ token: invite.token });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create invite";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// GET — return the current active invite token (if any)
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: invite } = await supabase
      .from("household_invites")
      .select("token")
      .eq("owner_id", user.id)
      .single();

    return NextResponse.json({ token: invite?.token ?? null });
  } catch {
    return NextResponse.json({ token: null });
  }
}
