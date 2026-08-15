/**
 * Continuous learning — the promotion gate.
 *
 * WHY THIS EXISTS
 *   This is the single component that makes an automatic loop safe to run, and it
 *   exists because of a measured failure in this very repo: v4 was newer than v3
 *   and WORSE (51.29% vs 57.93% recall on identical rows — 529 abstentions ate the
 *   difference). A loop that promotes whatever it just trained would have shipped
 *   that regression automatically, and would then have trained the next round on
 *   traffic the regressed model mislabelled.
 *
 *   So: nothing is promoted because it is new, because a job finished, or because
 *   a loss curve went down. A candidate is promoted only when it beats the current
 *   production config ON A FROZEN EVALUATION SET THAT THE CANDIDATE NEVER SAW, at
 *   an FPR the operator has budgeted for.
 *
 * FAIL-CLOSED
 *   Missing evidence is never treated as passing evidence. An absent field, a
 *   golden-set hash that does not match, a benign-free eval set — all REJECT. The
 *   default answer is "do not promote".
 *
 * WHAT THIS DOES NOT DO
 *   It does not train, deploy, or write. It returns a verdict plus the blockers.
 *   Deployment stays with lib/ml/rollout.ts (SHADOW -> PARTIAL -> FULL), which is
 *   already staged, so promotion means "advance one stage", not "go live now".
 */

/** One measurement of one config against one evaluation set. */
export interface EvalSnapshot {
  /** Human-readable id of the eval set, e.g. "crossdist-eval-v3". */
  goldenSetId: string;
  /**
   * Content hash of the eval rows. The gate compares this to the frozen hash it
   * was handed; a mismatch means the ground truth moved underneath the comparison,
   * which makes the delta meaningless.
   */
  goldenSetHash: string;
  rows: number;
  attacks: number;
  benign: number;
  /** Attack recall in [0,1]. */
  recall: number;
  /** Benign false-positive rate in [0,1]. */
  fpr: number;
}

export interface PromotionBudget {
  /**
   * How much recall the operator will give up, in percentage POINTS. Default 0:
   * a candidate that detects fewer attacks does not ship, full stop.
   */
  maxRecallDropPts: number;
  /**
   * How much benign false-positive rate may rise, in percentage POINTS. Default
   * 0.5 — the measured semantic-margin win cost 0.22 pts, so 0.5 leaves room for
   * a real trade without permitting an over-defense drift.
   */
  maxFprRisePts: number;
  /** Below this the deltas are sampling noise, not a result. */
  minGoldenRows: number;
  /** Shadow evidence required before a candidate may advance at all. */
  minShadowRequests: number;
  minShadowMs: number;
}

export const DEFAULT_PROMOTION_BUDGET: PromotionBudget = {
  maxRecallDropPts: 0,
  maxFprRisePts: 0.5,
  minGoldenRows: 500,
  minShadowRequests: 1000,
  minShadowMs: 24 * 60 * 60 * 1000,
};

export interface PromotionRequest {
  candidateId: string;
  /** Current production config measured on the frozen set. */
  baseline: EvalSnapshot;
  /** The candidate measured on the SAME frozen set. */
  candidate: EvalSnapshot;
  /** The hash the gate requires both snapshots to carry. */
  frozenGoldenSetHash: string;
  /** Live shadow-mode evidence accumulated by lib/ml/rollout.ts. */
  shadowRequests?: number;
  shadowRunMs?: number;
  /**
   * True when any row of the candidate's training data shares a fingerprint with
   * the golden set. Harvest excludes them, but the gate re-asserts it: this is the
   * one error that makes every number above meaningless.
   */
  trainingOverlapsGoldenSet?: boolean;
  budget?: Partial<PromotionBudget>;
}

export type PromotionVerdict =
  /** Beats production on frozen evidence, inside budget. Advance one rollout stage. */
  | "PROMOTE"
  /** Not wrong, just not yet proven. Keep it in shadow and re-run. */
  | "HOLD"
  /** Measured worse, or the evidence cannot be trusted. Do not advance. */
  | "REJECT";

export interface PromotionBlocker {
  code:
    | "golden-set-mismatch"
    | "golden-set-too-small"
    | "eval-set-one-sided"
    | "training-overlaps-golden-set"
    | "recall-regression"
    | "fpr-regression"
    | "insufficient-shadow-evidence"
    | "no-measured-gain"
    | "impossible-metric";
  severity: "HOLD" | "REJECT";
  message: string;
}

export interface PromotionDecision {
  candidateId: string;
  verdict: PromotionVerdict;
  promote: boolean;
  deltas: { recallPts: number; fprPts: number };
  blockers: PromotionBlocker[];
  /** One line an operator can read in an alert without opening anything. */
  summary: string;
}

function pts(value: number): number {
  return Number((value * 100).toFixed(2));
}

function isRate(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

/**
 * Decide whether a candidate may advance. Pure, deterministic, no I/O — so the
 * same evidence always yields the same verdict and the decision is reproducible
 * from the artifact alone.
 */
export function evaluatePromotion(request: PromotionRequest): PromotionDecision {
  const budget: PromotionBudget = { ...DEFAULT_PROMOTION_BUDGET, ...(request.budget ?? {}) };
  const { baseline, candidate } = request;
  const blockers: PromotionBlocker[] = [];

  // --- evidence integrity first. A bad delta is worse than no delta. ---

  if (
    baseline.goldenSetHash !== request.frozenGoldenSetHash ||
    candidate.goldenSetHash !== request.frozenGoldenSetHash
  ) {
    blockers.push({
      code: "golden-set-mismatch",
      severity: "REJECT",
      message:
        `eval set is not the frozen one (expected ${request.frozenGoldenSetHash}, ` +
        `baseline ${baseline.goldenSetHash}, candidate ${candidate.goldenSetHash}) — the delta is not a comparison`,
    });
  }

  if (request.trainingOverlapsGoldenSet) {
    blockers.push({
      code: "training-overlaps-golden-set",
      severity: "REJECT",
      message: "candidate trained on rows present in the golden set — every metric below is fitted to its own test",
    });
  }

  if (!isRate(baseline.recall) || !isRate(candidate.recall) || !isRate(baseline.fpr) || !isRate(candidate.fpr)) {
    blockers.push({
      code: "impossible-metric",
      severity: "REJECT",
      message: "recall/fpr outside [0,1] or missing — evidence is malformed",
    });
  }

  if (candidate.rows < budget.minGoldenRows) {
    blockers.push({
      code: "golden-set-too-small",
      severity: "REJECT",
      message: `${candidate.rows} eval rows is below the ${budget.minGoldenRows}-row floor — the deltas are noise`,
    });
  }

  if (candidate.attacks === 0 || candidate.benign === 0) {
    blockers.push({
      code: "eval-set-one-sided",
      severity: "REJECT",
      message:
        `eval set has ${candidate.attacks} attacks / ${candidate.benign} benign — ` +
        "a one-sided set cannot measure the trade this gate exists to bound",
    });
  }

  // --- then the actual trade ---

  const recallPts = pts(candidate.recall - baseline.recall);
  const fprPts = pts(candidate.fpr - baseline.fpr);

  if (-recallPts > budget.maxRecallDropPts) {
    blockers.push({
      code: "recall-regression",
      severity: "REJECT",
      message: `recall ${recallPts} pts vs production (budget allows -${budget.maxRecallDropPts}) — this is the v3->v4 regression shape`,
    });
  }

  if (fprPts > budget.maxFprRisePts) {
    blockers.push({
      code: "fpr-regression",
      severity: "REJECT",
      message: `benign FPR +${fprPts} pts exceeds the +${budget.maxFprRisePts} pt budget`,
    });
  }

  // --- then whether we have earned the right to touch production at all ---

  const shadowRequests = request.shadowRequests ?? 0;
  const shadowRunMs = request.shadowRunMs ?? 0;
  if (shadowRequests < budget.minShadowRequests || shadowRunMs < budget.minShadowMs) {
    blockers.push({
      code: "insufficient-shadow-evidence",
      severity: "HOLD",
      message:
        `shadow evidence ${shadowRequests} requests over ${Math.round(shadowRunMs / 3_600_000)}h ` +
        `is below ${budget.minShadowRequests} requests / ${Math.round(budget.minShadowMs / 3_600_000)}h`,
    });
  }

  // A candidate that is merely equal is not an improvement. Churning production
  // for a flat result costs a rollout window and teaches the loop nothing.
  if (recallPts <= 0 && fprPts >= 0) {
    blockers.push({
      code: "no-measured-gain",
      severity: "HOLD",
      message: `no measured gain (recall ${recallPts} pts, FPR ${fprPts} pts) — keep the current config`,
    });
  }

  const rejected = blockers.some((b) => b.severity === "REJECT");
  const verdict: PromotionVerdict = rejected ? "REJECT" : blockers.length > 0 ? "HOLD" : "PROMOTE";

  const summary =
    verdict === "PROMOTE"
      ? `${request.candidateId}: PROMOTE — recall ${recallPts >= 0 ? "+" : ""}${recallPts} pts, FPR ${fprPts >= 0 ? "+" : ""}${fprPts} pts on ${candidate.rows} frozen rows`
      : `${request.candidateId}: ${verdict} — ${blockers[0]?.message ?? "no evidence"}`;

  return {
    candidateId: request.candidateId,
    verdict,
    promote: verdict === "PROMOTE",
    deltas: { recallPts, fprPts },
    blockers,
    summary,
  };
}
