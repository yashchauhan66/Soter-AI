import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { requireProjectPermission } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { findWebhookDeliveryForCurrentUser } from "@/lib/webhooks/access";
import { z } from "zod";

export const dynamic = "force-dynamic";

const schema = z.object({ deliveryId: z.string().min(1) });

export async function POST(request: Request) {
  
  try {
    const body = schema.parse(await readJson(request));
    const scoped = await findWebhookDeliveryForCurrentUser(body.deliveryId);
    const delivery = scoped.delivery;
    if (!delivery) return jsonResponse({ error: true, message: "Delivery not found." }, { status: 404 });
    await requireProjectPermission(delivery.endpoint.projectId, "webhook:update");
    // Reset attempt count for manual replay so backoff doesn't immediately kill it.
    // CRG-RT-012: without resetting attempts, a DEAD_LETTER delivery (attempts ==
    // MAX_ATTEMPTS) would re-dead-letter on the first replay attempt because
    // attemptNumber = attempts + 1 already exceeds the limit — the replay would
    // never actually re-send.
    const updated = await db.webhookDelivery.updateMany({
      where: { id: delivery.id },
      data: { status: "PENDING", attempts: 0, nextAttemptAt: new Date(), deadLetteredAt: null, errorMessage: null },
    });
    if (updated.count !== 1) return jsonResponse({ error: true, message: "Delivery not found." }, { status: 404 });
    return jsonResponse({ accepted: true, deliveryId: delivery.id, status: "PENDING" }, { status: 202 });
  } catch (error) {
    return apiError(error, "Replay failed.");
  }
}
