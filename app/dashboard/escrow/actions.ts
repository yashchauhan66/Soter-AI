"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProjectById } from "@/lib/auth";
import { requireProjectPermission } from "@/lib/auth/guards";
import { canApproveEscrow, rescanEditedEscrowPayload, sanitizeEscrowText, type EscrowRiskLevel, type EscrowStatus } from "@/lib/escrow";
import { db } from "@/lib/db";

type EscrowRow = {
  id: string;
  projectId: string;
  status: string;
  expiresAt: Date;
  executedAt: Date | null;
  transactionType: string;
  tool: string;
  action: string;
  target: string | null;
  riskLevel: string;
};

export async function resolveDashboardEscrow(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");
  const escrowId = String(formData.get("escrowId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const editedPayload = String(formData.get("editedPayload") ?? "");
  if (!projectId || !escrowId || !["APPROVED", "DENIED", "EDITED_AND_APPROVED"].includes(decision)) {
    throw new Error("Invalid escrow resolution request.");
  }

  const project = await getCurrentProjectById(projectId);
  await requireProjectPermission(project.id, "logs:read");

  const rows = await db.$queryRaw<EscrowRow[]>`
    SELECT "id", "projectId", "status", "expiresAt", "executedAt", "transactionType", "tool", "action", "target", "riskLevel"
    FROM "AgentEscrowTransaction"
    WHERE "projectId" = ${project.id} AND "id" = ${escrowId}
    LIMIT 1
  `;
  const escrow = rows[0];
  if (!escrow) throw new Error("Escrow transaction not found.");
  const allowed = canApproveEscrow({ status: escrow.status as EscrowStatus, expiresAt: escrow.expiresAt, executedAt: escrow.executedAt });
  if (!allowed.ok) throw new Error(allowed.reason);

  if (decision === "DENIED") {
    await db.$executeRaw`
      UPDATE "AgentEscrowTransaction"
      SET "status" = 'DENIED'::"AgentEscrowTransactionStatus", "resolvedAt" = NOW(), "updatedAt" = NOW()
      WHERE "projectId" = ${project.id} AND "id" = ${escrow.id}
    `;
    await insertAudit(project.id, escrow.id, "DENIED", "ADMIN", "Denied from dashboard.");
    revalidatePath("/dashboard/escrow");
    return;
  }

  if (decision === "EDITED_AND_APPROVED") {
    if (!editedPayload.trim()) throw new Error("Edited payload is required.");
    const rescanned = rescanEditedEscrowPayload({
      transactionType: escrow.transactionType,
      tool: escrow.tool,
      action: escrow.action,
      target: escrow.target ?? undefined,
      riskLevel: escrow.riskLevel as EscrowRiskLevel,
      editedPayload,
    });
    if (rescanned.decision === "BLOCK") throw new Error(rescanned.reason);
    await db.$executeRaw`
      UPDATE "AgentEscrowTransaction"
      SET "status" = 'APPROVED'::"AgentEscrowTransactionStatus",
        "safePayload" = ${rescanned.safePayload},
        "riskLevel" = ${rescanned.riskLevel},
        "resolvedAt" = NOW(),
        "updatedAt" = NOW()
      WHERE "projectId" = ${project.id} AND "id" = ${escrow.id}
    `;
    await insertAudit(project.id, escrow.id, "EDITED_AND_APPROVED", "ADMIN", "Edited and approved from dashboard.");
    revalidatePath("/dashboard/escrow");
    return;
  }

  await db.$executeRaw`
    UPDATE "AgentEscrowTransaction"
    SET "status" = 'APPROVED'::"AgentEscrowTransactionStatus", "resolvedAt" = NOW(), "updatedAt" = NOW()
    WHERE "projectId" = ${project.id} AND "id" = ${escrow.id}
  `;
  await insertAudit(project.id, escrow.id, "APPROVED", "ADMIN", "Approved from dashboard.");
  revalidatePath("/dashboard/escrow");
}

async function insertAudit(projectId: string, escrowId: string, action: string, actor: "ADMIN", reason: string) {
  await db.$executeRaw`
    INSERT INTO "AgentEscrowAudit" ("id", "projectId", "escrowTransactionId", "action", "actorType", "reason", "metadataJson", "createdAt")
    VALUES (${`agent_escrow_audit_${crypto.randomUUID()}`}, ${projectId}, ${escrowId}, ${action}, ${actor}::"AgentEscrowActorType", ${sanitizeEscrowText(reason)}, '{}'::jsonb, NOW())
  `;
}
