import { z } from "zod";
import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { requireOrganizationAccess, requirePermission } from "@/lib/auth/guards";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const securitySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("save_ip_allowlist"), organizationId: z.string().min(1), enabled: z.boolean(), entries: z.array(z.object({ cidr: z.string().min(3).max(64), label: z.string().max(100).optional() })).max(100) }),
  z.object({ action: z.literal("save_api_key_rotation"), organizationId: z.string().min(1), days: z.number().int().min(1).max(365).nullable() }),
  z.object({ action: z.literal("revoke_session"), organizationId: z.string().min(1), sessionId: z.string().min(1) }),
  z.object({ action: z.literal("force_api_key_rotation"), organizationId: z.string().min(1), projectId: z.string().min(1) }),
  z.object({ action: z.literal("disable_project"), organizationId: z.string().min(1), projectId: z.string().min(1), reason: z.string().min(3).max(500) }),
  z.object({ action: z.literal("disable_organization"), organizationId: z.string().min(1), reason: z.string().min(3).max(500) }),
  z.object({ action: z.literal("quota_override"), organizationId: z.string().min(1), quota: z.number().int().min(0).nullable() }),
]);

export async function GET(request: Request) {
  try {
    const organizationId = new URL(request.url).searchParams.get("organizationId");
    if (!organizationId) return jsonResponse({ error: true, message: "organizationId is required." }, { status: 400 });
    await requirePermission(organizationId, "member:manage");
    const [organization, allowlist, sessions, auditLogs] = await Promise.all([
      db.organization.findUnique({ where: { id: organizationId }, select: { id: true, name: true, ipAllowlistEnabled: true, apiKeyRotationDays: true, quotaOverride: true, disabled: true, disabledReason: true } }),
      db.ipAllowlistEntry.findMany({ where: { organizationId }, orderBy: { createdAt: "desc" } }),
      db.userSession.findMany({ where: { organizationId }, orderBy: { createdAt: "desc" }, take: 50 }),
      db.organizationAuditLog.findMany({ where: { organizationId }, orderBy: { createdAt: "desc" }, take: 50 }),
    ]);
    return jsonResponse({ organization, allowlist, sessions, auditLogs });
  } catch (error) {
    return apiError(error, "Enterprise security settings could not be loaded.");
  }
}

export async function POST(request: Request) {
  try {
    const body = securitySchema.parse(await readJson(request));
    const access = await requireOrganizationAccess(body.organizationId);
    if (!["OWNER", "ADMIN"].includes(access.role) && !access.user.isAdmin) {
      return jsonResponse({ error: true, message: "Owner or admin role required." }, { status: 403 });
    }

    if (body.action === "save_ip_allowlist") {
      await db.$transaction([
        db.organization.update({ where: { id: body.organizationId }, data: { ipAllowlistEnabled: body.enabled } }),
        db.ipAllowlistEntry.deleteMany({ where: { organizationId: body.organizationId } }),
        ...body.entries.map((entry) => db.ipAllowlistEntry.create({ data: { organizationId: body.organizationId, cidr: entry.cidr, label: entry.label } })),
      ]);
    }
    if (body.action === "save_api_key_rotation") {
      await db.organization.update({ where: { id: body.organizationId }, data: { apiKeyRotationDays: body.days } });
    }
    if (body.action === "revoke_session") {
      await db.userSession.updateMany({ where: { id: body.sessionId, organizationId: body.organizationId }, data: { revokedAt: new Date() } });
    }
    if (body.action === "force_api_key_rotation") {
      const project = await db.project.findFirst({ where: { id: body.projectId, organizationId: body.organizationId } });
      if (!project) return jsonResponse({ error: true, message: "Project not found." }, { status: 404 });
      await db.apiKey.updateMany({ where: { projectId: project.id }, data: { isActive: false } });
    }
    if (body.action === "disable_project") {
      await db.project.updateMany({ where: { id: body.projectId, organizationId: body.organizationId }, data: { disabledAt: new Date(), disabledReason: body.reason } });
    }
    if (body.action === "disable_organization") {
      if (access.role !== "OWNER" && !access.user.isAdmin) return jsonResponse({ error: true, message: "Only owners can disable an organization." }, { status: 403 });
      await db.organization.update({ where: { id: body.organizationId }, data: { disabled: true, disabledReason: body.reason } });
    }
    if (body.action === "quota_override") {
      await db.organization.update({ where: { id: body.organizationId }, data: { quotaOverride: body.quota } });
    }

    await db.organizationAuditLog.create({
      data: {
        organizationId: body.organizationId,
        actorUserId: access.user.id,
        action: body.action,
        category: "enterprise_security",
        metadata: body,
      },
    });
    return jsonResponse({ ok: true });
  } catch (error) {
    return apiError(error, "Enterprise security action could not be applied.");
  }
}
