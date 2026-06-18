import { authenticateAdvancedSecurity, routeError } from "@/lib/advanced-security/server";
import { jsonResponse } from "@/lib/apiResponse";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authenticated = await authenticateAdvancedSecurity(request);
    if (!authenticated.ok) return authenticated.response;
    const { id } = await params;
    const projectId = authenticated.auth.project.id;
    // Soft-delete: mark as DELETED so the change is auditable and the row stays
    // project-scoped. Hard deletes would lose the forensic trail.
    const updated = await db.$executeRaw`
      UPDATE "AgentMemoryRecord" SET "status" = 'DELETED', "updatedAt" = NOW()
      WHERE "id" = ${id} AND "projectId" = ${projectId}
    `;
    if (Number(updated) === 0) return jsonResponse({ error: true, message: "Memory record not found." }, { status: 404 });
    await db.$executeRaw`
      INSERT INTO "MemoryChangeAudit" ("id", "projectId", "memoryRecordId", "action", "decision", "reason", "createdAt")
      VALUES (${crypto.randomUUID()}, ${projectId}, ${id}, 'DELETE', 'BLOCK', 'Memory deleted.', NOW())
    `;
    return jsonResponse({ id, status: "DELETED" });
  } catch (error) {
    return routeError(error, "Memory record could not be deleted.");
  }
}
