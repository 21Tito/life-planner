import type { SupabaseClient } from "@supabase/supabase-js";

const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";

/**
 * Starts Google sign-in. Google only shows its consent screen the first time (or after
 * access is revoked), like any other app. It also only issues a refresh token at consent,
 * so `forceConsent` re-prompts once when the server has no Calendar refresh token stored.
 */
export function signInWithGoogle(
  supabase: SupabaseClient,
  { next = "/dashboard", forceConsent = false }: { next?: string; forceConsent?: boolean } = {}
) {
  const callback = new URL("/auth/callback", window.location.origin);
  callback.searchParams.set("next", next);
  // Tells the callback not to ask again, so a missing refresh token can't cause a loop
  if (forceConsent) callback.searchParams.set("consented", "1");

  return supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: callback.toString(),
      scopes: CALENDAR_SCOPE,
      queryParams: forceConsent ? { access_type: "offline", prompt: "consent" } : { access_type: "offline" },
    },
  });
}
