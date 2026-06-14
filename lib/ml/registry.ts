// Phase 6: registry of model versions, deployments, and rollout updates.

import { db } from "../db";
import type {
  MLLabel,
  MLModelDeployment,
  MLModelVersion,
  MLRolloutMode,
} from "@prisma/client";

export interface CreateModelVersionInput {
  organizationId: string;
  name: string;
  version: string;
  backend?: "heuristic" | "external-api";
  thresholds?: Record<string, number>;
  notes?: string;
}

export async function createModelVersion(input: CreateModelVersionInput): Promise<MLModelVersion> {
  return db.mLModelVersion.create({
    data: {
      organizationId: input.organizationId,
      name: input.name,
      version: input.version,
      backend: input.backend ?? "heuristic",
      thresholds: input.thresholds ? input.thresholds : undefined,
      notes: input.notes,
    },
  });
}

export async function listModelVersions(organizationId: string) {
  return db.mLModelVersion.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    include: {
      deployments: true,
      evaluations: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
}

export async function getModelVersion(id: string) {
  return db.mLModelVersion.findUnique({
    where: { id },
    include: { evaluations: { orderBy: { createdAt: "desc" }, take: 5 } },
  });
}

export async function setRollout(input: {
  organizationId: string;
  modelVersionId: string;
  mode: MLRolloutMode;
  percent?: number;
  projectId?: string | null;
  notes?: string;
}): Promise<MLModelDeployment> {
  const projectId = input.projectId ?? null;
  // If switching to FULL, ensure no other deployment is FULL for this project.
  if (input.mode === "FULL") {
    await db.mLModelDeployment.updateMany({
      where: {
        organizationId: input.organizationId,
        projectId,
        rolloutMode: "FULL",
        modelVersionId: { not: input.modelVersionId },
      },
      data: { rolloutMode: "OFF", rolloutPercent: 0 },
    });
  }
  const percent = Math.min(100, Math.max(0, input.percent ?? (input.mode === "FULL" ? 100 : input.mode === "OFF" ? 0 : 50)));
  const existing = await db.mLModelDeployment.findFirst({
    where: {
      organizationId: input.organizationId,
      modelVersionId: input.modelVersionId,
      projectId,
    },
  });
  if (existing) {
    return db.mLModelDeployment.update({
      where: { id: existing.id },
      data: { rolloutMode: input.mode, rolloutPercent: percent, notes: input.notes },
    });
  }
  return db.mLModelDeployment.create({
    data: {
      organizationId: input.organizationId,
      modelVersionId: input.modelVersionId,
      projectId,
      rolloutMode: input.mode,
      rolloutPercent: percent,
      notes: input.notes,
    },
  });
}

export async function getActiveDeployment(organizationId: string, projectId?: string | null) {
  const candidates = await db.mLModelDeployment.findMany({
    where: {
      organizationId,
      OR: [{ projectId: projectId ?? null }, { projectId: null }],
      rolloutMode: { in: ["SHADOW", "PARTIAL", "FULL"] },
    },
    include: { modelVersion: true },
    orderBy: [{ rolloutMode: "asc" }, { updatedAt: "desc" }],
  });
  if (!candidates.length) return null;
  // Prefer FULL > PARTIAL > SHADOW for a given project; project-specific overrides global.
  const ordered = [...candidates].sort((a, b) => {
    const ranking = { FULL: 3, PARTIAL: 2, SHADOW: 1, OFF: 0 } as const;
    const rankDelta = ranking[b.rolloutMode] - ranking[a.rolloutMode];
    if (rankDelta !== 0) return rankDelta;
    if (a.projectId && !b.projectId) return -1;
    if (!a.projectId && b.projectId) return 1;
    return b.updatedAt.getTime() - a.updatedAt.getTime();
  });
  return ordered[0];
}

export async function rollbackToPrevious(organizationId: string, projectId?: string | null) {
  const active = await getActiveDeployment(organizationId, projectId);
  if (!active) return null;
  // Pick the next-most-recent SHADOW or FULL deployment that is not the active one.
  const next = await db.mLModelDeployment.findFirst({
    where: {
      organizationId,
      projectId: projectId ?? null,
      modelVersionId: { not: active.modelVersionId },
    },
    orderBy: { updatedAt: "desc" },
  });
  await db.mLModelDeployment.update({ where: { id: active.id }, data: { rolloutMode: "OFF", rolloutPercent: 0 } });
  if (!next) return null;
  return db.mLModelDeployment.update({
    where: { id: next.id },
    data: { rolloutMode: "FULL", rolloutPercent: 100 },
  });
}

export const ALL_ML_LABELS: MLLabel[] = [
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
