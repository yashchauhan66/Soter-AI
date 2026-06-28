// ── Agent Identity Fabric — Identity Provider Integration ───────────────────
// Maps agent identities to IdP service principals (Okta, Azure AD) so agents
// appear as managed service principals in enterprise directories. Supports
// token exchange between IdP-issued tokens and Soter passports.
//
// Uses an in-memory cache for fast lookups and provides DB-backed alternative
// functions in db.ts for persistent storage.
// ────────────────────────────────────────────────────────────────────────────

import { createHash } from "crypto";
import {
  SUPPORTED_IDP_PROVIDERS,
  type IdpProvider,
  type AgentServicePrincipal,
  type IdpTokenExchangeRequest,
} from "./types";
import { createAgentPassport, getSigningSecret } from "./passport";
import { dbRecentServicePrincipals } from "./db";

// ── Service Principal Mapping (In-Memory Cache) ──────────────────────────────
// Fast-path cache for lookups. The DB layer (db.ts) provides persistent storage.
// On startup, you can use `loadServicePrincipalsFromDb()` to hydrate the cache.

const servicePrincipals = new Map<string, AgentServicePrincipal>();

/**
 * Register a Soter agent as a service principal in the identity fabric.
 * Creates the mapping between an agent identity and its IdP representation.
 *
 * @param principalId - The IdP's service principal ID.
 * @param provider - The IdP provider (okta, azure-ad, generic-saml).
 * @param agentIdentityId - The Soter agent identity ID to map.
 * @param scopes - The OAuth scopes authorized for this principal.
 * @returns The created service principal mapping.
 */
export function registerAgentServicePrincipal(
  principalId: string,
  provider: IdpProvider,
  agentIdentityId: string,
  scopes: string[] = [],
): AgentServicePrincipal {
  if (!(SUPPORTED_IDP_PROVIDERS as readonly string[]).includes(provider)) {
    throw new Error(`Unsupported IdP provider: ${provider}. Supported: ${SUPPORTED_IDP_PROVIDERS.join(", ")}`);
  }

  const mapping: AgentServicePrincipal = {
    principalId,
    provider,
    agentIdentityId,
    scopes,
    createdAt: new Date(),
  };

  const key = `${provider}:${principalId}`;
  servicePrincipals.set(key, mapping);

  return mapping;
}

/**
 * Look up a service principal by its IdP provider and principal ID.
 */
export function getServicePrincipal(
  provider: IdpProvider,
  principalId: string,
): AgentServicePrincipal | undefined {
  return servicePrincipals.get(`${provider}:${principalId}`);
}

/**
 * Find all service principal mappings for a given agent identity.
 */
export function getAgentServicePrincipals(
  agentIdentityId: string,
): AgentServicePrincipal[] {
  return Array.from(servicePrincipals.values()).filter(
    (sp) => sp.agentIdentityId === agentIdentityId,
  );
}

/**
 * Update the last-used timestamp for a service principal.
 */
export function touchServicePrincipal(
  provider: IdpProvider,
  principalId: string,
): void {
  const key = `${provider}:${principalId}`;
  const existing = servicePrincipals.get(key);
  if (existing) {
    existing.lastUsedAt = new Date();
  }
}

/**
 * Remove a service principal mapping.
 */
export function unregisterAgentServicePrincipal(
  provider: IdpProvider,
  principalId: string,
): boolean {
  return servicePrincipals.delete(`${provider}:${principalId}`);
}

/**
 * Hydrate the in-memory cache from the database (called at startup).
 */
export async function loadServicePrincipalsFromDb(projectId: string): Promise<void> {
  try {
    const records = await dbRecentServicePrincipals(projectId, 500);
    for (const record of records) {
      const mapping: AgentServicePrincipal = {
        principalId: record.principalId,
        provider: record.provider as IdpProvider,
        agentIdentityId: record.agentIdentityId,
        scopes: (() => {
          try { return JSON.parse(typeof record.scopesJson === "string" ? record.scopesJson : "[]"); } catch { return []; }
        })(),
        createdAt: record.createdAt,
        lastUsedAt: record.lastUsedAt ?? undefined,
      };
      servicePrincipals.set(`${record.provider}:${record.principalId}`, mapping);
    }
  } catch {
    // DB not available yet
  }
}

// ── IdP Token Exchange ──────────────────────────────────────────────────────

/**
 * Exchange an IdP-issued token for a Soter agent passport.
 */
export function exchangeIdpTokenForPassport(
  request: IdpTokenExchangeRequest,
  agentIdentityId: string,
): { raw: string; principal: AgentServicePrincipal } | null {
  if (!(SUPPORTED_IDP_PROVIDERS as readonly string[]).includes(request.provider)) {
    return null;
  }

  const principals = getAgentServicePrincipals(agentIdentityId);
  const principal = principals.find((sp) => sp.provider === request.provider);
  if (!principal) return null;

  touchServicePrincipal(request.provider, principal.principalId);

  const capabilities = principal.scopes.map((scope) => {
    const scopeLower = scope.toLowerCase();
    if (scopeLower.startsWith("rag:")) return "read:rag/*";
    if (scopeLower.startsWith("agent:")) return "execute:agent/*";
    if (scopeLower.startsWith("admin:")) return "admin:project/*";
    if (scopeLower.startsWith("tool:")) return `execute:tool/${scopeLower.slice(5)}`;
    return scopeLower;
  });

  const passport = createAgentPassport(agentIdentityId, capabilities, {
    audience: request.provider,
    scope: `idp:${request.provider}`,
  });

  return { raw: passport.raw, principal };
}

// ── SCIM Sync Helper ─────────────────────────────────────────────────────────

/**
 * Generate a deterministic external ID for an agent identity (for SCIM sync).
 */
export function generateAgentScimExternalId(
  agentIdentityId: string,
  organizationId: string,
): string {
  return createHash("sha256")
    .update(`scim-agent:${organizationId}:${agentIdentityId}:${getSigningSecret()}`)
    .digest("hex")
    .slice(0, 32);
}

/**
 * Build a SCIM-compatible service principal representation for an agent.
 */
export function buildAgentScimProfile(
  agentName: string,
  agentIdentityId: string,
  organizationId: string,
): {
  externalId: string;
  userName: string;
  displayName: string;
  active: boolean;
} {
  return {
    externalId: generateAgentScimExternalId(agentIdentityId, organizationId),
    userName: `agent-${agentIdentityId.slice(0, 8)}@soter-identity-fabric`,
    displayName: `Agent: ${agentName}`,
    active: true,
  };
}

// ── Utility ──────────────────────────────────────────────────────────────────

export function servicePrincipalCount(): number {
  return servicePrincipals.size;
}

export function listAllServicePrincipals(): AgentServicePrincipal[] {
  return Array.from(servicePrincipals.values());
}
