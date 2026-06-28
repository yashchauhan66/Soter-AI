// ── Agent Identity Fabric — DB-backed Persistent Store ──────────────────────
// Replaces all in-memory stores (revokedJtis Set, servicePrincipals Map) with
// Prisma queries against the IdentityFabric* models. All functions gracefully
// handle missing DB tables (catch and fall back gracefully for MVP).
// ────────────────────────────────────────────────────────────────────────────

import { db } from "@/lib/db";
import type { AgentPassportClaims, AgentServicePrincipal, DelegationProof } from "./types";

// ── Helpers ──────────────────────────────────────────────────────────────────

function safeJson<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string") {
    try { return JSON.parse(value) as T; } catch { return fallback; }
  }
  return value as T;
}

// ── Passport Recording ───────────────────────────────────────────────────────

/**
 * Record a passport issuance in the database. Idempotent on JTI.
 */
export async function recordPassportIssuance(
  projectId: string,
  claims: AgentPassportClaims,
): Promise<void> {
  try {
    await db.identityFabricPassport.upsert({
      where: { jti: claims.jti },
      create: {
        projectId,
        jti: claims.jti,
        subjectId: claims.sub,
        capabilitiesJson: JSON.stringify(claims.cap),
        audience: claims.aud ?? null,
        scope: claims.scope ?? null,
        parentJti: claims.prt ?? null,
        depth: claims.depth ?? 0,
        issuedAt: new Date(claims.iat * 1000),
        expiresAt: new Date(claims.exp * 1000),
      },
      update: {}, // No-op on conflict
    });
  } catch {
    // Gracefully handle missing table / migration not yet run
  }
}

// ── Revocation ───────────────────────────────────────────────────────────────

/**
 * Record a passport revocation in the DB and update the passport record.
 */
export async function dbRevokePassport(
  projectId: string,
  jti: string,
  reason?: string,
): Promise<void> {
  try {
    await db.identityFabricRevocation.create({
      data: { projectId, jti, reason: reason ?? null },
    });
    // Also mark the passport as revoked
    await db.identityFabricPassport.updateMany({
      where: { jti },
      data: { revokedAt: new Date() },
    });
  } catch {
    // Gracefully handle missing table
  }
}

/**
 * Check whether a JTI has been revoked via the DB.
 */
export async function dbIsPassportRevoked(jti: string): Promise<boolean> {
  try {
    const count = await db.identityFabricRevocation.count({
      where: { jti },
    });
    return count > 0;
  } catch {
    return false;
  }
}

/**
 * Count revocations for a project (for dashboard metrics).
 */
export async function dbCountRevocations(projectId: string): Promise<number> {
  try {
    return await db.identityFabricRevocation.count({ where: { projectId } });
  } catch {
    return 0;
  }
}

/**
 * Get recent revocations for a project (for dashboard display).
 */
export async function dbRecentRevocations(projectId: string, limit = 10) {
  try {
    return await db.identityFabricRevocation.findMany({
      where: { projectId },
      orderBy: { revokedAt: "desc" },
      take: limit,
    });
  } catch {
    return [];
  }
}

// ── Service Principal Mapping ────────────────────────────────────────────────

/**
 * Register or update a service principal mapping.
 */
export async function dbRegisterServicePrincipal(
  projectId: string,
  principalId: string,
  provider: string,
  agentIdentityId: string,
  scopes: string[],
): Promise<AgentServicePrincipal | null> {
  try {
  const record = await db.identityFabricServicePrincipal.upsert({
    where: { projectId_provider_principalId: { projectId, provider, principalId } },
    create: {
      projectId,
      principalId,
      provider,
      agentIdentityId,
      scopesJson: JSON.stringify(scopes),
    },
    update: {
      agentIdentityId,
      scopesJson: JSON.stringify(scopes),
      lastUsedAt: new Date(),
    },
  });

  return {
    principalId: record.principalId,
    provider: record.provider as AgentServicePrincipal["provider"],
    agentIdentityId: record.agentIdentityId,
    scopes: safeJson<string[]>(record.scopesJson, []),
    createdAt: record.createdAt,
    lastUsedAt: record.lastUsedAt ?? undefined,
  };
  } catch {
    return null;
  }
}

/**
 * Look up a service principal by provider + principalId.
 */
export async function dbGetServicePrincipal(
  projectId: string,
  provider: string,
  principalId: string,
): Promise<AgentServicePrincipal | null> {
  try {
    const record = await db.identityFabricServicePrincipal.findUnique({
      where: { projectId_provider_principalId: { projectId, provider, principalId } },
    });
    if (!record) return null;
    return {
      principalId: record.principalId,
      provider: record.provider as AgentServicePrincipal["provider"],
      agentIdentityId: record.agentIdentityId,
      scopes: safeJson<string[]>(record.scopesJson, []),
      createdAt: record.createdAt,
      lastUsedAt: record.lastUsedAt ?? undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Find all service principals for a given agent identity.
 */
export async function dbGetAgentPrincipals(
  projectId: string,
  agentIdentityId: string,
): Promise<AgentServicePrincipal[]> {
  try {
    const records = await db.identityFabricServicePrincipal.findMany({
      where: { projectId, agentIdentityId },
    });
    return records.map((r) => ({
      principalId: r.principalId,
      provider: r.provider as AgentServicePrincipal["provider"],
      agentIdentityId: r.agentIdentityId,
      scopes: safeJson<string[]>(r.scopesJson, []),
      createdAt: r.createdAt,
      lastUsedAt: r.lastUsedAt ?? undefined,
    }));
  } catch {
    return [];
  }
}

/**
 * Touch (update lastUsedAt) for a service principal.
 */
export async function dbTouchServicePrincipal(
  projectId: string,
  provider: string,
  principalId: string,
): Promise<void> {
  try {
    await db.identityFabricServicePrincipal.update({
      where: { projectId_provider_principalId: { projectId, provider, principalId } },
      data: { lastUsedAt: new Date() },
    });
  } catch {
    // Graceful
  }
}

/**
 * Remove a service principal mapping.
 */
export async function dbRemoveServicePrincipal(
  projectId: string,
  provider: string,
  principalId: string,
): Promise<boolean> {
  try {
    await db.identityFabricServicePrincipal.delete({
      where: { projectId_provider_principalId: { projectId, provider, principalId } },
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Count service principals for a project (dashboard metrics).
 */
export async function dbCountServicePrincipals(projectId: string): Promise<number> {
  try {
    return await db.identityFabricServicePrincipal.count({ where: { projectId } });
  } catch {
    return 0;
  }
}

/**
 * List recent service principals for dashboard.
 */
export async function dbRecentServicePrincipals(projectId: string, limit = 10) {
  try {
    return await db.identityFabricServicePrincipal.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  } catch {
    return [];
  }
}

// ── Delegation Recording ─────────────────────────────────────────────────────

/**
 * Record a delegation proof in the DB.
 */
export async function dbRecordDelegation(
  projectId: string,
  proof: DelegationProof,
): Promise<void> {
  try {
    await db.identityFabricDelegation.upsert({
      where: { proofHash: proof.proofHash },
      create: {
        projectId,
        parentPassportJti: proof.parentPassportJti,
        childAgentIdentityId: proof.childAgentIdentityId,
        policyHash: proof.policyHash,
        proofHash: proof.proofHash,
        depth: proof.depth,
      },
      update: {},
    });
  } catch {
    // Graceful
  }
}

/**
 * Count delegations for a project (dashboard metrics).
 */
export async function dbCountDelegations(projectId: string): Promise<number> {
  try {
    return await db.identityFabricDelegation.count({ where: { projectId } });
  } catch {
    return 0;
  }
}

/**
 * Get recent delegations for dashboard display.
 */
export async function dbRecentDelegations(projectId: string, limit = 10) {
  try {
    return await db.identityFabricDelegation.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  } catch {
    return [];
  }
}

// ── Challenge Recording ──────────────────────────────────────────────────────

/**
 * Record an auth challenge in the DB.
 */
export async function dbRecordChallenge(
  projectId: string,
  challengeToken: string,
  sourceAgentId: string,
  targetAgentId: string,
  expiresAt: Date,
): Promise<void> {
  try {
    await db.identityFabricChallenge.upsert({
      where: { challenge: challengeToken },
      create: {
        projectId,
        challenge: challengeToken,
        sourceAgentId,
        targetAgentId,
        expiresAt,
      },
      update: {},
    });
  } catch {
    // Graceful
  }
}

/**
 * Update a challenge with its verification result.
 */
export async function dbVerifyChallenge(
  challengeToken: string,
  signature: string,
): Promise<void> {
  try {
    await db.identityFabricChallenge.update({
      where: { challenge: challengeToken },
      data: { signature, verified: true },
    });
  } catch {
    // Graceful
  }
}

/**
 * Count challenges for a project.
 */
export async function dbCountChallenges(projectId: string): Promise<number> {
  try {
    return await db.identityFabricChallenge.count({ where: { projectId } });
  } catch {
    return 0;
  }
}

// ── Dashboard Aggregate Queries ──────────────────────────────────────────────

export interface IdentityFabricStats {
  passportsIssued: number;
  activePassports: number;
  revocations: number;
  servicePrincipals: number;
  delegations: number;
  challenges: number;
}

/**
 * Get aggregate statistics for the identity fabric dashboard.
 */
export async function dbGetFabricStats(projectId: string): Promise<IdentityFabricStats> {
  const now = new Date();
  try {
    const [passportsIssued, activePassports, revocations, servicePrincipals, delegations, challenges] =
      await Promise.all([
        db.identityFabricPassport.count({ where: { projectId } }),
        db.identityFabricPassport.count({
          where: { projectId, expiresAt: { gt: now }, revokedAt: null },
        }),
        db.identityFabricRevocation.count({ where: { projectId } }),
        db.identityFabricServicePrincipal.count({ where: { projectId } }),
        db.identityFabricDelegation.count({ where: { projectId } }),
        db.identityFabricChallenge.count({ where: { projectId } }),
      ]);
    return { passportsIssued, activePassports, revocations, servicePrincipals, delegations, challenges };
  } catch {
    return { passportsIssued: 0, activePassports: 0, revocations: 0, servicePrincipals: 0, delegations: 0, challenges: 0 };
  }
}
