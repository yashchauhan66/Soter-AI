import { z } from "zod";
import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { requireAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { SIEM_WEBHOOK_EVENT_TYPES } from "@/lib/siem/webhooks";

export const dynamic = "force-dynamic";
// Note: This route is already force-dynamic above. No additional changes needed.

const patchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  endpointUrl: z.string().url().max(2000).optional(),
  eventTypes: z.array(z.enum(SIEM_WEBHOOK_EVENT_TYPES as unknown as [string, ...string[]])).min(1).max(20).optional(),
  enabled: z.boolean().optional(),
  maxAttempts: z.number().int().min(1).max(20).optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const body = patchSchema.parse(await readJson(request));
    const { id } = await params;

    const existing = await db.siemIntegration.findUnique({ where: { id } });
    if (!existing) return jsonResponse({ error: true, message: "Integration not found." }, { status: 404 });

    const updateData: Record<string, unknown> = { ...body };

    // If endpoint URL changed, re-validate with SSRF protection
    if (body.endpointUrl) {
      const { parseWebhookEndpoint } = await import("@/lib/siem/webhooks");
      const parsed = parseWebhookEndpoint(body.endpointUrl);
      updateData.endpointUrl = parsed.toString();
    }

    // If event types changed, update the config blob
    if (body.eventTypes) {
      const config = existing.encryptedToken ? JSON.parse(existing.encryptedToken) : {};
      config.eventTypes = body.eventTypes;
      updateData.encryptedToken = JSON.stringify(config);
    }

    const updated = await db.siemIntegration.update({
      where: { id },
      data: updateData,
    });

    await db.adminAuditLog.create({
      data: {
        adminUserId: admin.id,
        organizationId: existing.organizationId,
        action: "siem_webhook_updated",
        targetType: "siem_integration",
        targetId: id,
        reason: `Updated SIEM webhook: ${existing.name}`,
        metadata: { changes: Object.keys(body) },
      },
    });

    return jsonResponse({ ok: true, integration: updated });
  } catch (error) {
    return apiError(error, "SIEM webhook could not be updated.");
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;

    const existing = await db.siemIntegration.findUnique({ where: { id } });
    if (!existing) return jsonResponse({ error: true, message: "Integration not found." }, { status: 404 });

    await db.siemIntegration.delete({ where: { id } });

    await db.adminAuditLog.create({
      data: {
        adminUserId: admin.id,
        organizationId: existing.organizationId,
        action: "siem_webhook_deleted",
        targetType: "siem_integration",
        targetId: id,
        reason: `Deleted SIEM webhook: ${existing.name}`,
        metadata: { name: existing.name },
      },
    });

    return jsonResponse({ ok: true });
  } catch (error) {
    return apiError(error, "SIEM webhook could not be deleted.");
  }
}
