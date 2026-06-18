import { authenticateAdvancedSecurity, routeError } from "@/lib/advanced-security/server";
import { jsonResponse } from "@/lib/apiResponse";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authenticated = await authenticateAdvancedSecurity(request);
    if (!authenticated.ok) return authenticated.response;
    const { id } = await params;
    const projectId = authenticated.auth.project.id;
    const updated = await db.$executeRaw`
      UPDATE "AgentMemoryRecord" SET "status" = 'QUARANTINED', "updatedAt" = NOW()
      WHERE "id" = ${id} AND "projectId" = ${projectId}
    `;
    if (Number(updated) === 0) return jsonResponse({ error: true, message: "Memory record not found." }, { status: 404 });
    await db.$executeRaw`
      INSERT INTO "MemoryChangeAudit" ("id", "projectId", "memoryRecordId", "action", "decision", "reason", "createdAt")
      VALUES (${crypto.randomUUID()}, ${projectId}, ${id}, 'QUARANTINE', 'QUARANTINE', 'Memory manually quarantined.', NOW())
    `;
    return jsonResponse({ id, status: "QUARANTINED" });
  } catch (error) {
    return routeError(error, "Memory record could not be quarantined.");
  }
}
