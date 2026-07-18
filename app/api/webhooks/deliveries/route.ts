import { apiError, jsonResponse } from "@/lib/apiResponse";
import { requireProjectPermission } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { eventStoreFlags, listWebhookDeliveryEvents } from "@/lib/events/store";
import { findWebhookEndpointForCurrentUser } from "@/lib/webhooks/access";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const endpointId = params.get("endpointId");
    if (!endpointId) return jsonResponse({ error: true, message: "endpointId required." }, { status: 400 });
    const scoped = await findWebhookEndpointForCurrentUser(endpointId);
    if (!scoped.endpoint) return jsonResponse({ error: true, message: "Webhook not found." }, { status: 404 });
    await requireProjectPermission(scoped.endpoint.projectId, "webhook:update");
    const scopedEndpointId = scoped.endpoint.id;
    const cursor = params.get("cursor");
    const limitValue = Number(params.get("limit") ?? 50);
    const limit = Number.isFinite(limitValue) ? Math.min(100, Math.max(10, limitValue)) : 50;
    if (eventStoreFlags().enabled) {
      try {
        const page = await listWebhookDeliveryEvents(scopedEndpointId, { cursor, limit });
        if (page.items.length || !eventStoreFlags().readFallbackPostgres) {
          return jsonResponse(page.items.map((event) => ({
              id: event.targetId ?? event.id,
              endpointId: scopedEndpointId,
              event: event.action ?? "webhook.delivery",
              status: event.status ?? "RECORDED",
              responseCode: event.httpStatus ?? null,
              attempts: Number(event.metadata?.attempts ?? 0),
              errorMessage: event.errorMessage ?? null,
              payloadHash: String(event.metadata?.payloadHash ?? ""),
              idempotencyKey: String(event.metadata?.idempotencyKey ?? ""),
              nextAttemptAt: null,
              deliveredAt: event.status === "DELIVERED" ? event.createdAt : null,
              deadLetteredAt: event.status === "DEAD_LETTER" ? event.createdAt : null,
              createdAt: event.createdAt,
            })));
        }
      } catch (error) {
        if (!eventStoreFlags().readFallbackPostgres) throw error;
        console.error("[SoterAI] DynamoDB webhook delivery read failed; falling back to PostgreSQL", error);
      }
    }
    const deliveries = await db.webhookDelivery.findMany({
      where: { endpointId: scopedEndpointId, ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}) },
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
