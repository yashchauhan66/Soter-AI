import { SoterExtensionApiClient } from "../lib/api-client";
import { cachePolicy, getCachedPolicy, getState, setState } from "../lib/storage";
import { verifyPolicySignature } from "../lib/policy-verification";

export function configurePolicySyncAlarm(seconds: number) {
  const periodInMinutes = Math.max(0.5, seconds / 60);
  chrome.alarms?.create("soter-policy-sync", { periodInMinutes, delayInMinutes: periodInMinutes });
}

export async function syncPolicy() {
  const state = await getState();
  try {
    const api = new SoterExtensionApiClient(state.config);
    const policy = await api.fetchPolicy();

    // P0-2 FIX: Verify policy signature before accepting
    const signingSecret = state.config.policySigningSecret;
    const verification = await verifyPolicySignature(
      {
        version: policy.version,
        organizationId: policy.organizationId ?? state.config.organizationId,
        updatedAt: policy.updatedAt ?? new Date().toISOString(),
        signature: policy.signature,
        policyHash: policy.policyHash,
      },
      signingSecret
    );

    if (!verification.valid) {
      console.error("[Soter] Policy signature verification failed:", verification.reason);
      // Keep using cached policy, mark as stale
      const cached = await getCachedPolicy();
      await setState({ policySyncStatus: "error", policy: cached });
      
      // Log security event about failed verification (extension audit events only support specific types)
      console.warn("[Soter] Policy verification failed - keeping cached policy. Reason:", verification.reason);

      return cached;
    }

    if (!policy.destinations) policy.destinations = await api.fetchDestinations();
    await cachePolicy(policy);
    configurePolicySyncAlarm(policy.emergencyLockdown?.enabled ? 30 : 15 * 60);
    return policy;
  } catch (error) {
    const cached = await getCachedPolicy();
    await setState({ policySyncStatus: cached ? "offline" : "error", policy: cached });
    return cached;
  }
}
