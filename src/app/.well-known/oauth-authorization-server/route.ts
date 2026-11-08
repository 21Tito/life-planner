import { NextResponse } from "next/server";
import { SCOPE, issuer } from "@/lib/oauth";

// RFC 8414 authorization server metadata
export function GET() {
  const base = issuer();
  return NextResponse.json(
    {
      issuer: base,
      authorization_endpoint: `${base}/oauth/authorize`,
      token_endpoint: `${base}/api/oauth/token`,
      registration_endpoint: `${base}/api/oauth/register`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["client_secret_basic", "client_secret_post", "none"],
      scopes_supported: [SCOPE],
      authorization_response_iss_parameter_supported: true,
    },
    { headers: { "Cache-Control": "public, max-age=3600" } }
  );
}
