import { createHash, randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { sanitizeLogText } from "@/lib/guard/logSafety";
import { requireTenantProjectOwnership } from "@/lib/phase11/tenantIsolation";

export type SupplyChainRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export const AI_BOM_PREVIEW_GAPS = [
  "Create/update workflow for providers, models, prompt versions, tools, and BOM snapshots is not complete.",
  "Review and approval workflow for AI BOM risk findings is not complete.",
  "Signed export package and evidence bundle generation are not complete.",
  "Provider interoperability and data-residency evidence require authorized production or staging verification.",
] as const;

export interface AiBomExportInput {
  organizationId: string;
  projectId: string;
  snapshot: ReturnType<typeof generateAiBillOfMaterialsSnapshot>;
  generatedAt?: string;
}

export function buildAiBomExportPackage(input: AiBomExportInput) {
  const payload = {
    organizationId: input.organizationId,
    projectId: input.projectId,
    generatedAt: input.generatedAt ?? input.snapshot.generatedAt,
    snapshot: input.snapshot,
    notice: "Preview export package. Raw system prompts are excluded; only hashes and redacted previews are included.",
  };
  const serialized = JSON.stringify(payload);
  const digest = createHash("sha256").update(serialized).digest("hex");
  return {
    payload,
    serialized,
    digest,
    digestAlgorithm: "sha256",
    format: "application/json",
  };
}

export interface AiBomInput {
  organizationId: string;
  projectId: string;
  provider?: { name: string; status?: string; riskLevel?: SupplyChainRiskLevel };
  model?: { name: string; version?: string | null; riskLevel?: SupplyChainRiskLevel };
  systemPrompt?: string | null;
  promptVersion?: string | number | null;
  guardPolicyVersion?: string | number | null;
  tools?: Array<{ name: string; category: string; enabled: boolean; approved?: boolean }>;
  vectorProvider?: string | null;
  ocrProvider?: string | null;
  secretStoreProvider?: string | null;
  integrations?: string[];
  retentionPolicy?: string | null;
  siemExportEnabled?: boolean;
}

export function promptHash(prompt: string) {
  return createHash("sha256").update(prompt).digest("hex");
}

export function redactPromptVersion(prompt: string) {
  const hash = promptHash(prompt);
  return {
    promptHash: hash,
    promptRedacted: `[PROMPT_VERSION_REDACTED:${hash.slice(0, 16)}]`,
  };
}

export function classifyProviderRisk(input: { status?: string; dataRegion?: string | null; storesPrompts?: boolean; approved?: boolean }): SupplyChainRiskLevel {
  if (input.status === "BLOCKED") return "CRITICAL";
  if (input.storesPrompts && !input.approved) return "HIGH";
  if (!input.dataRegion) return "MEDIUM";
  return input.approved ? "LOW" : "MEDIUM";
}

export function generateAiBillOfMaterialsSnapshot(input: AiBomInput) {
  const prompt = input.systemPrompt ? redactPromptVersion(input.systemPrompt) : null;
  const tools = input.tools?.map((tool) => ({
    name: sanitizeLogText(tool.name),
    category: tool.category,
    enabled: tool.enabled,
    approved: Boolean(tool.approved),
  })) ?? [];
  const unapprovedTools = tools.filter((tool) => tool.enabled && !tool.approved);
  const highRiskTools = tools.filter((tool) => ["PAYMENT", "DATABASE", "FILE_SYSTEM", "CODE_EXECUTION", "ADMIN_ACTION"].includes(tool.category));
  const findings = [
    ...(input.provider?.status === "BLOCKED" ? [{ severity: "CRITICAL", title: "Blocked AI provider selected" }] : []),
    ...(input.model?.riskLevel === "HIGH" || input.model?.riskLevel === "CRITICAL" ? [{ severity: input.model.riskLevel, title: "High-risk model selected" }] : []),
    ...(unapprovedTools.length ? [{ severity: "HIGH", title: "Enabled tool is not approved" }] : []),
    ...(highRiskTools.length ? [{ severity: "MEDIUM", title: "High-impact tool categories enabled" }] : []),
    ...(!input.secretStoreProvider || input.secretStoreProvider === "local" ? [{ severity: "HIGH", title: "Production-grade secret store not confirmed" }] : []),
  ];

  return {
    projectId: input.projectId,
    modelProvider: input.provider ? { name: sanitizeLogText(input.provider.name), status: input.provider.status ?? "REVIEW", riskLevel: input.provider.riskLevel ?? "MEDIUM" } : null,
    model: input.model ? { name: sanitizeLogText(input.model.name), version: input.model.version ?? null, riskLevel: input.model.riskLevel ?? "MEDIUM" } : null,
    systemPromptVersion: input.promptVersion ?? null,
    systemPromptHash: prompt?.promptHash ?? null,
    systemPromptPreview: prompt?.promptRedacted ?? null,
    guardPolicyVersion: input.guardPolicyVersion ?? null,
    toolsEnabled: tools,
    vectorProvider: input.vectorProvider ?? null,
    ocrProvider: input.ocrProvider ?? null,
    secretStoreProvider: input.secretStoreProvider ?? null,
    integrationsEnabled: input.integrations?.map(sanitizeLogText) ?? [],
    retentionPolicy: input.retentionPolicy ?? null,
    siemExportStatus: input.siemExportEnabled ? "ENABLED" : "NOT_ENABLED",
    riskSummary: {
      totalFindings: findings.length,
      highestSeverity: highestSeverity(findings.map((finding) => finding.severity as SupplyChainRiskLevel)),
      findings,
    },
    generatedAt: new Date().toISOString(),
  };
}

export async function storeAiBillOfMaterials(input: AiBomInput & { createdById?: string | null }) {
  await requireTenantProjectOwnership({ organizationId: input.organizationId, projectId: input.projectId });
  const snapshot = generateAiBillOfMaterialsSnapshot(input);
  const rows = await db.$queryRaw<Array<{ id: string }>>`
    INSERT INTO "AiBillOfMaterials" ("id", "organizationId", "projectId", "version", "snapshot", "riskSummary", "createdById", "createdAt")
    VALUES (${`bom_${randomUUID()}`}, ${input.organizationId}, ${input.projectId}, 1, ${JSON.stringify(snapshot)}::jsonb, ${JSON.stringify(snapshot.riskSummary)}::jsonb, ${input.createdById ?? null}, NOW())
    RETURNING "id"
  `;
  return { id: rows[0]?.id, snapshot };
}

export async function createPromptVersion(input: { organizationId: string; projectId?: string | null; name: string; prompt: string; status?: string; approvedById?: string | null }) {
  await requireTenantProjectOwnership({ organizationId: input.organizationId, projectId: input.projectId });
  const redacted = redactPromptVersion(input.prompt);
  const rows = await db.$queryRaw<Array<{ id: string }>>`
    INSERT INTO "PromptVersion" ("id", "organizationId", "projectId", "name", "version", "promptHash", "promptRedacted", "status", "approvedById", "approvedAt", "metadata", "createdAt", "updatedAt")
    VALUES (${`prompt_${randomUUID()}`}, ${input.organizationId}, ${input.projectId ?? null}, ${input.name}, 1, ${redacted.promptHash}, ${redacted.promptRedacted}, ${input.status ?? "DRAFT"}, ${input.approvedById ?? null}, ${input.status === "APPROVED" ? new Date() : null}, ${Prisma.JsonNull}::jsonb, NOW(), NOW())
    RETURNING "id"
  `;
  return { id: rows[0]?.id, ...redacted };
}

function highestSeverity(values: SupplyChainRiskLevel[]) {
  const order: SupplyChainRiskLevel[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
  return values.sort((a, b) => order.indexOf(b) - order.indexOf(a))[0] ?? "LOW";
}
