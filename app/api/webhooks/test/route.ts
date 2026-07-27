import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { requireProjectPermission } from "@/lib/auth/guards";
import { findWebhookEndpointForCurrentUser } from "@/lib/webhooks/access";
import { enqueueWebhook } from "@/lib/webhooks/delivery";
import { getEndpointSecret } from "@/lib/webhooks/store";
import { z } from "zod";

export async function POST(request: Request) {
  try {
    const body = z.object({ id: z.string().min(1) }).parse(await readJson(request));
    const scoped = await findWebhookEndpointForCurrentUser(body.id);
    if (!scoped.endpoint) return jsonResponse({ error: true, message: "Webhook not found." }, { status: 404 });
    await requireProjectPermission(scoped.endpoint.projectId, "webhook:update");
    const secret = await getEndpointSecret(scoped.endpoint.id);
    if (!secret) {
      return jsonResponse({
        error: true,
        message: "Signing secret is no longer available in this server process. Rotate the secret to generate a new one and store it.",
      }, { status: 409 });
    }
    const enqueued = await enqueueWebhook({
      endpointId: scoped.endpoint.id,
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
