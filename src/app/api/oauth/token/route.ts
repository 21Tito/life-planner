import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  adminClient,
  isValidResource,
  issueTokens,
  revokeGrant,
  safeEqual,
  sha256,
  verifyPkce,
} from "@/lib/oauth";

const NO_STORE = { "Cache-Control": "no-store", Pragma: "no-cache" };

function tokenError(error: string, status = 400, description?: string) {
  return NextResponse.json(
    { error, ...(description ? { error_description: description } : {}) },
    {
      status,
      headers: { ...NO_STORE, ...(status === 401 ? { "WWW-Authenticate": 'Basic realm="oauth"' } : {}) },
    }
  );
}

/** Client authentication: HTTP Basic, form credentials, or none for public (PKCE-only) clients. */
async function authenticateClient(
  admin: SupabaseClient,
  request: Request,
  form: FormData
): Promise<string | null> {
  let clientId = form.get("client_id")?.toString() ?? null;
  let clientSecret = form.get("client_secret")?.toString() ?? null;

  const basic = request.headers.get("authorization")?.match(/^Basic (.+)$/i);
  if (basic) {
    const decoded = Buffer.from(basic[1], "base64").toString("utf8");
    const sep = decoded.indexOf(":");
    if (sep < 0) return null;
    try {
      clientId = decodeURIComponent(decoded.slice(0, sep));
      clientSecret = decodeURIComponent(decoded.slice(sep + 1));
    } catch {
      return null;
    }
  }
  if (!clientId) return null;

  const { data: client } = await admin
    .from("oauth_clients")
    .select("client_id, client_secret_hash")
    .eq("client_id", clientId)
    .maybeSingle();
  if (!client) return null;

  if (client.client_secret_hash) {
    if (!clientSecret || !safeEqual(sha256(clientSecret), client.client_secret_hash)) return null;
  } else if (clientSecret) {
    return null;
  }
  return client.client_id;
}

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return tokenError("invalid_request", 400, "Expected application/x-www-form-urlencoded.");
  }

  const admin = adminClient();
  const clientId = await authenticateClient(admin, request, form);
  if (!clientId) return tokenError("invalid_client", 401);

  const grantType = form.get("grant_type");
  const now = new Date().toISOString();

  if (grantType === "authorization_code") {
    const code = form.get("code")?.toString();
    const verifier = form.get("code_verifier")?.toString();
    const redirectUri = form.get("redirect_uri")?.toString();
    const resource = form.get("resource")?.toString() ?? null;
    if (!code || !verifier || !redirectUri) return tokenError("invalid_request");
    if (!isValidResource(resource)) return tokenError("invalid_target");

    // Marking the code used in the same statement that reads it makes it single-use under races
    const { data: row } = await admin
      .from("oauth_codes")
      .update({ used_at: now })
      .eq("code_hash", sha256(code))
      .is("used_at", null)
      .gt("expires_at", now)
      .select("grant_id, redirect_uri, code_challenge, resource, oauth_grants!inner(client_id, scope)")
      .maybeSingle();

    if (!row) {
      // A replayed code means it leaked: revoke everything issued from it (OAuth 2.1 §4.1.3)
      const { data: replayed } = await admin
        .from("oauth_codes")
        .select("grant_id, used_at")
        .eq("code_hash", sha256(code))
        .maybeSingle();
      if (replayed?.used_at) await revokeGrant(admin, replayed.grant_id);
      return tokenError("invalid_grant");
    }

    const grant = (Array.isArray(row.oauth_grants) ? row.oauth_grants[0] : row.oauth_grants) as {
      client_id: string;
      scope: string;
    };
    if (
      grant.client_id !== clientId ||
      row.redirect_uri !== redirectUri ||
      !verifyPkce(verifier, row.code_challenge) ||
      (row.resource && resource && row.resource !== resource)
    ) {
      await revokeGrant(admin, row.grant_id);
      return tokenError("invalid_grant");
    }

    return NextResponse.json(await issueTokens(admin, row.grant_id, grant.scope), { headers: NO_STORE });
  }

  if (grantType === "refresh_token") {
    const refreshToken = form.get("refresh_token")?.toString();
    if (!refreshToken) return tokenError("invalid_request");
    const hash = sha256(refreshToken);

    const { data: row } = await admin
      .from("oauth_tokens")
      .update({ used_at: now })
      .eq("token_hash", hash)
      .eq("kind", "refresh")
      .is("used_at", null)
      .gt("expires_at", now)
      .select("grant_id, oauth_grants!inner(client_id, scope)")
      .maybeSingle();

    if (!row) {
      // Refresh tokens rotate; presenting an old one means it was stolen or replayed
      const { data: reused } = await admin
        .from("oauth_tokens")
        .select("grant_id, used_at")
        .eq("token_hash", hash)
        .eq("kind", "refresh")
        .maybeSingle();
      if (reused?.used_at) await revokeGrant(admin, reused.grant_id);
      return tokenError("invalid_grant");
    }

    const grant = (Array.isArray(row.oauth_grants) ? row.oauth_grants[0] : row.oauth_grants) as {
      client_id: string;
      scope: string;
    };
    if (grant.client_id !== clientId) {
      await revokeGrant(admin, row.grant_id);
      return tokenError("invalid_grant");
    }

    return NextResponse.json(await issueTokens(admin, row.grant_id, grant.scope), { headers: NO_STORE });
  }

  return tokenError("unsupported_grant_type");
}
