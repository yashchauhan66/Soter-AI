import { performance } from "node:perf_hooks";
import { analyzeText } from "../guard/analyze";
import type { GuardDirection } from "../guard/types";
import {
  assessCrescendo,
  detectCrescendoScaffold,
  type CrescendoTurn,
} from "../guard/crescendo";
import { guardRedTeamBenchmark } from "../classifiers/datasets/guardRedTeamBenchmark";
import { EXPANDED_SAFE_INPUTS } from "../classifiers/datasets/expandedSafeInputs";
import { phase5Benchmark } from "../classifiers/datasets/phase5Benchmark";

/**
 * Honest benchmark harness.
 *
 * The point of this file is credibility, not marketing. Sophisticated buyers do
 * not trust "F1 = 1.0000 / zero false positives" — it reads as "not tested hard
 * enough". Instead we report the metric that actually matters for a production
 * guard and that the industry benchmarks on:
 *
 *   Recall @ a fixed false-positive rate (Recall@1%FPR).
 *
 * A detector is only useful if it catches attacks WITHOUT drowning real users in
 * false blocks. Recall@1%FPR answers exactly that: "if we tune the guard so that
 * at most 1 in 100 benign messages is flagged, what fraction of real attacks do
 * we still catch?" We also report ROC-AUC (threshold-independent separability),
 * the metrics at the guard's real production threshold, a per-category recall
 * breakdown, latency percentiles, and full dataset provenance + limitations.
 *
 * Everything here is deterministic, dependency-free (no model, no network, no
 * Redis) and runs the EXACT production classifier (`analyzeText`), so the numbers
 * it prints are the numbers the live guard produces.
 */

export type BenchmarkDirectionLabel = "attack" | "benign";

export interface LabeledGuardCase {
  id: string;
  text: string;
  direction: GuardDirection;
  isAttack: boolean;
  category: string;
  source: string;
  owasp: string[];
}

export interface ScoredCase extends LabeledGuardCase {
  /** Continuous guard risk score, 0–100 — the value the threshold sweep uses. */
  score: number;
  /** Hard block or human-review — the strictest "stopped it" definition. */
  blocked: boolean;
  /** Any protective action (block, review, rewrite, redaction) — i.e. not ALLOW. */
  mitigated: boolean;
  action: string;
  latencyMs: number;
}

// Strictest definition: the guard fully stopped the request or escalated it.
const BLOCK_ACTIONS = new Set(["BLOCK", "HUMAN_REVIEW"]);

/**
 * Scored production-classifier adapter. Returns the guard's continuous risk
 * score (used for the threshold sweep) alongside two honest binary decisions:
 *  - blocked   : hard BLOCK / HUMAN_REVIEW (strict).
 *  - mitigated : any non-ALLOW action, so REWRITE / ALLOW_WITH_REDACTION (which
 *                neutralize the payload) count as caught, not missed.
 */
export function scoreWithGuard(text: string, direction: GuardDirection): {
  score: number;
  blocked: boolean;
  mitigated: boolean;
  action: string;
  latencyMs: number;
} {
  const started = performance.now();
  const guard = analyzeText(text, direction);
  const latencyMs = performance.now() - started;
  return {
    score: guard.riskScore,
    blocked: BLOCK_ACTIONS.has(guard.action),
    mitigated: guard.action !== "ALLOW",
    action: guard.action,
    latencyMs,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Corpus assembly — attacks + benign hard-negatives, from the real datasets.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds the labeled evaluation corpus from the datasets that ship in the repo:
 *  - guardRedTeamBenchmark  — hand-authored adversarial cases with OWASP tags.
 *  - phase5Benchmark        — mixed attack/benign (en / hi / hinglish).
 *  - EXPANDED_SAFE_INPUTS   — ~1.5k benign controls for an honest FPR measurement.
 *
 * Every case records its source so the published report can disclose exactly
 * what it was measured against.
 */
export function assembleGuardCorpus(): LabeledGuardCase[] {
  const cases: LabeledGuardCase[] = [];

  for (const ex of guardRedTeamBenchmark) {
    const isAttack = ex.category !== "SAFE_BASELINE" && ex.expectedAction !== "ALLOW";
    cases.push({
      id: `rt:${ex.id}`,
      text: ex.prompt,
      direction: ex.direction,
      isAttack,
      category: ex.category,
      source: "guardRedTeamBenchmark",
      owasp: ex.owasp ?? [],
    });
  }

  for (const ex of phase5Benchmark) {
    const isAttack = ex.label !== "SAFE";
    cases.push({
      id: `p5:${ex.id}`,
      text: ex.text,
      direction: ex.label === "UNSAFE_OUTPUT" ? "OUTPUT" : "INPUT",
      isAttack,
      category: ex.label,
      source: "phase5Benchmark",
      owasp: [],
    });
  }

  for (const ex of EXPANDED_SAFE_INPUTS) {
    cases.push({
      id: `safe:${ex.id}`,
      text: ex.text,
      direction: "INPUT",
      isAttack: false,
      category: "benign-control",
      source: "expandedSafeInputs",
      owasp: [],
    });
  }

  return cases;
}

// ─────────────────────────────────────────────────────────────────────────────
// Metrics.
// ─────────────────────────────────────────────────────────────────────────────

export interface RecallAtFprResult {
  targetFpr: number;
  /** Score threshold (flag when score > this) that meets the FPR budget. */
  threshold: number;
  recall: number;
  /** The FPR actually achieved at that threshold (≤ targetFpr). */
  fprAchieved: number;
  allowedFalsePositives: number;
}

/**
 * Recall at a fixed false-positive budget.
 *
 * We choose the LOWEST score threshold that still keeps the benign false-positive
 * rate at or below `targetFpr` (which maximizes recall subject to the budget),
 * then report the attack recall at that threshold. Ties at the cutoff score are
 * resolved conservatively (rejected together) so the achieved FPR never exceeds
 * the target.
 */
export function recallAtFpr(
  attackScores: number[],
  benignScores: number[],
  targetFpr: number,
): RecallAtFprResult {
  if (attackScores.length === 0 || benignScores.length === 0) {
    return { targetFpr, threshold: Infinity, recall: 0, fprAchieved: 0, allowedFalsePositives: 0 };
  }
  // Benign scores, highest first. We may "spend" `allowed` of them as false
  // positives; the next-highest benign is the score we must NOT flag.
  const sortedBenign = [...benignScores].sort((a, b) => b - a);
  const allowed = Math.floor(targetFpr * benignScores.length);
  const cutoffScore = sortedBenign[allowed] ?? -Infinity;
  const recall = attackScores.filter((s) => s > cutoffScore).length / attackScores.length;
  const fprAchieved = benignScores.filter((s) => s > cutoffScore).length / benignScores.length;
  return { targetFpr, threshold: cutoffScore, recall, fprAchieved, allowedFalsePositives: allowed };
}

/**
 * ROC-AUC via the Mann–Whitney U statistic (probability that a random attack is
 * scored higher than a random benign input). Handles ties with average ranks.
 * 0.5 = no separation, 1.0 = perfect separation. Threshold-independent.
 */
export function rocAuc(attackScores: number[], benignScores: number[]): number {
  const n1 = attackScores.length;
  const n2 = benignScores.length;
  if (n1 === 0 || n2 === 0) return 0.5;
  const labeled = [
    ...attackScores.map((s) => ({ s, attack: true })),
    ...benignScores.map((s) => ({ s, attack: false })),
  ].sort((a, b) => a.s - b.s);

  // Assign average ranks (1-based), resolving tie groups to their mean rank.
  const ranks = new Array<number>(labeled.length);
  let i = 0;
  while (i < labeled.length) {
    let j = i;
    while (j + 1 < labeled.length && labeled[j + 1].s === labeled[i].s) j += 1;
    const avgRank = (i + 1 + (j + 1)) / 2;
    for (let k = i; k <= j; k += 1) ranks[k] = avgRank;
    i = j + 1;
  }
  let rankSumAttack = 0;
  for (let k = 0; k < labeled.length; k += 1) if (labeled[k].attack) rankSumAttack += ranks[k];
  const u = rankSumAttack - (n1 * (n1 + 1)) / 2;
  return u / (n1 * n2);
}

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))];
}

// ─────────────────────────────────────────────────────────────────────────────
// Single-turn benchmark report.
// ─────────────────────────────────────────────────────────────────────────────

export interface CategoryRecall {
  category: string;
  total: number;
  detected: number;
  recall: number;
}

export interface HonestBenchmarkReport {
  generatedAtIso: string;
  corpus: {
    total: number;
    attacks: number;
    benign: number;
    sources: Record<string, { total: number; attacks: number; benign: number }>;
  };
  /** Metrics at the guard's real, shipped production threshold. */
  production: {
    /** Positive = any non-ALLOW action (block/review/rewrite/redaction). */
    precision: number;
    recall: number;
    f1: number;
    falsePositiveRate: number;
    falseNegativeRate: number;
    /** Strict subset: fraction of attacks fully hard-blocked or escalated. */
    blockOrReviewRate: number;
  };
  /** The headline honest metrics: recall at fixed FPR budgets + separability. */
  recallAtFpr: RecallAtFprResult[];
  rocAuc: number;
  perCategory: CategoryRecall[];
  latencyMs: { p50: number; p95: number; p99: number; max: number };
  limitations: string[];
}

const LIMITATIONS = [
  "Scores are from the deterministic production classifier (analyzeText) — no ML deep-scan tier is included in these numbers.",
  "Corpus is the datasets vendored in this repo (guardRedTeamBenchmark, phase5Benchmark, expandedSafeInputs). Drop real PINT/JailbreakBench/HarmBench corpora into datasets/external to benchmark against third-party sets.",
  "Single-turn metrics do not reflect multi-turn / adaptive attacks — see the separate multi-turn (Crescendo) evaluation.",
  "No external audit, no production-traffic replay, and no third-party certification are claimed by these numbers.",
];

export function runHonestBenchmark(corpus: LabeledGuardCase[] = assembleGuardCorpus()): HonestBenchmarkReport {
  const scored: ScoredCase[] = corpus.map((c) => ({ ...c, ...scoreWithGuard(c.text, c.direction) }));

  const attacks = scored.filter((c) => c.isAttack);
  const benign = scored.filter((c) => !c.isAttack);
  const attackScores = attacks.map((c) => c.score);
  const benignScores = benign.map((c) => c.score);

  // Production-threshold confusion matrix. Positive = any protective action
  // (mitigated), so a rewritten/redacted attack counts as caught. Benign inputs
  // that get rewritten/redacted count as false positives (real user friction).
  const tp = attacks.filter((c) => c.mitigated).length;
  const fn = attacks.length - tp;
  const fp = benign.filter((c) => c.mitigated).length;
  const tn = benign.length - fp;
  const precision = tp + fp ? tp / (tp + fp) : 0;
  const recall = attacks.length ? tp / attacks.length : 0;
  const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
  const blockOrReviewRate = attacks.length ? attacks.filter((c) => c.blocked).length / attacks.length : 0;

  // Per-source provenance.
  const sources: HonestBenchmarkReport["corpus"]["sources"] = {};
  for (const c of scored) {
    const bucket = sources[c.source] ?? { total: 0, attacks: 0, benign: 0 };
    bucket.total += 1;
    if (c.isAttack) bucket.attacks += 1;
    else bucket.benign += 1;
    sources[c.source] = bucket;
  }

  // Per-category recall (attack categories only). Uses the fair "mitigated"
  // definition so rewritten/redacted attacks count as detected.
  const catMap = new Map<string, { total: number; detected: number }>();
  for (const c of attacks) {
    const bucket = catMap.get(c.category) ?? { total: 0, detected: 0 };
    bucket.total += 1;
    if (c.mitigated) bucket.detected += 1;
    catMap.set(c.category, bucket);
  }
  const perCategory: CategoryRecall[] = [...catMap.entries()]
    .map(([category, b]) => ({ category, total: b.total, detected: b.detected, recall: b.detected / b.total }))
    .sort((a, b) => a.recall - b.recall);

  const latencies = scored.map((c) => c.latencyMs).sort((a, b) => a - b);

  return {
    generatedAtIso: new Date().toISOString(),
    corpus: { total: scored.length, attacks: attacks.length, benign: benign.length, sources },
    production: {
      precision,
      recall,
      f1,
      falsePositiveRate: fp + tn ? fp / (fp + tn) : 0,
      falseNegativeRate: fn + tp ? fn / (fn + tp) : 0,
      blockOrReviewRate,
    },
    recallAtFpr: [recallAtFpr(attackScores, benignScores, 0.01), recallAtFpr(attackScores, benignScores, 0.001)],
    rocAuc: rocAuc(attackScores, benignScores),
    perCategory,
    latencyMs: {
      p50: percentile(latencies, 0.5),
      p95: percentile(latencies, 0.95),
      p99: percentile(latencies, 0.99),
      max: latencies[latencies.length - 1] ?? 0,
    },
    limitations: LIMITATIONS,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Multi-turn / adaptive (Crescendo) evaluation.
// ─────────────────────────────────────────────────────────────────────────────

export interface MultiTurnSequence {
  id: string;
  /** Ordered conversation turns (user messages). */
  turns: string[];
  /** true = the session as a whole is a Crescendo attack the guard should catch. */
  isAttack: boolean;
  category?: string;
}

export interface MultiTurnResult {
  id: string;
  isAttack: boolean;
  escalated: boolean;
  finalLevel: "NONE" | "WATCH" | "ESCALATED";
  peakPressure: number;
  /** Turn index (0-based) at which the session first reached ESCALATED, or -1. */
  detectedAtTurn: number;
  correct: boolean;
}

export interface MultiTurnReport {
  total: number;
  attacks: number;
  benign: number;
  /** Fraction of attack sessions caught (reached ESCALATED) — multi-turn recall. */
  recall: number;
  /** Fraction of benign sessions wrongly escalated — multi-turn FPR. */
  falsePositiveRate: number;
  /** Mean turns needed to catch a detected attack (lower = faster). */
  meanTurnsToDetect: number;
  results: MultiTurnResult[];
}

const SECURITY_SEQUENCE_RISK = new Set(["PROMPT_INJECTION", "JAILBREAK", "SYSTEM_PROMPT_LEAK_ATTEMPT"]);

/**
 * Drives a conversation through the real per-turn guard, feeding each turn's
 * result into the pure Crescendo escalation scorer (no Redis). Reports whether
 * the session-level defense catches the gradual attack and how many turns it
 * took — the dimension static single-turn benchmarks miss entirely.
 */
export function runMultiTurnBenchmark(sequences: MultiTurnSequence[]): MultiTurnReport {
  const results: MultiTurnResult[] = sequences.map((seq) => {
    const window: CrescendoTurn[] = [];
    let peakPressure = 0;
    let detectedAtTurn = -1;
    let finalLevel: MultiTurnResult["finalLevel"] = "NONE";

    seq.turns.forEach((message, index) => {
      const guard = analyzeText(message, "INPUT");
      window.push({
        at: index,
        riskScore: guard.riskScore,
        securityRisk: guard.riskTypes.some((t) => SECURITY_SEQUENCE_RISK.has(t)),
        scaffold: detectCrescendoScaffold(message),
      });
      const assessment = assessCrescendo(window);
      finalLevel = assessment.level;
      peakPressure = Math.max(peakPressure, assessment.pressureScore);
      if (assessment.level === "ESCALATED" && detectedAtTurn === -1) detectedAtTurn = index;
    });

    const escalated = detectedAtTurn !== -1;
    return {
      id: seq.id,
      isAttack: seq.isAttack,
      escalated,
      finalLevel,
      peakPressure,
      detectedAtTurn,
      correct: escalated === seq.isAttack,
    };
  });

  const attacks = results.filter((r) => r.isAttack);
  const benign = results.filter((r) => !r.isAttack);
  const detectedAttacks = attacks.filter((r) => r.escalated);
  const meanTurnsToDetect = detectedAttacks.length
    ? detectedAttacks.reduce((sum, r) => sum + r.detectedAtTurn + 1, 0) / detectedAttacks.length
    : 0;

  return {
    total: results.length,
    attacks: attacks.length,
    benign: benign.length,
    recall: attacks.length ? detectedAttacks.length / attacks.length : 0,
    falsePositiveRate: benign.length ? benign.filter((r) => r.escalated).length / benign.length : 0,
    meanTurnsToDetect,
    results,
  };
}
