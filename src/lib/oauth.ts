import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Minimal OAuth 2.1 authorization server for the Claude connector.
 * Server-only: uses the service-role key and node:crypto.
 */

export const SCOPE = "meals";
export const ACCESS_TOKEN_TTL_S = 60 * 60;
export const REFRESH_TOKEN_TTL_S = 60 * 60 * 24 * 30;
export const CODE_TTL_S = 5 * 60;
export const AUTH_REQUEST_TTL_S = 10 * 60;

// Tokens are only ever delivered to Claude. Registering any other redirect URI is refused,
// so a look-alike client can't send a user's code somewhere else.
const CLAUDE_REDIRECT_URIS = [
  "https://claude.ai/api/mcp/auth_callback",
  "https://claude.com/api/mcp/auth_callback",
];

export function issuer(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "");
  if (!url) throw new Error("NEXT_PUBLIC_APP_URL is not set");
  if (process.env.NODE_ENV === "production" && !url.startsWith("https://")) {
    throw new Error("NEXT_PUBLIC_APP_URL must use https in production");
  }
  return url;
}

export const mcpResourceUrl = () => `${issuer()}/api/mcp`;
export const resourceMetadataUrl = () => `${issuer()}/.well-known/oauth-protected-resource/api/mcp`;

export function isAllowedRedirectUri(uri: string): boolean {
  if (CLAUDE_REDIRECT_URIS.includes(uri)) return true;
  // Local testing with the MCP Inspector; never accepted in production
  if (process.env.NODE_ENV !== "production") {
    try {
      const u = new URL(uri);
      return u.protocol === "http:" && (u.hostname === "localhost" || u.hostname === "127.0.0.1");
    } catch {
      return false;
    }
  }
  return false;
}

export function isValidResource(resource: string | null): boolean {
  if (resource === null) return true;
  return resource.replace(/\/+$/, "") === mcpResourceUrl();
}

// ── Crypto ───────────────────────────────────────────────────────────────────

export function randomToken(): string {
  return randomBytes(32).toString("base64url");
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("base64url");
}

export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export function verifyPkce(verifier: string, challenge: string): boolean {
  if (!/^[A-Za-z0-9\-._~]{43,128}$/.test(verifier)) return false;
  return safeEqual(sha256(verifier), challenge);
}

// ── Storage ──────────────────────────────────────────────────────────────────

export function adminClient(): SupabaseClient {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const iso = (ms: number) => new Date(ms).toISOString();

export async function issueTokens(admin: SupabaseClient, grantId: string, scope: string) {
  const accessToken = randomToken();
  const refreshToken = randomToken();
  const now = Date.now();

  const { error } = await admin.from("oauth_tokens").insert([
    { token_hash: sha256(accessToken), grant_id: grantId, kind: "access", expires_at: iso(now + ACCESS_TOKEN_TTL_S * 1000) },
    { token_hash: sha256(refreshToken), grant_id: grantId, kind: "refresh", expires_at: iso(now + REFRESH_TOKEN_TTL_S * 1000) },
  ]);
  if (error) throw new Error(`Failed to store tokens: ${error.message}`);

  // Opportunistic cleanup; failures here don't matter
  const dayAgo = iso(now - 24 * 60 * 60 * 1000);
  await Promise.all([
    admin.from("oauth_tokens").delete().lt("expires_at", dayAgo),
    admin.from("oauth_codes").delete().lt("expires_at", dayAgo),
    admin.from("oauth_authorization_requests").delete().lt("expires_at", dayAgo),
  ]);

  return {
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: ACCESS_TOKEN_TTL_S,
    refresh_token: refreshToken,
    scope,
  };
}

/** Revokes a connection and, by cascade, every code and token issued under it. */
export async function revokeGrant(admin: SupabaseClient, grantId: string) {
  await admin.from("oauth_grants").delete().eq("id", grantId);
}

export interface BearerAuth {
  userId: string;
  grantId: string;
}

export async function authenticateBearer(authorization: string | null): Promise<BearerAuth | null> {
  const match = authorization?.match(/^Bearer ([A-Za-z0-9_-]{43})$/);
  if (!match) return null;

  const admin = adminClient();
  const { data } = await admin
    .from("oauth_tokens")
    .select("grant_id, oauth_grants!inner(user_id, scope)")
    .eq("token_hash", sha256(match[1]))
    .eq("kind", "access")
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (!data) return null;

  const grant = (Array.isArray(data.oauth_grants) ? data.oauth_grants[0] : data.oauth_grants) as
    | { user_id: string; scope: string }
    | undefined;
  if (!grant || !grant.scope.split(" ").includes(SCOPE)) return null;

  await admin.from("oauth_grants").update({ last_used_at: new Date().toISOString() }).eq("id", data.grant_id);
  return { userId: grant.user_id, grantId: data.grant_id };
}
