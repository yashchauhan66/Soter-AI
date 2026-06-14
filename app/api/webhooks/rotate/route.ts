import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { requireProjectPermission } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { rotateWebhookSecret } from "@/lib/webhooks/store";
import { z } from "zod";

export async function POST(request: Request) {
  try {
    const body = z.object({ id: z.string().min(1) }).parse(await readJson(request));
    const owned = await db.webhookEndpoint.findUnique({ where: { id: body.id } });
    if (!owned) return jsonResponse({ error: true, message: "Webhook not found." }, { status: 404 });
    const access = await requireProjectPermission(owned.projectId, "webhook:update");
    const rawSecret = await rotateWebhookSecret(body.id);
    await db.adminAuditLog.create({
      data: {
        adminUserId: access.user.id,
        organizationId: access.org.id,
        action: "WEBHOOK_SECRET_ROTATED",
        targetType: "WebhookEndpoint",
        targetId: body.id,
        reason: "Webhook signing secret rotated by authorized workspace member.",
        metadata: { projectId: owned.projectId },
      },
    });
    return jsonResponse({ id: body.id, signingSecret: rawSecret });
  } catch (error) { return apiError(error, "Webhook secret could not be rotated."); }
}
