/**
 * MCP Gateway — JSON-RPC 2.0 and Model Context Protocol type definitions.
 *
 * This file defines the wire types for:
 * - JSON-RPC 2.0 messages (request, notification, response, error)
 * - MCP protocol messages (initialize, tools/list, tools/call, etc.)
 * - Gateway-specific session and enforcement types
 *
 * The MCP specification reference: https://spec.modelcontextprotocol.io/
 */

// ─── JSON-RPC 2.0 Base Types ───────────────────────────────────────────────

export type JsonRpcId = string | number | null;

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  method: string;
  params?: unknown;
  id: JsonRpcId;
}

export interface JsonRpcNotification {
  jsonrpc: "2.0";
  method: string;
  params?: unknown;
  /** Notifications have no id field. */
}

export interface JsonRpcSuccessResponse {
  jsonrpc: "2.0";
  id: JsonRpcId;
  result: unknown;
}

export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

export interface JsonRpcErrorResponse {
  jsonrpc: "2.0";
  id: JsonRpcId;
  error: JsonRpcError;
}

export type JsonRpcMessage =
  | JsonRpcRequest
  | JsonRpcNotification
  | JsonRpcSuccessResponse
  | JsonRpcErrorResponse;

// ─── Standard JSON-RPC Error Codes ─────────────────────────────────────────

export const JSON_RPC_ERRORS = {
  PARSE_ERROR: { code: -32700, message: "Parse error" },
  INVALID_REQUEST: { code: -32600, message: "Invalid request" },
  METHOD_NOT_FOUND: { code: -32601, message: "Method not found" },
  INVALID_PARAMS: { code: -32602, message: "Invalid params" },
  INTERNAL_ERROR: { code: -32603, message: "Internal error" },
} as const;

// ─── MCP Protocol Types ────────────────────────────────────────────────────

/** MCP protocol version string. */
export const MCP_PROTOCOL_VERSION = "2025-03-26";

/** Supported protocol methods. */
export type MCPMethod =
  | "initialize"
  | "ping"
  | "tools/list"
  | "tools/call"
  | "resources/list"
  | "resources/read"
  | "prompts/list"
  | "prompts/get"
  | "notifications/initialized"
  | "notifications/cancelled"
  | "logging/setLevel"
  | "completion/complete";

export const SUPPORTED_MCP_METHODS: ReadonlySet<string> = new Set([
  "initialize",
  "ping",
  "tools/list",
  "tools/call",
  "resources/list",
  "resources/read",
  "prompts/list",
  "prompts/get",
  "notifications/initialized",
  "notifications/cancelled",
  "logging/setLevel",
  "completion/complete",
]);

/** Methods that require enforcement (interception before execution). */
export const ENFORCED_MCP_METHODS: ReadonlySet<string> = new Set([
  "tools/call",
]);

/** Methods that are forwarded without enforcement (pass-through). */
export const PASSTHROUGH_MCP_METHODS: ReadonlySet<string> = new Set([
  "initialize",
  "ping",
  "tools/list",
  "resources/list",
  "resources/read",
  "prompts/list",
  "prompts/get",
  "logging/setLevel",
  "completion/complete",
]);

// ─── MCP Initialize ─────────────────────────────────────────────────────────

export interface ClientCapabilities {
  roots?: { listChanged?: boolean };
  sampling?: unknown;
  experimental?: Record<string, unknown>;
}

export interface ServerCapabilities {
  tools?: { listChanged?: boolean };
  resources?: { subscribe?: boolean; listChanged?: boolean };
  prompts?: { listChanged?: boolean };
  logging?: unknown;
  experimental?: Record<string, unknown>;
}

export interface InitializeParams {
  protocolVersion: string;
  capabilities: ClientCapabilities;
  clientInfo: { name: string; version: string };
}

export interface InitializeResult {
  protocolVersion: string;
  capabilities: ServerCapabilities;
  serverInfo: { name: string; version: string };
}

// ─── MCP Tools ──────────────────────────────────────────────────────────────

export interface ToolInputSchema {
  type: "object";
  properties?: Record<string, unknown>;
  required?: string[];
}

export interface ToolDefinition {
  name: string;
  description?: string;
  inputSchema: ToolInputSchema;
}

export interface ToolsListResult {
  tools: ToolDefinition[];
}

export interface ToolCallParams {
  name: string;
  arguments?: Record<string, unknown>;
}

export interface ToolCallResult {
  content: Array<ToolResultContent>;
  isError?: boolean;
}

export interface ToolResultContent {
  type: "text" | "image" | "resource" | "embedded";
  text?: string;
  mimeType?: string;
  data?: string;
  uri?: string;
  resource?: {
    uri: string;
    mimeType?: string;
    text?: string;
    blob?: string;
  };
}

// ─── Gateway Enforcement Types ──────────────────────────────────────────────

export type GatewayEnforcement =
  | "ALLOW"
  | "REDACT"
  | "TRANSFORM"
  | "REQUIRE_APPROVAL"
  | "BLOCK"
  | "QUARANTINE";

export interface GatewayDecision {
  enforcement: GatewayEnforcement;
  riskScore: number;
  confidence: number;
  reason: string;
  policyVersion: string;
  traceId: string;
  redactedArgs?: Record<string, unknown>;
  redactedResult?: ToolCallResult;
}

// ─── Transport Types ────────────────────────────────────────────────────────

export type MCPTransport = "stdio" | "http" | "sse";

export interface MCPEndpoint {
  transport: MCPTransport;
  /** For stdio: the command to execute. For http/sse: the URL. */
  address: string;
  /** Args for stdio transport. */
  args?: string[];
  /** Environment variables for stdio transport. */
  env?: Record<string, string>;
}

// ─── Session Types ──────────────────────────────────────────────────────────

export interface MCPClientIdentity {
  tenant: string;
  project: string;
  clientId: string;
  userId?: string;
  agentId?: string;
}

export interface MCPSession {
  id: string;
  clientIdentity: MCPClientIdentity;
  serverEndpoint: MCPEndpoint;
  serverCapabilities?: ServerCapabilities;
  serverIdentity?: string;
  protocolVersion?: string;
  state: "initializing" | "active" | "closing" | "closed";
  createdAt: number;
  expiresAt: number;
  lastActivityAt: number;
  toolInventory?: ToolDefinition[];
  negotiatedCapabilities: Set<string>;
}

// ─── Approval Types ─────────────────────────────────────────────────────────

export interface ApprovalRequest {
  id: string;
  sessionId: string;
  toolName: string;
  argsFingerprint: string;
  displayArgs: Record<string, unknown>;
  tenant: string;
  project: string;
  clientId: string;
  userId?: string;
  traceId: string;
  riskScore: number;
  reason: string;
  createdAt: number;
  expiresAt: number;
  status: "pending" | "approved" | "denied" | "expired" | "revoked";
  approvedBy?: string;
  approvedAt?: number;
  scope: "once" | "session" | "tenant";
  consumed: boolean;
}

// ─── Evidence Types ─────────────────────────────────────────────────────────

export interface ToolCallEvidence {
  traceId: string;
  sessionId: string;
  tenant: string;
  project: string;
  clientId: string;
  userId?: string;
  agentId?: string;
  serverIdentity: string;
  toolName: string;
  argCategories: string[];
  riskScore: number;
  enforcement: GatewayEnforcement;
  reason: string;
  policyVersion: string;
  serverCapabilities: string[];
  decisionTimestamp: string;
  executionTimestamp?: string;
  resultRiskScore?: number;
  resultEnforcement?: GatewayEnforcement;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

export function isJsonRpcRequest(msg: unknown): msg is JsonRpcRequest {
  if (!msg || typeof msg !== "object") return false;
  const m = msg as Record<string, unknown>;
  return m.jsonrpc === "2.0" && typeof m.method === "string" && "id" in m;
}

export function isJsonRpcNotification(msg: unknown): msg is JsonRpcNotification {
  if (!msg || typeof msg !== "object") return false;
  const m = msg as Record<string, unknown>;
  return m.jsonrpc === "2.0" && typeof m.method === "string" && !("id" in m);
}

export function isJsonRpcSuccessResponse(msg: unknown): msg is JsonRpcSuccessResponse {
  if (!msg || typeof msg !== "object") return false;
  const m = msg as Record<string, unknown>;
  return m.jsonrpc === "2.0" && "id" in m && "result" in m && !("error" in m);
}

export function isJsonRpcErrorResponse(msg: unknown): msg is JsonRpcErrorResponse {
  if (!msg || typeof msg !== "object") return false;
  const m = msg as Record<string, unknown>;
  return m.jsonrpc === "2.0" && "id" in m && "error" in m;
}

export function createJsonRpcError(id: JsonRpcId, code: number, message: string, data?: unknown): JsonRpcErrorResponse {
  return { jsonrpc: "2.0", id, error: { code, message, ...(data !== undefined ? { data } : {}) } };
}

export function createJsonRpcSuccess(id: JsonRpcId, result: unknown): JsonRpcSuccessResponse {
  return { jsonrpc: "2.0", id, result };
}

/** Compute a stable fingerprint of tool call arguments for binding approvals. */
export function fingerprintToolArgs(toolName: string, args: Record<string, unknown>): string {
  const { createHash } = require("crypto");
  const canonical = JSON.stringify({ toolName, args }, Object.keys({ toolName, args }).sort());
  return `fp_${createHash("sha256").update(canonical).digest("hex").slice(0, 16)}`;
}
