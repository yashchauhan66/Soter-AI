"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.HashCache = void 0;
exports.sanitizeDecisionForCache = sanitizeDecisionForCache;
exports.detectorVersionsMatch = detectorVersionsMatch;
exports.hashExactContent = hashExactContent;
exports.hashContent = hashContent;
const Redactor_1 = require("./Redactor");
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
function sanitizeDecisionForCache(decision) {
    const scrub = (value, placeholder) => {
        if (value === undefined)
            return undefined;
        return (0, Redactor_1.containsRawSecret)(value) ? placeholder : value;
    };
    return {
        ...decision,
        redactedText: scrub(decision.redactedText, "[REDACTED_CACHED_SECRET]"),
        evidencePreview: scrub(decision.evidencePreview, "[REDACTED]"),
        findings: (decision.findings ?? []).map((f) => ({
            ...f,
            redactedEvidence: typeof f.redactedEvidence === "string" && (0, Redactor_1.containsRawSecret)(f.redactedEvidence)
                ? "[REDACTED]"
                : f.redactedEvidence,
        })),
    };
}
/**
 * True when every key/value in `required` is present and equal in `actual`.
 * Extra keys in `actual` are allowed (forward-compatible). Empty required
 * means "no detector version constraint" (legacy callers).
 */
function detectorVersionsMatch(actual, required) {
    if (!required || Object.keys(required).length === 0)
        return true;
    if (!actual)
        return false;
    for (const [key, value] of Object.entries(required)) {
        if (actual[key] !== value)
            return false;
    }
    return true;
}
/**
 * Local hash cache — stores decision by content hash.
 * Never stores raw content. Only hash + sanitized decision + metadata.
 */
class HashCache {
    cache = new Map();
    config;
    constructor(config) {
        this.config = {
            ttlMs: config?.ttlMs ?? 10 * 60 * 1000, // 10 minutes default
            maxEntries: config?.maxEntries ?? 5000,
            policyVersion: config?.policyVersion ?? "1.0.0",
            detectorVersions: config?.detectorVersions ?? {},
        };
    }
    get(hash) {
        const entry = this.cache.get(hash);
        if (!entry)
            return null;
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
        // Detector / pipeline version mismatch must invalidate — otherwise a
        // pipeline expansion (e.g. enabling prompt-injection on file context)
        // would silently serve stale allow decisions (fail-open cache).
        if (!detectorVersionsMatch(entry.detectorVersions, this.config.detectorVersions)) {
            this.cache.delete(hash);
            return null;
        }
        return entry.decision;
    }
    set(hash, decision) {
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
    invalidate(hash) { this.cache.delete(hash); }
    clear() { this.cache.clear(); }
    size() { return this.cache.size; }
    updateConfig(updates) {
        const oldPolicyVersion = this.config.policyVersion;
        this.config = { ...this.config, ...updates };
        // Invalidate all if policy version changed
        if (updates.policyVersion && updates.policyVersion !== oldPolicyVersion) {
            this.clear();
        }
    }
    evictOldest() {
        const first = this.cache.keys().next();
        if (!first.done)
            this.cache.delete(first.value);
    }
}
exports.HashCache = HashCache;
/** Exact UTF-8 identity for security decisions and approvals. No weak fallback. */
async function hashExactContent(text) {
    const subtle = globalThis.crypto?.subtle;
    if (subtle) {
        const digest = await subtle.digest("SHA-256", new TextEncoder().encode(text));
        return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
    }
    // Same provider fallback as Ledger.ts for the VS Code 1.85 / Node 18 floor.
    try {
        const { createHash } = await Promise.resolve().then(() => __importStar(require("node:crypto")));
        return createHash("sha256").update(text, "utf8").digest("hex");
    }
    catch {
        throw new Error("Security decisions require cryptographic SHA-256.");
    }
}
/**
 * Legacy normalized fingerprint for existing vault/canary metadata only.
 * Do not use for authorization or cached decisions; use hashExactContent.
 * Preserves existing fingerprints, including the historical non-WebCrypto fallback.
 * Never use this legacy function as an authorization or decision-cache identity.
 */
async function hashContent(text) {
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
//# sourceMappingURL=HashCache.js.map