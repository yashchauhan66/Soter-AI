/**
 * Extension-side policy integrity.
 *
 * Thin adapter over `packages/shared/src/policy-integrity`, which is the single
 * canonicalisation + signing implementation shared with the backend. Keeping the
 * crypto in one file is deliberate: the previous split implementation drifted and
 * both halves used `JSON.stringify(policy, Object.keys(policy).sort())`, whose
 * replacer-allowlist semantics excluded every nested field (rules, thresholds,
 * destinations) from the hash. See docs/SOTERAI-BROWSER-GUARD-SUPREMACY-REPORT.md SS-1.
 */

import {
  computePolicyContentHash,
  verifyPolicyBundle,
  type PolicyIntegrityCode,
  type PolicyIntegrityResult,
  type PolicyTrustState,
  type PolicyTrustedKey,
} from "../../../../packages/shared/src/policy-integrity";
import type { ExtensionConfig, ExtensionState } from "./types";

export type { PolicyIntegrityCode, PolicyIntegrityResult, PolicyTrustedKey };

/**
 * Builds the trust state for verification from configuration plus the persisted
 * ratchet. Precedence: managed/enterprise configuration wins over anything the
 * policy server said about itself.
 */
export function policyTrustStateFromState(state: ExtensionState): PolicyTrustState {
  const config: ExtensionConfig = state.config;
  const keys: PolicyTrustedKey[] = [...normalizeTrustedKeys(config.policyTrustedKeys)];

  // Legacy symmetric secret, retained only for existing deployments that set it.
  if (config.policySigningSecret) {
    keys.push({ keyId: "legacy-hmac", algorithm: "hmac-sha256", publicKey: config.policySigningSecret });
  }

  return {
    keys,
    organizationId: config.organizationId || undefined,
    requireSigned: config.requirePolicySignature === true,
    allowLegacyHmac: Boolean(config.policySigningSecret),
    lastAcceptedIssuedAt: state.policyTrust?.lastAcceptedIssuedAt,
    signedBundleSeen: state.policyTrust?.signedBundleSeen === true,
  };
}

/** Accepts the managed-config shape (array of objects) or a JSON string from GPO. */
export function normalizeTrustedKeys(input: unknown): PolicyTrustedKey[] {
  if (!input) return [];
  let raw: unknown = input;
  if (typeof input === "string") {
    try {
      raw = JSON.parse(input);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(raw)) return [];
  const keys: PolicyTrustedKey[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const candidate = entry as Record<string, unknown>;
    const keyId = typeof candidate.keyId === "string" ? candidate.keyId : "";
    const publicKey = typeof candidate.publicKey === "string" ? candidate.publicKey : "";
    const algorithm = candidate.algorithm === "hmac-sha256" ? "hmac-sha256" : "ecdsa-p256-sha256";
    if (!keyId || !publicKey) continue;
    keys.push({ keyId, algorithm, publicKey });
  }
  return keys;
}

/**
 * Verifies a freshly fetched bundle. Returns the full result so the caller can
 * distinguish "accepted and cryptographically verified" from "accepted for
 * availability but NOT verified" — a distinction the UI is required to surface.
 */
export async function verifyPolicy(policy: unknown, state: ExtensionState): Promise<PolicyIntegrityResult> {
  return verifyPolicyBundle(policy, policyTrustStateFromState(state));
}

/**
 * True when an integrity result must stop the extension from adopting the bundle.
 * Anything other than `unsigned`/`key_missing` in a non-enforcing deployment is a
 * positive tamper signal, not merely a missing-configuration signal.
 */
export function isTamperSignal(result: PolicyIntegrityResult) {
  return !result.valid && result.code !== "unsigned" && result.code !== "key_missing";
}

/** Re-exported so callers do not need a second import path. */
export { computePolicyContentHash };
