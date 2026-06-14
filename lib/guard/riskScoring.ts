import { RISK_WEIGHTS } from "./constants";
import type { GuardFinding, RiskType, Severity } from "./types";

export function scoreRisk(findings: GuardFinding[]) {
  const uniqueTypes = [...new Set(findings.map((finding) => finding.type))].filter((type) => type !== "LOW_RISK");
  return Math.min(100, uniqueTypes.reduce((total, type) => total + RISK_WEIGHTS[type as Exclude<RiskType, "LOW_RISK">], 0));
}

export function severityForScore(score: number): Severity {
  if (score <= 30) return "LOW";
  if (score <= 60) return "MEDIUM";
  if (score <= 85) return "HIGH";
  return "CRITICAL";
}
