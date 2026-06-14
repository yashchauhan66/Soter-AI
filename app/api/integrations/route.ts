import { z } from "zod";
import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { requirePermission } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { redactIntegrationPayload } from "@/lib/integrations/marketplace";

export const dynamic = "force-dynamic";

const integrationSchema = z.object({
  organizationId: z.string().min(1),
  provider: z.enum(["SLACK", "MS_TEAMS", "JIRA", "GITHUB"]),
  name: z.string().min(1).max(100),
  encryptedConfig: z.record(z.unknown()),
  events: z.array(z.string().min(1).max(100)).default([]),
});

export async function GET(request: Request) {
  try {
    const organizationId = new URL(request.url).searchParams.get("organizationId");
    if (!organizationId) return jsonResponse({ error: true, message: "organizationId is required." }, { status: 400 });
    await requirePermission(organizationId, "webhook:update");
    const integrations = await db.integration.findMany({
      where: { organizationId },
      select: { id: true, provider: true, name: true, enabled: true, events: true, lastUsedAt: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    return jsonResponse(integrations);
  } catch (error) {
    return apiError(error, "Integrations could not be loaded.");
  }
}

export async function POST(request: Request) {
  try {
    const body = integrationSchema.parse(await readJson(request));
    const access = await requirePermission(body.organizationId, "webhook:update");
    const integration = await db.integration.upsert({
      where: { organizationId_provider_name: { organizationId: body.organizationId, provider: body.provider, name: body.name } },
      update: { encryptedConfig: redactIntegrationPayload(body.encryptedConfig), events: body.events, enabled: true },
      create: { organizationId: body.organizationId, provider: body.provider, name: body.name, encryptedConfig: redactIntegrationPayload(body.encryptedConfig), events: body.events },
    });
    await db.organizationAuditLog.create({
      data: {
        organizationId: body.organizationId,
        actorUserId: access.user.id,
        action: "integration_saved",
        category: "integrations",
        metadata: { integrationId: integration.id, provider: integration.provider, events: integration.events },
      },
    });
    return jsonResponse({ id: integration.id, provider: integration.provider, name: integration.name }, { status: 201 });
  } catch (error) {
    return apiError(error, "Integration could not be saved.");
  }
}
