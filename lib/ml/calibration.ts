/**
 * SoterLLM calibration helpers (v4+).
 *
 * The trainer (scripts/ml/train-soterllm-v4.py) writes calibration.json with:
 *   - temperature (already baked into ONNX logits for v4 exports)
 *   - per_label_thresholds fitted for a target FPR on the calibration split
 *   - ood.suggested_abstain_max_prob for low-confidence abstention
 *
 * This module loads that artifact and applies thresholds / OOD decisions at
 * inference time so production scores are real operating points, not raw
 * softmax argmax.
 */

import * as fs from "node:fs";
import type { MLLabel } from "@prisma/client";

export interface OodStats {
  max_prob_p05?: number;
  max_prob_mean?: number;
  entropy_mean?: number;
  entropy_p95?: number;
  suggested_abstain_max_prob?: number;
}

export interface CalibrationConfig {
  product?: string;
  version?: string;
  /** Temperature used at export. v4 bakes T into ONNX; keep for diagnostics. */
  temperature: number;
  ece_before?: number;
  ece_after?: number;
  target_fpr?: number;
  per_label_thresholds: Partial<Record<MLLabel | string, number>>;
  ood: OodStats;
  notes?: string;
}

const DEFAULT_CALIBRATION: CalibrationConfig = {
  temperature: 1.0,
  per_label_thresholds: {},
  ood: { suggested_abstain_max_prob: 0.35 },
};

export function loadCalibration(path: string | undefined | null): CalibrationConfig {
  if (!path) return { ...DEFAULT_CALIBRATION, per_label_thresholds: {}, ood: { ...DEFAULT_CALIBRATION.ood } };
  try {
    if (!fs.existsSync(path)) {
      return { ...DEFAULT_CALIBRATION, per_label_thresholds: {}, ood: { ...DEFAULT_CALIBRATION.ood } };
    }
    const raw = JSON.parse(fs.readFileSync(path, "utf-8")) as Partial<CalibrationConfig>;
    return {
      product: raw.product,
      version: raw.version,
      temperature: typeof raw.temperature === "number" && raw.temperature > 0 ? raw.temperature : 1.0,
      ece_before: raw.ece_before,
      ece_after: raw.ece_after,
      target_fpr: raw.target_fpr,
      per_label_thresholds: raw.per_label_thresholds ?? {},
      ood: {
        ...DEFAULT_CALIBRATION.ood,
        ...(raw.ood ?? {}),
      },
      notes: raw.notes,
    };
  } catch {
    return { ...DEFAULT_CALIBRATION, per_label_thresholds: {}, ood: { ...DEFAULT_CALIBRATION.ood } };
  }
}

/**
 * Entropy of a probability distribution (natural log). Higher = more uncertain.
 */
export function entropy(probs: number[]): number {
  let e = 0;
  for (const p of probs) {
    if (p > 1e-12) e -= p * Math.log(p);
  }
  return e;
}

/**
 * Decide whether to abstain given max class probability and optional entropy.
 * Abstention means "model is not confident enough to escalate" — never "SAFE".
 */
export function shouldAbstain(
  maxProb: number,
  probs: number[],
  calibration: CalibrationConfig,
): boolean {
  const floor = calibration.ood.suggested_abstain_max_prob ?? 0.35;
  if (maxProb < floor) return true;
  const entP95 = calibration.ood.entropy_p95;
  if (typeof entP95 === "number" && entropy(probs) > entP95) return true;
  return false;
}

/**
 * Apply a per-label threshold. If the predicted attack label's probability is
 * below its calibrated threshold, demote to SAFE (or keep as low-confidence
 * attack for shadow mode — caller decides). Returns whether the prediction
 * clears the operating point.
 */
export function clearsLabelThreshold(
  label: string,
  confidence: number,
  calibration: CalibrationConfig,
  fallbackFloor: number,
): boolean {
  if (label === "SAFE") return true;
  const thr = calibration.per_label_thresholds[label];
  if (typeof thr === "number" && Number.isFinite(thr)) {
    return confidence >= thr;
  }
  return confidence >= fallbackFloor;
}

/**
 * Primary security risk score: P(attack) = 1 - P(SAFE).
 * Prefer this over argmax confidence when ranking / fusing with rules.
 */
export function attackProbability(probabilities: number[], safeIndex = 0): number {
  if (!probabilities.length) return 0;
  const pSafe = probabilities[safeIndex] ?? 0;
  return Math.max(0, Math.min(1, 1 - pSafe));
}
