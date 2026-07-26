// Phase 6: training workflow + backends.
// We do not train a deep model in-process. The "training" workflow is:
//   1. Snapshot dataset version
//   2. Materialise a thresholds vector (per-label confidence floors)
//   3. Register a new MLModelVersion in the registry
//   4. Run evaluation against the snapshot
// External ML APIs are wired via the `external-api` backend but raw text must
// already be redacted (see lib/ml/types redactBeforePersistence).

import { analyzeText } from "../guard/analyze";
import { MultilingualClassifier } from "../classifiers/multilingual";
import type { GuardDirection } from "../guard/types";
import type { MLLabel } from "@prisma/client";
import { isMLLabel, normalizeConfidence, type ModelBackend, type ModelInference } from "./types";

function mapRiskTypeToLabel(riskType: string): MLLabel {
  if (riskType.includes("SYSTEM_PROMPT")) return "SYSTEM_PROMPT_LEAK_ATTEMPT";
  if (riskType.includes("JAILBREAK")) return "JAILBREAK";
  if (riskType.includes("PROMPT_INJECTION")) return "PROMPT_INJECTION";
  if (riskType.includes("DATA_EXFILTRATION")) return "DATA_EXFILTRATION_ATTEMPT";
  if (riskType.includes("RAG_POISONING")) return "RAG_POISONING";
  if (riskType.includes("SECRET")) return "SECRET";
  if (riskType.includes("PII")) return "PII";
  if (riskType.includes("UNSAFE_OUTPUT")) return "UNSAFE_OUTPUT";
  return "SAFE";
}

function hasRagPoisoningContext(text: string): boolean {
  return (
    /\b(?:retrieved|retrieval|rag|knowledge[- ]base|context|chunk|chunks?|source|sources?)\b/i.test(text) &&
    /\b(?:ignore|override|disregard|forget|send|post|upload|exfiltrate|forward|leak|reveal|private|secret|token|api.?key|system instructions?)\b/i.test(text)
  );
}

function choosePrimaryLabel(riskTypes: string[], text: string): MLLabel {
  const labels = new Set(riskTypes.map(mapRiskTypeToLabel));

  // RAG poisoning is a contextual label: the rule detector may correctly fire as
  // prompt injection or exfiltration, but the ML-facing taxonomy should preserve
  // that the malicious instruction came from retrieved/document context.
  if (
    hasRagPoisoningContext(text) &&
    (labels.has("PROMPT_INJECTION") ||
      labels.has("DATA_EXFILTRATION_ATTEMPT") ||
      labels.has("SYSTEM_PROMPT_LEAK_ATTEMPT"))
  ) {
    return "RAG_POISONING";
  }

  const priority: MLLabel[] = [
    "SYSTEM_PROMPT_LEAK_ATTEMPT",
    "JAILBREAK",
    "DATA_EXFILTRATION_ATTEMPT",
    "SECRET",
    "PII",
    "UNSAFE_OUTPUT",
    "RAG_POISONING",
    "PROMPT_INJECTION",
  ];
  return priority.find((label) => labels.has(label)) ?? "SAFE";
}

export class HeuristicMLBackend implements ModelBackend {
  id = "heuristic" as const;
  constructor(private readonly thresholds: Partial<Record<MLLabel, number>> = {}) {}

  async infer(text: string, direction: GuardDirection): Promise<ModelInference> {
    const guard = analyzeText(text, direction);
    const riskTypes = guard.riskTypes;
    let primary: MLLabel = choosePrimaryLabel(riskTypes, text);
    let confidence = Math.max(0.5, Math.min(0.98, guard.riskScore / 100));

    // Multilingual signal escalates the prediction if a Hindi/Hinglish phrase
    // matched, even when the rule guard considered it low risk.
    const multilingual = await new MultilingualClassifier().classify(text);
    if (multilingual.riskType && multilingual.riskType !== "LOW_RISK") {
      primary = mapRiskTypeToLabel(multilingual.riskType);
      confidence = Math.max(confidence, multilingual.confidence);
    }

    const floor = this.thresholds[primary];
    if (floor !== undefined && confidence < floor) primary = "SAFE";

    if (primary === "SAFE") confidence = Math.max(0.55, 1 - guard.riskScore / 100);
    return { predictedLabel: primary, confidence: Number(confidence.toFixed(4)) };
  }
}

export interface ExternalApiBackendOptions {
  url: string;
  headers?: Record<string, string>;
  timeoutMs?: number;
  thresholds?: Partial<Record<MLLabel, number>>;
  failClosed?: boolean;
}

export class ExternalApiBackend implements ModelBackend {
  id = "external-api" as const;
  constructor(private readonly options: ExternalApiBackendOptions) {}

  async infer(text: string, direction: GuardDirection): Promise<ModelInference> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.options.timeoutMs ?? 5_000);
    try {
      const response = await fetch(this.options.url, {
        method: "POST",
        headers: { "content-type": "application/json", ...(this.options.headers ?? {}) },
        body: JSON.stringify({ text, direction }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`External ML API returned ${response.status}`);
      const data = (await response.json()) as { label?: unknown; confidence?: unknown };
      const candidate = typeof data.label === "string" ? data.label.toUpperCase() : "";
      if (!isMLLabel(candidate)) throw new Error(`External ML API returned an invalid label: ${String(data.label)}`);
      const label = candidate;
      const confidence = normalizeConfidence(data.confidence);
      if (confidence === 0 && data.confidence !== 0) {
        throw new Error("External ML API returned an invalid confidence");
      }
      const floor = this.options.thresholds?.[label];
      if (floor !== undefined && confidence < floor) return { predictedLabel: "SAFE", confidence };
      return { predictedLabel: label, confidence };
    } catch (error) {
      if (this.options.failClosed) throw error;
      return { predictedLabel: "SAFE", confidence: 0 };
    } finally {
      clearTimeout(timer);
    }
  }
}

export function getDefaultBackend(): ModelBackend {
  if (process.env.ML_BACKEND === "external-api" && process.env.ML_API_URL) {
    return new ExternalApiBackend({
      url: process.env.ML_API_URL,
      headers: process.env.ML_API_KEY ? { authorization: `Bearer ${process.env.ML_API_KEY}` } : undefined,
      timeoutMs: Number(process.env.ML_API_TIMEOUT_MS ?? "5000"),
      failClosed: process.env.ML_API_FAIL_CLOSED === "true",
    });
  }
  return new HeuristicMLBackend();
}
