import { z } from "zod";
import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { authenticateApiKeyRequest } from "@/lib/apiKeyMiddleware";
import { DEFAULT_RPM } from "@/lib/guard/constants";
import { sanitizeLogText, sanitizeMetadata } from "@/lib/guard/logSafety";
import { checkRedisRateLimit } from "@/lib/rateLimit";
import { db } from "@/lib/db";
import {
  AGENT_TYPES,
  DEFAULT_ALLOWED_AGENT_TOOLS,
  applyAgentManifestToPolicy,
  checkAgentAction,
  checkAgentOutput,
  checkDataLeak,
  checkToolUse,
  defaultAgentFirewallPolicy,
  hashApprovalToken,
  isApprovalTokenValid,
  startAgentSession,
  type AgentActionCheckInput,
  type AgentActionDecisionResult,
  type AgentApprovalStatus,
  type AgentPermissionManifest,
} from "@/lib/agent-firewall";

export const agentMetadataSchema = z.record(z.unknown()).optional();

export const startSessionSchema = z.object({
  agentName: z.string().trim().min(1).max(120),
  agentType: z.enum(AGENT_TYPES),
  userId: z.string().trim().max(200).optional(),
  projectId: z.string().trim().max(200).optional(),
  metadata: agentMetadataSchema,
});

export const agentActionSchema = z.object({
  sessionId: z.string().trim().min(1).max(200).optional(),
  agentName: z.string().trim().max(120).optional(),
  tool: z.string().trim().min(1).max(160),
  action: z.string().trim().min(1).max(200),
  target: z.string().trim().max(2000).optional(),
  content: z.string().max(20_000).optional(),
  destination: z.enum(["external", "internal", "local", "unknown"]).optional(),
  riskContext: z.object({
    userApproved: z.boolean().optional(),
    externalDestination: z.boolean().optional(),
    canModifyData: z.boolean().optional(),
    canDeleteData: z.boolean().optional(),
    canSendMessage: z.boolean().optional(),
    canRunCode: z.boolean().optional(),
    canAccessFiles: z.boolean().optional(),
    canReadSecrets: z.boolean().optional(),
    canMakePayment: z.boolean().optional(),
    canDisableSecurity: z.boolean().optional(),
  }).optional(),
  metadata: agentMetadataSchema,
});

export const dataCheckSchema = z.object({
  sessionId: z.string().trim().max(200).optional(),
  content: z.string().min(1).max(20_000),
  source: z.enum(["rag_context", "browser", "file", "email", "clipboard", "terminal", "memory", "custom"]).optional(),
  destination: z.enum(["external", "internal", "local", "unknown"]).optional(),
  target: z.string().trim().max(2000).optional(),
  metadata: agentMetadataSchema,
});

export const outputCheckSchema = z.object({
  sessionId: z.string().trim().max(200).optional(),
  content: z.string().min(1).max(20_000),
  destination: z.enum(["external", "internal", "local", "unknown"]).optional(),
  metadata: agentMetadataSchema,
});

export const approvalRequestSchema = agentActionSchema.extend({
  reason: z.string().trim().max(500).optional(),
});

export const approvalResolveSchema = z.object({
  approvalToken: z.string().trim().min(10).max(200).optional(),
  approvalId: z.string().trim().min(1).max(200).optional(),
  projectId: z.string().trim().min(1).max(200).optional(),
  decision: z.enum(["APPROVED", "DENIED"]),
  editedContent: z.string().max(20_000).optional(),
  resolvedBy: z.string().trim().max(200).optional(),
  metadata: agentMetadataSchema,
}).refine((value) => Boolean(value.approvalToken || (value.approvalId && value.projectId)), {
  message: "approvalToken or approvalId plus projectId is required.",
});

export const agentManifestSchema = z.object({
  agentName: z.string().trim().min(1).max(120),
  enabled: z.boolean().default(true),
  manifest: z.object({
    agent: z.string().trim().min(1).max(120).optional(),
    allowedTools: z.array(z.string().trim().min(1).max(160)).max(100).default([]),
    approvalRequired: z.array(z.string().trim().min(1).max(160)).max(100).default([]),
    blocked: z.array(z.string().trim().min(1).max(160)).max(100).default([]),
    allowedDomains: z.array(z.string().trim().min(1).max(200)).max(100).default([]),
    blockedDomains: z.array(z.string().trim().min(1).max(200)).max(100).default([]),
    allowedWorkspaceDirs: z.array(z.string().trim().min(1).max(1000)).max(20).default([]),
    blockedFilePatterns: z.array(z.string().trim().min(1).max(200)).max(100).default([]),
    dataPolicy: z.object({
      externalSecrets: z.enum(["BLOCK", "ASK_APPROVAL", "REDACT"]).default("BLOCK"),
      externalPII: z.enum(["BLOCK", "ASK_APPROVAL", "REDACT"]).default("ASK_APPROVAL"),
      failClosed: z.boolean().default(true),
    }).default({ externalSecrets: "BLOCK", externalPII: "ASK_APPROVAL", failClosed: true }),
  }),
});

export const auditLogSchema = agentActionSchema.extend({
  decision: z.enum(["ALLOW", "BLOCK", "REDACT", "ASK_APPROVAL", "SANDBOX_ONLY", "READ_ONLY"]),
  riskLevel: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  reason: z.string().trim().min(1).max(1000),
  safeContent: z.string().max(20_000).optional(),
  policyMatches: z.array(z.unknown()).optional(),
  redactions: z.array(z.unknown()).optional(),
  approvalId: z.string().trim().max(200).optional(),
});

type AgentAuth = Extract<Awaited<ReturnType<typeof authenticateApiKeyRequest>>, { ok: true }>["auth"];
type AgentManifestInput = {
  agentName: string;
  enabled?: boolean;
  manifest: Omit<Partial<AgentPermissionManifest>, "dataPolicy"> & {
    dataPolicy?: Partial<AgentPermissionManifest["dataPolicy"]>;
  };
};

export async function authenticateAgentFirewall(request: Request) {
  const authenticated = await authenticateApiKeyRequest(request);
  if (!authenticated.ok) return authenticated;
  const { apiKey } = authenticated.auth;
  const rateLimit = await checkRedisRateLimit(`agent-firewall:key:${apiKey.id}`, DEFAULT_RPM);
  if (!rateLimit.allowed) {
    return {
      ok: false as const,
      response: jsonResponse({
        error: true,
        decision: "BLOCK",
        riskLevel: "HIGH",
        reason: "Agent Firewall rate limit exceeded. Do not execute the planned action; retry after the rate-limit window resets.",
      }, {
        status: 429,
        headers: {
          "Retry-After": String(Math.max(1, Math.ceil((rateLimit.resetAt - Date.now()) / 1000))),
          "X-RateLimit-Limit": String(DEFAULT_RPM),
          "X-RateLimit-Remaining": String(rateLimit.remaining),
        },
      }),
    };
  }
  return authenticated;
}

export async function readAgentJson<T>(request: Request, schema: z.ZodType<T>) {
  return schema.parse(await readJson(request));
}

export async function startAndPersistAgentSession(auth: AgentAuth, input: z.infer<typeof startSessionSchema>) {
  if (input.projectId && input.projectId !== auth.project.id) {
    return jsonResponse({ error: true, message: "projectId must match the x-api-key project." }, { status: 403 });
  }
  const policy = await loadAgentPolicyForProject(auth.project.id, input.agentName);
  const session = {
    ...startAgentSession(input),
    policy,
    allowedTools: [...DEFAULT_ALLOWED_AGENT_TOOLS],
    blockedTools: policy.toolsAlwaysBlocked,
    approvalRequiredTools: policy.toolsRequiringApproval,
  };
  await db.$executeRaw`
    INSERT INTO "AgentSession" ("id", "projectId", "userId", "apiKeyId", "agentName", "agentType", "status", "metadataJson", "createdAt", "updatedAt")
    VALUES (${session.sessionId}, ${auth.project.id}, ${input.userId ?? null}, ${auth.apiKey.id}, ${input.agentName}, ${input.agentType}, 'ACTIVE', ${JSON.stringify(sanitizeMetadata(input.metadata))}::jsonb, NOW(), NOW())
  `;
  return jsonResponse({ ...session, projectId: auth.project.id });
}

export async function decideAndPersistAgentAction(auth: AgentAuth, input: AgentActionCheckInput) {
  const policy = await loadAgentPolicyForProject(auth.project.id, input.agentName);
  const result = checkAgentAction(input, { policy });
  const auditId = await persistAgentActionLog(auth, input, result);
  const withAudit = { ...result, auditId };
  if (withAudit.decision === "ASK_APPROVAL" && withAudit.requiredApproval?.approvalToken) {
    const approvalId = await persistAgentApproval(auth, input, auditId, withAudit.requiredApproval.approvalToken, withAudit.reason);
    await db.$executeRaw`UPDATE "AgentActionLog" SET "approvalId" = ${approvalId} WHERE "id" = ${auditId}`;
    withAudit.requiredApproval = { ...withAudit.requiredApproval, approvalId };
  }
  return jsonResponse(withAudit);
}

export async function persistToolCheck(auth: AgentAuth, input: AgentActionCheckInput) {
  const policy = await loadAgentPolicyForProject(auth.project.id, input.agentName);
  const result = checkToolUse(input, { policy });
  const auditId = await persistAgentActionLog(auth, input, result);
  return jsonResponse({ ...result, auditId });
}

export async function persistDataCheck(auth: AgentAuth, input: z.infer<typeof dataCheckSchema>) {
  const result = checkDataLeak(input);
  const auditId = await persistAgentActionLog(auth, {
    sessionId: input.sessionId,
    tool: "data.egress",
    action: "check_data_egress",
    target: input.target,
    content: input.content,
    destination: input.destination,
    metadata: { ...(input.metadata ?? {}), source: input.source ?? "custom" },
  }, result);
  return jsonResponse({ ...result, auditId });
}

export async function persistOutputCheck(auth: AgentAuth, input: z.infer<typeof outputCheckSchema>) {
  const result = checkAgentOutput(input);
  const auditId = await persistAgentActionLog(auth, {
    sessionId: input.sessionId,
    tool: "agent.output",
    action: "check_output",
    content: input.content,
    destination: input.destination,
    metadata: input.metadata,
  }, result);
  return jsonResponse({ ...result, auditId });
}

export async function persistExplicitAudit(auth: AgentAuth, input: z.infer<typeof auditLogSchema>) {
  const auditId = await persistAgentActionLog(auth, input, {
    decision: input.decision,
    riskLevel: input.riskLevel,
    reason: input.reason,
    safeContent: input.safeContent,
    redactions: (input.redactions ?? []) as AgentActionDecisionResult["redactions"],
    policyMatches: (input.policyMatches ?? []) as AgentActionDecisionResult["policyMatches"],
  });
  return jsonResponse({ auditId });
}

export async function createApprovalForAction(auth: AgentAuth, input: z.infer<typeof approvalRequestSchema>) {
  const policy = await loadAgentPolicyForProject(auth.project.id, input.agentName);
  const result = checkAgentAction(input, { policy });
  const auditId = await persistAgentActionLog(auth, input, { ...result, decision: "ASK_APPROVAL", riskLevel: result.riskLevel === "LOW" ? "MEDIUM" : result.riskLevel });
  const approvalToken = result.requiredApproval?.approvalToken ?? `af_${cryptoRandomFallback()}`;
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
  const approvalId = await persistAgentApproval(auth, input, auditId, approvalToken, input.reason ?? result.reason, expiresAt);
  await db.$executeRaw`UPDATE "AgentActionLog" SET "approvalId" = ${approvalId} WHERE "id" = ${auditId}`;
  return jsonResponse({
    approvalId,
    approvalToken,
    auditId,
    status: "PENDING",
    message: input.reason ?? result.requiredApproval?.message ?? "Human approval is required before executing this action.",
    diff: {
      originalRedacted: input.content ? sanitizeLogText(input.content) : "",
      safeContent: result.safeContent ? sanitizeLogText(result.safeContent) : input.content ? sanitizeLogText(input.content) : "",
    },
    expiresAt: expiresAt.toISOString(),
    requiredApproval: {
      message: input.reason ?? result.requiredApproval?.message ?? "Human approval is required before executing this action.",
      approvalToken,
    },
  });
}

export async function resolveAgentApproval(auth: AgentAuth, input: z.infer<typeof approvalResolveSchema>) {
  if (!input.approvalToken) {
    return jsonResponse({ error: true, decision: "BLOCK", message: "approvalToken is required for API key approval resolution." }, { status: 400 });
  }
  const approvalTokenHash = hashApprovalToken(input.approvalToken);
  const rows = await db.$queryRaw<Array<{ id: string; status: AgentApprovalStatus; expiresAt: Date; approvalTokenHash: string; actionLogId: string | null }>>`
    SELECT "id", "status", "expiresAt", "approvalTokenHash", "actionLogId"
    FROM "AgentApproval"
    WHERE "approvalTokenHash" = ${approvalTokenHash} AND "projectId" = ${auth.project.id}
    LIMIT 1
  `;
  const approval = rows[0];
  if (!approval || !isApprovalTokenValid(input.approvalToken, approval.approvalTokenHash)) {
    return jsonResponse({ error: true, decision: "BLOCK", message: "Invalid approval token." }, { status: 404 });
  }
  if (approval.status !== "PENDING") {
    return jsonResponse({ error: true, decision: "BLOCK", message: `Approval is already ${approval.status.toLowerCase()}.` }, { status: 409 });
  }
  if (approval.expiresAt.getTime() < Date.now()) {
    await db.$executeRaw`UPDATE "AgentApproval" SET "status" = 'EXPIRED', "resolvedAt" = NOW() WHERE "id" = ${approval.id}`;
    return jsonResponse({ error: true, decision: "BLOCK", message: "Approval token expired." }, { status: 410 });
  }
  await db.$executeRaw`
    UPDATE "AgentApproval"
    SET "status" = ${input.decision}, "safeContent" = ${input.editedContent ? sanitizeLogText(input.editedContent) : null}, "resolvedAt" = NOW()
    WHERE "id" = ${approval.id}
  `;
  if (approval.actionLogId && input.decision === "APPROVED" && input.editedContent) {
    await db.$executeRaw`UPDATE "AgentActionLog" SET "safeContent" = ${sanitizeLogText(input.editedContent)} WHERE "id" = ${approval.actionLogId} AND "projectId" = ${auth.project.id}`;
  }
  return jsonResponse({
    approvalId: approval.id,
    status: input.decision,
    decision: input.decision === "APPROVED" ? "ALLOW" : "BLOCK",
    safeContent: input.editedContent ? sanitizeLogText(input.editedContent) : undefined,
    message: input.decision === "APPROVED" ? "Approval granted. Execute only the previously reviewed action." : "Approval denied. Do not execute the action.",
  });
}

export async function listPendingAgentApprovals(auth: AgentAuth) {
  const rows = await db.$queryRaw<Array<{
    id: string;
    sessionId: string | null;
    actionLogId: string | null;
    status: AgentApprovalStatus;
    requestedAction: unknown;
    requestedContentRedacted: string | null;
    safeContent: string | null;
    reason: string;
    expiresAt: Date;
    createdAt: Date;
  }>>`
    SELECT "id", "sessionId", "actionLogId", "status", "requestedAction", "requestedContentRedacted", "safeContent", "reason", "expiresAt", "createdAt"
    FROM "AgentApproval"
    WHERE "projectId" = ${auth.project.id} AND "status" = 'PENDING'
    ORDER BY "createdAt" DESC
    LIMIT 100
  `;
  return jsonResponse({
    approvals: rows.map((row) => ({
      approvalId: row.id,
      sessionId: row.sessionId,
      actionLogId: row.actionLogId,
      status: row.status,
      requestedAction: row.requestedAction,
      reason: row.reason,
      diff: {
        originalRedacted: row.requestedContentRedacted ?? "",
        safeContent: row.safeContent ?? row.requestedContentRedacted ?? "",
      },
      expiresAt: row.expiresAt,
      createdAt: row.createdAt,
    })),
  });
}

export async function loadAgentPolicyForProject(projectId: string, agentName?: string) {
  const rows = await db.$queryRaw<Array<{ rulesJson: unknown }>>`
    SELECT "rulesJson"
    FROM "AgentPolicy"
    WHERE "projectId" = ${projectId} AND "enabled" = true
    ORDER BY "updatedAt" DESC
    LIMIT 1
  `;
  const basePolicy = rows[0]?.rulesJson && typeof rows[0].rulesJson === "object"
    ? defaultAgentFirewallPolicy(rows[0].rulesJson as Partial<ReturnType<typeof defaultAgentFirewallPolicy>>)
    : defaultAgentFirewallPolicy();
  const manifest = agentName ? await loadAgentManifestForProject(projectId, agentName) : null;
  return applyAgentManifestToPolicy(basePolicy, manifest);
}

export async function loadAgentManifestForProject(projectId: string, agentName: string) {
  const rows = await db.$queryRaw<Array<{ manifestJson: unknown }>>`
    SELECT "manifestJson"
    FROM "AgentManifest"
    WHERE "projectId" = ${projectId} AND lower("agentName") = lower(${agentName}) AND "enabled" = true
    LIMIT 1
  `;
  return rows[0]?.manifestJson && typeof rows[0].manifestJson === "object"
    ? rows[0].manifestJson as Partial<AgentPermissionManifest>
    : null;
}

export async function listAgentManifests(auth: AgentAuth) {
  const rows = await db.$queryRaw<Array<{ id: string; agentName: string; enabled: boolean; manifestJson: unknown; createdAt: Date; updatedAt: Date }>>`
    SELECT "id", "agentName", "enabled", "manifestJson", "createdAt", "updatedAt"
    FROM "AgentManifest"
    WHERE "projectId" = ${auth.project.id}
    ORDER BY "updatedAt" DESC
  `;
  return jsonResponse({ manifests: rows });
}

export async function createAgentManifest(auth: AgentAuth, input: AgentManifestInput) {
  const id = cryptoRandomFallback();
  const manifest = normalizeManifestInput(input);
  const enabled = input.enabled ?? true;
  await db.$executeRaw`
    INSERT INTO "AgentManifest" ("id", "projectId", "agentName", "manifestJson", "enabled", "createdAt", "updatedAt")
    VALUES (${id}, ${auth.project.id}, ${input.agentName}, ${JSON.stringify(manifest)}::jsonb, ${enabled}, NOW(), NOW())
    ON CONFLICT ("projectId", "agentName") DO UPDATE
    SET "manifestJson" = EXCLUDED."manifestJson", "enabled" = EXCLUDED."enabled", "updatedAt" = NOW()
  `;
  const rows = await db.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "AgentManifest" WHERE "projectId" = ${auth.project.id} AND "agentName" = ${input.agentName} LIMIT 1
  `;
  return jsonResponse({ id: rows[0]?.id ?? id, agentName: input.agentName, enabled, manifest }, { status: 201 });
}

export async function updateAgentManifest(auth: AgentAuth, id: string, input: AgentManifestInput) {
  const manifest = normalizeManifestInput(input);
  const enabled = input.enabled ?? true;
  const updated = await db.$executeRaw`
    UPDATE "AgentManifest"
    SET "agentName" = ${input.agentName}, "manifestJson" = ${JSON.stringify(manifest)}::jsonb, "enabled" = ${enabled}, "updatedAt" = NOW()
    WHERE "id" = ${id} AND "projectId" = ${auth.project.id}
  `;
  if (Number(updated) === 0) return jsonResponse({ error: true, message: "Manifest not found." }, { status: 404 });
  return jsonResponse({ id, agentName: input.agentName, enabled, manifest });
}

export async function deleteAgentManifest(auth: AgentAuth, id: string) {
  const deleted = await db.$executeRaw`DELETE FROM "AgentManifest" WHERE "id" = ${id} AND "projectId" = ${auth.project.id}`;
  if (Number(deleted) === 0) return jsonResponse({ error: true, message: "Manifest not found." }, { status: 404 });
  return jsonResponse({ ok: true });
}

async function persistAgentActionLog(auth: AgentAuth, input: AgentActionCheckInput, result: AgentActionDecisionResult) {
  const auditId = `agent_log_${cryptoRandomFallback()}`;
  const sessionUserId = await resolveAgentSessionUserId(auth.project.id, input.sessionId);
  await db.$executeRaw`
    INSERT INTO "AgentActionLog" ("id", "sessionId", "projectId", "userId", "tool", "action", "target", "destination", "decision", "riskLevel", "reason", "originalContentRedacted", "safeContent", "policyMatchesJson", "redactionsJson", "metadataJson", "createdAt")
    VALUES (
      ${auditId},
      ${input.sessionId ?? null},
      ${auth.project.id},
      ${sessionUserId},
      ${input.tool},
      ${input.action},
      ${input.target ? sanitizeLogText(input.target) : null},
      ${input.destination ?? "unknown"},
      ${result.decision},
      ${result.riskLevel},
      ${result.reason},
      ${input.content ? sanitizeLogText(input.content) : null},
      ${result.safeContent ? sanitizeLogText(result.safeContent) : null},
      ${JSON.stringify(result.policyMatches ?? [])}::jsonb,
      ${JSON.stringify(result.redactions ?? [])}::jsonb,
      ${JSON.stringify(sanitizeMetadata(input.metadata))}::jsonb,
      NOW()
    )
  `;
  return auditId;
}

async function resolveAgentSessionUserId(projectId: string, sessionId?: string) {
  if (!sessionId) return null;
  const rows = await db.$queryRaw<Array<{ userId: string | null }>>`
    SELECT "userId"
    FROM "AgentSession"
    WHERE "id" = ${sessionId} AND "projectId" = ${projectId}
    LIMIT 1
  `;
  return rows[0]?.userId ?? null;
}

async function persistAgentApproval(auth: AgentAuth, input: AgentActionCheckInput, actionLogId: string, approvalToken: string, reason: string, expiresAt = new Date(Date.now() + 15 * 60 * 1000)) {
  const approvalId = `agent_approval_${cryptoRandomFallback()}`;
  await db.$executeRaw`
    INSERT INTO "AgentApproval" ("id", "sessionId", "projectId", "actionLogId", "status", "approvalTokenHash", "requestedAction", "requestedContentRedacted", "safeContent", "reason", "expiresAt", "createdAt")
    VALUES (
      ${approvalId},
      ${input.sessionId ?? null},
      ${auth.project.id},
      ${actionLogId},
      'PENDING',
      ${hashApprovalToken(approvalToken)},
      ${JSON.stringify({
        tool: input.tool,
        action: input.action,
        target: input.target ? sanitizeLogText(input.target) : null,
        destination: input.destination ?? "unknown",
        riskContext: input.riskContext ?? {},
      })}::jsonb,
      ${input.content ? sanitizeLogText(input.content) : null},
      ${input.content ? sanitizeLogText(input.content) : null},
      ${reason},
      ${expiresAt},
      NOW()
    )
  `;
  return approvalId;
}

function normalizeManifestInput(input: AgentManifestInput) {
  return {
    agent: input.manifest.agent ?? input.agentName,
    allowedTools: input.manifest.allowedTools ?? [],
    approvalRequired: input.manifest.approvalRequired ?? [],
    blocked: input.manifest.blocked ?? [],
    allowedDomains: input.manifest.allowedDomains ?? [],
    blockedDomains: input.manifest.blockedDomains ?? [],
    allowedWorkspaceDirs: input.manifest.allowedWorkspaceDirs ?? [],
    blockedFilePatterns: input.manifest.blockedFilePatterns ?? [],
    dataPolicy: {
      externalSecrets: input.manifest.dataPolicy?.externalSecrets ?? "BLOCK",
      externalPII: input.manifest.dataPolicy?.externalPII ?? "ASK_APPROVAL",
      failClosed: input.manifest.dataPolicy?.failClosed ?? true,
    },
  };
}

function cryptoRandomFallback() {
  return globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
}

export function routeError(error: unknown, fallback: string) {
  return apiError(error, fallback);
}
