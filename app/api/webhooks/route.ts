import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { requireProjectPermission, getActiveOrganization } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { webhookCreateSchema, webhookUpdateSchema } from "@/lib/validations";
import { findWebhookEndpointForCurrentUser, WEBHOOK_ENDPOINT_SAFE_SELECT } from "@/lib/webhooks/access";
import { createWebhookEndpoint } from "@/lib/webhooks/store";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const active = await getActiveOrganization();
    if (!active) return jsonResponse([]);
    const projectId = new URL(request.url).searchParams.get("projectId") ?? undefined;
    const endpoints = await db.webhookEndpoint.findMany({
      where: {
        project: { organizationId: active.org.id },
        ...(projectId ? { projectId } : {}),
      },
      select: {
        ...WEBHOOK_ENDPOINT_SAFE_SELECT,
        project: { select: { name: true } },
        _count: { select: { deliveries: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return jsonResponse(endpoints);
  } catch (error) { return apiError(error, "Webhooks could not be loaded."); }
}

export async function POST(request: Request) {
  try {
    const body = webhookCreateSchema.parse(await readJson(request));
    const access = await requireProjectPermission(body.projectId, "webhook:create");
    const { endpoint, rawSecret } = await createWebhookEndpoint({
      projectId: access.project.id,
      url: body.url,
      description: body.description,
      events: body.events,
    });
    await db.onboardingProgress.upsert({
      where: { userId: access.user.id },
      create: { userId: access.user.id, webhookConfigured: true },
      update: { webhookConfigured: true },
    });
    return jsonResponse({
      id: endpoint.id,
      projectId: endpoint.projectId,
      url: endpoint.url,
      description: endpoint.description,
      events: endpoint.events,
      isActive: endpoint.isActive,
      secretPreview: endpoint.secretPreview,
      secretRotatedAt: endpoint.secretRotatedAt?.toISOString() ?? null,
      createdAt: endpoint.createdAt.toISOString(),
      updatedAt: endpoint.updatedAt.toISOString(),
      signingSecret: rawSecret,
    }, { status: 201 });
  } catch (error) { return apiError(error, "Webhook could not be created."); }
}

export async function PATCH(request: Request) {
  try {
    const body = webhookUpdateSchema.parse(await readJson(request));
    const scoped = await findWebhookEndpointForCurrentUser(body.id);
    if (!scoped.endpoint) return jsonResponse({ error: true, message: "Webhook not found." }, { status: 404 });
    await requireProjectPermission(scoped.endpoint.projectId, "webhook:update");
    const updated = await db.webhookEndpoint.update({
      where: { id: scoped.endpoint.id },
      data: {
        url: body.url ?? undefined,
        description: body.description ?? undefined,
        events: body.events ?? undefined,
        isActive: typeof body.isActive === "boolean" ? body.isActive : undefined,
      },
      select: WEBHOOK_ENDPOINT_SAFE_SELECT,
    });
    return jsonResponse(updated);
  } catch (error) { return apiError(error, "Webhook could not be updated."); }
}

export async function DELETE(request: Request) {
  try {
    const body = z.object({ id: z.string().min(1) }).parse(await readJson(request));
    const scoped = await findWebhookEndpointForCurrentUser(body.id);
    if (!scoped.endpoint) return jsonResponse({ error: true, message: "Webhook not found." }, { status: 404 });
    await requireProjectPermission(scoped.endpoint.projectId, "webhook:delete");
    await db.webhookEndpoint.delete({ where: { id: scoped.endpoint.id } });
    return jsonResponse({ ok: true });
  } catch (error) { return apiError(error, "Webhook could not be deleted."); }
}
