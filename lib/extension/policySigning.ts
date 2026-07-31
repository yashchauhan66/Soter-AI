/**
 * Server-side policy-bundle signing for the Soter browser extension.
 *
 * This module used to contain a second, independent implementation of policy signing. It had
 * three defects and zero callers, which is the worst combination: the codebase *looked* as
 * though it signed policy while every served bundle was unsigned.
 *
 *  1. `computePolicyHash` called `JSON.stringify(policy, Object.keys(policy).sort())`. The
 *     second argument is a **replacer allowlist**, not a key order, and it is applied at
 *     every depth — so `rules[]`, `riskThresholds` and `destinations[]` were excluded from
 *     the hash. A bundle with every rule flipped to `allow` hashed identically to the
 *     original.
 *  2. The signed string was `version|orgId|publishedAt|policyHash` with no domain separation,
 *     no algorithm binding (so a verifier could be downgraded) and no tenant replay barrier.
 *  3. `verifyPolicySignature()` returned `{ valid: true }` when no secret was configured —
 *     trust-on-first-use presented to callers as a successful verification.
 *  4. `verifyPolicyBundle` compared signatures with `crypto.timingSafeEqual`, which *throws*
 *     on a length mismatch. An attacker-chosen short signature raised instead of returning
 *     `{ valid: false }`, so the outcome depended entirely on the caller's catch block.
 *
 * There is now exactly one implementation of canonicalisation, hashing, signing and
 * verification — `packages/shared/src/policy-integrity.ts` — shared byte-for-byte with the
 * extension. This file is only the server's key-material adapter around it. Nothing here
 * re-derives a hash or a signing payload.
 *
 * Key material lives in the environment, never in the repo or in a served response:
 *   SOTER_POLICY_SIGNING_KEY_ID        stable id echoed as `signatureKeyId`, used for rotation
 *   SOTER_POLICY_SIGNING_PRIVATE_KEY   base64 PKCS#8 ECDSA P-256 private key
 *   SOTER_POLICY_SIGNING_ALGORITHM     optional; `hmac-sha256` requires the opt-in below
 *   SOTER_POLICY_ALLOW_LEGACY_HMAC     must be "true" before a symmetric key is accepted
 *
 * Generate a keypair with `npx tsx scripts/extension/generate-policy-key.ts`; the public half
 * is what an administrator pushes to `policyTrustedKeys` in managed browser policy.
 */

import {
  PREFERRED_POLICY_ALGORITHM,
  generatePolicyKeyPair,
  signPolicyBundle,
  verifyPolicyBundle,
  type PolicySignatureAlgorithm,
  type PolicySignatureEnvelope,
  type PolicySigningKey,
  type PolicyTrustedKey,
} from "@/packages/shared/src/policy-integrity";

export type {
  PolicySignatureAlgorithm,
  PolicySignatureEnvelope,
  PolicySigningKey,
  PolicyTrustedKey,
};
export { PREFERRED_POLICY_ALGORITHM, generatePolicyKeyPair, signPolicyBundle, verifyPolicyBundle };

/** A policy bundle can only be signed if it carries the two fields the payload binds. */
export interface SignablePolicyBundle {
  organizationId: string;
  version: string;
}

export type PolicySigningKeyStatus =
  | { configured: false; reason: "not_configured" | "incomplete" | "legacy_hmac_not_enabled" | "unsupported_algorithm" }
  | { configured: true; keyId: string; algorithm: PolicySignatureAlgorithm };

function readEnv(name: string): string | undefined {
  const value = process.env[name];
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Resolves the configured signing key, or `null` when this deployment does not sign policy.
 *
 * Returning `null` is a legitimate state, not an error: an unsigned bundle is accepted by the
 * extension as `{ valid: true, verified: false }` and is reported as unverified in the health
 * UI. Only a tenant that sets `requirePolicySignature` in managed policy turns the absence of
 * a signature into a block, and that block is the client's decision to make.
 */
export function getPolicySigningKey(): PolicySigningKey | null {
  const privateKey = readEnv("SOTER_POLICY_SIGNING_PRIVATE_KEY");
  const keyId = readEnv("SOTER_POLICY_SIGNING_KEY_ID");
  if (!privateKey || !keyId) return null;

  const algorithm = (readEnv("SOTER_POLICY_SIGNING_ALGORITHM") ?? PREFERRED_POLICY_ALGORITHM) as PolicySignatureAlgorithm;
  if (algorithm !== "ecdsa-p256-sha256" && algorithm !== "hmac-sha256") return null;
  // A symmetric key must be distributed to every client that verifies it, which makes every
  // client able to forge policy for the whole tenant. The shared verifier refuses HMAC by
  // default; refusing it here too keeps a misconfigured server from serving bundles that no
  // hardened client will accept.
  if (algorithm === "hmac-sha256" && readEnv("SOTER_POLICY_ALLOW_LEGACY_HMAC") !== "true") return null;

  return { keyId, algorithm, privateKey };
}

/** Non-secret description of the signing configuration, safe to log or surface to an admin. */
export function policySigningKeyStatus(): PolicySigningKeyStatus {
  const privateKey = readEnv("SOTER_POLICY_SIGNING_PRIVATE_KEY");
  const keyId = readEnv("SOTER_POLICY_SIGNING_KEY_ID");
  if (!privateKey && !keyId) return { configured: false, reason: "not_configured" };
  if (!privateKey || !keyId) return { configured: false, reason: "incomplete" };

  const algorithm = (readEnv("SOTER_POLICY_SIGNING_ALGORITHM") ?? PREFERRED_POLICY_ALGORITHM) as PolicySignatureAlgorithm;
  if (algorithm !== "ecdsa-p256-sha256" && algorithm !== "hmac-sha256") {
    return { configured: false, reason: "unsupported_algorithm" };
  }
  if (algorithm === "hmac-sha256" && readEnv("SOTER_POLICY_ALLOW_LEGACY_HMAC") !== "true") {
    return { configured: false, reason: "legacy_hmac_not_enabled" };
  }
  return { configured: true, keyId, algorithm };
}

/**
 * Signs a bundle for transport when a key is configured, otherwise returns it unchanged.
 *
 * A signing failure never fails the request. The alternative — refusing to serve policy —
 * would turn a server-side key problem into a fleet-wide outage, and the client already has
 * the stronger control: `requirePolicySignature` makes an unsigned bundle a local block. The
 * failure is logged with the key id only; key material and policy content are never logged.
 */
export async function signPolicyForTransport<T extends SignablePolicyBundle>(
  bundle: T,
  key: PolicySigningKey | null = getPolicySigningKey(),
): Promise<T | (T & PolicySignatureEnvelope)> {
  if (!key) return bundle;
  try {
    return await signPolicyBundle(bundle, key);
  } catch (error) {
    console.error(
      `[Soter extension] Policy bundle signing failed for keyId=${key.keyId} (${key.algorithm}); serving unsigned.`,
      error instanceof Error ? error.message : "unknown error",
    );
    return bundle;
  }
}
