import { apiError, jsonResponse } from "@/lib/apiResponse";
import { requireAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { signWebhookPayload, redactedWebhookPayload } from "@/lib/siem/webhooks";
import { assertPublicOutboundUrl } from "@/lib/network/outboundUrl";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;

    const integration = await db.siemIntegration.findUnique({ where: { id } });
    if (!integration) return jsonResponse({ error: true, message: "Integration not found." }, { status: 404 });
    if (!integration.enabled) return jsonResponse({ error: true, message: "Integration is disabled." }, { status: 400 });

    // Build a test event
    const testEvent = {
      id: `test_${crypto.randomUUID()}`,
      organizationId: integration.organizationId,
      projectId: null,
      eventType: "SIEM_TEST" as string,
      severity: "INFO" as string,
      riskTypes: [] as string[],
      action: "TEST" as string,
      source: "admin.siem-webhook-test",
      createdAt: new Date(),
      metadata: { test: true, sentBy: admin.id },
    };

    const payload = redactedWebhookPayload(testEvent);
    const body = JSON.stringify(payload);

    // Parse config to get signing secret hash
    const config = integration.encryptedToken ? JSON.parse(integration.encryptedToken) : {};
    const timestamp = Math.floor(Date.now() / 1000);
    const signed = config.secretHash ? signWebhookPayload(body, config.secretHash, timestamp) : null;

    let result: { ok: boolean; status: number };
    try {
      const endpoint = await assertPublicOutboundUrl(integration.endpointUrl);
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-soter-test": "true",
          ...(signed ? { "x-soter-timestamp": String(signed.timestamp), "x-soter-signature": signed.signature } : {}),
        },
        body,
        signal: AbortSignal.timeout(10_000),
      });
      result = { ok: response.ok, status: response.status };
    } catch (fetchError) {
      result = { ok: false, status: 0 };
      return jsonResponse({
        ok: false,
        delivered: false,
        error: fetchError instanceof Error ? fetchError.message : "Connection failed",
      });
    }

    // Log the delivery attempt
    const testDelivery = await db.siemDelivery.create({
      data: {
        integrationId: id,
        eventId: testEvent.id as string,
        status: result.ok ? "DELIVERED" : "FAILED",
        attempts: 1,
        responseCode: result.status,
        errorMessage: result.ok ? null : `HTTP ${result.status}`,
        deliveredAt: result.ok ? new Date() : null,
      },
    });

    return jsonResponse({ ok: result.ok, delivered: result.ok, deliveryId: testDelivery.id, statusCode: result.status });
  } catch (error) {
    return apiError(error, "SIEM webhook test failed.");
  }
}
