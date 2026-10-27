import type { GuardDecision, HashCacheConfig } from "./types";
/**
 * Defensive sanitizer for anything about to be cached.
 *
 * DecisionEngine already guarantees `redactedText` is scrubbed and that
 * findings carry only masked evidence, but the cache is the last line of
 * defense: even if a future code path produced a decision with a raw secret in
 * a string field, we must never persist it. Any high-risk secret that survives
 * into a cacheable string is replaced with a placeholder here. The original
 * decision object is left untouched (a shallow clone is cached).
 */
export declare function sanitizeDecisionForCache(decision: GuardDecision): GuardDecision;
/**
 * True when every key/value in `required` is present and equal in `actual`.
 * Extra keys in `actual` are allowed (forward-compatible). Empty required
 * means "no detector version constraint" (legacy callers).
 */
export declare function detectorVersionsMatch(actual: Record<string, string> | undefined, required: Record<string, string> | undefined): boolean;
/**
 * Local hash cache — stores decision by content hash.
 * Never stores raw content. Only hash + sanitized decision + metadata.
 */
export declare class HashCache {
    private cache;
    private config;
    constructor(config?: Partial<HashCacheConfig>);
    get(hash: string): GuardDecision | null;
    set(hash: string, decision: GuardDecision): void;
    invalidate(hash: string): void;
    clear(): void;
    size(): number;
    updateConfig(updates: Partial<HashCacheConfig>): void;
    private evictOldest;
}
/** Exact UTF-8 identity for security decisions and approvals. No weak fallback. */
export declare function hashExactContent(text: string): Promise<string>;
/**
 * Legacy normalized fingerprint for existing vault/canary metadata only.
 * Do not use for authorization or cached decisions; use hashExactContent.
 * Preserves existing fingerprints, including the historical non-WebCrypto fallback.
 * Never use this legacy function as an authorization or decision-cache identity.
 */
export declare function hashContent(text: string): Promise<string>;
//# sourceMappingURL=HashCache.d.ts.map