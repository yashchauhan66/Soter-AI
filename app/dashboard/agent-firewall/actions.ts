"use server";

import { revalidatePath } from "next/cache";
import { requireProjectPermission } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { sanitizeLogText } from "@/lib/guard/logSafety";

export async function resolveDashboardAgentApproval(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");
  const approvalId = String(formData.get("approvalId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const editedContent = String(formData.get("editedContent") ?? "");

  if (!projectId || !approvalId || !["APPROVED", "DENIED"].includes(decision)) {
    throw new Error("Invalid approval resolution request.");
  }

  await requireProjectPermission(projectId, "policy:manage");
  const rows = await db.$queryRaw<Array<{ id: string; status: string; expiresAt: Date; actionLogId: string | null }>>`
    SELECT "id", "status", "expiresAt", "actionLogId"
    FROM "AgentApproval"
    WHERE "id" = ${approvalId} AND "projectId" = ${projectId}
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
  await db.$executeRaw`
    UPDATE "AgentApproval"
    SET "status" = ${decision}, "safeContent" = ${safeEditedContent}, "resolvedAt" = NOW()
    WHERE "id" = ${approval.id}
  `;
  if (approval.actionLogId && safeEditedContent) {
    await db.$executeRaw`
      UPDATE "AgentActionLog"
      SET "safeContent" = ${safeEditedContent}
      WHERE "id" = ${approval.actionLogId} AND "projectId" = ${projectId}
    `;
  }

  revalidatePath("/dashboard/agent-firewall");
}
