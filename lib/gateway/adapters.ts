import type {
  CanonicalDecision,
  DecisionDestination,
  DecisionIdentity,
  EnforcementStatus,
} from "./decision";

export type LegacySurface =
  | "guard-core"
  | "sdk"
  | "agent-firewall"
  | "agent-action-ledger"
  | "browser-extension"
  | "vscode-extension"
  | "n8n-workflow"
  | "rag"
  | "governance"
  | "semantic-egress"
  | "escrow"
  | "dry-run";

export interface AdapterContext {
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  confidence: number;
  threshold: string;
  reason: string;
  policyVersion: string;
  identity: DecisionIdentity;
  destination: DecisionDestination;
  traceId: string;
  category?: string;
  riskScore?: number;
  enforcement?: EnforcementStatus;
  direction?: "INPUT" | "OUTPUT";
  findingsCount?: number;
  now?: string;
}

export interface CanonicalAdapterEnvelope {
  decision: CanonicalDecision;
  category: string;
  severity: AdapterContext["severity"];
  confidence: number;
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
  riskTypes: string[];
  timestamp: string;
  source: { surface: LegacySurface; decision: string };
}

const MAP: Record<LegacySurface, Readonly<Record<string, CanonicalDecision>>> = {
  "guard-core": { allow: "ALLOW", warn: "WARN", redact: "REDACT", block: "BLOCK", approval_required: "REQUIRE_APPROVAL" },
  sdk: { ALLOW: "ALLOW", ALLOW_WITH_REDACTION: "REDACT", REWRITE: "TRANSFORM", BLOCK: "BLOCK", HUMAN_REVIEW: "REQUIRE_APPROVAL", REDACT: "REDACT" },
  "agent-firewall": { ALLOW: "ALLOW", BLOCK: "BLOCK", REDACT: "REDACT", ASK_APPROVAL: "REQUIRE_APPROVAL", SANDBOX_ONLY: "TRANSFORM", READ_ONLY: "TRANSFORM" },
  "agent-action-ledger": { ALLOW: "ALLOW", REQUIRE_APPROVAL: "REQUIRE_APPROVAL", BLOCK: "BLOCK" },
  "browser-extension": { allow: "ALLOW", warn: "WARN", redact: "REDACT", block: "BLOCK", approval_required: "REQUIRE_APPROVAL" },
  "vscode-extension": { allow: "ALLOW", warn: "WARN", redact: "REDACT", block: "BLOCK", approval_required: "REQUIRE_APPROVAL" },
  "n8n-workflow": { ALLOW: "ALLOW", BLOCK: "BLOCK", REDACT: "REDACT", ASK_APPROVAL: "REQUIRE_APPROVAL", REVIEW: "WARN" },
  rag: { ALLOW: "ALLOW", BLOCK: "BLOCK", QUARANTINE: "QUARANTINE", REVIEW: "WARN" },
  governance: { ALLOW: "ALLOW", BLOCK: "BLOCK", REQUIRE_APPROVAL: "REQUIRE_APPROVAL", MONITOR_ONLY: "WARN" },
  "semantic-egress": { ALLOW: "ALLOW", BLOCK: "BLOCK", REDACT: "REDACT", ASK_APPROVAL: "REQUIRE_APPROVAL", REVIEW: "WARN" },
  escrow: { ALLOW: "ALLOW", BLOCK: "BLOCK", CREATE_ESCROW: "REQUIRE_APPROVAL" },
  "dry-run": { SAFE_TO_EXECUTE: "ALLOW", REQUIRE_APPROVAL: "REQUIRE_APPROVAL", BLOCK: "BLOCK", REVIEW: "WARN" },
};

function bounded(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

/** Pure adapter. Unknown verbs abstain instead of accidentally allowing. */
export function adaptLegacyDecision(
  surface: LegacySurface,
  sourceDecision: string,
  context: AdapterContext,
): CanonicalAdapterEnvelope {
  const normalized = sourceDecision.trim();
  const decision = MAP[surface][normalized] ?? "ABSTAIN";
  const category = (context.category?.trim() || "NONE").slice(0, 100);
  return {
    decision,
    category,
    severity: context.severity,
    confidence: bounded(context.confidence),
    riskScore: Math.max(0, Math.min(100, context.riskScore ?? context.confidence * 100)),
    threshold: context.threshold.slice(0, 100),
    policyVersion: context.policyVersion.slice(0, 200),
    identity: { ...context.identity },
    destination: { ...context.destination },
    traceId: context.traceId.slice(0, 200),
    reason: context.reason.slice(0, 300),
    enforcement: context.enforcement ?? "ENFORCED",
    direction: context.direction ?? "INPUT",
    findingsCount: Math.max(0, Math.floor(context.findingsCount ?? 0)),
    riskTypes: category === "NONE" ? [] : [category],
    timestamp: context.now ?? new Date().toISOString(),
    source: { surface, decision: sourceDecision },
  };
}

export function restoreLegacyDecision(
  envelope: Pick<CanonicalAdapterEnvelope, "source">,
  expectedSurface?: LegacySurface,
): string {
  if (expectedSurface && envelope.source.surface !== expectedSurface) {
    throw new Error(`Decision envelope belongs to ${envelope.source.surface}, not ${expectedSurface}`);
  }
  return envelope.source.decision;
}

export function adapterSupports(surface: LegacySurface, sourceDecision: string): boolean {
  return Object.hasOwn(MAP[surface], sourceDecision.trim());
}
