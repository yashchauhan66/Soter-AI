/**
 * Gap 4b security tests for the MCP HTTP / SSE gateway.
 *
 * These cover the 26 mandated security properties of the corrected HTTP
 * transport contract:
 *
 *   authentication      1  unauthenticated initialize rejected
 *                       2  forged tenant/principal headers rejected
 *   session ownership   3  ownership succeeds for the creator
 *                       4  cross-tenant reuse rejected, no existence leakage
 *                       5  cross-project reuse rejected
 *                       6  cross-principal reuse rejected
 *                       7  expired session rejected
 *                       8  unknown session rejected
 *   lifecycle           9  maximum-session limit enforced
 *                      10  cleanup does not leak timers
 *   server identity    11  real upstream identity recorded
 *                      12  changed upstream identity terminates session
 *   cross-request state 13  undeclared tool rejected over HTTP
 *                      14  multi-tool-chain escalation across HTTP requests
 *   transport parity   15  protectionMode parity stdio vs HTTP
 *                      16  mcpConfig parity stdio vs HTTP
 *                      26  canonical decision envelopes equivalent
 *   SSE enforcement    17  safe SSE call reaches upstream
 *                      18  blocked SSE call never reaches upstream
 *                      19  SSE engine exception does not silently allow
 *                      20  SSE decision emits audit evidence
 *                      21  secret result redacted over HTTP and SSE
 *                      22  oversized SSE frame / stream rejected
 *                      23  client disconnect cancels upstream
 *   shutdown           24  no timers, sessions or child processes left
 *   status mapping     25  policy denial maps to the correct HTTP status
 *                          (+ full -32000..-32099 boundary sweep)
 *
 * Authentication is injected so no database is required. Everything else — the
 * store, the engine, the guard pipeline, the upstream HTTP servers and (for the
 * shutdown test) the upstream child process — is the real implementation.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { createServer, type Server, type ServerResponse } from "node:http";

import {
  createHttpGatewayHandler,
  httpStatusForRpcCode,
  type AuthResult,
} from "../lib/gateway/mcp/http";
import { createSseInspectionStream } from "../lib/gateway/mcp/sse";
import { McpEnforcementEngine } from "../lib/gateway/mcp/engine";
import { McpGateway, type RawTransport } from "../lib/gateway/mcp/proxy";
import {
  McpSessionStore,
  type AuthenticatedPrincipal,
  type SessionStoreOptions,
} from "../lib/gateway/mcp/session";
import {
  DEFAULT_LIMITS,
  RPC,
  type McpGatewayLimits,
  type McpSessionIdentity,
} from "../lib/gateway/mcp/types";
import type { McpGatewayDecision } from "../lib/gateway/mcp/decision";
import { startChildMcpBridge } from "./helpers/mcpChildBridge";
import type { ProtectionMode } from "@soterai/guard-core";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** Rate limits are raised so no test is accidentally rate-limited. */
const LIMITS: McpGatewayLimits = { ...DEFAULT_LIMITS, rateLimitPerMinute: 10_000 };

const PERMISSIONS = ["filesystem", "network"];
const ROOTS = ["/home/user/allowed"];
const BOUND_SERVER = "test-upstream";

/**
 * Four authenticated principals. Each differs from ALPHA in exactly one
 * ownership dimension (plus its own credential, because a real credential
 * belongs to exactly one tenant/project/principal).
 */
const P_ALPHA: AuthenticatedPrincipal = {
  tenantId: "tenant-a",
  projectId: "proj-a",
  principalType: "agent",
  principalId: "agent-a",
  apiKeyId: "key-alpha",
};
const P_OTHER_TENANT: AuthenticatedPrincipal = { ...P_ALPHA, tenantId: "tenant-b", apiKeyId: "key-beta" };
const P_OTHER_PROJECT: AuthenticatedPrincipal = { ...P_ALPHA, projectId: "proj-b", apiKeyId: "key-gamma" };
const P_OTHER_PRINCIPAL: AuthenticatedPrincipal = { ...P_ALPHA, principalId: "agent-z", apiKeyId: "key-delta" };

const API_KEYS: Record<string, AuthenticatedPrincipal> = {
  "key-alpha": P_ALPHA,
  "key-beta": P_OTHER_TENANT,
  "key-gamma": P_OTHER_PROJECT,
  "key-delta": P_OTHER_PRINCIPAL,
};

/** Stand-in for `verifyApiKey`: same contract, no database. */
async function testAuthenticate(request: Request): Promise<AuthResult> {
  const key = request.headers.get("x-soterai-api-key");
  if (!key) return { ok: false, status: 401, message: "missing api key" };
  const principal = API_KEYS[key];
  if (!principal) return { ok: false, status: 401, message: "unknown api key" };
  return { ok: true, principal };
}

function makeStore(overrides: Partial<SessionStoreOptions> = {}): McpSessionStore {
  return new McpSessionStore({
    limits: LIMITS,
    defaultPermissions: PERMISSIONS,
    defaultRoots: ROOTS,
    expectedServerId: BOUND_SERVER,
    ...overrides,
  });
}

interface MakeHandlerOptions {
  upstreamUrl: string;
  store?: McpSessionStore;
  onEvidence?: (d: McpGatewayDecision) => void;
  protectionMode?: ProtectionMode;
  mcpConfig?: Record<string, unknown>;
}

function makeHandler(o: MakeHandlerOptions) {
  return createHttpGatewayHandler({
    upstream: { url: o.upstreamUrl, timeoutMs: 5000 },
    limits: LIMITS,
    defaultPermissions: PERMISSIONS,
    defaultRoots: ROOTS,
    expectedServerId: BOUND_SERVER,
    protectionMode: o.protectionMode,
    mcpConfig: o.mcpConfig,
    authenticate: testAuthenticate,
    onEvidence: o.onEvidence ?? (() => {}),
    // Injected so tests never share the process-wide singleton, and so no
    // sweep timer is started unless a test explicitly starts one.
    store: o.store ?? makeStore(),
  });
}

function jrpc(method: string, params?: unknown, id: string | number = 1) {
  return { jsonrpc: "2.0", id, method, ...(params !== undefined ? { params } : {}) };
}

interface Posted {
  status: number;
  body: any;
  raw: string;
  sessionId: string | null;
  traceId: string | null;
}

interface PostOptions {
  key?: string | null;
  session?: string;
  headers?: Record<string, string>;
  accept?: string;
  signal?: AbortSignal;
}

async function post(
  handler: (r: Request) => Promise<Response>,
  body: unknown,
  o: PostOptions = {},
): Promise<Posted> {
  const resp = await handler(makeRequest(body, o));
  const raw = await resp.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = raw;
  }
  return {
    status: resp.status,
    body: parsed,
    raw,
    sessionId: resp.headers.get("mcp-session-id"),
    traceId: resp.headers.get("x-soter-trace-id"),
  };
}

function makeRequest(body: unknown, o: PostOptions = {}): Request {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (o.key !== null) headers["x-soterai-api-key"] = o.key ?? "key-alpha";
  if (o.session) headers["mcp-session-id"] = o.session;
  if (o.accept) headers.accept = o.accept;
  Object.assign(headers, o.headers ?? {});
  return new Request("http://gateway.local/api/gateway/mcp", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    ...(o.signal ? { signal: o.signal } : {}),
  });
}

// --- upstream mocks --------------------------------------------------------

interface MockUpstream {
  server: Server;
  url: string;
  calls: any[];
  close(): void;
}

/** JSON upstream. `reply` sees each JSON-RPC body it is sent. */
async function startJsonUpstream(reply: (body: any) => unknown): Promise<MockUpstream> {
  const calls: any[] = [];
  const server = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    calls.push(body);
    const out = await reply(body);
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(out));
  });
  const url = await listen(server);
  return { server, url, calls, close: () => server.close() };
}

interface MockSseUpstream extends MockUpstream {
  /** Resolves when the upstream response socket is closed by either side. */
  responseClosed: Promise<void>;
}

/**
 * SSE upstream. `frames` are written in order; when `hold` is true the response
 * is never ended, so a client disconnect is the only thing that closes it.
 */
async function startSseUpstream(
  frames: (body: any) => string[],
  hold = false,
): Promise<MockSseUpstream> {
  const calls: any[] = [];
  let resolveClosed: () => void = () => {};
  const responseClosed = new Promise<void>((r) => {
    resolveClosed = r;
  });
  const open: ServerResponse[] = [];
  const server = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    calls.push(body);
    open.push(res);
    res.on("close", () => resolveClosed());
    res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache" });
    for (const f of frames(body)) res.write(f);
    if (!hold) res.end();
  });
  const url = await listen(server);
  return {
    server,
    url,
    calls,
    responseClosed,
    close: () => {
      for (const res of open) {
        try {
          res.end();
        } catch {
          /* already gone */
        }
      }
      server.close();
    },
  };
}

function listen(server: Server): Promise<string> {
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      const port = addr && typeof addr === "object" ? addr.port : 0;
      resolve(`http://127.0.0.1:${port}`);
    });
  });
}

// --- stdio harness (for transport parity) ---------------------------------

class MockTransport implements RawTransport {
  sent: string[] = [];
  private lineHandler: ((l: string) => void) | undefined;
  private closeHandler: (() => void) | undefined;
  send(line: string): void {
    this.sent.push(line);
  }
  onLine(h: (l: string) => void): void {
    this.lineHandler = h;
  }
  onClose(h: () => void): void {
    this.closeHandler = h;
  }
  close(): void {
    this.closeHandler?.();
  }
  receive(line: string): void {
    this.lineHandler?.(line);
  }
}

interface StdioRun {
  decisions: McpGatewayDecision[];
  /** Everything the gateway forwarded upstream. Empty ⇒ nothing executed. */
  upstreamSent: string[];
  clientSent: string[];
  gateway: McpGateway;
}

/**
 * Run one tools/call through the stdio transport using an engine built from the
 * SAME session identity, limits and policy context as the HTTP session. That is
 * what makes the two decision envelopes comparable field-for-field.
 */
function runStdioToolCall(
  identity: McpSessionIdentity,
  params: unknown,
  o: { protectionMode?: ProtectionMode; mcpConfig?: Record<string, unknown> } = {},
): StdioRun {
  const decisions: McpGatewayDecision[] = [];
  const engine = new McpEnforcementEngine({
    identity,
    limits: LIMITS,
    protectionMode: o.protectionMode,
    mcpConfig: o.mcpConfig,
  });
  const client = new MockTransport();
  const upstream = new MockTransport();
  const gateway = new McpGateway({
    engine,
    client,
    upstream,
    limits: LIMITS,
    onEvidence: (d) => decisions.push(d),
  });
  client.receive(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params }));
  return { decisions, upstreamSent: upstream.sent, clientSent: client.sent, gateway };
}

/**
 * Normalise a decision for cross-transport comparison: `traceId` and
 * `timestamp` are per-request by construction, and `approvalId` is a random
 * identifier. Every other field must match exactly.
 */
function envelope(d: McpGatewayDecision): Record<string, unknown> {
  const copy = JSON.parse(JSON.stringify(d)) as Record<string, unknown>;
  delete copy.traceId;
  delete copy.timestamp;
  if (copy.approvalId) copy.approvalId = "<approval-id>";
  return copy;
}

// --- SSE helpers -----------------------------------------------------------

function byteStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let i = 0;
  return new ReadableStream({
    pull(controller) {
      if (i >= chunks.length) {
        controller.close();
        return;
      }
      controller.enqueue(encoder.encode(chunks[i]));
      i += 1;
    },
  });
}

async function collect(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let out = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    out += decoder.decode(value, { stream: true });
  }
  return out;
}

function realEngine(identity?: Partial<McpSessionIdentity>): McpEnforcementEngine {
  return new McpEnforcementEngine({
    identity: { ...sessionIdentity(), ...identity },
    limits: LIMITS,
  });
}

function sessionIdentity(): McpSessionIdentity {
  return {
    tenantId: P_ALPHA.tenantId,
    projectId: P_ALPHA.projectId,
    clientId: "sse-client",
    principalType: P_ALPHA.principalType,
    principalId: P_ALPHA.principalId,
    serverId: BOUND_SERVER,
    allowedPermissions: PERMISSIONS as McpSessionIdentity["allowedPermissions"],
    allowedRoots: ROOTS,
    expiresAt: Date.now() + 3600_000,
  };
}

/** Engine stub whose result inspector throws — for the fail-closed test. */
function throwingEngine(): McpEnforcementEngine {
  return {
    policyVersion: "mcp.policy.v1:stub",
    inspectToolResult(): never {
      throw new TypeError("inspector exploded");
    },
  } as unknown as McpEnforcementEngine;
}

/**
 * Engine stub that always RELEASEs. Used only by the size-bound tests, so the
 * bound under test is the TRANSPORT bound and not a detector verdict.
 */
function permissiveEngine(): McpEnforcementEngine {
  return {
    policyVersion: "mcp.policy.v1:stub",
    inspectToolResult(_tool: string, result: unknown) {
      return { outcome: "RELEASE", decision: {} as McpGatewayDecision, safeResult: result };
    },
  } as unknown as McpEnforcementEngine;
}

function timerCount(): number {
  return process.getActiveResourcesInfo().filter((r) => r === "Timeout").length;
}

async function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      p,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`timed out waiting for ${label}`)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

const SECRET = "AKIAIOSFODNN7EXAMPLE";

// ===========================================================================
// 1-2. Authentication
// ===========================================================================

test("mcp http security 1: unauthenticated initialize is rejected", async () => {
  const upstream = await startJsonUpstream(() => ({ jsonrpc: "2.0", id: 1, result: {} }));
  try {
    const store = makeStore();
    const handler = makeHandler({ upstreamUrl: upstream.url, store });

    const noKey = await post(handler, jrpc("initialize", { protocolVersion: "2024-11-05" }), { key: null });
    assert.equal(noKey.status, 401);
    assert.match(String(noKey.body?.error?.message), /authentication failed/);

    const badKey = await post(handler, jrpc("initialize", { protocolVersion: "2024-11-05" }), { key: "key-forged" });
    assert.equal(badKey.status, 401);

    assert.equal(upstream.calls.length, 0, "an unauthenticated call must never reach upstream");
    assert.equal(store.size, 0, "an unauthenticated call must never create a session");
  } finally {
    upstream.close();
  }
});

test("mcp http security 2: forged tenant/project/principal headers are rejected", async () => {
  const upstream = await startJsonUpstream(() => ({ jsonrpc: "2.0", id: 1, result: { tools: [] } }));
  try {
    const store = makeStore();
    const handler = makeHandler({ upstreamUrl: upstream.url, store });

    for (const header of ["x-soterai-tenant", "x-soterai-project", "x-soterai-principal"]) {
      const res = await post(handler, jrpc("tools/list"), { headers: { [header]: "attacker-owned" } });
      assert.equal(res.status, 400, `${header} must be rejected`);
      assert.match(String(res.body?.error?.message), /identity headers are no longer accepted/);
    }
    assert.equal(store.size, 0, "a forged-identity request must not create a session");

    // The authenticated identity is the only identity that exists.
    const ok = await post(handler, jrpc("tools/list"));
    assert.equal(ok.status, 200);
    const created = store.resolve(ok.sessionId!, P_ALPHA);
    assert.ok(created.ok);
    assert.equal(created.session.identity.tenantId, "tenant-a");
    assert.equal(created.session.identity.projectId, "proj-a");
    assert.equal(created.session.identity.principalId, "agent-a");
  } finally {
    upstream.close();
  }
});

// ===========================================================================
// 3-8. Session ownership and lifetime
// ===========================================================================

test("mcp http security 3: session ownership succeeds for the creator", async () => {
  const upstream = await startJsonUpstream(() => ({ jsonrpc: "2.0", id: 1, result: { tools: [] } }));
  try {
    const store = makeStore();
    const handler = makeHandler({ upstreamUrl: upstream.url, store });

    const first = await post(handler, jrpc("tools/list", undefined, 1));
    assert.equal(first.status, 200);
    assert.ok(first.sessionId?.startsWith("mcps_"));

    const second = await post(handler, jrpc("tools/list", undefined, 2), { session: first.sessionId! });
    assert.equal(second.status, 200, "the creating principal must be able to reuse its own session");
    assert.equal(second.sessionId, first.sessionId);
    assert.equal(store.size, 1, "reuse must not create a second session");
  } finally {
    upstream.close();
  }
});

test("mcp http security 4: cross-tenant session reuse is rejected without leaking existence", async () => {
  const upstream = await startJsonUpstream(() => ({ jsonrpc: "2.0", id: 1, result: { tools: [] } }));
  try {
    const store = makeStore();
    const handler = makeHandler({ upstreamUrl: upstream.url, store });

    const mine = await post(handler, jrpc("tools/list"));
    assert.equal(mine.status, 200);
    const realId = mine.sessionId!;

    const body = jrpc("tools/list", undefined, 7);
    const foreignReal = await post(handler, body, { key: "key-beta", session: realId });
    const foreignFake = await post(handler, body, {
      key: "key-beta",
      session: "mcps_ZmFrZS1zZXNzaW9uLWlkLXRoYXQtZG9lcy1ub3QtZXhpc3Q",
    });

    assert.equal(foreignReal.status, 401);
    assert.equal(foreignReal.body?.error?.code, RPC.SOTER_SESSION_INVALID);
    // The whole point: a caller cannot tell a real foreign session from a
    // fabricated one. Bodies must be byte-identical (traceId lives in a header).
    assert.equal(foreignReal.raw, foreignFake.raw, "response bodies must be indistinguishable");
    assert.equal(foreignReal.status, foreignFake.status);
    assert.equal(foreignReal.sessionId, null, "a rejected lookup must not echo a session id");
    assert.notEqual(foreignReal.traceId, foreignFake.traceId, "traces stay distinct for audit");

    assert.equal(store.size, 1, "a foreign probe must neither create nor destroy a session");
    assert.equal(upstream.calls.length, 1, "a foreign probe must never reach upstream");

    // Field-level precision: the binding covers tenantId specifically.
    assert.equal(store.resolve(realId, { ...P_ALPHA, tenantId: "tenant-b" }).ok, false);
    assert.equal(store.resolve(realId, P_ALPHA).ok, true);
  } finally {
    upstream.close();
  }
});

test("mcp http security 5: cross-project session reuse is rejected", async () => {
  const upstream = await startJsonUpstream(() => ({ jsonrpc: "2.0", id: 1, result: { tools: [] } }));
  try {
    const store = makeStore();
    const handler = makeHandler({ upstreamUrl: upstream.url, store });
    const mine = await post(handler, jrpc("tools/list"));
    const realId = mine.sessionId!;

    const foreign = await post(handler, jrpc("tools/list", undefined, 2), { key: "key-gamma", session: realId });
    assert.equal(foreign.status, 401);
    assert.equal(foreign.body?.error?.code, RPC.SOTER_SESSION_INVALID);
    assert.equal(store.resolve(realId, { ...P_ALPHA, projectId: "proj-b" }).ok, false);
    assert.equal(store.size, 1);
  } finally {
    upstream.close();
  }
});

test("mcp http security 6: cross-principal session reuse is rejected", async () => {
  const upstream = await startJsonUpstream(() => ({ jsonrpc: "2.0", id: 1, result: { tools: [] } }));
  try {
    const store = makeStore();
    const handler = makeHandler({ upstreamUrl: upstream.url, store });
    const mine = await post(handler, jrpc("tools/list"));
    const realId = mine.sessionId!;

    const foreign = await post(handler, jrpc("tools/list", undefined, 2), { key: "key-delta", session: realId });
    assert.equal(foreign.status, 401);
    assert.equal(foreign.body?.error?.code, RPC.SOTER_SESSION_INVALID);
    assert.equal(store.resolve(realId, { ...P_ALPHA, principalId: "agent-z" }).ok, false);
    // The credential itself is part of the binding: a stolen session id is
    // useless with a different key even for the same principal.
    assert.equal(store.resolve(realId, { ...P_ALPHA, apiKeyId: "key-other" }).ok, false);
    assert.equal(store.size, 1);
  } finally {
    upstream.close();
  }
});

test("mcp http security 7: expired session is rejected", async () => {
  const upstream = await startJsonUpstream(() => ({ jsonrpc: "2.0", id: 1, result: { tools: [] } }));
  try {
    let clock = 1_700_000_000_000;
    const store = makeStore({ idleTtlMs: 1000, now: () => clock });
    const handler = makeHandler({ upstreamUrl: upstream.url, store });

    const first = await post(handler, jrpc("tools/list"));
    assert.equal(first.status, 200);
    const id = first.sessionId!;

    clock += 5000; // past the idle TTL
    const stale = await post(handler, jrpc("tools/list", undefined, 2), { session: id });
    assert.equal(stale.status, 401);
    assert.equal(stale.body?.error?.code, RPC.SOTER_SESSION_INVALID);
    assert.equal(store.size, 0, "an expired session must be dropped, not merely refused");
  } finally {
    upstream.close();
  }
});

test("mcp http security 8: unknown session is rejected", async () => {
  const upstream = await startJsonUpstream(() => ({ jsonrpc: "2.0", id: 1, result: { tools: [] } }));
  try {
    const store = makeStore();
    const handler = makeHandler({ upstreamUrl: upstream.url, store });
    const res = await post(handler, jrpc("tools/list"), { session: "mcps_not-a-real-session" });
    assert.equal(res.status, 401);
    assert.equal(res.body?.error?.code, RPC.SOTER_SESSION_INVALID);
    assert.equal(res.body?.error?.message, "invalid or expired session");
    assert.equal(store.size, 0, "an unknown id must not silently create a session");
    assert.equal(upstream.calls.length, 0);
  } finally {
    upstream.close();
  }
});

// ===========================================================================
// 9-10. Lifecycle bounds
// ===========================================================================

test("mcp http security 9: maximum-session limit is enforced", async () => {
  const upstream = await startJsonUpstream(() => ({ jsonrpc: "2.0", id: 1, result: { tools: [] } }));
  try {
    const store = makeStore({ maxSessions: 2 });
    const handler = makeHandler({ upstreamUrl: upstream.url, store });

    const a = await post(handler, jrpc("tools/list", undefined, 1));
    const b = await post(handler, jrpc("tools/list", undefined, 2));
    assert.equal(a.status, 200);
    assert.equal(b.status, 200);
    assert.equal(store.size, 2);

    const c = await post(handler, jrpc("tools/list", undefined, 3));
    assert.equal(c.status, 429, "over the session bound must be Too Many Requests");
    assert.equal(c.body?.error?.code, RPC.SOTER_LIMIT_EXCEEDED);
    assert.equal(store.size, 2, "the bound must actually hold");

    // Existing sessions keep working — the limit sheds new load, not old work.
    const reuse = await post(handler, jrpc("tools/list", undefined, 4), { session: a.sessionId! });
    assert.equal(reuse.status, 200);
  } finally {
    upstream.close();
  }
});

test("mcp http security 10: session cleanup does not leak timers", async () => {
  const upstream = await startJsonUpstream(() => ({ jsonrpc: "2.0", id: 1, result: { tools: [] } }));
  const store = makeStore({ sweepIntervalMs: 50 });
  try {
    // start() must be idempotent: dev hot reload re-evaluates the module and
    // must not end up with two sweepers.
    let intervalsCreated = 0;
    const realSetInterval = globalThis.setInterval;
    (globalThis as unknown as { setInterval: unknown }).setInterval = (...args: unknown[]) => {
      intervalsCreated += 1;
      return (realSetInterval as unknown as (...a: unknown[]) => unknown)(...args);
    };
    try {
      store.start();
      store.start();
      store.start();
    } finally {
      (globalThis as unknown as { setInterval: unknown }).setInterval = realSetInterval;
    }
    assert.equal(intervalsCreated, 1, "three start() calls must create exactly one timer");
    assert.equal(store.timerActive, true);

    const handler = makeHandler({ upstreamUrl: upstream.url, store });
    const before = timerCount();
    for (let i = 0; i < 12; i += 1) {
      const res = await post(handler, jrpc("tools/list", undefined, i));
      assert.equal(res.status, 200);
    }
    assert.equal(
      timerCount(),
      before,
      "N requests must not accumulate N timers (the old per-request setInterval bug)",
    );
    assert.equal(store.size, 12);

    store.dispose();
    assert.equal(store.timerActive, false, "dispose must clear the sweeper");
    assert.equal(store.size, 0, "dispose must drop every session");
  } finally {
    store.dispose();
    upstream.close();
  }
});

// ===========================================================================
// 11-12. Real upstream server identity
// ===========================================================================

test("mcp http security 11: real upstream identity is recorded and bound", async () => {
  const upstream = await startJsonUpstream((body) => {
    if (body.method === "initialize") {
      return {
        jsonrpc: "2.0",
        id: body.id,
        result: {
          protocolVersion: "2024-11-05",
          serverInfo: { name: "real-upstream-server", version: "2.1.0" },
          capabilities: { tools: {}, resources: {} },
        },
      };
    }
    return { jsonrpc: "2.0", id: body.id, result: { content: [{ type: "text", text: "ok" }] } };
  });
  try {
    const evidence: McpGatewayDecision[] = [];
    // TOFU: no expected id configured, so the session binds whatever the real
    // upstream reports during the real initialize exchange.
    const store = makeStore({ expectedServerId: undefined });
    const handler = makeHandler({ upstreamUrl: upstream.url, store, onEvidence: (d) => evidence.push(d) });

    const init = await post(handler, jrpc("initialize", { protocolVersion: "2024-11-05" }));
    assert.equal(init.status, 200);
    // Not a fabricated name — the upstream's own serverInfo is returned.
    assert.equal(init.body?.result?.serverInfo?.name, "real-upstream-server");
    assert.equal(init.body?.result?.serverInfo?.version, "2.1.0");
    assert.equal(upstream.calls[0]?.method, "initialize", "the initialize exchange must really happen");

    // Prove the identity was BOUND, not merely echoed: later decisions on this
    // session are attributed to the real server.
    const call = await post(handler, jrpc("tools/call", { name: "exec", arguments: { command: "rm -rf /" } }, 2), {
      session: init.sessionId!,
    });
    assert.equal(call.status, 403);
    const decision = evidence.find((d) => d.tool === "exec");
    assert.ok(decision, "a decision must be emitted for the call");
    assert.equal(decision!.server, "real-upstream-server");
    assert.equal(decision!.destination.host, "mcp:real-upstream-server");
  } finally {
    upstream.close();
  }
});

test("mcp http security 12: changed upstream identity terminates the session", async () => {
  let serverName = "real-upstream-server";
  const upstream = await startJsonUpstream((body) => ({
    jsonrpc: "2.0",
    id: body.id,
    result: {
      protocolVersion: "2024-11-05",
      serverInfo: { name: serverName, version: "1.0" },
      capabilities: { tools: {} },
    },
  }));
  try {
    const evidence: McpGatewayDecision[] = [];
    const store = makeStore({ expectedServerId: undefined });
    const handler = makeHandler({ upstreamUrl: upstream.url, store, onEvidence: (d) => evidence.push(d) });

    const init = await post(handler, jrpc("initialize", { protocolVersion: "2024-11-05" }));
    assert.equal(init.status, 200);
    assert.equal(store.size, 1);

    // The upstream is swapped under the same session.
    serverName = "evil-swapped-server";
    const again = await post(handler, jrpc("initialize", { protocolVersion: "2024-11-05" }, 2), {
      session: init.sessionId!,
    });
    assert.equal(again.status, 401);
    assert.equal(again.body?.error?.code, RPC.SOTER_SESSION_INVALID);
    assert.match(String(again.body?.error?.message), /server identity rejected: SERVER_IDENTITY_CHANGED/);
    assert.equal(store.size, 0, "the session must be terminated, not just refused");

    const identityEvidence = evidence.find((d) => d.evidence.reasonCodes.includes("SERVER_IDENTITY_CHANGED"));
    assert.ok(identityEvidence, "privacy-safe identity evidence must be emitted");
    assert.equal(identityEvidence!.decision, "BLOCK");
    assert.equal(identityEvidence!.enforcement, "ENFORCED");
    assert.ok(identityEvidence!.evidence.categories.includes("MCP_SERVER_IDENTITY"));
    assert.equal(identityEvidence!.evidence.redactedArgsPreview, "", "evidence must carry no content");

    // The terminated id is now indistinguishable from an unknown one.
    const after = await post(handler, jrpc("tools/list", undefined, 3), { session: init.sessionId! });
    assert.equal(after.status, 401);
  } finally {
    upstream.close();
  }
});

// ===========================================================================
// 13-14. Cross-request session state (the whole point of a persistent store)
// ===========================================================================

test("mcp http security 13: undeclared tool is rejected over HTTP", async () => {
  const upstream = await startJsonUpstream((body) => {
    if (body.method === "tools/list") {
      return { jsonrpc: "2.0", id: body.id, result: { tools: [{ name: "echo", description: "echo" }] } };
    }
    return { jsonrpc: "2.0", id: body.id, result: { content: [{ type: "text", text: "EXECUTED" }] } };
  });
  try {
    const evidence: McpGatewayDecision[] = [];
    const store = makeStore();
    const handler = makeHandler({ upstreamUrl: upstream.url, store, onEvidence: (d) => evidence.push(d) });

    const list = await post(handler, jrpc("tools/list"));
    assert.equal(list.status, 200);
    const session = list.sessionId!;

    // Inventory learned on request 1 must still apply on request 2 — this is
    // exactly what the per-request handler could never do.
    const bad = await post(handler, jrpc("tools/call", { name: "not_declared", arguments: { text: "hi" } }, 2), {
      session,
    });
    assert.equal(bad.status, 403);
    assert.equal(bad.body?.error?.code, RPC.SOTER_BLOCKED);
    const decision = evidence.find((d) => d.tool === "not_declared");
    assert.ok(decision!.evidence.reasonCodes.includes("UNDECLARED_TOOL"));
    assert.equal(
      upstream.calls.filter((c) => c.method === "tools/call").length,
      0,
      "an undeclared tool must never reach upstream",
    );

    // A declared tool on the same session still works.
    const good = await post(handler, jrpc("tools/call", { name: "echo", arguments: { text: "hello world" } }, 3), {
      session,
    });
    assert.equal(good.status, 200);
  } finally {
    upstream.close();
  }
});

test("mcp http security 14: multi-tool-chain escalation is detected across HTTP requests", async () => {
  const upstream = await startJsonUpstream((body) => ({
    jsonrpc: "2.0",
    id: body.id,
    result: { content: [{ type: "text", text: "fetched" }] },
  }));
  try {
    const evidence: McpGatewayDecision[] = [];
    const store = makeStore();
    // Created directly so the test can act as the approver. The session is then
    // driven entirely over HTTP.
    const created = store.create(P_ALPHA);
    assert.ok(created.ok);
    const session = created.session;
    const handler = makeHandler({ upstreamUrl: upstream.url, store, onEvidence: (d) => evidence.push(d) });

    const read = { name: "fetch", arguments: { url: "https://example.com/data" } };

    // Request 1: first egress call — held for approval.
    const held = await post(handler, jrpc("tools/call", read, 1), { session: session.id });
    assert.equal(held.status, 403);
    assert.equal(held.body?.error?.code, RPC.SOTER_APPROVAL_REQUIRED);
    const approvalId = held.body?.error?.data?.approvalId as string;
    assert.ok(approvalId);

    // Approve, then re-issue: the call is forwarded and the session now knows
    // it has touched external data.
    assert.equal(session.engine.approvals.approve(approvalId).ok, true);
    const forwarded = await post(handler, jrpc("tools/call", read, 2), { session: session.id });
    assert.equal(forwarded.status, 200, "an approved call must forward");

    // Request 3, a DIFFERENT egress call on the same session: the read-then-send
    // chain must be recognised across requests.
    const chained = await post(
      handler,
      jrpc("tools/call", { name: "post", arguments: { url: "https://collector.example.net/upload" } }, 3),
      { session: session.id },
    );
    assert.equal(chained.status, 403);
    assert.equal(chained.body?.error?.code, RPC.SOTER_APPROVAL_REQUIRED);
    const chainDecision = evidence.find((d) => d.tool === "post");
    assert.ok(chainDecision, "a decision must be emitted for the chained call");
    assert.ok(
      chainDecision!.evidence.reasonCodes.includes("MULTI_TOOL_CHAIN_ESCALATION"),
      `expected MULTI_TOOL_CHAIN_ESCALATION, got ${JSON.stringify(chainDecision!.evidence.reasonCodes)}`,
    );
  } finally {
    upstream.close();
  }
});

// ===========================================================================
// 15-16, 26. Transport parity
// ===========================================================================

test("mcp http security 15: protectionMode parity across stdio and HTTP", async () => {
  const upstream = await startJsonUpstream((body) => ({
    jsonrpc: "2.0",
    id: body.id,
    result: { content: [{ type: "text", text: "ok" }] },
  }));
  try {
    // A filesystem-scope violation is the cleanest mode discriminator: strict /
    // enterprise_locked BLOCK it, other modes hold it for approval.
    const params = { name: "read_file", arguments: { path: "/etc/shadow" } };

    const results: Record<string, { http: McpGatewayDecision; stdio: McpGatewayDecision; status: number }> = {};
    for (const mode of ["standard", "strict"] as ProtectionMode[]) {
      const httpEvidence: McpGatewayDecision[] = [];
      const store = makeStore({ protectionMode: mode });
      const created = store.create(P_ALPHA);
      assert.ok(created.ok);
      const handler = makeHandler({
        upstreamUrl: upstream.url,
        store,
        protectionMode: mode,
        onEvidence: (d) => httpEvidence.push(d),
      });
      const res = await post(handler, jrpc("tools/call", params), { session: created.session.id });
      const stdio = runStdioToolCall(created.session.identity, params, { protectionMode: mode });
      try {
        assert.equal(stdio.upstreamSent.length, 0, "stdio must not forward a denied call");
        results[mode] = { http: httpEvidence[0], stdio: stdio.decisions[0], status: res.status };
      } finally {
        stdio.gateway.shutdown();
      }
    }

    // Parity: same call, same mode, same canonical decision on both transports.
    for (const mode of ["standard", "strict"]) {
      assert.deepEqual(
        envelope(results[mode].http),
        envelope(results[mode].stdio),
        `${mode}: HTTP and stdio must produce the same canonical decision`,
      );
    }

    // And the mode really is threaded through HTTP — otherwise "parity" would
    // be trivially satisfied by both transports ignoring it.
    assert.equal(results.strict.http.decision, "BLOCK");
    assert.equal(results.standard.http.decision, "REQUIRE_APPROVAL");
    assert.equal(results.strict.status, 403);
    assert.equal(results.standard.status, 403);
  } finally {
    upstream.close();
  }
});

test("mcp http security 16: mcpConfig parity across stdio and HTTP", async () => {
  const upstream = await startJsonUpstream((body) => ({
    jsonrpc: "2.0",
    id: body.id,
    result: { content: [{ type: "text", text: "ok" }] },
  }));
  try {
    const params = { name: "echo", arguments: { text: "hello world" } };
    // A config that does NOT declare the bound server: guard-core must treat the
    // invocation as an unknown MCP server on BOTH transports.
    const foreignConfig = { mcpServers: { "some-other-server": { command: "other" } } };

    const httpEvidence: McpGatewayDecision[] = [];
    const store = makeStore({ mcpConfig: foreignConfig });
    const created = store.create(P_ALPHA);
    assert.ok(created.ok);
    const handler = makeHandler({
      upstreamUrl: upstream.url,
      store,
      mcpConfig: foreignConfig,
      onEvidence: (d) => httpEvidence.push(d),
    });

    const res = await post(handler, jrpc("tools/call", params), { session: created.session.id });
    assert.equal(res.status, 403);
    assert.ok(httpEvidence[0].evidence.reasonCodes.includes("UNKNOWN_MCP_SERVER"));

    const stdio = runStdioToolCall(created.session.identity, params, { mcpConfig: foreignConfig });
    try {
      assert.equal(stdio.upstreamSent.length, 0);
      assert.deepEqual(
        envelope(httpEvidence[0]),
        envelope(stdio.decisions[0]),
        "the same mcpConfig must yield the same decision on both transports",
      );
    } finally {
      stdio.gateway.shutdown();
    }

    // Proof the config is consulted rather than ignored: declaring the bound
    // server clears the same call.
    const okStore = makeStore({ mcpConfig: { mcpServers: { [BOUND_SERVER]: { command: BOUND_SERVER } } } });
    const okCreated = okStore.create(P_ALPHA);
    assert.ok(okCreated.ok);
    const okHandler = makeHandler({
      upstreamUrl: upstream.url,
      store: okStore,
      mcpConfig: { mcpServers: { [BOUND_SERVER]: { command: BOUND_SERVER } } },
    });
    const allowed = await post(okHandler, jrpc("tools/call", params), { session: okCreated.session.id });
    assert.equal(allowed.status, 200, "a declared server must not be blocked as unknown");
  } finally {
    upstream.close();
  }
});

test("mcp http security 26: canonical decision envelopes are equivalent across transports", async () => {
  const upstream = await startJsonUpstream((body) => ({
    jsonrpc: "2.0",
    id: body.id,
    result: { content: [{ type: "text", text: "SHOULD NOT HAPPEN" }] },
  }));
  try {
    const params = { name: "exec", arguments: { command: "rm -rf /" } };
    const httpEvidence: McpGatewayDecision[] = [];
    const store = makeStore();
    const created = store.create(P_ALPHA);
    assert.ok(created.ok);
    const handler = makeHandler({ upstreamUrl: upstream.url, store, onEvidence: (d) => httpEvidence.push(d) });

    const res = await post(handler, jrpc("tools/call", params), { session: created.session.id });
    assert.equal(res.status, 403);
    assert.equal(upstream.calls.length, 0, "HTTP must not forward a blocked call");

    const stdio = runStdioToolCall(created.session.identity, params);
    try {
      assert.equal(stdio.upstreamSent.length, 0, "stdio must not forward a blocked call");
      const http = envelope(httpEvidence[0]);
      const std = envelope(stdio.decisions[0]);
      assert.deepEqual(http, std);
      // Spot-check the fields that matter most, so a future regression that
      // empties BOTH sides cannot pass this test.
      assert.equal(httpEvidence[0].decision, "BLOCK");
      assert.equal(httpEvidence[0].enforcement, "ENFORCED");
      assert.equal(httpEvidence[0].direction, "INPUT");
      assert.equal(httpEvidence[0].policyVersion, stdio.decisions[0].policyVersion);
      assert.ok(httpEvidence[0].evidence.reasonCodes.includes("DANGEROUS_COMMAND"));
      assert.ok(httpEvidence[0].policyVersion.startsWith("mcp.policy.v1:"));
    } finally {
      stdio.gateway.shutdown();
    }
  } finally {
    upstream.close();
  }
});

// ===========================================================================
// 17-23. SSE enforcement
// ===========================================================================

test("mcp http security 17: safe SSE call reaches upstream and is released", async () => {
  const text = "hello world ".repeat(30); // > one scan window, so it is inspected mid-stream
  const upstream = await startSseUpstream(() => [`event: message\ndata: ${text}\n\n`]);
  try {
    const store = makeStore();
    const handler = makeHandler({ upstreamUrl: upstream.url, store });
    const req = makeRequest(jrpc("tools/call", { name: "echo", arguments: { text: "hello world" } }), {
      accept: "text/event-stream",
    });
    const resp = await handler(req);
    assert.equal(resp.status, 200);
    assert.equal(resp.headers.get("content-type"), "text/event-stream");
    const out = await collect(resp.body!);
    assert.ok(out.includes("hello world"), "safe streamed content must be released");
    assert.ok(!out.includes("soterai_guard_blocked"), "a safe stream must not be blocked");
    assert.equal(upstream.calls.length, 1, "a safe call must reach upstream");
    assert.equal(upstream.calls[0].method, "tools/call");
  } finally {
    upstream.close();
  }
});

test("mcp http security 18: blocked SSE call never reaches upstream", async () => {
  const upstream = await startSseUpstream(() => [`event: message\ndata: EXECUTED\n\n`]);
  try {
    const store = makeStore();
    const handler = makeHandler({ upstreamUrl: upstream.url, store });
    const req = makeRequest(jrpc("tools/call", { name: "exec", arguments: { command: "rm -rf /" } }), {
      accept: "text/event-stream",
    });
    const resp = await handler(req);
    assert.equal(resp.status, 403, "pre-execution enforcement runs before any stream is opened");
    const body = JSON.parse(await resp.text());
    assert.equal(body.error.code, RPC.SOTER_BLOCKED);
    assert.equal(upstream.calls.length, 0, "no upstream stream may be opened for a blocked call");
  } finally {
    upstream.close();
  }
});

test("mcp http security 19: SSE inspector exception does not silently allow", async () => {
  const marker = "MARKER_THAT_MUST_NOT_ESCAPE";
  const evidence: McpGatewayDecision[] = [];
  const stream = createSseInspectionStream(
    byteStream([`event: message\ndata: ${marker} ${"x".repeat(400)}\n\n`]),
    "echo",
    "trace-fail-closed",
    { engine: throwingEngine(), onEvidence: (d) => evidence.push(d) },
  );
  const out = await collect(stream);

  assert.ok(out.includes("soterai_guard_blocked"), "an inspector failure must terminate the stream");
  assert.ok(!out.includes(marker), "content must not be released when inspection failed");
  const failure = evidence.find((d) =>
    d.evidence.reasonCodes.some((c) => c.startsWith("STREAM_INSPECTION_ERROR")),
  );
  assert.ok(failure, "the failure must be auditable");
  assert.equal(failure!.decision, "BLOCK");
  assert.equal(failure!.enforcement, "ENFORCED");
  assert.ok(failure!.evidence.reasonCodes.includes("STREAM_INSPECTION_ERROR:TypeError"));
  assert.ok(failure!.evidence.reasonCodes.includes("FAIL_CLOSED_DEGRADED"));

  // In strict mode the same failure is recorded as a strict fail-closed.
  const strictEvidence: McpGatewayDecision[] = [];
  const strictOut = await collect(
    createSseInspectionStream(
      byteStream([`event: message\ndata: ${marker} ${"x".repeat(400)}\n\n`]),
      "echo",
      "trace-fail-closed-strict",
      { engine: throwingEngine(), protectionMode: "strict", onEvidence: (d) => strictEvidence.push(d) },
    ),
  );
  assert.ok(!strictOut.includes(marker));
  assert.ok(strictEvidence[0].evidence.reasonCodes.includes("FAIL_CLOSED_STRICT"));
});

test("mcp http security 20: SSE decisions emit audit evidence", async () => {
  const evidence: McpGatewayDecision[] = [];
  const engine = realEngine();
  const stream = createSseInspectionStream(
    byteStream([`event: message\ndata: ${"benign streamed content ".repeat(20)}\n\n`]),
    "echo",
    "trace-audit",
    {
      engine,
      onEvidence: (d) => evidence.push(d),
      identity: { projectId: "proj-a", organizationId: "tenant-a", userId: "agent-a", sessionId: "sse-client" },
    },
  );
  await collect(stream);

  assert.ok(evidence.length > 0, "the shared inspector must emit a decision for a stream");
  const d = evidence[0];
  assert.equal(d.direction, "OUTPUT");
  assert.equal(d.enforcement, "ENFORCED");
  assert.equal(d.tool, "echo");
  assert.equal(d.traceId, "trace-audit");
  assert.equal(d.policyVersion, engine.policyVersion);
  assert.equal(d.identity.organizationId, "tenant-a");
});

test("mcp http security 21: secret result is redacted over HTTP and withheld over SSE", async () => {
  // --- HTTP (non-streaming): the full result is inspected before release, so
  // the secret can be replaced in place and the client still gets its answer.
  const jsonUpstream = await startJsonUpstream((body) => ({
    jsonrpc: "2.0",
    id: body.id,
    result: { content: [{ type: "text", text: `your key is ${SECRET} — keep it safe` }] },
  }));
  try {
    const evidence: McpGatewayDecision[] = [];
    const handler = makeHandler({
      upstreamUrl: jsonUpstream.url,
      store: makeStore(),
      onEvidence: (d) => evidence.push(d),
    });
    const res = await post(handler, jrpc("tools/call", { name: "echo", arguments: { text: "hello world" } }));
    assert.equal(res.status, 200);
    assert.ok(!res.raw.includes(SECRET), "the raw secret must never reach the client over HTTP");
    assert.ok(res.raw.includes("REDACTED"), "the redacted placeholder must be present");
    const output = evidence.find((d) => d.direction === "OUTPUT");
    assert.equal(output!.decision, "REDACT");
  } finally {
    jsonUpstream.close();
  }

  // --- SSE: a stream cannot be edited retroactively, so a REDACT verdict stops
  // the stream instead of releasing unredacted bytes. Either way the secret does
  // not escape.
  const engine = realEngine();
  const evidence: McpGatewayDecision[] = [];
  const out = await collect(
    createSseInspectionStream(
      byteStream([`event: message\ndata: your key is ${SECRET} keep it safe\n\n`]),
      "leak",
      "trace-secret-sse",
      { engine, onEvidence: (d) => evidence.push(d) },
    ),
  );
  assert.ok(!out.includes(SECRET), "the raw secret must never reach the client over SSE");
  assert.ok(out.includes("soterai_guard_blocked"), "the stream must be stopped");
  assert.ok(evidence.some((d) => d.decision === "REDACT"), "the redact verdict must be auditable");
});

test("mcp http security 22: oversized SSE frame and accumulated stream are rejected", async () => {
  // A peer that never terminates a frame must not grow gateway memory forever.
  const frameOut = await collect(
    createSseInspectionStream(byteStream(["data: " + "x".repeat(1_200_000)]), "echo", "trace-frame", {
      engine: permissiveEngine(),
    }),
  );
  assert.ok(frameOut.includes("SSE frame exceeded size bound"), `got: ${frameOut.slice(0, 200)}`);
  assert.ok(!frameOut.includes("xxxxxxxx"), "an over-bound frame must not be released");

  // Well-formed frames that together exceed the accumulation bound.
  const chunk = `event: message\ndata: ${"a".repeat(200_000)}\n\n`;
  const accOut = await collect(
    createSseInspectionStream(byteStream(Array.from({ length: 30 }, () => chunk)), "echo", "trace-acc", {
      engine: permissiveEngine(),
    }),
  );
  assert.ok(accOut.includes("Accumulated response exceeded size bound"), `got tail: ${accOut.slice(-200)}`);
  assert.ok(Buffer.byteLength(accOut, "utf8") < 6_000_000, "the stream must be cut, not fully relayed");

  // A stream that runs past the duration bound is cut as well.
  let clock = 0;
  const durationOut = await collect(
    createSseInspectionStream(
      byteStream([`event: message\ndata: ${"b".repeat(300)}\n\n`, `event: message\ndata: tail\n\n`]),
      "echo",
      "trace-duration",
      {
        engine: permissiveEngine(),
        now: () => {
          clock += 200_000;
          return clock;
        },
      },
    ),
  );
  assert.ok(durationOut.includes("Stream exceeded maximum duration"));
});

test("mcp http security 23: client disconnect cancels upstream", async () => {
  // (a) Stream level: cancelling the response stream cancels the upstream read.
  let cancelled = false;
  let completed = false;
  const stream = createSseInspectionStream(
    byteStream([`event: message\ndata: ${"ok ".repeat(120)}\n\n`, `event: message\ndata: more\n\n`]),
    "echo",
    "trace-cancel",
    {
      engine: permissiveEngine(),
      onCancelUpstream: () => {
        cancelled = true;
      },
      onComplete: () => {
        completed = true;
      },
    },
  );
  const reader = stream.getReader();
  await reader.read();
  await reader.cancel("client-disconnected");
  assert.equal(cancelled, true, "client cancellation must abort the upstream call");
  assert.equal(completed, true, "concurrency accounting must be released on disconnect");

  // (b) End to end: abort the real client request and prove the real upstream
  // socket is closed rather than left running.
  const upstream = await startSseUpstream(() => [`event: message\ndata: ${"slow ".repeat(80)}\n\n`], true);
  try {
    const handler = makeHandler({ upstreamUrl: upstream.url, store: makeStore() });
    const ac = new AbortController();
    const resp = await handler(
      makeRequest(jrpc("tools/call", { name: "echo", arguments: { text: "hello world" } }), {
        accept: "text/event-stream",
        signal: ac.signal,
      }),
    );
    assert.equal(resp.status, 200);
    const r = resp.body!.getReader();
    await r.read();
    ac.abort();
    await withTimeout(upstream.responseClosed, 5000, "upstream response close after client disconnect");
    await r.cancel().catch(() => {});
  } finally {
    upstream.close();
  }
});

// ===========================================================================
// 24. Shutdown
// ===========================================================================

test("mcp http security 24: shutdown leaves no timers, sessions or child processes", async () => {
  const baselineTimers = timerCount();
  // A REAL child MCP server behind a REAL HTTP listener, so this covers all
  // three resource classes the contract names.
  const bridge = await startChildMcpBridge({ serverName: BOUND_SERVER });
  const store = makeStore().start();
  try {
    const handler = makeHandler({ upstreamUrl: bridge.url, store });
    const init = await post(handler, jrpc("initialize", { protocolVersion: "2024-11-05" }));
    assert.equal(init.status, 200);
    const list = await post(handler, jrpc("tools/list", undefined, 2), { session: init.sessionId! });
    assert.equal(list.status, 200);
    assert.equal(store.size, 1);
    assert.equal(store.timerActive, true);
    assert.ok(bridge.child.pid && bridge.child.exitCode === null, "the child must be alive during the test");
  } finally {
    store.dispose();
    await bridge.close();
  }

  assert.equal(store.timerActive, false, "no sweep timer may survive shutdown");
  assert.equal(store.size, 0, "no session may survive shutdown");
  assert.equal(bridge.isClosed(), true);
  assert.notEqual(bridge.child.exitCode === null && !bridge.child.killed, true, "no child process may survive shutdown");
  assert.equal(timerCount(), baselineTimers, "no timer may survive shutdown");
});

// ===========================================================================
// 25. Status mapping
// ===========================================================================

test("mcp http security 25: policy denial maps to the correct HTTP status", async () => {
  const upstream = await startJsonUpstream((body) => {
    if (body.method === "tools/list") {
      return { jsonrpc: "2.0", id: body.id, result: { tools: [{ name: "echo" }, { name: "read_file" }] } };
    }
    return { jsonrpc: "2.0", id: body.id, result: { content: [{ type: "text", text: "ok" }] } };
  });
  try {
    const store = makeStore({ maxSessions: 1 });
    const handler = makeHandler({ upstreamUrl: upstream.url, store });

    const list = await post(handler, jrpc("tools/list"));
    const session = list.sessionId!;

    // BLOCK → 403
    const blocked = await post(handler, jrpc("tools/call", { name: "echo", arguments: { command: "rm -rf /" } }, 2), {
      session,
    });
    assert.equal(blocked.status, 403);
    assert.equal(blocked.body.error.code, RPC.SOTER_BLOCKED);

    // REQUIRE_APPROVAL → 403 (a hold is a denial, not a malformed request)
    const held = await post(handler, jrpc("tools/call", { name: "read_file", arguments: { path: "/etc/shadow" } }, 3), {
      session,
    });
    assert.equal(held.status, 403);
    assert.equal(held.body.error.code, RPC.SOTER_APPROVAL_REQUIRED);

    // Invalid session → 401
    const badSession = await post(handler, jrpc("tools/list", undefined, 4), { session: "mcps_nope" });
    assert.equal(badSession.status, 401);
    assert.equal(badSession.body.error.code, RPC.SOTER_SESSION_INVALID);

    // Session bound exceeded → 429
    const overLimit = await post(handler, jrpc("tools/list", undefined, 5));
    assert.equal(overLimit.status, 429);
    assert.equal(overLimit.body.error.code, RPC.SOTER_LIMIT_EXCEEDED);

    // Duplicate in-flight request id → 400 (that one really is a bad request)
    assert.equal(httpStatusForRpcCode(RPC.INVALID_REQUEST), 400);
  } finally {
    upstream.close();
  }

  // Upstream down → 502
  const down = makeHandler({ upstreamUrl: "http://127.0.0.1:1", store: makeStore() });
  const unavailable = await post(down, jrpc("tools/list"));
  assert.equal(unavailable.status, 502);
  assert.equal(unavailable.body.error.code, RPC.SOTER_UPSTREAM_UNAVAILABLE);
});

test("mcp http security 25b: JSON-RPC server-error range maps to a denial status (boundary sweep)", () => {
  // The old condition `code >= -32000 && code <= -32099` is unsatisfiable, so
  // EVERY code fell through to 400. Sweep the whole implementation-defined
  // server-error range to keep that from coming back.
  const expected: Record<number, number> = {
    [RPC.SOTER_BLOCKED]: 403,
    [RPC.SOTER_APPROVAL_REQUIRED]: 403,
    [RPC.SOTER_SESSION_INVALID]: 401,
    [RPC.SOTER_LIMIT_EXCEEDED]: 429,
    [RPC.SOTER_UPSTREAM_UNAVAILABLE]: 502,
  };
  for (let code = -32000; code >= -32099; code -= 1) {
    const status = httpStatusForRpcCode(code);
    assert.equal(
      status,
      expected[code] ?? 403,
      `code ${code} must map to ${expected[code] ?? 403}, got ${status}`,
    );
    assert.notEqual(status, 400, `code ${code} is a server error, not a bad request`);
  }

  // Boundaries: just outside the range, and the reserved pre-defined codes.
  assert.equal(httpStatusForRpcCode(-31999), 400);
  assert.equal(httpStatusForRpcCode(-32100), 400);
  assert.equal(httpStatusForRpcCode(RPC.PARSE_ERROR), 400);
  assert.equal(httpStatusForRpcCode(RPC.INVALID_REQUEST), 400);
  assert.equal(httpStatusForRpcCode(RPC.METHOD_NOT_FOUND), 400);
  assert.equal(httpStatusForRpcCode(RPC.INVALID_PARAMS), 400);
  assert.equal(httpStatusForRpcCode(RPC.INTERNAL_ERROR), 500);
});
