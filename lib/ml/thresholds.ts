// Phase 6: confidence calibration / threshold helpers used by the registry.
// Thresholds are stored on each MLModelVersion. They act as confidence floors
// per label: a prediction below its threshold falls back to "SAFE" so the
// rule-based detectors stay authoritative.

import type { MLLabel } from "@prisma/client";

export const DEFAULT_THRESHOLDS: Record<MLLabel, number> = {
  SAFE: 0,
  PROMPT_INJECTION: 0.6,
  JAILBREAK: 0.65,
  SYSTEM_PROMPT_LEAK_ATTEMPT: 0.6,
  PII: 0.5,
  SECRET: 0.5,
  UNSAFE_OUTPUT: 0.55,
  RAG_POISONING: 0.6,
  DATA_EXFILTRATION_ATTEMPT: 0.6,
};

export function mergeThresholds(custom?: Partial<Record<MLLabel, number>> | null): Record<MLLabel, number> {
  const merged = { ...DEFAULT_THRESHOLDS };
  if (!custom) return merged;
  for (const [key, value] of Object.entries(custom)) {
    if (typeof value === "number" && value >= 0 && value <= 1) {
      merged[key as MLLabel] = value;
    }
  }
  return merged;
}

export function expectedCalibrationError(predictions: Array<{ confidence: number; correct: boolean }>): number {
  if (!predictions.length) return 0;
  const buckets = new Array(10).fill(null).map(() => ({ total: 0, correct: 0, sumConf: 0 }));
  for (const item of predictions) {
    const idx = Math.min(9, Math.floor(item.confidence * 10));
    buckets[idx].total += 1;
    buckets[idx].sumConf += item.confidence;
    if (item.correct) buckets[idx].correct += 1;
  }
  const total = predictions.length;
  let ece = 0;
  for (const bucket of buckets) {
    if (!bucket.total) continue;
    const accuracy = bucket.correct / bucket.total;
    const confidence = bucket.sumConf / bucket.total;
    ece += (bucket.total / total) * Math.abs(confidence - accuracy);
  }
  return ece;
}
