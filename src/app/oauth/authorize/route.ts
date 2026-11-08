import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { AUTH_REQUEST_TTL_S, SCOPE, adminClient, isValidResource, issuer } from "@/lib/oauth";

function invalidRequest(message: string) {
  // Never redirect before the client and redirect_uri are verified
  return new NextResponse(`Invalid authorization request: ${message}`, {
    status: 400,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

function redirectError(redirectUri: string, error: string, state: string | null) {
  const url = new URL(redirectUri);
  url.searchParams.set("error", error);
  if (state) url.searchParams.set("state", state);
  url.searchParams.set("iss", issuer());
  return NextResponse.redirect(url, 303);
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const clientId = params.get("client_id");
  const redirectUri = params.get("redirect_uri");
  const state = params.get("state");

  if (!clientId || !redirectUri) return invalidRequest("client_id and redirect_uri are required.");

  const admin = adminClient();
  const { data: client } = await admin
    .from("oauth_clients")
    .select("client_id, redirect_uris")
    .eq("client_id", clientId)
    .maybeSingle();
  if (!client) return invalidRequest("unknown client.");
  if (!(client.redirect_uris as string[]).includes(redirectUri)) {
    return invalidRequest("redirect_uri doesn't match the registered one.");
  }

  // From here on, errors go back to the verified redirect_uri
  if (params.get("response_type") !== "code") return redirectError(redirectUri, "unsupported_response_type", state);

  const codeChallenge = params.get("code_challenge");
  if (!codeChallenge || params.get("code_challenge_method") !== "S256" || !/^[A-Za-z0-9_-]{43}$/.test(codeChallenge)) {
    return redirectError(redirectUri, "invalid_request", state);
  }

  // There's a single scope; it's granted regardless of what's requested (RFC 6749 §3.3 allows narrowing)
  const resource = params.get("resource");
  if (!isValidResource(resource)) return redirectError(redirectUri, "invalid_target", state);

  if (state && state.length > 1000) return redirectError(redirectUri, "invalid_request", null);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    const back = `/oauth/authorize?${params.toString()}`;
    return NextResponse.redirect(new URL(`/login?redirect=${encodeURIComponent(back)}`, issuer()), 303);
  }

  const { data: pending, error } = await admin
    .from("oauth_authorization_requests")
    .insert({
      user_id: user.id,
      client_id: clientId,
      redirect_uri: redirectUri,
      code_challenge: codeChallenge,
      scope: SCOPE,
      state,
      resource,
      expires_at: new Date(Date.now() + AUTH_REQUEST_TTL_S * 1000).toISOString(),
    })
    .select("id")
    .single();
  if (error || !pending) {
    console.error("Failed to create authorization request:", error?.message);
    return redirectError(redirectUri, "server_error", state);
  }

  return NextResponse.redirect(new URL(`/oauth/consent?request=${pending.id}`, issuer()), 303);
}
