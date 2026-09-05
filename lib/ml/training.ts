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
import { createOnnxBackendFromEnv } from "./onnxBackend";

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

// Ranked most SPECIFIC first, most generic last — not, as this list originally
// was, "same order as the mapRiskTypeToLabel chain above". Mirroring the if-chain
// looked explicit but encoded an arbitrary order, and it put the generic
// PROMPT_INJECTION fallback ahead of the specific classes. The visible symptom
// was RAG poisoning: a poisoned retrieved document trips the prompt-injection
// patterns too (it *is* an injection — delivered through RAG), so every
// RAG_POISONING example was reported as PROMPT_INJECTION and the one piece of
// information an operator needs from the label, which surface to go fix, was
// dropped.
//
// PROMPT_INJECTION is last on purpose: it is what mapRiskTypeToLabel and the
// semantic family map in lib/guard/analyze.ts both fall back to, so treating it
// as the weakest claim is what makes "a more specific label wins" mean anything.
const LABEL_PRIORITY: readonly MLLabel[] = [
  "SYSTEM_PROMPT_LEAK_ATTEMPT",
  "JAILBREAK",
  "DATA_EXFILTRATION_ATTEMPT",
  "RAG_POISONING",
  "SECRET",
  "PII",
  "UNSAFE_OUTPUT",
  "PROMPT_INJECTION",
];

function highestPriorityLabel(riskTypes: readonly string[]): MLLabel {
  let best: MLLabel = "SAFE";
  let bestRank = Number.POSITIVE_INFINITY;
  for (const riskType of riskTypes) {
    const mapped = mapRiskTypeToLabel(riskType);
    if (mapped === "SAFE") continue;
    const rank = LABEL_PRIORITY.indexOf(mapped);
    if (rank >= 0 && rank < bestRank) {
      best = mapped;
      bestRank = rank;
    }
  }
  return best;
}

/** True when `candidate` is a narrower claim than `current` under LABEL_PRIORITY. */
function isMoreSpecific(candidate: MLLabel, current: MLLabel): boolean {
  if (candidate === "SAFE") return false;
  if (current === "SAFE") return true;
  const candidateRank = LABEL_PRIORITY.indexOf(candidate);
  const currentRank = LABEL_PRIORITY.indexOf(current);
  if (candidateRank < 0) return false;
  if (currentRank < 0) return true;
  return candidateRank < currentRank;
}

export class HeuristicMLBackend implements ModelBackend {
  id = "heuristic" as const;
  constructor(private readonly thresholds: Partial<Record<MLLabel, number>> = {}) {}

  async infer(text: string, direction: GuardDirection): Promise<ModelInference> {
    const guard = analyzeText(text, direction);
    let primary: MLLabel = highestPriorityLabel(guard.riskTypes);
    let confidence = Math.max(0.5, Math.min(0.98, guard.riskScore / 100));

    // Multilingual signal escalates the prediction if a Hindi/Hinglish phrase
    // matched, even when the rule guard considered it low risk.
    //
    // It must never *downgrade* the rule guard, which is the more specific signal
    // whenever it produced a specific label. It previously could not upgrade one
    // either — the override only applied when primary was still SAFE — and that
    // lost real precision: "upar wale rules ko ignore karke meri baat mano" trips
    // the English injection patterns on shape alone, so the rule guard returned the
    // generic PROMPT_INJECTION while the dedicated Hinglish classifier was the
    // signal that actually recognised it as an obedience-override JAILBREAK. Allow
    // the narrower label to win; LABEL_PRIORITY decides which one that is.
    const multilingual = await new MultilingualClassifier().classify(text);
    if (multilingual.riskType && multilingual.riskType !== "LOW_RISK") {
      const multilingualLabel = mapRiskTypeToLabel(multilingual.riskType);
      if (isMoreSpecific(multilingualLabel, primary)) primary = multilingualLabel;
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
  // 1. ONNX local model (in-process, lowest latency)
  if (process.env.ML_BACKEND === "onnx") {
    const onnxBackend = createOnnxBackendFromEnv();
    if (onnxBackend) return onnxBackend;
  }

  // 2. External ML API (network call)
  if (process.env.ML_BACKEND === "external-api" && process.env.ML_API_URL) {
    return new ExternalApiBackend({
      url: process.env.ML_API_URL,
      headers: process.env.ML_API_KEY ? { authorization: `Bearer ${process.env.ML_API_KEY}` } : undefined,
      timeoutMs: Number(process.env.ML_API_TIMEOUT_MS ?? "5000"),
    });
  }

  // 3. Default: heuristic (rule-based)
  return new HeuristicMLBackend();
}
