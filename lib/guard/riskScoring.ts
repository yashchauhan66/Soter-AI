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

/**
 * Per-category confidence, 0–1, for every category that actually fired.
 *
 * The aggregate `riskScore` answers "how bad is this request" but says nothing
 * about *which* category the verdict rests on, and callers were reading
 * `riskTypes[0]` as the primary — which is detector REGISTRATION ORDER, not
 * evidence strength. That is how a SQL payload came back labelled
 * PROMPT_INJECTION: the prompt-injection detector is simply registered first.
 *
 * Confidence for a category is its strongest finding's declared score measured
 * against that category's weight ceiling, with a corroboration bonus when more
 * than one distinct finding in the category fired. Two independent rules
 * agreeing is genuinely stronger evidence than one rule matching twice, so the
 * bonus keys on distinct (type, label) pairs — the same unit `scoreRisk` counts.
 *
 * The result is capped at 1 and is deliberately NOT a calibrated probability:
 * it is an ordering signal derived from hand-set rule scores, and calling it a
 * probability would overclaim. It exists so a caller can tell a 0.3
 * code-syntax overlap from a 0.95 unambiguous override.
 */
export function categoryConfidence(findings: GuardFinding[]): Partial<Record<RiskType, number>> {
  const maxScore = new Map<RiskType, number>();
  const distinctLabels = new Map<RiskType, Set<string>>();

  for (const finding of findings) {
    if (finding.type === "LOW_RISK") continue;
    maxScore.set(finding.type, Math.max(maxScore.get(finding.type) ?? 0, finding.score));
    const labels = distinctLabels.get(finding.type) ?? new Set<string>();
    labels.add(finding.label);
    distinctLabels.set(finding.type, labels);
  }

  const confidence: Partial<Record<RiskType, number>> = {};
  for (const [type, score] of maxScore) {
    const ceiling = RISK_WEIGHTS[type as Exclude<RiskType, "LOW_RISK">];
    // A rule that declares a score above its own category weight is already
    // saying "this is an unusually strong instance", so the ratio can exceed 1
    // before the cap — that is the intent, not an overflow.
    const base = ceiling > 0 ? score / ceiling : 0;
    const corroboration = ((distinctLabels.get(type)?.size ?? 1) - 1) * 0.1;
    confidence[type] = Math.min(1, Number((base + corroboration).toFixed(3)));
  }
  return confidence;
}

/**
 * The category a caller should show as "the reason", chosen by evidence rather
 * than by which detector happens to be registered first.
 *
 * Ranked by confidence x category weight: confidence alone would let a
 * low-stakes category with one very strong rule outrank a genuine injection,
 * and weight alone is just the old ordering with extra steps. Ties break on the
 * higher weight, then alphabetically so the output is stable across runs.
 */
export function primaryRiskType(
  riskTypes: RiskType[],
  confidence: Partial<Record<RiskType, number>>,
): RiskType {
  const ranked = riskTypes.filter((type) => type !== "LOW_RISK");
  if (ranked.length === 0) return "LOW_RISK";

  return ranked.reduce((best, candidate) => {
    const weightOf = (type: RiskType) => RISK_WEIGHTS[type as Exclude<RiskType, "LOW_RISK">] ?? 0;
    const rankOf = (type: RiskType) => (confidence[type] ?? 0) * weightOf(type);
    const candidateRank = rankOf(candidate);
    const bestRank = rankOf(best);
    if (candidateRank !== bestRank) return candidateRank > bestRank ? candidate : best;
    if (weightOf(candidate) !== weightOf(best)) return weightOf(candidate) > weightOf(best) ? candidate : best;
    return candidate < best ? candidate : best;
  });
}
