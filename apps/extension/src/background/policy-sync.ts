import { SoterExtensionApiClient } from "../lib/api-client";
import { cachePolicy, getCachedPolicy, getState, setState } from "../lib/storage";
import { isTamperSignal, verifyPolicy } from "../lib/policy-verification";
import type { PolicyIntegrityRecord } from "../lib/types";

export function configurePolicySyncAlarm(seconds: number) {
  const periodInMinutes = Math.max(0.5, seconds / 60);
  chrome.alarms?.create("soter-policy-sync", { periodInMinutes, delayInMinutes: periodInMinutes });
}

/**
 * Fetches, verifies and adopts a policy bundle.
 *
 * Order matters and is part of the security property (SS-1 / SS-4):
 *  1. Verify the bundle exactly as received. Nothing is mutated first, because any
 *     mutation invalidates the content hash the signature binds.
 *  2. Refuse a tampered, replayed or cross-tenant bundle and keep the last known good
 *     one, recording the failure so `scanPrompt` can fail closed.
 *  3. Only then enrich (destinations) and cache, and ratchet trust forward.
 */
export async function syncPolicy() {
  const state = await getState();
  try {
    const api = new SoterExtensionApiClient(state.config);
    const policy = await api.fetchPolicy();

    const verification = await verifyPolicy(policy, state);
    const integrity: PolicyIntegrityRecord = {
      verified: verification.verified,
      code: verification.code,
      reason: verification.reason,
      checkedAt: new Date().toISOString(),
      contentHash: verification.computedHash,
    };

    if (!verification.valid) {
      // Fail closed on a positive tamper signal; stay on the last known good bundle.
      const cached = await getCachedPolicy();
      await setState({
        policySyncStatus: "error",
        policy: cached,
        policyIntegrity: integrity,
      });
      console.error(
        `[Soter] Policy rejected (${verification.code}). Keeping last known good policy.`,
        isTamperSignal(verification) ? "Tamper signal." : "Configuration signal.",
      );
      return cached;
    }

    if (!policy.destinations) policy.destinations = await api.fetchDestinations();
    await cachePolicy(policy);
    await setState({
      policyIntegrity: integrity,
      // Trust ratchet: once a signed bundle verifies, unsigned bundles are refused for
      // ever after, and an older `issuedAt` is treated as a rollback attempt.
      policyTrust: verification.verified
        ? {
            lastAcceptedIssuedAt: verification.acceptedIssuedAt ?? state.policyTrust?.lastAcceptedIssuedAt,
            signedBundleSeen: true,
          }
        : state.policyTrust,
    });
    configurePolicySyncAlarm(policy.emergencyLockdown?.enabled ? 30 : 15 * 60);
    return policy;
  } catch (error) {
    // Network/transport failure: availability problem, not an integrity problem.
    const cached = await getCachedPolicy();
    const hadPolicy = state.policySyncStatus !== "never";
    await setState({ policySyncStatus: hadPolicy ? "offline" : "error", policy: cached });
    console.warn(`[Soter] Policy sync failed: ${error instanceof Error ? error.message : "unknown error"}`);
    return cached;
  }
}
