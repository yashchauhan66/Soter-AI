import { z } from "zod";
import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { requireAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { checkRateLimit } from "@/lib/extension/rateLimiter";

export const dynamic = "force-dynamic";

const schema = z.object({
  reason: z.string().trim().min(1).max(500),
  redactedPreview: z.string().max(2000).optional(),
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

    // Build redaction resolution metadata
    const resolution = {
      resolved: true,
      resolution: "redaction_required",
      resolvedAt: new Date().toISOString(),
      adminUserId: admin.id,
      reason: body.reason,
      redactedPreview: body.redactedPreview ?? null,
      expiresAt: null, // User must re-submit with redacted content
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
        action: "extension_approval_redacted",
        targetType: "security_event",
        targetId: id,
        reason: body.reason,
        metadata: { resolution: "redaction_required" },
      },
    });

    await db.securityEvent.create({
      data: {
        organizationId: event.organizationId,
        projectId: event.projectId,
        eventType: "EXTENSION_APPROVAL_REDACTION_REQUIRED",
        severity: "MEDIUM",
        riskTypes: [],
        action: "REQUIRE_REDACTION",
        source: "api.admin.approvals.redact",
        metadata: {
          originalEventId: id,
          adminUserId: admin.id,
          reason: body.reason,
          redactedPreview: body.redactedPreview ?? null,
          resolution,
        },
      },
    });

    return jsonResponse({ ok: true, auditId: audit.id, redactedAt: audit.createdAt.toISOString(), resolution });
  } catch (error) {
    return apiError(error, "Redaction requirement could not be recorded.");
  }
}
