import type { CachedDecision, GuardDecision, HashCacheConfig } from "./types";
import { containsRawSecret } from "./Redactor";

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
export function sanitizeDecisionForCache(decision: GuardDecision): GuardDecision {
    const scrub = (value: string | undefined, placeholder: string): string | undefined => {
        if (value === undefined) return undefined;
        return containsRawSecret(value) ? placeholder : value;
    };
    return {
        ...decision,
        redactedText: scrub(decision.redactedText, "[REDACTED_CACHED_SECRET]"),
        evidencePreview: scrub(decision.evidencePreview, "[REDACTED]"),
        findings: (decision.findings ?? []).map((f) => ({
            ...f,
            redactedEvidence:
                typeof f.redactedEvidence === "string" && containsRawSecret(f.redactedEvidence)
                    ? "[REDACTED]"
                    : f.redactedEvidence,
        })),
    };
}

/**
 * Local hash cache — stores decision by content hash.
 * Never stores raw content. Only hash + sanitized decision + metadata.
 */
export class HashCache {
    private cache = new Map<string, CachedDecision>();
    private config: HashCacheConfig;

    constructor(config?: Partial<HashCacheConfig>) {
        this.config = {
            ttlMs: config?.ttlMs ?? 10 * 60 * 1000, // 10 minutes default
            maxEntries: config?.maxEntries ?? 5000,
            policyVersion: config?.policyVersion ?? "1.0.0",
            detectorVersions: config?.detectorVersions ?? {},
        };
    }

    get(hash: string): GuardDecision | null {
        const entry = this.cache.get(hash);
        if (!entry) return null;
        // Check TTL
        if (Date.now() - entry.cachedAt > this.config.ttlMs) {
            this.cache.delete(hash);
            return null;
        }
        // Check version mismatch
        if (entry.policyVersion !== this.config.policyVersion) {
            this.cache.delete(hash);
            return null;
        }
        return entry.decision;
    }

    set(hash: string, decision: GuardDecision): void {
        // Evict if at capacity
        if (this.cache.size >= this.config.maxEntries) {
            this.evictOldest();
        }
        this.cache.set(hash, {
            decision: sanitizeDecisionForCache(decision),
            cachedAt: Date.now(),
            policyVersion: this.config.policyVersion,
            detectorVersions: { ...this.config.detectorVersions },
        });
    }

    invalidate(hash: string): void { this.cache.delete(hash); }

    clear(): void { this.cache.clear(); }

    size(): number { return this.cache.size; }

    updateConfig(updates: Partial<HashCacheConfig>): void {
        const oldPolicyVersion = this.config.policyVersion;
        this.config = { ...this.config, ...updates };
        // Invalidate all if policy version changed
        if (updates.policyVersion && updates.policyVersion !== oldPolicyVersion) {
            this.clear();
        }
    }

    private evictOldest(): void {
        let oldestKey = "";
        let oldestTime = Number.POSITIVE_INFINITY;
        for (const [key, entry] of this.cache) {
            if (entry.cachedAt < oldestTime) {
                oldestTime = entry.cachedAt;
                oldestKey = key;
            }
        }
        if (oldestKey) this.cache.delete(oldestKey);
    }
}

/**
 * Compute SHA-256 hash of normalized text.
 * Uses Web Crypto API (available in Node 18+ and VS Code).
 */
export async function hashContent(text: string): Promise<string> {
    const normalized = text.replace(/\s+/g, " ").trim().toLowerCase();
    const encoder = new TextEncoder();
    const data = encoder.encode(normalized);

    // Use crypto.subtle if available
    if (typeof globalThis.crypto?.subtle?.digest === "function") {
        const hashBuffer = await globalThis.crypto.subtle.digest("SHA-256", data);
        return Array.from(new Uint8Array(hashBuffer))
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");
    }

    // Fallback: simple hash for environments without Web Crypto
    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
        const char = normalized.charCodeAt(i);
        hash = ((hash << 5) - hash + char) | 0;
    }
    return Math.abs(hash).toString(16).padStart(8, "0");
}
