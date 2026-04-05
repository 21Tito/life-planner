import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Returns { userId, ownerId } from the current Supabase session.
 *
 * `ownerId` is the effective owner for all data queries:
 *   - If the user accepted a household invite, it's the owner's ID
 *     (stored in user_metadata during invite acceptance — no DB query).
 *   - Otherwise it's the user's own ID.
 *
 * Throws if no authenticated user is found.
 */
export async function getSessionIds(supabase: SupabaseClient) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Unauthorized");

  const ownerId =
    (user.user_metadata?.household_owner_id as string | undefined) ?? user.id;

  return { user, userId: user.id, ownerId };
}
