"use server";

import { revalidatePath } from "next/cache";
import { requireProjectPermission } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { sanitizeLogText } from "@/lib/guard/logSafety";

export async function disableDashboardCanary(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");
  const canaryId = String(formData.get("canaryId") ?? "");
  const reason = String(formData.get("reason") ?? "Disabled from dashboard.").slice(0, 500);

  if (!projectId || !canaryId) throw new Error("Invalid canary disable request.");
  await requireProjectPermission(projectId, "policy:manage");

  const updated = await db.$executeRaw`
    UPDATE "CanaryToken"
    SET "active" = false
    WHERE "projectId" = ${projectId} AND "id" = ${canaryId}
  `;

  if (updated === 0) {
    throw new Error("Canary token not found for this project.");
  }

  await db.$executeRaw`
    INSERT INTO "AgentActionLog" ("id", "sessionId", "projectId", "tool", "action", "destination", "decision", "riskLevel", "reason", "originalContentRedacted", "metadataJson", "createdAt")
    VALUES (
      ${crypto.randomUUID()},
      NULL,
      ${projectId},
      'canary.disable',
      'DISABLE',
      'dashboard',
      'BLOCK',
      'MEDIUM',
      ${sanitizeLogText(reason)},
      ${sanitizeLogText(reason)},
      ${JSON.stringify({ canaryId, source: "dashboard" })}::jsonb,
      NOW()
    )
  `;

  revalidatePath("/dashboard/canary-network");
}
