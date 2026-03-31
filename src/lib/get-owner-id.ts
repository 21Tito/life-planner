import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Returns the effective owner ID for data queries.
 * If the current user is a member of someone else's household, returns that
 * owner's ID. Otherwise returns the user's own ID.
 */
export async function getOwnerId(
  supabase: SupabaseClient,
  userId: string
): Promise<string> {
  try {
    const { data } = await supabase
      .from("household_members")
      .select("owner_id")
      .eq("member_id", userId)
      .maybeSingle();
    return data?.owner_id ?? userId;
  } catch {
    return userId;
  }
}
