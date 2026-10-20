import { createHash } from "node:crypto";
import type { BackupSink } from "../broker/IntegrationAdapter";
import { validSession, type SafeReadConnection } from "../agent/SafeReadProtocol";
import { GEMINI_SAFE_FUNCTION } from "../../../../apps/local-ai-broker/src/GeminiGenerateContentSchema";

export interface GeminiCliProfile { settings?: string; environment?: string }
export interface GeminiCliReceipt { version: 1; owner: string; backup: string; beforeDigest: string; afterDigest: string; settingsDigest: string; environmentDigest: string }
export interface GeminiCliPreview { operation: "configure" | "restore"; version: "0.55.1"; diff: string[]; scope: string }
export interface GeminiCliDependencies {
    enabled(): boolean; fingerprint(): string; read(): Promise<GeminiCliProfile | undefined>;
    write(value: GeminiCliProfile | undefined, expectedCurrentDigest?: string): Promise<void>;
    backups: BackupSink; confirm(preview: GeminiCliPreview): Promise<boolean>; prepare(receipt: GeminiCliReceipt): Promise<void>;
}
export interface GeminiCliResult { status: "APPLIED" | "RESTORED" | "CANCELLED" | "CHANGED" | "UNAVAILABLE" | "ROLLED_BACK" | "INCOMPLETE"; receipt?: GeminiCliReceipt }
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const memberDigest = (value: string | undefined) => sha(JSON.stringify({ present: value !== undefined, value }));
export const geminiCliDigest = (value: GeminiCliProfile | undefined) => sha(JSON.stringify(value === undefined ? { present: false }
    : { present: true, settings: value.settings ?? null, environment: value.environment ?? null }));
function fail(): never { throw Error("Gemini CLI profile unavailable or unsupported."); }
function connection(value: SafeReadConnection, pathname: string): void {
    if (!value || Object.keys(value).sort().join(",") !== "endpoint,session,token" || !/^[a-f0-9]{64}$/.test(value.token ?? "") || !validSession(value.session)) fail();
    const url = new URL(value.endpoint);
    if (url.href !== value.endpoint || url.protocol !== "http:" || url.hostname !== "127.0.0.1" || !url.port || Number(url.port) > 65535
        || url.pathname !== pathname || url.search || url.hash || url.username || url.password) fail();
}
export function renderGeminiCliProfile(mcp: SafeReadConnection, gateway: SafeReadConnection): Required<GeminiCliProfile> {
    try {
        connection(mcp, "/gemini/mcp"); connection(gateway, "/gemini"); if (mcp.token === gateway.token || mcp.session === gateway.session) fail();
        const settings = {
            general: { enableAutoUpdate: false, enableAutoUpdateNotification: false, enablePromptCompletion: false, maxAttempts: 1, retryFetchErrors: false },
            security: { auth: { selectedType: "gemini-api-key" }, folderTrust: { enabled: false }, enablePermanentToolApproval: false },
            advanced: { ignoreLocalEnv: true, autoConfigureMemory: false }, telemetry: { enabled: false, logPrompts: false },
            privacy: { usageStatisticsEnabled: false }, ide: { enabled: false },
            admin: { extensions: { enabled: false }, skills: { enabled: false }, mcp: { enabled: true } },
            hooksConfig: { enabled: false }, context: { includeDirectoryTree: false, fileName: [], loadMemoryFromIncludeDirectories: false },
            tools: { core: [GEMINI_SAFE_FUNCTION], exclude: [], useRipgrep: false },
            mcp: { allowed: ["soterai_safe_read"] },
            mcpServers: { soterai_safe_read: { url: mcp.endpoint, type: "http", headers: { Authorization: "Bearer " + mcp.token },
                trust: true, timeout: 70000, includeTools: ["soterai_read_project_file_safely"] } },
            model: { name: "gemini-3.5-flash" },
        };
        return Object.freeze({ settings: JSON.stringify(settings, null, 2) + "\n", environment: [
            "# SoterAI local capabilities only. No upstream provider credential.",
            "# Select this dedicated home and curated launch variables before startup.",
            "GEMINI_API_KEY=" + gateway.token, "GOOGLE_GEMINI_BASE_URL=" + gateway.endpoint,
            "GEMINI_CLI_NO_RELAUNCH=1", "GEMINI_FORCE_FILE_STORAGE=true", "GEMINI_FORCE_ENCRYPTED_FILE_STORAGE=true", "",
        ].join("\n") });
    } catch { return fail(); }
}
const preview = (operation: "configure" | "restore"): GeminiCliPreview => ({ operation, version: "0.55.1",
    diff: operation === "configure" ? ["Create two exact files in a new dedicated Gemini home; never edit a normal user profile.",
        "Allow only SoterAI safe-read MCP; exclude built-in native tools and turn off updates/IDE/extensions/skills.",
        "Separate MCP/provider local capabilities: [MASKED]. Upstream provider key stays in the owned broker.",
        "Encrypted absence backup and value-free recovery receipt precede exclusive creation.",
        "Explicit launch home/system-setting/env selection is required; inherited/project/argv overrides remain uncovered."]
        : ["Remove only exact owned settings/environment members, including a remaining member after partial restoration.", "Preserve changed/foreign files, unrelated native state, encrypted backup and recovery receipt."],
    scope: "Pinned stateless text/single-safe-read route only, complete buffered output. Opaque signatures/media/state and normal profiles/overrides/native reads remain limited; current route verification is Uncovered." });
function validProfile(value: GeminiCliProfile | undefined): value is GeminiCliProfile {
    return !!value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).every(key => ["settings", "environment"].includes(key))
        && [value.settings, value.environment].some(member => typeof member === "string")
        && [value.settings, value.environment].every(member => member === undefined || typeof member === "string" && Buffer.byteLength(member) <= 16384);
}
function validReceipt(receipt: GeminiCliReceipt | undefined): receipt is GeminiCliReceipt {
    return !!receipt && Object.keys(receipt).sort().join(",") === "afterDigest,backup,beforeDigest,environmentDigest,owner,settingsDigest,version" && receipt.version === 1
        && [receipt.owner, receipt.backup].every(value => typeof value === "string" && !!value && value.length <= 256 && !/[\x00-\x1f\x7f]/.test(value))
        && [receipt.beforeDigest, receipt.afterDigest, receipt.settingsDigest, receipt.environmentDigest].every(value => typeof value === "string" && /^[a-f0-9]{64}$/.test(value))
        && receipt.beforeDigest === geminiCliDigest(undefined);
}
function ownedMembers(value: GeminiCliProfile | undefined, receipt: GeminiCliReceipt): boolean {
    return validProfile(value) && (value.settings === undefined || memberDigest(value.settings) === receipt.settingsDigest)
        && (value.environment === undefined || memberDigest(value.environment) === receipt.environmentDigest);
}
function current(deps: GeminiCliDependencies, owner: string, signal: AbortSignal | undefined, start: number): boolean {
    try { return !signal?.aborted && deps.enabled() === true && deps.fingerprint() === owner && performance.now() - start < 60000; } catch { return false; }
}
async function confirm(deps: GeminiCliDependencies, operation: "configure" | "restore", signal: AbortSignal | undefined, remaining: number): Promise<boolean> {
    let timer: ReturnType<typeof setTimeout> | undefined, cancel: (() => void) | undefined;
    try { return await Promise.race([deps.confirm(preview(operation)), new Promise<boolean>(done => {
        cancel = () => done(false); signal?.addEventListener("abort", cancel, { once: true }); if (signal?.aborted) cancel();
        timer = setTimeout(() => done(false), Math.max(1, remaining)); timer.unref?.();
    })]) === true; } finally { clearTimeout(timer); if (cancel) signal?.removeEventListener("abort", cancel); }
}
async function verifyBackup(receipt: GeminiCliReceipt, deps: GeminiCliDependencies): Promise<void> {
    const text = await deps.backups.retrieve(receipt.backup); if (typeof text !== "string" || text.length > 256) fail();
    const value = JSON.parse(text); if (!value || Object.keys(value).sort().join(",") !== "present,version" || value.version !== 1 || value.present !== false) fail();
}
export class GeminiCliConfigPlan {
    #used = false; #after: Required<GeminiCliProfile>;
    constructor(after: Required<GeminiCliProfile>) { this.#after = Object.freeze({ ...after }); }
    preview(): GeminiCliPreview { return preview("configure"); }
    async apply(deps: GeminiCliDependencies, signal?: AbortSignal): Promise<GeminiCliResult> {
        if (this.#used) return { status: "UNAVAILABLE" }; this.#used = true;
        const start = performance.now(); let receipt: GeminiCliReceipt | undefined, attempted = false;
        try {
            const owner = deps.fingerprint(), valid = () => current(deps, owner, signal, start);
            if (!owner || owner.length > 256 || /[\x00-\x1f\x7f]/.test(owner) || !valid()) return { status: "UNAVAILABLE" };
            if (await deps.read() !== undefined) return { status: "CHANGED" };
            if (!valid()) return { status: "UNAVAILABLE" };
            if (!await confirm(deps, "configure", signal, 60000 - (performance.now() - start))) return { status: "CANCELLED" };
            if (!valid()) return { status: "UNAVAILABLE" };
            if (await deps.read() !== undefined) return { status: "CHANGED" };
            if (!valid()) return { status: "UNAVAILABLE" };
            const backup = await deps.backups.store("gemini-cli-profile", '{"version":1,"present":false}\n');
            receipt = { version: 1, owner, backup, beforeDigest: geminiCliDigest(undefined), afterDigest: geminiCliDigest(this.#after),
                settingsDigest: memberDigest(this.#after.settings), environmentDigest: memberDigest(this.#after.environment) };
            if (!validReceipt(receipt) || !valid()) return { status: "UNAVAILABLE" };
            await deps.prepare(receipt);
            if (!valid()) return { status: "UNAVAILABLE" };
            if (await deps.read() !== undefined) return { status: "CHANGED" };
            if (!valid()) return { status: "UNAVAILABLE" };
            attempted = true; await deps.write(this.#after);
            if (!valid() || geminiCliDigest(await deps.read()) !== receipt.afterDigest || !valid()) throw Error("Unavailable");
            return { status: "APPLIED", receipt };
        } catch {
            if (!attempted || !receipt) return { status: "UNAVAILABLE" };
            try {
                const now = await deps.read(); if (now === undefined) return { status: "ROLLED_BACK" };
                if (geminiCliDigest(now) !== receipt.afterDigest) return { status: "INCOMPLETE", receipt };
                await verifyBackup(receipt, deps); await deps.write(undefined, receipt.afterDigest);
                if (await deps.read() === undefined) return { status: "ROLLED_BACK" };
            } catch { /* Preserve uncertain or partially owned files and recovery. */ }
            return { status: "INCOMPLETE", receipt };
        }
    }
}
export function createGeminiCliPlan(before: GeminiCliProfile | undefined, mcp: SafeReadConnection, gateway: SafeReadConnection): GeminiCliConfigPlan {
    if (before !== undefined) return fail(); return new GeminiCliConfigPlan(renderGeminiCliProfile(mcp, gateway));
}
export async function geminiCliProfileCurrent(receipt: GeminiCliReceipt | undefined, deps: GeminiCliDependencies): Promise<boolean> {
    try { const value = await deps.read(); return validReceipt(receipt) && validProfile(value) && value.settings !== undefined && value.environment !== undefined
        && deps.enabled() === true && deps.fingerprint() === receipt.owner && geminiCliDigest(value) === receipt.afterDigest && ownedMembers(value, receipt)
        && deps.enabled() === true && deps.fingerprint() === receipt.owner; } catch { return false; }
}
export async function undoGeminiCliProfile(receipt: GeminiCliReceipt | undefined, deps: GeminiCliDependencies, signal?: AbortSignal): Promise<GeminiCliResult> {
    let attempted = false;
    try {
        if (!validReceipt(receipt)) return { status: "UNAVAILABLE" };
        const start = performance.now(), valid = () => current(deps, receipt.owner, signal, start);
        if (!valid()) return { status: "UNAVAILABLE" };
        const before = await deps.read(); if (!ownedMembers(before, receipt)) return { status: "CHANGED" };
        await verifyBackup(receipt, deps); if (!valid()) return { status: "UNAVAILABLE" };
        if (!await confirm(deps, "restore", signal, 60000 - (performance.now() - start))) return { status: "CANCELLED" };
        const now = await deps.read(); if (!valid() || geminiCliDigest(now) !== geminiCliDigest(before) || !ownedMembers(now, receipt) || !valid()) return { status: "CHANGED" };
        attempted = true; await deps.write(undefined, geminiCliDigest(now));
        if (await deps.read() === undefined && valid()) return { status: "RESTORED" };
        return { status: "INCOMPLETE", receipt };
    } catch { return { status: attempted ? "INCOMPLETE" : "UNAVAILABLE", ...(attempted && receipt ? { receipt } : {}) }; }
}
