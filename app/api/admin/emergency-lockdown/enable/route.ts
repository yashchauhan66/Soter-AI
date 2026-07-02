import { z } from "zod";
import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { requireAdmin } from "@/lib/auth/guards";
import { setEmergencyLockdown } from "@/lib/extension/emergencyLockdown";
import { checkRateLimit } from "@/lib/extension/rateLimiter";

const schema = z.object({ organizationId: z.string().trim().min(1).max(200), reason: z.string().trim().max(500).optional() });

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const body = schema.parse(await readJson(request));
    const limit = await checkRateLimit("emergency-lockdown", body.organizationId, { employeeId: admin.id });
    if (!limit.allowed) return jsonResponse({ error: true, message: "Too many lockdown changes. Try again later." }, { status: 429 });
    return jsonResponse({ ok: true, state: await setEmergencyLockdown({ ...body, enabled: true, adminId: admin.id }) });
  } catch (error) {
    return apiError(error, "Emergency lockdown could not be enabled.");
  }
}
