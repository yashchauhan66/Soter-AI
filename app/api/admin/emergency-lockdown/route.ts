import { z } from "zod";
import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { requireAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { getEmergencyLockdown, setEmergencyLockdown } from "@/lib/extension/emergencyLockdown";

export const dynamic = "force-dynamic";

const lockdownRequestSchema = z.object({
  enabled: z.boolean(),
  reason: z.string().max(500).nullable().optional(),
});

/**
 * GET /api/admin/emergency-lockdown
 * Fetch current emergency lockdown state
 */
export async function GET() {
  try {
    await requireAdmin();
    const organization = await db.organization.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } });
    if (!organization) return jsonResponse({ lockdown: { enabled: false, policyVersion: 1, reason: null, enabledAt: null } });
    const lockdown = await getEmergencyLockdown(organization.id);
    return jsonResponse({ lockdown });
  } catch (error) {
    return apiError(error, "Failed to fetch lockdown state");
  }
}

/**
 * POST /api/admin/emergency-lockdown
 * Enable or disable emergency lockdown
 */
export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const organization = await db.organization.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } });
    if (!organization) return jsonResponse({ error: true, message: "Organization not found." }, { status: 404 });
    const body = lockdownRequestSchema.parse(await readJson(request));

    const lockdown = await setEmergencyLockdown({
      organizationId: organization.id,
      enabled: body.enabled,
      adminId: admin.id,
      reason: body.enabled ? body.reason ?? undefined : undefined,
    });

    return jsonResponse({
      ok: true,
      lockdown,
      message: body.enabled ? "Emergency lockdown enabled" : "Emergency lockdown disabled",
    });
  } catch (error) {
    return apiError(error, "Failed to update lockdown state");
  }
}
