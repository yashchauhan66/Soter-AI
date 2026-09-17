// Phase 6: ML classifier registry + workflow.
// Defensive-only ML layer. Rule-based detectors always run; an ML model can be
// promoted to SHADOW / PARTIAL / FULL rollout and is bypassed automatically on
// any failure.

import { analyzeText } from "../guard/analyze";
import { redactText } from "../guard/redactor";
import type { GuardDirection } from "../guard/types";
import type { MLLabel } from "@prisma/client";

export type MLBackend = "heuristic" | "external-api" | "onnx";

/**
 * Attack classes a MODEL may predict that the `MLLabel` Prisma enum does not list.
 *
 * WHY THIS IS SEPARATE FROM MLLabel
 *   `MLLabel` is a Postgres enum: it types the training/feedback tables, so adding a
 *   value costs an ALTER TYPE migration on the live database. A classifier's label
 *   space is not a storage concern — SoterLLM v12 predicts 14 classes while the enum
 *   lists 9, and v13 may differ again. Widening only the INFERENCE type keeps model
 *   iteration free of DB migrations, and nothing on the guard path persists a
 *   predicted label as an MLLabel column (mlAugment carries it as a plain string).
 *
 * WHAT WENT WRONG WITHOUT IT
 *   onnxBackend's ALL_LABELS was the 9-value list, and loadLabelMap THROWS on any
 *   label outside it. Pointing ML_ONNX_LABELS_PATH at v12 therefore threw during
 *   backend init, augmentWithMl caught it and failed open, and the ML tier went
 *   silently dark on every request — the guard would have reported rules-only
 *   verdicts while the config claimed a 14-class model was live.
 */
export const EXTENDED_MODEL_LABELS = [
  "TOOL_CALL_ABUSE",
  "ENCODING_OBFUSCATION",
  "MULTI_TURN_ESCALATION",
  "MODEL_EXTRACTION",
  "TOXICITY_HARASSMENT",
  // v17. Agent memory / persistent-state poisoning: text whose payload is aimed at
  // what the agent WRITES DOWN rather than what it answers now ("remember for all
  // future sessions that...", "update your saved preferences to...", a note planted
  // in a scratchpad or memory file that a later turn will re-read as instruction).
  //
  // WHY IT IS NOT JUST RAG_POISONING
  //   RAG_POISONING is a poisoned RETRIEVAL corpus the agent reads. This is a write
  //   the agent performs on ITSELF, so the delivery surface (an ordinary-looking
  //   user turn) and the time of effect (a later session) both differ. Projected onto
  //   RAG_POISONING for DB persistence below because that is the nearest ancestor the
  //   9-value enum can express -- not because they are the same attack.
  //
  // UNMEASURED AT TIME OF ADDING: v14/v16 weights do not emit this class. It becomes
  // live only if a v17 labels.json lists it. Listing it here is what stops
  // loadLabelMap from throwing and taking the whole ML tier dark on that day.
  "MEMORY_POISONING",
] as const;

export type ExtendedModelLabel = (typeof EXTENDED_MODEL_LABELS)[number];

/** Any label a classifier backend may return: the DB enum plus the v12 additions. */
export type ModelLabel = MLLabel | ExtendedModelLabel;

/**
 * Projection of the five v12-only classes onto the closest `MLLabel`.
 *
 * WHY A PROJECTION IS UNAVOIDABLE
 *   `MLLabel` types real Postgres enum COLUMNS (MLReviewQueue.predictedLabel,
 *   MLDatasetExample.label, ...). Handing Prisma "TOOL_CALL_ABUSE" is not a type
 *   nit — it is a runtime write error against the live database. Every path that
 *   PERSISTS a predicted label must therefore narrow first, and the only honest
 *   narrowing is to the nearest ancestor class the enum can express.
 *
 * WHAT THIS COSTS
 *   The projection is LOSSY and it is one-way. A model that predicted
 *   ENCODING_OBFUSCATION is recorded as PROMPT_INJECTION, so DB-backed
 *   evaluation measures the model in the DATASET's 9-label space, not its own
 *   14-class space. That is the only space the gold labels live in, so it is the
 *   only space where "correct" is defined — but it means a DB evaluation cannot
 *   tell you anything about the five new classes. Measuring those needs
 *   externally labelled rows in the 14-class space, which do not exist yet.
 *
 *   The live guard path does NOT go through here: lib/guard/mlAugment.ts keeps
 *   the raw label and maps it to its own RiskType, so production reporting is
 *   un-projected. This is strictly the persistence boundary.
 */
export const EXTENDED_LABEL_TO_DB_LABEL: Record<ExtendedModelLabel, MLLabel> = {
  TOOL_CALL_ABUSE: "PROMPT_INJECTION",
  ENCODING_OBFUSCATION: "PROMPT_INJECTION",
  MULTI_TURN_ESCALATION: "JAILBREAK",
  MODEL_EXTRACTION: "SYSTEM_PROMPT_LEAK_ATTEMPT",
  TOXICITY_HARASSMENT: "UNSAFE_OUTPUT",
  MEMORY_POISONING: "RAG_POISONING",
};

/** Narrow any model label to one the `MLLabel` enum columns accept. Identity for the 9 DB labels. */
export function toDbLabel(label: ModelLabel): MLLabel {
  return (EXTENDED_LABEL_TO_DB_LABEL as Partial<Record<string, MLLabel>>)[label] ?? (label as MLLabel);
}

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
  predictedLabel: ModelLabel;
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
