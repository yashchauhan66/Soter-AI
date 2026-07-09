/**
 * Shared harness for the expanded adversarial + benign benchmark suites.
 *
 * The expanded suites (Phase 3 of the no-gap readiness pass) exist to prove the
 * guard generalizes BEYOND the original 1,218-case corpus. Every case here is a
 * NEW wording — generalized patterns, not strings memorized by the detectors —
 * so a high recall here is evidence of pattern coverage, and a low benign
 * false-positive rate here is evidence the rules are not over-broad.
 *
 * These helpers run the EXACT production classifier (`analyzeText`) so the
 * numbers match what the live guard produces.
 */
import { analyzeText } from "../../lib/guard/analyze";
import type { GuardDirection } from "../../lib/guard/types";

export interface ExpandedCase {
  /** Stable id for reporting a specific miss. */
  id: string;
  /** The adversarial or benign text under test. */
  text: string;
  /** INPUT (default) or OUTPUT direction. */
  direction?: GuardDirection;
}

/** Any protective action — a rewritten/redacted attack is still "caught". */
const MITIGATING_ACTIONS = new Set([
  "BLOCK",
  "HUMAN_REVIEW",
  "REWRITE",
  "ALLOW_WITH_REDACTION",
]);

export interface CaseOutcome {
  id: string;
  action: string;
  score: number;
  riskTypes: string[];
  mitigated: boolean;
}

export function evaluateCase(c: ExpandedCase): CaseOutcome {
  const r = analyzeText(c.text, c.direction ?? "INPUT");
  return {
    id: c.id,
    action: r.action,
    score: r.riskScore,
    riskTypes: r.riskTypes,
    mitigated: MITIGATING_ACTIONS.has(r.action),
  };
}

export interface RecallReport {
  total: number;
  detected: number;
  recall: number;
  misses: CaseOutcome[];
}

/** Fraction of attack cases the guard took ANY protective action on. */
export function attackRecall(cases: ExpandedCase[]): RecallReport {
  const outcomes = cases.map(evaluateCase);
  const misses = outcomes.filter((o) => !o.mitigated);
  return {
    total: outcomes.length,
    detected: outcomes.length - misses.length,
    recall: outcomes.length ? (outcomes.length - misses.length) / outcomes.length : 0,
    misses,
  };
}

export interface FprReport {
  total: number;
  falsePositives: number;
  fpr: number;
  offenders: CaseOutcome[];
}

/** Fraction of benign cases the guard wrongly took a protective action on. */
export function benignFalsePositiveRate(cases: ExpandedCase[]): FprReport {
  const outcomes = cases.map(evaluateCase);
  const offenders = outcomes.filter((o) => o.mitigated);
  return {
    total: outcomes.length,
    falsePositives: offenders.length,
    fpr: outcomes.length ? offenders.length / outcomes.length : 0,
    offenders,
  };
}

/** Compact miss/offender description for assertion messages. */
export function describe(cases: CaseOutcome[]): string {
  return cases
    .slice(0, 20)
    .map((c) => `${c.id} [${c.action} ${c.score} ${c.riskTypes.join("/")}]`)
    .join("; ");
}
