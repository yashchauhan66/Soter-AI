// Preserve the established guard-core ABI for non-IDE consumers.
export * from "../../guard-core/src/index";
export { isPathWithin } from "./pathContainment";
export { RegisteredSecretMatcher, SECRET_MATCH_LIMITS, SECRET_ENTROPY_POLICY } from "./RegisteredSecretMatcher";
export type { SecretMatch, MatchDecision } from "./RegisteredSecretMatcher";
