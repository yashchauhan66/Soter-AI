import { z } from "zod";
import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { requireAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { checkRateLimit } from "@/lib/extension/rateLimiter";

export const dynamic = "force-dynamic";

const schema = z.object({
  reason: z.string().trim().max(500).optional().default("Approved by admin"),
  duration: z.enum(["once", "24h", "destination"]).optional().default("once"),
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

    // Find the approval security event
    const event = await db.securityEvent.findUnique({ where: { id } });
    if (!event) return jsonResponse({ error: true, message: "Approval request not found." }, { status: 404 });
    if (!event.eventType.startsWith("EXTENSION_APPROVAL")) {
      return jsonResponse({ error: true, message: "Not an approval request." }, { status: 400 });
    }

    // Build resolution metadata
    const resolution = {
      resolved: true,
      resolution: "approved",
      resolvedAt: new Date().toISOString(),
      adminUserId: admin.id,
      duration: body.duration,
      reason: body.reason,
      expiresAt: body.duration === "24h"
        ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        : body.duration === "destination"
        ? null  // Scoped to destination, doesn't expire by time
        : null, // One-time, single use
    };

    // Update original event metadata with resolution
    const existingMeta = event.metadata ? (event.metadata as Record<string, unknown>) : {};
    await db.$executeRaw`
      UPDATE "SecurityEvent"
      SET "metadata" = ${JSON.stringify({ ...existingMeta, ...resolution })}::jsonb
      WHERE "id" = ${id}
    `;

    // Record admin audit
    const audit = await db.adminAuditLog.create({
      data: {
        adminUserId: admin.id,
        organizationId: event.organizationId,
        action: "extension_approval_granted",
        targetType: "security_event",
        targetId: id,
        reason: body.reason,
        metadata: { duration: body.duration, resolution: "approved" },
      },
    });

    // Emit security event for the approval
    await db.securityEvent.create({
      data: {
        organizationId: event.organizationId,
        projectId: event.projectId,
        eventType: "EXTENSION_APPROVAL_GRANTED",
        severity: "INFO",
        riskTypes: [],
        action: "APPROVED",
        source: "api.admin.approvals.approve",
        metadata: {
          originalEventId: id,
          adminUserId: admin.id,
          duration: body.duration,
          reason: body.reason,
          resolution,
        },
      },
    });

    return jsonResponse({ ok: true, auditId: audit.id, approvedAt: audit.createdAt.toISOString(), resolution });
  } catch (error) {
    return apiError(error, "Approval could not be recorded.");
  }
}
