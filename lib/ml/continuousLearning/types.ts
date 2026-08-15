/**
 * Continuous learning — shared types.
 *
 * WHY THIS EXISTS
 *   The ask is a model that keeps getting stronger on its own, on whatever new
 *   attack shows up in the market. The dangerous half of that sentence is "on its
 *   own": an unattended loop that ingests live traffic is a supply chain an
 *   attacker can write to. The cheapest attack on a self-training detector is not
 *   a clever prompt — it is flooding the loop with real attacks labelled BENIGN
 *   until the model unlearns the class.
 *
 *   So the loop is split into four pieces with different trust levels and
 *   different clocks, and the types below are what flows between them:
 *
 *     observe   (this file: GuardObservation)   every request, no cost
 *     harvest   (harvest.ts)                    minutes — pick what is worth learning
 *     validate  (retrainingValidation.ts)       existing poison gate
 *     promote   (promotionGate.ts)              only on frozen-eval evidence
 *
 *   Nothing here trains anything. These types deliberately carry PROVENANCE and
 *   TRUST on every row, because the promotion gate's job is to refuse rows whose
 *   origin cannot be established.
 */

import type { MLLabel } from "@prisma/client";
import type { MlGateReason } from "../../guard/mlAugment";

/**
 * Where a row came from, ordered by how much of it we are willing to believe.
 * The ordering matters: `benign` labels are only ever accepted from TRUSTED
 * sources (see harvest.ts / LABEL_POLICY), because a benign label is the one an
 * attacker wants to inject.
 */
export type LearningSource =
  /** A human on our side reviewed and labelled it (lib/ml/feedback.ts). Ground truth. */
  | "human-review"
  /** Our own curated corpora and generators. Trusted, but not ground truth for novelty. */
  | "internal-corpus"
  /** Live customer traffic. High value, ZERO trust — an attacker can write to it. */
  | "customer-traffic"
  /** Public threat feeds / scraped attack collections. High novelty, ZERO trust. */
  | "public-feed";

export const SOURCE_TRUST: Record<LearningSource, "trusted" | "untrusted"> = {
  "human-review": "trusted",
  "internal-corpus": "trusted",
  "customer-traffic": "untrusted",
  "public-feed": "untrusted",
};

/**
 * Why a row is worth learning from. This is uncertainty sampling: a row the stack
 * already handles confidently teaches nothing, no matter how many of them arrive.
 * 1,000 rows the stack is confused about beat 1,000,000 it already gets right.
 */
export type LearningSignal =
  /** Rules said attack, ML said safe (or vice versa). The single richest signal. */
  | "rules-ml-disagreement"
  /** Calibration declined to decide — by construction this is the model's own "I don't know". */
  | "ml-abstained"
  /** A gate threw away a prediction while sitting within a hair of the threshold. */
  | "gate-near-miss"
  /** A human overrode the shipped verdict. Ground truth AND a known production error. */
  | "human-override"
  /** An independent third-party detector disagrees with us on the same text. */
  | "teacher-disagreement";

/**
 * One production guard decision, flattened into the fields the loop can learn
 * from. `text` MUST already be redacted (lib/ml/types.ts redactBeforePersistence)
 * before an observation is constructed — this type is persisted and re-read.
 */
export interface GuardObservation {
  id: string;
  /** Redacted text. Never raw customer content, never a raw secret. */
  text: string;
  direction: "INPUT" | "OUTPUT";
  source: LearningSource;
  observedAt: number;

  /** What the deterministic tier concluded. */
  rulesFlagged: boolean;

  /** What the ONNX tier concluded, as recorded in guard metadata.ml. */
  ml?: {
    predictedLabel?: string;
    confidence?: number;
    /** 1 - P(SAFE). The primary security score. */
    attackProbability?: number;
    abstained?: boolean;
    /** Set when the model predicted an attack but a gate refused to act. */
    gatedBy?: MlGateReason;
  };

  /** The dependency-free semantic classifier's view, used to spot near-miss vetoes. */
  semantic?: { score: number; benignSimilarity: number; family?: string };

  /** Set only when a human on our side labelled it. Ground truth. */
  humanLabel?: MLLabel;
  /** Set when a human reversed the shipped verdict — a known production error. */
  humanOverrodeTo?: "attack" | "benign";

  /** An independent detector's binary call on the same text, when we ran one. */
  teacherVerdict?: "attack" | "benign";
}

/**
 * A row the harvester decided is worth keeping. It is NOT training data yet:
 * everything untrusted lands `quarantined` and must clear
 * validateRetrainingDataset + a human release before it can reach a trainer.
 */
export interface HarvestCandidate {
  /** Stable hash of the normalized text. Dedup key across every window. */
  fingerprint: string;
  text: string;
  direction: "INPUT" | "OUTPUT";
  source: LearningSource;
  signals: LearningSignal[];
  /** Higher = more informative. See scoreLearningValue. */
  value: number;
  /**
   * The label we are willing to auto-assign, or null when the loop refuses to
   * guess. null is a normal, common outcome — it means "a human must label this".
   */
  autoLabel: "attack" | "benign" | null;
  /** Why autoLabel is what it is. Written into the dataset row's provenance. */
  labelRationale: string;
  /** Untrusted rows are quarantined. Quarantined rows never reach a trainer. */
  quarantined: boolean;
  observedAt: number;
}
