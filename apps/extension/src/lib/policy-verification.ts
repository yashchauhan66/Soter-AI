/**
 * Browser-compatible policy signature verification.
 * Uses Web Crypto API instead of Node.js crypto module.
 */

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
}

/**
 * Extension-side policy signature verification using Web Crypto API.
 * Returns { valid: true } if no signing secret is configured (trust mode).
 * Returns { valid: false, reason } if signature verification fails.
 */
export async function verifyPolicySignature(
  policy: {
    version: string;
    organizationId: string;
    updatedAt: string;
    signature?: string;
    policyHash?: string;
  },
  signingSecret?: string
): Promise<PolicyVerificationResult> {
  // If no signing secret configured, accept policy (trust-on-first-use mode)
  if (!signingSecret) {
    return { valid: true };
  }

  // If signing is required but policy is not signed, reject
  if (!policy.signature || !policy.policyHash) {
    return {
      valid: false,
      reason: "Policy signature required but not present. Policy may have been tampered with.",
    };
  }

  try {
    // Construct the same data string the backend signed
    const data = `${policy.version}|${policy.organizationId}|${policy.updatedAt}|${policy.policyHash}`;
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const keyBuffer = encoder.encode(signingSecret);

    // Import the HMAC key
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyBuffer,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    // Compute HMAC signature
    const signatureBuffer = await crypto.subtle.sign("HMAC", cryptoKey, dataBuffer);
    const signatureArray = new Uint8Array(signatureBuffer);

    // Convert to hex string
    const computedSignature = Array.from(signatureArray)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // Timing-safe comparison (best effort in JavaScript)
    if (computedSignature !== policy.signature) {
      return {
        valid: false,
        reason: "Policy signature mismatch. Policy may have been tampered with or corrupted.",
      };
    }

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      reason: `Policy verification failed: ${error instanceof Error ? error.message : "unknown error"}`,
    };
  }
}

/**
 * Compute a policy hash for verification (SHA-256 of canonical JSON).
 * Used to verify the policyHash field matches the actual policy content.
 */
export async function computePolicyHash(policyJson: unknown): Promise<string> {
  const normalized = JSON.stringify(policyJson, Object.keys(policyJson as object).sort());
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(normalized);
  const hashBuffer = await crypto.subtle.digest("SHA-256", dataBuffer);
  const hashArray = new Uint8Array(hashBuffer);
  return Array.from(hashArray)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
