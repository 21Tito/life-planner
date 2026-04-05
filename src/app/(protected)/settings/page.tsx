import { createClient } from "@/lib/supabase/server";
import { getSessionIds } from "@/lib/get-owner-id";
import { SettingsClient } from "./settings-client";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { userId } = await getSessionIds(supabase);

  // Run all independent queries in parallel
  const [{ data: membersRaw }, { data: invite }, { data: ownMembership }] =
    await Promise.all([
      supabase
        .from("household_members")
        .select("member_id, created_at")
        .eq("owner_id", userId),
      supabase
        .from("household_invites")
        .select("token")
        .eq("owner_id", userId)
        .single(),
      supabase
        .from("household_members")
        .select("owner_id")
        .eq("member_id", userId)
        .maybeSingle(),
    ]);

  // Fetch member profiles (depends on membersRaw)
  const memberIds = (membersRaw ?? []).map((m) => m.member_id);
  const { data: profiles } =
    memberIds.length > 0
      ? await supabase
          .from("profiles")
          .select("id, full_name, avatar_url")
          .in("id", memberIds)
      : { data: [] };

  const members = (membersRaw ?? []).map((m) => {
    const profile = profiles?.find((p) => p.id === m.member_id);
    return {
      id: m.member_id,
      name: profile?.full_name ?? "Unknown",
      avatar: profile?.avatar_url ?? null,
      joinedAt: m.created_at,
    };
  });

  return (
    <SettingsClient
      members={members}
      activeToken={invite?.token ?? null}
      isMember={!!ownMembership}
    />
  );
}
