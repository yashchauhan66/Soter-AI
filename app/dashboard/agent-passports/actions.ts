"use server";

import { revalidatePath } from "next/cache";
import { requireProjectPermission } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { createAgentPassportAuditId } from "@/lib/agent-passport";
import { sanitizeLogText } from "@/lib/guard/logSafety";

export async function revokeDashboardAgentPassport(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");
  const passportId = String(formData.get("passportId") ?? "");
  const reason = String(formData.get("reason") ?? "Revoked from dashboard.").slice(0, 500);

  if (!projectId || !passportId) throw new Error("Invalid passport revoke request.");
  await requireProjectPermission(projectId, "policy:manage");

  const rows = await db.$queryRaw<Array<{ id: string; agentIdentityId: string; sessionId: string; status: string }>>`
    SELECT "id", "agentIdentityId", "sessionId", "status"
    FROM "AgentSessionPassport"
    WHERE "id" = ${passportId} AND "projectId" = ${projectId}
    LIMIT 1
  `;
  const passport = rows[0];
  if (!passport) throw new Error("Passport not found.");
  if (passport.status !== "REVOKED") {
    await db.$executeRaw`
      UPDATE "AgentSessionPassport"
      SET "status" = 'REVOKED'::"AgentSessionPassportStatus", "updatedAt" = NOW()
      WHERE "id" = ${passport.id} AND "projectId" = ${projectId}
    `;
  }

  await db.$executeRaw`
    INSERT INTO "AgentPassportAudit" ("id", "projectId", "agentIdentityId", "sessionPassportId", "action", "decision", "reason", "metadataJson", "createdAt")
    VALUES (
      ${createAgentPassportAuditId()},
      ${projectId},
      ${passport.agentIdentityId},
      ${passport.id},
      'REVOKE',
      'BLOCK',
      ${sanitizeLogText(reason)},
      ${JSON.stringify({ source: "dashboard", sessionId: passport.sessionId })}::jsonb,
      NOW()
    )
  `;

  revalidatePath("/dashboard/agent-passports");
}
