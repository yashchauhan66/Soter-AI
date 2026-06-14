import { Prisma, ProjectPlan } from "@prisma/client";
import { z } from "zod";
import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { requireAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { emitSecurityEvent } from "@/lib/events/emit";

const schema = z.object({ action: z.enum(["PLAN_OVERRIDE", "QUOTA_BUMP", "REPLAY_WEBHOOK", "RETRY_DELIVERY", "DISABLE_PROJECT", "ENABLE_PROJECT"]), targetId: z.string().min(1), reason: z.string().trim().min(5).max(500), value: z.union([z.string(), z.number()]).optional() });

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const body = schema.parse(await readJson(request));
    let organizationId: string | undefined;
    let metadata: Record<string, unknown> = {};
    if (body.action === "PLAN_OVERRIDE") {
      const plan = z.nativeEnum(ProjectPlan).parse(body.value);
      const org = await db.organization.update({ where: { id: body.targetId }, data: { plan } });
      organizationId = org.id; metadata = { plan };
    } else if (body.action === "QUOTA_BUMP") {
      const quotaOverride = z.number().int().positive().parse(body.value);
      const org = await db.organization.update({ where: { id: body.targetId }, data: { quotaOverride } });
      organizationId = org.id; metadata = { quotaOverride };
    } else if (body.action === "DISABLE_PROJECT" || body.action === "ENABLE_PROJECT") {
      const project = await db.project.update({ where: { id: body.targetId }, data: { disabledAt: body.action === "DISABLE_PROJECT" ? new Date() : null, disabledReason: body.action === "DISABLE_PROJECT" ? body.reason : null } });
      organizationId = project.organizationId ?? undefined;
    } else {
      const delivery = await db.webhookDelivery.findUnique({ where: { id: body.targetId }, include: { endpoint: { include: { project: true } } } });
      if (!delivery) return jsonResponse({ error: true, message: "Delivery not found." }, { status: 404 });
      organizationId = delivery.endpoint.project.organizationId ?? undefined;
      await db.webhookDelivery.update({ where: { id: delivery.id }, data: { status: "PENDING", nextAttemptAt: new Date(), deadLetteredAt: null, errorMessage: null } });
      metadata = { accepted: true, deliveryId: delivery.id, status: "PENDING" };
    }
    const audit = await db.adminAuditLog.create({ data: { adminUserId: admin.id, organizationId, action: body.action, targetType: body.action.includes("PROJECT") ? "Project" : body.action.includes("DELIVERY") || body.action.includes("WEBHOOK") ? "WebhookDelivery" : "Organization", targetId: body.targetId, reason: body.reason, metadata: metadata as Prisma.InputJsonValue } });
    if (organizationId) await emitSecurityEvent({ organizationId, eventType: "admin.action", severity: body.action === "DISABLE_PROJECT" ? "HIGH" : "MEDIUM", riskTypes: [], action: body.action, source: "api.admin.actions", metadata: { targetId: body.targetId, auditId: audit.id } });
    return jsonResponse({ ok: true, auditId: audit.id, metadata });
  } catch (error) { return apiError(error, "Admin action failed."); }
}
