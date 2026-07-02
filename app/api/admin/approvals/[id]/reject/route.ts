import { z } from "zod";
import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { requireAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { checkRateLimit } from "@/lib/extension/rateLimiter";

export const dynamic = "force-dynamic";

const schema = z.object({
  reason: z.string().trim().min(1).max(500),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const body = schema.parse(await readJson(request));

    // Rate limit: 120 admin approvals per hour per admin
    const rateLimit = await checkRateLimit("admin-approval", "admin-global", { employeeId: admin.id });
    if (!rateLimit.allowed) {
      return jsonResponse({
        error: true, message: "Too many approval actions. Try again later.",
        retryAfter: rateLimit.retryAfter,
      }, {
        status: 429,
        headers: {
          "Retry-After": String(rateLimit.retryAfter ?? 60),
          "X-RateLimit-Remaining": "0",
        },
      });
    }

    const event = await db.securityEvent.findUnique({ where: { id } });
    if (!event) return jsonResponse({ error: true, message: "Approval request not found." }, { status: 404 });
    if (!event.eventType.startsWith("EXTENSION_APPROVAL")) {
      return jsonResponse({ error: true, message: "Not an approval request." }, { status: 400 });
    }

    // Build rejection metadata
    const resolution = {
      resolved: true,
      resolution: "rejected",
      resolvedAt: new Date().toISOString(),
      adminUserId: admin.id,
      reason: body.reason,
      expiresAt: null, // Rejected permanently
    };

    // Update original event metadata with resolution
    const existingMeta = event.metadata ? (event.metadata as Record<string, unknown>) : {};
    await db.$executeRaw`
      UPDATE "SecurityEvent"
      SET "metadata" = ${JSON.stringify({ ...existingMeta, ...resolution })}::jsonb
      WHERE "id" = ${id}
    `;

    const audit = await db.adminAuditLog.create({
      data: {
        adminUserId: admin.id,
        organizationId: event.organizationId,
        action: "extension_approval_rejected",
        targetType: "security_event",
        targetId: id,
        reason: body.reason,
        metadata: { resolution: "rejected" },
      },
    });

    await db.securityEvent.create({
      data: {
        organizationId: event.organizationId,
        projectId: event.projectId,
        eventType: "EXTENSION_APPROVAL_REJECTED",
        severity: "WARNING",
        riskTypes: [],
        action: "REJECTED",
        source: "api.admin.approvals.reject",
        metadata: {
          originalEventId: id,
          adminUserId: admin.id,
          reason: body.reason,
          resolution,
        },
      },
    });

    return jsonResponse({ ok: true, auditId: audit.id, rejectedAt: audit.createdAt.toISOString(), resolution });
  } catch (error) {
    return apiError(error, "Rejection could not be recorded.");
  }
}
