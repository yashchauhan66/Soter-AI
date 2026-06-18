// Context Lineage Firewall — pure decision logic (no DB, no auth).
// Tracks where AI data came from, where it is going, and whether the agent is
// allowed to move it. Reuses the existing guard analyzer for detection and the
// existing log-safety helpers for redaction. Raw secrets are never returned in
// a field intended for storage; callers persist contentHash + contentRedacted.

import { createHash } from "crypto";
import { analyzeText } from "@/lib/guard/analyze";
import { sanitizeLogText } from "@/lib/guard/logSafety";

export type SourceType =
  | "USER_PROMPT" | "RAG_DOCUMENT" | "BROWSER_PAGE" | "EMAIL" | "FILE" | "MCP_TOOL"
  | "API_RESPONSE" | "MEMORY" | "CLIPBOARD" | "TERMINAL" | "SYSTEM_PROMPT"
  | "PRIVATE_CONTEXT" | "CUSTOM";
export type SourceTrustLevel = "TRUSTED" | "INTERNAL" | "UNKNOWN" | "UNTRUSTED" | "MALICIOUS";
export type SensitivityLevel = "PUBLIC" | "INTERNAL" | "CONFIDENTIAL" | "SECRET" | "REGULATED";
export type DestinationType =
  | "LLM" | "TOOL" | "EXTERNAL_API" | "EMAIL" | "BROWSER_FORM" | "FILE_WRITE"
  | "MEMORY" | "FINAL_OUTPUT" | "WEBHOOK" | "CUSTOM";
export type DestinationTrustLevel = "TRUSTED" | "INTERNAL" | "UNKNOWN" | "EXTERNAL" | "BLOCKED";
export type LineageDecision = "ALLOW" | "BLOCK" | "REDACT" | "ASK_APPROVAL" | "REVIEW";
export type LineageRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type IncidentType =
  | "UNAUTHORIZED_EGRESS" | "SECRET_FLOW" | "PII_FLOW" | "CROSS_CONTEXT_LEAK"
  | "POLICY_VIOLATION" | "UNKNOWN_DESTINATION" | "MULTI_STEP_EXFILTRATION";

export interface LineageFinding {
  type: string;
  label: string;
  severity: string;
}

export function hashContent(content: string): string {
  return createHash("sha256").update(content ?? "").digest("hex");
}

/** Run the shared guard analyzer and surface only redacted/aggregate data. */
export function classifyContent(content: string) {
  const guard = analyzeText(content ?? "", "INPUT");
  const hasSecret = guard.riskTypes.includes("SECRET_DETECTED");
  const hasPii = guard.riskTypes.includes("PII_DETECTED");
  const hasIndiaPii = guard.riskTypes.includes("INDIA_PII_DETECTED");
  const findings: LineageFinding[] = guard.findings.map((finding) => ({
    type: String(finding.type),
    label: finding.label,
    severity: String(finding.severity),
  }));
  return {
    hasSecret,
    hasPii,
    hasIndiaPii,
    findings,
    safeContent: guard.redactedText ?? sanitizeLogText(content ?? ""),
    redactions: findings.map((finding) => finding.label),
  };
}

export interface ContextSourceInput {
  sourceId?: string;
  sourceType: SourceType;
  sourceName?: string;
  sourceTrustLevel: SourceTrustLevel;
  sensitivityLevel: SensitivityLevel;
}

export interface ContextFlowCheckInput {
  sources: ContextSourceInput[];
  destinationType: DestinationType;
  destinationName?: string;
  destinationTrustLevel: DestinationTrustLevel;
  action?: string;
  content?: string;
  /** Project policy override for REGULATED data egress. */
  regulatedEgress?: "BLOCK" | "ASK_APPROVAL";
}

export interface ContextFlowDecision {
  decision: LineageDecision;
  riskLevel: LineageRiskLevel;
  reason: string;
  safeContent: string;
  redactions: string[];
  findings: LineageFinding[];
  incidentType: IncidentType | null;
  policyMatches: string[];
}

const SENSITIVITY_ORDER: Record<SensitivityLevel, number> = {
  PUBLIC: 0, INTERNAL: 1, CONFIDENTIAL: 2, SECRET: 3, REGULATED: 3,
};

const EXTERNAL_DESTINATIONS: DestinationType[] = ["EXTERNAL_API", "EMAIL", "BROWSER_FORM", "WEBHOOK"];

function isExternalDestination(input: ContextFlowCheckInput): boolean {
  if (input.destinationTrustLevel === "EXTERNAL" || input.destinationTrustLevel === "UNKNOWN") return true;
  return EXTERNAL_DESTINATIONS.includes(input.destinationType);
}

function isUntrustedDestination(input: ContextFlowCheckInput): boolean {
  return input.destinationTrustLevel === "UNKNOWN" || input.destinationTrustLevel === "EXTERNAL" || input.destinationTrustLevel === "BLOCKED";
}

/**
 * Decide whether data can flow from the given sources to a destination.
 * Order matters: the first matching (most restrictive) rule wins.
 */
export function decideContextFlow(input: ContextFlowCheckInput): ContextFlowDecision {
  const classified = classifyContent(input.content ?? "");
  const policyMatches: string[] = [];
  const maxSensitivity = input.sources.reduce<SensitivityLevel>((max, source) =>
    SENSITIVITY_ORDER[source.sourceType === "SYSTEM_PROMPT" ? "SECRET" : source.sensitivityLevel] > SENSITIVITY_ORDER[max] ? source.sensitivityLevel : max, "PUBLIC");
  const external = isExternalDestination(input);
  const untrusted = isUntrustedDestination(input);
  const confidentialSources = input.sources.filter((source) => SENSITIVITY_ORDER[source.sensitivityLevel] >= SENSITIVITY_ORDER.CONFIDENTIAL);
  const hasSystemOrPrivate = input.sources.some((source) => source.sourceType === "SYSTEM_PROMPT" || source.sourceType === "PRIVATE_CONTEXT");
  const hasMalicious = input.sources.some((source) => source.sourceTrustLevel === "MALICIOUS");
  const hasUntrustedSource = input.sources.some((source) => source.sourceTrustLevel === "UNTRUSTED" || source.sourceTrustLevel === "MALICIOUS");
  const influencesBehavior = input.destinationType === "TOOL" || input.destinationType === "LLM";

  const build = (decision: LineageDecision, riskLevel: LineageRiskLevel, reason: string, incidentType: IncidentType | null): ContextFlowDecision => ({
    decision, riskLevel, reason,
    safeContent: classified.safeContent,
    redactions: classified.redactions,
    findings: classified.findings,
    incidentType,
    policyMatches,
  });

  // 1. Destination explicitly blocked by policy.
  if (input.destinationTrustLevel === "BLOCKED") {
    policyMatches.push("destination_blocked");
    return build("BLOCK", "CRITICAL", "Destination is on the blocked list for this project.", "POLICY_VIOLATION");
  }

  // 2. Secret content leaving to an external/unknown destination.
  if (classified.hasSecret && external) {
    policyMatches.push("secret_external_egress");
    return build("BLOCK", "CRITICAL", "Secret/credential material cannot flow to an external destination.", "SECRET_FLOW");
  }

  // 3. System prompt / private context heading to output or an external/untrusted tool.
  if (hasSystemOrPrivate && (input.destinationType === "FINAL_OUTPUT" || external || untrusted)) {
    policyMatches.push("system_or_private_egress");
    return build("BLOCK", "CRITICAL", "System prompt or private context must not reach the final output or an external destination.", "CROSS_CONTEXT_LEAK");
  }

  // 4. Malicious source attempting to influence tool/LLM behavior.
  if (hasMalicious && influencesBehavior) {
    policyMatches.push("malicious_source_influence");
    return build("BLOCK", "CRITICAL", "A malicious source must not influence tool or model behavior.", "POLICY_VIOLATION");
  }

  // 5. Confidential/secret RAG document to an untrusted/unknown MCP tool.
  if (confidentialSources.some((source) => source.sourceType === "RAG_DOCUMENT") && input.destinationType === "TOOL" && untrusted) {
    policyMatches.push("confidential_rag_to_untrusted_tool");
    return build("BLOCK", "CRITICAL", "Confidential RAG document content cannot flow to an untrusted MCP tool.", "UNAUTHORIZED_EGRESS");
  }

  // 6. Confidential / secret data to an external or unknown destination.
  if (SENSITIVITY_ORDER[maxSensitivity] >= SENSITIVITY_ORDER.CONFIDENTIAL && maxSensitivity !== "REGULATED" && (external || untrusted)) {
    policyMatches.push("confidential_external_egress");
    return build("BLOCK", "HIGH", `Data classified ${maxSensitivity} cannot flow to an external or unknown destination.`, "UNAUTHORIZED_EGRESS");
  }

  // 7. Regulated data to an external destination (policy decides block vs approval).
  if (maxSensitivity === "REGULATED" && external) {
    const decision = input.regulatedEgress ?? "ASK_APPROVAL";
    policyMatches.push(`regulated_external_${decision.toLowerCase()}`);
    return build(decision, "HIGH", "Regulated data flowing to an external destination requires explicit approval.", "PII_FLOW");
  }

  // 8. Multi-step exfiltration: several confidential sources to an external destination.
  if (confidentialSources.length >= 2 && external) {
    policyMatches.push("multi_source_confidential_egress");
    return build("REVIEW", "HIGH", "Multiple confidential sources flowing to an external destination may reconstruct sensitive data.", "MULTI_STEP_EXFILTRATION");
  }

  // 9. PII content to an external destination.
  if ((classified.hasPii || classified.hasIndiaPii) && external) {
    policyMatches.push("pii_external_egress");
    return build("ASK_APPROVAL", "HIGH", "Personal data flowing to an external destination requires approval.", "PII_FLOW");
  }

  // 10. Untrusted source influencing tool/LLM behavior (non-malicious).
  if (hasUntrustedSource && influencesBehavior) {
    policyMatches.push("untrusted_source_influence");
    return build("REVIEW", "MEDIUM", "An untrusted source is influencing tool or model behavior and should be reviewed.", "CROSS_CONTEXT_LEAK");
  }

  // 11. Unknown destination receiving confidential data already handled above; flag remaining unknowns.
  if (input.destinationTrustLevel === "UNKNOWN" && SENSITIVITY_ORDER[maxSensitivity] >= SENSITIVITY_ORDER.INTERNAL) {
    policyMatches.push("internal_to_unknown_destination");
    return build("REVIEW", "MEDIUM", "Internal data flowing to an unknown destination should be reviewed.", "UNKNOWN_DESTINATION");
  }

  // 12. Redact if we still detected sensitive content going somewhere internal/trusted.
  if (classified.hasSecret || classified.hasPii || classified.hasIndiaPii) {
    policyMatches.push("redact_sensitive_internal");
    return build("REDACT", "MEDIUM", "Sensitive values were redacted before the data was allowed to flow.", null);
  }

  // 13. Default allow (public/internal to trusted/internal destination).
  return build("ALLOW", "LOW", "Data flow allowed: source sensitivity and destination trust are within policy.", null);
}
