// ── Agent Identity Fabric — Public API ───────────────────────────────────────
// Barrel exports for the entire identity fabric module.
// ────────────────────────────────────────────────────────────────────────────

// Types
export * from "./types";

// Capability Engine
export {
  parseCapability,
  normalizeCapability,
  serializeCapability,
  capabilityMatches,
  hasCapability,
  intersectCapabilities,
  validateCapabilityChain,
  normalizeCapabilities,
  isValidCapability,
} from "./capabilities";
export type { CapabilityChainNode } from "./capabilities";

// Passport System
export {
  configureIdentityFabric,
  createAgentPassport,
  decodeAndVerifyPassport,
  verifyAgentPassport,
  decodePassportUnverified,
  createPassportJti,
  revokePassportByJti,
  isPassportRevoked,
  isPassportRevokedByToken,
  refreshAgentPassport,
  passportAuthorizes,
  revokedPassportCount,
} from "./passport";

// Delegation & Token Exchange
export {
  exchangePassportForTask,
  delegateCredentials,
  createDelegationProof,
  verifyDelegationChain,
  isTaskToken,
  getTokenTtl,
} from "./delegation";
export type { CredentialDelegationRequest, CredentialDelegationResult, DelegationChainLink } from "./delegation";

// Cross-Agent Verification
export {
  createAuthChallenge,
  respondToAuthChallenge,
  verifyAuthResponse,
  verifyAgentIdentity,
  isChallengeExpired,
  challengeTtl,
} from "./verification";

// IdP Integration
export {
  registerAgentServicePrincipal,
  getServicePrincipal,
  getAgentServicePrincipals,
  touchServicePrincipal,
  unregisterAgentServicePrincipal,
  exchangeIdpTokenForPassport,
  generateAgentScimExternalId,
  buildAgentScimProfile,
  servicePrincipalCount,
  listAllServicePrincipals,
} from "./idp";
