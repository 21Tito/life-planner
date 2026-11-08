import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Returns { userId, ownerId } for the signed-in user.
 *
 * `ownerId` is the effective owner for all data queries: the household owner's ID if the
 * user joined someone's household, otherwise their own. It comes from household_members,
 * which only the server can write. Never derive it from user_metadata: users can edit
 * their own metadata, and server routes that bypass RLS would then act on another account.
 *
 * Throws if no authenticated user is found.
 */
export async function getSessionIds(supabase: SupabaseClient) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Unauthorized");

  return { user, userId: user.id, ownerId: await getHouseholdOwnerId(supabase, user.id) };
}

/**
 * Faster variant for page loads that query through RLS: verifies the JWT locally with the
 * project's signing keys instead of a round trip to the Auth server. It's as strict as RLS
 * itself, but unlike getUser() it doesn't notice a session revoked within the token's
 * lifetime, so service-role routes should keep using getSessionIds().
 */
export async function getVerifiedIds(supabase: SupabaseClient) {
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) throw new Error("Unauthorized");
  return { userId, ownerId: await getHouseholdOwnerId(supabase, userId) };
}

export async function getHouseholdOwnerId(supabase: SupabaseClient, userId: string): Promise<string> {
  const { data } = await supabase
    .from("household_members")
    .select("owner_id")
    .eq("member_id", userId)
    .maybeSingle();
  return data?.owner_id ?? userId;
}
