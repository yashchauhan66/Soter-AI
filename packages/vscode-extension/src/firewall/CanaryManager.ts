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
    constructor(private readonly context: vscode.ExtensionContext) {}

    private async readRaw(): Promise<Record<string, string>> {
        const json = await this.context.secrets.get(RAW_SECRET_ID);
        if (!json) return {};
        try {
            return JSON.parse(json) as Record<string, string>;
        } catch {
            return {};
        }
    }

    private async writeRaw(map: Record<string, string>): Promise<void> {
        await this.context.secrets.store(RAW_SECRET_ID, JSON.stringify(map));
    }

    private meta(): CanaryMetadata[] {
        return this.context.globalState.get<CanaryMetadata[]>(META_STATE_ID, []);
    }

    private async setMeta(meta: CanaryMetadata[]): Promise<void> {
        await this.context.globalState.update(META_STATE_ID, meta);
    }

    /** Metadata list for display (never raw tokens). */
    listMetadata(): CanaryMetadata[] {
        return this.meta();
    }

    /** Generate + persist a new canary; returns it (caller may insert the token). */
    async create(): Promise<Canary> {
        const canary = await generateCanary();
        const raw = await this.readRaw();
        raw[canary.id] = canary.token;
        await this.writeRaw(raw);
        await this.setMeta([...this.meta(), toCanaryMetadata(canary)]);
        return canary;
    }

    /** Load active canaries (with raw tokens) for in-memory scanning only. */
    async loadForScan(): Promise<Array<Pick<Canary, "id" | "token" | "hash" | "redactedPreview">>> {
        const raw = await this.readRaw();
        const meta = this.meta();
        return meta
            .filter((m) => raw[m.id])
            .map((m) => ({ id: m.id, token: raw[m.id], hash: m.hash, redactedPreview: m.redactedPreview }));
    }

    /** Scan text for any active canary. Returns redacted hits only. */
    async scan(text: string): Promise<CanaryHit[]> {
        return matchCanaries(text, await this.loadForScan());
    }

    /** Rotate: drop all existing canaries and mint a fresh one. */
    async rotate(): Promise<Canary> {
        await this.context.secrets.delete(RAW_SECRET_ID);
        await this.setMeta([]);
        return this.create();
    }
}
