import { z } from "zod";
import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { authenticateApiKeyRequest } from "@/lib/apiKeyMiddleware";
import { db } from "@/lib/db";
import { DEFAULT_RPM } from "@/lib/guard/constants";
import { sanitizeLogText, sanitizeMetadata } from "@/lib/guard/logSafety";
import { checkRedisRateLimit } from "@/lib/rateLimit";
import { recordTrustEventSafe, trustTraceContextFromMetadata } from "@/lib/trust-events";
import {
  AGENT_IDENTITY_STATUSES,
  AGENT_IDENTITY_TYPES,
  createAgentIdentityId,
  createAgentPassportAuditId,
  createAgentPassportSessionId,
  createPassportId,
  createPassportToken,
  createAgentDelegationProof,
  deriveDelegatedPassportPolicy,
  hashPassportToken,
  mergePassportPolicy,
  normalizePassportPolicy,
  scorePassportRisk,
  toPublicPassport,
  validateAgentPassport,
  type AgentIdentitySnapshot,
  type AgentPassportValidationResult,
  type AgentPassportPolicyInput,
  type AgentSessionPassportSnapshot,
  type NormalizedAgentPassportPolicy,
} from "@/lib/agent-passport";

const passportPolicySchema = z.object({
  allowedTools: z.array(z.string().trim().min(1).max(160)).max(100).optional(),
  blockedTools: z.array(z.string().trim().min(1).max(160)).max(100).optional(),
  approvalRequiredTools: z.array(z.string().trim().min(1).max(160)).max(100).optional(),
  allowedDomains: z.array(z.string().trim().min(1).max(200)).max(100).optional(),
  blockedDomains: z.array(z.string().trim().min(1).max(200)).max(100).optional(),
  dataScopes: z.array(z.string().trim().min(1).max(120)).max(100).optional(),
  memoryScopes: z.array(z.string().trim().min(1).max(120)).max(100).optional(),
});

export const agentIdentityCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  agentType: z.enum(AGENT_IDENTITY_TYPES).default("CUSTOM"),
  description: z.string().trim().max(2000).optional(),
  status: z.enum(AGENT_IDENTITY_STATUSES).default("ACTIVE"),
  defaultPolicy: passportPolicySchema.optional(),
});

export const agentPassportIssueSchema = passportPolicySchema.extend({
  agentIdentityId: z.string().trim().min(1).max(200),
  sessionId: z.string().trim().min(1).max(200).optional(),
  ttlSeconds: z.number().int().min(60).max(60 * 60 * 24).default(60 * 60),
  expiresAt: z.string().datetime().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const agentPassportDelegateSchema = passportPolicySchema.extend({
  parentSessionId: z.string().trim().min(1).max(200),
  parentPassportToken: z.string().trim().min(10).max(300),
  childAgentIdentityId: z.string().trim().min(1).max(200),
  childSessionId: z.string().trim().min(1).max(200).optional(),
  intent: z.string().trim().min(1).max(2000),
  ttlSeconds: z.number().int().min(60).max(60 * 60).default(15 * 60),
  metadata: z.record(z.unknown()).optional(),
});

export const agentPassportValidateSchema = z.object({
  sessionId: z.string().trim().min(1).max(200),
  passportToken: z.string().trim().min(10).max(300).optional(),
  tool: z.string().trim().max(160).optional(),
  action: z.string().trim().max(200).optional(),
  target: z.string().trim().max(2000).optional(),
  domain: z.string().trim().max(200).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const agentPassportRevokeSchema = z.object({
  sessionId: z.string().trim().min(1).max(200).optional(),
  passportId: z.string().trim().min(1).max(200).optional(),
  reason: z.string().trim().max(500).optional(),
  metadata: z.record(z.unknown()).optional(),
}).refine((value) => Boolean(value.sessionId || value.passportId), {
  message: "sessionId or passportId is required.",
});

type AgentPassportAuth = Extract<Awaited<ReturnType<typeof authenticateApiKeyRequest>>, { ok: true }>["auth"];

type IdentityRow = {
  id: string;
  projectId: string;
  name: string;
  agentType: string;
  description: string | null;
  status: string;
  defaultPolicyJson: unknown;
  createdAt: Date;
  updatedAt: Date;
};

type PassportRow = {
  id: string;
  projectId: string;
  agentIdentityId: string;
  sessionId: string;
  passportHash: string;
  status: string;
  allowedToolsJson: unknown;
  blockedToolsJson: unknown;
  approvalRequiredToolsJson: unknown;
  allowedDomainsJson: unknown;
  blockedDomainsJson: unknown;
  dataScopesJson: unknown;
  memoryScopesJson: unknown;
  riskScore: number;
  riskLevel: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

type PassportWithIdentityRow = PassportRow & {
  agentName: string;
  agentType: string;
  agentStatus: string;
  defaultPolicyJson: unknown;
};

export type AgentPassportActionCheckResult = AgentPassportValidationResult & {
  passportId?: string;
  agentIdentityId?: string;
  sessionId?: string;
  expiresAt?: Date;
  trustTraceId?: string;
  trustSpanId?: string;
};

export async function authenticateAgentPassport(request: Request) {
  const authenticated = await authenticateApiKeyRequest(request);
  if (!authenticated.ok) return authenticated;
  const rateLimit = await checkRedisRateLimit(`agent-passport:key:${authenticated.auth.apiKey.id}`, DEFAULT_RPM);
  if (!rateLimit.allowed) {
    return {
      ok: false as const,
      response: jsonResponse({
        error: true,
        decision: "BLOCK",
        riskLevel: "HIGH",
        reason: "Agent Passport rate limit exceeded. Do not execute the planned action until the rate-limit window resets.",
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

export async function readPassportJson<S extends z.ZodTypeAny>(request: Request, schema: S): Promise<z.infer<S>> {
  return schema.parse(await readJson(request));
}

export async function createAgentIdentity(auth: AgentPassportAuth, input: z.infer<typeof agentIdentityCreateSchema>) {
  const existing = await db.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "AgentIdentity"
    WHERE "projectId" = ${auth.project.id} AND lower("name") = lower(${input.name})
    LIMIT 1
  `;
  if (existing[0]) {
    return jsonResponse({ error: true, message: "Agent identity already exists for this project." }, { status: 409 });
  }

  const id = createAgentIdentityId();
  const defaultPolicy = normalizePassportPolicy(input.defaultPolicy);
  await db.$executeRaw`
    INSERT INTO "AgentIdentity" ("id", "projectId", "name", "agentType", "description", "status", "defaultPolicyJson", "createdAt", "updatedAt")
    VALUES (
      ${id},
      ${auth.project.id},
      ${input.name},
      ${input.agentType}::"AgentIdentityType",
      ${input.description ? sanitizeLogText(input.description) : null},
      ${input.status}::"AgentIdentityStatus",
      ${JSON.stringify(defaultPolicy)}::jsonb,
      NOW(),
      NOW()
    )
  `;

  return jsonResponse({
    id,
    projectId: auth.project.id,
    name: input.name,
    agentType: input.agentType,
    description: input.description ? sanitizeLogText(input.description) : null,
    status: input.status,
    defaultPolicy,
  }, { status: 201 });
}

export async function listAgentIdentities(auth: AgentPassportAuth) {
  const identities = await db.$queryRaw<Array<IdentityRow & { activeSessions: number }>>`
    SELECT i."id", i."projectId", i."name", i."agentType", i."description", i."status", i."defaultPolicyJson", i."createdAt", i."updatedAt",
      COUNT(p."id") FILTER (WHERE p."status" = 'ACTIVE' AND p."expiresAt" > NOW())::int AS "activeSessions"
    FROM "AgentIdentity" i
    LEFT JOIN "AgentSessionPassport" p ON p."agentIdentityId" = i."id" AND p."projectId" = i."projectId"
    WHERE i."projectId" = ${auth.project.id}
    GROUP BY i."id"
    ORDER BY i."createdAt" DESC
  `;
  return jsonResponse({
    identities: identities.map((identity) => ({
      id: identity.id,
      projectId: identity.projectId,
      name: identity.name,
      agentType: identity.agentType,
      description: identity.description,
      status: identity.status,
      defaultPolicy: identity.defaultPolicyJson,
      activeSessions: identity.activeSessions,
      createdAt: identity.createdAt,
      updatedAt: identity.updatedAt,
    })),
  });
}

export async function issueAgentPassport(auth: AgentPassportAuth, input: z.infer<typeof agentPassportIssueSchema>) {
  const identities = await db.$queryRaw<IdentityRow[]>`
    SELECT "id", "projectId", "name", "agentType", "description", "status", "defaultPolicyJson", "createdAt", "updatedAt"
    FROM "AgentIdentity"
    WHERE "id" = ${input.agentIdentityId} AND "projectId" = ${auth.project.id}
    LIMIT 1
  `;
  const identity = identities[0];
  if (!identity) {
    return jsonResponse({ error: true, decision: "BLOCK", riskLevel: "CRITICAL", message: "Unknown agent identity." }, { status: 404 });
  }
  if (identity.status !== "ACTIVE") {
    return jsonResponse({ error: true, decision: "BLOCK", riskLevel: "CRITICAL", message: `Agent identity is ${identity.status.toLowerCase()}.` }, { status: 403 });
  }

  const sessionId = input.sessionId ?? createAgentPassportSessionId();
  const existing = await db.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "AgentSessionPassport"
    WHERE "projectId" = ${auth.project.id} AND "sessionId" = ${sessionId}
    LIMIT 1
  `;
  if (existing[0]) {
    return jsonResponse({ error: true, message: "A passport already exists for this sessionId in this project." }, { status: 409 });
  }

  const expiresAt = input.expiresAt ? new Date(input.expiresAt) : new Date(Date.now() + input.ttlSeconds * 1000);
  if (!Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
    return jsonResponse({ error: true, message: "expiresAt must be in the future." }, { status: 400 });
  }

  const policy = mergePassportPolicy(identity.defaultPolicyJson, extractPolicyInput(input));
  const risk = scorePassportRisk(policy);
  const passportToken = createPassportToken();
  const passportHash = hashPassportToken(passportToken);
  const passportId = createPassportId();

  await db.$executeRaw`
    INSERT INTO "AgentSessionPassport" (
      "id", "projectId", "agentIdentityId", "sessionId", "passportHash", "status",
      "allowedToolsJson", "blockedToolsJson", "approvalRequiredToolsJson",
      "allowedDomainsJson", "blockedDomainsJson", "dataScopesJson", "memoryScopesJson",
      "riskScore", "riskLevel", "expiresAt", "createdAt", "updatedAt"
    )
    VALUES (
      ${passportId},
      ${auth.project.id},
      ${identity.id},
      ${sessionId},
      ${passportHash},
      'ACTIVE'::"AgentSessionPassportStatus",
      ${JSON.stringify(policy.allowedTools)}::jsonb,
      ${JSON.stringify(policy.blockedTools)}::jsonb,
      ${JSON.stringify(policy.approvalRequiredTools)}::jsonb,
      ${JSON.stringify(policy.allowedDomains)}::jsonb,
      ${JSON.stringify(policy.blockedDomains)}::jsonb,
      ${JSON.stringify(policy.dataScopes)}::jsonb,
      ${JSON.stringify(policy.memoryScopes)}::jsonb,
      ${risk.riskScore},
      ${risk.riskLevel},
      ${expiresAt},
      NOW(),
      NOW()
    )
  `;

  await auditPassport({
    projectId: auth.project.id,
    agentIdentityId: identity.id,
    sessionPassportId: passportId,
    action: "ISSUE",
    decision: "ALLOW",
    reason: "Agent session passport issued.",
    metadata: {
      apiKeyId: auth.apiKey.id,
      sessionId,
      riskScore: risk.riskScore,
      riskLevel: risk.riskLevel,
      ...sanitizeMetadata(input.metadata),
    },
  });

  return jsonResponse({
    passportId,
    projectId: auth.project.id,
    agentIdentityId: identity.id,
    sessionId,
    passportToken,
    status: "ACTIVE",
    ...policy,
    riskScore: risk.riskScore,
    riskLevel: risk.riskLevel,
    expiresAt,
    tokenSafety: "Store this raw passportToken securely. cybersecurityguard stores only passportHash.",
  }, { status: 201 });
}

export async function delegateAgentPassport(auth: AgentPassportAuth, input: z.infer<typeof agentPassportDelegateSchema>) {
  const parent = await findPassportBySession(auth.project.id, input.parentSessionId);
  if (!parent) return jsonResponse({ error: true, decision: "BLOCK", message: "Parent passport was not found." }, { status: 404 });
  const parentValidation = validateAgentPassport({
    agent: identitySnapshot(parent),
    passport: passportSnapshot(parent),
    passportToken: input.parentPassportToken,
  });
  if (parentValidation.decision !== "ALLOW") {
    return jsonResponse({ error: true, ...parentValidation, message: "Parent passport is not valid for delegation." }, { status: 403 });
  }

  const children = await db.$queryRaw<IdentityRow[]>`
    SELECT "id", "projectId", "name", "agentType", "description", "status", "defaultPolicyJson", "createdAt", "updatedAt"
    FROM "AgentIdentity"
    WHERE "id" = ${input.childAgentIdentityId} AND "projectId" = ${auth.project.id}
    LIMIT 1
  `;
  const child = children[0];
  if (!child || child.status !== "ACTIVE") return jsonResponse({ error: true, decision: "BLOCK", message: "Child agent identity is missing or inactive." }, { status: 403 });

  const parentPolicy = jsonPolicy(parent);
  const childRequestedPolicy = mergePassportPolicy(child.defaultPolicyJson, extractPolicyInput(input));
  const delegated = deriveDelegatedPassportPolicy(parentPolicy, { ...childRequestedPolicy, intent: input.intent });
  if (!delegated.allowed) {
    return jsonResponse({ error: true, decision: "BLOCK", riskLevel: "CRITICAL", message: "Delegation would expand parent permissions.", violations: delegated.violations }, { status: 400 });
  }

  const parentIssueAudits = await db.$queryRaw<Array<{ metadataJson: unknown }>>`
    SELECT "metadataJson" FROM "AgentPassportAudit"
    WHERE "projectId" = ${auth.project.id} AND "sessionPassportId" = ${parent.id} AND "action" = 'ISSUE'
    ORDER BY "createdAt" DESC LIMIT 1
  `;
  const parentMetadata = asRecord(parentIssueAudits[0]?.metadataJson);
  const parentDepth = typeof parentMetadata.delegationDepth === "number" ? parentMetadata.delegationDepth : 0;
  const delegationDepth = parentDepth + 1;
  if (delegationDepth > 5) return jsonResponse({ error: true, decision: "BLOCK", message: "Maximum agent delegation depth exceeded." }, { status: 400 });

  const remainingSeconds = Math.floor((parent.expiresAt.getTime() - Date.now()) / 1000);
  const ttlSeconds = Math.min(input.ttlSeconds, remainingSeconds);
  if (ttlSeconds < 60) return jsonResponse({ error: true, decision: "BLOCK", message: "Parent passport expires too soon to delegate." }, { status: 400 });
  const childSessionId = input.childSessionId ?? createAgentPassportSessionId();
  const delegationProof = createAgentDelegationProof({
    parentPassportId: parent.id,
    childAgentIdentityId: child.id,
    childSessionId,
    delegationDepth,
    intentHash: delegated.intentHash,
    policy: delegated.policy,
  });

  return issueAgentPassport(auth, {
    agentIdentityId: child.id,
    sessionId: childSessionId,
    ttlSeconds,
    ...delegated.policy,
    metadata: {
      ...sanitizeMetadata(input.metadata),
      parentPassportId: parent.id,
      parentAgentIdentityId: parent.agentIdentityId,
      delegationDepth,
      intentHash: delegated.intentHash,
      delegationProof,
    },
  });
}

export async function validateAgentSessionPassport(auth: AgentPassportAuth, input: z.infer<typeof agentPassportValidateSchema>) {
  return jsonResponse(await checkAgentPassportForAction(auth, input));
}

export async function checkAgentPassportForAction(auth: AgentPassportAuth, input: {
  sessionId?: string;
  passportToken?: string;
  tool?: string;
  action?: string;
  target?: string;
  domain?: string;
  metadata?: Record<string, unknown>;
}): Promise<AgentPassportActionCheckResult> {
  if (!input.sessionId) {
    return {
      decision: "BLOCK" as const,
      riskLevel: "CRITICAL" as const,
      reason: "Agent sessionId is required. Anonymous agents fail closed before tool checks.",
      policyMatches: [{ id: "passport.session_missing", label: "No sessionId was supplied for passport validation.", severity: "CRITICAL" as const }],
    };
  }

  const row = await findPassportBySession(auth.project.id, input.sessionId);
  if (!row) {
    return {
      decision: "BLOCK",
      riskLevel: "CRITICAL",
      reason: "Unknown agent or session passport. Validation fails closed.",
      policyMatches: [{ id: "passport.unknown", label: "No passport exists for this project and session.", severity: "CRITICAL" }],
    } as const;
  }

  const identity = identitySnapshot(row);
  const passport = passportSnapshot(row);
  const result = validateAgentPassport({
    agent: identity,
    passport,
    passportToken: input.passportToken,
    tool: input.tool,
    action: input.action,
    target: input.target,
    domain: input.domain,
  });

  if (result.decision === "BLOCK" && result.policyMatches.some((match) => match.id === "passport.expired")) {
    await db.$executeRaw`
      UPDATE "AgentSessionPassport"
      SET "status" = 'EXPIRED'::"AgentSessionPassportStatus", "updatedAt" = NOW()
      WHERE "id" = ${row.id} AND "projectId" = ${auth.project.id} AND "status" = 'ACTIVE'
    `;
  }

  await auditPassport({
    projectId: auth.project.id,
    agentIdentityId: row.agentIdentityId,
    sessionPassportId: row.id,
    action: "VALIDATE",
    decision: result.decision,
    reason: result.reason,
    metadata: {
      apiKeyId: auth.apiKey.id,
      sessionId: row.sessionId,
      tool: input.tool,
      action: input.action,
      target: input.target ? sanitizeLogText(input.target) : undefined,
      domain: input.domain,
      ...sanitizeMetadata(input.metadata),
    },
  });

  let trustTraceId: string | undefined;
  let trustSpanId: string | undefined;
  if (auth.project.organizationId) {
    const trust = await recordTrustEventSafe({
      organizationId: auth.project.organizationId,
      projectId: auth.project.id,
      ...trustTraceContextFromMetadata(input.metadata),
      sessionId: row.sessionId,
      agentIdentityId: row.agentIdentityId,
      passportId: row.id,
      eventType: "AGENT_PASSPORT_AUTHORIZATION",
      source: "agent.passport",
      action: input.action ?? input.tool ?? "validate",
      severity: result.riskLevel,
      decision: result.decision,
      riskTypes: result.policyMatches.filter((match) => match.severity !== "LOW").map((match) => match.id.toUpperCase()),
      controlIds: ["AI-CTRL-03"],
      resource: input.tool ? { type: "AGENT_TOOL", id: input.tool } : undefined,
      metadata: { policyMatchIds: result.policyMatches.map((match) => match.id), domain: input.domain ?? null },
    });
    trustTraceId = trust.event.traceId;
    trustSpanId = trust.event.spanId;
  }

  return {
    ...result,
    passportId: row.id,
    agentIdentityId: row.agentIdentityId,
    sessionId: row.sessionId,
    expiresAt: row.expiresAt,
    trustTraceId,
    trustSpanId,
  };
}

export async function revokeAgentSessionPassport(auth: AgentPassportAuth, input: z.infer<typeof agentPassportRevokeSchema>) {
  const rows = await db.$queryRaw<PassportRow[]>`
    SELECT "id", "projectId", "agentIdentityId", "sessionId", "passportHash", "status",
      "allowedToolsJson", "blockedToolsJson", "approvalRequiredToolsJson",
      "allowedDomainsJson", "blockedDomainsJson", "dataScopesJson", "memoryScopesJson",
      "riskScore", "riskLevel", "expiresAt", "createdAt", "updatedAt"
    FROM "AgentSessionPassport"
    WHERE "projectId" = ${auth.project.id}
      AND (${input.passportId ?? null} IS NULL OR "id" = ${input.passportId ?? null})
      AND (${input.sessionId ?? null} IS NULL OR "sessionId" = ${input.sessionId ?? null})
    LIMIT 1
  `;
  const passport = rows[0];
  if (!passport) {
    return jsonResponse({ error: true, decision: "BLOCK", message: "Agent session passport not found." }, { status: 404 });
  }

  await db.$executeRaw`
    UPDATE "AgentSessionPassport"
    SET "status" = 'REVOKED'::"AgentSessionPassportStatus", "updatedAt" = NOW()
    WHERE "id" = ${passport.id} AND "projectId" = ${auth.project.id}
  `;

  const reason = input.reason ? sanitizeLogText(input.reason) : "Agent session passport revoked.";
  await auditPassport({
    projectId: auth.project.id,
    agentIdentityId: passport.agentIdentityId,
    sessionPassportId: passport.id,
    action: "REVOKE",
    decision: "BLOCK",
    reason,
    metadata: {
      apiKeyId: auth.apiKey.id,
      sessionId: passport.sessionId,
      ...sanitizeMetadata(input.metadata),
    },
  });

  return jsonResponse({
    passportId: passport.id,
    sessionId: passport.sessionId,
    status: "REVOKED",
    decision: "BLOCK",
    reason,
  });
}

export async function getAgentSessionPassport(auth: AgentPassportAuth, sessionId: string) {
  const row = await findPassportBySession(auth.project.id, sessionId);
  if (!row) return jsonResponse({ error: true, message: "Agent session passport not found." }, { status: 404 });

  const audits = await db.$queryRaw<Array<{ id: string; action: string; decision: string; reason: string; metadataJson: unknown; createdAt: Date }>>`
    SELECT "id", "action", "decision", "reason", "metadataJson", "createdAt"
    FROM "AgentPassportAudit"
    WHERE "projectId" = ${auth.project.id} AND "sessionPassportId" = ${row.id}
    ORDER BY "createdAt" DESC
    LIMIT 50
  `;

  const passport = toPublicPassport({
    id: row.id,
    projectId: row.projectId,
    agentIdentityId: row.agentIdentityId,
    agentName: row.agentName,
    agentType: row.agentType,
    agentStatus: row.agentStatus,
    sessionId: row.sessionId,
    passportHash: row.passportHash,
    status: row.status,
    ...jsonPolicy(row),
    riskScore: row.riskScore,
    riskLevel: row.riskLevel,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });

  return jsonResponse({ passport, audits });
}

export function routeError(error: unknown, fallback: string) {
  return apiError(error, fallback);
}

function extractPolicyInput(input: Partial<z.infer<typeof agentPassportIssueSchema>>): AgentPassportPolicyInput {
  return {
    allowedTools: input.allowedTools,
    blockedTools: input.blockedTools,
    approvalRequiredTools: input.approvalRequiredTools,
    allowedDomains: input.allowedDomains,
    blockedDomains: input.blockedDomains,
    dataScopes: input.dataScopes,
    memoryScopes: input.memoryScopes,
  };
}

function passportSnapshot(row: PassportWithIdentityRow | PassportRow): AgentSessionPassportSnapshot {
  const policy = jsonPolicy(row);
  return {
    id: row.id,
    projectId: row.projectId,
    agentIdentityId: row.agentIdentityId,
    sessionId: row.sessionId,
    passportHash: row.passportHash,
    status: row.status,
    ...policy,
    riskScore: row.riskScore,
    riskLevel: row.riskLevel,
    expiresAt: row.expiresAt,
  };
}

function identitySnapshot(row: PassportWithIdentityRow): AgentIdentitySnapshot {
  return {
    id: row.agentIdentityId,
    projectId: row.projectId,
    name: row.agentName,
    agentType: row.agentType,
    status: row.agentStatus,
    defaultPolicyJson: row.defaultPolicyJson,
  };
}

function jsonPolicy(row: {
  allowedToolsJson: unknown;
  blockedToolsJson: unknown;
  approvalRequiredToolsJson: unknown;
  allowedDomainsJson: unknown;
  blockedDomainsJson: unknown;
  dataScopesJson: unknown;
  memoryScopesJson: unknown;
}): NormalizedAgentPassportPolicy {
  return normalizePassportPolicy({
    allowedTools: jsonStringArray(row.allowedToolsJson),
    blockedTools: jsonStringArray(row.blockedToolsJson),
    approvalRequiredTools: jsonStringArray(row.approvalRequiredToolsJson),
    allowedDomains: jsonStringArray(row.allowedDomainsJson),
    blockedDomains: jsonStringArray(row.blockedDomainsJson),
    dataScopes: jsonStringArray(row.dataScopesJson),
    memoryScopes: jsonStringArray(row.memoryScopesJson),
  });
}

function jsonStringArray(value: unknown) {
  if (!Array.isArray(value)) return undefined;
  return value.filter((item): item is string => typeof item === "string");
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

async function findPassportBySession(projectId: string, sessionId: string) {
  const rows = await db.$queryRaw<PassportWithIdentityRow[]>`
    SELECT p."id", p."projectId", p."agentIdentityId", p."sessionId", p."passportHash", p."status",
      p."allowedToolsJson", p."blockedToolsJson", p."approvalRequiredToolsJson",
      p."allowedDomainsJson", p."blockedDomainsJson", p."dataScopesJson", p."memoryScopesJson",
      p."riskScore", p."riskLevel", p."expiresAt", p."createdAt", p."updatedAt",
      i."name" AS "agentName", i."agentType", i."status" AS "agentStatus", i."defaultPolicyJson"
    FROM "AgentSessionPassport" p
    INNER JOIN "AgentIdentity" i ON i."id" = p."agentIdentityId" AND i."projectId" = p."projectId"
    WHERE p."projectId" = ${projectId} AND p."sessionId" = ${sessionId}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

async function auditPassport(input: {
  projectId: string;
  agentIdentityId: string;
  sessionPassportId: string;
  action: string;
  decision: string;
  reason: string;
  metadata?: Record<string, unknown>;
}) {
  await db.$executeRaw`
    INSERT INTO "AgentPassportAudit" ("id", "projectId", "agentIdentityId", "sessionPassportId", "action", "decision", "reason", "metadataJson", "createdAt")
    VALUES (
      ${createAgentPassportAuditId()},
      ${input.projectId},
      ${input.agentIdentityId},
      ${input.sessionPassportId},
      ${input.action},
      ${input.decision},
      ${input.reason},
      ${JSON.stringify(sanitizeMetadata(input.metadata))}::jsonb,
      NOW()
    )
  `;
}
