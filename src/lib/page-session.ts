import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getHouseholdOwnerId } from "@/lib/get-owner-id";

// Cached per request, so the layout and the page share one sign-in check and one household
// lookup instead of each doing their own.

/** The signed-in user, verified locally against the project's signing keys. Null when signed out. */
export const getPageUser = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return null;
  const email = typeof data.claims.email === "string" ? data.claims.email : "";
  return { supabase, userId, email };
});

/** The signed-in user plus their household owner, the owner of all data (see getVerifiedIds). */
export const getPageSession = cache(async () => {
  const user = await getPageUser();
  if (!user) return null;
  return { ...user, ownerId: await getHouseholdOwnerId(user.supabase, user.userId) };
});

/** For pages under the protected layout, which has already sent signed-out visitors away. */
export async function requirePageSession() {
  const session = await getPageSession();
  if (!session) throw new Error("Unauthorized");
  return session;
}
