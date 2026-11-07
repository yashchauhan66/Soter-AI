/**
 * Local, tamper-evident audit ledger with signed retention checkpoints.
 * Signatures detect edits to retained data, not a complete storage rollback or
 * compromise of the extension host/OS user. Caller diagnostic text is withheld.
 */
import * as vscode from "vscode";
import * as crypto from "node:crypto";
import { ownedSinkMetadata } from "../../../core/src/OwnedSinkMetadata";
import { selfHygieneEnabled } from "../self-hygiene/SelfHygieneFlags";


export interface AuditEntry {
    seq: number;
    timestamp: string;
    eventType: string;
    decision: string;
    riskScore?: number;
    redactedEvidence?: string;
    prevHash: string;
    hash: string;
    signature?: string;
}

const STORE_KEY = "soterai.auditLedger";
const SIGN_KEY_ID = "soterai.auditLedger.signingKey";
const MAX_ENTRIES = 2000;
function canonicalTimestamp(value: unknown): value is string {
    return typeof value === "string" && value.length === 24 && Number.isFinite(Date.parse(value))
        && new Date(value).toISOString() === value;
}
const PUBLIC_AUDIT_FAILURES = new Set([
    "Owned audit sink is disabled.", "Owned audit data exceeds the retained-entry limit.", "Invalid audit ledger storage.",
    "Audit signing key is unavailable.", "Audit sequence exhausted.",
    "Audit ledger verification failed. Export and inspect it before explicitly clearing the ledger.",
]);
function auditFailure(error: unknown): Error {
    try {
        const message: unknown = error && typeof error === "object" ? Object.getOwnPropertyDescriptor(error, "message")?.value : undefined;
        if (typeof message === "string" && PUBLIC_AUDIT_FAILURES.has(message)) return new Error(message);
    } catch { /* A caller exception cannot supply diagnostic text or accessors. */ }
    return new Error("Owned audit operation unavailable.");
}

interface Anchor { seq: number; hash: string; signature: string }
interface LedgerData {
    version?: 2;
    entries: AuditEntry[];
    checkpoint?: Anchor;
    head?: Anchor;
}
interface Verification { ok: boolean; entries: number; brokenAt?: number }

export class AuditLedger {
    private queue: Promise<unknown> = Promise.resolve();
    private generation = 0;
    private disposed = false;
    private constructor(private readonly context: vscode.ExtensionContext) {
        const listener = vscode.workspace.onDidChangeConfiguration(event => {
            if (event.affectsConfiguration("soterai.lite.selfHygiene")) this.generation++;
        });
        context.subscriptions.push({ dispose: () => { this.disposed = true; this.generation++; listener.dispose(); } });
    }
    private available(generation: number): boolean {
        return !this.disposed && this.generation === generation && selfHygieneEnabled();
    }
    private static readonly instances = new WeakMap<vscode.ExtensionContext, AuditLedger>();
    public static get(context: vscode.ExtensionContext): AuditLedger {
        let ledger = this.instances.get(context);
        if (!ledger) { ledger = new AuditLedger(context); this.instances.set(context, ledger); }
        return ledger;
    }

    private serialized<T>(operation: () => Promise<T>): Promise<T> {
        const result = this.queue.then(operation).catch(error => { throw auditFailure(error); });
        this.queue = result.catch(() => undefined);
        return result;
    }

    private load(): LedgerData {
        const raw = this.context.globalState.get<AuditEntry[] | LedgerData>(STORE_KEY, []);
        // Legacy arrays remain untouched until a successful, verified append.
        if (Array.isArray(raw)) {
            if (raw.length > MAX_ENTRIES) throw new Error("Owned audit data exceeds the retained-entry limit.");
            return { entries: [...raw] };
        }
        if (!raw || raw.version !== 2 || !Array.isArray(raw.entries)) throw new Error("Invalid audit ledger storage.");
        if (raw.entries.length > MAX_ENTRIES) throw new Error("Owned audit data exceeds the retained-entry limit.");
        return { ...raw, entries: [...raw.entries] };
    }

    private async getSigningKey(allowCreate = false, generation?: number): Promise<string> {
        const existing = await this.context.secrets.get(SIGN_KEY_ID);
        if (generation !== undefined && !this.available(generation)) throw new Error("Owned audit sink is disabled.");
        if (existing) return existing;
        if (!allowCreate) throw new Error("Audit signing key is unavailable.");
        if (!selfHygieneEnabled()) throw new Error("Owned audit sink is disabled.");
        const key = crypto.randomBytes(32).toString("hex");
        await this.context.secrets.store(SIGN_KEY_ID, key);
        return key;
    }

    private computeHash(e: Omit<AuditEntry, "hash" | "signature">): string {
        const payload = JSON.stringify([e.seq, e.timestamp, e.eventType, e.decision, e.riskScore ?? null, e.redactedEvidence ?? "", e.prevHash]);
        return crypto.createHash("sha256").update(payload).digest("hex");
    }

    private sign(key: string, payload: string): string {
        return crypto.createHmac("sha256", key).update(payload).digest("hex");
    }

    private anchor(key: string, kind: "checkpoint" | "head", seq: number, hash: string): Anchor {
        return { seq, hash, signature: this.sign(key, JSON.stringify(["soterai-audit-v2", kind, seq, hash])) };
    }

    private validAnchor(key: string, kind: "checkpoint" | "head", value?: Anchor): value is Anchor {
        return !!value && Number.isSafeInteger(value.seq) && value.seq >= 0
            && (value.seq === 0 ? value.hash === "GENESIS" : /^[a-f0-9]{64}$/.test(value.hash))
            && value.signature === this.anchor(key, kind, value.seq, value.hash).signature;
    }

    private verify(data: LedgerData, key: string): Verification {
        const fail = (brokenAt?: number): Verification => ({ ok: false, entries: data.entries.length, brokenAt });
        if (data.version === 2 && (!this.validAnchor(key, "checkpoint", data.checkpoint)
            || !this.validAnchor(key, "head", data.head))) return fail();
        let prevHash = data.checkpoint?.hash ?? "GENESIS";
        let seq = data.checkpoint?.seq ?? 0;
        for (const entry of data.entries) {
            if (!entry || !Number.isSafeInteger(entry.seq) || entry.seq !== seq + 1
                || entry.prevHash !== prevHash || this.computeHash(entry) !== entry.hash
                || entry.signature !== this.sign(key, entry.hash)) return fail(entry?.seq);
            prevHash = entry.hash;
            seq = entry.seq;
        }
        if (data.version === 2 && (data.head?.seq !== seq || data.head.hash !== prevHash)) return fail(seq);
        return { ok: true, entries: data.entries.length };
    }

    /** Append atomically with the signed retention checkpoint and expected head. */
    public append(eventType: string, decision: string, riskScore?: number, redactedEvidence?: string): Promise<AuditEntry> {
        const generation = this.generation;
        if (!this.available(generation)) return Promise.reject(new Error("Owned audit sink is disabled."));
        // Minimize synchronously, before a queued closure can retain caller text.
        const metadata = ownedSinkMetadata(eventType, decision, riskScore);
        return this.serialized(async () => {
            if (!this.available(generation)) throw new Error("Owned audit sink is disabled.");
            const data = this.load();
            const key = await this.getSigningKey(!data.version && data.entries.length === 0, generation);
            if (!this.verify(data, key).ok) {
                throw new Error("Audit ledger verification failed. Export and inspect it before explicitly clearing the ledger.");
            }
            const previous = data.entries[data.entries.length - 1] ?? data.checkpoint;
            const base = {
                seq: (previous?.seq ?? 0) + 1,
                timestamp: new Date().toISOString(),
                eventType: metadata.code === "event" ? "event_" + ((previous?.seq ?? 0) + 1) : metadata.code,
                decision: metadata.decision,
                riskScore: metadata.riskScore,
                redactedEvidence: "",
                prevHash: previous?.hash ?? "GENESIS",
            };
            if (!Number.isSafeInteger(base.seq)) throw new Error("Audit sequence exhausted.");
            const hash = this.computeHash(base);
            const entry: AuditEntry = { ...base, hash, signature: this.sign(key, hash) };
            const entries = [...data.entries, entry];
            let checkpoint = data.checkpoint ?? this.anchor(key, "checkpoint", 0, "GENESIS");
            if (entries.length > MAX_ENTRIES) {
                const removed = entries[entries.length - MAX_ENTRIES - 1];
                checkpoint = this.anchor(key, "checkpoint", removed.seq, removed.hash);
            }
            if (!this.available(generation)) throw new Error("Owned audit sink is disabled.");
            await this.context.globalState.update(STORE_KEY, {
                version: 2, entries: entries.slice(-MAX_ENTRIES), checkpoint,
                head: this.anchor(key, "head", entry.seq, entry.hash),
            } satisfies LedgerData);
            return entry;
        });
    }

    public verifyChain(): Promise<Verification> {
        return this.serialized(async () => {
            let count = 0;
            try {
                const data = this.load();
                count = data.entries.length;
                if (!data.version && count === 0) return { ok: true, entries: 0 };
                const key = await this.getSigningKey(false);
                return this.verify(data, key);
            } catch { return { ok: false, entries: count }; }
        });
    }

    public exportRedacted(): Promise<string> {
        const generation = this.generation;
        if (!this.available(generation)) return Promise.resolve(JSON.stringify({ verified: false, entries: 0, chain: [], status: "WITHHELD" }));
        return this.serialized(async () => {
            if (!this.available(generation)) return JSON.stringify({ verified: false, entries: 0, chain: [], status: "WITHHELD" });
            const data = this.load();
            let verified = false;
            let key: string | undefined;
            try { key = await this.getSigningKey(false); verified = this.verify(data, key).ok; }
            catch { /* Export remains available when the signing key is missing. */ }
            const historyMetadataOnly = data.entries.every(entry => {
                const metadata = ownedSinkMetadata(entry.eventType, entry.decision, entry.riskScore);
                return (metadata.code === entry.eventType || entry.eventType === "event_" + entry.seq)
                    && metadata.decision === entry.decision && metadata.riskScore === entry.riskScore
                    && canonicalTimestamp(entry.timestamp)
                    && (entry.redactedEvidence === "" || entry.redactedEvidence === undefined);
            });
            // An expired or missing prefix may have contained private legacy text.
            const exportVerificationMaterial = verified && historyMetadataOnly && (data.checkpoint?.seq ?? 0) === 0
                && (data.entries.length === 0 || data.entries[0].seq === 1 && data.entries[0].prevHash === "GENESIS");
            const chain = data.entries.slice(-MAX_ENTRIES).map(entry => {
                const metadata = ownedSinkMetadata(entry.eventType, entry.decision, entry.riskScore);
                const authenticated = exportVerificationMaterial && key !== undefined && this.computeHash(entry) === entry.hash && entry.signature === this.sign(key, entry.hash);
                const seq = Number.isSafeInteger(entry.seq) && entry.seq > 0 ? entry.seq : 0;
                return {
                    seq,
                    timestamp: canonicalTimestamp(entry.timestamp) ? entry.timestamp : "WITHHELD",
                    eventType: metadata.code === "event" ? "event_" + seq : metadata.code,
                    decision: metadata.decision,
                    riskScore: metadata.riskScore,
                    redactedEvidence: "",
                    prevHash: authenticated ? entry.prevHash : "WITHHELD",
                    hash: authenticated ? entry.hash : "WITHHELD",
                    signature: authenticated ? entry.signature : undefined,
                };
            });
            if (!this.available(generation)) return JSON.stringify({ verified: false, entries: 0, chain: [], status: "WITHHELD" });
            return JSON.stringify({
                verified, entries: data.entries.length, chain,
                checkpoint: historyMetadataOnly && key && this.validAnchor(key, "checkpoint", data.checkpoint)
                    ? { seq: data.checkpoint.seq, hash: exportVerificationMaterial ? data.checkpoint.hash : "WITHHELD", signature: exportVerificationMaterial ? data.checkpoint.signature : "WITHHELD" } : undefined,
                head: historyMetadataOnly && key && this.validAnchor(key, "head", data.head)
                    ? { seq: data.head.seq, hash: exportVerificationMaterial ? data.head.hash : "WITHHELD", signature: exportVerificationMaterial ? data.head.signature : "WITHHELD" } : undefined,
                sanitizedProjection: true,
                verificationScope: "Original retained entries only, not the sanitized export projection; complete storage rollback is not detectable.",
            }, null, 2);
        });
    }

    public clear(): Promise<void> {
        return this.serialized(async () => {
            const key = await this.getSigningKey(true);
            await this.context.globalState.update(STORE_KEY, {
                version: 2, entries: [], checkpoint: this.anchor(key, "checkpoint", 0, "GENESIS"),
                head: this.anchor(key, "head", 0, "GENESIS"),
            } satisfies LedgerData);
        });
    }
}
