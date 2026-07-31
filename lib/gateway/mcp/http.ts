/**
 * Streamable HTTP transport for the MCP inline gateway.
 *
 * Accepts JSON-RPC 2.0 messages via HTTP POST, routes them through the SHARED
 * `McpEnforcementEngine` (the same one stdio uses — no second policy path),
 * forwards to the upstream MCP server, and returns either a JSON response or
 * an SSE stream.
 *
 * SECURITY CONTRACT (changed 2026-07-30 — see the migration note in
 * docs/SOTERAI-TECHNICAL-SUPREMACY-REPORT.md):
 *
 *  - Identity is derived ONLY from an authenticated SoterAI API key
 *    (`x-soterai-api-key`). The former `x-soterai-tenant` / `-project` /
 *    `-principal` headers are IGNORED — they let any caller assert any
 *    identity. Sending them is rejected so a legacy client fails loudly
 *    instead of silently running with a different identity than it thinks.
 *  - Sessions live in a process-wide store (see `session.ts`), are bound to
 *    the authenticated tenant+project+principal+credential, and are verified
 *    on every request. Unknown / foreign / expired sessions are answered with
 *    ONE indistinguishable error so session existence never leaks.
 *  - The upstream `initialize` exchange is really performed and its real
 *    serverInfo is bound to the session. A later identity or capability change
 *    fails closed and terminates the session.
 *  - `protectionMode` and `mcpConfig` are threaded through, so the same
 *    tools/call receives an equivalent decision on HTTP as on stdio.
 *
 * Transport-level controls: bounded bodies, parse-depth limits, per-session
 * rate + concurrency limits (enforced in the engine), duplicate in-flight id
 * rejection, upstream timeout + cancellation, and safe error mapping.
 */
import { randomUUID } from "crypto";
import { parseBounded, isJsonRpcMessage, isRequest } from "./jsonrpc";
import { RPC, DEFAULT_LIMITS, type McpGatewayLimits, type JsonRpcRequest } from "./types";
import type { McpGatewayDecision } from "./decision";
import { buildMcpDecision } from "./decision";
import {
  getSessionStore,
  McpSessionStore,
  type AuthenticatedPrincipal,
  type McpHttpSession,
} from "./session";
import { createSseInspectionStream } from "./sse";
import type { ProtectionMode } from "@soterai/guard-core";

export interface UpstreamDestination {
  /** HTTP URL of the upstream MCP server */
  url: string;
  /** Optional headers to forward to upstream */
  headers?: Record<string, string>;
  /** Optional timeout for upstream requests */
  timeoutMs?: number;
}

/** Result of authenticating a request. Injectable so tests need no database. */
export type AuthResult =
  | { ok: true; principal: AuthenticatedPrincipal }
  | { ok: false; status: number; message: string };

export interface HttpGatewayOptions {
  upstream: UpstreamDestination;
  limits?: Partial<McpGatewayLimits>;
  onEvidence?: (decision: McpGatewayDecision) => void;
  now?: () => number;
  defaultPermissions?: string[];
  defaultRoots?: string[];
  protectionMode?: ProtectionMode;
  mcpConfig?: string | Record<string, unknown>;
  /** Expected upstream server id; verified against the real initialize result. */
  expectedServerId?: string;
  /** Authenticate a request. Defaults to SoterAI API-key verification. */
  authenticate?: (request: Request) => Promise<AuthResult>;
  /**
   * Session store. Defaults to the process-wide singleton. Tests inject an
   * isolated store so they never share state.
   */
  store?: McpSessionStore;
  maxSessions?: number;
  idleTtlMs?: number;
}

const MAX_REQUEST_BYTES = 1_000_000;
const MAX_PARSE_DEPTH = 64;

/** Client headers that used to carry identity. Now forbidden, never trusted. */
const FORBIDDEN_IDENTITY_HEADERS = [
  "x-soterai-tenant",
  "x-soterai-project",
  "x-soterai-principal",
];

const SESSION_HEADER = "mcp-session-id";
/** Legacy alias accepted for session continuity only (carries no identity). */
const LEGACY_SESSION_HEADER = "x-soterai-session-id";

const SUPPORTED_PROTOCOL_VERSIONS = new Set(["2024-11-05", "2025-03-26", "2025-06-18"]);

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Default authentication: verify the SoterAI API key and derive identity from
 * the authenticated project. Imported lazily so this module stays usable (and
 * testable) without a database connection.
 */
async function defaultAuthenticate(request: Request): Promise<AuthResult> {
  const key = request.headers.get("x-soterai-api-key");
  const { verifyApiKey } = await import("../../apiKey");
  const verified = await verifyApiKey(key);
  if (!verified.ok) {
    return { ok: false, status: verified.status, message: verified.message };
  }
  const { apiKey, project } = verified;
  return {
    ok: true,
    principal: {
      tenantId: project.organizationId ?? project.id,
      projectId: project.id,
      // An API key is a non-interactive credential, so the acting principal is
      // an agent rather than a human (PrincipalType has no "service" member).
      principalType: "agent",
      principalId: apiKey.id,
      apiKeyId: apiKey.id,
    },
  };
}

/**
 * Create the HTTP gateway handler.
 *
 * The handler is created ONCE per process (the route module holds it) — never
 * per request. Session state and the single cleanup timer live in the store.
 */
export function createHttpGatewayHandler(
  opts: HttpGatewayOptions,
): ((request: Request) => Promise<Response>) & { store: McpSessionStore } {
  const limits: McpGatewayLimits = { ...DEFAULT_LIMITS, ...(opts.limits ?? {}) };
  const authenticate = opts.authenticate ?? defaultAuthenticate;
  const storeOptions = {
    limits,
    protectionMode: opts.protectionMode,
    mcpConfig: opts.mcpConfig,
    defaultPermissions: opts.defaultPermissions,
    defaultRoots: opts.defaultRoots,
    expectedServerId: opts.expectedServerId,
    maxSessions: opts.maxSessions,
    idleTtlMs: opts.idleTtlMs,
    now: opts.now,
  };
  const store = opts.store ?? getSessionStore(storeOptions);

  const handler = async function handleMcpHttp(request: Request): Promise<Response> {
    const traceId = `mcphttp_${randomUUID()}`;

    // ── 1. Method + content type ──
    if (request.method !== "POST") {
      return jsonError(405, "only POST is supported", traceId);
    }
    const ct = request.headers.get("content-type") ?? "";
    if (!ct.includes("application/json")) {
      return jsonError(415, "content-type must be application/json", traceId);
    }

    // ── 2. Reject forged identity headers (fail loudly, never silently) ──
    const forged = FORBIDDEN_IDENTITY_HEADERS.filter((h) => request.headers.has(h));
    if (forged.length > 0) {
      return jsonError(
        400,
        `identity headers are no longer accepted (${forged.join(", ")}); identity is derived from x-soterai-api-key`,
        traceId,
      );
    }

    // ── 3. Authenticate — fail closed ──
    const auth = await authenticate(request);
    if (!auth.ok) {
      return jsonError(auth.status, `SoterAI authentication failed: ${auth.message}`, traceId);
    }
    const principal = auth.principal;

    // ── 4. Protocol version (when asserted) ──
    const protocolVersion = request.headers.get("mcp-protocol-version");
    if (protocolVersion && !SUPPORTED_PROTOCOL_VERSIONS.has(protocolVersion)) {
      return jsonError(400, `unsupported MCP protocol version: ${protocolVersion}`, traceId);
    }

    // ── 5. Bounded body read ──
    let rawBody: string;
    try {
      rawBody = await request.text();
    } catch {
      return jsonError(400, "failed to read request body", traceId);
    }
    if (Buffer.byteLength(rawBody, "utf8") > MAX_REQUEST_BYTES) {
      return jsonError(413, `request body exceeds ${MAX_REQUEST_BYTES} bytes`, traceId);
    }

    // ── 6. Parse JSON-RPC ──
    let parsed: unknown;
    try {
      parsed = parseBounded(rawBody, MAX_REQUEST_BYTES, MAX_PARSE_DEPTH);
    } catch {
      return jsonRpcErrorResponse(null, RPC.PARSE_ERROR, "invalid JSON", traceId);
    }
    if (!isJsonRpcMessage(parsed)) {
      return jsonRpcErrorResponse(null, RPC.INVALID_REQUEST, "not a valid JSON-RPC 2.0 message", traceId);
    }
    if (!isRequest(parsed)) {
      return jsonRpcErrorResponse(null, RPC.INVALID_REQUEST, "only requests (with id) are supported", traceId);
    }
    const msg = parsed as JsonRpcRequest;

    // ── 7. Session resolution (authenticated ownership) ──
    const sessionId =
      request.headers.get(SESSION_HEADER) ?? request.headers.get(LEGACY_SESSION_HEADER);

    let session: McpHttpSession;
    if (sessionId) {
      const lookup = store.resolve(sessionId, principal);
      if (!lookup.ok) {
        // ONE response for unknown / foreign / expired. Distinguishing them
        // would let a caller probe for other tenants' session ids.
        return jsonRpcErrorResponse(msg.id, RPC.SOTER_SESSION_INVALID, "invalid or expired session", traceId);
      }
      session = lookup.session;
    } else {
      const created = store.create(principal);
      if (!created.ok) {
        return jsonRpcErrorResponse(msg.id, RPC.SOTER_LIMIT_EXCEEDED, "max concurrent sessions reached", traceId);
      }
      session = created.session;
    }

    // ── 8. Duplicate in-flight request id ──
    const idKey = String(msg.id);
    if (session.inFlight.has(idKey)) {
      return jsonRpcErrorResponse(msg.id, RPC.INVALID_REQUEST, "duplicate in-flight request id", traceId, undefined, session.id);
    }
    session.inFlight.add(idKey);

    // ── 9. Route through the shared engine ──
    try {
      switch (msg.method) {
        case "initialize":
          return await handleInitialize(session, msg, opts, store, traceId);
        case "tools/list":
          return await handleToolsList(session, msg, opts, traceId);
        case "tools/call":
          return await handleToolCall(session, msg, opts, request, traceId);
        default:
          return await handlePassthrough(session, msg, opts, traceId);
      }
    } catch (err) {
      // Never leak internals; the high-impact path already failed closed in the engine.
      return jsonRpcErrorResponse(
        msg.id,
        RPC.INTERNAL_ERROR,
        `gateway error: ${(err as Error).name}`.slice(0, 200),
        traceId,
        undefined,
        session.id,
      );
    } finally {
      session.inFlight.delete(idKey);
    }
  };

  return Object.assign(handler, { store });
}

// ---------------------------------------------------------------------------
// Method handlers
// ---------------------------------------------------------------------------

/**
 * Perform the REAL initialize exchange with the upstream server and bind its
 * true identity to the session.
 *
 * The previous implementation fabricated `{ name: "http-gateway" }` and fed it
 * to the engine, so `recordInitialize` compared a made-up name against itself
 * and identity binding was meaningless. Now the upstream's actual serverInfo
 * is what gets bound, and a mismatch terminates the session.
 */
async function handleInitialize(
  session: McpHttpSession,
  msg: JsonRpcRequest,
  opts: HttpGatewayOptions,
  store: McpSessionStore,
  traceId: string,
): Promise<Response> {
  const upstream = await forwardToUpstream(msg, opts);
  if (upstream.error) {
    return jsonRpcErrorResponse(msg.id, RPC.SOTER_UPSTREAM_UNAVAILABLE, upstream.error.message, traceId, undefined, session.id);
  }

  const bind = session.engine.recordInitialize(upstream.result);
  if (!bind.ok) {
    // Fail closed: quarantine, drop the session, emit privacy-safe evidence.
    store.terminate(session.id);
    emitEvidence(opts, buildIdentityEvidence(session, bind.reason ?? "IDENTITY_REJECTED", traceId));
    return jsonRpcErrorResponse(
      msg.id,
      RPC.SOTER_SESSION_INVALID,
      `server identity rejected: ${bind.reason}`,
      traceId,
    );
  }

  return jsonRpcSuccess(msg.id, upstream.result, traceId, session.id);
}

async function handleToolsList(
  session: McpHttpSession,
  msg: JsonRpcRequest,
  opts: HttpGatewayOptions,
  traceId: string,
): Promise<Response> {
  const upstream = await forwardToUpstream(msg, opts);
  if (upstream.error) {
    return jsonRpcErrorResponse(msg.id, RPC.SOTER_UPSTREAM_UNAVAILABLE, upstream.error.message, traceId, undefined, session.id);
  }
  // Persisted on the session engine, so UNDECLARED_TOOL works on later requests.
  session.engine.recordToolInventory(upstream.result);
  return jsonRpcSuccess(msg.id, upstream.result, traceId, session.id);
}

async function handleToolCall(
  session: McpHttpSession,
  msg: JsonRpcRequest,
  opts: HttpGatewayOptions,
  request: Request,
  traceId: string,
): Promise<Response> {
  // Pre-execution enforcement — identical call as stdio and SSE.
  const evalResult = session.engine.evaluateToolCall(msg.params, traceId);
  emitEvidence(opts, evalResult.decision);

  if (evalResult.outcome !== "FORWARD") {
    const rpcError = evalResult.rpcError ?? { code: RPC.SOTER_BLOCKED, message: "blocked" };
    return jsonRpcErrorResponse(msg.id, rpcError.code, rpcError.message, traceId, rpcError.data, session.id);
  }

  const forwardMsg: JsonRpcRequest = {
    ...msg,
    params: {
      ...(isPlainObject(msg.params) ? msg.params : {}),
      arguments: evalResult.forwardArgs ?? {},
    },
  };
  const toolName = (isPlainObject(msg.params) ? msg.params.name : undefined) as string | undefined;

  // Client asked for a stream: hand the upstream body to the shared SSE
  // inspector, which runs the same engine result-inspection path.
  const wantsStream = (request.headers.get("accept") ?? "").includes("text/event-stream");
  if (wantsStream) {
    return await handleStreamingToolCall(session, forwardMsg, opts, toolName ?? "unknown", traceId, request);
  }

  try {
    const upstream = await forwardToUpstream(forwardMsg, opts);
    if (upstream.error) {
      session.engine.completeCall();
      return jsonRpcErrorResponse(msg.id, RPC.SOTER_UPSTREAM_UNAVAILABLE, upstream.error.message, traceId, undefined, session.id);
    }
    session.engine.completeCall();

    const inspection = session.engine.inspectToolResult(toolName ?? "unknown", upstream.result, traceId);
    emitEvidence(opts, inspection.decision);
    return jsonRpcSuccess(msg.id, inspection.safeResult, traceId, session.id);
  } catch (err) {
    session.engine.completeCall();
    return jsonRpcErrorResponse(msg.id, RPC.SOTER_UPSTREAM_UNAVAILABLE, `upstream error: ${(err as Error).name}`, traceId, undefined, session.id);
  }
}

/** Streamable-HTTP/SSE tool call: enforcement already ran; stream the result. */
async function handleStreamingToolCall(
  session: McpHttpSession,
  forwardMsg: JsonRpcRequest,
  opts: HttpGatewayOptions,
  tool: string,
  traceId: string,
  request: Request,
): Promise<Response> {
  const controller = new AbortController();
  // Propagate client disconnect so the upstream call is actually cancelled.
  request.signal?.addEventListener("abort", () => controller.abort(), { once: true });
  const timeout = setTimeout(
    () => controller.abort(),
    opts.upstream.timeoutMs ?? DEFAULT_LIMITS.upstreamTimeoutMs,
  );

  try {
    const response = await fetch(opts.upstream.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "text/event-stream",
        ...opts.upstream.headers,
      },
      body: JSON.stringify(forwardMsg),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok || !response.body) {
      session.engine.completeCall();
      return jsonRpcErrorResponse(
        forwardMsg.id,
        RPC.SOTER_UPSTREAM_UNAVAILABLE,
        "upstream stream unavailable",
        traceId,
        undefined,
        session.id,
      );
    }

    const stream = createSseInspectionStream(response.body, tool, traceId, {
      engine: session.engine,
      limits: opts.limits,
      onEvidence: opts.onEvidence,
      protectionMode: opts.protectionMode,
      identity: {
        projectId: session.identity.projectId,
        organizationId: session.identity.tenantId,
        userId: session.identity.principalId,
        sessionId: session.identity.clientId,
      },
      onComplete: () => session.engine.completeCall(),
      onCancelUpstream: () => controller.abort(),
    });

    return new Response(stream, {
      status: 200,
      headers: {
        "content-type": "text/event-stream",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
        "x-soter-trace-id": traceId,
        [SESSION_HEADER]: session.id,
      },
    });
  } catch (err) {
    clearTimeout(timeout);
    session.engine.completeCall();
    return jsonRpcErrorResponse(
      forwardMsg.id,
      RPC.SOTER_UPSTREAM_UNAVAILABLE,
      `upstream error: ${(err as Error).name}`,
      traceId,
      undefined,
      session.id,
    );
  }
}

async function handlePassthrough(
  session: McpHttpSession,
  msg: JsonRpcRequest,
  opts: HttpGatewayOptions,
  traceId: string,
): Promise<Response> {
  const upstream = await forwardToUpstream(msg, opts);
  if (upstream.error) {
    return jsonRpcErrorResponse(msg.id, RPC.SOTER_UPSTREAM_UNAVAILABLE, upstream.error.message, traceId, undefined, session.id);
  }
  return jsonRpcSuccess(msg.id, upstream.result, traceId, session.id);
}

// ---------------------------------------------------------------------------
// Upstream
// ---------------------------------------------------------------------------

interface UpstreamResponse {
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

async function forwardToUpstream(msg: JsonRpcRequest, opts: HttpGatewayOptions): Promise<UpstreamResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.upstream.timeoutMs ?? DEFAULT_LIMITS.upstreamTimeoutMs);

  try {
    const response = await fetch(opts.upstream.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        ...opts.upstream.headers,
      },
      body: JSON.stringify(msg),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return { error: { code: RPC.SOTER_UPSTREAM_UNAVAILABLE, message: `upstream status ${response.status}` } };
    }

    const body = (await response.json()) as Record<string, unknown>;
    if (!body || typeof body !== "object") {
      return { error: { code: RPC.INTERNAL_ERROR, message: "upstream returned non-object" } };
    }
    if (body.error) {
      return { error: { code: RPC.INTERNAL_ERROR, message: "upstream returned an error", data: body.error } };
    }
    return { result: "result" in body ? body.result : body };
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof Error && err.name === "AbortError") {
      return { error: { code: RPC.SOTER_UPSTREAM_UNAVAILABLE, message: "upstream timeout" } };
    }
    return { error: { code: RPC.SOTER_UPSTREAM_UNAVAILABLE, message: (err as Error).name } };
  }
}

function emitEvidence(opts: HttpGatewayOptions, decision: McpGatewayDecision): void {
  try {
    opts.onEvidence?.(decision);
  } catch {
    /* evidence must never break enforcement */
  }
}

/** Privacy-safe evidence for an upstream identity rejection. */
function buildIdentityEvidence(
  session: McpHttpSession,
  reason: string,
  traceId: string,
): McpGatewayDecision {
  return buildMcpDecision({
    decision: "BLOCK",
    riskScore: 100,
    identity: {
      projectId: session.identity.projectId,
      organizationId: session.identity.tenantId,
      userId: session.identity.principalId,
      sessionId: session.identity.clientId,
    },
    server: session.identity.serverId || "unknown",
    tool: "initialize",
    transport: `mcp-http:${session.identity.serverId || "unknown"}`,
    argsFingerprint: "af_none",
    reason: `upstream server identity rejected: ${reason}`,
    policyVersion: session.engine.policyVersion,
    traceId,
    direction: "INPUT",
    enforcement: "ENFORCED",
    evidence: {
      reasonCodes: [reason],
      categories: ["MCP_SERVER_IDENTITY"],
      findingSummaries: [],
      redactedArgsPreview: "",
    },
  });
}

// ---------------------------------------------------------------------------
// Response helpers
// ---------------------------------------------------------------------------

/**
 * Map a JSON-RPC error code to an HTTP status.
 *
 * The previous condition `code >= -32000 && code <= -32099` was unsatisfiable
 * (no number is both ≥ -32000 and ≤ -32099), so every policy denial returned
 * 400. SoterAI policy codes live in -32001..-32005; the JSON-RPC
 * implementation-defined server-error range is -32000..-32099.
 */
export function httpStatusForRpcCode(code: number): number {
  switch (code) {
    case RPC.SOTER_BLOCKED:
    case RPC.SOTER_APPROVAL_REQUIRED:
      return 403;
    case RPC.SOTER_SESSION_INVALID:
      return 401;
    case RPC.SOTER_LIMIT_EXCEEDED:
      return 429;
    case RPC.SOTER_UPSTREAM_UNAVAILABLE:
      return 502;
    default:
      break;
  }
  // Any other implementation-defined server error.
  if (code <= -32000 && code >= -32099) return 403;
  if (code === RPC.INTERNAL_ERROR) return 500;
  return 400;
}

function jsonError(status: number, message: string, traceId: string): Response {
  return new Response(JSON.stringify({ error: { message, traceId } }), {
    status,
    headers: { "content-type": "application/json", "x-soter-trace-id": traceId },
  });
}

function jsonRpcSuccess(id: unknown, result: unknown, traceId: string, sessionId?: string): Response {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-soter-trace-id": traceId,
  };
  if (sessionId) headers[SESSION_HEADER] = sessionId;
  return new Response(JSON.stringify({ jsonrpc: "2.0", id, result }), { status: 200, headers });
}

function jsonRpcErrorResponse(
  id: unknown,
  code: number,
  message: string,
  traceId: string,
  data?: unknown,
  sessionId?: string,
): Response {
  const body: Record<string, unknown> = { jsonrpc: "2.0", id: id ?? null, error: { code, message } };
  if (data !== undefined) (body.error as Record<string, unknown>).data = data;
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-soter-trace-id": traceId,
  };
  if (sessionId) headers[SESSION_HEADER] = sessionId;
  return new Response(JSON.stringify(body), { status: httpStatusForRpcCode(code), headers });
}
