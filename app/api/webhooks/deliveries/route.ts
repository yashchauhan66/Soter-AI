import { apiError, jsonResponse } from "@/lib/apiResponse";
import { requireProjectPermission } from "@/lib/auth/guards";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const endpointId = params.get("endpointId");
    if (!endpointId) return jsonResponse({ error: true, message: "endpointId required." }, { status: 400 });
    const endpoint = await db.webhookEndpoint.findUnique({ where: { id: endpointId } });
    if (!endpoint) return jsonResponse({ error: true, message: "Webhook not found." }, { status: 404 });
    await requireProjectPermission(endpoint.projectId, "webhook:update");
    const cursor = params.get("cursor");
    const limitValue = Number(params.get("limit") ?? 50);
    const limit = Number.isFinite(limitValue) ? Math.min(100, Math.max(10, limitValue)) : 50;
    const deliveries = await db.webhookDelivery.findMany({
      where: { endpointId, ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}) },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        endpointId: true,
        event: true,
        status: true,
        responseCode: true,
        attempts: true,
        errorMessage: true,
        payloadHash: true,
        idempotencyKey: true,
        nextAttemptAt: true,
        deliveredAt: true,
        deadLetteredAt: true,
        createdAt: true,
      },
    });
    
    return jsonResponse(deliveries);
  } catch (error) { return apiError(error, "Webhook deliveries could not be loaded."); }
}
