import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { requireProjectPermission } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { z } from "zod";

export const dynamic = "force-dynamic";

const schema = z.object({ deliveryId: z.string().min(1) });

export async function POST(request: Request) {
  
  try {
    const body = schema.parse(await readJson(request));
    const delivery = await db.webhookDelivery.findUnique({
      where: { id: body.deliveryId },
      include: { endpoint: true },
    });
    if (!delivery) return jsonResponse({ error: true, message: "Delivery not found." }, { status: 404 });
    await requireProjectPermission(delivery.endpoint.projectId, "webhook:update");
    // Reset attempt count for manual replay so backoff doesn't immediately kill it.
    await db.webhookDelivery.update({
      where: { id: delivery.id },
      data: { status: "PENDING", nextAttemptAt: new Date(), deadLetteredAt: null, errorMessage: null },
    });
    return jsonResponse({ accepted: true, deliveryId: delivery.id, status: "PENDING" }, { status: 202 });
  } catch (error) {
    return apiError(error, "Replay failed.");
  }
}
