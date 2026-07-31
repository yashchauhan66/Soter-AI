/**
 * Inline MCP Gateway — public surface.
 *
 * A bounded JSON-RPC proxy that enforces SoterAI policy on MCP `tools/call`
 * before the call reaches the upstream server. See docs/security/mcp-security.md.
 */
export * from "./types";
export * from "./jsonrpc";
export * from "./inspect";
export * from "./approvals";
export * from "./decision";
export * from "./engine";
export * from "./proxy";
export * from "./stdio";
export * from "./config";
export * from "./http";
export * from "./sse";

import { McpEnforcementEngine } from "./engine";
import { McpGateway } from "./proxy";
import { StreamTransport, ChildProcessTransport, type UpstreamSpec } from "./stdio";
import { DEFAULT_LIMITS, type McpGatewayLimits, type McpSessionIdentity } from "./types";
import type { McpGatewayDecision } from "./decision";
import type { ProtectionMode } from "@soterai/guard-core";

export interface StartStdioGatewayOptions {
  identity: McpSessionIdentity;
  upstream: UpstreamSpec;
  limits?: Partial<McpGatewayLimits>;
  protectionMode?: ProtectionMode;
  mcpConfig?: string | Record<string, unknown>;
  onEvidence?: (decision: McpGatewayDecision) => void;
  clientReadable?: NodeJS.ReadableStream;
  clientWritable?: NodeJS.WritableStream;
}

/**
 * Wire a full stdio gateway session: gateway ↔ client on the process stdio,
 * gateway ↔ upstream on a spawned child process. Returns the live gateway.
 */
export function startStdioGateway(opts: StartStdioGatewayOptions): { gateway: McpGateway; engine: McpEnforcementEngine } {
  const limits: McpGatewayLimits = { ...DEFAULT_LIMITS, ...(opts.limits ?? {}) };
  const engine = new McpEnforcementEngine({
    identity: opts.identity,
    limits,
    protectionMode: opts.protectionMode,
    mcpConfig: opts.mcpConfig,
  });
  const client = new StreamTransport(
    opts.clientReadable ?? process.stdin,
    opts.clientWritable ?? process.stdout,
    limits.maxMessageBytes,
  );
  const upstream = new ChildProcessTransport(opts.upstream, limits.maxMessageBytes);
  const gateway = new McpGateway({ engine, client, upstream, limits, onEvidence: opts.onEvidence });
  return { gateway, engine };
}

export { createHttpGatewayHandler, type HttpGatewayOptions, type UpstreamDestination } from "./http";
export { createSseInspectionStream } from "./sse";
