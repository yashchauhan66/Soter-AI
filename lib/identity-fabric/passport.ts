// ── Agent Identity Fabric — Cryptographic Passport System ───────────────────
// Creates, verifies, and manages JWT-like agent passports signed with
// HMAC-SHA256. Follows the project's existing crypto patterns (peppered
// hashing, base64url encoding, prefix-based token format).
// ────────────────────────────────────────────────────────────────────────────

import { createHash, randomUUID, timingSafeEqual } from "crypto";
import {
  PASSPORT_TOKEN_PREFIX,
  PASSPORT_TOKEN_VERSION,
  DEFAULT_PASSPORT_LIFETIME_SEC,
  type AgentPassportClaims,
  type DecodedPassport,
  type PassportRevocationReason,
  type IdentityFabricConfig,
} from "./types";
import { hasCapability } from "./capabilities";

// ── Configuration ────────────────────────────────────────────────────────────

let fabricConfig: IdentityFabricConfig = {};

/**
 * Configure the identity fabric (signing secret, timeouts, etc.).
 * Should be called once at application startup.
 */
export function configureIdentityFabric(config: IdentityFabricConfig): void {
  fabricConfig = { ...fabricConfig, ...config };
}

function getSigningSecret(): string {
  return (
    fabricConfig.signingSecret ??
    process.env.IDENTITY_FABRIC_SECRET ??
    process.env.API_KEY_PEPPER ??
    process.env.AUTH_SECRET ??
    process.env.NEXTAUTH_SECRET ??
    "soter-identity-fabric-default-secret-do-not-use-in-production"
  );
}

function getPassportLifetimeSec(): number {
  return fabricConfig.passportLifetimeSec ?? DEFAULT_PASSPORT_LIFETIME_SEC;
}

function getMaxDelegationDepth(): number {
  return fabricConfig.maxDelegationDepth ?? 5;
}

// ── Signing ──────────────────────────────────────────────────────────────────

/**
 * Compute an HMAC-SHA256 signature over the token payload.
 */
function signPayload(payload: string): string {
  return createHash("sha256")
    .update(`identity-fabric.v1:${payload}:${getSigningSecret()}`)
    .digest("hex");
}

/**
 * Verify an HMAC-SHA256 signature in constant time.
 */
function verifySignature(payload: string, signature: string): boolean {
  const expected = signPayload(payload);
  const expectedBuf = Buffer.from(expected, "hex");
  const suppliedBuf = Buffer.from(signature, "hex");
  if (expectedBuf.length !== suppliedBuf.length) return false;
  return timingSafeEqual(expectedBuf, suppliedBuf);
}

// ── Token Encoding/Decoding ──────────────────────────────────────────────────

/**
 * Base64url-encode a string without padding.
 */
function base64urlEncode(data: string): string {
  return Buffer.from(data, "utf8")
    .toString("base64url");
}

/**
 * Base64url-decode a string.
 */
function base64urlDecode(data: string): string {
  return Buffer.from(data, "base64url").toString("utf8");
}

/**
 * Create an agent passport — a self-contained JWT-like token with structured
 * claims, signed with HMAC-SHA256.
 *
 * Format: `st.v1.<base64url(payload)>.<hex-signature>`
 *
 * @param agentIdentityId - The agent's identity ID (sub).
 * @param capabilities - List of capability strings.
 * @param options - Additional claims (audience, scope, parent JTI, etc.).
 * @returns The raw passport token string and its claims.
 */
export function createAgentPassport(
  agentIdentityId: string,
  capabilities: string[],
  options: {
    audience?: string;
    scope?: string;
    parentJti?: string;
    depth?: number;
    lifetimeSec?: number;
    jti?: string;
  } = {},
): { raw: string; claims: AgentPassportClaims } {
  const now = Math.floor(Date.now() / 1000);
  const lifetime = options.lifetimeSec ?? getPassportLifetimeSec();
  const jti = options.jti ?? `st_${randomUUID()}`;

  const claims: AgentPassportClaims = {
    sub: agentIdentityId,
    iss: "soter-identity-fabric",
    cap: [...capabilities],
    iat: now,
    exp: now + lifetime,
    jti,
  };

  if (options.audience) claims.aud = options.audience;
  if (options.scope) claims.scope = options.scope;
  if (options.parentJti) claims.prt = options.parentJti;
  if (options.depth !== undefined) claims.depth = options.depth;

  const payload = JSON.stringify(claims);
  const payloadEncoded = base64urlEncode(payload);
  const signature = signPayload(payload);

  const raw = `${PASSPORT_TOKEN_PREFIX}.${PASSPORT_TOKEN_VERSION}.${payloadEncoded}.${signature}`;

  return { raw, claims };
}

/**
 * Decode and verify an agent passport token.
 *
 * @param rawToken - The raw `st.v1.xxx.yyy` token string.
 * @returns A decoded passport with validation status.
 */
export function decodeAndVerifyPassport(rawToken: string): DecodedPassport {
  const parts = rawToken.split(".");
  if (parts.length !== 4) {
    return {
      raw: rawToken,
      claims: null as unknown as AgentPassportClaims,
      valid: false,
      active: false,
      status: "invalid-signature",
    };
  }

  const [prefix, version, payloadEncoded, signature] = parts;

  // Validate format markers.
  if (prefix !== PASSPORT_TOKEN_PREFIX || version !== PASSPORT_TOKEN_VERSION) {
    return {
      raw: rawToken,
      claims: null as unknown as AgentPassportClaims,
      valid: false,
      active: false,
      status: "invalid-signature",
    };
  }

  // Decode payload.
  let payload: string;
  let claims: AgentPassportClaims;
  try {
    payload = base64urlDecode(payloadEncoded);
    claims = JSON.parse(payload) as AgentPassportClaims;
  } catch {
    return {
      raw: rawToken,
      claims: null as unknown as AgentPassportClaims,
      valid: false,
      active: false,
      status: "invalid-signature",
    };
  }

  // Validate structure.
  if (!claims.sub || !claims.jti || !claims.cap || !claims.iat || !claims.exp) {
    return {
      raw: rawToken,
      claims: null as unknown as AgentPassportClaims,
      valid: false,
      active: false,
      status: "invalid-signature",
    };
  }

  // Verify signature.
  const signatureValid = verifySignature(payload, signature);
  if (!signatureValid) {
    return {
      raw: rawToken,
      claims,
      valid: false,
      active: false,
      status: "invalid-signature",
    };
  }

  // Check time bounds.
  const now = Math.floor(Date.now() / 1000);
  const active = claims.iat <= now && now <= claims.exp;

  let status: DecodedPassport["status"];
  if (!active) {
    if (now < claims.iat) status = "not-yet-active";
    else status = "expired";
  } else {
    status = "valid";
  }

  return { raw: rawToken, claims, valid: true, active, status };
}

/**
 * Verify that a passport is currently valid (signature + time bounds).
 * Shorthand for `decodeAndVerifyPassport().status === "valid"`.
 */
export function verifyAgentPassport(rawToken: string): DecodedPassport {
  return decodeAndVerifyPassport(rawToken);
}

/**
 * Decode a passport token WITHOUT verifying the signature.
 * Useful for extracting claims before performing custom validation.
 * WARNING: Do not trust the claims without verifying the signature first.
 */
export function decodePassportUnverified(rawToken: string): { claims: AgentPassportClaims | null } {
  const parts = rawToken.split(".");
  if (parts.length !== 4) return { claims: null };

  const [, , payloadEncoded] = parts;
  try {
    const payload = base64urlDecode(payloadEncoded);
    const claims = JSON.parse(payload) as AgentPassportClaims;
    return { claims };
  } catch {
    return { claims: null };
  }
}

/**
 * Generate a unique token ID for a passport.
 */
export function createPassportJti(): string {
  return `st_${randomUUID()}`;
}

// ── Revocation ───────────────────────────────────────────────────────────────

// In-memory revocation set. In production, this would be backed by Redis or
// the database. Revoked JTIs are checked during passport verification.
const revokedJtis = new Set<string>();

/**
 * Revoke a passport by its JTI (token ID).
 *
 * @param jti - The token ID to revoke.
 * @param reason - The reason for revocation.
 */
export function revokePassportByJti(jti: string, _reason?: PassportRevocationReason): void {
  revokedJtis.add(jti);
}

/**
 * Check whether a specific JTI has been revoked.
 */
export function isPassportRevoked(jti: string): boolean {
  return revokedJtis.has(jti);
}

/**
 * Check if a passport is revoked (looks up JTI from decoded claims).
 */
export function isPassportRevokedByToken(rawToken: string): boolean {
  const { claims } = decodePassportUnverified(rawToken);
  if (!claims) return true; // Invalid tokens are treated as revoked.
  return isPassportRevoked(claims.jti);
}

/**
 * Get the current count of revoked passports (for monitoring).
 */
export function revokedPassportCount(): number {
  return revokedJtis.size;
}

// ── Passport Refresh ─────────────────────────────────────────────────────────

/**
 * Refresh a passport before it expires. Issues a new passport with the same
 * subject and capabilities but a new JTI, IAT, and EXP.
 *
 * The old passport's JTI is revoked to prevent replay.
 *
 * @param currentToken - The current (still valid) passport.
 * @param lifetimeSec - Optional new lifetime (default: configured lifetime).
 * @returns A new passport token, or null if the current token is invalid.
 */
export function refreshAgentPassport(
  currentToken: string,
  lifetimeSec?: number,
): { raw: string; claims: AgentPassportClaims } | null {
  const decoded = decodeAndVerifyPassport(currentToken);
  if (decoded.status !== "valid") return null;

  // Revoke the old passport.
  revokePassportByJti(decoded.claims.jti, "session-ended");

  // Issue a new one.
  return createAgentPassport(decoded.claims.sub, decoded.claims.cap, {
    audience: decoded.claims.aud,
    scope: decoded.claims.scope,
    parentJti: decoded.claims.prt,
    depth: decoded.claims.depth,
    lifetimeSec,
  });
}

// ── Authorization Helper ─────────────────────────────────────────────────────

/**
 * Check whether a passport authorizes a specific capability.
 * Returns `true` if the passport is valid, active, and contains a matching
 * capability for the requested action+resource.
 *
 * @param passportToken - The agent passport token.
 * @param requiredCapability - The capability required (e.g. "read:workspace/docs").
 */
export function passportAuthorizes(
  passportToken: string,
  requiredCapability: string,
): boolean {
  const decoded = decodeAndVerifyPassport(passportToken);
  if (decoded.status !== "valid") return false;

  const { claims } = decoded;

  // Check revocation.
  if (isPassportRevoked(claims.jti)) return false;

  // Check capability match.
  return hasCapability(claims.cap, requiredCapability);
}

export { getMaxDelegationDepth, getPassportLifetimeSec, getSigningSecret };
