/**
 * HTTP transport tests for the MCP inline gateway.
 *
 * Tests the createHttpGatewayHandler and createSseInspectionStream functions
 * with a real HTTP mock upstream server spun up per-test.
 *
 * CONTRACT CHANGE (2026-07-30, Gap 4b security correction)
 * -------------------------------------------------------
 * Several assertions in this file previously encoded the OLD insecure
 * behaviour. They are corrected here to assert the NEW secure behaviour — the
 * gate itself is never loosened. Each changed assertion carries an inline
 * "CONTRACT CHANGE" note. Summary:
 *
 *  - Every request must now authenticate. Tests inject a test `authenticate`
 *    so no database is required; production uses the SoterAI API key.
 *  - `x-soterai-tenant` / `-project` / `-principal` are no longer trusted and
 *    are rejected outright (400) instead of silently defining identity.
 *  - Session ids are server-generated and opaque; a client-chosen id no longer
 *    creates or resumes a session. Tests read `mcp-session-id` off the
 *    response and echo it back.
 *  - `initialize` now returns the REAL upstream serverInfo instead of a
 *    fabricated `soterai-mcp-gateway` identity.
 *  - Policy denials map to 403, upstream failures to 502 (the old code mapped
 *    everything to 400 because of an unsatisfiable range condition).
 */
import assert from "node:assert/strict";
import test from "node:test";
import { createServer, type Server } from "node:http";
import { randomUUID } from "node:crypto";

import { createHttpGatewayHandler, type UpstreamDestination } from "../lib/gateway/mcp/http";
import { createSseInspectionStream } from "../lib/gateway/mcp/sse";
import { McpEnforcementEngine } from "../lib/gateway/mcp/engine";
import { McpSessionStore, type AuthenticatedPrincipal } from "../lib/gateway/mcp/session";
import { DEFAULT_LIMITS, type McpSessionIdentity } from "../lib/gateway/mcp/types";
import type { McpGatewayDecision } from "../lib/gateway/mcp/decision";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BASE_IDENTITY: McpSessionIdentity = {
  tenantId: "http-test",
  projectId: "proj-http",
  clientId: "client-http",
  principalType: "human",
  principalId: "user-http",
  serverId: "test-server",
  allowedPermissions: ["filesystem"],
  allowedRoots: ["/home/user/allowed"],
  expiresAt: Date.now() + 3600_000,
};

/**
 * The single authenticated principal these transport tests act as.
 *
 * Identity is no longer derivable from headers, so the tests inject an
 * authenticator instead of asserting an identity over the wire. Cross-tenant /
 * cross-project / cross-principal separation is covered in
 * tests/mcp-http-security.test.ts.
 */
const TEST_PRINCIPAL: AuthenticatedPrincipal = {
  tenantId: "http-test",
  projectId: "proj-http",
  principalType: "agent",
  principalId: "key-http",
  apiKeyId: "key-http",
};

function makeHandler(upstreamUrl: string, onEvidence?: (d: McpGatewayDecision) => void) {
  const limits = { ...DEFAULT_LIMITS, rateLimitPerMinute: 10_000 };
  // An isolated store per handler: tests must never share session state, and
  // no sweep timer is started so nothing leaks between tests.
  const store = new McpSessionStore({
    limits,
    defaultPermissions: ["*"],
    defaultRoots: ["/tmp"],
  });
  const opts = {
    upstream: { url: upstreamUrl, timeoutMs: 5000 },
    limits,
    onEvidence: onEvidence ?? (() => {}),
    defaultPermissions: ["*"],
    defaultRoots: ["/tmp"],
    authenticate: async () => ({ ok: true as const, principal: TEST_PRINCIPAL }),
    store,
  };
  return createHttpGatewayHandler(opts);
}

interface PostResult {
  status: number;
  body: unknown;
  /** Server-generated session id, echoed back on the next request. */
  sessionId: string | null;
  headers: Headers;
}

async function postJson(
  handler: (r: Request) => Promise<Response>,
  url: string,
  body: unknown,
  headers?: Record<string, string>,
): Promise<PostResult> {
  const req = new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  const resp = await handler(req);
  const text = await resp.text();
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { parsed = text; }
  return {
    status: resp.status,
    body: parsed,
    sessionId: resp.headers.get("mcp-session-id"),
    headers: resp.headers,
  };
}

function jrpc(method: string, params?: unknown, id: string | number = 1) {
  return { jsonrpc: "2.0", id, method, ...(params !== undefined ? { params } : {}) };
}

function jrpcResult(id: string | number = 1, result?: unknown) {
  return { jsonrpc: "2.0", id, result: result ?? {} };
}

function jrpcError(id: string | number = 1, code = -32603, message = "err") {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

/** Start an HTTP server that returns canned JSON-RPC responses. */
function startMockUpstream(handler: (reqBody: unknown) => unknown | Promise<unknown>): Promise<{ server: Server; url: string }> {
  return new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(chunk);
      const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      const result = await handler(body);
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(result));
    });
    server.listen(0, () => {
      const addr = server.address();
      const port = addr && typeof addr === "object" ? addr.port : 9999;
      resolve({ server, url: `http://127.0.0.1:${port}` });
    });
  });
}

function createMockEngine(): McpEnforcementEngine {
  return new McpEnforcementEngine({ identity: BASE_IDENTITY, limits: DEFAULT_LIMITS });
}

// ---------------------------------------------------------------------------
// 1. HTTP transport — method & content-type validation
// ---------------------------------------------------------------------------

test("mcp http: rejects GET requests", async () => {
  const handler = makeHandler("http://localhost:1");
  const req = new Request("http://localhost", { method: "GET" });
  const resp = await handler(req);
  assert.equal(resp.status, 405);
});

test("mcp http: rejects non-JSON content-type", async () => {
  const handler = makeHandler("http://localhost:1");
  const req = new Request("http://localhost", {
    method: "POST",
    headers: { "content-type": "text/plain" },
    body: "hello",
  });
  const resp = await handler(req);
  assert.equal(resp.status, 415);
});

test("mcp http: rejects empty body", async () => {
  const handler = makeHandler("http://localhost:1");
  const req = new Request("http://localhost", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "",
  });
  const resp = await handler(req);
  // Parse error for empty body
  assert.ok(resp.status === 400 || resp.status === 200);
  const text = await resp.text();
  const parsed = JSON.parse(text);
  assert.equal(parsed?.error?.code, -32700);
});

test("mcp http: rejects invalid JSON", async () => {
  const handler = makeHandler("http://localhost:1");
  const req = new Request("http://localhost", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "not json",
  });
  const resp = await handler(req);
  assert.equal(resp.status, 400);
});

test("mcp http: rejects oversized body", async () => {
  const handler = makeHandler("http://localhost:1");
  const bigPayload = "x".repeat(1_500_000);
  const req = new Request("http://localhost", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "x", params: { data: bigPayload } }),
  });
  const resp = await handler(req);
  assert.equal(resp.status, 413);
});

// ---------------------------------------------------------------------------
// 2. JSON-RPC validation
// ---------------------------------------------------------------------------

test("mcp http: rejects non-JSON-RPC message", async () => {
  const handler = makeHandler("http://localhost:1");
  const { status, body } = await postJson(handler, "http://localhost", { foo: "bar" });
  assert.equal(status, 400);
  assert.equal((body as any)?.error?.code, -32600);
});

test("mcp http: rejects notification (no id)", async () => {
  const handler = makeHandler("http://localhost:1");
  const { status, body } = await postJson(handler, "http://localhost", { jsonrpc: "2.0", method: "ping" });
  assert.equal(status, 400);
  assert.equal((body as any)?.error?.code, -32600);
});

// ---------------------------------------------------------------------------
// 3. Initialize
// ---------------------------------------------------------------------------

test("mcp http: initialize returns gateway info", async () => {
  const { server, url } = await startMockUpstream(() => jrpcResult(1, { protocolVersion: "2024-11-05", serverInfo: { name: "upstream", version: "1.0" }, capabilities: { tools: {} } }));
  try {
    const handler = makeHandler(url);
    const { status, body } = await postJson(handler, "http://localhost", jrpc("initialize", { protocolVersion: "2024-11-05" }));
    assert.equal(status, 200);
    // CONTRACT CHANGE: this used to assert the fabricated name
    // "soterai-mcp-gateway". The gateway no longer invents a server identity —
    // it performs the real upstream initialize and binds the REAL serverInfo to
    // the session, which is what makes identity-change detection possible.
    assert.equal((body as any)?.result?.serverInfo?.name, "upstream");
    assert.equal((body as any)?.result?.protocolVersion, "2024-11-05");
  } finally {
    server.close();
  }
});

// ---------------------------------------------------------------------------
// 4. tools/list proxy
// ---------------------------------------------------------------------------

test("mcp http: tools/list forwards to upstream and returns tools", async () => {
  const upstreamTools = { tools: [{ name: "echo", description: "Echo input" }] };
  const { server, url } = await startMockUpstream(() => jrpcResult(1, upstreamTools));
  try {
    const handler = makeHandler(url);
    const { status, body } = await postJson(handler, "http://localhost", jrpc("tools/list"));
    assert.equal(status, 200);
    const tools = (body as any)?.result?.tools;
    assert.ok(Array.isArray(tools), `tools must be an array, got ${JSON.stringify(tools)}`);
    assert.equal(tools[0]?.name, "echo");
  } finally {
    server.close();
  }
});

test("mcp http: tools/list handles upstream error", async () => {
  const { server, url } = await startMockUpstream(() => jrpcError(1, -32603, "upstream exploded"));
  try {
    const handler = makeHandler(url);
    const { status, body } = await postJson(handler, "http://localhost", jrpc("tools/list"));
    // CONTRACT CHANGE: an upstream-side failure is a bad gateway, not a bad
    // client request. The old code returned 400 for every error code because
    // `code >= -32000 && code <= -32099` can never be true.
    assert.equal(status, 502);
    assert.ok((body as any)?.error);
  } finally {
    server.close();
  }
});

test("mcp http: tools/list handles upstream unavailable", async () => {
  const handler = makeHandler("http://127.0.0.1:1");
  const { status, body } = await postJson(handler, "http://localhost", jrpc("tools/list"));
  // CONTRACT CHANGE: 400 → 502 (see httpStatusForRpcCode).
  assert.equal(status, 502);
  assert.equal((body as any)?.error?.code, -32005);
});

// ---------------------------------------------------------------------------
// 5. tools/call enforcement
// ---------------------------------------------------------------------------

test("mcp http: safe tool call is forwarded and returns result", async () => {
  const upstreamTools = { tools: [{ name: "echo", description: "Echo input", inputSchema: { type: "object", properties: { text: { type: "string" } } } }] };
  const evidence: McpGatewayDecision[] = [];
  const { server, url } = await startMockUpstream((reqBody: any) => {
    if (reqBody?.method === "tools/list") return jrpcResult(1, upstreamTools);
    return jrpcResult(1, { content: [{ type: "text", text: "ok:echo" }] });
  });
  try {
    const handler = makeHandler(url, (d) => { evidence.push(d); });

    // First populate tool inventory. CONTRACT CHANGE: the session id is now
    // server-generated and opaque, so it is read off the response rather than
    // chosen by the client.
    const listResp = await postJson(handler, "http://localhost", jrpc("tools/list"));
    assert.equal(listResp.status, 200);
    const sessionId = listResp.sessionId;
    assert.ok(sessionId, "gateway must return an opaque mcp-session-id");

    // Now call the tool using the same session.
    // The engine may allow or require approval — the test validates the
    // transport layer (evidence emitted, response well-formed, upstream
    // called for list). The policy decision is tested separately.
    const { status, body } = await postJson(handler, "http://localhost", jrpc("tools/call", { name: "echo", arguments: { text: "hello" } }), { "mcp-session-id": sessionId });
    // Evidence must have been emitted regardless of outcome
    assert.ok(evidence.length > 0, "evidence must be emitted");
    // Response must be well-formed JSON-RPC
    assert.equal((body as any)?.jsonrpc, "2.0");
    if (status === 200) {
      assert.equal((body as any)?.result?.content?.[0]?.text, "ok:echo");
    } else {
      assert.equal((body as any)?.error?.code, -32002, "expected approval error");
    }
  } finally {
    server.close();
  }
});

test("mcp http: dangerous tool call is blocked", async () => {
  let upstreamReached = false;
  const { server, url } = await startMockUpstream(() => {
    upstreamReached = true;
    return jrpcResult(1, { content: [{ type: "text", text: "SHOULD_NOT_REACH" }] });
  });
  try {
    const handler = makeHandler(url);
    const { status, body } = await postJson(handler, "http://localhost", jrpc("tools/call", { name: "exec", arguments: { command: "rm -rf /" } }));
    // CONTRACT CHANGE: a policy denial is 403 Forbidden, not 400 Bad Request.
    // The JSON-RPC error body is unchanged, so JSON-RPC clients see the same
    // code (-32001) they always did.
    assert.equal(status, 403);
    assert.equal((body as any)?.error?.code, -32001);
    assert.equal(upstreamReached, false, "blocked call must not reach upstream");
  } finally {
    server.close();
  }
});

test("mcp http: tool call requiring approval returns approval error", async () => {
  const { server, url } = await startMockUpstream(() => jrpcResult(1, { content: [{ type: "text", text: "ok" }] }));
  try {
    const handler = makeHandler(url);
    const { status, body } = await postJson(handler, "http://localhost", jrpc("tools/call", { name: "echo", arguments: { command: "ls -la" } }));
    // CONTRACT CHANGE: 400 → 403 (an approval hold is a denial, not a
    // malformed request).
    assert.equal(status, 403);
    assert.equal((body as any)?.error?.code, -32002);
    assert.ok((body as any)?.error?.data?.approvalId, "must include approvalId");
  } finally {
    server.close();
  }
});

test("mcp http: session is reused across requests with same session id", async () => {
  const { server, url } = await startMockUpstream(() => jrpcResult(1, { tools: [] }));
  try {
    const handler = makeHandler(url);

    // First request — creates the session and returns its opaque id.
    // CONTRACT CHANGE: the client no longer picks the id.
    const first = await postJson(handler, "http://localhost", jrpc("tools/list"));
    assert.equal(first.status, 200);
    assert.ok(first.sessionId?.startsWith("mcps_"), "session id must be opaque and server-generated");

    // Second request echoing that id — resolves the SAME session object.
    const second = await postJson(handler, "http://localhost", jrpc("tools/list"), { "mcp-session-id": first.sessionId! });
    assert.equal(second.status, 200);
    assert.equal(second.sessionId, first.sessionId, "the same session must be reused, not recreated");
    assert.equal(handler.store.size, 1, "reuse must not create a second session");
  } finally {
    server.close();
  }
});

// ---------------------------------------------------------------------------
// 6. Session management
// ---------------------------------------------------------------------------

test("mcp http: session headers are accepted", async () => {
  const { server, url } = await startMockUpstream(() => jrpcResult(1, { tools: [] }));
  try {
    const handler = makeHandler(url);

    // The SESSION header is still accepted — session continuity is preserved.
    const first = await postJson(handler, "http://localhost", jrpc("tools/list"));
    assert.equal(first.status, 200);
    const legacy = await postJson(handler, "http://localhost", jrpc("tools/list"), {
      "x-soterai-session-id": first.sessionId!,
    });
    assert.equal(legacy.status, 200, "the legacy session header must still resume a session");

    // CONTRACT CHANGE: the IDENTITY headers are not. They previously let any
    // caller assert any tenant/project/principal. They are now rejected
    // outright so a legacy client fails loudly instead of silently running
    // under a different identity than it believes it has.
    const forged = await postJson(handler, "http://localhost", jrpc("tools/list"), {
      "mcp-session-id": first.sessionId!,
      "x-soterai-tenant": "my-tenant",
      "x-soterai-project": "my-project",
      "x-soterai-principal": "my-user",
    });
    assert.equal(forged.status, 400);
    assert.match(String((forged.body as any)?.error?.message), /identity headers are no longer accepted/);
  } finally {
    server.close();
  }
});

// ---------------------------------------------------------------------------
// 7. SSE stream inspection
// ---------------------------------------------------------------------------

test("mcp sse: passes safe events through", async () => {
  const engine = createMockEngine();
  const events = [
    "event: message\ndata: {\"type\":\"text\",\"text\":\"hello\"}\n\n",
  ];
  const stream = createMockByteStream(events.join(""));
  const inspected = createSseInspectionStream(stream, "echo", "trace-1", { engine });
  const result = await collectStream(inspected);
  assert.ok(result.includes("hello"), "safe content must pass through");
});

test("mcp sse: blocks oversized accumulated data", async () => {
  const engine = createMockEngine();
  const huge = "x".repeat(6_000_000);
  const events = [
    `event: message\ndata: ${huge}\n\n`,
  ];
  const stream = createMockByteStream(events.join(""));
  const inspected = createSseInspectionStream(stream, "echo", "trace-2", { engine });
  const result = await collectStream(inspected);
  // Should include a block frame
  assert.ok(result.includes("blocked"), "oversized stream must be blocked");
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockByteStream(text: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(text));
      controller.close();
    },
  });
}

async function collectStream(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let result = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    result += decoder.decode(value, { stream: true });
  }
  return result;
}
