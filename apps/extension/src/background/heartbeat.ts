import { SOTER_EXTENSION_VERSION } from "../../../../packages/shared/src/constants";
import type { ExtensionHeartbeat } from "../../../../packages/shared/src/audit-types";
import { SoterExtensionApiClient } from "../lib/api-client";
import { getState, setState } from "../lib/storage";
import { syncPolicy, configurePolicySyncAlarm } from "./policy-sync";
import { computeIntegrityReport } from "./integrity";

export function browserName(): ExtensionHeartbeat["browser"] {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("edg/")) return "edge";
  if (ua.includes("chrome/")) return "chrome";
  return "unknown";
}

export async function sendHeartbeat(domain?: string) {
  const state = await getState();

  // Guard: Never send heartbeats over the wire if not enrolled or missing credentials
  if (state.enrollmentStatus && state.enrollmentStatus !== "enrolled") {
    return;
  }
  if (!state.config.organizationId || !state.config.deviceToken) {
    return;
  }

  const integrity = await computeIntegrityReport(state);
  const heartbeat: ExtensionHeartbeat = {
    organizationId: state.config.organizationId,
    employeeId: state.config.employeeId,
    extensionVersion: SOTER_EXTENSION_VERSION,
    browser: browserName(),
    policyVersion: state.policy?.version ?? "unknown",
    domain,
    lastActiveAt: new Date().toISOString(),
    lockdownEnabled: state.policy?.emergencyLockdown?.enabled ?? false,
    integrity,
  };
  try {
    const response = await new SoterExtensionApiClient(state.config).heartbeat(heartbeat);
    await setState({ lastHeartbeatAt: heartbeat.lastActiveAt });
    if (response.shortPollingSeconds) configurePolicySyncAlarm(response.shortPollingSeconds);
    if (response.lockdownChanged) await syncPolicy();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("401")) {
      await setState({ enrollmentStatus: "expired", policySyncStatus: "offline" });
    } else {
      await setState({ policySyncStatus: "offline" });
    }
  }
}
