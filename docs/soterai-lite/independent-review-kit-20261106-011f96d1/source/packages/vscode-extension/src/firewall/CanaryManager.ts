import * as vscode from "vscode";
import {
    generateCanary,
    matchCanaries,
    toCanaryMetadata,
    type Canary,
    type CanaryMetadata,
    type CanaryHit,
} from "@soterai/guard-core";

/**
 * CanaryManager — plants and tracks local canary secrets.
 *
 * Privacy: the RAW canary tokens live only in SecretStorage. The extension
 * globalState holds only hash-bearing metadata for display. Raw tokens are
 * loaded into memory transiently for scanning and never persisted elsewhere.
 */
const RAW_SECRET_ID = "soterai.canaryTokens"; // JSON {id: token} in SecretStorage
const META_STATE_ID = "soterai.canaryMeta"; // CanaryMetadata[] in globalState

export class CanaryManager {
    private static readonly changes = new WeakMap<vscode.ExtensionContext, vscode.EventEmitter<void>>();
    private readonly changed: vscode.EventEmitter<void>;
    private static readonly writes = new WeakMap<vscode.ExtensionContext, Promise<unknown>>();

    private serialized<T>(operation: () => Promise<T>): Promise<T> {
        const result = (CanaryManager.writes.get(this.context) ?? Promise.resolve()).then(operation);
        CanaryManager.writes.set(this.context, result.catch(() => undefined));
        return result;
    }
    readonly onDidChange: vscode.Event<void>;

    constructor(private readonly context: vscode.ExtensionContext) {
        let changed = CanaryManager.changes.get(context);
        if (!changed) {
            changed = new vscode.EventEmitter<void>();
            CanaryManager.changes.set(context, changed);
        }
        this.changed = changed;
        this.onDidChange = changed.event;
    }

    private async readRaw(): Promise<Record<string, string>> {
        const json = await this.context.secrets.get(RAW_SECRET_ID);
        if (!json) return {};
        const parsed: unknown = JSON.parse(json);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)
            || Object.values(parsed).some(token => typeof token !== "string")) throw new Error("Invalid canary token storage.");
        return parsed as Record<string, string>;
    }

    private async writeRaw(map: Record<string, string>): Promise<void> {
        await this.context.secrets.store(RAW_SECRET_ID, JSON.stringify(map));
    }

    private meta(): CanaryMetadata[] {
        const meta = this.context.globalState.get<CanaryMetadata[]>(META_STATE_ID, []);
        if (!Array.isArray(meta) || meta.some(item => !item || typeof item.id !== "string"
            || typeof item.hash !== "string" || typeof item.redactedPreview !== "string")) throw new Error("Invalid canary metadata storage.");
        return meta;
    }

    private async setMeta(meta: CanaryMetadata[]): Promise<void> {
        await this.context.globalState.update(META_STATE_ID, meta);
        this.changed.fire();
    }

    /** Metadata list for display (never raw tokens). */
    listMetadata(): CanaryMetadata[] {
        return this.meta();
    }

    /** Generate + persist a new canary without racing concurrent registry edits. */
    create(): Promise<Canary> {
        return this.serialized(() => this.mint(false));
    }

    private async mint(rotate: boolean): Promise<Canary> {
        const raw = rotate ? {} : await this.readRaw();
        const meta = rotate ? [] : this.meta();
        if (meta.length >= 1024) throw new Error("Canary registry is full; rotate canaries before creating more.");
        const canary = await generateCanary();
        raw[canary.id] = canary.token;
        await this.writeRaw(raw);
        await this.setMeta([...meta, toCanaryMetadata(canary)]);
        return canary;
    }

    /** Load active tokens only for in-memory local scanning. Corruption is an error. */
    loadForScan(): Promise<Array<Pick<Canary, "id" | "token" | "hash" | "redactedPreview">>> {
        return this.serialized(async () => {
            const raw = await this.readRaw();
            const meta = this.meta();
            if (meta.some(item => !raw[item.id]) || Object.keys(raw).length !== meta.length) {
                throw new Error("Canary registry is incomplete; restore or rotate it before relying on monitoring.");
            }
            return meta.map(item => ({ id: item.id, token: raw[item.id], hash: item.hash, redactedPreview: item.redactedPreview }));
        });
    }

    /** Scan text for any active canary. Returns redacted hits only. */
    async scan(text: string): Promise<CanaryHit[]> {
        return matchCanaries(text, await this.loadForScan());
    }

    /** Rotate as one serialized update; listeners never see an intentional empty gap. */
    rotate(): Promise<Canary> {
        return this.serialized(() => this.mint(true));
    }
}
