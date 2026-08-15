/**
 * Continuous learning — the harvester.
 *
 * WHY THIS EXISTS
 *   A self-training loop's quality is decided here, not in the trainer. Two
 *   things are true and both are measured facts from this repo:
 *
 *     1. Volume is not the lever. After the semantic-veto fix, only 1.7% of the
 *        crossdist rows are true model failures (`safe-label`); the rest were
 *        gate decisions. Feeding the trainer another 279k random rows moves
 *        almost nothing (artifacts/ml/margin-sweep/*). What moves the model is
 *        rows it is CONFUSED about.
 *     2. The loop is an attack surface. It reads production traffic, so an
 *        attacker can write to it. The cheapest attack is not a clever prompt —
 *        it is submitting real attacks until something labels them benign, which
 *        deletes the class from the next model.
 *
 *   So this module does exactly two jobs: uncertainty sampling (what is worth
 *   learning) and a labelling policy that is deliberately asymmetric about who
 *   is allowed to say "benign".
 *
 * WHAT THIS MODULE DOES NOT DO
 *   It does not train, does not write to a dataset, and does not promote
 *   anything. Its output is a quarantined candidate list. Release is a separate,
 *   human-gated step, and promotion is gated again by promotionGate.ts.
 */

import { createHash } from "node:crypto";
import {
  SOURCE_TRUST,
  type GuardObservation,
  type HarvestCandidate,
  type LearningSignal,
  type LearningSource,
} from "./types";

/**
 * How close to a gate threshold counts as a "near miss" worth learning from.
 * 0.05 is not arbitrary: the v7 margin sweep found 396 of 476 semantically
 * vetoed attacks sat within 0.05 of the gate, i.e. the informative band is
 * exactly this wide (artifacts/ml/margin-sweep/m000.json).
 */
export const NEAR_MISS_BAND = 0.05;

/**
 * Weight per signal. These are priorities, not probabilities — they only need to
 * order rows correctly, and the ordering is the same one the measurement found:
 * human ground truth > cross-tier disagreement > the model's own uncertainty.
 */
const SIGNAL_WEIGHT: Record<LearningSignal, number> = {
  "human-override": 1.0,
  "rules-ml-disagreement": 0.7,
  "teacher-disagreement": 0.55,
  "ml-abstained": 0.4,
  "gate-near-miss": 0.35,
};

/** Normalize before hashing so trivial respacing does not defeat dedup. */
function fingerprintOf(text: string): string {
  const normalized = text.normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase();
  return createHash("sha256").update(normalized).digest("hex").slice(0, 32);
}

/**
 * Which signals a single observation carries. A row with no signal is a row the
 * stack handled confidently — it is dropped, however much of it arrives.
 */
export function detectSignals(observation: GuardObservation): LearningSignal[] {
  const signals: LearningSignal[] = [];
  const ml = observation.ml;

  if (observation.humanOverrodeTo) signals.push("human-override");

  if (ml && typeof ml.attackProbability === "number") {
    // Disagreement is measured against the same 0.5 point both tiers imply, not
    // against the production floor: we want rows where the tiers genuinely point
    // in opposite directions, not rows sitting under a conservative threshold.
    const mlSaysAttack = ml.attackProbability >= 0.5;
    if (mlSaysAttack !== observation.rulesFlagged) signals.push("rules-ml-disagreement");
  }

  if (ml?.abstained) signals.push("ml-abstained");

  // A gate discarded a prediction the model DID make. Only informative when the
  // decision was close — a text the semantic tier considers wildly benign is a
  // model problem, not a threshold problem, and no amount of it teaches the gate.
  if (ml?.gatedBy === "semantic-benign" && observation.semantic) {
    const margin = observation.semantic.score - observation.semantic.benignSimilarity;
    if (margin >= -NEAR_MISS_BAND) signals.push("gate-near-miss");
  }
  if (ml?.gatedBy === "confidence-floor" && typeof ml.confidence === "number") {
    const floor = Number(process.env.ML_ONNX_CONFIDENCE_FLOOR ?? "0.9");
    if (ml.confidence >= floor - NEAR_MISS_BAND) signals.push("gate-near-miss");
  }

  if (observation.teacherVerdict && ml && typeof ml.attackProbability === "number") {
    const ours = ml.attackProbability >= 0.5 ? "attack" : "benign";
    if (ours !== observation.teacherVerdict) signals.push("teacher-disagreement");
  }

  return signals;
}

/**
 * Learning value in [0,1]. Signals combine with diminishing returns rather than
 * summing, so one row carrying four weak signals cannot outrank a human override.
 */
export function scoreLearningValue(signals: LearningSignal[]): number {
  let remaining = 1;
  for (const signal of [...signals].sort((a, b) => SIGNAL_WEIGHT[b] - SIGNAL_WEIGHT[a])) {
    remaining *= 1 - SIGNAL_WEIGHT[signal];
  }
  return Number((1 - remaining).toFixed(4));
}

export interface LabelDecision {
  autoLabel: "attack" | "benign" | null;
  rationale: string;
}

/**
 * THE POISONING RULE, in one function.
 *
 *   A `benign` label is only ever accepted from a TRUSTED source.
 *
 * Rationale: mislabelling an attack as benign deletes detection capability and
 * is silent — the next model simply stops firing, and the eval set will not
 * notice if the attack shape is novel. Mislabelling a benign as attack costs
 * precision, which every FPR gate in the stack already measures and will catch.
 * The two errors are not symmetric, so the policy is not symmetric either.
 *
 * For untrusted sources we accept an `attack` label only on CORROBORATION — two
 * independent detectors agreeing — so a single spoofable signal cannot inject
 * rows either.
 */
export function decideLabel(observation: GuardObservation): LabelDecision {
  const trust = SOURCE_TRUST[observation.source];

  if (trust === "trusted") {
    if (observation.humanOverrodeTo) {
      return {
        autoLabel: observation.humanOverrodeTo,
        rationale: `human override from ${observation.source}`,
      };
    }
    if (observation.humanLabel) {
      return {
        autoLabel: observation.humanLabel === "SAFE" ? "benign" : "attack",
        rationale: `human label ${observation.humanLabel}`,
      };
    }
    return { autoLabel: null, rationale: "trusted source but no human label — needs review" };
  }

  // ---- untrusted from here down ----

  // Never auto-learn "benign" from a source an attacker can write to, no matter
  // how confident every tier is. This is the whole defence against label flooding.
  const ml = observation.ml;
  const mlSaysAttack = typeof ml?.attackProbability === "number" && ml.attackProbability >= 0.5;

  if (!observation.rulesFlagged && !mlSaysAttack) {
    return {
      autoLabel: null,
      rationale: "untrusted source may not auto-assign benign (label-flooding defence)",
    };
  }

  // Corroboration: rules and ML must BOTH call it an attack, or one of them plus
  // an independent third-party detector.
  const corroborators = [
    observation.rulesFlagged,
    mlSaysAttack,
    observation.teacherVerdict === "attack",
  ].filter(Boolean).length;

  if (corroborators >= 2) {
    return { autoLabel: "attack", rationale: `corroborated attack (${corroborators} independent detectors)` };
  }

  return { autoLabel: null, rationale: "single uncorroborated detector — needs review" };
}

export interface HarvestOptions {
  /** Rows below this learning value are dropped. Default 0.3. */
  minValue?: number;
  /** Hard cap per source per run, so one noisy tenant cannot dominate a batch. */
  maxPerSource?: number;
  /**
   * Fingerprints that must never be harvested — the frozen evaluation set.
   * Feeding the eval set back into training is how a self-training loop starts
   * reporting numbers it cannot reproduce on anything new.
   */
  excludeFingerprints?: ReadonlySet<string>;
}

export interface HarvestResult {
  candidates: HarvestCandidate[];
  /** Why rows were dropped. Reported, never silent — a loop that silently drops is unauditable. */
  dropped: {
    noSignal: number;
    belowValue: number;
    duplicate: number;
    evalSetOverlap: number;
    sourceCap: number;
  };
}

/**
 * Turn a batch of production observations into a quarantined candidate list.
 * Pure and deterministic: no clock, no network, no I/O.
 */
export function harvestCandidates(
  observations: readonly GuardObservation[],
  options: HarvestOptions = {},
): HarvestResult {
  const minValue = options.minValue ?? 0.3;
  const maxPerSource = options.maxPerSource ?? 500;
  const exclude = options.excludeFingerprints ?? new Set<string>();

  const dropped: HarvestResult["dropped"] = {
    noSignal: 0,
    belowValue: 0,
    duplicate: 0,
    evalSetOverlap: 0,
    sourceCap: 0,
  };

  const seen = new Map<string, HarvestCandidate>();
  const scored: HarvestCandidate[] = [];

  for (const observation of observations) {
    const signals = detectSignals(observation);
    if (signals.length === 0) {
      dropped.noSignal += 1;
      continue;
    }

    const value = scoreLearningValue(signals);
    if (value < minValue) {
      dropped.belowValue += 1;
      continue;
    }

    const fingerprint = fingerprintOf(observation.text);
    if (exclude.has(fingerprint)) {
      dropped.evalSetOverlap += 1;
      continue;
    }

    const existing = seen.get(fingerprint);
    if (existing) {
      // Keep the more informative copy, and remember it was seen twice by merging
      // signals — repeat sightings of the same confusing text are evidence, not noise.
      dropped.duplicate += 1;
      existing.signals = [...new Set([...existing.signals, ...signals])];
      existing.value = scoreLearningValue(existing.signals);
      continue;
    }

    const { autoLabel, rationale } = decideLabel(observation);
    const candidate: HarvestCandidate = {
      fingerprint,
      text: observation.text,
      direction: observation.direction,
      source: observation.source,
      signals,
      value,
      autoLabel,
      labelRationale: rationale,
      quarantined: SOURCE_TRUST[observation.source] === "untrusted",
      observedAt: observation.observedAt,
    };
    seen.set(fingerprint, candidate);
    scored.push(candidate);
  }

  // Cap per source AFTER scoring so the cap keeps the most informative rows
  // rather than whichever arrived first.
  const perSource = new Map<LearningSource, number>();
  const candidates: HarvestCandidate[] = [];
  for (const candidate of [...scored].sort((a, b) => b.value - a.value)) {
    const used = perSource.get(candidate.source) ?? 0;
    if (used >= maxPerSource) {
      dropped.sourceCap += 1;
      continue;
    }
    perSource.set(candidate.source, used + 1);
    candidates.push(candidate);
  }

  return { candidates, dropped };
}
