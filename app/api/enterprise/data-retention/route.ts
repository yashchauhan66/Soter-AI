import { z } from "zod";
import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { getActiveOrganization, requirePermission } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { applyRetentionPolicy } from "@/lib/retention/policy";

export const dynamic = "force-dynamic";

const policySchema = z.object({
  organizationId: z.string().min(1),
  window: z.enum(["DAYS_7", "DAYS_30", "DAYS_90", "DAYS_180", "DAYS_365", "CUSTOM"]),
  customDays: z.number().int().min(1).max(3650).optional(),
  applyToLogs: z.boolean().default(true),
  applyToWebhookDeliveries: z.boolean().default(false),
  applyToSecurityEvents: z.boolean().default(false),
});

export async function GET(request: Request) {
  try {
    const organizationId = new URL(request.url).searchParams.get("organizationId");
    const active = organizationId ? null : await getActiveOrganization();
    const orgId = organizationId ?? active?.org.id;
    if (!orgId) return jsonResponse({ error: true, message: "organizationId is required." }, { status: 400 });
    await requirePermission(orgId, "member:manage");
    const policy = await db.retentionPolicy.findUnique({ where: { organizationId: orgId } });
    const deletionRequests = await db.dataDeletionRequest.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    return jsonResponse({ policy, deletionRequests });
  } catch (error) {
    return apiError(error, "Data retention settings could not be loaded.");
  }
}

export async function PUT(request: Request) {
  try {
    const body = policySchema.parse(await readJson(request));
    const access = await requirePermission(body.organizationId, "member:manage");
    if (body.window === "CUSTOM" && !body.customDays) {
      return jsonResponse({ error: true, message: "customDays is required for custom retention." }, { status: 400 });
    }
    const policy = await db.retentionPolicy.upsert({
      where: { organizationId: body.organizationId },
      update: {
        window: body.window,
        customDays: body.window === "CUSTOM" ? body.customDays : null,
        applyToLogs: body.applyToLogs,
        applyToWebhookDeliveries: body.applyToWebhookDeliveries,
        applyToSecurityEvents: body.applyToSecurityEvents,
      },
      create: {
        organizationId: body.organizationId,
        window: body.window,
        customDays: body.window === "CUSTOM" ? body.customDays : null,
        applyToLogs: body.applyToLogs,
        applyToWebhookDeliveries: body.applyToWebhookDeliveries,
        applyToSecurityEvents: body.applyToSecurityEvents,
      },
    });
    await db.organizationAuditLog.create({
      data: {
        organizationId: body.organizationId,
        actorUserId: access.user.id,
        action: "retention_policy_saved",
        category: "retention",
        metadata: { window: policy.window, customDays: policy.customDays },
      },
    });
    return jsonResponse(policy);
  } catch (error) {
    return apiError(error, "Data retention policy could not be saved.");
  }
}

export async function POST(request: Request) {
  try {
    const body = z.object({ organizationId: z.string().min(1) }).parse(await readJson(request));
    await requirePermission(body.organizationId, "member:manage");
    return jsonResponse(await applyRetentionPolicy(body.organizationId));
  } catch (error) {
    return apiError(error, "Data retention cleanup could not be started.");
  }
}
