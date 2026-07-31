import { jsonResponse } from "@/lib/apiResponse";
import { buildStatus } from "@/lib/gateway/mcp/config";
import { createHttpGatewayHandler } from "@/lib/gateway/mcp/http";
import type { McpGatewayDecision } from "@/lib/gateway/mcp/decision";
import { verifyApiKey as authenticateApiKeyRequest } from "@/lib/apiKey";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * MCP gateway health / coverage endpoint.
 *
 * Returns a privacy-safe status snapshot: which MCP methods are enforced
 * inline, which transports/clients are unsupported (bypassed), and the
 * standing bypass warning. Carries no session content or secrets.
 */
export async function GET() {
  return jsonResponse(buildStatus(undefined));
}

/**
 * Process-wide handler.
 *
 * Built ONCE at module scope, not per request. Building it inside POST (the
 * previous behaviour) recreated the session map on every call — so tool
 * inventory and the action chain never persisted, `UNDECLARED_TOOL` and
 * `MULTI_TOOL_CHAIN_ESCALATION` could not fire over HTTP, and each request
 * leaked a cleanup timer. The handler's session store is a hot-reload-safe
 * singleton with a single sweeper (see `lib/gateway/mcp/session.ts`).
 */
const handler = createHttpGatewayHandler({
  upstream: { url: process.env.SOTERAI_MCP_UPSTREAM_URL || "http://localhost:3100/mcp" },
  expectedServerId: process.env.SOTERAI_MCP_EXPECTED_SERVER_ID || undefined,
  onEvidence: (_d: McpGatewayDecision) => {
    /* evidence sink wired by the control plane */
  },
});

/**
 * MCP Streamable HTTP gateway endpoint.
 *
 * Accepts JSON-RPC 2.0 requests via POST, routes them through the SoterAI
 * enforcement engine, and returns a JSON-RPC response — or an SSE stream when
 * the client sends `Accept: text/event-stream`.
 *
 * Authentication (CHANGED — see the migration note in the supremacy report):
 *   x-soterai-api-key      REQUIRED. Tenant, project and principal are derived
 *                          from the verified key.
 *   mcp-session-id         Optional. Reuses an existing session; the caller
 *                          must own it.
 *   mcp-protocol-version   Optional. Validated when present.
 *
 * The former `x-soterai-tenant` / `x-soterai-project` / `x-soterai-principal`
 * headers are REJECTED: they allowed any caller to assert any identity.
 *
 * The request is passed through untouched (no re-parse, no re-serialize) so
 * that body bounds, streaming and cancellation are enforced by the handler.
 */
export async function POST(request: Request) {
  if (!request.body) return jsonResponse({ error: true, message: "Request body is required." }, { status: 400 });
  const verified = await authenticateApiKeyRequest(request.headers.get("x-soterai-api-key"));
  if (!verified.ok) return jsonResponse({ error: true, message: verified.message }, { status: verified.status });
  return handler(request);
}
