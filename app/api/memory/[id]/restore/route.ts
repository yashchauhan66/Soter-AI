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
    // Restore is only valid within the caller's own project (tenant isolation).
    const updated = await db.$executeRaw`
      UPDATE "AgentMemoryRecord" SET "status" = 'ACTIVE', "updatedAt" = NOW()
      WHERE "id" = ${id} AND "projectId" = ${projectId} AND "status" <> 'DELETED'
    `;
    if (Number(updated) === 0) return jsonResponse({ error: true, message: "Memory record not found or already deleted." }, { status: 404 });
    await db.$executeRaw`
      INSERT INTO "MemoryChangeAudit" ("id", "projectId", "memoryRecordId", "action", "decision", "reason", "createdAt")
      VALUES (${crypto.randomUUID()}, ${projectId}, ${id}, 'RESTORE', 'ALLOW', 'Memory manually restored.', NOW())
    `;
    return jsonResponse({ id, status: "ACTIVE" });
  } catch (error) {
    return routeError(error, "Memory record could not be restored.");
  }
}
