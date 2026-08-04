/**
 * Gap C — Tamper-proof signed AI Audit Ledger.
 *
 * A hash-chained, append-only local ledger of security-relevant events. Each entry
 * links to the previous entry's hash, so any deletion/modification breaks the chain
 * and is detectable via verifyChain(). Optionally HMAC-signed with a key kept only
 * in VS Code SecretStorage. Raw secrets/prompts are NEVER stored — caller must pass
 * already-redacted evidence.
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

export class AuditLedger {
    private constructor(private readonly context: vscode.ExtensionContext) {}
    private static inst: AuditLedger;
    public static get(context: vscode.ExtensionContext): AuditLedger {
        if (!AuditLedger.inst) AuditLedger.inst = new AuditLedger(context);
        return AuditLedger.inst;
    }

    private load(): AuditEntry[] {
        return this.context.globalState.get<AuditEntry[]>(STORE_KEY, []);
    }

    private async getSigningKey(): Promise<string> {
        const existing = await this.context.secrets.get(SIGN_KEY_ID);
        if (existing) return existing;
        const key: string = crypto.randomBytes(32).toString("hex");
        await this.context.secrets.store(SIGN_KEY_ID, key);
        return key;

    }

    private computeHash(e: Omit<AuditEntry, "hash" | "signature">): string {
        const payload = JSON.stringify([e.seq, e.timestamp, e.eventType, e.decision, e.riskScore ?? null, e.redactedEvidence ?? "", e.prevHash]);
        return crypto.createHash("sha256").update(payload).digest("hex");
    }

    /** Append a redacted event to the chain. Never pass raw secrets. */
    public async append(eventType: string, decision: string, riskScore?: number, redactedEvidence?: string): Promise<AuditEntry> {
        const entries = this.load();
        const prevHash = entries.length ? entries[entries.length - 1].hash : "GENESIS";
        const base = {
            seq: entries.length + 1,
            timestamp: new Date().toISOString(),
            eventType,
            decision,
            riskScore,
            redactedEvidence: (redactedEvidence ?? "").slice(0, 400),
            prevHash,
        };
        const hash = this.computeHash(base);
        const key = await this.getSigningKey();
        const signature = crypto.createHmac("sha256", key).update(hash).digest("hex");
        const entry: AuditEntry = { ...base, hash, signature };
        entries.push(entry);
        if (entries.length > MAX_ENTRIES) entries.splice(0, entries.length - MAX_ENTRIES);
        await this.context.globalState.update(STORE_KEY, entries);
        return entry;
    }

    /** Verify the hash chain (tamper check) and signatures. */
    public async verifyChain(): Promise<{ ok: boolean; entries: number; brokenAt?: number }> {
        const entries = this.load();
        const key = await this.getSigningKey();
        let prevHash = "GENESIS";
        for (const e of entries) {
            const { hash, signature, ...rest } = e;
            if (this.computeHash(rest) !== hash) return { ok: false, entries: entries.length, brokenAt: e.seq };
            const expectSig = crypto.createHmac("sha256", key).update(hash).digest("hex");
            if (signature !== expectSig) return { ok: false, entries: entries.length, brokenAt: e.seq };
            if (e.prevHash !== prevHash) return { ok: false, entries: entries.length, brokenAt: e.seq };
            prevHash = hash;
        }
        return { ok: true, entries: entries.length };
    }

    public async exportRedacted(): Promise<string> {
        const v = await this.verifyChain();
        return JSON.stringify({ verified: v.ok, entries: v.entries, chain: this.load() }, null, 2);
    }

    public async clear(): Promise<void> {
        await this.context.globalState.update(STORE_KEY, []);
    }
}
