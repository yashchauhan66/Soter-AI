export const THREAT_INTEL_PREVIEW_GAPS = [
  "Remote feed ingestion, scheduled refresh, and signature verification are not enabled in this preview.",
  "Approve/shadow/promote/rollback workflow exists at the helper level; admin UI promotion controls are not complete.",
  "Detection-rule rollout requires staged shadow runs against authorized datasets before production promotion.",
  "Partner pack exchange and publisher attestation require authorized provider setup.",
] as const;

export interface ThreatRule {
  name: string;
  category: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  pattern: string;
  language?: string;
  safeTestText?: string;
}

export interface ThreatRulePack {
  name: string;
  source: "INTERNAL" | "PARTNER" | "REMOTE_REVIEW_REQUIRED";
  rules: ThreatRule[];
}

const ALLOWED_CATEGORIES = new Set(["PROMPT_INJECTION", "JAILBREAK", "SYSTEM_PROMPT_LEAK", "PII", "SECRET", "UNSAFE_OUTPUT", "RAG_POISONING", "TOOL_MISUSE", "COST_ABUSE"]);

export function validateThreatRulePack(pack: ThreatRulePack) {
  const errors: string[] = [];
  if (!pack.name || pack.name.length > 120) errors.push("Rule pack name is required and must be short.");
  if (pack.source !== "INTERNAL" && pack.source !== "PARTNER" && pack.source !== "REMOTE_REVIEW_REQUIRED") errors.push("Unsupported source type.");
  if (!Array.isArray(pack.rules) || pack.rules.length > 200) errors.push("Rule pack must include 1-200 rules.");
  for (const [index, rule] of (pack.rules ?? []).entries()) {
    if (!rule.name || rule.name.length > 120) errors.push(`Rule ${index} has an invalid name.`);
    if (!ALLOWED_CATEGORIES.has(rule.category)) errors.push(`Rule ${rule.name} has an unsupported category.`);
    if (!["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(rule.severity)) errors.push(`Rule ${rule.name} has an unsupported severity.`);
    if (!rule.pattern || rule.pattern.length > 500) errors.push(`Rule ${rule.name} has an invalid pattern.`);
    if (/(?:\(\.\*\)){2,}|\(\?<=|\(\?<!/.test(rule.pattern)) errors.push(`Rule ${rule.name} uses a risky regex construct.`);
    try {
      new RegExp(rule.pattern, "i");
    } catch {
      errors.push(`Rule ${rule.name} is not valid regex.`);
    }
  }
  return { valid: errors.length === 0, errors };
}

export function planThreatRuleActivation(pack: ThreatRulePack) {
  const validation = validateThreatRulePack(pack);
  if (!validation.valid) return { accepted: false, mode: "REJECTED", validation };
  return {
    accepted: true,
    mode: pack.source === "INTERNAL" ? "SHADOW" : "APPROVAL_REQUIRED",
    validation,
    importedCount: pack.rules.length,
  };
}

export function rollbackDetectorRuleVersion(input: { detector: string; version: number; reason: string }) {
  return {
    detector: input.detector,
    version: input.version,
    mode: "ROLLED_BACK",
    auditAction: "detector_rule.rollback",
    reason: input.reason.slice(0, 500),
  };
}

