/**
 * Inline MCP Gateway — shared types.
 *
 * These describe the bounded JSON-RPC proxy that sits between an MCP client
 * and an upstream MCP server and enforces SoterAI policy on `tools/call`
 * BEFORE the call reaches the server. Nothing here executes tools; the proxy
 * mechanically decides forward / redact / hold / block per message.
 */
import type { MCPPermission } from "@soterai/guard-core";
import type { CanonicalDecision } from "../decision";

// ---------------------------------------------------------------------------
// JSON-RPC 2.0 (MCP wire format)
// ---------------------------------------------------------------------------

export type JsonRpcId = string | number | null;

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: JsonRpcId;
  method: string;
  params?: unknown;
}

export interface JsonRpcNotification {
  jsonrpc: "2.0";
  method: string;
  params?: unknown;
}

export interface JsonRpcSuccess {
  jsonrpc: "2.0";
  id: JsonRpcId;
  result: unknown;
}

export interface JsonRpcErrorObject {
  code: number;
  message: string;
  data?: unknown;
}

export interface JsonRpcError {
  jsonrpc: "2.0";
  id: JsonRpcId;
  error: JsonRpcErrorObject;
}

export type JsonRpcMessage =
  | JsonRpcRequest
  | JsonRpcNotification
  | JsonRpcSuccess
  | JsonRpcError;

/** JSON-RPC + MCP-gateway specific error codes. */
export const RPC = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  /** SoterAI: policy blocked the call before upstream execution. */
  SOTER_BLOCKED: -32001,
  /** SoterAI: human approval required; call was not forwarded. */
  SOTER_APPROVAL_REQUIRED: -32002,
  /** SoterAI: session/identity invalid, expired, revoked or quarantined. */
  SOTER_SESSION_INVALID: -32003,
  /** SoterAI: request exceeded a reliability bound. */
  SOTER_LIMIT_EXCEEDED: -32004,
  /** SoterAI: upstream MCP server failed / timed out / circuit open. */
  SOTER_UPSTREAM_UNAVAILABLE: -32005,
} as const;

// ---------------------------------------------------------------------------
// Session identity & binding
// ---------------------------------------------------------------------------

export type PrincipalType = "human" | "agent";

/**
 * Immutable binding for a single gateway session. Established at startup from
 * the SoterAI session token / gateway config and never widened at runtime.
 */
export interface McpSessionIdentity {
  tenantId: string;
  projectId: string;
  clientId: string;
  principalType: PrincipalType;
  principalId: string;
  /** Expected upstream MCP server identity (name/fingerprint). */
  serverId: string;
  /** Capabilities the session is permitted to use (least privilege). */
  allowedPermissions?: MCPPermission[];
  /** Filesystem roots the session may touch (absolute, normalized). */
  allowedRoots?: string[];
  /** Session expiry (epoch ms). */
  expiresAt: number;
  revoked?: boolean;
}

// ---------------------------------------------------------------------------
// Reliability & security bounds
// ---------------------------------------------------------------------------

export interface McpGatewayLimits {
  maxMessageBytes: number;
  maxParseDepth: number;
  maxArgsBytes: number;
  maxResultBytes: number;
  upstreamTimeoutMs: number;
  maxConcurrentCalls: number;
  rateLimitPerMinute: number;
  /** Consecutive upstream failures before the breaker opens (fail-closed). */
  circuitBreakerThreshold: number;
  /** How long the breaker stays open before a half-open probe (ms). */
  circuitBreakerCooldownMs: number;
}

export const DEFAULT_LIMITS: McpGatewayLimits = {
  maxMessageBytes: 1_000_000,
  maxParseDepth: 64,
  maxArgsBytes: 256_000,
  maxResultBytes: 1_000_000,
  upstreamTimeoutMs: 30_000,
  maxConcurrentCalls: 32,
  rateLimitPerMinute: 600,
  circuitBreakerThreshold: 5,
  circuitBreakerCooldownMs: 10_000,
};

// ---------------------------------------------------------------------------
// Decision surface (canonical contract lives in ../decision)
// ---------------------------------------------------------------------------

export type McpEnforcementOutcome =
  | "FORWARD" // forward (possibly redacted/transformed args) to upstream
  | "HOLD" // do not forward; approval required
  | "REJECT" // do not forward; blocked/quarantined
  | "PASSTHROUGH"; // harmless protocol traffic, forwarded verbatim

export interface McpCallDecisionResult {
  outcome: McpEnforcementOutcome;
  decision: import("./decision").McpGatewayDecision;
  /** Args to forward when outcome is FORWARD (may be redacted). */
  forwardArgs?: Record<string, unknown>;
  /** JSON-RPC error to return to the client when HOLD/REJECT. */
  rpcError?: JsonRpcErrorObject;
}

export interface McpResultDecisionResult {
  outcome: "RELEASE" | "REDACT" | "BLOCK" | "QUARANTINE";
  decision: import("./decision").McpGatewayDecision;
  /** Result payload to return to the client (may be redacted/replaced). */
  safeResult: unknown;
}

/** Canonical verb re-export for convenience. */
export type { CanonicalDecision };
