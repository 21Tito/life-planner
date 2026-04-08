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

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  async function resolveMembers(rows: typeof membersRaw) {
    return Promise.all(
      (rows ?? []).map(async (m) => {
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
  }

  let members = await resolveMembers(membersRaw);
  let ownerName: string | null = null;

  // If the user is a member, fetch all other members of the same household
  // and the owner's name so they can see who they're sharing with.
  if (ownMembership) {
    const ownerId = ownMembership.owner_id;

    const [{ data: siblingRows }, ownerProfile] = await Promise.all([
      admin
        .from("household_members")
        .select("member_id, created_at, profiles!member_id(full_name, avatar_url)")
        .eq("owner_id", ownerId),
      admin
        .from("profiles")
        .select("full_name, avatar_url")
        .eq("id", ownerId)
        .single(),
    ]);

    members = await resolveMembers(siblingRows ?? []);

    // Get owner name, fall back to email
    ownerName = ownerProfile.data?.full_name ?? null;
    if (!ownerName) {
      const { data } = await admin.auth.admin.getUserById(ownerId);
      ownerName = data.user?.email ?? "Unknown";
    }
  }

  return (
    <SettingsClient
      members={members}
      activeToken={invite?.token ?? null}
      isMember={!!ownMembership}
      ownerName={ownerName}
    />
  );
}
