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
 *   - Fail-open is RECORDED, never silent: every attempt reports to
 *     lib/guard/guardHealth.ts, so "configured as enforce but the model never
 *     loaded" shows up in /api/health and fails `npm run ml:health` instead of
 *     masquerading as a protected request.
 *
 * The model + confidence floor are validated offline against a frozen held-out
 * set (scripts/guard-benchmark/ml-ensemble-heldout.ts) before ENFORCE is used.
 */

import type { GuardResult, GuardFinding, RiskType, GuardDirection } from "./types";
import { createOnnxBackendFromEnv, ONNXClassifierBackend } from "../ml/onnxBackend";
import { classifySemantic } from "./semanticClassifier";
import { recordMlAugmentOutcome } from "./guardHealth";
import type { ModelLabel } from "../ml/types";

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
//
// MEASURED EXPANSION (2026-08-08): v7 on crossdist-eval-v3 (3,987 rows, stratified
// sample, 3,069 attacks / 918 benign; artifacts/ml/crossdist-v7-{baseline,newdefault}.json).
//   3-label allowlist ... rules+ML 63.80% recall / 5.23% FPR (rescued 667, +4 FPs)
//   6-label allowlist ... rules+ML 77.39% recall / 5.23% FPR (rescued 1,084, +4 FPs)
// +13.59 pts recall for +0 pts FPR — the SAME 4 ML-caused false positives, 48/918 in
// both runs. The gate was refusing 417 attacks the model had already caught and buying
// nothing: `label-family` fell from 544 misses to 0.
//
// The gain is entirely PII (38.88% -> 83.91%, +45.03 pts). Every other label is
// byte-identical across the two runs, benign FPR included, so this is not a
// precision/recall trade — it is one label the gate was suppressing outright.
//
// HONESTY BOUND — what is NOT measured here: this eval set contains no SECRET and no
// RAG_POISONING rows. Those two are admitted on the FPR half of the evidence only (they
// caused no new benign false positive on 918 rows); their recall benefit is UNMEASURED,
// not demonstrated. Narrow this list to PROMPT_INJECTION,JAILBREAK,
// SYSTEM_PROMPT_LEAK_ATTEMPT,PII via the override if that matters for a deployment.
// PII on INPUT is also covered by piiDetector/indiaPiiDetector in the rules tier
// (analyze.ts:110), so this measures what the model ADDS over the ~39% regex baseline,
// not whether PII is guarded at all.
//
// The override (SOTERAI_ML_INPUT_TRUSTED_LABELS) remains so further widening stays a
// measurement rather than an argument — the per-label margin loosening above was
// measured the same way and REJECTED.
// THIS DEFAULT IS COUPLED TO v7 — DO NOT CARRY IT BACK TO AN OLDER MODEL.
// The same 6-label gate measured on the SAME 3,987 rows
// (artifacts/ml/crossdist-v4-newdefault.json):
//   v7 ... 77.39% recall / 5.23% FPR ... ML added   4 false positives
//   v4 ... 51.29% recall / 8.17% FPR ... ML added  31 false positives
// So widening is free on v7 and costs +3.38 pts FPR on v4. It is the calibration
// (ECE 0.0060 vs 0.0170) that makes PII/SECRET/RAG predictions trustworthy enough to
// escalate, not the label set. If ML_ONNX_MODEL_PATH is ever rolled back to v4 or
// earlier, set SOTERAI_ML_INPUT_TRUSTED_LABELS back to the three-label list, or the
// rollback silently converts a measured-safe default into a measured-harmful one.
//
// MEASURED EXPANSION (2026-08-20, v12): v12 predicts five classes v7 cannot emit, so
// every one of those predictions was being discarded here. Measured on 22,680 clean
// crossdist rows (16,256 attacks / 6,424 benign,
// artifacts/ml/v12-deploy-blockers.json), per new label, benign FPs vs attack rows
// the model names with that label instead of an allowlisted one:
//   ENCODING_OBFUSCATION   0 benign (0.000%)   15 attacks   -> ADMITTED
//   MODEL_EXTRACTION       0 benign (0.000%)    5 attacks   -> ADMITTED
//   TOOL_CALL_ABUSE        1 benign (0.016%)    4 attacks   -> HELD OUT
//   TOXICITY_HARASSMENT    2 benign (0.031%)    4 attacks   -> HELD OUT
//   MULTI_TURN_ESCALATION  2 benign (0.031%)    0 attacks   -> REJECTED
// Only the two zero-cost labels are admitted, which is the same standard that
// admitted PII/SECRET/RAG_POISONING: +0 measured benign false positives. The other
// three are a real trade (5 benign for 8 attacks) and a trade needs more than one
// corpus — MULTI_TURN_ESCALATION is strictly a cost here and is rejected outright.
//
// HONESTY BOUND: this measures the FP half only. These five classes have ZERO gold
// rows in any external corpus we hold, so their recall is UNMEASURED — the 15 and 5
// above are rows whose gold label is a DIFFERENT attack class that v12 renames, not
// evidence that v12 detects obfuscation or model-extraction attacks as such. The
// numbers are also an upper bound: the semantic veto and labelSpaceUncertain are not
// modelled and both only remove escalations.
// These two are no-ops on v7/v4 (those models cannot emit them), so this widening is
// safe to leave in place across a rollback.
const DEFAULT_INPUT_RELIABLE_LABELS = [
  "PROMPT_INJECTION",
  "JAILBREAK",
  "SYSTEM_PROMPT_LEAK_ATTEMPT",
  "PII",
  "SECRET",
  "RAG_POISONING",
  "ENCODING_OBFUSCATION",
  "MODEL_EXTRACTION",
] as const;

function resolveInputReliableLabels(): Set<string> {
  const raw = (process.env.SOTERAI_ML_INPUT_TRUSTED_LABELS ?? "").trim();
  if (!raw) return new Set<string>(DEFAULT_INPUT_RELIABLE_LABELS);
  const parsed = raw
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  // An unparseable or empty override must not silently disable the gate entirely,
  // which would admit the ~18% over-defense this gate exists to hold out.
  return parsed.length ? new Set<string>(parsed) : new Set<string>(DEFAULT_INPUT_RELIABLE_LABELS);
}

// Memoized rather than resolved at module load: a test or benchmark that sets the
// env var in beforeEach would otherwise silently get the default, and the run would
// look like a measurement of the override when it measured the baseline. Cleared by
// __resetMlBackendForTests alongside the backend.
let cachedInputReliableLabels: Set<string> | undefined;

function inputReliableLabels(): Set<string> {
  return (cachedInputReliableLabels ??= resolveInputReliableLabels());
}

// The model may escalate only when the semantic classifier does NOT judge the
// text closer to a benign prototype than to any attack prototype. Tunable via
// SOTERAI_ML_SEMANTIC_MARGIN; 0.0 measured 0% validation-benign FPR.
//
// WHY THIS VETO IS NOT CONDITIONED ON MODEL CONFIDENCE
//   It is tempting to let a near-certain model outrank a prototype heuristic: on the
//   frozen untuned corpus this gate is the only thing still refusing one real
//   jailbreak, and v4 scores it P(attack) 0.9817. Measured (npm run ml:verify:v4
//   --explain, 2026-08-01) the scores do not support it — they are in the wrong
//   order:
//     v4  jailbreak the gate refuses ...................... P(attack) 0.9817
//     v4  "Turn these bullet points into a concise
//          executive summary." (benign, gate refuses it) ... P(attack) 0.9843
//   Any threshold that admits the attack admits that benign text first, so an
//   attackProbability override cannot be free — it is not a tuning question, the
//   axis simply does not separate the two. On v3 the picture is worse: its ML-caused
//   control false positives are ordinary programming answers at P(attack) 0.87-0.9999
//   ("To center a div with flexbox..." PROMPT_INJECTION conf 0.998 / 0.9995), i.e.
//   its confidence carries no information about whether the text is an attack, and
//   this gate is all that holds them out.
//   Loosening the margin globally instead (-0.1) does recover the attack on v4
//   (54/54, control FPR 1.0%->1.3%) but costs v3 real precision (held-out benign
//   0->1/44, control 2.7%->3.7%), and 2-vs-3 false positives in 300 is noise. The
//   miss needs better attack-prototype coverage (or a model that separates
//   metaphorical jailbreaks from summarisation requests), not a looser threshold.
function resolveSemanticMarginGate(): number {
  const raw = Number(process.env.SOTERAI_ML_SEMANTIC_MARGIN ?? "0");
  return Number.isFinite(raw) ? raw : 0;
}

/**
 * Precision gate for a model attack prediction. Returns true only when the
 * prediction should be trusted enough to escalate to human review.
 */
function passesPrecisionGate(label: string, direction: GuardDirection, text: string): boolean {
  if (direction === "INPUT" && !inputReliableLabels().has(label)) return false;
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
//
// COMPLETENESS MATTERS MORE THAN IT LOOKS. The lookup at the call site falls back to
// "PROMPT_INJECTION" for an unmapped label, so a missing entry does not throw — it
// silently reports a tool-call abuse or a toxicity call as a prompt injection, and the
// mislabel reaches the dashboard, the ledger and the customer's SIEM. Every label in
// ALL_LABELS (lib/ml/onnxBackend.ts) must therefore appear below.
//
// The five v12 classes deliberately do NOT reuse the closest existing risk type where
// that type carries a BLOCK floor in decisionEngine.ts (MCP_TOOL_POISONING,
// TOXICITY, COMPETITIVE_INTEL_EXTRACTION all do, and the finding score here is
// exactly the 45 their hardAtScore triggers on). Trusting an unvalidated model label
// with an automatic refusal is the one thing this gate exists to prevent, so they map
// to floor-free types instead. ENCODING_OBFUSCATION is the exception: it means the
// same thing as ADVANCED_SMUGGLING, which floors at HUMAN_REVIEW, so it reuses it.
const LABEL_TO_RISK: Record<Exclude<ModelLabel, "SAFE">, RiskType> = {
  PROMPT_INJECTION: "PROMPT_INJECTION",
  JAILBREAK: "JAILBREAK",
  SYSTEM_PROMPT_LEAK_ATTEMPT: "SYSTEM_PROMPT_LEAK_ATTEMPT",
  PII: "PII_DETECTED",
  SECRET: "SECRET_DETECTED",
  UNSAFE_OUTPUT: "UNSAFE_OUTPUT",
  RAG_POISONING: "RECURSIVE_INJECTION",
  DATA_EXFILTRATION_ATTEMPT: "DATA_EXFILTRATION",
  TOOL_CALL_ABUSE: "TOOL_CALL_ABUSE",
  ENCODING_OBFUSCATION: "ADVANCED_SMUGGLING",
  MULTI_TURN_ESCALATION: "MULTI_TURN_ESCALATION",
  MODEL_EXTRACTION: "MODEL_EXTRACTION",
  TOXICITY_HARASSMENT: "TOXICITY_HARASSMENT",
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
  cachedInputReliableLabels = undefined;
}

/**
 * Which gate stopped a non-SAFE model prediction from escalating. Recorded so a
 * miss is attributable: "the model saw it and the label filter dropped it" and
 * "the model abstained" are different bugs with different fixes, and without this
 * both look identical to an operator (and to the benchmark harness) as a plain
 * non-detection.
 */
export type MlGateReason =
  /** The decided label was SAFE — nothing to escalate. */
  | "safe-label"
  /** Calibration abstained. NOT a safe verdict: the model declined to decide. */
  | "abstention"
  /** Below ML_ONNX_CONFIDENCE_FLOOR and below the attack-probability floor. */
  | "confidence-floor"
  /** Label class is not trusted to escalate an INPUT (see INPUT_RELIABLE_LABELS). */
  | "label-family"
  /** The dependency-free semantic classifier judged the text closer to benign. */
  | "semantic-benign";

export interface MlAugmentDetail {
  mode: MlAugmentMode;
  ran: boolean;
  predictedLabel?: string;
  confidence?: number;
  /** 1 - P(SAFE), when the backend surfaces it. The primary security score on v4. */
  attackProbability?: number;
  /** Calibration declined to decide. Reported because it must never read as "safe". */
  abstained?: boolean;
  /** Set when the model predicted an attack but a gate refused to act on it. */
  gatedBy?: MlGateReason;
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
  if (!backend) {
    // Configured to run but there is nothing to run. Record it: this is the
    // silent-downgrade case, and the request is being served by rules alone.
    const error = process.env.ML_ONNX_MODEL_PATH
      ? "ML backend could not be constructed from the environment"
      : "ML_ONNX_MODEL_PATH is not set, so no model can load";
    recordMlAugmentOutcome({ ran: false, error });
    return withMlMetadata(base, { mode, ran: false, error });
  }

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
    recordMlAugmentOutcome({ ran: true });
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

    // Which gate refused, in the same order the decision above applies them. Pure
    // re-reads of values already computed — no second classifySemantic call, and no
    // influence on isAttack. Attribution only: a miss that came from abstention and
    // a miss that came from the label filter need different fixes.
    const labelTrusted = direction !== "INPUT" || inputReliableLabels().has(effectiveLabel);
    const gatedBy: MlGateReason | undefined = isAttack
      ? undefined
      : effectiveLabel === "SAFE"
        ? "safe-label"
        : abstained
          ? "abstention"
          : !confident
            ? "confidence-floor"
            : !labelTrusted
              ? "label-family"
              : "semantic-benign";

    detail = {
      mode,
      ran: true,
      predictedLabel: effectiveLabel,
      confidence: Number(inference.confidence.toFixed(4)),
      attackProbability:
        typeof attackProb === "number" ? Number(attackProb.toFixed(4)) : undefined,
      abstained,
      gatedBy,
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
      LABEL_TO_RISK[effectiveLabel as Exclude<ModelLabel, "SAFE">] ?? "PROMPT_INJECTION";
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
    recordMlAugmentOutcome({ ran: false, error: detail.error });
    return withMlMetadata(base, detail); // fail open
  }
}

function withMlMetadata(result: GuardResult, detail: MlAugmentDetail): GuardResult {
  return {
    ...result,
    metadata: { ...(result.metadata ?? {}), ml: detail },
  };
}
