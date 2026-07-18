/**
 * Async ML recall augmentation for the guard pipeline.
 *
 * WHY THIS EXISTS (and why it is separate from analyzeText):
 *   analyzeText (lib/guard/analyze.ts) is fully SYNCHRONOUS and is called from
 *   many places. The fine-tuned ONNX classifier (lib/ml/onnxBackend.ts) is
 *   ASYNC (onnxruntime run() returns a Promise). Rather than make the entire
 *   sync core async — a large, hard-to-reverse blast radius — this module layers
 *   an *additive* async pass on top of an already-computed sync GuardResult, at
 *   the async route boundary (runInputGuard / runOutputGuard callers).
 *
 * SAFETY CONTRACT (mirrors the deterministic semantic booster in analyze.ts):
 *   - Off by default. Only runs when SOTERAI_ML_AUGMENT=on AND a model is
 *     configured (ML_ONNX_MODEL_PATH). No behaviour change unless explicitly
 *     enabled.
 *   - SHADOW mode (default when enabled): runs the model, records what it WOULD
 *     have done in metadata, but does NOT change the action. This is how we
 *     gather production evidence with zero user-facing risk.
 *   - ENFORCE mode: an ML hit escalates the action to at most HUMAN_REVIEW. It
 *     NEVER turns an ALLOW into a hard BLOCK on its own — the model is a recall
 *     booster that routes uncertain traffic to review, bounding false-positive
 *     cost. A rules-driven BLOCK is always preserved.
 *   - Fail-open: any error (model missing, inference throw) leaves the base
 *     result untouched. The guard never breaks because ML is unavailable.
 *
 * The model + confidence floor are validated offline against a frozen held-out
 * set (scripts/guard-benchmark/ml-ensemble-heldout.ts) before ENFORCE is used.
 */

import type { GuardResult, GuardFinding, RiskType, GuardDirection } from "./types";
import { createOnnxBackendFromEnv, ONNXClassifierBackend } from "../ml/onnxBackend";
import type { MLLabel } from "@prisma/client";

export type MlAugmentMode = "off" | "shadow" | "enforce";

// Map the classifier's label space onto the guard RiskType space. SAFE is not
// present here — a SAFE prediction is a no-op.
const LABEL_TO_RISK: Record<Exclude<MLLabel, "SAFE">, RiskType> = {
  PROMPT_INJECTION: "PROMPT_INJECTION",
  JAILBREAK: "JAILBREAK",
  SYSTEM_PROMPT_LEAK_ATTEMPT: "SYSTEM_PROMPT_LEAK_ATTEMPT",
  PII: "PII_DETECTED",
  SECRET: "SECRET_DETECTED",
  UNSAFE_OUTPUT: "UNSAFE_OUTPUT",
  RAG_POISONING: "RECURSIVE_INJECTION",
  DATA_EXFILTRATION_ATTEMPT: "DATA_EXFILTRATION",
};

const PROTECTIVE_ACTIONS = new Set(["BLOCK", "HUMAN_REVIEW", "REWRITE", "ALLOW_WITH_REDACTION"]);

export function resolveMlAugmentMode(): MlAugmentMode {
  const raw = (process.env.SOTERAI_ML_AUGMENT ?? "off").toLowerCase();
  if (raw === "shadow" || raw === "enforce") return raw;
  if (raw === "on") return "shadow"; // "on" is a safe alias for shadow
  return "off";
}

// A single lazily-created backend instance, reused across requests so the 90MB
// model is loaded once. Null when ML is not configured.
let cachedBackend: ONNXClassifierBackend | null | undefined;

function getBackend(): ONNXClassifierBackend | null {
  if (cachedBackend !== undefined) return cachedBackend;
  // createOnnxBackendFromEnv only returns non-null when ML_BACKEND=onnx; for the
  // guard augment path we key off ML_ONNX_MODEL_PATH instead so the two systems
  // are independent. Construct directly when a model path is present.
  if (process.env.ML_ONNX_MODEL_PATH) {
    cachedBackend = new ONNXClassifierBackend();
  } else {
    cachedBackend = createOnnxBackendFromEnv();
  }
  return cachedBackend;
}

/** Test seam: reset the cached backend (used by benchmarks/tests). */
export function __resetMlBackendForTests(): void {
  cachedBackend = undefined;
}

export interface MlAugmentDetail {
  mode: MlAugmentMode;
  ran: boolean;
  predictedLabel?: string;
  confidence?: number;
  wouldEscalate?: boolean;
  escalated?: boolean;
  floor?: number;
  error?: string;
}

/**
 * Given a base (rules-derived) GuardResult, optionally consult the ML classifier
 * and return a possibly-escalated result. Additive and fail-open.
 */
export async function augmentWithMl(
  base: GuardResult,
  text: string,
  direction: GuardDirection,
): Promise<GuardResult> {
  const mode = resolveMlAugmentMode();
  if (mode === "off") return base;

  const backend = getBackend();
  if (!backend) return base;

  const floor = Number(process.env.ML_ONNX_CONFIDENCE_FLOOR ?? "0.9");

  let detail: MlAugmentDetail = { mode, ran: false, floor };
  try {
    const inference = await backend.infer(text, direction);
    const label = inference.predictedLabel;
    const confident = inference.confidence >= floor;
    const isAttack = label !== "SAFE" && confident;

    detail = {
      mode,
      ran: true,
      predictedLabel: label,
      confidence: Number(inference.confidence.toFixed(4)),
      floor,
      wouldEscalate: isAttack && !PROTECTIVE_ACTIONS.has(base.action),
      escalated: false,
    };

    if (!isAttack) {
      return withMlMetadata(base, detail);
    }

    // SHADOW: record only, never change the action.
    if (mode === "shadow") {
      return withMlMetadata(base, detail);
    }

    // ENFORCE: escalate to at most HUMAN_REVIEW. Preserve a stricter rules action.
    if (PROTECTIVE_ACTIONS.has(base.action)) {
      // Rules already took a protective action — record ML as corroborating,
      // but do not weaken or duplicate it.
      return withMlMetadata(base, detail);
    }

    const riskType = LABEL_TO_RISK[label as Exclude<MLLabel, "SAFE">] ?? "PROMPT_INJECTION";
    const finding: GuardFinding = {
      type: riskType,
      label: `ML anomaly (${label})`,
      severity: "MEDIUM",
      score: 45,
      message:
        "No deterministic signature matched, but a fine-tuned classifier judged this request " +
        `similar to known adversarial prompts (${label}, confidence ${(inference.confidence * 100).toFixed(1)}%). Held for human review.`,
    };
    detail.escalated = true;

    const findings = [...base.findings, finding];
    const riskTypes = Array.from(new Set([...base.riskTypes.filter((t) => t !== "LOW_RISK"), riskType]));

    return withMlMetadata(
      {
        ...base,
        action: "HUMAN_REVIEW",
        allowed: false,
        safeText: undefined,
        findings,
        riskTypes,
        reason: `Held for human review: ${finding.label}.`,
      },
      detail,
    );
  } catch (error) {
    detail.error = (error as Error).message ?? "ml inference failed";
    return withMlMetadata(base, detail); // fail open
  }
}

function withMlMetadata(result: GuardResult, detail: MlAugmentDetail): GuardResult {
  return {
    ...result,
    metadata: { ...(result.metadata ?? {}), ml: detail },
  };
}
