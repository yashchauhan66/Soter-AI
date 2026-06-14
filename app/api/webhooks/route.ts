import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { requireProjectPermission, getActiveOrganization } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { webhookCreateSchema, webhookUpdateSchema } from "@/lib/validations";
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
      include: {
        project: { select: { name: true } },
        _count: { select: { deliveries: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return jsonResponse(endpoints.map(({ secretHash: _hash, ...rest }) => rest));
  } catch (error) { return apiError(error, "Webhooks could not be loaded."); }
}

export async function POST(request: Request) {
  try {
    const body = webhookCreateSchema.parse(await readJson(request));
    const access = await requireProjectPermission(body.projectId, "webhook:create");
    const { endpoint, rawSecret } = await createWebhookEndpoint({
      projectId: body.projectId,
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
      url: endpoint.url,
      events: endpoint.events,
      secretPreview: endpoint.secretPreview,
      signingSecret: rawSecret,
    }, { status: 201 });
  } catch (error) { return apiError(error, "Webhook could not be created."); }
}

export async function PATCH(request: Request) {
  try {
    const body = webhookUpdateSchema.parse(await readJson(request));
    const owned = await db.webhookEndpoint.findUnique({ where: { id: body.id } });
    if (!owned) return jsonResponse({ error: true, message: "Webhook not found." }, { status: 404 });
    await requireProjectPermission(owned.projectId, "webhook:update");
    const updated = await db.webhookEndpoint.update({
      where: { id: body.id },
      data: {
        url: body.url ?? undefined,
        description: body.description ?? undefined,
        events: body.events ?? undefined,
        isActive: typeof body.isActive === "boolean" ? body.isActive : undefined,
      },
    });
    const { secretHash: _hash, ...rest } = updated;
    return jsonResponse(rest);
  } catch (error) { return apiError(error, "Webhook could not be updated."); }
}

export async function DELETE(request: Request) {
  try {
    const body = z.object({ id: z.string().min(1) }).parse(await readJson(request));
    const owned = await db.webhookEndpoint.findUnique({ where: { id: body.id } });
    if (!owned) return jsonResponse({ error: true, message: "Webhook not found." }, { status: 404 });
    await requireProjectPermission(owned.projectId, "webhook:delete");
    await db.webhookEndpoint.delete({ where: { id: body.id } });
    return jsonResponse({ ok: true });
  } catch (error) { return apiError(error, "Webhook could not be deleted."); }
}
