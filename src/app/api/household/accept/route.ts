import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// POST { token } — accept an invite and join the owner's household
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { token } = await request.json().catch(() => ({}));
    if (typeof token !== "string" || !UUID.test(token)) {
      return NextResponse.json({ error: "Invite not found or has been revoked" }, { status: 404 });
    }

    // Invites aren't readable through RLS (the token is the secret), so look this one up by token here.
    // The household_members insert also needs the service role: the "Owners manage members" policy
    // would reject it because the accepting user is the member, not the owner.
    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: invite } = await admin
      .from("household_invites")
      .select("owner_id")
      .eq("token", token)
      .maybeSingle();

    if (!invite) {
      return NextResponse.json(
        { error: "Invite not found or has been revoked" },
        { status: 404 }
      );
    }

    if (invite.owner_id === user.id) {
      return NextResponse.json(
        { error: "You cannot join your own household" },
        { status: 400 }
      );
    }

    const { data: existing } = await supabase
      .from("household_members")
      .select("owner_id")
      .eq("member_id", user.id)
      .maybeSingle();

    if (existing) {
      if (existing.owner_id === invite.owner_id) {
        return NextResponse.json({ alreadyMember: true });
      }
      return NextResponse.json(
        { error: "You are already a member of another household" },
        { status: 400 }
      );
    }

    const { error } = await admin.from("household_members").insert({
      owner_id: invite.owner_id,
      member_id: user.id,
    });

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Accept invite failed:", err);
    return NextResponse.json({ error: "Failed to accept invite" }, { status: 500 });
  }
}
