import { createClient } from "@/lib/supabase/server";
import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // Only same-site paths: "@evil.com" or "//evil.com" would otherwise send the user to another site
  const requested = searchParams.get("next") ?? "/dashboard";
  const next = /^\/(?![/\\])/.test(requested) ? requested : "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.session) {
      // Capture Google provider tokens for Calendar sync
      const providerToken = data.session.provider_token;
      const providerRefreshToken = data.session.provider_refresh_token;
      const userId = data.session.user.id;

      if (providerToken) {
        const adminSupabase = createServerClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
          { cookies: { getAll: () => [], setAll: () => {} } }
        );
        const access = {
          access_token: providerToken,
          expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        };

        if (providerRefreshToken) {
          await adminSupabase
            .from("google_tokens")
            .upsert({ user_id: userId, refresh_token: providerRefreshToken, ...access });
        } else {
          // Google only issues a refresh token at consent; on later sign-ins keep the stored one
          const { data: stored } = await adminSupabase
            .from("google_tokens")
            .update(access)
            .eq("user_id", userId)
            .select("user_id")
            .maybeSingle();

          // Nothing stored (new account, or access was revoked): ask for consent once.
          // `consented` marks that we already did, so this can't loop.
          if (!stored && searchParams.get("consented") !== "1") {
            return NextResponse.redirect(`${origin}/login?consent=1&redirect=${encodeURIComponent(next)}`);
          }
        }
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
