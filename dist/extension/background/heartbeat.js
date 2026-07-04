import { SOTER_EXTENSION_VERSION } from "../packages/shared/src/constants.js";
import { SoterExtensionApiClient } from "../lib/api-client.js";
import { getState, setState } from "../lib/storage.js";
import { syncPolicy, configurePolicySyncAlarm } from "./policy-sync.js";
export function browserName() {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes("edg/"))
        return "edge";
    if (ua.includes("chrome/"))
        return "chrome";
    return "unknown";
}
export async function sendHeartbeat(domain) {
    const state = await getState();
    const heartbeat = {
        organizationId: state.config.organizationId,
        employeeId: state.config.employeeId,
        extensionVersion: SOTER_EXTENSION_VERSION,
        browser: browserName(),
        policyVersion: state.policy?.version ?? "unknown",
        domain,
        lastActiveAt: new Date().toISOString(),
        lockdownEnabled: state.policy?.emergencyLockdown?.enabled ?? false,
    };
    try {
        const response = await new SoterExtensionApiClient(state.config).heartbeat(heartbeat);
        await setState({ lastHeartbeatAt: heartbeat.lastActiveAt });
        if (response.shortPollingSeconds)
            configurePolicySyncAlarm(response.shortPollingSeconds);
        if (response.lockdownChanged)
            await syncPolicy();
    }
    catch {
        await setState({ policySyncStatus: "offline" });
    }
}
