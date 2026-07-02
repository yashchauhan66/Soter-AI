import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { BUILT_IN_AI_DESTINATIONS, type AIDestinationPolicy } from "@/packages/shared/src/ai-destinations";
import type { CreateAIDestinationInput } from "./schemas";

export async function ensureDestinationPresets(organizationId: string) {
  const count = await db.aIDestination.count({ where: { organizationId } });
  if (count) return;
  await db.$transaction(BUILT_IN_AI_DESTINATIONS.map((destination) => db.aIDestination.create({
    data: {
      destinationId: destination.destinationId,
      organizationId,
      name: destination.name,
      category: destination.category,
      domains: destination.domains,
      urlPatterns: destination.urlPatterns,
      enabled: destination.enabled,
      riskLevel: destination.defaultRiskLevel,
      allowedDepartments: destination.allowedDepartments,
      allowedRoles: destination.allowedRoles,
      policyOverrides: destination.policyOverrides,
      responseScanningEnabled: destination.responseScanningEnabled,
      loggingMode: destination.loggingMode,
    },
  })));
}

export async function listAIDestinations(organizationId: string, options: { seed?: boolean; enabledOnly?: boolean } = {}) {
  if (options.seed !== false) await ensureDestinationPresets(organizationId);
  const rows = await db.aIDestination.findMany({
    where: { organizationId, ...(options.enabledOnly ? { enabled: true } : {}) },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });
  return rows.map(toDestinationPolicy);
}

export async function createAIDestination(input: CreateAIDestinationInput) {
  const row = await db.aIDestination.create({
    data: {
      ...input,
      policyOverrides: input.policyOverrides as Prisma.InputJsonValue,
    },
  });
  return toDestinationPolicy(row);
}

export async function updateAIDestination(organizationId: string, id: string, patch: Omit<Partial<CreateAIDestinationInput>, "organizationId" | "destinationId">) {
  const existing = await db.aIDestination.findFirst({ where: { id, organizationId }, select: { id: true } });
  if (!existing) return null;
  const row = await db.aIDestination.update({
    where: { id },
    data: {
      ...patch,
      ...(patch.policyOverrides ? { policyOverrides: patch.policyOverrides as Prisma.InputJsonValue } : {}),
    },
  });
  return toDestinationPolicy(row);
}

export async function deleteAIDestination(organizationId: string, id: string) {
  const result = await db.aIDestination.deleteMany({ where: { id, organizationId } });
  return result.count > 0;
}

function toDestinationPolicy(row: {
  id: string; destinationId: string; organizationId: string; name: string; category: string; domains: string[]; urlPatterns: string[];
  enabled: boolean; riskLevel: string; allowedDepartments: string[]; allowedRoles: string[]; policyOverrides: unknown;
  responseScanningEnabled: boolean; loggingMode: string; createdAt: Date; updatedAt: Date;
}): AIDestinationPolicy {
  return {
    id: row.id,
    destinationId: row.destinationId,
    organizationId: row.organizationId,
    name: row.name,
    category: row.category as AIDestinationPolicy["category"],
    domains: row.domains,
    urlPatterns: row.urlPatterns,
    enabled: row.enabled,
    defaultRiskLevel: row.riskLevel as AIDestinationPolicy["defaultRiskLevel"],
    riskLevel: row.riskLevel as AIDestinationPolicy["riskLevel"],
    allowedDepartments: row.allowedDepartments,
    allowedRoles: row.allowedRoles,
    policyOverrides: (row.policyOverrides ?? {}) as AIDestinationPolicy["policyOverrides"],
    responseScanningEnabled: row.responseScanningEnabled,
    loggingMode: row.loggingMode as AIDestinationPolicy["loggingMode"],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
