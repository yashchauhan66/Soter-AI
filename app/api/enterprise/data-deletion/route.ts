import { z } from "zod";
import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { requireOrganizationAccess } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { expectedDeletionConfirmation } from "@/lib/retention/policy";

export const dynamic = "force-dynamic";

const deletionSchema = z.object({
  organizationId: z.string().min(1),
  scope: z.enum(["PROJECT", "ORGANIZATION", "GUARD_LOGS"]),
  projectId: z.string().min(1).optional(),
  confirmation: z.string().min(1),
  exportRequested: z.boolean().default(true),
  notes: z.string().max(2000).optional(),
});

export async function POST(request: Request) {
  try {
    const body = deletionSchema.parse(await readJson(request));
    const access = await requireOrganizationAccess(body.organizationId);
    if (body.scope === "ORGANIZATION" && access.role !== "OWNER" && !access.user.isAdmin) {
      return jsonResponse({ error: true, message: "Only organization owners can request organization deletion." }, { status: 403 });
    }
    if (body.scope !== "ORGANIZATION" && !["OWNER", "ADMIN"].includes(access.role) && !access.user.isAdmin) {
      return jsonResponse({ error: true, message: "Owner or admin role required." }, { status: 403 });
    }
    let targetName = access.org.slug;
    if (body.scope === "PROJECT") {
      if (!body.projectId) return jsonResponse({ error: true, message: "projectId is required for project deletion." }, { status: 400 });
      const project = await db.project.findFirst({ where: { id: body.projectId, organizationId: body.organizationId } });
      if (!project) return jsonResponse({ error: true, message: "Project not found." }, { status: 404 });
      targetName = project.name;
    }
    const expected = expectedDeletionConfirmation(body.scope, targetName);
    if (body.confirmation !== expected) {
      return jsonResponse({ error: true, message: `Confirmation phrase must be: ${expected}` }, { status: 400 });
    }
    const requestRecord = await db.dataDeletionRequest.create({
      data: {
        organizationId: body.organizationId,
        scope: body.scope,
        projectId: body.projectId,
        requestedById: access.user.id,
        status: "PENDING",
        confirmation: body.confirmation,
        exportRequested: body.exportRequested,
        notes: body.notes,
        jobs: {
          create: [
            { resource: "guard_logs", status: "PENDING" },
            { resource: "webhook_deliveries", status: "PENDING" },
            { resource: "rag_documents", status: "PENDING" },
          ],
        },
      },
      include: { jobs: true },
    });
    await db.organizationAuditLog.create({
      data: {
        organizationId: body.organizationId,
        actorUserId: access.user.id,
        action: "data_deletion_requested",
        category: "retention",
        metadata: { requestId: requestRecord.id, scope: body.scope, projectId: body.projectId ?? null, exportRequested: body.exportRequested },
      },
    });
    return jsonResponse(requestRecord, { status: 201 });
  } catch (error) {
    return apiError(error, "Data deletion request could not be created.");
  }
}
