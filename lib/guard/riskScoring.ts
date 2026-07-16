import { RISK_WEIGHTS } from "./constants";
import type { GuardFinding, RiskType, Severity } from "./types";

export function scoreRisk(findings: GuardFinding[]) {
  // Count unique (type, label) pairs so distinct findings from different
  // detectors (legacy signatures vs generalized intent rules) contribute
  // independently.  We take the max of two scores:
  //  1) The classic type-level sum (backward-compatible, handles 1-2 findings).
  //  2) A base + bonus formula that rewards 3+ distinct findings, giving
  //     attacks caught by multiple detectors a higher ceiling.
  const seenPairs = new Set<string>();
  const seenTypes = new Set<string>();
  let typeSum = 0;
  let base = 0;
  let maxDeclaredScore = 0;
  let pairCount = 0;
  for (const f of findings) {
    if (f.type === "LOW_RISK") continue;
    maxDeclaredScore = Math.max(maxDeclaredScore, f.score);
    const pairKey = `${f.type}::${f.label}`;
    if (!seenPairs.has(pairKey)) {
      seenPairs.add(pairKey);
      pairCount += 1;
      const weight = RISK_WEIGHTS[f.type as Exclude<RiskType, "LOW_RISK">];
      if (!seenTypes.has(f.type)) {
        seenTypes.add(f.type);
        typeSum += weight;
        if (weight > base) base = weight;
      }
    }
  }
  const bonus = pairCount > 1 ? Math.round(base * 0.3 * (pairCount - 1)) : 0;
  return Math.min(100, Math.max(typeSum, base + bonus, maxDeclaredScore));
}

export function severityForScore(score: number): Severity {
  if (score <= 30) return "LOW";
  if (score <= 60) return "MEDIUM";
  if (score <= 85) return "HIGH";
  return "CRITICAL";
}
