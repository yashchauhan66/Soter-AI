// ── Agent Identity Fabric — Cross-Agent Verification Protocol ───────────────
// Enables agent-to-agent authentication using challenge-response with HMAC
// signatures. Agents can cryptographically verify each other's identities
// before sharing data or delegating tasks.
// ────────────────────────────────────────────────────────────────────────────

import { createHash, randomBytes } from "crypto";
import {
  type AuthChallenge,
  type AuthResponse,
  type VerificationResult,
} from "./types";
import { decodeAndVerifyPassport, getSigningSecret } from "./passport";
import { hasCapability } from "./capabilities";

const CHALLENGE_EXPIRY_SEC = 120; // Challenges expire after 2 minutes.
const CHALLENGE_LENGTH = 32; // Random challenge bytes.

// ── Challenge Generation ─────────────────────────────────────────────────────

/**
 * Create an authentication challenge for agent-to-agent verification.
 *
 * @param sourceAgentId - The agent requesting verification.
 * @param targetAgentId - The agent being challenged.
 * @returns A challenge object.
 */
export function createAuthChallenge(
  sourceAgentId: string,
  targetAgentId: string,
): AuthChallenge {
  const challenge = randomBytes(CHALLENGE_LENGTH).toString("base64url");
  const now = Math.floor(Date.now() / 1000);

  return {
    challenge,
    targetAgentId,
    sourceAgentId,
    expiresAt: now + CHALLENGE_EXPIRY_SEC,
  };
}

// ── Challenge Response ───────────────────────────────────────────────────────

/**
 * Respond to an authentication challenge by signing it with the agent's
 * passport-derived key.
 *
 * @param challenge - The challenge to respond to.
 * @param passportToken - The responding agent's passport token.
 * @returns A signed response.
 */
export function respondToAuthChallenge(
  challenge: AuthChallenge,
  passportToken: string,
): AuthResponse | null {
  // Verify the challenge hasn't expired.
  const now = Math.floor(Date.now() / 1000);
  if (now > challenge.expiresAt) return null;

  // Verify the passport is valid.
  const decoded = decodeAndVerifyPassport(passportToken);
  if (decoded.status !== "valid") return null;

  // The passport's subject must match the target agent.
  if (decoded.claims.sub !== challenge.targetAgentId) return null;

  // Sign the challenge with the shared signing secret.
  const signature = createHash("sha256")
    .update(`auth-challenge:${challenge.challenge}:${challenge.targetAgentId}:${getSigningSecret()}`)
    .digest("hex");

  return {
    challenge: challenge.challenge,
    signature,
    passportToken,
    respondedAt: now,
  };
}

// ── Response Verification ────────────────────────────────────────────────────

/**
 * Verify an authentication response.
 *
 * @param challenge - The original challenge.
 * @param response - The response to verify.
 * @returns A verification result.
 */
export function verifyAuthResponse(
  challenge: AuthChallenge,
  response: AuthResponse,
): VerificationResult {
  // 1. Check challenge expiry.
  const now = Math.floor(Date.now() / 1000);
  if (now > challenge.expiresAt) {
    return { verified: false, reason: "Authentication challenge has expired." };
  }

  // 2. Verify challenge integrity.
  if (response.challenge !== challenge.challenge) {
    return { verified: false, reason: "Challenge mismatch — possible replay attack." };
  }

  // 3. Verify the signature.
  const expectedSignature = createHash("sha256")
    .update(`auth-challenge:${challenge.challenge}:${challenge.targetAgentId}:${getSigningSecret()}`)
    .digest("hex");

  if (response.signature !== expectedSignature) {
    return { verified: false, reason: "Invalid signature — agent identity not verified." };
  }

  // 4. Verify the agent's passport.
  const decoded = decodeAndVerifyPassport(response.passportToken);
  if (decoded.status !== "valid") {
    return { verified: false, reason: `Responding agent's passport is ${decoded.status}.` };
  }

  // 5. Verify the passport subject matches the challenged agent.
  if (decoded.claims.sub !== challenge.targetAgentId) {
    return { verified: false, reason: "Passport subject does not match the challenged agent." };
  }

  return {
    verified: true,
    agentIdentityId: decoded.claims.sub,
  };
}

// ── Direct Verification ──────────────────────────────────────────────────────

/**
 * Verify an agent's identity directly by checking their passport.
 * This is a simpler alternative to challenge-response for scenarios where
 * both agents trust the identity fabric's signing key distribution.
 *
 * @param targetToken - The target agent's passport to verify.
 * @param expectedAgentId - The agent ID we expect to verify.
 * @param requiredCapability - Optional: a capability the agent must possess.
 * @returns A verification result.
 */
export function verifyAgentIdentity(
  targetToken: string,
  expectedAgentId?: string,
  requiredCapability?: string,
): VerificationResult {
  const decoded = decodeAndVerifyPassport(targetToken);
  if (decoded.status !== "valid") {
    return { verified: false, reason: `Passport is ${decoded.status}.` };
  }

  const { claims } = decoded;

  // Verify expected identity.
  if (expectedAgentId && claims.sub !== expectedAgentId) {
    return {
      verified: false,
      reason: `Passport subject (${claims.sub}) does not match expected agent (${expectedAgentId}).`,
    };
  }

  // Verify required capability.
  if (requiredCapability) {
    if (!hasCapability(claims.cap, requiredCapability)) {
      return {
        verified: false,
        reason: `Agent lacks required capability: ${requiredCapability}.`,
      };
    }
  }

  return { verified: true, agentIdentityId: claims.sub };
}

// ── Utility ──────────────────────────────────────────────────────────────────

/**
 * Check if an auth challenge has expired.
 */
export function isChallengeExpired(challenge: AuthChallenge): boolean {
  const now = Math.floor(Date.now() / 1000);
  return now > challenge.expiresAt;
}

/**
 * Get the time-to-live of a challenge in seconds.
 */
export function challengeTtl(challenge: AuthChallenge): number {
  const now = Math.floor(Date.now() / 1000);
  return Math.max(0, challenge.expiresAt - now);
}
