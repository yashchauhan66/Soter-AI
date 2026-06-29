// ── Agent Identity Fabric — Token Exchange & Delegation ─────────────────────
// Implements OAuth-style token exchange: short-lived task tokens derived from
// parent passports, credential delegation across agent chains, and full
// delegation chain verification.
// ────────────────────────────────────────────────────────────────────────────

import {
  TASK_TOKEN_LIFETIME_SEC,
  type TaskTokenRequest,
  type TaskToken,
  type DelegationProof,
  type AgentPassportClaims,
} from "./types";
import {
  createAgentPassport,
  verifyAgentPassport,
  getMaxDelegationDepth,
} from "./passport";
import { intersectCapabilities, hasCapability } from "./capabilities";

// ── Task Token Exchange ─────────────────────────────────────────────────────

/**
 * Exchange a parent passport for a short-lived task token. This is the core
 * of credential delegation: a parent agent grants a child agent the minimum
 * capabilities needed for a single task.
 *
 * The task token:
 * - Has a very short TTL (default 5 minutes)
 * - Carries a single required capability
 * - Is bound to a specific audience (the target service/tool)
 * - References the parent passport JTI in its delegation chain
 *
 * @param request - The task token exchange request.
 * @returns A task token, or null if the parent passport is invalid or lacks
 *          the required capability.
 */
export function exchangePassportForTask(request: TaskTokenRequest): TaskToken | null {
  // 1. Verify the parent passport.
  const decoded = verifyAgentPassport(request.parentToken);
  if (decoded.status !== "valid") return null;

  const { claims: parentClaims } = decoded;

  // 2. Check the parent has the required capability.
  const authorized = hasCapability(parentClaims.cap, request.requiredCapability);
  if (!authorized) return null;

  // 3. Calculate delegation depth.
  const depth = (parentClaims.depth ?? 0) + 1;
  if (depth > getMaxDelegationDepth()) return null;

  // 4. Create the task-bound passport.
  const taskPassport = createAgentPassport(
    parentClaims.sub,
    [request.requiredCapability],
    {
      audience: request.audience,
      scope: `task:${request.context ?? request.requiredCapability}`,
      parentJti: parentClaims.jti,
      depth,
      lifetimeSec: TASK_TOKEN_LIFETIME_SEC,
    },
  );

  return {
    raw: taskPassport.raw,
    claims: taskPassport.claims,
    expiresAt: new Date(taskPassport.claims.exp * 1000),
    parentJti: parentClaims.jti,
  };
}

// ── Credential Delegation ────────────────────────────────────────────────────

export interface CredentialDelegationRequest {
  /** The parent passport authorizing the delegation. */
  parentPassport: string;
  /** The child agent identity receiving delegated capabilities. */
  childAgentIdentityId: string;
  /** The capabilities being delegated. */
  delegatedCapabilities: string[];
  /** The context/intent for this delegation. */
  intent: string;
}

export interface CredentialDelegationResult {
  /** Whether the delegation was approved. */
  allowed: boolean;
  /** The resulting child capabilities (intersection of parent and requested). */
  resultingCapabilities: string[];
  /** The delegation proof (if allowed). */
  proof: DelegationProof | null;
  /** Any violations that prevented full delegation. */
  violations: string[];
}

/**
 * Delegate capabilities from a parent passport to a child agent.
 *
 * This performs a capability intersection: the child can only receive
 * capabilities that the parent already possesses. This prevents privilege
 * escalation through delegation.
 *
 * @param request - The credential delegation request.
 * @returns The delegation result with intersected capabilities and proof.
 */
export function delegateCredentials(
  request: CredentialDelegationRequest,
): CredentialDelegationResult {
  const violations: string[] = [];

  // 1. Verify parent passport.
  const decoded = verifyAgentPassport(request.parentPassport);
  if (decoded.status !== "valid") {
    return {
      allowed: false,
      resultingCapabilities: [],
      proof: null,
      violations: ["Parent passport is invalid or expired."],
    };
  }

  const parentClaims = decoded.claims;

  // 2. Check delegation depth limit.
  const parentDepth = parentClaims.depth ?? 0;
  if (parentDepth + 1 > getMaxDelegationDepth()) {
    return {
      allowed: false,
      resultingCapabilities: [],
      proof: null,
      violations: ["Maximum delegation depth exceeded."],
    };
  }

  // 3. Intersect requested capabilities with parent capabilities.
  const intersected = intersectCapabilities(
    parentClaims.cap,
    request.delegatedCapabilities,
  );

  // 4. Check that the intersection is non-empty.
  if (intersected.length === 0) {
    violations.push("None of the requested capabilities are covered by the parent passport.");
    return {
      allowed: false,
      resultingCapabilities: [],
      proof: null,
      violations,
    };
  }

  // 5. Build delegation proof.
  const proof = createDelegationProof({
    parentPassportJti: parentClaims.jti,
    childAgentIdentityId: request.childAgentIdentityId,
    policy: intersected,
    depth: parentDepth + 1,
  });

  return {
    allowed: true,
    resultingCapabilities: intersected,
    proof,
    violations,
  };
}

// ── Delegation Proof ─────────────────────────────────────────────────────────

import { createHash } from "crypto";

interface DelegationProofInput {
  parentPassportJti: string;
  childAgentIdentityId: string;
  policy: string[];
  depth: number;
}

/**
 * Create a cryptographic proof of delegation. The proof includes a hash of
 * the delegated policy and a chain hash for auditability.
 */
export function createDelegationProof(input: DelegationProofInput): DelegationProof {
  const policyHash = createHash("sha256")
    .update(JSON.stringify([...input.policy].sort()))
    .digest("hex");

  const proofPayload = {
    format: "soter.delegation.v1" as const,
    parentPassportJti: input.parentPassportJti,
    childAgentIdentityId: input.childAgentIdentityId,
    policyHash,
    depth: input.depth,
  };

  const proofHash = createHash("sha256")
    .update(`delegation.${proofPayload.parentPassportJti}.${proofPayload.childAgentIdentityId}.${proofPayload.policyHash}.${proofPayload.depth}`)
    .digest("hex");

  return {
    ...proofPayload,
    proofHash,
  };
}

// ── Chain Verification ───────────────────────────────────────────────────────

export interface DelegationChainLink {
  /** The passport token at this link. */
  passportToken: string;
  /** The delegation proof (optional for root). */
  proof?: DelegationProof;
}

/**
 * Verify an entire delegation chain from root to leaf.
 * Each link in the chain must:
 * 1. Be a valid, active passport
 * 2. Have capabilities that are a subset of the previous link
 * 3. Not exceed the maximum delegation depth
 *
 * @param chain - Ordered chain of delegation links (root first, leaf last).
 * @returns Whether the chain is valid and any violations found.
 */
export function verifyDelegationChain(
  chain: DelegationChainLink[],
): { valid: boolean; violations: string[] } {
  const violations: string[] = [];

  if (chain.length === 0) {
    return { valid: false, violations: ["Delegation chain is empty."] };
  }

  if (chain.length > getMaxDelegationDepth() + 1) {
    return { valid: false, violations: ["Delegation chain exceeds maximum depth."] };
  }

  for (let i = 0; i < chain.length; i++) {
    const link = chain[i];

    // 1. Verify passport.
    const decoded = verifyAgentPassport(link.passportToken);
    if (decoded.status !== "valid") {
      violations.push(`Link ${i}: passport is ${decoded.status}.`);
      continue;
    }

    const claims = decoded.claims;

    // 2. Check chain linkage.
    if (i > 0) {
      const prevClaims = (() => {
        const prev = verifyAgentPassport(chain[i - 1].passportToken);
        return prev.status === "valid" ? prev.claims : null;
      })();

      if (prevClaims) {
        // The current passport's parent JTI must match the previous passport's JTI.
        if (claims.prt !== prevClaims.jti) {
          violations.push(
            `Link ${i}: parent JTI mismatch (expected ${prevClaims.jti}, got ${claims.prt}).`,
          );
        }

        // Capabilities must be a subset of the previous link.
        for (const cap of claims.cap) {
          if (!hasCapability(prevClaims.cap, cap)) {
            violations.push(
              `Link ${i}: capability "${cap}" exceeds parent's capabilities.`,
            );
          }
        }
      }
    }
  }

  return { valid: violations.length === 0, violations };
}

// ── Utility ──────────────────────────────────────────────────────────────────

/**
 * Check if a token is a task-bound passport (has a scope starting with "task:").
 */
export function isTaskToken(claims: AgentPassportClaims): boolean {
  return claims.scope?.startsWith("task:") ?? false;
}

/**
 * Get the remaining time-to-live for a passport in seconds.
 */
export function getTokenTtl(claims: AgentPassportClaims): number {
  const now = Math.floor(Date.now() / 1000);
  return Math.max(0, claims.exp - now);
}
