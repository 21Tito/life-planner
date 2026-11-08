import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { CODE_TTL_S, adminClient, issuer, randomToken, sha256 } from "@/lib/oauth";

function problem(message: string, status = 400) {
  return new NextResponse(message, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });
}

export async function POST(request: Request) {
  // CSRF: the form must be posted from our own origin, by the user who opened the consent screen
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(issuer()).origin) return problem("Cross-site request refused.", 403);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return problem("You're signed out. Start connecting again from Claude.", 401);

  const form = await request.formData();
  const requestId = String(form.get("request_id") ?? "");
  const decision = form.get("decision");
  if (!/^[0-9a-f-]{36}$/i.test(requestId) || (decision !== "allow" && decision !== "deny")) {
    return problem("Invalid request.");
  }

  // Deleting the pending request makes each consent screen usable exactly once
  const admin = adminClient();
  const { data: pending } = await admin
    .from("oauth_authorization_requests")
    .delete()
    .eq("id", requestId)
    .eq("user_id", user.id)
    .gt("expires_at", new Date().toISOString())
    .select("client_id, redirect_uri, code_challenge, scope, state, resource")
    .maybeSingle();
  if (!pending) return problem("This request expired. Start connecting again from Claude.");

  const redirect = new URL(pending.redirect_uri);
  if (pending.state) redirect.searchParams.set("state", pending.state);
  redirect.searchParams.set("iss", issuer());

  if (decision === "deny") {
    redirect.searchParams.set("error", "access_denied");
    return NextResponse.redirect(redirect, 303);
  }

  const { data: client } = await admin
    .from("oauth_clients")
    .select("client_name")
    .eq("client_id", pending.client_id)
    .single();

  const { data: grant, error: grantError } = await admin
    .from("oauth_grants")
    .insert({
      user_id: user.id,
      client_id: pending.client_id,
      client_name: client?.client_name ?? null,
      scope: pending.scope,
    })
    .select("id")
    .single();
  if (grantError || !grant) {
    console.error("Failed to create OAuth grant:", grantError?.message);
    redirect.searchParams.set("error", "server_error");
    return NextResponse.redirect(redirect, 303);
  }

  const code = randomToken();
  const { error: codeError } = await admin.from("oauth_codes").insert({
    code_hash: sha256(code),
    grant_id: grant.id,
    redirect_uri: pending.redirect_uri,
    code_challenge: pending.code_challenge,
    resource: pending.resource,
    expires_at: new Date(Date.now() + CODE_TTL_S * 1000).toISOString(),
  });
  if (codeError) {
    console.error("Failed to store authorization code:", codeError.message);
    await admin.from("oauth_grants").delete().eq("id", grant.id);
    redirect.searchParams.set("error", "server_error");
    return NextResponse.redirect(redirect, 303);
  }

  redirect.searchParams.set("code", code);
  return NextResponse.redirect(redirect, 303);
}
