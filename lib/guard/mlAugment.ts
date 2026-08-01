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
import { existsSync } from "node:fs";
import { createOnnxBackendFromEnv, ONNXClassifierBackend } from "../ml/onnxBackend";
import { classifySemantic } from "./semanticClassifier";
import type { MLLabel } from "@prisma/client";

export type MlAugmentMode = "off" | "shadow" | "enforce";

// PRECISION GATE — why the model cannot escalate on its own label + confidence.
//
// The fine-tuned v3 classifier is a strong RECALL booster (it catches ~14 more
// points of novel attacks than the rules on the untuned held-out set) but it has
// a measured OVER-DEFENSE bias on benign INPUT: it fires UNSAFE_OUTPUT on ordinary
// code/copy-writing generation and DATA_EXFILTRATION_ATTEMPT on non-English prose,
// pushing raw benign FPR to ~18% (scripts/guard-benchmark/ml-ensemble-gate-benchmark.ts). Those
// two label classes are therefore NOT trusted to escalate an INPUT on their own.
//
// On INPUT we only let the model escalate for the label classes it predicts
// accurately — injection / jailbreak / system-prompt-leak — AND only when the
// dependency-free semantic classifier agrees the text is not clearly benign.
// On a 54-case frozen untuned attack corpus this measured recall 87.0% (up from
// the 71-72% rules-only baseline) at 0.4% benign-control FPR
// (scripts/guard-benchmark/ml-ensemble-gate-benchmark.ts) — the recall lift with
// the false-positive cost held essentially flat. Per-label margin loosening was
// evaluated (scripts/guard-benchmark/ml-per-label-calibration.ts) and REJECTED:
// it bought +1 attack for +4 benign false positives (control FPR 0.4%→1.9%),
// exactly the over-defense trade this gate exists to avoid. On OUTPUT the
// exfiltration/unsafe classes ARE meaningful (a leaked secret or unsafe payload
// in a model reply), so the label restriction does not apply there.
const INPUT_RELIABLE_LABELS = new Set<string>([
  "PROMPT_INJECTION",
  "JAILBREAK",
  "SYSTEM_PROMPT_LEAK_ATTEMPT",
]);

// The model may escalate only when the semantic classifier does NOT judge the
// text closer to a benign prototype than to any attack prototype. Tunable via
// SOTERAI_ML_SEMANTIC_MARGIN; 0.0 measured 0% validation-benign FPR.
function resolveSemanticMarginGate(): number {
  const raw = Number(process.env.SOTERAI_ML_SEMANTIC_MARGIN ?? "0");
  return Number.isFinite(raw) ? raw : 0;
}

/**
 * Precision gate for a model attack prediction. Returns true only when the
 * prediction should be trusted enough to escalate to human review.
 */
function passesPrecisionGate(label: string, direction: GuardDirection, text: string): boolean {
  if (direction === "INPUT" && !INPUT_RELIABLE_LABELS.has(label)) return false;
  let benignBySemantic = false;
  try {
    const s = classifySemantic(text);
    benignBySemantic = s.score - s.benignSimilarity < resolveSemanticMarginGate();
  } catch {
    // Fail safe: if the semantic gate throws, do not let the model escalate —
    // a missed recall boost is preferable to an ungated false positive.
    benignBySemantic = true;
  }
  return !benignBySemantic;
}

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
  const raw = (process.env.SOTERAI_ML_AUGMENT ?? "").toLowerCase().trim();
  if (raw === "off") return "off"; // explicit opt-out always wins
  if (raw === "shadow" || raw === "enforce") return raw;
  if (raw === "on") return "shadow"; // "on" is a safe alias for shadow
  // WS1.1: unset now defaults to SHADOW (record-only) instead of off. Shadow
  // never changes an action — it only records what ML would have done — and
  // augmentWithMl is fail-open when no model is loadable, so this is
  // behaviour-preserving while producing the evidence needed for enforce.
  return "shadow";
}

// A single lazily-created backend instance, reused across requests so the 90MB
// model is loaded once. Null when ML is not configured.
let cachedBackend: ONNXClassifierBackend | null | undefined;

/** True when a bundled classifier exists on disk for zero-config deployments. */
function bundledModelPresent(): boolean {
  return (
    existsSync("models/ml-classifier-v4/model.onnx") ||
    existsSync("models/ml-classifier-v3/model.onnx")
  );
}

function getBackend(): ONNXClassifierBackend | null {
  if (cachedBackend !== undefined) return cachedBackend;
  // createOnnxBackendFromEnv only returns non-null when ML_BACKEND=onnx; for the
  // guard augment path we key off ML_ONNX_MODEL_PATH instead so the two systems
  // are independent. Construct directly when a model path is present.
  if (process.env.ML_ONNX_MODEL_PATH) {
    cachedBackend = new ONNXClassifierBackend();
  } else {
    cachedBackend = createOnnxBackendFromEnv();
    // WS1.1: with no explicit configuration, fall back to the bundled model
    // when present so default deployments get the ML tier (shadow evidence)
    // without any env setup. The constructor auto-discovers v4 over v3.
    if (!cachedBackend && bundledModelPresent()) {
      cachedBackend = new ONNXClassifierBackend();
    }
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

  // 0.9 is the measured operating point for v3
  // (scripts/guard-benchmark/ml-ensemble-gate-benchmark.ts): recall 85.7% at
  // ~0.4% benign-control FPR once the precision gate is applied. v4 also uses
  // per-label thresholds from calibration.json inside the backend; this floor
  // remains a second-line global gate.
  const floor = Number(process.env.ML_ONNX_CONFIDENCE_FLOOR ?? "0.9");
  // Attack-probability fusion (v4): 1-P(SAFE). When the backend surfaces this,
  // we can escalate high attack-prob even if argmax landed on an unreliable
  // class (still subject to the precision gate + semantic not-benign).
  const attackProbFloor = Number(process.env.ML_ONNX_ATTACK_PROB_FLOOR ?? "0.85");

  let detail: MlAugmentDetail = { mode, ran: false, floor };
  try {
    const inference = await backend.infer(text, direction);
    const label = inference.predictedLabel;
    const raw = (inference.raw ?? {}) as {
      attackProbability?: number;
      abstained?: boolean;
      rawPredictedLabel?: string;
      rawConfidence?: number;
    };
    const attackProb = typeof raw.attackProbability === "number" ? raw.attackProbability : undefined;
    const abstained = raw.abstained === true;
    // Prefer raw predicted label for precision-gate when backend demoted to SAFE
    // only due to thresholding — attackProb fusion can still recover it.
    const effectiveLabel =
      label !== "SAFE"
        ? label
        : typeof raw.rawPredictedLabel === "string" && raw.rawPredictedLabel !== "SAFE"
          ? raw.rawPredictedLabel
          : label;
    const confident =
      inference.confidence >= floor ||
      (typeof attackProb === "number" && attackProb >= attackProbFloor && !abstained);
    // isAttack requires the model be confident AND the prediction survive the
    // precision gate (reliable label class + semantic not-benign). This is what
    // keeps the recall boost from turning into the model's raw ~18% over-defense.
    const isAttack =
      effectiveLabel !== "SAFE" &&
      !abstained &&
      confident &&
      passesPrecisionGate(effectiveLabel, direction, text);

    detail = {
      mode,
      ran: true,
      predictedLabel: effectiveLabel,
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

    const riskType =
      LABEL_TO_RISK[effectiveLabel as Exclude<MLLabel, "SAFE">] ?? "PROMPT_INJECTION";
    const finding: GuardFinding = {
      type: riskType,
      label: `ML anomaly (${effectiveLabel})`,
      severity: "MEDIUM",
      score: 45,
      message:
        "No deterministic signature matched, but a fine-tuned classifier judged this request " +
        `similar to known adversarial prompts (${effectiveLabel}, confidence ${(inference.confidence * 100).toFixed(1)}` +
        (typeof attackProb === "number"
          ? `, attackProb ${(attackProb * 100).toFixed(1)}%`
          : "") +
        "). Held for human review.",
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
