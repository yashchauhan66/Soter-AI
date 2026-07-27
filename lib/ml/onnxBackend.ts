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
  loadCalibration,
  shouldAbstain,
  type CalibrationConfig,
} from "./calibration";

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
    const ort = await tryImportOnnxRuntime();
    const tokens = this.tokenizer!.tokenize(text);

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
    const probabilities = softmax(logits);
    const predictedIdx = argmax(probabilities);
    let predictedLabel = labelAtIndex(this.labels, predictedIdx);
    const confidence = probabilities[predictedIdx] ?? 0;
    const atkProb = attackProbability(probabilities, this.safeIndex);
    const maxProb = Math.max(...probabilities);
    const top3 = this.topKLabels(probabilities, 3);

    const abstained =
      this.options.enableAbstention &&
      predictedLabel !== "SAFE" &&
      shouldAbstain(maxProb, probabilities, this.calibration);

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
