import { apiError, jsonResponse } from "@/lib/apiResponse";
import { requireAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const integration = await db.siemIntegration.findUnique({ where: { id } });
    if (!integration || integration.provider !== "webhook") return jsonResponse({ error: true, message: "Webhook not found." }, { status: 404 });
    const result = await db.siemDelivery.updateMany({
      where: { integrationId: id, status: { in: ["FAILED", "RETRYING"] } },
      data: { status: "PENDING", nextAttemptAt: new Date(), errorMessage: null },
    });
    await db.adminAuditLog.create({
      data: {
        adminUserId: admin.id,
        organizationId: integration.organizationId,
        action: "siem_webhook_retry_requested",
        targetType: "siem_integration",
        targetId: id,
        reason: "Retry failed SIEM webhook deliveries",
        metadata: { deliveryCount: result.count },
      },
    });
    return jsonResponse({ ok: true, retryCount: result.count });
  } catch (error) {
    return apiError(error, "SIEM webhook deliveries could not be retried.");
  }
}
