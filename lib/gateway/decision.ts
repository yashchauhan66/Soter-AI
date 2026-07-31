/**
 * Canonical decision contract — SoterAI Universal AI Gateway.
 *
 * ONE typed decision vocabulary + evidence envelope for every enforcement
 * point. New surfaces (the hosted gateway) emit this natively; existing
 * surfaces adopt it through small adapter functions (see fromGuardAction)
 * instead of a big-bang rewrite of the ~20 historical verb unions
 * (inventory: docs/SOTERAI-TECHNICAL-SUPREMACY-REPORT.md §2.3).
 */
import { createHash } from "crypto";
import type { GuardAction, GuardResult, RiskType, Severity } from "../guard/types";
import type { ResolvedPolicy } from "../guard/policy";

export const CANONICAL_DECISIONS = [
  "ALLOW",
  "REDACT",
  "TRANSFORM",
  "WARN",
  "REQUIRE_APPROVAL",
  "BLOCK",
  "QUARANTINE",
  "ABSTAIN",
] as const;

export type CanonicalDecision = (typeof CANONICAL_DECISIONS)[number];

/** Whether the decision was actually applied inline, only observed, or degraded. */
export type EnforcementStatus = "ENFORCED" | "MONITORED" | "FAIL_OPEN";

export interface DecisionIdentity {
  projectId: string;
  organizationId?: string | null;
  apiKeyId?: string;
  /** End-user/session identifiers supplied by the caller, if any. */
  userId?: string | null;
  sessionId?: string | null;
}

export interface DecisionDestination {
  provider: string;
  model?: string | null;
  host: string;
}

/**
 * Privacy-safe evidence envelope. Carries no raw content — only categories,
 * scores, and bounded reason strings (findings themselves are persisted via
 * the existing guard persistence pipeline, which minimizes evidence).
 */
export interface GatewayDecision {
  decision: CanonicalDecision;
  /** Dominant risk category for the decision (first riskType or NONE). */
  category: RiskType | "NONE";
  severity: Severity;
  /** 0-1 confidence derived from the guard risk score. */
  confidence: number;
  /** Risk score (0-100) and the threshold regime that produced the verdict. */
  riskScore: number;
  threshold: string;
  policyVersion: string;
  identity: DecisionIdentity;
  destination: DecisionDestination;
  traceId: string;
  reason: string;
  enforcement: EnforcementStatus;
  direction: "INPUT" | "OUTPUT";
  findingsCount: number;
  riskTypes: RiskType[];
  timestamp: string;
}

/** Map the historical web-guard verb union onto the canonical vocabulary. */
export function fromGuardAction(action: GuardAction): CanonicalDecision {
  switch (action) {
    case "ALLOW":
      return "ALLOW";
    case "ALLOW_WITH_REDACTION":
      return "REDACT";
    case "REWRITE":
      return "TRANSFORM";
    case "HUMAN_REVIEW":
      return "REQUIRE_APPROVAL";
    case "BLOCK":
      return "BLOCK";
  }
}

export function severityFromScore(score: number): Severity {
  if (score >= 80) return "CRITICAL";
  if (score >= 60) return "HIGH";
  if (score >= 30) return "MEDIUM";
  return "LOW";
}

/**
 * Stable, privacy-safe identifier for the exact policy that was applied.
 * ResolvedPolicy has no version column, so we fingerprint its resolved shape;
 * two projects with identical settings share a fingerprint, and any settings
 * change rotates it — which is exactly what evidence needs.
 */
export function policyFingerprint(policy: ResolvedPolicy): string {
  const canonical = JSON.stringify(policy, Object.keys(policy).sort());
  return `pf_${createHash("sha256").update(canonical).digest("hex").slice(0, 12)}`;
}

export interface BuildDecisionInput {
  result: GuardResult;
  direction: "INPUT" | "OUTPUT";
  identity: DecisionIdentity;
  destination: DecisionDestination;
  traceId: string;
  policyVersion: string;
  enforcement?: EnforcementStatus;
  /** Override for non-scan verdicts (e.g. ABSTAIN when nothing scannable). */
  decisionOverride?: CanonicalDecision;
  now?: () => Date;
}

export function buildGatewayDecision(input: BuildDecisionInput): GatewayDecision {
  const { result } = input;
  const decision = input.decisionOverride ?? fromGuardAction(result.action);
  return {
    decision,
    category: result.riskTypes[0] ?? "NONE",
    severity: severityFromScore(result.riskScore),
    confidence: Math.max(0, Math.min(1, result.riskScore / 100)),
    riskScore: result.riskScore,
    threshold: "guard.decisionEngine.v1",
    policyVersion: input.policyVersion,
    identity: input.identity,
    destination: input.destination,
    traceId: input.traceId,
    // Bounded, privacy-safe: guard reasons are label-level, never raw content.
    reason: result.reason.slice(0, 300),
    enforcement: input.enforcement ?? "ENFORCED",
    direction: input.direction,
    findingsCount: result.findings.length,
    riskTypes: result.riskTypes,
    timestamp: (input.now ? input.now() : new Date()).toISOString(),
  };
}

/** Response headers every gateway response carries (privacy-safe fields only). */
export function decisionHeaders(decision: GatewayDecision): Record<string, string> {
  return {
    "X-Soter-Decision": decision.decision,
    "X-Soter-Trace-Id": decision.traceId,
    "X-Soter-Risk-Score": String(decision.riskScore),
    "X-Soter-Enforcement": decision.enforcement,
    "X-Soter-Policy-Version": decision.policyVersion,
  };
}
