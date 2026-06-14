// Phase 6: ML classifier registry + workflow.
// Defensive-only ML layer. Rule-based detectors always run; an ML model can be
// promoted to SHADOW / PARTIAL / FULL rollout and is bypassed automatically on
// any failure.

import { analyzeText } from "../guard/analyze";
import { redactText } from "../guard/redactor";
import type { GuardDirection } from "../guard/types";
import type { MLLabel } from "@prisma/client";

export type MLBackend = "heuristic" | "external-api";

export interface MLDatasetExampleInput {
  text: string;
  label: MLLabel;
  language?: string;
  source?: string;
  metadata?: Record<string, unknown>;
}

export interface NormalizedExample extends MLDatasetExampleInput {
  redactedText: string;
}

export interface ModelPrediction {
  label: MLLabel;
  confidence: number;
  modelVersionId: string;
  backend: MLBackend;
  reason: string;
}

export interface ModelInference {
  predictedLabel: MLLabel;
  confidence: number;
  raw?: Record<string, unknown>;
}

export interface ModelBackend {
  id: MLBackend;
  infer(text: string, direction: GuardDirection): Promise<ModelInference>;
}

// Sensitive content (secrets, PII) must be redacted before persistence or
// external evaluation. We piggy-back on the rule-based redactor so the same
// findings used in production also gate ML data.
export function redactBeforePersistence(text: string, direction: GuardDirection = "INPUT"): string {
  try {
    const guard = analyzeText(text, direction);
    const redacted = redactText(text, guard.findings ?? []);
    return redacted;
  } catch {
    // If redaction itself fails (should not happen), drop the text rather than
    // risk leaking raw secrets.
    return "[REDACTED]";
  }
}

export function normalizeExample(example: MLDatasetExampleInput): NormalizedExample {
  return {
    ...example,
    redactedText: redactBeforePersistence(example.text),
  };
}
