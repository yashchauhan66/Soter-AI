/**
 * ONNX Classifier Backend (SoterLLM v3/v4)
 *
 * Loads a fine-tuned MiniLM ONNX model exported by:
 *   - scripts/ml/train-onnx-model.py  (v3)
 *   - scripts/ml/train-soterllm-v4.py (v4 — MLP head + temperature-baked logits)
 *
 * and runs inference in-process using onnxruntime-node + BertTokenizer.
 *
 * v4 additions:
 *   - optional calibration.json (per-label thresholds + OOD abstention)
 *   - attackProbability = 1 - P(SAFE) as primary security score
 *   - maxLength default 256 (v4) with override
 *   - abstention: low max-prob never coerced silently to "trusted SAFE"
 *   - multi-score topK always returned for ensemble fusion
 *
 * Environment variables:
 *   ML_BACKEND=onnx
 *   ML_ONNX_MODEL_PATH=models/ml-classifier-v4/model.onnx
 *   ML_ONNX_LABELS_PATH=models/ml-classifier-v4/labels.json
 *   ML_ONNX_CALIBRATION_PATH=models/ml-classifier-v4/calibration.json
 *   ML_ONNX_CONFIDENCE_FLOOR=0.50
 *   ML_ONNX_MAX_LENGTH=256
 *   ML_ONNX_SLIDING_WINDOW=off     (opt-in: score long inputs as overlapping
 *                                   windows instead of truncating; see the
 *                                   slidingWindow option for why it is off)
 *   ML_ONNX_WINDOW_SIZE=94         (content tokens per sliding window)
 *   ML_ONNX_WINDOW_OVERLAP=32      (shared tokens between adjacent windows)
 *   ML_ONNX_MAX_WINDOWS=24         (latency cap; the tail is always scored)
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { GuardDirection } from "../guard/types";
import type { MLLabel } from "@prisma/client";
import type { ModelBackend, ModelInference } from "./types";
import { BertTokenizer, parseVocabTxt } from "./bertTokenizer";
import {
  attackProbability,
  clearsLabelThreshold,
  labelSpaceUncertain,
  loadCalibration,
  shouldAbstain,
  type CalibrationConfig,
} from "./calibration";
import {
  gateRuntimeModel,
  type ModelTrustStore,
  type SignedModelManifest,
  type RuntimeModelGateEvidence,
} from "../model-scan";

// ── Types ────────────────────────────────────────────────────────────────────

interface LabelMap {
  [index: string]: string;
}

interface OnnxBackendOptions {
  modelPath?: string;
  labelsPath?: string;
  calibrationPath?: string;
  /** Global minimum confidence; also used as fallback when no per-label thr. */
  confidenceFloor?: number;
  maxLength?: number;
  /**
   * When true (default for v4 calibration present), low-confidence predictions
   * are marked abstained rather than silently rewritten as trusted SAFE.
   */
  enableAbstention?: boolean;
  modelManifestPath?: string;
  trustStorePath?: string;
  approvedSources?: string[];
  /**
   * Score inputs longer than one model window as overlapping windows instead of
   * truncating at maxLength. Off means the classifier is blind to anything past
   * the first window — the document-buried injection case.
   *
   * DEFAULT OFF, deliberately. The mechanism is correct and covered by
   * tests/ml/sliding-window.test.ts, but on the CURRENT v4 decision layer a sweep
   * does not yet pay for itself: `npm run ml:evidence:window` measures net zero —
   * nothing changes on INPUT (every window label is filtered out by
   * INPUT_RELIABLE_LABELS), and on OUTPUT one buried payload is recovered at the
   * cost of one new false positive on a benign contract, for ~3x the latency.
   * v4 abstains on genuine attacks (9-class entropy gate) and assigns arbitrary
   * attack labels to long prose. Turn this on only after re-running that evidence
   * script shows a net gain.
   */
  slidingWindow?: boolean;
  /**
   * Content tokens per sliding window. Deliberately smaller than maxLength:
   * SoterLLM is trained on short prompts, and measurement (see
   * tests/ml/sliding-window.test.ts) shows it degrades badly on ~190+ token
   * windows — long benign prose starts scoring as a confident attack. Small
   * windows keep each forward pass inside the length range the model actually
   * saw. Clamped to the tokenizer's window budget. Default 94.
   */
  windowSize?: number;
  /** Content tokens shared between adjacent windows so a payload on a boundary
   *  is fully present in at least one window. Default 32. */
  windowOverlap?: number;
  /** Hard cap on forward passes per input, so latency stays bounded on a huge
   *  paste. The final window is always the tail. Default 24. */
  maxWindows?: number;
}

// ── Errors ───────────────────────────────────────────────────────────────────

class OnnxBackendError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "OnnxBackendError";
  }
}

class OnnxNotAvailableError extends OnnxBackendError {
  constructor() {
    super(
      "ONNX runtime is not available. Install onnxruntime-node:\n" +
        "  npm install onnxruntime-node",
    );
    this.name = "OnnxNotAvailableError";
  }
}

// ── Label utilities ───────────────────────────────────────────────────────────

const ALL_LABELS: MLLabel[] = [
  "SAFE",
  "PROMPT_INJECTION",
  "JAILBREAK",
  "SYSTEM_PROMPT_LEAK_ATTEMPT",
  "PII",
  "SECRET",
  "UNSAFE_OUTPUT",
  "RAG_POISONING",
  "DATA_EXFILTRATION_ATTEMPT",
];

function loadLabelMap(labelsPath: string): LabelMap {
  const raw = fs.readFileSync(labelsPath, "utf-8");
  const parsed = JSON.parse(raw) as LabelMap;
  for (const [key, value] of Object.entries(parsed)) {
    if (!ALL_LABELS.includes(value as MLLabel)) {
      throw new Error(
        `Unknown label "${value}" at index ${key} in ${labelsPath}. ` +
          `Expected one of: ${ALL_LABELS.join(", ")}`,
      );
    }
  }
  return parsed;
}

function labelAtIndex(labels: LabelMap, index: number): MLLabel {
  const label = labels[String(index)];
  if (label && ALL_LABELS.includes(label as MLLabel)) {
    return label as MLLabel;
  }
  return "SAFE";
}

function softmax(logits: number[]): number[] {
  const max = Math.max(...logits);
  const exps = logits.map((l) => Math.exp(l - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sum);
}

function argmax(values: number[]): number {
  let bestIdx = 0;
  let bestVal = values[0] ?? Number.NEGATIVE_INFINITY;
  for (let i = 1; i < values.length; i++) {
    if (values[i] > bestVal) {
      bestVal = values[i];
      bestIdx = i;
    }
  }
  return bestIdx;
}

function resolveDefaultCalibrationPath(labelsPath: string, explicit?: string): string | undefined {
  if (explicit) return explicit;
  if (process.env.ML_ONNX_CALIBRATION_PATH) return process.env.ML_ONNX_CALIBRATION_PATH;
  // Convention: calibration.json lives next to labels.json
  const sibling = path.join(path.dirname(labelsPath), "calibration.json");
  return fs.existsSync(sibling) ? sibling : undefined;
}

/** Env flag parsing: "on"/"true"/"1"/"yes" → true, "off"/"false"/"0"/"no" → false. */
function envFlag(value: string | undefined): boolean | undefined {
  if (value === undefined) return undefined;
  const normalized = value.trim().toLowerCase();
  if (["on", "true", "1", "yes", "enabled"].includes(normalized)) return true;
  if (["off", "false", "0", "no", "disabled"].includes(normalized)) return false;
  return undefined;
}

/** Positive-integer env parsing; anything unusable falls back to the default. */
function envPositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

/**
 * Number of distinct content tokens actually covered by a window plan.
 *
 * When maxWindows caps the sweep on a very long input, the plan can leave a gap
 * in the middle. Reporting the union size (rather than the total) keeps
 * raw.truncated honest: it says "some of this input was never scored", which is
 * exactly what an operator needs to know.
 */
function coveredTokenCount(starts: number[], budget: number, contentLength: number): number {
  let covered = 0;
  let cursor = 0;
  for (const start of [...starts].sort((a, b) => a - b)) {
    const end = Math.min(contentLength, start + budget);
    const from = Math.max(cursor, start);
    if (end > from) {
      covered += end - from;
      cursor = end;
    }
  }
  return covered;
}

// ── ONNX Backend ──────────────────────────────────────────────────────────────

/**
 * ONNXClassifierBackend — SoterLLM inference via onnxruntime-node.
 * Lazy-initialized on first infer().
 */
export class ONNXClassifierBackend implements ModelBackend {
  id = "onnx" as const;

  private options: Required<Omit<OnnxBackendOptions, "calibrationPath" | "enableAbstention">> & {
    calibrationPath?: string;
    enableAbstention: boolean;
  };
  private session: unknown = null;
  private labels: LabelMap = {};
  private tokenizer: BertTokenizer | null = null;
  private calibration: CalibrationConfig = loadCalibration(null);
  private safeIndex = 0;
  private gateEvidence: RuntimeModelGateEvidence | null = null;

  private initialized = false;
  private initPromise: Promise<void> | null = null;

  constructor(options?: OnnxBackendOptions) {
    const labelsPath =
      options?.labelsPath ?? process.env.ML_ONNX_LABELS_PATH ?? "models/ml-classifier-v3/labels.json";
    const modelPath =
      options?.modelPath ?? process.env.ML_ONNX_MODEL_PATH ?? "models/ml-classifier-v3/model.onnx";
    const maxLength = options?.maxLength
      ?? (process.env.ML_ONNX_MAX_LENGTH ? Number(process.env.ML_ONNX_MAX_LENGTH) : undefined)
      ?? (modelPath.includes("v4") ? 256 : 128);

    this.options = {
      modelPath,
      labelsPath,
      calibrationPath: resolveDefaultCalibrationPath(
        labelsPath,
        options?.calibrationPath ?? process.env.ML_ONNX_CALIBRATION_PATH,
      ),
      confidenceFloor:
        options?.confidenceFloor ?? Number(process.env.ML_ONNX_CONFIDENCE_FLOOR ?? "0.5"),
      maxLength,
      enableAbstention: options?.enableAbstention ?? true,
      modelManifestPath:
        options?.modelManifestPath ??
        process.env.ML_ONNX_MANIFEST_PATH ??
        `${modelPath}.manifest.json`,
      trustStorePath:
        options?.trustStorePath ??
        process.env.SOTERAI_MODEL_TRUST_STORE ??
        "",
      approvedSources:
        options?.approvedSources ??
        (process.env.SOTERAI_MODEL_APPROVED_SOURCES ?? "")
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
      slidingWindow:
        options?.slidingWindow ?? envFlag(process.env.ML_ONNX_SLIDING_WINDOW) ?? false,
      windowSize: options?.windowSize ?? envPositiveInt(process.env.ML_ONNX_WINDOW_SIZE, 94),
      windowOverlap: Math.max(
        0,
        options?.windowOverlap ?? envPositiveInt(process.env.ML_ONNX_WINDOW_OVERLAP, 32),
      ),
      maxWindows:
        options?.maxWindows ?? envPositiveInt(process.env.ML_ONNX_MAX_WINDOWS, 24),
    };
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;
    this.initPromise = this._init();
    await this.initPromise;
  }

  private async _init(): Promise<void> {
    if (!fs.existsSync(this.options.modelPath)) {
      throw new OnnxBackendError(
        `ONNX model not found at ${this.options.modelPath}. ` +
          "Run scripts/ml/train-soterllm-v4.py (or train-onnx-model.py) first, or set ML_ONNX_MODEL_PATH.",
      );
    }

    // Mandatory pre-deserialization boundary. No runtime library is imported
    // and no model is loaded until the artifact, signed manifest, provenance,
    // source policy, and operator trust root all pass.
    if (!this.options.trustStorePath || !fs.existsSync(this.options.trustStorePath)) {
      throw new OnnxBackendError("Model loading blocked: SOTERAI_MODEL_TRUST_STORE is not configured or does not exist.");
    }
    if (!fs.existsSync(this.options.modelManifestPath)) {
      throw new OnnxBackendError(`Model loading blocked: signed manifest not found at ${this.options.modelManifestPath}.`);
    }
    const stat = fs.statSync(this.options.modelPath);
    const maximumBytes = Number(process.env.SOTERAI_MODEL_MAX_BYTES ?? 512 * 1024 * 1024);
    if (!stat.isFile() || stat.size > maximumBytes) {
      throw new OnnxBackendError(`Model loading blocked: artifact is not a regular file or exceeds ${maximumBytes} bytes.`);
    }
    const manifest = JSON.parse(fs.readFileSync(this.options.modelManifestPath, "utf8")) as SignedModelManifest;
    const trustStore = JSON.parse(fs.readFileSync(this.options.trustStorePath, "utf8")) as ModelTrustStore;
    const gated = gateRuntimeModel(
      fs.readFileSync(this.options.modelPath),
      path.basename(this.options.modelPath),
      manifest,
      trustStore,
      { approvedSources: this.options.approvedSources },
    );
    this.gateEvidence = gated.evidence;
    if (!gated.evidence.executable) {
      throw new OnnxBackendError(
        `Model loading blocked by supply-chain gate (${gated.evidence.decision}): ${gated.evidence.reasons.join("; ")}`,
      );
    }

    this.labels = loadLabelMap(this.options.labelsPath);
    // SAFE is conventionally index 0; detect dynamically for safety.
    this.safeIndex = 0;
    for (const [idx, name] of Object.entries(this.labels)) {
      if (name === "SAFE") {
        this.safeIndex = Number(idx);
        break;
      }
    }

    this.calibration = loadCalibration(this.options.calibrationPath);

    const ort = await tryImportOnnxRuntime();
    this.session = await ort.InferenceSession.create(this.options.modelPath);

    const modelDir = path.dirname(this.options.labelsPath);
    const tokCfgDir = path.join(modelDir, "tokenizer_config");
    const vocabPath = path.join(tokCfgDir, "vocab.txt");

    if (!fs.existsSync(vocabPath)) {
      throw new OnnxBackendError(
        `Tokenizer vocabulary not found. Expected at ${vocabPath}. ` +
          "The training script exports tokenizer_config/ alongside the model.",
      );
    }

    const vocab = parseVocabTxt(fs.readFileSync(vocabPath, "utf-8"));

    let doLowerCase = true;
    let stripAccents: boolean | null = null;
    let tokenizeChineseChars = true;
    const tokCfgPath = path.join(tokCfgDir, "tokenizer_config.json");
    if (fs.existsSync(tokCfgPath)) {
      try {
        const cfg = JSON.parse(fs.readFileSync(tokCfgPath, "utf-8")) as {
          do_lower_case?: boolean;
          strip_accents?: boolean | null;
          tokenize_chinese_chars?: boolean;
        };
        if (typeof cfg.do_lower_case === "boolean") doLowerCase = cfg.do_lower_case;
        if (cfg.strip_accents === true || cfg.strip_accents === false) stripAccents = cfg.strip_accents;
        if (typeof cfg.tokenize_chinese_chars === "boolean") tokenizeChineseChars = cfg.tokenize_chinese_chars;
      } catch {
        // keep defaults
      }
    }

    this.tokenizer = new BertTokenizer(vocab, {
      doLowerCase,
      stripAccents,
      tokenizeChineseChars,
      maxLength: this.options.maxLength,
    });

    this.initialized = true;
  }

  /**
   * Run inference on a text input.
   *
   * @param text - Input text
   * @param _direction - Guard direction (model is direction-agnostic today)
   */
  async infer(text: string, _direction: GuardDirection): Promise<ModelInference> {
    await this.ensureInitialized();

    const clean = text.trim();
    if (clean.length < 3) {
      return {
        predictedLabel: "SAFE",
        confidence: 0.99,
        raw: { abstained: false, attackProbability: 0, reason: "too_short" },
      };
    }

    if (!this.session || !this.tokenizer) {
      throw new OnnxBackendError("ONNX session or tokenizer not initialized");
    }

    return this.inferOnnxRuntime(clean);
  }

  private async inferOnnxRuntime(text: string): Promise<ModelInference> {
    const tokenizer = this.tokenizer!;

    // ── Long-input coverage ───────────────────────────────────────────────────
    // A single forward pass sees at most maxLength tokens. Everything after that
    // is truncated away, so "here is a 4-page document [benign] … [injection]"
    // scores exactly like the benign opening. That is the document-buried /
    // slow-build class of attack (EchoLeak-style poisoned context, Crescendo
    // transcripts pasted in one turn) and truncation is a silent miss, not a
    // false negative the model got wrong.
    //
    // So when the content exceeds one model window we sweep OVERLAPPING windows
    // and keep the most severe DECIDED one. Three properties matter:
    //   - Overlap: a payload straddling a boundary would otherwise be split
    //     across two windows and diluted in both.
    //   - Small windows (windowSize << maxLength): measured, not guessed. This
    //     model is trained on short prompts and gets confidently wrong on long
    //     ones — at 254-token windows it labels ordinary business prose
    //     DATA_EXFILTRATION_ATTEMPT at 0.92. At 94 it does not.
    //   - "Decided", not raw: the winner is chosen on the post-calibration
    //     verdict (abstention + per-label threshold), never on raw
    //     attackProbability, which saturates near 1.0 even for benign text.
    //     Requiring each window to clear the same operating point a short input
    //     must clear stops N windows from becoming N chances to false-positive.
    //
    // Inputs that already fit one model window keep the exact previous
    // single-pass behaviour, so this is additive for everything except the
    // inputs that were silently truncated before.
    const contentIds = tokenizer.encodeContentIds(text);
    const modelWindow = tokenizer.windowBudget;
    if (!this.options.slidingWindow || contentIds.length <= modelWindow) {
      const probabilities = await this.forward(tokenizer.tokenize(text));
      return this.decide(probabilities, {
        windows: 1,
        windowIndex: 0,
        windowSize: Math.min(contentIds.length, modelWindow),
        tokensSeen: Math.min(contentIds.length, modelWindow),
        tokensTotal: contentIds.length,
      });
    }

    const windowSize = Math.max(1, Math.min(this.options.windowSize, modelWindow));
    const starts = this.planWindowStarts(contentIds.length, windowSize);
    const tokensSeen = coveredTokenCount(starts, windowSize, contentIds.length);

    let best: { decision: ModelInference; escalated: boolean; rank: number } | null = null;
    for (let i = 0; i < starts.length; i += 1) {
      const probabilities = await this.forward(
        tokenizer.encodeWindow(contentIds.slice(starts[i], starts[i] + windowSize)),
      );
      const decision = this.decide(probabilities, {
        windows: starts.length,
        windowIndex: i,
        windowSize,
        tokensSeen,
        tokensTotal: contentIds.length,
      });
      const escalated = decision.predictedLabel !== "SAFE";
      // Escalated windows always outrank non-escalated ones. Within a group,
      // escalated windows rank by their own confidence; non-escalated ones rank
      // by attackProbability so raw.* still points at the most suspicious region
      // for shadow-mode fusion even when nothing cleared the bar.
      const rank = escalated
        ? decision.confidence
        : Number((decision.raw?.attackProbability as number | undefined) ?? 0);
      if (!best || (escalated && !best.escalated) || (escalated === best.escalated && rank > best.rank)) {
        best = { decision, escalated, rank };
      }
    }

    return best!.decision;
  }

  /**
   * Overlapping window starts for one input, capped at maxWindows.
   *
   * The tail is always scored: without it, a payload in the final tokens is
   * dropped whenever the cap ends the sweep early — which is the exact position
   * an attacker picks when appending to a long benign document.
   */
  private planWindowStarts(contentLength: number, windowSize: number): number[] {
    const overlap = Math.min(this.options.windowOverlap, windowSize - 1);
    const stride = Math.max(1, windowSize - overlap);
    const starts: number[] = [];
    for (let start = 0; start < contentLength && starts.length < this.options.maxWindows; start += stride) {
      starts.push(start);
    }
    const tailStart = Math.max(0, contentLength - windowSize);
    if (!starts.includes(tailStart)) {
      if (starts.length >= this.options.maxWindows) starts[starts.length - 1] = tailStart;
      else starts.push(tailStart);
    }
    return starts;
  }

  /** One forward pass over an already-encoded window. Returns softmax probabilities. */
  private async forward(tokens: { inputIds: number[]; attentionMask: number[] }): Promise<number[]> {
    const ort = await tryImportOnnxRuntime();

    const inputIdsData = new BigInt64Array(tokens.inputIds.length);
    for (let i = 0; i < tokens.inputIds.length; i++) {
      inputIdsData[i] = BigInt(tokens.inputIds[i]);
    }
    const attnMaskData = new BigInt64Array(tokens.attentionMask.length);
    for (let i = 0; i < tokens.attentionMask.length; i++) {
      attnMaskData[i] = BigInt(tokens.attentionMask[i]);
    }

    const feeds: Record<string, any> = {
      input_ids: new ort.Tensor("int64", inputIdsData, [1, tokens.inputIds.length]),
      attention_mask: new ort.Tensor("int64", attnMaskData, [1, tokens.attentionMask.length]),
    };

    const results = await (this.session as any).run(feeds);
    const logitsOutput = results.logits ?? results["logits"];
    if (!logitsOutput) {
      throw new OnnxBackendError("ONNX model did not produce 'logits' output");
    }

    // v4 exports temperature-scaled logits already (logits/T baked in export).
    const logits: number[] = Array.from(logitsOutput.data as Float32Array);
    return softmax(logits);
  }

  /** Calibration, abstention, and thresholding over one window's probabilities. */
  private decide(
    probabilities: number[],
    span: {
      windows: number;
      windowIndex: number;
      windowSize: number;
      tokensSeen: number;
      tokensTotal: number;
    },
  ): ModelInference {
    const predictedIdx = argmax(probabilities);
    const predictedLabel = labelAtIndex(this.labels, predictedIdx);
    const confidence = probabilities[predictedIdx] ?? 0;
    const atkProb = attackProbability(probabilities, this.safeIndex);
    const top3 = this.topKLabels(probabilities, 3);

    // Abstention is ASYMMETRIC on purpose, and only ever demotes an attack call.
    // A SAFE argmax that still carries attack mass is not marked abstained, because
    // the caller's attack-probability fusion (mlAugment) is what recovers those —
    // flagging them here would set `abstained` and block that path instead.
    //
    // Two different uncertainties, chosen by whether the model saw the whole input:
    //   complete view  -> attack-vs-safe only (see shouldAbstain: label-space
    //                     entropy discarded real split-mass attacks);
    //   truncated view -> ALSO require label-space certainty, because on a fragment
    //                     of a long document split mass is an out-of-distribution
    //                     signature, not a statement about the attack class. Without
    //                     this, a benign 40-clause contract read as
    //                     DATA_EXFILTRATION_ATTEMPT (P(attack) 0.9971) escalated.
    // Long inputs are meant to be handled by covering them (ML_ONNX_SLIDING_WINDOW),
    // not by trusting a confident guess about the first 256 tokens.
    const truncatedView = span.tokensSeen < span.tokensTotal;
    const abstained =
      this.options.enableAbstention &&
      predictedLabel !== "SAFE" &&
      (shouldAbstain(probabilities, this.calibration, this.safeIndex) ||
        (truncatedView && labelSpaceUncertain(probabilities, this.calibration)));

    // Per-label calibrated threshold (v4). Fallback: global confidenceFloor.
    const isSafePred = predictedLabel === "SAFE";
    const clears =
      isSafePred ||
      clearsLabelThreshold(
        predictedLabel,
        confidence,
        this.calibration,
        this.options.confidenceFloor,
      );

    // Legacy v3 behaviour: below global floor → SAFE.
    // v4 improvement: if abstaining, still surface attackProbability in raw so
    // the ensemble can fuse, but do not claim a high-confidence attack label.
    let finalLabel: MLLabel = predictedLabel;
    const finalConfidence = Number(confidence.toFixed(4));

    if (abstained) {
      finalLabel = "SAFE";
    } else if (!isSafePred && !clears) {
      // Below operating point — do not escalate; report SAFE with true conf.
      finalLabel = "SAFE";
    } else if (!isSafePred && confidence < this.options.confidenceFloor) {
      // Global floor still applies when no per-label thr exists.
      if (this.calibration.per_label_thresholds[predictedLabel] === undefined) {
        finalLabel = "SAFE";
      }
    }

    return {
      predictedLabel: finalLabel,
      confidence: finalConfidence,
      raw: {
        probabilities: probabilities.map((p) => Number(p.toFixed(4))),
        top3,
        attackProbability: Number(atkProb.toFixed(4)),
        abstained,
        rawPredictedLabel: predictedLabel,
        rawConfidence: Number(confidence.toFixed(4)),
        calibrationVersion: this.calibration.version ?? null,
        maxLength: this.options.maxLength,
        windows: span.windows,
        windowIndex: span.windowIndex,
        windowSize: span.windowSize,
        truncated: truncatedView,
        contentTokens: span.tokensTotal,
        tokensScored: span.tokensSeen,
      },
    };
  }

  private topKLabels(
    probabilities: number[],
    k: number,
  ): Array<{ label: MLLabel; score: number }> {
    const indices = probabilities
      .map((p, i) => ({ p, i }))
      .sort((a, b) => b.p - a.p)
      .slice(0, k);

    return indices.map(({ p, i }) => ({
      label: labelAtIndex(this.labels, i),
      score: Number(p.toFixed(4)),
    }));
  }

  /** Expose calibration for tests / diagnostics. */
  getCalibration(): CalibrationConfig {
    return this.calibration;
  }

  async dispose(): Promise<void> {
    this.session = null;
    this.tokenizer = null;
    this.initialized = false;
    this.initPromise = null;
  }
}

// ── Dynamic imports ───────────────────────────────────────────────────────────

async function tryImportOnnxRuntime(): Promise<typeof import("onnxruntime-node")> {
  try {
    return await import("onnxruntime-node");
  } catch {
    throw new OnnxNotAvailableError();
  }
}

// ── Factory ───────────────────────────────────────────────────────────────────

export function createOnnxBackendFromEnv(): ONNXClassifierBackend | null {
  if (process.env.ML_BACKEND?.toLowerCase() !== "onnx") {
    return null;
  }

  return new ONNXClassifierBackend({
    modelPath: process.env.ML_ONNX_MODEL_PATH,
    labelsPath: process.env.ML_ONNX_LABELS_PATH,
    calibrationPath: process.env.ML_ONNX_CALIBRATION_PATH,
    confidenceFloor: process.env.ML_ONNX_CONFIDENCE_FLOOR
      ? Number(process.env.ML_ONNX_CONFIDENCE_FLOOR)
      : undefined,
    maxLength: process.env.ML_ONNX_MAX_LENGTH
      ? Number(process.env.ML_ONNX_MAX_LENGTH)
      : undefined,
  });
}
