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

// ── Tokenizer (lightweight, for onnxruntime-node path) ────────────────────────

interface TokenizerResult {
  inputIds: number[];
  attentionMask: number[];
}

/**
 * Minimal WordPiece tokenizer for BERT-family models.
 * Supports the same vocabulary format as HuggingFace's tokenizer_config/.
 * Not as robust as the full tokenizer, but sufficient for inference on
 * short text (attack prompts) with < 128 tokens.
 */
class LightweightTokenizer {
  private vocab: Map<string, number>;
  private reverseVocab: Map<number, string>;
  private clsTokenId: number;
  private sepTokenId: number;
  private padTokenId: number;
  private unkTokenId: number;

  readonly maxLength: number;

  constructor(vocabPath?: string, maxLength = 128) {
    this.vocab = new Map();
    this.reverseVocab = new Map();
    this.maxLength = maxLength;

    if (vocabPath) {
      this.loadVocab(vocabPath);
    }

    // Standard BERT special tokens
    this.clsTokenId = this.vocab.get("[CLS]") ?? 101;
    this.sepTokenId = this.vocab.get("[SEP]") ?? 102;
    this.padTokenId = this.vocab.get("[PAD]") ?? 0;
    this.unkTokenId = this.vocab.get("[UNK]") ?? 100;
  }

  private loadVocab(vocabPath: string): void {
    const raw = fs.readFileSync(vocabPath, "utf-8");
    const lines = raw.split("\n");

    // HuggingFace vocab.txt: one token per line, where the line index IS the token ID.
    // Some tokenizers also export "word<space>id" format. Handle both.
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const parts = line.split(/\s+/);
      if (parts.length >= 2) {
        // "word 123" format — explicit ID
        this.vocab.set(parts[0], parseInt(parts[1], 10));
      } else {
        // "word" format — line number is the ID
        this.vocab.set(parts[0], i);
      }
    }

    for (const [token, id] of this.vocab) {
      this.reverseVocab.set(id, token);
    }

    if (this.vocab.size < 100) {
      throw new OnnxBackendError(
        `Vocabulary file ${vocabPath} appears invalid: only ${this.vocab.size} tokens loaded. ` +
          "Expected 30,000+ tokens for a BERT-family model.",
      );
    }
  }

  /** Simple WordPiece tokenization. Handles basic cases. */
  tokenize(text: string): TokenizerResult {
    const normalized = text.toLowerCase().replace(/[^\w\s!?'.,;:-]/g, " ").trim();
    const words = normalized.split(/\s+/).filter(Boolean);

    const tokens: number[] = [this.clsTokenId];
    const maxLen = this.maxLength;

    for (const word of words) {
      if (tokens.length >= maxLen - 1) break;

      // Check if full word exists in vocabulary
      if (this.vocab.has(word)) {
        tokens.push(this.vocab.get(word)!);
        continue;
      }

      // Try subword tokenization: prepend ## for continuations
      let current = word;
      let first = true;
      while (current.length > 0 && tokens.length < maxLen - 1) {
        let found = false;
        for (let end = current.length; end > 0; end--) {
          const subword = first ? current.slice(0, end) : "##" + current.slice(0, end);
          if (this.vocab.has(subword)) {
            tokens.push(this.vocab.get(subword)!);
            current = current.slice(end);
            first = false;
            found = true;
            break;
          }
        }
        if (!found) {
          tokens.push(this.unkTokenId);
          break;
        }
      }
    }

    tokens.push(this.sepTokenId);

    // Pad to max length
    const inputIds = [...tokens];
    const attentionMask: number[] = [];
    for (let i = 0; i < maxLen; i++) {
      if (i < inputIds.length) {
        attentionMask.push(1);
      } else {
        inputIds.push(this.padTokenId);
        attentionMask.push(0);
      }
    }

    return {
      inputIds: inputIds.slice(0, maxLen),
      attentionMask: attentionMask.slice(0, maxLen),
    };
  }
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
  private tokenizer: LightweightTokenizer | null = null;

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

    // 4. Load tokenizer vocabulary (exported alongside the model)
    const modelDir = path.dirname(this.options.labelsPath);
    const vocabPath = path.join(modelDir, "tokenizer_config", "vocab.txt");
    const altVocabPath = path.join(modelDir, "tokenizer_config", "vocab.json");

    if (fs.existsSync(vocabPath)) {
      this.tokenizer = new LightweightTokenizer(vocabPath, this.options.maxLength);
    } else if (fs.existsSync(altVocabPath)) {
      this.tokenizer = new LightweightTokenizer(altVocabPath, this.options.maxLength);
    } else {
      throw new OnnxBackendError(
        `Tokenizer vocabulary not found. Expected at ${vocabPath}. ` +
          "The training script exports tokenizer_config/ alongside the model.",
      );
    }

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
