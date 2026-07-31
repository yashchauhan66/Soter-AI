/**
 * Inline MCP gateway proxy.
 *
 * Connects a client transport to an upstream MCP server transport and runs
 * every message through the enforcement engine. `tools/call` is intercepted
 * BEFORE it is forwarded: blocked / held calls are answered with a JSON-RPC
 * error and never reach the upstream server. Harmless protocol traffic
 * (initialize, ping, tools/list, notifications) is passed through, with
 * initialize/tools/list results captured to bind identity and inventory.
 *
 * Reliability: bounded parse, per-call timeout, circuit breaker, duplicate
 * request rejection, graceful shutdown. Fail-closed on the high-impact path.
 */
import {
  parseBounded,
  isJsonRpcMessage,
  isRequest,
  isResponse,
  BoundedParseError,
} from "./jsonrpc";
import { McpEnforcementEngine } from "./engine";
import { RPC, type JsonRpcMessage, type JsonRpcRequest, type McpGatewayLimits } from "./types";
import type { McpGatewayDecision } from "./decision";

export interface RawTransport {
  send(line: string): void;
  onLine(handler: (line: string) => void): void;
  onClose(handler: () => void): void;
  close(): void;
}

type PendingKind = "initialize" | "tools/list" | "tools/call" | "passthrough";

interface Pending {
  kind: PendingKind;
  tool?: string;
  traceId: string;
  timer?: ReturnType<typeof setTimeout>;
}

export interface McpGatewayOptions {
  engine: McpEnforcementEngine;
  client: RawTransport;
  upstream: RawTransport;
  limits: McpGatewayLimits;
  onEvidence?: (decision: McpGatewayDecision) => void;
  now?: () => number;
  traceIdFactory?: () => string;
}

let traceCounter = 0;

export class McpGateway {
  private readonly pending = new Map<string, Pending>();
  private readonly seenClientIds = new Set<string>();
  private closed = false;
  private breakerFailures = 0;
  private breakerOpenUntil = 0;
  private readonly now: () => number;
  private readonly newTraceId: () => string;

  constructor(private readonly opts: McpGatewayOptions) {
    this.now = opts.now ?? (() => Date.now());
    this.newTraceId = opts.traceIdFactory ?? (() => `mcptr_${(traceCounter += 1)}_${this.now()}`);
    opts.client.onLine((line) => this.onClientLine(line));
    opts.upstream.onLine((line) => this.onUpstreamLine(line));
    opts.client.onClose(() => this.shutdown());
    opts.upstream.onClose(() => this.shutdown());
  }

  private emit(decision: McpGatewayDecision): void {
    try {
      this.opts.onEvidence?.(decision);
    } catch {
      /* evidence sink must never break enforcement */
    }
  }

  private toClient(msg: unknown): void {
    if (this.closed) return;
    this.opts.client.send(JSON.stringify(msg));
  }

  private toUpstream(msg: unknown): void {
    if (this.closed) return;
    this.opts.upstream.send(JSON.stringify(msg));
  }

  private clientError(id: unknown, code: number, message: string, data?: unknown): void {
    this.toClient({ jsonrpc: "2.0", id: id ?? null, error: { code, message, ...(data !== undefined ? { data } : {}) } });
  }

  private breakerOpen(): boolean {
    if (this.breakerOpenUntil && this.now() < this.breakerOpenUntil) return true;
    if (this.breakerOpenUntil && this.now() >= this.breakerOpenUntil) {
      // half-open: allow a probe
      this.breakerOpenUntil = 0;
    }
    return false;
  }

  private recordUpstreamFailure(): void {
    this.breakerFailures += 1;
    if (this.breakerFailures >= this.opts.limits.circuitBreakerThreshold) {
      this.breakerOpenUntil = this.now() + this.opts.limits.circuitBreakerCooldownMs;
    }
  }

  private recordUpstreamSuccess(): void {
    this.breakerFailures = 0;
    this.breakerOpenUntil = 0;
  }

  // --- client → gateway ----------------------------------------------------

  private onClientLine(line: string): void {
    if (this.closed) return;
    let parsed: unknown;
    try {
      parsed = parseBounded(line, this.opts.limits.maxMessageBytes, this.opts.limits.maxParseDepth);
    } catch (err) {
      const code = err instanceof BoundedParseError && err.code === "TOO_LARGE" ? RPC.SOTER_LIMIT_EXCEEDED : RPC.PARSE_ERROR;
      this.clientError(null, code, err instanceof Error ? err.message : "parse error");
      return;
    }
    if (!isJsonRpcMessage(parsed)) {
      this.clientError(null, RPC.INVALID_REQUEST, "not a JSON-RPC 2.0 message");
      return;
    }
    const msg = parsed as JsonRpcMessage;

    if (!isRequest(msg)) {
      // notification (or client-side response) — pass through harmless traffic.
      this.toUpstream(msg);
      return;
    }

    const req = msg as JsonRpcRequest;
    const idKey = String(req.id);
    if (this.seenClientIds.has(idKey) && this.pending.has(idKey)) {
      this.clientError(req.id, RPC.INVALID_REQUEST, "duplicate in-flight request id");
      return;
    }

    switch (req.method) {
      case "initialize":
        this.trackAndForward(req, "initialize");
        return;
      case "tools/list":
        this.trackAndForward(req, "tools/list");
        return;
      case "tools/call":
        this.handleToolCall(req);
        return;
      default:
        // ping / resources/* / prompts/* etc. — passthrough with response tracking.
        this.trackAndForward(req, "passthrough");
        return;
    }
  }

  private trackAndForward(req: JsonRpcRequest, kind: PendingKind): void {
    const traceId = this.newTraceId();
    const idKey = String(req.id);
    this.seenClientIds.add(idKey);
    this.pending.set(idKey, { kind, traceId });
    this.toUpstream(req);
  }

  private handleToolCall(req: JsonRpcRequest): void {
    const traceId = this.newTraceId();
    const idKey = String(req.id);
    const result = this.opts.engine.evaluateToolCall(req.params, traceId);
    this.emit(result.decision);

    if (result.outcome !== "FORWARD") {
      // HOLD or REJECT — the call is answered locally and never forwarded.
      const err = result.rpcError ?? { code: RPC.SOTER_BLOCKED, message: "blocked" };
      this.clientError(req.id, err.code, err.message, err.data);
      return;
    }

    // Circuit breaker: if upstream is unhealthy, fail closed rather than hang.
    if (this.breakerOpen()) {
      this.clientError(req.id, RPC.SOTER_UPSTREAM_UNAVAILABLE, "upstream circuit open");
      this.opts.engine.completeCall();
      return;
    }

    this.seenClientIds.add(idKey);
    const timer = setTimeout(() => {
      if (!this.pending.has(idKey)) return;
      this.pending.delete(idKey);
      this.recordUpstreamFailure();
      this.opts.engine.completeCall();
      this.clientError(req.id, RPC.SOTER_UPSTREAM_UNAVAILABLE, "upstream timeout");
    }, this.opts.limits.upstreamTimeoutMs);
    if (typeof (timer as { unref?: () => void }).unref === "function") (timer as { unref: () => void }).unref();

    this.pending.set(idKey, { kind: "tools/call", tool: result.decision.tool, traceId, timer });
    const forwarded: JsonRpcRequest = {
      ...req,
      params: { ...(req.params as Record<string, unknown>), arguments: result.forwardArgs ?? {} },
    };
    this.toUpstream(forwarded);
  }

  // --- upstream → gateway --------------------------------------------------

  private onUpstreamLine(line: string): void {
    if (this.closed) return;
    let parsed: unknown;
    try {
      parsed = parseBounded(line, this.opts.limits.maxMessageBytes, this.opts.limits.maxParseDepth);
    } catch {
      // Malformed upstream frame — drop it (do not forward garbage to client).
      return;
    }
    if (!isJsonRpcMessage(parsed)) return;
    const msg = parsed as JsonRpcMessage;

    if (!isResponse(msg)) {
      // upstream-initiated request/notification (e.g. sampling) — pass through.
      this.toClient(msg);
      return;
    }

    const response = msg as { id: unknown; result?: unknown; error?: unknown };
    const idKey = String(response.id);
    const pending = this.pending.get(idKey);
    if (!pending) {
      this.toClient(msg);
      return;
    }
    this.pending.delete(idKey);
    if (pending.timer) clearTimeout(pending.timer);

    if (pending.kind === "initialize") {
      if (response.error) {
        this.recordUpstreamFailure();
        this.toClient(msg);
        return;
      }
      const bind = this.opts.engine.recordInitialize(response.result);
      if (!bind.ok) {
        this.clientError(response.id, RPC.SOTER_SESSION_INVALID, `server identity rejected: ${bind.reason}`);
        this.shutdown();
        return;
      }
      this.recordUpstreamSuccess();
      this.toClient(msg);
      return;
    }

    if (pending.kind === "tools/list") {
      if (!response.error) this.opts.engine.recordToolInventory(response.result);
      this.recordUpstreamSuccess();
      this.toClient(msg);
      return;
    }

    if (pending.kind === "tools/call") {
      this.opts.engine.completeCall();
      if (response.error) {
        this.recordUpstreamFailure();
        this.toClient(msg);
        return;
      }
      this.recordUpstreamSuccess();
      const inspection = this.opts.engine.inspectToolResult(pending.tool ?? "unknown", response.result, pending.traceId);
      this.emit(inspection.decision);
      this.toClient({ jsonrpc: "2.0", id: response.id, result: inspection.safeResult });
      return;
    }

    // passthrough response
    this.recordUpstreamSuccess();
    this.toClient(msg);
  }

  /** Graceful shutdown: clear timers, close both transports, reject in-flight. */
  shutdown(): void {
    if (this.closed) return;
    this.closed = true;
    for (const [idKey, pending] of this.pending.entries()) {
      if (pending.timer) clearTimeout(pending.timer);
      if (pending.kind === "tools/call") this.opts.engine.completeCall();
      this.clientError(Number.isNaN(Number(idKey)) ? idKey : Number(idKey), RPC.SOTER_UPSTREAM_UNAVAILABLE, "gateway shutting down");
    }
    this.pending.clear();
    try {
      this.opts.upstream.close();
    } catch {
      /* ignore */
    }
    try {
      this.opts.client.close();
    } catch {
      /* ignore */
    }
  }
}
