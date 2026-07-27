import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { requireProjectPermission } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { findWebhookEndpointForCurrentUser } from "@/lib/webhooks/access";
import { rotateWebhookSecret, WebhookSecretRotationConflictError } from "@/lib/webhooks/store";
import { z } from "zod";

export async function POST(request: Request) {
  try {
    const body = z.object({ id: z.string().min(1) }).parse(await readJson(request));
    const scoped = await findWebhookEndpointForCurrentUser(body.id);
    if (!scoped.endpoint) return jsonResponse({ error: true, message: "Webhook not found." }, { status: 404 });
    const access = await requireProjectPermission(scoped.endpoint.projectId, "webhook:update");
    const rawSecret = await rotateWebhookSecret(scoped.endpoint.id, scoped.endpoint.projectId, scoped.endpoint.secretRotatedAt);
    await db.adminAuditLog.create({
      data: {
        adminUserId: access.user.id,
        organizationId: access.org.id,
        action: "WEBHOOK_SECRET_ROTATED",
        targetType: "WebhookEndpoint",
        targetId: scoped.endpoint.id,
        reason: "Webhook signing secret rotated by authorized workspace member.",
        metadata: { projectId: scoped.endpoint.projectId, adminOverride: scoped.adminOverride },
      },
    });
    return jsonResponse({ id: scoped.endpoint.id, signingSecret: rawSecret });
  } catch (error) {
    if (error instanceof WebhookSecretRotationConflictError) {
      return jsonResponse({ error: true, message: error.message }, { status: 409 });
    }
    return apiError(error, "Webhook secret could not be rotated.");
  }
}
