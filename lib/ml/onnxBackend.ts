/**
 * ONNX Classifier Backend
 *
 * Loads a fine-tuned MiniLM-L6-v2 ONNX model exported by
 * scripts/ml/train-onnx-model.py and runs inference in-process using
 * onnxruntime-node + a lightweight WordPiece tokenizer.
 *
 * This backend implements the ModelBackend interface so it plugs into the
 * existing rollout infrastructure (lib/ml/rollout.ts → runWithFallback)
 * and supports SHADOW / PARTIAL / FULL deployment.
 *
 * Environment variables:
 *   ML_BACKEND=onnx                           — selects this backend
 *   ML_ONNX_MODEL_PATH=models/ml-classifier-v1/model.onnx  — ONNX model file
 *   ML_ONNX_LABELS_PATH=models/ml-classifier-v1/labels.json — label mapping
 *   ML_ONNX_CONFIDENCE_FLOOR=0.50             — minimum confidence to accept
 *
 * Dependencies:
 *   npm install onnxruntime-node
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { GuardDirection } from "../guard/types";
import type { MLLabel } from "@prisma/client";
import type { ModelBackend, ModelInference } from "./types";
import { BertTokenizer, parseVocabTxt } from "./bertTokenizer";

// ── Types ────────────────────────────────────────────────────────────────────

interface LabelMap {
  [index: string]: string; // e.g. "0" → "PROMPT_INJECTION"
}

interface OnnxBackendOptions {
  /** Path to the ONNX model file (.onnx) */
  modelPath?: string;
  /** Path to the labels JSON file */
  labelsPath?: string;
  /** Minimum confidence threshold; predictions below this floor return SAFE */
  confidenceFloor?: number;
  /** Max sequence length for tokenization */
  maxLength?: number;
}

// ── Error types ───────────────────────────────────────────────────────────────

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
  // Validate: every index should map to a known label
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
  let bestVal = values[0];
  for (let i = 1; i < values.length; i++) {
    if (values[i] > bestVal) {
      bestVal = values[i];
      bestIdx = i;
    }
  }
  return bestIdx;
}


// ── ONNX Backend ──────────────────────────────────────────────────────────────

/**
 * ONNXClassifierBackend — loads a fine-tuned MiniLM ONNX model and runs
 * inference in-process using either @xenova/transformers (preferred) or
 * onnxruntime-node (fallback).
 *
 * The backend is lazy-initialized: the model is loaded on the first infer()
 * call, not at construction time. This keeps startup fast and allows the
 * backend to be instantiated even when no model file exists yet.
 */
export class ONNXClassifierBackend implements ModelBackend {
  id = "onnx" as const;

  private options: Required<OnnxBackendOptions>;
  private session: unknown = null;          // onnxruntime InferenceSession
  private labels: LabelMap = {};
  private tokenizer: BertTokenizer | null = null;

  // Cached for reuse across infer() calls
  private initialized = false;
  private initPromise: Promise<void> | null = null;

  constructor(options?: OnnxBackendOptions) {
    this.options = {
      modelPath: options?.modelPath ?? process.env.ML_ONNX_MODEL_PATH ?? "models/ml-classifier-v1/model.onnx",
      labelsPath: options?.labelsPath ?? process.env.ML_ONNX_LABELS_PATH ?? "models/ml-classifier-v1/labels.json",
      confidenceFloor: options?.confidenceFloor ?? Number(process.env.ML_ONNX_CONFIDENCE_FLOOR ?? "0.5"),
      maxLength: options?.maxLength ?? 128,
    };
  }

  /**
   * Lazy initialization — loads the ONNX model and label mapping.
   * Safe to call multiple times; subsequent calls are no-ops.
   */
  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this._init();
    await this.initPromise;
  }

  private async _init(): Promise<void> {
    // 1. Check model file exists
    if (!fs.existsSync(this.options.modelPath)) {
      throw new OnnxBackendError(
        `ONNX model not found at ${this.options.modelPath}. ` +
          "Run scripts/ml/train-onnx-model.py first, or set ML_ONNX_MODEL_PATH.",
      );
    }

    // 2. Load label mapping
    this.labels = loadLabelMap(this.options.labelsPath);

    // 3. Load model via onnxruntime-node
    const ort = await tryImportOnnxRuntime();
    this.session = await ort.InferenceSession.create(this.options.modelPath);

    // 4. Load the tokenizer. We use a faithful BERT WordPiece implementation
    //    (lib/ml/bertTokenizer.ts) whose token ids are verified to match the
    //    Python HuggingFace tokenizer the model trained with — see
    //    scripts/ml/verify-tokenizer-parity.ts. This replaces an earlier regex
    //    approximation that drifted confidence and dropped real attacks.
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

    // Read tokenizer_config.json for the BERT normalization flags (falls back
    // to standard uncased-BERT defaults if absent).
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
        // keep defaults on a malformed config
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
   * @param text - The input text to classify
   * @param _direction - Guard direction (INPUT/OUTPUT — currently unused by this model)
   * @returns ModelInference with predicted label and confidence score
   */
  async infer(text: string, _direction: GuardDirection): Promise<ModelInference> {
    await this.ensureInitialized();

    const clean = text.trim();
    if (clean.length < 3) {
      return { predictedLabel: "SAFE", confidence: 0.99 };
    }

    if (!this.session || !this.tokenizer) {
      throw new OnnxBackendError("ONNX session or tokenizer not initialized");
    }

    return this.inferOnnxRuntime(clean);
  }

  /** Inference via onnxruntime-node + lightweight tokenizer. */
  private async inferOnnxRuntime(text: string): Promise<ModelInference> {
    const ort = await tryImportOnnxRuntime();
    const tokens = this.tokenizer!.tokenize(text);

    // Build int64 tensors manually (BigInt64Array.from() not available everywhere)
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

    const logits: number[] = Array.from(logitsOutput.data as Float32Array);
    const probabilities = softmax(logits);
    const predictedIdx = argmax(probabilities);
    const predictedLabel = labelAtIndex(this.labels, predictedIdx);
    const confidence = probabilities[predictedIdx];

    if (confidence < this.options.confidenceFloor) {
      return { predictedLabel: "SAFE", confidence: Number(confidence.toFixed(4)) };
    }

    return {
      predictedLabel,
      confidence: Number(confidence.toFixed(4)),
      raw: {
        probabilities: probabilities.map((p) => Number(p.toFixed(4))),
        top3: this.topKLabels(probabilities, 3),
      },
    };
  }

  /** Return the top-K labels with their scores. */
  private topKLabels(probabilities: number[], k: number): Array<{ label: MLLabel; score: number }> {
    const indices = probabilities
      .map((p, i) => ({ p, i }))
      .sort((a, b) => b.p - a.p)
      .slice(0, k);

    return indices.map(({ p, i }) => ({
      label: labelAtIndex(this.labels, i),
      score: Number(p.toFixed(4)),
    }));
  }

  /** Clean up resources. */
  async dispose(): Promise<void> {
    this.session = null;
    this.tokenizer = null;
    this.initialized = false;
    this.initPromise = null;
  }
}

// ── Dynamic imports (lazy, so the module loads even without deps installed) ───

async function tryImportOnnxRuntime(): Promise<typeof import("onnxruntime-node")> {
  try {
    return await import("onnxruntime-node");
  } catch {
    throw new OnnxNotAvailableError();
  }
}

// ── Factory ───────────────────────────────────────────────────────────────────

/**
 * Create an ONNXClassifierBackend from environment variables.
 * Returns null if ML_BACKEND !== "onnx".
 */
export function createOnnxBackendFromEnv(): ONNXClassifierBackend | null {
  if (process.env.ML_BACKEND?.toLowerCase() !== "onnx") {
    return null;
  }

  return new ONNXClassifierBackend({
    modelPath: process.env.ML_ONNX_MODEL_PATH,
    labelsPath: process.env.ML_ONNX_LABELS_PATH,
    confidenceFloor: process.env.ML_ONNX_CONFIDENCE_FLOOR
      ? Number(process.env.ML_ONNX_CONFIDENCE_FLOOR)
      : undefined,
  });
}
