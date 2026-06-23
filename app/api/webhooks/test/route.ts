import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { requireProjectPermission } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { enqueueWebhook } from "@/lib/webhooks/delivery";
import { getEndpointSecret } from "@/lib/webhooks/store";
import { z } from "zod";

export async function POST(request: Request) {
  try {
    const body = z.object({ id: z.string().min(1) }).parse(await readJson(request));
    const endpoint = await db.webhookEndpoint.findUnique({ where: { id: body.id } });
    if (!endpoint) return jsonResponse({ error: true, message: "Webhook not found." }, { status: 404 });
    await requireProjectPermission(endpoint.projectId, "webhook:update");
    const secret = await getEndpointSecret(endpoint.id);
    if (!secret) {
      return jsonResponse({
        error: true,
        message: "Signing secret is no longer available in this server process. Rotate the secret to generate a new one and store it.",
      }, { status: 409 });
    }
    const enqueued = await enqueueWebhook({
      endpointId: endpoint.id,
      event: "guard.prompt_injection.blocked",
      payload: {
        test: true,
        message: "This is a SoterAI webhook test event. No real guard log triggered it.",
        sentAt: new Date().toISOString(),
      },
    });
    return jsonResponse({ accepted: true, deliveryId: enqueued.id, status: enqueued.status }, { status: 202 });
  } catch (error) { return apiError(error, "Test webhook could not be sent."); }
}
