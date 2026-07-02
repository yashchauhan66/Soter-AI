import crypto from "node:crypto";
import { z } from "zod";
import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { requireAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { parseWebhookEndpoint, hashWebhookSecret, previewWebhookSecret, SIEM_WEBHOOK_EVENT_TYPES, type SiemWebhookEventType } from "@/lib/siem/webhooks";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  organizationId: z.string().trim().min(1).max(200),
  name: z.string().trim().min(1).max(120),
  endpointUrl: z.string().url().max(2000),
  eventTypes: z.array(z.enum(SIEM_WEBHOOK_EVENT_TYPES as unknown as [string, ...string[]])).min(1).max(20),
  maxAttempts: z.number().int().min(1).max(20).default(5),
});

export async function GET(request: Request) {
  try {
    const admin = await requireAdmin();
    const organizationId = new URL(request.url).searchParams.get("organizationId");
    if (!organizationId) return jsonResponse({ error: true, message: "organizationId required." }, { status: 400 });

    const integrations = await db.siemIntegration.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, name: true, endpointUrl: true, provider: true,
        enabled: true, maxAttempts: true, createdAt: true, updatedAt: true,
        _count: { select: { deliveries: true } },
      },
    });

    return jsonResponse({ integrations });
  } catch (error) {
    return apiError(error, "SIEM webhook integrations could not be loaded.");
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const body = createSchema.parse(await readJson(request));

    // SSRF protection: validate URL
    const endpointUrl = parseWebhookEndpoint(body.endpointUrl);
    const endpoint = new URL(endpointUrl);

    // Generate signing secret
    const rawSecret = `siem_${crypto.randomUUID().replace(/-/g, "")}`;
    const secretHash = hashWebhookSecret(rawSecret);
    const secretPreview = previewWebhookSecret(rawSecret);

    const webhookConfig = JSON.stringify({
      eventTypes: body.eventTypes,
      secretHash,
      secretPreview,
      createdAt: new Date().toISOString(),
    });

    const integration = await db.siemIntegration.create({
      data: {
        organizationId: body.organizationId,
        provider: "webhook",
        name: body.name,
        endpointUrl: endpoint.toString(),
        encryptedToken: webhookConfig,
        enabled: true,
        maxAttempts: body.maxAttempts,
      },
    });

    // Audit
    await db.adminAuditLog.create({
      data: {
        adminUserId: admin.id,
        organizationId: body.organizationId,
        action: "siem_webhook_created",
        targetType: "siem_integration",
        targetId: integration.id,
        reason: `Created SIEM webhook: ${body.name}`,
        metadata: { name: body.name, endpointHost: endpoint.hostname, eventTypes: body.eventTypes },
      },
    });

    return jsonResponse({
      ok: true,
      integration: { id: integration.id, name: integration.name, endpointUrl: integration.endpointUrl },
      signingSecret: rawSecret,
      message: "Save this signing secret now. It will not be shown again.",
    }, { status: 201 });
  } catch (error) {
    return apiError(error, "SIEM webhook could not be created.");
  }
}
