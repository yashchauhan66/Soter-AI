import { z } from "zod";
import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { authenticateExtensionRequest, recordExtensionSecurityEvent } from "../_shared";
import { db } from "@/lib/db";
import { getEmergencyLockdown } from "@/lib/extension/emergencyLockdown";

export const dynamic = "force-dynamic";

const heartbeatSchema = z.object({
  organizationId: z.string().trim().min(1).max(200),
  employeeId: z.string().trim().max(200).optional(),
  extensionVersion: z.string().trim().min(1).max(40),
  browser: z.enum(["chrome", "edge", "unknown"]),
  policyVersion: z.string().trim().min(1).max(200),
  domain: z.string().trim().max(300).optional(),
  lastActiveAt: z.string().datetime(),
  lockdownEnabled: z.boolean().optional().default(false),
});

export async function POST(request: Request) {
  try {
    const body = heartbeatSchema.parse(await readJson(request));
    const auth = await authenticateExtensionRequest(request, body.organizationId);
    if (!auth.ok) return auth.response;
    const event = await recordExtensionSecurityEvent({
      organizationId: body.organizationId,
      projectId: "projectId" in auth ? auth.projectId : undefined,
      eventType: "EXTENSION_HEARTBEAT",
      severity: "info",
      action: "allow",
      source: "browser_extension",
      riskTypes: [],
      metadata: {
        employeeId: body.employeeId,
        extensionVersion: body.extensionVersion,
        browser: body.browser,
        policyVersion: body.policyVersion,
        domain: body.domain,
        lastActiveAt: body.lastActiveAt,
        lockdownEnabled: body.lockdownEnabled,
      },
    });
    if ("deviceId" in auth) {
      await db.deviceAgent.update({
        where: { id: auth.deviceId },
        data: { lastHeartbeatAt: new Date(body.lastActiveAt), policyVersion: body.policyVersion, lockdownEnabled: body.lockdownEnabled },
      });
    }
    const lockdown = await getEmergencyLockdown(body.organizationId);
    const emergencyPolicyVersion = lockdown.policyVersion;
    const reportedVersion = Number((body.policyVersion.match(/emergency-(\d+)/)?.[1] ?? "").trim());
    const lockdownChanged = Number.isFinite(reportedVersion) ? reportedVersion !== emergencyPolicyVersion : Boolean(lockdown.enabled) !== body.lockdownEnabled;
    return jsonResponse({
      ok: true,
      heartbeatId: event?.id ?? null,
      receivedAt: new Date().toISOString(),
      lockdownChanged,
      emergencyPolicyVersion,
      shortPollingSeconds: lockdown.enabled ? 30 : 300,
    });
  } catch (error) {
    return apiError(error, "Extension heartbeat could not be recorded.");
  }
}
