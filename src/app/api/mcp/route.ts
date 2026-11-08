import { NextResponse } from "next/server";
import { adminClient, authenticateBearer, resourceMetadataUrl } from "@/lib/oauth";
import { SERVER_INSTRUCTIONS, ToolInputError, findTool, listTools } from "@/lib/mcp-tools";

/**
 * MCP server over Streamable HTTP, stateless: each POST carries one JSON-RPC message
 * and gets a JSON response. No SSE stream or session is offered.
 */

export const runtime = "nodejs";

const SUPPORTED_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];
const MAX_BODY_BYTES = 1_000_000;

type JsonRpcId = string | number | null;

function unauthorized(invalidToken: boolean) {
  const challenge = `Bearer resource_metadata="${resourceMetadataUrl()}"${invalidToken ? ', error="invalid_token"' : ""}`;
  return NextResponse.json(
    { error: invalidToken ? "invalid_token" : "unauthorized" },
    { status: 401, headers: { "WWW-Authenticate": challenge } }
  );
}

function rpcResult(id: JsonRpcId, result: unknown) {
  return NextResponse.json({ jsonrpc: "2.0", id, result });
}

function rpcError(id: JsonRpcId, code: number, message: string, status = 200) {
  return NextResponse.json({ jsonrpc: "2.0", id, error: { code, message } }, { status });
}

async function resolveOwnerId(userId: string): Promise<string> {
  const { data } = await adminClient()
    .from("household_members")
    .select("owner_id")
    .eq("member_id", userId)
    .maybeSingle();
  return data?.owner_id ?? userId;
}

export async function POST(request: Request) {
  const auth = await authenticateBearer(request.headers.get("authorization"));
  if (!auth) return unauthorized(request.headers.has("authorization"));

  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return rpcError(null, -32600, "Request too large", 413);

  let message: Record<string, unknown>;
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return rpcError(null, -32600, "Expected a single JSON-RPC message", 400);
    }
    message = parsed;
  } catch {
    return rpcError(null, -32700, "Parse error", 400);
  }
  if (message.jsonrpc !== "2.0") return rpcError(null, -32600, "Invalid JSON-RPC message", 400);

  // Notifications and responses need no reply
  if (message.id === undefined || typeof message.method !== "string") {
    return new NextResponse(null, { status: 202 });
  }

  const id = message.id as JsonRpcId;
  const params = (typeof message.params === "object" && message.params !== null ? message.params : {}) as Record<
    string,
    unknown
  >;

  switch (message.method) {
    case "initialize": {
      const requested = params.protocolVersion;
      return rpcResult(id, {
        protocolVersion:
          typeof requested === "string" && SUPPORTED_VERSIONS.includes(requested) ? requested : SUPPORTED_VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "life-planner", title: "Life Planner", version: "1.0.0" },
        instructions: SERVER_INSTRUCTIONS,
      });
    }

    case "ping":
      return rpcResult(id, {});

    case "tools/list":
      return rpcResult(id, { tools: listTools() });

    case "tools/call": {
      const tool = findTool(params.name);
      if (!tool) return rpcError(id, -32602, "Unknown tool");
      const args = (typeof params.arguments === "object" && params.arguments !== null && !Array.isArray(params.arguments)
        ? params.arguments
        : {}) as Record<string, unknown>;

      try {
        const ownerId = await resolveOwnerId(auth.userId);
        const result = await tool.handler(args, { admin: adminClient(), ownerId });
        return rpcResult(id, { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] });
      } catch (err) {
        const safeMessage = err instanceof ToolInputError ? err.message : "Something went wrong. Please try again.";
        if (!(err instanceof ToolInputError)) console.error(`MCP tool ${tool.name} failed:`, err);
        return rpcResult(id, { content: [{ type: "text", text: safeMessage }], isError: true });
      }
    }

    default:
      return rpcError(id, -32601, "Method not found");
  }
}

// No server-initiated stream or sessions; still challenge unauthenticated clients so discovery works
async function notAllowed(request: Request) {
  const auth = await authenticateBearer(request.headers.get("authorization"));
  if (!auth) return unauthorized(request.headers.has("authorization"));
  return new NextResponse(null, { status: 405, headers: { Allow: "POST" } });
}

export const GET = notAllowed;
export const DELETE = notAllowed;
