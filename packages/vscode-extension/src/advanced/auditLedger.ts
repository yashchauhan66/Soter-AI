/**
 * Local, tamper-evident audit ledger with signed retention checkpoints.
 * Signatures detect edits to retained data, not a complete storage rollback or
 * compromise of the extension host/OS user. Callers provide redacted evidence.
 */
import * as vscode from "vscode";
import * as crypto from "node:crypto";


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
    private constructor(private readonly context: vscode.ExtensionContext) {}
    private static readonly instances = new WeakMap<vscode.ExtensionContext, AuditLedger>();
    public static get(context: vscode.ExtensionContext): AuditLedger {
        let ledger = this.instances.get(context);
        if (!ledger) { ledger = new AuditLedger(context); this.instances.set(context, ledger); }
        return ledger;
    }

    private serialized<T>(operation: () => Promise<T>): Promise<T> {
        const result = this.queue.then(operation);
        this.queue = result.catch(() => undefined);
        return result;
    }

    private load(): LedgerData {
        const raw = this.context.globalState.get<AuditEntry[] | LedgerData>(STORE_KEY, []);
        // Legacy arrays remain untouched until a successful, verified append.
        if (Array.isArray(raw)) return { entries: [...raw] };
        if (!raw || raw.version !== 2 || !Array.isArray(raw.entries)) throw new Error("Invalid audit ledger storage.");
        return { ...raw, entries: [...raw.entries] };
    }

    private async getSigningKey(allowCreate = false): Promise<string> {
        const existing = await this.context.secrets.get(SIGN_KEY_ID);
        if (existing) return existing;
        if (!allowCreate) throw new Error("Audit signing key is unavailable.");
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
        return this.serialized(async () => {
            const data = this.load();
            const key = await this.getSigningKey(!data.version && data.entries.length === 0);
            if (!this.verify(data, key).ok) {
                throw new Error("Audit ledger verification failed. Export and inspect it before explicitly clearing the ledger.");
            }
            const previous = data.entries[data.entries.length - 1] ?? data.checkpoint;
            const base = {
                seq: (previous?.seq ?? 0) + 1,
                timestamp: new Date().toISOString(),
                eventType,
                decision,
                riskScore,
                redactedEvidence: (redactedEvidence ?? "").slice(0, 400),
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
                const key = await this.getSigningKey(!data.version && count === 0);
                return this.verify(data, key);
            } catch { return { ok: false, entries: count }; }
        });
    }

    public exportRedacted(): Promise<string> {
        return this.serialized(async () => {
            const data = this.load();
            let verified = false;
            try { verified = this.verify(data, await this.getSigningKey(!data.version && data.entries.length === 0)).ok; }
            catch { /* Export remains available when the signing key is missing. */ }
            return JSON.stringify({
                verified, entries: data.entries.length, chain: data.entries,
                checkpoint: data.checkpoint, head: data.head,
                verificationScope: "Retained entries only; complete storage rollback is not detectable.",
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
