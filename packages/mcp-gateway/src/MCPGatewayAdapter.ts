/**
 * MCP Gateway — Adapter between existing advisory MCPGateway and inline enforcement.
 *
 * Pure adapter functions that bridge the existing `evaluateMCPToolInvocation`
 * from `@soterai/guard-core` with the new inline enforcement gateway.
 * Uses the canonical decision contract from `lib/gateway/decision.ts`.
 * No big-bang rewrites — small adapters only.
 */
import type { GatewayEnforcement, ToolCallEvidence } from "./MCPJsonRpcTypes";

/**
 * Map the existing guard-core EnforcementAction to the canonical GatewayEnforcement.
 */
export function mapGuardActionToEnforcement(action: string): GatewayEnforcement {
  switch (action) {
    case "ALLOW":
    case "ALLOW_ONCE":
    case "ALLOW_WITH_TRANSFORMATION":
    case "ALLOW_IN_SANDBOX":
      return "ALLOW";
    case "ASK":
      return "REQUIRE_APPROVAL";
    case "DENY":
      return "BLOCK";
    case "QUARANTINE":
      return "QUARANTINE";
    default:
      return "BLOCK";
  }
}

/**
 * Map the canonical GatewayEnforcement back to guard-core EnforcementAction
 * for compatibility with existing persistence/display code.
 */
export function mapEnforcementToGuardAction(enforcement: GatewayEnforcement): string {
  switch (enforcement) {
    case "ALLOW":
      return "ALLOW";
    case "REDACT":
      return "ALLOW_WITH_TRANSFORMATION";
    case "TRANSFORM":
      return "ALLOW_WITH_TRANSFORMATION";
    case "REQUIRE_APPROVAL":
      return "ASK";
    case "BLOCK":
      return "DENY";
    case "QUARANTINE":
      return "QUARANTINE";
    default:
      return "DENY";
  }
}

/**
 * Build a privacy-safe evidence envelope from a tool call.
 * Never includes raw content — only categories, scores, and bounded reason strings.
 */
export function buildEvidenceEnvelope(evidence: ToolCallEvidence): Record<string, unknown> {
  return {
    traceId: evidence.traceId,
    sessionId: evidence.sessionId,
    tenant: evidence.tenant,
    project: evidence.project,
    clientId: evidence.clientId,
    userId: evidence.userId,
    agentId: evidence.agentId,
    serverIdentity: evidence.serverIdentity,
    toolName: evidence.toolName,
    riskScore: evidence.riskScore,
    enforcement: evidence.enforcement,
    reason: evidence.reason.slice(0, 300),
    policyVersion: evidence.policyVersion,
    decisionTimestamp: evidence.decisionTimestamp,
    executionTimestamp: evidence.executionTimestamp,
    resultRiskScore: evidence.resultRiskScore,
    resultEnforcement: evidence.resultEnforcement,
  };
}

/**
 * Create a safe diagnostic log entry from evidence.
 * Never logs raw secrets or sensitive content.
 */
export function safeDiagnosticLog(evidence: ToolCallEvidence): Record<string, unknown> {
  return {
    event: "mcp_tool_call",
    traceId: evidence.traceId,
    sessionId: evidence.sessionId.slice(0, 12) + "...",
    tenant: evidence.tenant,
    toolName: evidence.toolName,
    enforcement: evidence.enforcement,
    riskScore: evidence.riskScore,
    reason: evidence.reason.slice(0, 200),
    timestamp: evidence.decisionTimestamp,
  };
}
