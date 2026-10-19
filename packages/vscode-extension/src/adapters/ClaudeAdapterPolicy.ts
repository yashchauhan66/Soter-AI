import { createHash } from "node:crypto";
import { decodeBoundedJson } from "../../../../apps/local-ai-broker/src/BoundedJson";
import type { BackupSink } from "../broker/IntegrationAdapter";

export interface ClaudePin { publisher: string; name: string; version: string; manifestSha256: string; runtimeSha256: string; nativeSha256: string }
export const CLAUDE_PIN: Readonly<ClaudePin> = Object.freeze({ publisher: "Anthropic", name: "claude-code", version: "2.1.301",
    manifestSha256: "0159028b1582350192613d452f92250c98320526cd189773d6637d7bb321a92d",
    runtimeSha256: "65d43f4637c6a519d2b9b6b06be3b1f40532a437303684da87f349b7d1e2cd61",
    nativeSha256: "84d61feeb1a07e5a5b3354d68432591cac18a5d38a419a30d86d0f3ad8cba397" });
const sha = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
const record = (value: unknown): value is Record<string, any> => !!value && typeof value === "object" && !Array.isArray(value);
const fail = (): never => { throw Error("Claude adapter schema unavailable or unsupported."); };
const encode = (value: unknown) => JSON.stringify(value, null, 2) + "\n";
function json(text: string | undefined): Record<string, any> {
    if (text === undefined) return {};
    try { return JSON.parse(decodeBoundedJson(Buffer.from(text), { maxBytes: 49152, maxDepth: 16, maxNodes: 4096, maxStringBytes: 49152 }).canonical); } catch { return fail(); }
}
export function verifyClaudeArtifact(manifest: Uint8Array, runtime: Uint8Array, nativeDigest: string, pin: Readonly<ClaudePin> = CLAUDE_PIN): boolean {
    try {
        if (manifest.byteLength > 65536 || runtime.byteLength > 8 * 1024 * 1024 || sha(manifest) !== pin.manifestSha256 || sha(runtime) !== pin.runtimeSha256
            || !/^[a-f0-9]{64}$/.test(nativeDigest) || nativeDigest !== pin.nativeSha256) return false;
        const value = json(Buffer.from(manifest).toString("utf8"));
        return value.publisher === pin.publisher && value.name === pin.name && value.version === pin.version && value.main === "./extension.js";
    } catch { return false; }
}
export type ClaudeFileKey = "settings" | "state";
export type ClaudeFiles = Record<ClaudeFileKey, string | undefined>;
export interface ClaudeBinding { url: string; credential: string; hookUrl: string; hookToken: string; mcpUrl: string; mcpToken: string }
export interface ClaudePreview { version: "2.1.301"; operation: "configure" | "restore"; changes: ClaudeFileKey[]; diff: string[]; treatment: string }
export interface ClaudeDependencies {
    enabled(): boolean; fingerprint(): string;
    read(key: ClaudeFileKey): Promise<string | undefined>;
    write(key: ClaudeFileKey, value: string | undefined): Promise<void>;
    backups: BackupSink; confirm(preview: ClaudePreview): Promise<boolean>;
    /** Value-free durable recovery metadata, after backups and before any config write. */
    prepare?(receipt: ClaudeReceipt): Promise<void>;
}
interface ClaudeEntry { key: ClaudeFileKey; backup: string; beforeDigest: string; afterDigest: string; beforeOwnedDigest: string; afterOwnedDigest: string }
export interface ClaudeReceipt { version: 1; owner: string; entries: ClaudeEntry[] }
export interface ClaudeResult { status: "APPLIED" | "RESTORED" | "CANCELLED" | "CHANGED" | "UNAVAILABLE" | "ROLLED_BACK" | "INCOMPLETE"; receipt?: ClaudeReceipt }
const keys: ClaudeFileKey[] = ["settings", "state"];
export const claudeFileDigest = (text: string | undefined) => sha(JSON.stringify({ present: text !== undefined, value: text }));
function canonical(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(canonical);
    if (record(value)) return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
    return value;
}
function owned(text: string | undefined): unknown {
    const state = json(text);
    if (state.mcpServers !== undefined && !record(state.mcpServers)) return fail();
    return state.mcpServers?.soterai_safe_read;
}
const ownedDigest = (text: string | undefined) => sha(JSON.stringify({ present: owned(text) !== undefined, value: canonical(owned(text)) }));
function loopback(value: string, route: string): URL {
    try { const url = new URL(value);
        if (url.href !== value || url.protocol !== "http:" || url.hostname !== "127.0.0.1" || !url.port || Number(url.port) > 65535
            || url.pathname !== route || url.search || url.hash || url.username || url.password) return fail(); return url;
    } catch { return fail(); }
}
/** Private exact-version config plan; unowned hooks and helper routes require owner resolution. */
export function createClaudePlan(input: ClaudeFiles, binding: ClaudeBinding): ClaudeConfigPlan {
    try {
        loopback(binding.url, "/v1/ai/anthropic-compatible");
        const hook = loopback(binding.hookUrl, "/claude/hooks"), mcp = loopback(binding.mcpUrl, "/claude/mcp");
        if (hook.origin !== mcp.origin || !/^[a-f0-9]{64}$/.test(binding.hookToken) || !/^[a-f0-9]{64}$/.test(binding.mcpToken)
            || binding.hookToken === binding.mcpToken || typeof binding.credential !== "string" || binding.credential.length < 8 || binding.credential.length > 1024
            || /[\x00-\x20\x7f]/.test(binding.credential)) return fail();
        const settings = json(input.settings), state = json(input.state);
        if (settings.settingsSchemaVersion !== undefined || settings.disableAllHooks !== undefined && settings.disableAllHooks !== false
            || settings.hooks !== undefined && (!record(settings.hooks) || Object.keys(settings.hooks).length)
            || ["apiKeyHelper", "awsAuthRefresh", "awsCredentialExport", "otelHeadersHelper"].some(key => settings[key] !== undefined)
            || settings.model !== undefined && (typeof settings.model !== "string" || !settings.model || settings.model.length > 256)
            || settings.env !== undefined && (!record(settings.env) || Object.entries(settings.env).some(([key, value]) => typeof value !== "string" || key.length > 128 || value.length > 8192))
            || settings.permissions !== undefined && !record(settings.permissions)) return fail();
        const env = settings.env ?? {}, permissions = settings.permissions ?? {};
        if (Object.keys(env).some(key => /^(?:ANTHROPIC_CUSTOM_HEADERS|CLAUDE_CODE_USE_|ANTHROPIC_(?:AWS|VERTEX|FOUNDRY)|CLAUDE_CODE_(?:DISABLE_HOOKS|API_KEY_HELPER))/i.test(key))
            || permissions.defaultMode !== undefined && permissions.defaultMode !== "default") return fail();
        for (const key of ["allow", "deny", "ask"]) if (permissions[key] !== undefined
            && (!Array.isArray(permissions[key]) || permissions[key].length > 512 || permissions[key].some((rule: unknown) => typeof rule !== "string" || Buffer.byteLength(rule) > 2048))) return fail();
        if (state.mcpServers !== undefined && !record(state.mcpServers) || state.mcpServers && Object.hasOwn(state.mcpServers, "soterai_safe_read")) return fail();
        settings.env = { ...env, ANTHROPIC_BASE_URL: binding.url, ANTHROPIC_API_KEY: "", ANTHROPIC_AUTH_TOKEN: binding.credential,
            CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1", DISABLE_AUTOUPDATER: "1", DISABLE_TELEMETRY: "1", DISABLE_ERROR_REPORTING: "1", CLAUDE_CODE_DISABLE_AUTO_MEMORY: "1" };
        settings.permissions = { ...permissions, defaultMode: "default" }; settings.alwaysThinkingEnabled = false;
        settings.disableAllHooks = false;
        const rule = { hooks: [{ type: "http", url: binding.hookUrl, headers: { Authorization: "Bearer " + binding.hookToken }, timeout: 70, onFailure: "block" }] };
        settings.hooks = { UserPromptSubmit: [rule], PreToolUse: [{ matcher: ".*", ...rule }] };
        state.mcpServers = { ...state.mcpServers, soterai_safe_read: { type: "http", url: binding.mcpUrl, headers: { Authorization: "Bearer " + binding.mcpToken } } };
        const after = { settings: encode(settings), state: encode(state) }; for (const key of keys) if (Buffer.byteLength(after[key]) > 49152) return fail();
        return new ClaudeConfigPlan({ ...input }, after);
    } catch { return fail(); }
}
const preview = (operation: "configure" | "restore"): ClaudePreview => ({ version: "2.1.301", operation, changes: [...keys],
    diff: operation === "configure" ? [
        "settings.json / provider URL and authentication: [MASKED current values] -> current owned loopback gateway",
        "settings.json / hooks: absent -> authenticated UserPromptSubmit and PreToolUse HTTP hooks; failures block",
        "settings.json / permissions.defaultMode -> default; alwaysThinkingEnabled -> false; existing deny/allow/ask rules retained",
        "settings.json / nonessential traffic, updater, telemetry, error reporting and automatic memory -> opted out",
        "private user state / mcpServers.soterai_safe_read: absent -> authenticated approved safe reader",
    ] : ["settings.json -> exact encrypted previous snapshot", "private user state / unchanged owned safe-reader entry -> previous state; preserve unrelated vendor changes"],
    treatment: operation === "configure"
        ? "Configure the pinned Claude Code text route for this editor's live private session. Previous files are encrypted before writes. Public native operations still follow vendor permission checks; protected reads use native SoterAI confirmation. Unknown tools, commands, broad searches and images are withheld. Direct context may enter the vendor; independent traffic is unverified. Review contains no credentials or original configuration."
        : "Withdraw the managed session and restore the reviewed previous configuration. Unrelated vendor startup metadata is preserved. Previous direct vendor routes are outside SoterAI; saved project restrictions remain." });
async function approved(deps: ClaudeDependencies, operation: "configure" | "restore", signal: AbortSignal | undefined, maximum: number): Promise<boolean> {
    let timer: ReturnType<typeof setTimeout> | undefined, cancel: (() => void) | undefined;
    try { return await Promise.race([deps.confirm(preview(operation)), new Promise<boolean>(done => {
        cancel = () => done(false); signal?.addEventListener("abort", cancel, { once: true }); if (signal?.aborted) cancel();
        timer = setTimeout(() => done(false), maximum); timer.unref?.();
    })]) === true; } finally { if (timer) clearTimeout(timer); if (cancel) signal?.removeEventListener("abort", cancel); }
}
export class ClaudeConfigPlan {
    #before: ClaudeFiles; #after: ClaudeFiles; #consumed = false;
    constructor(before: ClaudeFiles, after: ClaudeFiles) { this.#before = before; this.#after = after; }
    preview(): ClaudePreview { return preview("configure"); }
    async apply(deps: ClaudeDependencies, signal?: AbortSignal): Promise<ClaudeResult> {
        if (this.#consumed) return { status: "UNAVAILABLE" }; this.#consumed = true;
        const started = performance.now(), entries: ClaudeEntry[] = [], attempted: ClaudeFileKey[] = []; let owner: string;
        try { owner = deps.fingerprint(); if (!owner || owner.length > 256 || !deps.enabled() || signal?.aborted) return { status: "UNAVAILABLE" }; } catch { return { status: "UNAVAILABLE" }; }
        const valid = () => { try { return !signal?.aborted && deps.enabled() === true && deps.fingerprint() === owner && performance.now() - started < 60000; } catch { return false; } };
        const receipt = (): ClaudeReceipt => ({ version: 1, owner, entries });
        try {
            for (const key of keys) if (await deps.read(key) !== this.#before[key]) return { status: "CHANGED" };
            if (!valid()) return { status: "UNAVAILABLE" };
            if (!await approved(deps, "configure", signal, Math.max(1, 60000 - (performance.now() - started)))) return { status: "CANCELLED" };
            if (!valid()) return { status: "UNAVAILABLE" };
            for (const key of keys) if (await deps.read(key) !== this.#before[key]) return { status: "CHANGED" };
            for (const key of keys) {
                if (!valid()) return { status: "UNAVAILABLE" };
                const backup = await deps.backups.store(key, encode({ version: 1, present: this.#before[key] !== undefined, ...(this.#before[key] === undefined ? {} : { before: this.#before[key] }) }));
                if (typeof backup !== "string" || !backup || backup.length > 256 || /[\x00-\x1f\x7f]/.test(backup)) throw Error("Backup unavailable.");
                entries.push({ key, backup, beforeDigest: claudeFileDigest(this.#before[key]), afterDigest: claudeFileDigest(this.#after[key]),
                    beforeOwnedDigest: key === "state" ? ownedDigest(this.#before[key]) : claudeFileDigest(this.#before[key]),
                    afterOwnedDigest: key === "state" ? ownedDigest(this.#after[key]) : claudeFileDigest(this.#after[key]) });
            }
            if (!valid()) return { status: "UNAVAILABLE" };
            await deps.prepare?.(receipt());
            for (const key of keys) {
                if (!valid() || await deps.read(key) !== this.#before[key]) throw Error("Configuration changed.");
                attempted.push(key); await deps.write(key, this.#after[key]);
                if (!valid() || await deps.read(key) !== this.#after[key]) throw Error("Configuration changed.");
            }
            return { status: "APPLIED", receipt: receipt() };
        } catch {
            if (!attempted.length) return { status: "UNAVAILABLE" };
            let restored = true;
            for (const key of attempted.reverse()) {
                try { const current = await deps.read(key); if (current === this.#before[key]) continue; if (current !== this.#after[key]) { restored = false; continue; }
                    const entry = entries.find(item => item.key === key)!;
                    const before = await restoreValue(entry, deps.backups); await deps.write(key, before);
                    if (await deps.read(key) !== before) restored = false;
                } catch { restored = false; }
            }
            return { status: restored ? "ROLLED_BACK" : "INCOMPLETE", ...(restored ? {} : { receipt: receipt() }) };
        }
    }
}
function validReceipt(receipt: ClaudeReceipt | undefined): receipt is ClaudeReceipt {
    return !!receipt && receipt.version === 1 && typeof receipt.owner === "string" && !!receipt.owner && receipt.owner.length <= 256
        && Array.isArray(receipt.entries) && receipt.entries.length === 2 && new Set(receipt.entries.map(entry => entry.key)).size === 2
        && receipt.entries.every(entry => keys.includes(entry.key) && typeof entry.backup === "string" && !!entry.backup && entry.backup.length <= 256
            && [entry.beforeDigest, entry.afterDigest, entry.beforeOwnedDigest, entry.afterOwnedDigest].every(value => typeof value === "string" && /^[a-f0-9]{64}$/.test(value)));
}
async function restoreValue(entry: ClaudeEntry, backups: BackupSink): Promise<string | undefined> {
    const source = await backups.retrieve(entry.backup); if (typeof source !== "string") return fail();
    let saved: Record<string, any>;
    try { saved = JSON.parse(decodeBoundedJson(Buffer.from(source), { maxBytes: 262144, maxDepth: 3, maxNodes: 16, maxStringBytes: 49152 }).canonical); } catch { return fail(); }
    if (Object.keys(saved).sort().join(",") !== (saved.present === true ? "before,present,version" : "present,version")
        || saved.version !== 1 || typeof saved.present !== "boolean" || saved.present && typeof saved.before !== "string") return fail();
    const value = saved.present ? saved.before as string : undefined;
    if (claudeFileDigest(value) !== entry.beforeDigest || (entry.key === "state" ? ownedDigest(value) : claudeFileDigest(value)) !== entry.beforeOwnedDigest) return fail();
    return value;
}
export async function claudeFilesCurrent(receipt: ClaudeReceipt | undefined, deps: Pick<ClaudeDependencies, "read">): Promise<boolean> {
    try { if (!validReceipt(receipt)) return false;
        for (const entry of receipt.entries) {
            const current = await deps.read(entry.key);
            if ((entry.key === "state" ? ownedDigest(current) : claudeFileDigest(current)) !== entry.afterOwnedDigest) return false;
        }
        return true;
    } catch { return false; }
}
function restoreState(current: string | undefined, before: string | undefined, entry: ClaudeEntry): string | undefined {
    if (claudeFileDigest(current) === entry.afterDigest || claudeFileDigest(current) === entry.beforeDigest) return before;
    if (ownedDigest(current) !== entry.afterOwnedDigest && ownedDigest(current) !== entry.beforeOwnedDigest) return fail();
    const value = json(current), old = json(before);
    const previous = old.mcpServers?.soterai_safe_read;
    if (previous === undefined) { if (value.mcpServers) { delete value.mcpServers.soterai_safe_read; if (!Object.keys(value.mcpServers).length && !Object.hasOwn(old, "mcpServers")) delete value.mcpServers; } }
    else value.mcpServers = { ...value.mcpServers, soterai_safe_read: previous };
    return encode(value);
}
export async function undoClaudeFiles(receipt: ClaudeReceipt | undefined, deps: ClaudeDependencies, signal?: AbortSignal): Promise<ClaudeResult> {
    let written = 0;
    try {
        if (!validReceipt(receipt)) return { status: "UNAVAILABLE" };
        const started = performance.now();
        const valid = () => !signal?.aborted && deps.enabled() === true && deps.fingerprint() === receipt.owner && performance.now() - started < 60000;
        if (!valid()) return { status: "UNAVAILABLE" };
        const before: ClaudeFiles = { settings: undefined, state: undefined };
        for (const entry of receipt.entries) {
            const current = await deps.read(entry.key), value = entry.key === "state" ? ownedDigest(current) : claudeFileDigest(current);
            if (value !== entry.afterOwnedDigest && value !== entry.beforeOwnedDigest) return { status: "CHANGED" };
            before[entry.key] = await restoreValue(entry, deps.backups);
        }
        if (!await approved(deps, "restore", signal, Math.max(1, 60000 - (performance.now() - started)))) return { status: "CANCELLED" };
        if (!valid()) return { status: "UNAVAILABLE" };
        for (const entry of [...receipt.entries].reverse()) {
            if (!valid()) return { status: written ? "INCOMPLETE" : "CHANGED" };
            const current = await deps.read(entry.key), value = entry.key === "state" ? ownedDigest(current) : claudeFileDigest(current);
            if (value !== entry.afterOwnedDigest && value !== entry.beforeOwnedDigest) return { status: written ? "INCOMPLETE" : "CHANGED" };
            const target = entry.key === "state" ? restoreState(current, before.state, entry) : before.settings;
            if (current === target) continue;
            written++; await deps.write(entry.key, target);
            if (await deps.read(entry.key) !== target) return { status: "INCOMPLETE", receipt };
        }
        return { status: "RESTORED" };
    } catch { return { status: written ? "INCOMPLETE" : "UNAVAILABLE", ...(written && receipt ? { receipt } : {}) }; }
}
