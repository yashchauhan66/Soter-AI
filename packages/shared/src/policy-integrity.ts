/**
 * Shared policy-integrity primitives for the SoterAI browser extension and the
 * backend that publishes policy bundles.
 *
 * One implementation, two runtimes: everything here uses only `globalThis.crypto.subtle`
 * and `TextEncoder`, which exist in Node 18+ and in an MV3 service worker. The backend
 * and the extension must never diverge on canonicalisation, or every signature breaks.
 *
 * Threat model addressed (see docs/SOTERAI-BROWSER-GUARD-SUPREMACY-REPORT.md, SS-1):
 *  1. The previous `JSON.stringify(policy, Object.keys(policy).sort())` used the
 *     *replacer allowlist* overload, which filters keys at every depth. Nested content
 *     (`rules[]`, `riskThresholds`, `destinations[]`) was excluded from the hash, so a
 *     policy with every rule flipped to `allow` produced a byte-identical hash input.
 *  2. The signature only covered `version|orgId|updatedAt|policyHash` and the receiver
 *     never recomputed `policyHash` from the body, so the body was unbound.
 *  3. Symmetric HMAC put the verification secret on every client.
 *
 * This module fixes all three: recursive canonical JSON, a content hash bound to the
 * full body, a domain-separated signing payload that includes the algorithm and the
 * content hash, and asymmetric ECDSA P-256 as the preferred algorithm (HMAC retained
 * only for explicitly opted-in legacy deployments).
 */

/** Top-level envelope fields excluded from the content hash (they describe the signature). */
export const POLICY_ENVELOPE_FIELDS = [
  "signature",
  "policyHash",
  "algorithm",
  "signatureKeyId",
  "issuedAt",
] as const;

/** Domain separation tag. Changing this invalidates every existing signature by design. */
export const POLICY_SIGNING_CONTEXT = "soterai.policy-bundle.v1";

export type PolicySignatureAlgorithm = "ecdsa-p256-sha256" | "hmac-sha256";

export const PREFERRED_POLICY_ALGORITHM: PolicySignatureAlgorithm = "ecdsa-p256-sha256";

export interface PolicySignatureEnvelope {
  /** Hex SHA-256 of the canonical JSON of the bundle body (envelope fields excluded). */
  policyHash: string;
  /** Base64 signature. ECDSA is raw r||s (64 bytes); HMAC is the raw 32-byte MAC. */
  signature: string;
  algorithm: PolicySignatureAlgorithm;
  /** Identifies which trusted key signed this bundle, so keys can be rotated. */
  signatureKeyId: string;
  /** ISO timestamp the signature was produced. Drives anti-rollback. */
  issuedAt: string;
}

export type PolicyIntegrityCode =
  | "ok"
  | "unsigned"
  | "malformed"
  | "unsupported_algorithm"
  | "key_missing"
  | "organization_mismatch"
  | "hash_mismatch"
  | "signature_mismatch"
  | "rollback";

export interface PolicyIntegrityResult {
  /** Accept this bundle? */
  valid: boolean;
  /**
   * Was integrity *cryptographically proven*? `valid && !verified` means the bundle was
   * accepted for availability while no trusted key was configured — the UI and the health
   * report must surface that honestly and must not call it verified.
   */
  verified: boolean;
  code: PolicyIntegrityCode;
  reason?: string;
  /** Recomputed content hash, for diagnostics. Never contains policy content. */
  computedHash?: string;
  /** `issuedAt` of a bundle that verified, so the caller can ratchet forward. */
  acceptedIssuedAt?: string;
}


const MAX_CANONICAL_DEPTH = 64;

/**
 * Deterministic JSON serialisation: object keys sorted at every depth, array order
 * preserved, `undefined` / function / symbol values dropped from objects and encoded as
 * `null` inside arrays (matching `JSON.stringify` array semantics).
 *
 * Non-finite numbers throw rather than silently becoming `null`, because a policy
 * threshold that serialises to `null` would be a silent integrity hole.
 */
export function canonicalJson(value: unknown, depth = 0): string {
  if (depth > MAX_CANONICAL_DEPTH) throw new Error("canonicalJson: maximum depth exceeded");
  if (value === null) return "null";

  const type = typeof value;
  if (type === "boolean") return value ? "true" : "false";
  if (type === "number") {
    if (!Number.isFinite(value as number)) throw new Error("canonicalJson: non-finite number");
    return JSON.stringify(value);
  }
  if (type === "string") return JSON.stringify(value);
  if (type === "bigint") throw new Error("canonicalJson: bigint is not serialisable");
  if (type === "undefined" || type === "function" || type === "symbol") {
    throw new Error(`canonicalJson: ${type} is not serialisable at this position`);
  }

  if (Array.isArray(value)) {
    const items = value.map((item) => (isSkippable(item) ? "null" : canonicalJson(item, depth + 1)));
    return `[${items.join(",")}]`;
  }

  if (value instanceof Date) return JSON.stringify(value.toISOString());

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record)
    .filter((key) => !isSkippable(record[key]))
    .sort();
  const entries = keys.map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key], depth + 1)}`);
  return `{${entries.join(",")}}`;
}

function isSkippable(value: unknown) {
  return value === undefined || typeof value === "function" || typeof value === "symbol";
}

/** Strips only the top-level signature envelope. Nested keys are content and stay. */
export function stripPolicyEnvelope<T extends object>(policy: T): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  const envelope = new Set<string>(POLICY_ENVELOPE_FIELDS);
  for (const [key, value] of Object.entries(policy as Record<string, unknown>)) {
    if (envelope.has(key)) continue;
    body[key] = value;
  }
  return body;
}

/** Hex SHA-256 over the canonical JSON of the bundle body. This is the content binding. */
export async function computePolicyContentHash(policy: object): Promise<string> {
  const canonical = canonicalJson(stripPolicyEnvelope(policy));
  return sha256Hex(canonical);
}

/**
 * The exact byte string that gets signed. Includes the algorithm (so a verifier cannot be
 * tricked into downgrading), the organisation (so a bundle cannot be replayed into another
 * tenant), the bundle version, the signing timestamp (anti-rollback) and the content hash.
 */
export function policySigningPayload(input: {
  algorithm: PolicySignatureAlgorithm;
  organizationId: string;
  version: string;
  issuedAt: string;
  policyHash: string;
}): string {
  return [
    POLICY_SIGNING_CONTEXT,
    input.algorithm,
    input.organizationId,
    input.version,
    input.issuedAt,
    input.policyHash,
  ].join("\n");
}

export async function sha256Hex(input: string): Promise<string> {
  const digest = await getSubtle().digest("SHA-256", new TextEncoder().encode(input));
  return toHex(new Uint8Array(digest));
}

function getSubtle(): SubtleCrypto {
  const subtle = (globalThis as { crypto?: Crypto }).crypto?.subtle;
  if (!subtle) throw new Error("WebCrypto subtle is unavailable in this runtime");
  return subtle;
}

export function toHex(bytes: Uint8Array): string {
  let out = "";
  for (const byte of bytes) out += byte.toString(16).padStart(2, "0");
  return out;
}

export function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  if (typeof btoa === "function") return btoa(binary);
  return Buffer.from(bytes).toString("base64");
}

export function fromBase64(value: string): Uint8Array {
  if (typeof atob === "function") {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }
  return new Uint8Array(Buffer.from(value, "base64"));
}

/** Constant-time-ish comparison for equal-length secrets. Length is not secret here. */
export function timingSafeEqualBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}

/* ------------------------------------------------------------------ *
 * Signing key material
 * ------------------------------------------------------------------ */

export interface PolicySigningKey {
  keyId: string;
  algorithm: PolicySignatureAlgorithm;
  /** Base64 PKCS#8 private key for ECDSA, or the raw shared secret for legacy HMAC. */
  privateKey: string;
}

export interface PolicyTrustedKey {
  keyId: string;
  algorithm: PolicySignatureAlgorithm;
  /** Base64 SPKI public key for ECDSA, or the shared secret for legacy HMAC. */
  publicKey: string;
}

async function importEcdsaPrivateKey(base64Pkcs8: string) {
  return getSubtle().importKey(
    "pkcs8",
    fromBase64(base64Pkcs8) as unknown as ArrayBuffer,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
}

async function importEcdsaPublicKey(base64Spki: string) {
  return getSubtle().importKey(
    "spki",
    fromBase64(base64Spki) as unknown as ArrayBuffer,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["verify"],
  );
}

async function importHmacKey(secret: string, usage: "sign" | "verify") {
  return getSubtle().importKey(
    "raw",
    new TextEncoder().encode(secret) as unknown as ArrayBuffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    [usage],
  );
}

/** Generates a P-256 keypair as base64 SPKI / PKCS#8, for admin key provisioning. */
export async function generatePolicyKeyPair(keyId: string): Promise<{
  signing: PolicySigningKey;
  trusted: PolicyTrustedKey;
}> {
  const pair = await getSubtle().generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const pkcs8 = new Uint8Array(await getSubtle().exportKey("pkcs8", pair.privateKey));
  const spki = new Uint8Array(await getSubtle().exportKey("spki", pair.publicKey));
  return {
    signing: { keyId, algorithm: "ecdsa-p256-sha256", privateKey: toBase64(pkcs8) },
    trusted: { keyId, algorithm: "ecdsa-p256-sha256", publicKey: toBase64(spki) },
  };
}

/* ------------------------------------------------------------------ *
 * Sign
 * ------------------------------------------------------------------ */

/**
 * Signs a policy bundle. Returns a new object: the original body plus the envelope.
 * The caller must transmit the returned object verbatim — re-serialising through a
 * lossy transform (e.g. dropping `undefined` keys differently) is safe because the
 * hash is computed from canonical JSON, but reordering or renaming keys is not.
 */
export async function signPolicyBundle<T extends { organizationId: string; version: string }>(
  policy: T,
  key: PolicySigningKey,
  options: { issuedAt?: string } = {},
): Promise<T & PolicySignatureEnvelope> {
  const issuedAt = options.issuedAt ?? new Date().toISOString();
  const body = stripPolicyEnvelope(policy);
  const policyHash = await sha256Hex(canonicalJson(body));
  const payload = policySigningPayload({
    algorithm: key.algorithm,
    organizationId: policy.organizationId,
    version: policy.version,
    issuedAt,
    policyHash,
  });
  const data = new TextEncoder().encode(payload) as unknown as ArrayBuffer;

  let signatureBytes: Uint8Array;
  if (key.algorithm === "ecdsa-p256-sha256") {
    const privateKey = await importEcdsaPrivateKey(key.privateKey);
    signatureBytes = new Uint8Array(
      await getSubtle().sign({ name: "ECDSA", hash: "SHA-256" }, privateKey, data),
    );
  } else if (key.algorithm === "hmac-sha256") {
    const hmacKey = await importHmacKey(key.privateKey, "sign");
    signatureBytes = new Uint8Array(await getSubtle().sign("HMAC", hmacKey, data));
  } else {
    throw new Error(`Unsupported policy signing algorithm: ${String(key.algorithm)}`);
  }

  return {
    ...(body as T),
    policyHash,
    signature: toBase64(signatureBytes),
    algorithm: key.algorithm,
    signatureKeyId: key.keyId,
    issuedAt,
  };
}

/* ------------------------------------------------------------------ *
 * Verify
 * ------------------------------------------------------------------ */

export interface PolicyTrustState {
  /** Trusted keys from managed config or pinned at first enrollment. */
  keys?: PolicyTrustedKey[];
  /** Organisation this client belongs to. A bundle for another tenant is rejected. */
  organizationId?: string;
  /** Highest `issuedAt` previously verified. Anything older is a rollback. */
  lastAcceptedIssuedAt?: string;
  /** Trust ratchet: once a signed bundle verified, unsigned bundles are never accepted again. */
  signedBundleSeen?: boolean;
  /** Managed/enterprise switch: reject anything that is not cryptographically verified. */
  requireSigned?: boolean;
  /** Allowance for clock skew in the anti-rollback comparison. Default 5 minutes. */
  clockSkewToleranceMs?: number;
  /** Legacy symmetric HMAC is off unless an operator explicitly opts in. */
  allowLegacyHmac?: boolean;
}

const DEFAULT_CLOCK_SKEW_MS = 5 * 60 * 1000;

export async function verifyPolicyBundle(
  policy: unknown,
  trust: PolicyTrustState = {},
): Promise<PolicyIntegrityResult> {
  if (!policy || typeof policy !== "object" || Array.isArray(policy)) {
    return { valid: false, verified: false, code: "malformed", reason: "Policy bundle is not an object." };
  }
  const bundle = policy as Record<string, unknown> & Partial<PolicySignatureEnvelope>;
  const keys = trust.keys ?? [];
  const signed = Boolean(bundle.signature && bundle.policyHash && bundle.algorithm && bundle.issuedAt);

  if (!signed) {
    // A *partial* envelope is malformed, not unsigned. Otherwise stripping `algorithm`
    // from a signed bundle would downgrade it into the "unsigned, accepted for
    // availability" path on a profile that has not yet ratcheted.
    if (bundle.signature || bundle.policyHash || bundle.algorithm || bundle.signatureKeyId) {
      return {
        valid: false,
        verified: false,
        code: "malformed",
        reason: "Policy signature envelope is incomplete (signature, policyHash, algorithm and issuedAt are all required).",
      };
    }
    if (trust.requireSigned) {
      return {
        valid: false,
        verified: false,
        code: "unsigned",
        reason: "Policy signature is required by enterprise configuration but the bundle is unsigned.",
      };
    }
    if (trust.signedBundleSeen) {
      return {
        valid: false,
        verified: false,
        code: "unsigned",
        reason: "A signed policy was previously accepted; downgrade to an unsigned bundle is refused.",
      };
    }
    if (keys.length > 0) {
      return {
        valid: false,
        verified: false,
        code: "unsigned",
        reason: "A trusted policy key is configured but the bundle is unsigned.",
      };
    }
    return {
      valid: true,
      verified: false,
      code: "unsigned",
      reason: "Policy is unsigned and no trusted key is configured — integrity is NOT verified.",
    };
  }

  const algorithm = bundle.algorithm as PolicySignatureAlgorithm;
  if (algorithm !== "ecdsa-p256-sha256" && algorithm !== "hmac-sha256") {
    return {
      valid: false,
      verified: false,
      code: "unsupported_algorithm",
      reason: `Unsupported policy signature algorithm: ${String(algorithm)}`,
    };
  }
  if (algorithm === "hmac-sha256" && !trust.allowLegacyHmac) {
    return {
      valid: false,
      verified: false,
      code: "unsupported_algorithm",
      reason: "Legacy symmetric HMAC policy signatures are disabled. Use ecdsa-p256-sha256.",
    };
  }

  const organizationId = typeof bundle.organizationId === "string" ? bundle.organizationId : "";
  if (trust.organizationId && organizationId && organizationId !== trust.organizationId) {
    return {
      valid: false,
      verified: false,
      code: "organization_mismatch",
      reason: "Policy bundle belongs to a different organization.",
    };
  }

  // The content binding: recompute the hash from the received body.
  let computedHash: string;
  try {
    computedHash = await sha256Hex(canonicalJson(stripPolicyEnvelope(bundle)));
  } catch (error) {
    return {
      valid: false,
      verified: false,
      code: "malformed",
      reason: `Policy bundle could not be canonicalised: ${error instanceof Error ? error.message : "unknown error"}`,
    };
  }
  const claimedHash = String(bundle.policyHash ?? "").toLowerCase();
  if (!timingSafeEqualBytes(new TextEncoder().encode(computedHash), new TextEncoder().encode(claimedHash))) {
    return {
      valid: false,
      verified: false,
      code: "hash_mismatch",
      computedHash,
      reason: "Policy content does not match its signed hash — the bundle was modified in transit.",
    };
  }

  const keyId = typeof bundle.signatureKeyId === "string" ? bundle.signatureKeyId : "";
  const candidates = keys.filter((key) => key.algorithm === algorithm && (!keyId || key.keyId === keyId));
  if (candidates.length === 0) {
    if (trust.requireSigned || trust.signedBundleSeen) {
      return {
        valid: false,
        verified: false,
        code: "key_missing",
        computedHash,
        reason: keys.length === 0
          ? "No trusted policy key is configured, so the signature cannot be verified."
          : `No trusted policy key matches keyId "${keyId}" for algorithm ${algorithm}.`,
      };
    }
    return {
      valid: true,
      verified: false,
      code: "key_missing",
      computedHash,
      reason: "Bundle is self-consistent but no trusted key is configured — authenticity is NOT verified.",
    };
  }

  const issuedAt = String(bundle.issuedAt);
  const payload = policySigningPayload({
    algorithm,
    organizationId,
    version: typeof bundle.version === "string" ? bundle.version : "",
    issuedAt,
    policyHash: claimedHash,
  });
  const data = new TextEncoder().encode(payload) as unknown as ArrayBuffer;
  const signatureBytes = fromBase64(String(bundle.signature)) as unknown as ArrayBuffer;

  let signatureOk = false;
  for (const key of candidates) {
    try {
      if (algorithm === "ecdsa-p256-sha256") {
        const publicKey = await importEcdsaPublicKey(key.publicKey);
        signatureOk = await getSubtle().verify({ name: "ECDSA", hash: "SHA-256" }, publicKey, signatureBytes, data);
      } else {
        const hmacKey = await importHmacKey(key.publicKey, "verify");
        signatureOk = await getSubtle().verify("HMAC", hmacKey, signatureBytes, data);
      }
    } catch {
      signatureOk = false;
    }
    if (signatureOk) break;
  }

  if (!signatureOk) {
    return {
      valid: false,
      verified: false,
      code: "signature_mismatch",
      computedHash,
      reason: "Policy signature did not verify against any trusted key.",
    };
  }

  const tolerance = trust.clockSkewToleranceMs ?? DEFAULT_CLOCK_SKEW_MS;
  const issuedMs = Date.parse(issuedAt);
  if (!Number.isFinite(issuedMs)) {
    return {
      valid: false,
      verified: false,
      code: "malformed",
      computedHash,
      reason: "Policy issuedAt is not a valid timestamp.",
    };
  }
  if (trust.lastAcceptedIssuedAt) {
    const lastMs = Date.parse(trust.lastAcceptedIssuedAt);
    if (Number.isFinite(lastMs) && issuedMs < lastMs - tolerance) {
      return {
        valid: false,
        verified: false,
        code: "rollback",
        computedHash,
        reason: "Policy bundle is older than the last verified bundle (rollback refused).",
      };
    }
  }

  return { valid: true, verified: true, code: "ok", computedHash, acceptedIssuedAt: issuedAt };
}





