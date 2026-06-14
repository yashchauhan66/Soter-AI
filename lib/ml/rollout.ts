// Phase 6: rollout helpers — deciding whether to run inference at all and
// applying safe fallback to rule-based detectors when ML inference fails.

import { getActiveDeployment } from "./registry";
import { getDefaultBackend, HeuristicMLBackend } from "./training";
import type { GuardDirection } from "../guard/types";
import type { MLLabel } from "@prisma/client";
import type { ModelBackend, ModelPrediction } from "./types";

export interface RolloutContext {
  organizationId: string;
  projectId?: string | null;
  // Stable hash for percent rollout (e.g. project id, request id).
  stableKey?: string;
}

export interface RolloutDecision {
  shouldRun: boolean;
  shouldRecordOnly: boolean;
  modelVersionId?: string;
  rolloutPercent: number;
  mode: "OFF" | "SHADOW" | "PARTIAL" | "FULL";
}

function hashToPercent(key: string): number {
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return hash % 100;
}

export async function shouldRunModel(context: RolloutContext): Promise<RolloutDecision> {
  const deployment = await getActiveDeployment(context.organizationId, context.projectId ?? null);
  if (!deployment) return { shouldRun: false, shouldRecordOnly: false, rolloutPercent: 0, mode: "OFF" };

  if (deployment.rolloutMode === "SHADOW") {
    return { shouldRun: true, shouldRecordOnly: true, modelVersionId: deployment.modelVersionId, rolloutPercent: deployment.rolloutPercent, mode: "SHADOW" };
  }

  if (deployment.rolloutMode === "FULL") {
    return { shouldRun: true, shouldRecordOnly: false, modelVersionId: deployment.modelVersionId, rolloutPercent: 100, mode: "FULL" };
  }

  if (deployment.rolloutMode === "PARTIAL") {
    const sample = hashToPercent(context.stableKey ?? `${context.organizationId}:${context.projectId ?? "all"}`);
    const within = sample < deployment.rolloutPercent;
    return { shouldRun: true, shouldRecordOnly: !within, modelVersionId: deployment.modelVersionId, rolloutPercent: deployment.rolloutPercent, mode: "PARTIAL" };
  }

  return { shouldRun: false, shouldRecordOnly: false, rolloutPercent: 0, mode: "OFF" };
}

export interface ModelInvocationResult {
  ranModel: boolean;
  shadowOnly: boolean;
  prediction?: ModelPrediction;
  fallbackUsed: boolean;
  fallbackReason?: string;
}

export async function runWithFallback(
  text: string,
  direction: GuardDirection,
  context: RolloutContext,
  backend: ModelBackend = getDefaultBackend(),
): Promise<ModelInvocationResult> {
  const decision = await shouldRunModel(context);
  if (!decision.shouldRun) return { ranModel: false, shadowOnly: false, fallbackUsed: false };

  // Wrap inference so a backend failure never leaks into the guard pipeline.
  try {
    const inference = await backend.infer(text, direction);
    const prediction: ModelPrediction = {
      label: inference.predictedLabel,
      confidence: inference.confidence,
      modelVersionId: decision.modelVersionId ?? "unknown",
      backend: backend.id,
      reason: `model=${backend.id} mode=${decision.mode}`,
    };
    return { ranModel: true, shadowOnly: decision.shouldRecordOnly, prediction, fallbackUsed: false };
  } catch (error) {
    const fallback = new HeuristicMLBackend();
    if (backend.id === "heuristic") {
      // Even the heuristic failed somehow — fail closed (safe).
      return {
        ranModel: false,
        shadowOnly: decision.shouldRecordOnly,
        fallbackUsed: true,
        fallbackReason: (error as Error).message ?? "heuristic failed",
      };
    }
    try {
      const inference = await fallback.infer(text, direction);
      return {
        ranModel: true,
        shadowOnly: decision.shouldRecordOnly,
        prediction: {
          label: inference.predictedLabel,
          confidence: inference.confidence,
          modelVersionId: decision.modelVersionId ?? "fallback",
          backend: "heuristic",
          reason: `fallback engaged: ${(error as Error).message}`,
        },
        fallbackUsed: true,
        fallbackReason: (error as Error).message,
      };
    } catch (innerError) {
      return {
        ranModel: false,
        shadowOnly: decision.shouldRecordOnly,
        fallbackUsed: true,
        fallbackReason: (innerError as Error).message ?? "fallback failed",
      };
    }
  }
}

export const SAFE_LABEL: MLLabel = "SAFE";
