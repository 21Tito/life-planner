import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

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

    const { token } = await request.json();
    if (!token) {
      return NextResponse.json({ error: "token required" }, { status: 400 });
    }

    // Look up the invite
    const { data: invite } = await supabase
      .from("household_invites")
      .select("owner_id")
      .eq("token", token)
      .single();

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

    // Check if already a member somewhere
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

    // Use admin client for both operations — the household_members INSERT
    // must bypass RLS because the accepting user's auth.uid() is member_id,
    // not owner_id, so the "Owners manage members" policy would reject it.
    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { error } = await admin.from("household_members").insert({
      owner_id: invite.owner_id,
      member_id: user.id,
    });

    if (error) throw error;

    // Store owner_id in user metadata so the layout never needs to query DB.
    await admin.auth.admin.updateUserById(user.id, {
      user_metadata: { household_owner_id: invite.owner_id },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to accept invite";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
