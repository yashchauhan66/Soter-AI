import { db } from "@/lib/db";
import { buildTemplatePolicy } from "./compiler";
import type { AdminAiPolicy, PolicyAuditLog, PolicyVersion } from "./types";

type PolicyRow = {
  id: string;
  organizationId: string;
  name: string;
  description: string;
  enabled: boolean;
  mode: string;
  severity: string;
  action: string;
  scope: unknown;
  destinations: unknown;
  detectionConfig: unknown;
  logMode: string;
  version: number;
  createdBy: string | null;
  updatedBy: string | null;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export async function listPolicies(organizationId: string) {
  const rows = await db.$queryRaw<PolicyRow[]>`
    SELECT * FROM "AiAdminPolicy"
    WHERE "organizationId" = ${organizationId}
    ORDER BY "updatedAt" DESC
  `;
  return rows.map(rowToPolicy);
}

export async function getPolicy(organizationId: string, id: string) {
  const rows = await db.$queryRaw<PolicyRow[]>`
    SELECT * FROM "AiAdminPolicy"
    WHERE "organizationId" = ${organizationId} AND "id" = ${id}
    LIMIT 1
  `;
  return rows[0] ? rowToPolicy(rows[0]) : null;
}

export async function createPolicy(input: {
  organizationId: string;
  actorId?: string;
  templateKey?: string;
  policy?: Partial<AdminAiPolicy> & { name: string };
}) {
  const now = new Date().toISOString();
  const policy = input.templateKey
    ? buildTemplatePolicy(input.organizationId, input.templateKey, input.actorId)
    : {
        id: `policy_${crypto.randomUUID()}`,
        organizationId: input.organizationId,
        name: input.policy?.name ?? "Untitled policy",
        description: input.policy?.description ?? "",
        enabled: input.policy?.enabled ?? true,
        mode: input.policy?.mode ?? "custom",
        severity: input.policy?.severity ?? "high",
        action: input.policy?.action ?? "block",
        scope: input.policy?.scope ?? { type: "all", departments: ["all"], roles: ["all"], users: ["all"] },
        destinations: input.policy?.destinations ?? { preset: "all_ai_tools", domains: ["*"], riskLevel: "all" },
        detectionConfig: input.policy?.detectionConfig ?? { detectorKeys: [], keywords: [], regex: [], domains: [], fileNames: [], documentFingerprints: [], semanticCategories: [], scanResponses: false },
        logMode: input.policy?.logMode ?? "redacted_prompt",
        version: 0,
        createdBy: input.actorId ?? null,
        updatedBy: input.actorId ?? null,
        publishedAt: null,
        createdAt: now,
        updatedAt: now,
      } satisfies AdminAiPolicy;

  await db.$executeRaw`
    INSERT INTO "AiAdminPolicy" ("id", "organizationId", "name", "description", "enabled", "mode", "severity", "action", "scope", "destinations", "detectionConfig", "logMode", "version", "createdBy", "updatedBy", "publishedAt", "createdAt", "updatedAt")
    VALUES (${policy.id}, ${policy.organizationId}, ${policy.name}, ${policy.description}, ${policy.enabled}, ${policy.mode}, ${policy.severity}, ${policy.action}, ${JSON.stringify(policy.scope)}::jsonb, ${JSON.stringify(policy.destinations)}::jsonb, ${JSON.stringify(policy.detectionConfig)}::jsonb, ${policy.logMode}, ${policy.version}, ${policy.createdBy ?? null}, ${policy.updatedBy ?? null}, ${policy.publishedAt ? new Date(policy.publishedAt) : null}, NOW(), NOW())
  `;
  await recordPolicyAudit({ organizationId: input.organizationId, adminUserId: input.actorId, action: "CREATE", policyId: policy.id, after: policy });
  return policy;
}

export async function updatePolicy(organizationId: string, id: string, actorId: string | undefined, patch: Partial<AdminAiPolicy>) {
  const before = await getPolicy(organizationId, id);
  if (!before) return null;
  const next: AdminAiPolicy = {
    ...before,
    name: patch.name ?? before.name,
    description: patch.description ?? before.description,
    enabled: patch.enabled ?? before.enabled,
    mode: patch.mode ?? before.mode,
    severity: patch.severity ?? before.severity,
    action: patch.action ?? before.action,
    scope: patch.scope ?? before.scope,
    destinations: patch.destinations ?? before.destinations,
    detectionConfig: patch.detectionConfig ?? before.detectionConfig,
    logMode: patch.logMode ?? before.logMode,
    id: before.id,
    organizationId: before.organizationId,
    version: before.version,
    updatedBy: actorId ?? before.updatedBy,
    updatedAt: new Date().toISOString(),
  };
  await db.$executeRaw`
    UPDATE "AiAdminPolicy"
    SET "name" = ${next.name},
        "description" = ${next.description},
        "enabled" = ${next.enabled},
        "mode" = ${next.mode},
        "severity" = ${next.severity},
        "action" = ${next.action},
        "scope" = ${JSON.stringify(next.scope)}::jsonb,
        "destinations" = ${JSON.stringify(next.destinations)}::jsonb,
        "detectionConfig" = ${JSON.stringify(next.detectionConfig)}::jsonb,
        "logMode" = ${next.logMode},
        "updatedBy" = ${next.updatedBy ?? null},
        "updatedAt" = NOW()
    WHERE "organizationId" = ${organizationId} AND "id" = ${id}
  `;
  await recordPolicyAudit({ organizationId, adminUserId: actorId, action: "UPDATE", policyId: id, before, after: next });
  return next;
}

export async function deletePolicy(organizationId: string, id: string, actorId?: string) {
  const before = await getPolicy(organizationId, id);
  if (!before) return false;
  await db.$executeRaw`DELETE FROM "AiAdminPolicy" WHERE "organizationId" = ${organizationId} AND "id" = ${id}`;
  await recordPolicyAudit({ organizationId, adminUserId: actorId, action: "DELETE", policyId: id, before });
  return true;
}

export async function publishPolicy(organizationId: string, id: string, actorId?: string, rollbackFromVersion?: number) {
  const before = await getPolicy(organizationId, id);
  if (!before) return null;
  const version = before.version + 1;
  const publishedAt = new Date().toISOString();
  const snapshot: AdminAiPolicy = { ...before, version, publishedAt, updatedBy: actorId ?? before.updatedBy, updatedAt: publishedAt };
  const versionId = `polver_${crypto.randomUUID()}`;
  await db.$executeRaw`
    UPDATE "AiAdminPolicy"
    SET "version" = ${version}, "publishedAt" = ${new Date(publishedAt)}, "updatedBy" = ${actorId ?? null}, "updatedAt" = NOW()
    WHERE "organizationId" = ${organizationId} AND "id" = ${id}
  `;
  await db.$executeRaw`
    INSERT INTO "AiAdminPolicyVersion" ("id", "policyId", "organizationId", "version", "snapshot", "publishedBy", "publishedAt", "rollbackFromVersion")
    VALUES (${versionId}, ${id}, ${organizationId}, ${version}, ${JSON.stringify(snapshot)}::jsonb, ${actorId ?? null}, ${new Date(publishedAt)}, ${rollbackFromVersion ?? null})
  `;
  await recordPolicyAudit({ organizationId, adminUserId: actorId, action: rollbackFromVersion ? "ROLLBACK_PUBLISH" : "PUBLISH", policyId: id, before, after: snapshot });
  return snapshot;
}

export async function rollbackPolicy(organizationId: string, id: string, targetVersion: number, actorId?: string) {
  const before = await getPolicy(organizationId, id);
  if (!before) return null;
  const rows = await db.$queryRaw<Array<{ snapshot: unknown; version: number }>>`
    SELECT "snapshot", "version"
    FROM "AiAdminPolicyVersion"
    WHERE "organizationId" = ${organizationId} AND "policyId" = ${id} AND "version" = ${targetVersion}
    LIMIT 1
  `;
  const target = rows[0]?.snapshot ? normalizePolicy(rows[0].snapshot) : null;
  if (!target) return null;
  const restored = await updatePolicy(organizationId, id, actorId, {
    ...target,
    id,
    organizationId,
    version: before.version,
    publishedAt: before.publishedAt,
  });
  if (!restored) return null;
  return publishPolicy(organizationId, id, actorId, targetVersion);
}

export async function listPolicyVersions(organizationId: string, policyId?: string) {
  const rows = policyId
    ? await db.$queryRaw<Array<{ id: string; policyId: string; organizationId: string; version: number; snapshot: unknown; publishedBy: string | null; publishedAt: Date; rollbackFromVersion: number | null }>>`
        SELECT * FROM "AiAdminPolicyVersion"
        WHERE "organizationId" = ${organizationId} AND "policyId" = ${policyId}
        ORDER BY "version" DESC
      `
    : await db.$queryRaw<Array<{ id: string; policyId: string; organizationId: string; version: number; snapshot: unknown; publishedBy: string | null; publishedAt: Date; rollbackFromVersion: number | null }>>`
        SELECT * FROM "AiAdminPolicyVersion"
        WHERE "organizationId" = ${organizationId}
        ORDER BY "publishedAt" DESC
        LIMIT 100
      `;
  return rows.map((row): PolicyVersion => ({
    id: row.id,
    policyId: row.policyId,
    organizationId: row.organizationId,
    version: row.version,
    snapshot: normalizePolicy(row.snapshot),
    publishedBy: row.publishedBy,
    publishedAt: row.publishedAt.toISOString(),
    rollbackFromVersion: row.rollbackFromVersion,
  }));
}

export async function listPolicyAuditLogs(organizationId: string, limit = 50) {
  const rows = await db.$queryRaw<Array<{ id: string; organizationId: string; adminUserId: string | null; action: string; policyId: string | null; before: unknown; after: unknown; createdAt: Date }>>`
    SELECT * FROM "AiAdminPolicyAuditLog"
    WHERE "organizationId" = ${organizationId}
    ORDER BY "createdAt" DESC
    LIMIT ${limit}
  `;
  return rows.map((row): PolicyAuditLog => ({
    id: row.id,
    organizationId: row.organizationId,
    adminUserId: row.adminUserId,
    action: row.action,
    policyId: row.policyId,
    before: row.before,
    after: row.after,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function recordPolicyAudit(input: { organizationId: string; adminUserId?: string | null; action: string; policyId?: string | null; before?: unknown; after?: unknown }) {
  await db.$executeRaw`
    INSERT INTO "AiAdminPolicyAuditLog" ("id", "organizationId", "adminUserId", "action", "policyId", "before", "after", "createdAt")
    VALUES (${`polaudit_${crypto.randomUUID()}`}, ${input.organizationId}, ${input.adminUserId ?? null}, ${input.action}, ${input.policyId ?? null}, ${input.before === undefined ? null : JSON.stringify(input.before)}::jsonb, ${input.after === undefined ? null : JSON.stringify(input.after)}::jsonb, NOW())
  `;
}

function rowToPolicy(row: PolicyRow): AdminAiPolicy {
  return {
    id: row.id,
    organizationId: row.organizationId,
    name: row.name,
    description: row.description,
    enabled: row.enabled,
    mode: row.mode === "template" ? "template" : "custom",
    severity: normalizePolicy(row).severity,
    action: normalizePolicy(row).action,
    scope: normalizePolicy(row).scope,
    destinations: normalizePolicy(row).destinations,
    detectionConfig: normalizePolicy(row).detectionConfig,
    logMode: normalizePolicy(row).logMode,
    version: row.version,
    createdBy: row.createdBy,
    updatedBy: row.updatedBy,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function normalizePolicy(value: unknown): AdminAiPolicy {
  const policy = value as Partial<AdminAiPolicy> & Partial<PolicyRow>;
  return {
    id: String(policy.id ?? ""),
    organizationId: String(policy.organizationId ?? ""),
    name: String(policy.name ?? ""),
    description: String(policy.description ?? ""),
    enabled: policy.enabled ?? true,
    mode: policy.mode === "template" ? "template" : "custom",
    severity: policy.severity === "low" || policy.severity === "medium" || policy.severity === "high" || policy.severity === "critical" ? policy.severity : "high",
    action: isPolicyAction(policy.action) ? policy.action : "block",
    scope: typeof policy.scope === "object" && policy.scope ? policy.scope as AdminAiPolicy["scope"] : { type: "all", departments: ["all"], roles: ["all"], users: ["all"] },
    destinations: typeof policy.destinations === "object" && policy.destinations ? policy.destinations as AdminAiPolicy["destinations"] : { preset: "all_ai_tools", domains: ["*"], riskLevel: "all" },
    detectionConfig: typeof policy.detectionConfig === "object" && policy.detectionConfig ? policy.detectionConfig as AdminAiPolicy["detectionConfig"] : { detectorKeys: [], keywords: [], regex: [], domains: [], fileNames: [], documentFingerprints: [], semanticCategories: [], scanResponses: false },
    logMode: policy.logMode === "metadata_only" || policy.logMode === "full_prompt_only_if_enabled_by_admin" ? policy.logMode : "redacted_prompt",
    version: Number(policy.version ?? 1),
    createdBy: policy.createdBy ?? null,
    updatedBy: policy.updatedBy ?? null,
    publishedAt: policy.publishedAt ? toIsoString(policy.publishedAt) : null,
    createdAt: policy.createdAt ? toIsoString(policy.createdAt) : new Date().toISOString(),
    updatedAt: policy.updatedAt ? toIsoString(policy.updatedAt) : new Date().toISOString(),
  };
}

function isPolicyAction(value: unknown): value is AdminAiPolicy["action"] {
  return value === "allow" || value === "log_only" || value === "warn" || value === "redact" || value === "rewrite" || value === "block" || value === "require_justification" || value === "require_approval";
}

function toIsoString(value: unknown) {
  return value instanceof Date ? value.toISOString() : String(value);
}
