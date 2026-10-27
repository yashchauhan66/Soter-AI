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
exports.CANARY_TOKEN_PREFIX = void 0;
exports.canaryPreview = canaryPreview;
exports.generateCanary = generateCanary;
exports.toCanaryMetadata = toCanaryMetadata;
exports.hashCanary = hashCanary;
exports.matchCanaries = matchCanaries;
const HashCache_1 = require("./HashCache");
/**
 * Canary secret system — plant a locally-generated, unique fake secret and later
 * detect if it surfaces in AI output, a prompt, or elsewhere in the workspace.
 * A canary hit is strong evidence that an AI tool read protected context.
 *
 * Privacy contract: the RAW canary token lives only in memory / SecretStorage.
 * Everything persisted (metadata, ledger, reports) carries the HASH and a
 * redacted preview only — never the raw token.
 */
exports.CANARY_TOKEN_PREFIX = "sk-soter-canary-";
async function randomHex(bytes) {
    const arr = new Uint8Array(bytes);
    const g = globalThis.crypto;
    if (g?.getRandomValues) {
        g.getRandomValues(arr);
    }
    else {
        try {
            const { randomBytes } = await Promise.resolve().then(() => __importStar(require("node:crypto")));
            return randomBytes(bytes).toString("hex");
        }
        catch {
            throw new Error("Canary generation requires cryptographic randomness.");
        }
    }
    return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}
/** Redacted preview safe to show in UI/logs: prefix + short tail, middle masked. */
function canaryPreview(token) {
    if (token.length <= 12)
        return `${exports.CANARY_TOKEN_PREFIX}****`;
    return `${token.slice(0, exports.CANARY_TOKEN_PREFIX.length + 2)}${"*".repeat(8)}${token.slice(-2)}`;
}
/**
 * Generate a fresh canary. The token is shaped like an OpenAI-style key so the
 * existing SecretDetector also flags it if it slips into a scan.
 */
async function generateCanary() {
    const token = `${exports.CANARY_TOKEN_PREFIX}${await randomHex(20)}`;
    const hash = await (0, HashCache_1.hashExactContent)(token);
    return {
        id: `canary_${hash.slice(0, 12)}`,
        token,
        hash,
        redactedPreview: canaryPreview(token),
        createdAt: new Date().toISOString(),
    };
}
/** Strip the raw token, leaving only persist-safe metadata. */
function toCanaryMetadata(canary) {
    return { id: canary.id, hash: canary.hash, redactedPreview: canary.redactedPreview, createdAt: canary.createdAt };
}
async function hashCanary(token) {
    return (0, HashCache_1.hashExactContent)(token);
}
/**
 * Scan `text` for any of the supplied canary tokens. Comparison happens in
 * memory against raw tokens; the returned hits carry only id/hash/preview so a
 * caller can log the result without ever persisting the raw token.
 */
function matchCanaries(text, canaries) {
    const hits = [];
    for (const c of canaries) {
        if (!c.token)
            continue;
        let count = 0;
        let idx = text.indexOf(c.token);
        while (idx !== -1) {
            count++;
            idx = text.indexOf(c.token, idx + c.token.length);
        }
        if (count > 0) {
            hits.push({ id: c.id, hash: c.hash, redactedPreview: c.redactedPreview ?? canaryPreview(c.token), count });
        }
    }
    return hits;
}
//# sourceMappingURL=Canary.js.map