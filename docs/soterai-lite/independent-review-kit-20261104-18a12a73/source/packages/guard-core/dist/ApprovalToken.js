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
exports.ApprovalStore = void 0;
exports.createApprovalGrant = createApprovalGrant;
exports.isApprovalValid = isApprovalValid;
const HashCache_1 = require("./HashCache");
const SCOPE_TTL_MS = {
    once: 5 * 60_000, // 5 min
    session: 30 * 60_000, // 30 min
    workspace: 8 * 60 * 60_000, // 8 h
};
async function createApprovalGrant(input) {
    const now = input.now ?? Date.now();
    const ttl = input.ttlMs ?? SCOPE_TTL_MS[input.scope];
    if (input.validityHardeningEnabled === false)
        throw new Error("Approval issuance unavailable while validity hardening is disabled");
    if (!Object.hasOwn(SCOPE_TTL_MS, input.scope) || !Number.isSafeInteger(now) || now < 0 || !Number.isSafeInteger(ttl) || ttl < 1
        || ttl > SCOPE_TTL_MS.workspace || !Number.isSafeInteger(now + ttl)) {
        throw new Error("Approval clock and lifetime must be bounded positive integers");
    }
    const outcome = input.outcome ?? "approve";
    // Token binds the identity fields plus a nonce so it cannot be guessed from
    // the (hashed) content alone.
    const nonce = await randomHex(12);
    const token = await (0, HashCache_1.hashExactContent)(`${input.sessionId}|${input.contentHash}|${input.decision}|${outcome}|${now}|${nonce}`);
    return {
        id: `apr_${token.slice(0, 12)}`,
        token,
        sessionId: input.sessionId,
        contentHash: input.contentHash,
        decision: input.decision,
        outcome,
        scope: input.scope,
        createdAt: now,
        expiresAt: now + ttl,
        consumed: false,
    };
}
/**
 * Is this grant currently valid for the given session + content? Enforces the
 * binding, the TTL, and single-use for the "once" scope. Never mutates the grant
 * (consumption is done by {@link ApprovalStore.consume}).
 */
function isApprovalValid(grant, input) {
    const now = input.now ?? Date.now();
    if (input.validityHardeningEnabled === false || !Number.isSafeInteger(now)
        || !Number.isSafeInteger(grant.createdAt) || !Number.isSafeInteger(grant.expiresAt)
        || grant.createdAt < 0 || grant.expiresAt <= grant.createdAt
        || grant.expiresAt - grant.createdAt > SCOPE_TTL_MS.workspace || now < grant.createdAt)
        return false;
    if (grant.outcome === "deny")
        return false;
    if (grant.consumed)
        return false;
    if (now >= grant.expiresAt)
        return false;
    if (grant.sessionId !== input.sessionId)
        return false;
    // Hard binding: an approval for one payload must never unlock a different one.
    if (grant.contentHash !== input.contentHash)
        return false;
    return true;
}
function toView(g, now) {
    return {
        id: g.id,
        sessionId: g.sessionId,
        contentHash: g.contentHash,
        decision: g.decision,
        outcome: g.outcome,
        scope: g.scope,
        createdAt: g.createdAt,
        expiresAt: g.expiresAt,
        consumed: g.consumed,
        expired: !Number.isSafeInteger(now) || !Number.isSafeInteger(g.expiresAt) || now >= g.expiresAt,
    };
}
/**
 * In-memory store of approval grants. The extension/broker own persistence; the
 * store guarantees only that no raw content is ever held — grants carry hashes.
 */
class ApprovalStore {
    grants = new Map();
    add(grant) {
        this.grants.set(grant.id, grant);
    }
    /** True if any live grant authorizes this session+content. */
    isApproved(sessionId, contentHash, now = Date.now()) {
        for (const g of this.grants.values()) {
            if (isApprovalValid(g, { sessionId, contentHash, now }))
                return true;
        }
        return false;
    }
    /**
     * Consume an approval for this session+content. For "once" grants this marks
     * the grant used (so it cannot be replayed). Returns true if consumed.
     */
    consume(sessionId, contentHash, now = Date.now()) {
        for (const g of this.grants.values()) {
            if (isApprovalValid(g, { sessionId, contentHash, now })) {
                if (g.scope === "once")
                    g.consumed = true;
                return true;
            }
        }
        return false;
    }
    /** Remove expired/consumed grants; returns the number pruned. */
    prune(now = Date.now()) {
        let n = 0;
        for (const [id, g] of this.grants) {
            if (!Number.isSafeInteger(g.expiresAt) || now >= g.expiresAt || (g.scope === "once" && g.consumed)) {
                this.grants.delete(id);
                n++;
            }
        }
        return n;
    }
    list(now = Date.now()) {
        return [...this.grants.values()].map((g) => toView(g, now));
    }
    clear() {
        this.grants.clear();
    }
    get size() {
        return this.grants.size;
    }
}
exports.ApprovalStore = ApprovalStore;
async function randomHex(bytes) {
    const arr = new Uint8Array(bytes);
    const g = globalThis.crypto;
    if (g?.getRandomValues) {
        g.getRandomValues(arr);
        return Array.from(arr, b => b.toString(16).padStart(2, "0")).join("");
    }
    try {
        const { randomBytes } = await Promise.resolve().then(() => __importStar(require("node:crypto")));
        return randomBytes(bytes).toString("hex");
    }
    catch {
        throw new Error("Approval grants require cryptographic randomness.");
    }
}
//# sourceMappingURL=ApprovalToken.js.map