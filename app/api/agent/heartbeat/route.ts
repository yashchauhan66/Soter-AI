import { z } from "zod";
import { agentIdentitySchema, apiError, authenticateAgentJson, jsonResponse, readJson, upsertDeviceHeartbeat } from "../_shared";
import { db } from "@/lib/db";
import { lockdownPolicy } from "@/lib/extension/emergencyLockdown";

export const dynamic = "force-dynamic";

const schema = agentIdentitySchema.extend({
  policyVersion: z.string().trim().max(200).optional(),
  status: z.enum(["active", "offline", "degraded"]).default("active"),
  activeDestination: z.string().trim().max(200).optional(),
});

/**
 * Enhanced heartbeat endpoint with push-based lockdown sync.
 *
 * Returns:
 * - `lockdownChanged`: true when the emergency policy version is newer than
 *   what the extension last reported.
 * - `lockdownPolicy`: the full lockdown policy object when lockdown is active,
 *   so the extension can enforce it immediately.
 * - `emergencyPolicyVersion`: the current lockdown policy version number.
 *
 * This allows extensions to detect lockdown state changes within one heartbeat
 * cycle (default ~5 minutes in normal mode, configurable to shorter intervals
 * during active lockdown by the extension itself).
 */
export async function POST(request: Request) {
  try {
    const body = schema.parse(await readJson(request));
    const auth = await authenticateAgentJson(request, body.organizationId);
    if (!auth.ok) return auth.response;

    const agent = await upsertDeviceHeartbeat(body);

    // ── Push-based lockdown detection ────────────────────────────────
    const lockdownState = await db.emergencyLockdownState.findUnique({
      where: { organizationId: body.organizationId },
      select: { enabled: true, policyVersion: true, reason: true, enabledAt: true },
    });

    const currentLockdownVersion = lockdownState?.policyVersion ?? 1;
    const extensionReportedVersion = body.policyVersion ? parseInt(body.policyVersion, 10) : 0;
    const lockdownChanged = lockdownState?.enabled && currentLockdownVersion > extensionReportedVersion;

    // ── Build response ───────────────────────────────────────────────
    const response: Record<string, unknown> = {
      ok: true,
      agentId: agent.id,
      receivedAt: new Date().toISOString(),
    };

    if (lockdownState?.enabled) {
      // Extension should sync policy immediately
      response.lockdownChanged = lockdownChanged;
      response.emergencyPolicyVersion = currentLockdownVersion;
      response.lockdownPolicy = lockdownPolicy(lockdownState);

      // If lockdown is active, extension should poll more frequently
      // (e.g. every 30 seconds instead of 15 minutes)
      response.recommendedPollIntervalMs = lockdownChanged ? 30_000 : 60_000;
    } else if (lockdownChanged) {
      // Lockdown was just disabled — tell extension to sync to get normal policy
      response.lockdownChanged = true;
      response.emergencyPolicyVersion = 0;
      response.lockdownPolicy = lockdownPolicy(null);
      response.recommendedPollIntervalMs = 60_000;
    }

    return jsonResponse(response);
  } catch (error) {
    return apiError(error, "Agent heartbeat could not be recorded.");
  }
}
