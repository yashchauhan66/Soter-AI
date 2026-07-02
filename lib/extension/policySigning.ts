/**
 * Policy signature verification for the Soter extension.
 *
 * Backend signs policy bundles with HMAC-SHA256.
 * Extension verifies signature before accepting policy.
 * If verification fails: keep previous valid cached policy,
 * show stale/untrusted status, send security event.
 */

import crypto from "crypto";

export interface SignedPolicyBundle {
  version: string;
  organizationId: string;
  publishedAt: string;
  policyHash: string;
  signature: string;
  algorithm: "hmac-sha256";
}

export interface PolicyVerificationResult {
  valid: boolean;
  reason?: string;
  bundle?: SignedPolicyBundle;
}

/**
 * Generate a policy bundle signature using HMAC-SHA256.
 * Used by the backend/admin API.
 */
export function signPolicyBundle(
  payload: Omit<SignedPolicyBundle, "signature" | "algorithm">,
  secret: string
): SignedPolicyBundle {
  const data = `${payload.version}|${payload.organizationId}|${payload.publishedAt}|${payload.policyHash}`;
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(data);
  const signature = hmac.digest("hex");

  return {
    ...payload,
    signature,
    algorithm: "hmac-sha256",
  };
}

/**
 * Verify a policy bundle signature.
 */
export function verifyPolicyBundle(
  bundle: SignedPolicyBundle,
  secret: string
): PolicyVerificationResult {
  if (!bundle.signature || !bundle.policyHash) {
    return { valid: false, reason: "Missing signature or policy hash", bundle };
  }

  if (bundle.algorithm !== "hmac-sha256") {
    return { valid: false, reason: `Unsupported algorithm: ${bundle.algorithm}`, bundle };
  }

  const data = `${bundle.version}|${bundle.organizationId}|${bundle.publishedAt}|${bundle.policyHash}`;
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(data);
  const expected = hmac.digest("hex");

  if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(bundle.signature))) {
    return { valid: false, reason: "Signature mismatch — policy may have been tampered with", bundle };
  }

  return { valid: true, bundle };
}

/**
 * Compute a policy JSON hash for signing.
 */
export function computePolicyHash(policyJson: unknown): string {
  const normalized = JSON.stringify(policyJson, Object.keys(policyJson as object).sort());
  return crypto.createHash("sha256").update(normalized).digest("hex");
}

/**
 * Extension-side: verify policy signature using the configured secret.
 * If no secret is configured, policy is accepted as-is (trust-on-first-use).
 */
export function verifyPolicySignature(
  policy: { version: string; organizationId: string; updatedAt: string; signature?: string; policyHash?: string },
  signingSecret?: string
): PolicyVerificationResult {
  if (!signingSecret) {
    // No signing secret configured — trust the policy as-is
    return { valid: true, bundle: undefined };
  }

  if (!policy.signature || !policy.policyHash) {
    return { valid: false, reason: "Policy is not signed but signing is required" };
  }

  const bundle: SignedPolicyBundle = {
    version: policy.version,
    organizationId: policy.organizationId,
    publishedAt: policy.updatedAt,
    policyHash: policy.policyHash,
    signature: policy.signature,
    algorithm: "hmac-sha256",
  };

  return verifyPolicyBundle(bundle, signingSecret);
}
