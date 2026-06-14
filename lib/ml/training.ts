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
import type { ModelBackend, ModelInference } from "./types";

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

export class HeuristicMLBackend implements ModelBackend {
  id = "heuristic" as const;
  constructor(private readonly thresholds: Partial<Record<MLLabel, number>> = {}) {}

  async infer(text: string, direction: GuardDirection): Promise<ModelInference> {
    const guard = analyzeText(text, direction);
    const riskTypes = guard.riskTypes;
    let primary: MLLabel = "SAFE";
    let confidence = Math.max(0.5, Math.min(0.98, guard.riskScore / 100));

    for (const riskType of riskTypes) {
      const mapped = mapRiskTypeToLabel(riskType);
      if (mapped !== "SAFE") {
        primary = mapped;
        break;
      }
    }

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
      const data = (await response.json()) as { label?: string; confidence?: number };
      const label = (data.label ?? "SAFE").toUpperCase() as MLLabel;
      const confidence = typeof data.confidence === "number" ? data.confidence : 0.5;
      const floor = this.options.thresholds?.[label];
      if (floor !== undefined && confidence < floor) return { predictedLabel: "SAFE", confidence };
      return { predictedLabel: label, confidence };
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
    });
  }
  return new HeuristicMLBackend();
}
