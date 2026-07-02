import { z } from "zod";
import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { requireAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { checkRateLimit } from "@/lib/extension/rateLimiter";

export const dynamic = "force-dynamic";

const schema = z.object({
  organizationId: z.string().trim().min(1).max(200),
});

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const body = schema.parse(await readJson(request));

    // Return current lockdown state for immediate sync
    const lockdownState = await db.emergencyLockdownState.findUnique({
      where: { organizationId: body.organizationId },
      select: {
        enabled: true, policyVersion: true, reason: true,
        enabledAt: true, updatedAt: true,
        enabledByAdmin: { select: { email: true } },
      },
    });

    if (!lockdownState) {
      return jsonResponse({ ok: true, message: "No lockdown state for this organization.", lockdown: null });
    }

    // Audit the sync command
    await db.adminAuditLog.create({
      data: {
        adminUserId: admin.id,
        organizationId: body.organizationId,
        action: "emergency_lockdown_sync_now",
        targetType: "emergency_lockdown_state",
        targetId: "sync-command",
        reason: "Admin triggered immediate lockdown policy sync",
        metadata: { policyVersion: lockdownState.policyVersion },
      },
    });

    return jsonResponse({
      ok: true,
      lockdown: {
        enabled: lockdownState.enabled,
        policyVersion: lockdownState.policyVersion,
        reason: lockdownState.reason,
        enabledAt: lockdownState.enabledAt?.toISOString() ?? null,
        updatedAt: lockdownState.updatedAt.toISOString(),
        enabledBy: lockdownState.enabledByAdmin?.email ?? null,
      },
      message: "Lockdown state returned. Extensions will pick this up on their next heartbeat.",
    });
  } catch (error) {
    return apiError(error, "Lockdown sync command failed.");
  }
}
