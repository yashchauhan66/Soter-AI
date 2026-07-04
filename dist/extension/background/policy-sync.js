import { SoterExtensionApiClient } from "../lib/api-client.js";
import { cachePolicy, getCachedPolicy, getState, setState } from "../lib/storage.js";
export function configurePolicySyncAlarm(seconds) {
    const periodInMinutes = Math.max(0.5, seconds / 60);
    chrome.alarms?.create("soter-policy-sync", { periodInMinutes, delayInMinutes: periodInMinutes });
}
export async function syncPolicy() {
    const state = await getState();
    try {
        const api = new SoterExtensionApiClient(state.config);
        const policy = await api.fetchPolicy();
        if (!policy.destinations)
            policy.destinations = await api.fetchDestinations();
        await cachePolicy(policy);
        configurePolicySyncAlarm(policy.emergencyLockdown?.enabled ? 30 : 15 * 60);
        return policy;
    }
    catch {
        const cached = await getCachedPolicy();
        await setState({ policySyncStatus: cached ? "offline" : "error", policy: cached });
        return cached;
    }
}
