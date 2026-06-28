"use server";

import { revalidatePath } from "next/cache";
import { requireProjectPermission } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { emitSecurityEvent } from "@/lib/events/emit";
import { buildComplianceEvidenceItem, createComplianceEvidenceItemId } from "@/lib/evidence-vault";
import { sanitizeLogText } from "@/lib/guard/logSafety";

export async function resolveDashboardAgentApproval(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");
  const approvalId = String(formData.get("approvalId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const editedContent = String(formData.get("editedContent") ?? "");

  if (!projectId || !approvalId || !["APPROVED", "DENIED"].includes(decision)) {
    throw new Error("Invalid approval resolution request.");
  }

  const access = await requireProjectPermission(projectId, "policy:manage");
  const rows = await db.$queryRaw<Array<{ id: string; status: string; expiresAt: Date; actionLogId: string | null; tool: string | null; action: string | null; riskLevel: string | null }>>`
    SELECT a."id", a."status", a."expiresAt", a."actionLogId", l."tool", l."action", l."riskLevel"
    FROM "AgentApproval" a
    LEFT JOIN "AgentActionLog" l ON l."id" = a."actionLogId"
    WHERE a."id" = ${approvalId} AND a."projectId" = ${projectId}
    LIMIT 1
  `;
  const approval = rows[0];
  if (!approval) throw new Error("Approval not found.");
  if (approval.status !== "PENDING") throw new Error(`Approval is already ${approval.status.toLowerCase()}.`);
  if (approval.expiresAt.getTime() < Date.now()) {
    await db.$executeRaw`UPDATE "AgentApproval" SET "status" = 'EXPIRED', "resolvedAt" = NOW() WHERE "id" = ${approval.id}`;
    throw new Error("Approval expired.");
  }

  const safeEditedContent = editedContent.trim() ? sanitizeLogText(editedContent) : null;
  const evidence = buildComplianceEvidenceItem({
    evidenceType: "APPROVAL",
    title: `Agent action ${decision.toLowerCase()}`,
    summary: `A human operator ${decision === "APPROVED" ? "approved" : "denied"} ${approval.tool ?? "an agent action"}.${approval.action ?? ""}`,
    riskLevel: approval.riskLevel === "CRITICAL" ? "CRITICAL" : approval.riskLevel === "HIGH" ? "HIGH" : "MEDIUM",
    controlName: "Human-in-the-loop approval",
    status: decision === "APPROVED" ? "PASS" : "RESOLVED",
    evidence: { approvalId: approval.id, actionLogId: approval.actionLogId, decision, operatorId: access.user.id, contentEdited: Boolean(safeEditedContent) },
  });
  await db.$transaction(async (tx) => {
    await tx.$executeRaw`
      UPDATE "AgentApproval"
      SET "status" = ${decision}, "safeContent" = ${safeEditedContent}, "resolvedAt" = NOW()
      WHERE "id" = ${approval.id} AND "projectId" = ${projectId}
    `;
    if (approval.actionLogId && safeEditedContent) {
      await tx.$executeRaw`
        UPDATE "AgentActionLog" SET "safeContent" = ${safeEditedContent}
        WHERE "id" = ${approval.actionLogId} AND "projectId" = ${projectId}
      `;
    }
    await tx.organizationAuditLog.create({ data: { organizationId: access.org.id, actorUserId: access.user.id, action: `AGENT_ACTION_${decision}`, category: "AGENT_CONTROL", metadata: { projectId, approvalId: approval.id, actionLogId: approval.actionLogId } } });
    await tx.$executeRaw`
      INSERT INTO "ComplianceEvidenceItem" ("id", "projectId", "evidenceType", "title", "summary", "riskLevel", "controlName", "status", "evidenceJson", "contentHash", "createdAt")
      VALUES (${createComplianceEvidenceItemId()}, ${projectId}, ${evidence.evidenceType}::"ComplianceEvidenceType", ${evidence.title}, ${evidence.summary}, ${evidence.riskLevel}, ${evidence.controlName}, ${evidence.status}::"ComplianceEvidenceStatus", ${JSON.stringify(evidence.evidenceJson)}::jsonb, ${evidence.contentHash}, NOW())
    `;
  });
  await emitSecurityEvent({ organizationId: access.org.id, projectId, eventType: "guard.human_review", severity: approval.riskLevel === "CRITICAL" ? "CRITICAL" : "HIGH", riskTypes: ["HUMAN_APPROVAL"], action: decision, source: "dashboard.agent-control", metadata: { approvalId: approval.id, operatorId: access.user.id } });

  revalidatePath("/dashboard/agent-firewall");
  revalidatePath("/dashboard/agent-control");
}
