/**
 * MCP Gateway — Configuration types and defaults.
 *
 * Defines the configuration interface for the inline MCP enforcement gateway.
 * All settings have safe defaults; only `upstreamEndpoint` is required.
 */

import type { MCPEndpoint, MCPTransport } from "./MCPJsonRpcTypes";

export interface MCPGatewayConfig {
  /**
   * The upstream MCP server endpoint to proxy to.
   * For stdio: command + args.
   * For http/sse: URL.
   */
  upstreamEndpoint: MCPEndpoint;

  /**
   * The transport the gateway listens on for client connections.
   * Default: http on 127.0.0.1:47322
   */
  listenEndpoint?: MCPEndpoint;

  /**
   * Authentication token required for client connections.
   * If empty, authentication is disabled (not recommended for production).
   */
  authToken?: string;

  /**
   * Tenant identifier for tenant isolation.
   */
  tenant?: string;

  /**
   * Project identifier for project isolation.
   */
  project?: string;

  /**
   * Client identifier for identity binding.
   */
  clientId?: string;

  /**
   * Maximum JSON-RPC request body size in bytes.
   * Default: 1MB
   */
  maxBodyBytes?: number;

  /**
   * Maximum individual argument value length in characters.
   * Default: 100000
   */
  maxArgLength?: number;

  /**
   * Maximum number of concurrent sessions.
   * Default: 100
   */
  maxConcurrentSessions?: number;

  /**
   * Session TTL in milliseconds.
   * Default: 30 minutes
   */
  sessionTtlMs?: number;

  /**
   * Request timeout in milliseconds.
   * Default: 60 seconds
   */
  requestTimeoutMs?: number;

  /**
   * Rate limit: max requests per minute per client.
   * Default: 120
   */
  rateLimitPerMinute?: number;

  /**
   * Circuit breaker: consecutive failures before opening.
   * Default: 5
   */
  circuitBreakerThreshold?: number;

  /**
   * Circuit breaker: cooldown in milliseconds before half-open.
   * Default: 30 seconds
   */
  circuitBreakerCooldownMs?: number;

  /**
   * Protection mode for the RuntimePolicyEngine.
   * Default: "standard"
   */
  protectionMode?: "observe" | "standard" | "strict" | "enterprise_locked" | "air_gapped";

  /**
   * Policy version string for evidence tracking.
   */
  policyVersion?: string;

  /**
   * Whether to enable tool result inspection.
   * Default: true
   */
  inspectResults?: boolean;

  /**
   * Whether to enable approval workflow for high-risk tools.
   * Default: true
   */
  enableApprovals?: boolean;

  /**
   * Maximum result content size in bytes before truncation.
   * Default: 500KB
   */
  maxResultBytes?: number;

  /**
   * Enable safe diagnostic logging.
   * Default: false
   */
  debug?: boolean;

  /**
   * Fail-closed behaviour: if true, policy/parsing failures block the call.
   * If false, failures cause a DENY/ABSTAIN with documented bypass.
   * Default: true (fail-closed for identity/policy, fail-open for scanner crashes)
   */
  failClosed?: boolean;

  /**
   * Custom fallback message for blocked tool calls.
   */
  blockedToolMessage?: string;
}

export const DEFAULT_GATEWAY_CONFIG: Omit<MCPGatewayConfig, "upstreamEndpoint"> = {
  listenEndpoint: {
    transport: "http",
    address: "127.0.0.1:47322",
  },
  maxBodyBytes: 1_048_576, // 1MB
  maxArgLength: 100_000,
  maxConcurrentSessions: 100,
  sessionTtlMs: 30 * 60 * 1000, // 30 minutes
  requestTimeoutMs: 60_000, // 60 seconds
  rateLimitPerMinute: 120,
  circuitBreakerThreshold: 5,
  circuitBreakerCooldownMs: 30_000, // 30 seconds
  protectionMode: "standard",
  policyVersion: "mcp-gateway-v1",
  inspectResults: true,
  enableApprovals: true,
  maxResultBytes: 512_000, // 500KB
  debug: false,
  failClosed: true,
  blockedToolMessage: "Tool call blocked by SoterAI MCP Gateway: the operation was denied by your organization's security policy.",
};

/**
 * Default blocked tool result content for BLOCK/QUARANTINE decisions.
 */
export function defaultBlockedResult(message?: string): { content: Array<{ type: "text"; text: string }>; isError: boolean } {
  return {
    content: [
      {
        type: "text",
        text: message ?? DEFAULT_GATEWAY_CONFIG.blockedToolMessage ?? "Tool call blocked by SoterAI MCP Gateway",
      },
    ],
    isError: true,
  };
}
