/**
 * MCP decision adapter.
 *
 * Maps the guard-core MCP verdict (EnforcementAction) plus the gateway's own
 * inspection overlays onto the ONE canonical decision contract
 * (lib/gateway/decision.ts) — no new verdict enum. It extends the canonical
 * GatewayDecision with MCP-specific, privacy-safe fields (server, tool,
 * capability, argument fingerprint, approval id, evidence).
 */
import { createHash } from "crypto";
import type { EnforcementAction } from "@soterai/guard-core";
import {
  buildGatewayDecision,
  type CanonicalDecision,
  type GatewayDecision,
  type DecisionIdentity,
  type EnforcementStatus,
} from "../decision";
import type { GuardResult, RiskType, GuardAction } from "../../guard/types";

export interface McpDecisionEvidence {
  reasonCodes: string[];
  categories: string[];
  /** Label-level only; never raw content. */
  findingSummaries: string[];
  /** Already-redacted preview of the arguments (bounded). */
  redactedArgsPreview: string;
}

export interface McpGatewayDecision extends GatewayDecision {
  server: string;
  tool: string;
  capability?: string;
  /** sha256 fingerprint of the canonical arguments (privacy-safe). */
  argsFingerprint: string;
  approvalId?: string;
  evidence: McpDecisionEvidence;
}

/** Map guard-core runtime action → canonical decision (fail-safe). */
export function fromEnforcementAction(action: EnforcementAction): CanonicalDecision {
  switch (action) {
    case "ALLOW":
    case "ALLOW_ONCE":
      return "ALLOW";
    case "ALLOW_WITH_TRANSFORMATION":
      return "TRANSFORM";
    case "ALLOW_IN_SANDBOX":
      // No MCP sandbox exists — degrade to human approval rather than allow.
      return "REQUIRE_APPROVAL";
    case "ASK":
      return "REQUIRE_APPROVAL";
    case "QUARANTINE":
      return "QUARANTINE";
    case "DENY":
      return "BLOCK";
    default:
      return "BLOCK";
  }
}

/** Reverse map for building a synthetic GuardResult the canonical builder accepts. */
function toGuardAction(decision: CanonicalDecision): GuardAction {
  switch (decision) {
    case "ALLOW":
    case "WARN":
    case "ABSTAIN":
      return "ALLOW";
    case "REDACT":
      return "ALLOW_WITH_REDACTION";
    case "TRANSFORM":
      return "REWRITE";
    case "REQUIRE_APPROVAL":
      return "HUMAN_REVIEW";
    case "BLOCK":
    case "QUARANTINE":
      return "BLOCK";
  }
}

export function argsFingerprint(canonicalArgs: string): string {
  return `af_${createHash("sha256").update(canonicalArgs).digest("hex").slice(0, 24)}`;
}

const CATEGORY_TO_RISK: Record<string, RiskType> = {
  secret_egress: "SECRET_DETECTED",
  prompt_injection: "PROMPT_INJECTION",
  mcp_tool_poisoning: "MCP_TOOL_POISONING",
  unknown_mcp_server: "MCP_TOOL_POISONING",
};

export interface BuildMcpDecisionInput {
  decision: CanonicalDecision;
  riskScore: number;
  identity: DecisionIdentity;
  server: string;
  tool: string;
  capability?: string;
  transport: string;
  argsFingerprint: string;
  approvalId?: string;
  reason: string;
  policyVersion: string;
  traceId: string;
  direction: "INPUT" | "OUTPUT";
  enforcement?: EnforcementStatus;
  evidence: McpDecisionEvidence;
  riskTypes?: RiskType[];
  now?: () => Date;
}

export function buildMcpDecision(input: BuildMcpDecisionInput): McpGatewayDecision {
  const riskTypes =
    input.riskTypes ??
    ([
      ...new Set(
        input.evidence.categories
          .map((c) => CATEGORY_TO_RISK[c])
          .filter((r): r is RiskType => Boolean(r)),
      ),
    ] as RiskType[]);

  const synthetic: GuardResult = {
    allowed: input.decision === "ALLOW" || input.decision === "WARN" || input.decision === "ABSTAIN",
    action: toGuardAction(input.decision),
    riskScore: input.riskScore,
    riskTypes,
    reason: input.reason,
    findings: input.evidence.findingSummaries.map((label) => ({
      type: (riskTypes[0] ?? "LOW_RISK") as RiskType,
      label,
      severity: "MEDIUM" as const,
      score: input.riskScore,
      message: label,
    })),
  };

  const core = buildGatewayDecision({
    result: synthetic,
    direction: input.direction,
    identity: input.identity,
    destination: { provider: "mcp", model: input.tool, host: input.transport },
    traceId: input.traceId,
    policyVersion: input.policyVersion,
    enforcement: input.enforcement,
    decisionOverride: input.decision,
    now: input.now,
  });

  return {
    ...core,
    server: input.server,
    tool: input.tool,
    capability: input.capability,
    argsFingerprint: input.argsFingerprint,
    approvalId: input.approvalId,
    evidence: input.evidence,
  };
}
