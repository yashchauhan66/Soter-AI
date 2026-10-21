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
exports.LEDGER_GENESIS_HASH = void 0;
exports.buildLedgerEntry = buildLedgerEntry;
exports.sanitizeLedgerEntry = sanitizeLedgerEntry;
exports.serializeLedger = serializeLedger;
exports.parseLedger = parseLedger;
exports.chainLedgerEntry = chainLedgerEntry;
exports.verifyLedgerChain = verifyLedgerChain;
const Redactor_1 = require("./Redactor");
function buildLedgerEntry(input) {
    return sanitizeLedgerEntry({
        eventId: input.eventId,
        timestamp: input.timestamp ?? new Date().toISOString(),
        workspacePseudoId: input.workspacePseudoId,
        eventType: input.eventType,
        action: input.action,
        decision: input.decision ?? input.action,
        severity: input.severity,
        riskScore: input.riskScore,
        categories: input.categories ?? [],
        filePaths: input.filePaths,
        contentHashes: input.contentHashes ?? [],
        redactedEvidencePreview: input.redactedEvidencePreview,
        policyVersion: input.policyVersion,
        detectorVersions: input.detectorVersions ?? {},
        approvalSessionId: input.approvalSessionId,
        source: input.source,
        sessionId: input.sessionId,
        model: input.model,
        provider: input.provider,
        protectedFileAttempt: input.protectedFileAttempt,
        safeMode: input.safeMode,
    });
}
/**
 * Last line of defense before a ledger entry is persisted or exported. Any
 * string field that still contains a raw high-risk secret is replaced with a
 * placeholder. Returns a shallow clone; the input is untouched.
 */
function sanitizeLedgerEntry(entry) {
    const scrub = (value, placeholder) => {
        if (value === undefined)
            return undefined;
        return (0, Redactor_1.containsRawSecret)(value) ? placeholder : value;
    };
    return {
        ...entry,
        redactedEvidencePreview: scrub(entry.redactedEvidencePreview, "[REDACTED]"),
        // Paths are not secrets, but scrub defensively in case a secret was ever
        // embedded in a path-like string.
        filePaths: entry.filePaths?.map((p) => ((0, Redactor_1.containsRawSecret)(p) ? "[REDACTED_PATH]" : p)),
        contentHashes: entry.contentHashes.filter((h) => !(0, Redactor_1.containsRawSecret)(h)),
        // Provider/model labels are metadata, not secrets — scrub defensively.
        model: scrub(entry.model, "[REDACTED]"),
        provider: scrub(entry.provider, "[REDACTED]"),
    };
}
/** Serialize a batch of entries as JSONL (one sanitized entry per line). */
function serializeLedger(entries) {
    return entries.map((e) => JSON.stringify(sanitizeLedgerEntry(e))).join("\n");
}
/** Parse JSONL back into entries, skipping malformed lines. */
function parseLedger(jsonl) {
    const out = [];
    for (const line of jsonl.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed)
            continue;
        try {
            out.push(JSON.parse(trimmed));
        }
        catch {
            // Skip corrupt lines rather than failing the whole read.
        }
    }
    return out;
}
// ── Tamper-evident hash chain ───────────────────────────────────────────────
// Each entry records prevHash (the previous entry's entryHash) and entryHash
// (SHA-256 over its own canonical JSON minus entryHash). Editing, reordering,
// or deleting mid-chain entries breaks verification. This is TAMPER EVIDENCE,
// not immutability: an attacker who can rewrite the whole file can rebuild the
// chain — but cannot do so silently against an exported/remembered head hash.
exports.LEDGER_GENESIS_HASH = "genesis";
/**
 * SHA-256 over `text`, from whichever provider the host actually has.
 *
 * `globalThis.crypto` is not available unflagged in Node 18 — it became a global
 * in Node 19 — and VS Code 1.85, the `engines` floor this ledger ships under,
 * runs Node 18. A bare `crypto.subtle` therefore threw `crypto is not defined`
 * there, which took Emergency Lockdown down on every older editor while passing
 * on newer ones. `node:crypto` is imported lazily, so runtimes that do have
 * WebCrypto never resolve it.
 *
 * Both paths hash the same UTF-8 bytes with the same algorithm, so a chain
 * written under one provider verifies under the other — that matters the moment
 * a user upgrades their editor. There is deliberately no weak-hash fallback: a
 * chain that silently degrades its digest is not tamper evidence, so an absent
 * provider is an error rather than a downgrade.
 */
async function sha256Hex(text) {
    const subtle = globalThis.crypto?.subtle;
    if (typeof subtle?.digest === "function") {
        const digest = await subtle.digest("SHA-256", new TextEncoder().encode(text));
        return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
    }
    try {
        const { createHash } = await Promise.resolve().then(() => __importStar(require("node:crypto")));
        return createHash("sha256").update(text, "utf8").digest("hex");
    }
    catch (error) {
        throw new Error("Ledger hash chaining requires SHA-256, but neither globalThis.crypto.subtle nor node:crypto is " +
            `available in this runtime (${error instanceof Error ? error.message : String(error)}).`);
    }
}
function canonicalForHash(entry) {
    const { entryHash, ...rest } = entry;
    return JSON.stringify(rest, Object.keys(rest).sort());
}
/** Return a copy of `entry` chained onto `prevEntryHash`. */
async function chainLedgerEntry(entry, prevEntryHash) {
    const chained = { ...entry, prevHash: prevEntryHash ?? exports.LEDGER_GENESIS_HASH };
    chained.entryHash = await sha256Hex(canonicalForHash(chained));
    return chained;
}
/**
 * Verify the hash chain over parsed entries (in file order).
 *
 * The first chained entry's prevHash is accepted as-is (it may be "genesis"
 * or reference an entry dropped by retention trimming); every later entry must
 * link to its predecessor and every entryHash must match its content.
 */
async function verifyLedgerChain(entries) {
    let prev;
    let checked = 0;
    let unchained = 0;
    for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        if (!entry.entryHash) {
            // Pre-chain legacy entry: allowed only before the first chained one.
            if (checked > 0)
                return { valid: false, checkedEntries: checked, unchainedEntries: unchained, firstInvalidIndex: i, reason: "unchained entry after chained entries" };
            unchained++;
            continue;
        }
        if (prev !== undefined && (entry.prevHash ?? exports.LEDGER_GENESIS_HASH) !== prev) {
            return { valid: false, checkedEntries: checked, unchainedEntries: unchained, firstInvalidIndex: i, reason: "prevHash mismatch (entry removed, reordered, or edited)" };
        }
        const recomputed = await sha256Hex(canonicalForHash(entry));
        if (recomputed !== entry.entryHash) {
            return { valid: false, checkedEntries: checked, unchainedEntries: unchained, firstInvalidIndex: i, reason: "entryHash mismatch (entry content edited)" };
        }
        prev = entry.entryHash;
        checked++;
    }
    return { valid: true, checkedEntries: checked, unchainedEntries: unchained };
}
//# sourceMappingURL=Ledger.js.map