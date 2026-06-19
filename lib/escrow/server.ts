import { z } from "zod";
import { jsonResponse } from "@/lib/apiResponse";
import { authenticateAdvancedSecurity, routeError } from "@/lib/advanced-security/server";
import { db } from "@/lib/db";
import {
  ESCROW_ACTOR_TYPES,
  ESCROW_RISK_LEVELS,
  canApproveEscrow,
  canExecuteEscrow,
  createEscrowApprovalToken,
  createEscrowAuditId,
  createEscrowTransactionId,
  evaluateEscrowCreation,
  hashEscrowApprovalToken,
  isEscrowApprovalTokenValid,
  rescanEditedEscrowPayload,
  sanitizeEscrowMetadata,
  sanitizeEscrowText,
  type EscrowActorType,
  type EscrowRiskLevel,
  type EscrowStatus,
} from "@/lib/escrow";

const riskLevel = z.enum(ESCROW_RISK_LEVELS);
const actorType = z.enum(ESCROW_ACTOR_TYPES);

export const escrowCreateSchema = z.object({
  sessionId: z.string().trim().min(1).max(200),
  agentIdentityId: z.string().trim().min(1).max(200).optional(),
  transactionType: z.string().trim().min(1).max(120),
  tool: z.string().trim().min(1).max(200),
  action: z.string().trim().min(1).max(300),
  target: z.string().trim().max(2000).optional(),
  originalPayload: z.string().max(50_000).optional(),
  safePayload: z.string().max(50_000).optional(),
  riskLevel: riskLevel.optional(),
  policyAllowsCriticalReview: z.boolean().default(false),
  expiresAt: z.string().datetime().optional(),
  ttlSeconds: z.number().int().min(60).max(60 * 60 * 24).default(15 * 60),
  metadata: z.record(z.unknown()).optional(),
});

const escrowResolveBaseSchema = z.object({
  escrowTransactionId: z.string().trim().min(1).max(200).optional(),
  approvalToken: z.string().trim().min(10).max(200).optional(),
  reason: z.string().trim().max(1000).optional(),
  actorType: actorType.default("USER"),
  metadata: z.record(z.unknown()).optional(),
});

export const escrowResolveSchema = escrowResolveBaseSchema.refine((value) => Boolean(value.escrowTransactionId || value.approvalToken), {
  message: "escrowTransactionId or approvalToken is required.",
});

export const escrowEditApproveSchema = escrowResolveBaseSchema.extend({
  editedPayload: z.string().min(1).max(50_000),
}).refine((value) => Boolean(value.escrowTransactionId || value.approvalToken), {
  message: "escrowTransactionId or approvalToken is required.",
});

export const escrowExecuteSchema = z.object({
  escrowTransactionId: z.string().trim().min(1).max(200).optional(),
  approvalToken: z.string().trim().min(10).max(200).optional(),
  metadata: z.record(z.unknown()).optional(),
}).refine((value) => Boolean(value.escrowTransactionId || value.approvalToken), {
  message: "escrowTransactionId or approvalToken is required.",
});

type EscrowAuth = Extract<Awaited<ReturnType<typeof authenticateAdvancedSecurity>>, { ok: true }>["auth"];

type EscrowRow = {
  id: string;
  projectId: string;
  sessionId: string;
  agentIdentityId: string | null;
  transactionType: string;
  tool: string;
  action: string;
  target: string | null;
  originalPayloadRedacted: string | null;
  safePayload: string | null;
  riskLevel: string;
  status: string;
  approvalTokenHash: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt: Date | null;
  executedAt: Date | null;
};

type EscrowAuditRow = {
  id: string;
  projectId: string;
  escrowTransactionId: string;
  action: string;
  actorType: string;
  reason: string | null;
  metadataJson: unknown;
  createdAt: Date;
};

export async function createEscrowTransaction(auth: EscrowAuth, input: z.infer<typeof escrowCreateSchema>) {
  if (input.agentIdentityId) {
    const agent = await db.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "AgentIdentity"
      WHERE "projectId" = ${auth.project.id} AND "id" = ${input.agentIdentityId}
      LIMIT 1
    `;
    if (!agent[0]) {
      return jsonResponse({ error: true, decision: "BLOCK", message: "Agent identity does not belong to this project." }, { status: 404 });
    }
  }

  const evaluated = evaluateEscrowCreation(input);
  if (evaluated.decision === "BLOCK") {
    return jsonResponse({
      error: true,
      decision: "BLOCK",
      riskLevel: evaluated.riskLevel,
      reason: evaluated.reason,
      findings: evaluated.findings,
    }, { status: 403 });
  }
  if (evaluated.decision === "ALLOW") {
    return jsonResponse({
      decision: "ALLOW",
      riskLevel: evaluated.riskLevel,
      reason: evaluated.reason,
    });
  }

  const id = createEscrowTransactionId();
  const { approvalToken, approvalTokenHash } = createEscrowApprovalToken();
  const expiresAt = input.expiresAt ? new Date(input.expiresAt) : new Date(Date.now() + input.ttlSeconds * 1000);

  await db.$executeRaw`
    INSERT INTO "AgentEscrowTransaction" (
      "id", "projectId", "sessionId", "agentIdentityId", "transactionType", "tool", "action",
      "target", "originalPayloadRedacted", "safePayload", "riskLevel", "status", "approvalTokenHash",
      "expiresAt", "createdAt", "updatedAt"
    )
    VALUES (
      ${id},
      ${auth.project.id},
      ${input.sessionId},
      ${input.agentIdentityId ?? null},
      ${input.transactionType},
      ${input.tool},
      ${input.action},
      ${sanitizeEscrowText(input.target)},
      ${evaluated.originalPayloadRedacted},
      ${evaluated.safePayload},
      ${evaluated.riskLevel},
      'PENDING'::"AgentEscrowTransactionStatus",
      ${approvalTokenHash},
      ${expiresAt},
      NOW(),
      NOW()
    )
  `;
  await persistEscrowAudit(auth.project.id, id, "CREATED", "SYSTEM", evaluated.reason, {
    ...sanitizeEscrowMetadata(input.metadata),
    findings: evaluated.findings.join(","),
  });

  return jsonResponse({
    escrowTransactionId: id,
    approvalToken,
    status: "PENDING",
    decision: "ASK_APPROVAL",
    riskLevel: evaluated.riskLevel,
    reason: evaluated.reason,
    expiresAt,
  }, { status: 201 });
}

export async function approveEscrowTransaction(auth: EscrowAuth, input: z.infer<typeof escrowResolveSchema>) {
  const escrow = await findEscrow(auth.project.id, input);
  if (!escrow) return jsonResponse({ error: true, decision: "BLOCK", message: "Escrow transaction not found." }, { status: 404 });
  const allowed = canApproveEscrow(toSnapshot(escrow));
  if (!allowed.ok) {
    if (allowed.status === "EXPIRED") await expireEscrow(auth.project.id, escrow.id);
    return jsonResponse({ error: true, decision: "BLOCK", message: allowed.reason }, { status: allowed.status === "EXPIRED" ? 410 : 409 });
  }

  await db.$executeRaw`
    UPDATE "AgentEscrowTransaction"
    SET "status" = 'APPROVED'::"AgentEscrowTransactionStatus", "resolvedAt" = NOW(), "updatedAt" = NOW()
    WHERE "projectId" = ${auth.project.id} AND "id" = ${escrow.id}
  `;
  await persistEscrowAudit(auth.project.id, escrow.id, "APPROVED", input.actorType, input.reason ?? "Escrow approved.", input.metadata);
  return jsonResponse({ escrowTransactionId: escrow.id, status: "APPROVED", decision: "ALLOW", message: "Escrow approved. Execute only the reviewed action." });
}

export async function denyEscrowTransaction(auth: EscrowAuth, input: z.infer<typeof escrowResolveSchema>) {
  const escrow = await findEscrow(auth.project.id, input);
  if (!escrow) return jsonResponse({ error: true, decision: "BLOCK", message: "Escrow transaction not found." }, { status: 404 });
  if (escrow.status !== "PENDING") return jsonResponse({ error: true, decision: "BLOCK", message: `Escrow is already ${escrow.status.toLowerCase()}.` }, { status: 409 });
  await db.$executeRaw`
    UPDATE "AgentEscrowTransaction"
    SET "status" = 'DENIED'::"AgentEscrowTransactionStatus", "resolvedAt" = NOW(), "updatedAt" = NOW()
    WHERE "projectId" = ${auth.project.id} AND "id" = ${escrow.id}
  `;
  await persistEscrowAudit(auth.project.id, escrow.id, "DENIED", input.actorType, input.reason ?? "Escrow denied.", input.metadata);
  return jsonResponse({ escrowTransactionId: escrow.id, status: "DENIED", decision: "BLOCK", message: "Escrow denied. Do not execute the action." });
}

export async function editAndApproveEscrow(auth: EscrowAuth, input: z.infer<typeof escrowEditApproveSchema>) {
  const escrow = await findEscrow(auth.project.id, input);
  if (!escrow) return jsonResponse({ error: true, decision: "BLOCK", message: "Escrow transaction not found." }, { status: 404 });
  const allowed = canApproveEscrow(toSnapshot(escrow));
  if (!allowed.ok) {
    if (allowed.status === "EXPIRED") await expireEscrow(auth.project.id, escrow.id);
    return jsonResponse({ error: true, decision: "BLOCK", message: allowed.reason }, { status: allowed.status === "EXPIRED" ? 410 : 409 });
  }

  const rescanned = rescanEditedEscrowPayload({
    transactionType: escrow.transactionType,
    tool: escrow.tool,
    action: escrow.action,
    target: escrow.target ?? undefined,
    riskLevel: escrow.riskLevel as EscrowRiskLevel,
    editedPayload: input.editedPayload,
  });
  if (rescanned.decision === "BLOCK") {
    await persistEscrowAudit(auth.project.id, escrow.id, "EDIT_BLOCKED", input.actorType, rescanned.reason, input.metadata);
    return jsonResponse({ error: true, decision: "BLOCK", riskLevel: rescanned.riskLevel, reason: rescanned.reason }, { status: 403 });
  }

  await db.$executeRaw`
    UPDATE "AgentEscrowTransaction"
    SET "status" = 'APPROVED'::"AgentEscrowTransactionStatus",
      "safePayload" = ${rescanned.safePayload},
      "riskLevel" = ${rescanned.riskLevel},
      "resolvedAt" = NOW(),
      "updatedAt" = NOW()
    WHERE "projectId" = ${auth.project.id} AND "id" = ${escrow.id}
  `;
  await persistEscrowAudit(auth.project.id, escrow.id, "EDITED_AND_APPROVED", input.actorType, input.reason ?? "Escrow edited and approved.", input.metadata);
  return jsonResponse({ escrowTransactionId: escrow.id, status: "APPROVED", decision: "ALLOW", safePayload: rescanned.safePayload });
}

export async function executeEscrowTransaction(auth: EscrowAuth, input: z.infer<typeof escrowExecuteSchema>) {
  const escrow = await findEscrow(auth.project.id, input);
  if (!escrow) return jsonResponse({ error: true, decision: "BLOCK", message: "Escrow transaction not found." }, { status: 404 });
  const allowed = canExecuteEscrow(toSnapshot(escrow));
  if (!allowed.ok) {
    if (allowed.status === "EXPIRED") await expireEscrow(auth.project.id, escrow.id);
    return jsonResponse({ error: true, decision: "BLOCK", message: allowed.reason }, { status: allowed.status === "EXPIRED" ? 410 : 409 });
  }

  await db.$executeRaw`
    UPDATE "AgentEscrowTransaction"
    SET "status" = 'EXECUTED'::"AgentEscrowTransactionStatus", "executedAt" = NOW(), "updatedAt" = NOW()
    WHERE "projectId" = ${auth.project.id} AND "id" = ${escrow.id} AND "status" = 'APPROVED'::"AgentEscrowTransactionStatus"
  `;
  await persistEscrowAudit(auth.project.id, escrow.id, "EXECUTED", "SYSTEM", "Escrow transaction executed once.", input.metadata);
  return jsonResponse({
    escrowTransactionId: escrow.id,
    status: "EXECUTED",
    decision: "ALLOW",
    tool: escrow.tool,
    action: escrow.action,
    target: escrow.target,
    safePayload: escrow.safePayload,
  });
}

export async function listPendingEscrowTransactions(auth: EscrowAuth) {
  const rows = await db.$queryRaw<EscrowRow[]>`
    SELECT "id", "projectId", "sessionId", "agentIdentityId", "transactionType", "tool", "action", "target",
      "originalPayloadRedacted", "safePayload", "riskLevel", "status", "approvalTokenHash", "expiresAt",
      "createdAt", "updatedAt", "resolvedAt", "executedAt"
    FROM "AgentEscrowTransaction"
    WHERE "projectId" = ${auth.project.id} AND "status" = 'PENDING'::"AgentEscrowTransactionStatus"
    ORDER BY "createdAt" DESC
    LIMIT 100
  `;
  return jsonResponse({ transactions: rows.map(publicEscrow) });
}

export async function getEscrowTransaction(auth: EscrowAuth, id: string) {
  const rows = await db.$queryRaw<EscrowRow[]>`
    SELECT "id", "projectId", "sessionId", "agentIdentityId", "transactionType", "tool", "action", "target",
      "originalPayloadRedacted", "safePayload", "riskLevel", "status", "approvalTokenHash", "expiresAt",
      "createdAt", "updatedAt", "resolvedAt", "executedAt"
    FROM "AgentEscrowTransaction"
    WHERE "projectId" = ${auth.project.id} AND "id" = ${id}
    LIMIT 1
  `;
  const escrow = rows[0];
  if (!escrow) return jsonResponse({ error: true, message: "Escrow transaction not found." }, { status: 404 });
  const audits = await db.$queryRaw<EscrowAuditRow[]>`
    SELECT "id", "projectId", "escrowTransactionId", "action", "actorType", "reason", "metadataJson", "createdAt"
    FROM "AgentEscrowAudit"
    WHERE "projectId" = ${auth.project.id} AND "escrowTransactionId" = ${id}
    ORDER BY "createdAt" ASC
    LIMIT 100
  `;
  return jsonResponse({ transaction: publicEscrow(escrow), audits: audits.map(publicAudit) });
}

export { routeError };

async function findEscrow(projectId: string, input: { escrowTransactionId?: string; approvalToken?: string }) {
  if (input.approvalToken) {
    const tokenHash = hashEscrowApprovalToken(input.approvalToken);
    const rows = await db.$queryRaw<EscrowRow[]>`
      SELECT "id", "projectId", "sessionId", "agentIdentityId", "transactionType", "tool", "action", "target",
        "originalPayloadRedacted", "safePayload", "riskLevel", "status", "approvalTokenHash", "expiresAt",
        "createdAt", "updatedAt", "resolvedAt", "executedAt"
      FROM "AgentEscrowTransaction"
      WHERE "projectId" = ${projectId} AND "approvalTokenHash" = ${tokenHash}
      LIMIT 1
    `;
    const row = rows[0];
    if (!row || !isEscrowApprovalTokenValid(input.approvalToken, row.approvalTokenHash)) return null;
    return row;
  }

  const rows = await db.$queryRaw<EscrowRow[]>`
    SELECT "id", "projectId", "sessionId", "agentIdentityId", "transactionType", "tool", "action", "target",
      "originalPayloadRedacted", "safePayload", "riskLevel", "status", "approvalTokenHash", "expiresAt",
      "createdAt", "updatedAt", "resolvedAt", "executedAt"
    FROM "AgentEscrowTransaction"
    WHERE "projectId" = ${projectId} AND "id" = ${input.escrowTransactionId}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

async function expireEscrow(projectId: string, escrowId: string) {
  await db.$executeRaw`
    UPDATE "AgentEscrowTransaction"
    SET "status" = 'EXPIRED'::"AgentEscrowTransactionStatus", "updatedAt" = NOW()
    WHERE "projectId" = ${projectId} AND "id" = ${escrowId}
  `;
}

async function persistEscrowAudit(projectId: string, escrowId: string, action: string, actor: EscrowActorType, reason?: string, metadata?: Record<string, unknown>) {
  const id = createEscrowAuditId();
  await db.$executeRaw`
    INSERT INTO "AgentEscrowAudit" ("id", "projectId", "escrowTransactionId", "action", "actorType", "reason", "metadataJson", "createdAt")
    VALUES (
      ${id},
      ${projectId},
      ${escrowId},
      ${action},
      ${actor}::"AgentEscrowActorType",
      ${reason ? sanitizeEscrowText(reason) : null},
      ${JSON.stringify(sanitizeEscrowMetadata(metadata))}::jsonb,
      NOW()
    )
  `;
}

function toSnapshot(row: EscrowRow) {
  return {
    status: row.status as EscrowStatus,
    expiresAt: row.expiresAt,
    executedAt: row.executedAt,
  };
}

function publicEscrow(row: EscrowRow) {
  return {
    id: row.id,
    projectId: row.projectId,
    sessionId: row.sessionId,
    agentIdentityId: row.agentIdentityId,
    transactionType: row.transactionType,
    tool: row.tool,
    action: row.action,
    target: row.target,
    originalPayloadRedacted: row.originalPayloadRedacted,
    safePayload: row.safePayload,
    riskLevel: row.riskLevel,
    status: row.status,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    resolvedAt: row.resolvedAt,
    executedAt: row.executedAt,
  };
}

function publicAudit(row: EscrowAuditRow) {
  return {
    id: row.id,
    escrowTransactionId: row.escrowTransactionId,
    action: row.action,
    actorType: row.actorType,
    reason: row.reason,
    metadata: row.metadataJson,
    createdAt: row.createdAt,
  };
}
