"use server";

import { revalidatePath } from "next/cache";
import { validateRollbackAttempt, type AgentActionLedgerEntry } from "@/lib/agent-action-ledger";
import { requireProjectPermission } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { emitSecurityEvent } from "@/lib/events/emit";
import { buildComplianceEvidenceItem, createComplianceEvidenceItemId } from "@/lib/evidence-vault";
import { sanitizeLogText } from "@/lib/guard/logSafety";

type LedgerRow = {
  id: string;
  tool: string;
  action: string;
  riskLevel: string;
  reversalStatus: AgentActionLedgerEntry["reversalStatus"];
  rollbackActionJson: unknown;
  rollbackDeadline: Date | null;
};

export async function stageDashboardRollback(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "").trim();
  const ledgerId = String(formData.get("ledgerId") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  if (!projectId || !ledgerId || reason.length < 8 || reason.length > 500) {
    throw new Error("A rollback reason between 8 and 500 characters is required.");
  }

  const access = await requireProjectPermission(projectId, "policy:manage");
  const rows = await db.$queryRaw<LedgerRow[]>`
    SELECT "id", "tool", "action", "riskLevel", "reversalStatus", "rollbackActionJson", "rollbackDeadline"
    FROM "AgentActionLedger"
    WHERE "id" = ${ledgerId} AND "projectId" = ${projectId}
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) throw new Error("Agent action ledger entry not found.");

  const validation = validateRollbackAttempt({
    reversalStatus: row.reversalStatus,
    rollbackDeadline: row.rollbackDeadline?.toISOString() ?? null,
    rollbackAction: row.rollbackActionJson,
  });
  const rollbackStatus = validation.allowed ? "ROLLBACK_READY" : "ROLLBACK_BLOCKED";
  const safeReason = sanitizeLogText(reason);
  const evidence = buildComplianceEvidenceItem({
    evidenceType: "INCIDENT",
    title: validation.allowed ? "Agent rollback staged" : "Agent rollback blocked",
    summary: validation.allowed
      ? `A human operator staged a compensating action for ${row.tool}.${row.action}.`
      : `A rollback request for ${row.tool}.${row.action} was blocked by the reversibility policy.`,
    riskLevel: row.riskLevel === "CRITICAL" ? "CRITICAL" : row.riskLevel === "HIGH" ? "HIGH" : "MEDIUM",
    controlName: "Agent action rollback and incident response",
    status: validation.allowed ? "ACTIVE" : "WARNING",
    evidence: {
      ledgerId: row.id,
      rollbackStatus,
      operatorId: access.user.id,
      reason: safeReason,
      policyReason: validation.reason,
    },
  });

  await db.$transaction(async (tx) => {
    await tx.$executeRaw`
      UPDATE "AgentActionLedger"
      SET "rollbackStatus" = ${rollbackStatus}, "rollbackAttemptedAt" = NOW(), "updatedAt" = NOW()
      WHERE "id" = ${row.id} AND "projectId" = ${projectId}
    `;
    await tx.organizationAuditLog.create({
      data: {
        organizationId: access.org.id,
        actorUserId: access.user.id,
        action: validation.allowed ? "AGENT_ROLLBACK_STAGED" : "AGENT_ROLLBACK_BLOCKED",
        category: "AGENT_CONTROL",
        metadata: { ledgerId: row.id, projectId, tool: row.tool, action: row.action, reason: safeReason, policyReason: validation.reason },
      },
    });
    await tx.$executeRaw`
      INSERT INTO "ComplianceEvidenceItem" (
        "id", "projectId", "evidenceType", "title", "summary", "riskLevel", "controlName",
        "status", "evidenceJson", "contentHash", "createdAt"
      ) VALUES (
        ${createComplianceEvidenceItemId()}, ${projectId}, ${evidence.evidenceType}::"ComplianceEvidenceType",
        ${evidence.title}, ${evidence.summary}, ${evidence.riskLevel}, ${evidence.controlName},
        ${evidence.status}::"ComplianceEvidenceStatus", ${JSON.stringify(evidence.evidenceJson)}::jsonb,
        ${evidence.contentHash}, NOW()
      )
    `;
  });

  await emitSecurityEvent({
    organizationId: access.org.id,
    projectId,
    eventType: "agent.rollback.requested",
    severity: validation.allowed ? "HIGH" : "CRITICAL",
    riskTypes: [validation.allowed ? "ROLLBACK_STAGED" : "ROLLBACK_BLOCKED"],
    action: rollbackStatus,
    source: "dashboard.agent-control",
    metadata: { ledgerId: row.id, operatorId: access.user.id, reason: safeReason },
  });

  revalidatePath("/dashboard/agent-control");
  revalidatePath("/dashboard/evidence-vault");
}
