import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { getSessionIds } from "@/lib/get-owner-id";
import { SettingsClient } from "./settings-client";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { userId } = await getSessionIds(supabase);

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

  // For members missing a full_name, fetch their email via admin as a fallback
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const members = await Promise.all(
    (membersRaw ?? []).map(async (m) => {
      const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
      let name = profile?.full_name ?? null;
      if (!name) {
        const { data } = await admin.auth.admin.getUserById(m.member_id);
        name = data.user?.email ?? "Unknown";
      }
      return {
        id: m.member_id,
        name,
        avatar: profile?.avatar_url ?? null,
        joinedAt: m.created_at,
      };
    })
  );

  return (
    <SettingsClient
      members={members}
      activeToken={invite?.token ?? null}
      isMember={!!ownMembership}
    />
  );
}
