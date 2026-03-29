import { createClient } from "@/lib/supabase/server";
import { SettingsClient } from "./settings-client";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fetch current members of this user's household
  const { data: membersRaw } = await supabase
    .from("household_members")
    .select("member_id, created_at")
    .eq("owner_id", user!.id);

  // Fetch member profiles
  const memberIds = (membersRaw ?? []).map((m) => m.member_id);
  const { data: profiles } =
    memberIds.length > 0
      ? await supabase
          .from("profiles")
          .select("id, full_name, avatar_url")
          .in("id", memberIds)
      : { data: [] };

  // Fetch the active invite token (if any)
  const { data: invite } = await supabase
    .from("household_invites")
    .select("token")
    .eq("owner_id", user!.id)
    .single();

  // Check if this user is a member of someone else's household
  const { data: ownMembership } = await supabase
    .from("household_members")
    .select("owner_id")
    .eq("member_id", user!.id)
    .single();

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
