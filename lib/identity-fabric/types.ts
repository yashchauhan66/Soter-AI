// ── Agent Identity Fabric — Core Types ──────────────────────────────────────
// Treats every AI agent as a first-class security principal with its own
// cryptographic identity, scoped capabilities, and auditable delegation chain.
// ────────────────────────────────────────────────────────────────────────────

import { AGENT_IDENTITY_TYPES, AGENT_IDENTITY_STATUSES } from "@/lib/agent-passport";

/** Re-export known agent identity constants for convenience. */
export type AgentIdentityType = (typeof AGENT_IDENTITY_TYPES)[number];
export type AgentIdentityStatus = (typeof AGENT_IDENTITY_STATUSES)[number];

// ── Capability Model ─────────────────────────────────────────────────────────
// Format: <action>:<resource>[/<subresource>][?<key>=<value>&...]
// Examples:
//   "read:workspace/docs/*"
//   "write:rag/collection/my-collection"
//   "execute:tool/gmail.send?sensitivity=high"
//   "admin:project/settings/*"
// ──────────────────────────────────────────────────────────────────────────────

export const CAPABILITY_ACTIONS = [
  "read",
  "write",
  "execute",
  "admin",
  "delegate",
  "inspect",
  "create",
  "delete",
  "modify",
] as const;

export type CapabilityAction = (typeof CAPABILITY_ACTIONS)[number];

export interface ParsedCapability {
  /** The verb — what action is allowed. */
  action: CapabilityAction;
  /** The resource path (may include globs). */
  resource: string;
  /** Optional sub-resource qualifier. */
  subresource?: string;
  /** Key-value conditions that constrain the capability. */
  conditions: Record<string, string>;
}

export interface CapabilityMatchOptions {
  /** When true, a stricter capability can satisfy a broader request (default). */
  allowStrictToBroad?: boolean;
  /** When true, conditions must be a superset of request conditions. */
  strictConditions?: boolean;
}

// ── Cryptographic Passport ───────────────────────────────────────────────────
// A JWT-like token signed with HMAC-SHA256. Uses a structured JSON payload,
// a versioned format, and a peppered signing key.
// ──────────────────────────────────────────────────────────────────────────────

export const PASSPORT_TOKEN_PREFIX = "st";
export const PASSPORT_TOKEN_VERSION = "v1";

export type PassportTokenVersion = typeof PASSPORT_TOKEN_VERSION;

export interface AgentPassportClaims {
  /** Agent identity ID (subject). */
  sub: string;
  /** Issuer — always "soter-identity-fabric". */
  iss: string;
  /** Capability strings. */
  cap: string[];
  /** Issued-at timestamp (epoch seconds). */
  iat: number;
  /** Expiry timestamp (epoch seconds). */
  exp: number;
  /** Unique token ID (for revocation). */
  jti: string;
  /** Intended audience (target service / tool). */
  aud?: string;
  /** Task scope label (optional, for task-bound tokens). */
  scope?: string;
  /** Parent token JTI for delegation chain (optional). */
  prt?: string;
  /** Delegation depth (how many hops from root). */
  depth?: number;
}

export interface DecodedPassport {
  /** Raw token string. */
  raw: string;
  /** Parsed claims. */
  claims: AgentPassportClaims;
  /** Whether the signature is valid. */
  valid: boolean;
  /** Whether the token is within its time bounds. */
  active: boolean;
  /** Human-readable status. */
  status: "valid" | "expired" | "not-yet-active" | "invalid-signature";
}

export type PassportRevocationReason =
  | "compromised"
  | "session-ended"
  | "permission-changed"
  | "agent-deactivated"
  | "admin-revoked";

// ── Task Tokens ──────────────────────────────────────────────────────────────
// Ultra-short-lived (default 5 min) single-purpose tokens that authorize one
// specific operation. Derived from a parent passport via token exchange.
// ──────────────────────────────────────────────────────────────────────────────

export const TASK_TOKEN_LIFETIME_SEC = 300; // 5 minutes
export const DEFAULT_PASSPORT_LIFETIME_SEC = 3600; // 1 hour

export interface TaskTokenRequest {
  /** Parent passport token to exchange. */
  parentToken: string;
  /** Specific capability required for this task. */
  requiredCapability: string;
  /** Target service or tool. */
  audience: string;
  /** Optional context about the task. */
  context?: string;
}

export interface TaskToken {
  raw: string;
  claims: AgentPassportClaims;
  expiresAt: Date;
  parentJti: string;
}

// ── Delegation Proof ─────────────────────────────────────────────────────────
// Cryptographic proof that a capability was delegated through a valid chain.
// ──────────────────────────────────────────────────────────────────────────────

export interface DelegationProof {
  /** Versioned format marker. */
  format: "soter.delegation.v1";
  /** The child agent receiving delegated capabilities. */
  childAgentIdentityId: string;
  /** The parent passport that granted the delegation. */
  parentPassportJti: string;
  /** The policy snapshot hash at delegation time. */
  policyHash: string;
  /** Signed hash of the entire proof. */
  proofHash: string;
  /** How deep in the chain (0 = root). */
  depth: number;
}

// ── IdP Integration ──────────────────────────────────────────────────────────
// Maps agent identities to IdP service principals (Okta, Azure AD).
// ──────────────────────────────────────────────────────────────────────────────

export const SUPPORTED_IDP_PROVIDERS = ["okta", "azure-ad", "generic-saml"] as const;
export type IdpProvider = (typeof SUPPORTED_IDP_PROVIDERS)[number];

export interface AgentServicePrincipal {
  /** IdP-specific principal ID. */
  principalId: string;
  /** The IdP provider. */
  provider: IdpProvider;
  /** The agent identity this principal maps to. */
  agentIdentityId: string;
  /** Scopes authorized for this principal. */
  scopes: string[];
  /** When this mapping was created. */
  createdAt: Date;
  /** When this mapping was last used. */
  lastUsedAt?: Date;
}

export interface IdpTokenExchangeRequest {
  /** The IdP-issued token (JWT or SAML assertion). */
  idpToken: string;
  /** The IdP provider. */
  provider: IdpProvider;
  /** The organization context. */
  organizationId: string;
}

// ── Cross-Agent Verification ─────────────────────────────────────────────────
// Challenge-response protocol for agent-to-agent authentication.
// ──────────────────────────────────────────────────────────────────────────────

export interface AuthChallenge {
  /** Random nonce. */
  challenge: string;
  /** Target agent identity that must respond. */
  targetAgentId: string;
  /** Issuing agent identity. */
  sourceAgentId: string;
  /** Expiry timestamp (epoch seconds). */
  expiresAt: number;
}

export interface AuthResponse {
  /** The challenge that was signed. */
  challenge: string;
  /** HMAC signature over the challenge. */
  signature: string;
  /** The responding agent's passport token. */
  passportToken: string;
  /** Timestamp of the response (epoch seconds). */
  respondedAt: number;
}

export interface VerificationResult {
  /** Whether verification succeeded. */
  verified: boolean;
  /** The verified agent identity ID. */
  agentIdentityId?: string;
  /** Any error or reason for failure. */
  reason?: string;
}

// ── Signing Configuration ────────────────────────────────────────────────────

export interface IdentityFabricConfig {
  /** HMAC signing secret (falls back to API_KEY_PEPPER or AUTH_SECRET). */
  signingSecret?: string;
  /** Default passport lifetime in seconds. */
  passportLifetimeSec?: number;
  /** Maximum delegation depth. */
  maxDelegationDepth?: number;
  /** Whether to require IdP-backed passports in production. */
  requireIdpInProduction?: boolean;
}
