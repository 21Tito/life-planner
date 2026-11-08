import { NextResponse } from "next/server";
import { SCOPE, issuer, mcpResourceUrl } from "@/lib/oauth";

// RFC 9728 protected resource metadata, served at both the root and the /api/mcp-suffixed path
export function GET() {
  return NextResponse.json(
    {
      resource: mcpResourceUrl(),
      authorization_servers: [issuer()],
      scopes_supported: [SCOPE],
      bearer_methods_supported: ["header"],
      resource_name: "Life Planner",
    },
    { headers: { "Cache-Control": "public, max-age=3600" } }
  );
}
