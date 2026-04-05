import { createClient } from "@/lib/supabase/server";
import { getSessionIds } from "@/lib/get-owner-id";
import { SettingsClient } from "./settings-client";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { userId } = await getSessionIds(supabase);

  // All queries run in parallel. The members query joins profiles inline
  // so there's no sequential second roundtrip to fetch member names/avatars.
  const [{ data: membersRaw }, { data: invite }, { data: ownMembership }] =
    await Promise.all([
      supabase
        .from("household_members")
        .select("member_id, created_at, profiles!member_id(full_name, avatar_url)")
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

  const members = (membersRaw ?? []).map((m) => {
    const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
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
