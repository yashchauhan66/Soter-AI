import { z } from "zod";
import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { requireAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { checkRateLimit } from "@/lib/extension/rateLimiter";

export const dynamic = "force-dynamic";

const schema = z.object({
  enabled: z.boolean(),
  reason: z.string().trim().max(500).optional(),
});

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const body = schema.parse(await readJson(request));

    // Rate limit: 10 lockdown toggles per hour per admin
    const rateLimit = await checkRateLimit("emergency-lockdown", "admin-global", { employeeId: admin.id });
    if (!rateLimit.allowed) {
      return jsonResponse({
        error: true, message: "Too many lockdown toggle attempts. Try again later.",
        retryAfter: rateLimit.retryAfter,
      }, {
        status: 429,
        headers: {
          "Retry-After": String(rateLimit.retryAfter ?? 3600),
          "X-RateLimit-Remaining": "0",
        },
      });
    }
    const action = body.enabled ? "emergency_lockdown_enabled" : "emergency_lockdown_disabled";

    // Record the audit log
    const audit = await db.adminAuditLog.create({
      data: {
        adminUserId: admin.id,
        organizationId: null,
        action,
        targetType: "system",
        targetId: "emergency-lockdown-toggle",
        reason: body.reason ?? (body.enabled ? "Emergency lockdown activated by admin" : "Emergency lockdown deactivated by admin"),
        metadata: { enabled: body.enabled },
      },
    });

    // Broadcast security event for all organizations
    const organizations = await db.organization.findMany({
      select: { id: true },
      where: { disabled: false },
    });

    for (const org of organizations) {
      await db.securityEvent.create({
        data: {
          organizationId: org.id,
          eventType: body.enabled ? "EMERGENCY_LOCKDOWN_ENABLED" : "EMERGENCY_LOCKDOWN_DISABLED",
          severity: body.enabled ? "CRITICAL" : "HIGH",
          riskTypes: [],
          action: body.enabled ? "LOCKDOWN" : "NORMAL",
          source: "api.admin.emergency-lockdown",
          metadata: {
            adminUserId: admin.id,
            auditId: audit.id,
            enabled: body.enabled,
            reason: body.reason ?? null,
          },
        },
      });
    }

    return jsonResponse({
      ok: true,
      enabled: body.enabled,
      auditId: audit.id,
      affectedOrganizations: organizations.length,
      action,
    });
  } catch (error) {
    return apiError(error, "Emergency lockdown toggle failed.");
  }
}
