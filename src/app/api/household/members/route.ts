import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// DELETE ?memberId=xxx — owner removes a member from their household
export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const memberId = searchParams.get("memberId");

    if (!memberId) {
      return NextResponse.json({ error: "memberId required" }, { status: 400 });
    }

    const { error } = await supabase
      .from("household_members")
      .delete()
      .eq("owner_id", user.id)
      .eq("member_id", memberId);

    if (error) throw error;

    // Clear the household_owner_id from the removed member's metadata
    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    await admin.auth.admin.updateUserById(memberId, {
      user_metadata: { household_owner_id: null },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to remove member";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
