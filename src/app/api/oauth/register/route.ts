import { NextResponse } from "next/server";
import { adminClient, isAllowedRedirectUri, randomToken, sha256 } from "@/lib/oauth";

// RFC 7591 dynamic client registration. Open by design (claude.ai registers itself),
// but redirect URIs are restricted to Claude's callbacks, so tokens can't go anywhere else.

const MAX_BODY_BYTES = 10_000;
const AUTH_METHODS = ["client_secret_basic", "client_secret_post", "none"] as const;

function registrationError(description: string, error = "invalid_client_metadata") {
  return NextResponse.json({ error, error_description: description }, { status: 400 });
}

export async function POST(request: Request) {
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return registrationError("Request too large.");

  let body: Record<string, unknown>;
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error();
    body = parsed;
  } catch {
    return registrationError("Body must be a JSON object.");
  }

  const redirectUris = body.redirect_uris;
  if (
    !Array.isArray(redirectUris) ||
    redirectUris.length === 0 ||
    redirectUris.length > 5 ||
    !redirectUris.every((u) => typeof u === "string" && isAllowedRedirectUri(u))
  ) {
    return registrationError("Only Claude's callback URLs can be registered.", "invalid_redirect_uri");
  }

  const authMethod = (body.token_endpoint_auth_method ?? "client_secret_basic") as string;
  if (!(AUTH_METHODS as readonly string[]).includes(authMethod)) {
    return registrationError("Unsupported token_endpoint_auth_method.");
  }

  const grantTypes = (body.grant_types ?? ["authorization_code"]) as unknown;
  if (
    !Array.isArray(grantTypes) ||
    !grantTypes.every((g) => g === "authorization_code" || g === "refresh_token")
  ) {
    return registrationError("Unsupported grant_types.");
  }

  const responseTypes = (body.response_types ?? ["code"]) as unknown;
  if (!Array.isArray(responseTypes) || !responseTypes.every((r) => r === "code")) {
    return registrationError("Unsupported response_types.");
  }

  const clientName =
    typeof body.client_name === "string"
      ? body.client_name.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 100) || null
      : null;

  const clientId = randomToken();
  const clientSecret = authMethod === "none" ? null : randomToken();

  const { error } = await adminClient().from("oauth_clients").insert({
    client_id: clientId,
    client_secret_hash: clientSecret ? sha256(clientSecret) : null,
    client_name: clientName,
    redirect_uris: redirectUris,
  });
  if (error) {
    console.error("OAuth client registration failed:", error.message);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }

  return NextResponse.json(
    {
      client_id: clientId,
      ...(clientSecret ? { client_secret: clientSecret, client_secret_expires_at: 0 } : {}),
      client_id_issued_at: Math.floor(Date.now() / 1000),
      client_name: clientName ?? undefined,
      redirect_uris: redirectUris,
      token_endpoint_auth_method: authMethod,
      grant_types: grantTypes,
      response_types: responseTypes,
    },
    { status: 201, headers: { "Cache-Control": "no-store" } }
  );
}
