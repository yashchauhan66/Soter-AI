import { createHash } from "node:crypto";
import type { BackupSink } from "../broker/IntegrationAdapter";
import { validSession } from "../agent/SafeReadProtocol";
export const CODEX_CLI_PIN = Object.freeze({ name: "@openai/codex", version: "0.160.1", nativeBytes: 326875440,
    manifestSha256: "05d54db58bd6e525e69e770052b189970dc52f72457e5cc189bab0cbd70d11f8",
    wrapperSha256: "61b0194f3bb6534439c8d26a3ed57d0805f84b884588b761795323eeb92fcf70",
    nativeSha256: "9e7c59c05cc1ce5677b1f94e835b2ac038ca3be14504e78d558eacdb0ea3f55d" });
const sha = (v: string | Uint8Array) => createHash("sha256").update(v).digest("hex");
const fail = (): never => { throw Error("Codex CLI profile unavailable or unsupported."); };
export const codexCliDigest = (value: string | undefined) => sha(JSON.stringify({ present: value !== undefined, value }));
export interface CodexCliConnection { endpoint: string; token: string; session: string }
export interface CodexCliPreview { operation: "configure" | "restore"; version: "0.160.1"; diff: string[]; scope: string }
export interface CodexCliReceipt { version: 1; owner: string; backup: string; beforeDigest: string; afterDigest: string }
export interface CodexCliDependencies {
    enabled(): boolean; fingerprint(): string; read(): Promise<string | undefined>; write(value: string | undefined, expectedCurrentDigest?: string): Promise<void>;
    backups: BackupSink; confirm(preview: CodexCliPreview): Promise<boolean>;
    prepare(receipt: CodexCliReceipt): Promise<void>;
}
export interface CodexCliResult { status: "APPLIED" | "RESTORED" | "CANCELLED" | "CHANGED" | "UNAVAILABLE" | "ROLLED_BACK" | "INCOMPLETE"; receipt?: CodexCliReceipt }
export function verifyCodexCliArtifact(manifest: Uint8Array, wrapper: Uint8Array, nativeDigest: string): boolean {
    try { const value = JSON.parse(Buffer.from(manifest).toString("utf8"));
        return manifest.byteLength <= 65536 && wrapper.byteLength <= 65536 && sha(manifest) === CODEX_CLI_PIN.manifestSha256
            && sha(wrapper) === CODEX_CLI_PIN.wrapperSha256 && nativeDigest === CODEX_CLI_PIN.nativeSha256
            && value.name === CODEX_CLI_PIN.name && value.version === CODEX_CLI_PIN.version && value.bin?.codex === "bin/codex.js";
    } catch { return false; }
}
export function renderCodexCliProfile(connection: CodexCliConnection, gateway?: CodexCliConnection): string {
    try {
        if (!connection || Object.keys(connection).sort().join(",") !== "endpoint,session,token" || !/^[a-f0-9]{64}$/.test(connection.token)
            || !validSession(connection.session)) return fail();
        const url = new URL(connection.endpoint);
        if (url.href !== connection.endpoint || url.protocol !== "http:" || url.hostname !== "127.0.0.1" || !url.port || Number(url.port) > 65535
            || url.pathname !== "/codex/mcp" || url.search || url.hash || url.username || url.password) return fail();
        if (gateway) {
            if (Object.keys(gateway).sort().join(",") !== "endpoint,session,token" || !/^[a-f0-9]{64}$/.test(gateway.token) || !validSession(gateway.session)) return fail();
            const provider = new URL(gateway.endpoint);
            if (provider.href !== gateway.endpoint || provider.protocol !== "http:" || provider.hostname !== "127.0.0.1" || !provider.port || Number(provider.port) > 65535
                || provider.pathname !== "/codex" || provider.search || provider.hash || provider.username || provider.password) return fail();
        }
        const disabled = ["shell_tool", "shell_snapshot", "unified_exec", "view_image", "image_generation", "apps", "plugins", "multi_agent", "js_repl",
            "hooks", "browser_use", "browser_use_external", "computer_use", "goals", "skill_search", "skill_mcp_dependency_install"];
        return ['# SoterAI owned Codex CLI0.160.1 dedicated safe-read profile.',
            gateway ? '# Text Responses use the revocable local role and complete-output broker inspection; overrides remain uncovered.' : '# Provider prompts/context/egress and explicit overrides remain outside this route.',
            ...(gateway ? ['model_provider = "soterai_gateway"'] : []),
            'approval_policy = "never"', 'sandbox_mode = "read-only"', 'project_doc_max_bytes = 0', 'web_search = "disabled"',
            'check_for_update_on_startup = false', '[analytics]', 'enabled = false', '[feedback]', 'enabled = false', '[otel]', 'exporter = "none"',
            '[features]', ...disabled.map(key => key + " = false"), 'skip_host_skill_discovery = true',
            '[mcp_servers.soterai_safe_read]', 'required = true', 'enabled_tools = ["soterai_read_project_file_safely"]',
            '# Approves transport only; the editor requires fresh F04 owner consent for every release.',
            'default_tools_approval_mode = "approve"', 'startup_timeout_sec = 10', 'tool_timeout_sec = 70',
            'url = ' + JSON.stringify(connection.endpoint), 'http_headers = { Authorization = ' + JSON.stringify("Bearer " + connection.token) + ' }',
            ...(gateway ? ['[model_providers.soterai_gateway]', 'name = "SoterAI inspected local Responses"', 'base_url = ' + JSON.stringify(gateway.endpoint),
                'wire_api = "responses"', 'requires_openai_auth = false', 'supports_websockets = false', 'request_max_retries = 0', 'stream_max_retries = 0', 'stream_idle_timeout_ms = 35000',
                '# Ephemeral local role only; no upstream provider credential is written here.', 'http_headers = { Authorization = ' + JSON.stringify("Bearer " + gateway.token) + ' }'] : []), ""].join("\n");
    } catch { return fail(); }
}
const preview = (operation: "configure" | "restore", gateway = false): CodexCliPreview => ({ operation, version: "0.160.1",
    diff: operation === "configure" ? ["New dedicated config only; existing user profiles are not edited.",
        "Native command/image/web/app/plugin tools disabled; only allowlisted SoterAI MCP safe-read transport approved.",
        "MCP endpoint/session capability: [MASKED]; every release requires native editor confirmation.",
        "Encrypted absence backup and durable recovery metadata precede exclusive creation.",
        ...(gateway ? ["Text Responses provider uses a separate revocable local capability: [MASKED]; internal broker credential is not written.", "Complete responses are buffered before release; native context/overrides/other profiles and unsupported formats remain limited."] : [])]
        : ["Remove only the exact SoterAI-owned config; retain unrelated native state and encrypted backup."],
    scope: gateway ? "Dedicated text Responses plus safe-read route only; buffered output, owner/session/policy checks. Overrides, unsupported context/attachments and other profiles remain uncovered; current owner routing is Uncovered."
        : "Vendor-controls-only safe-read profile. Provider traffic is unmediated; supplied context, attachments, overrides and other profiles remain uncovered. Current owner routing is Uncovered." });
function validReceipt(r: CodexCliReceipt | undefined): r is CodexCliReceipt {
    return !!r && Object.keys(r).sort().join(",") === "afterDigest,backup,beforeDigest,owner,version" && r.version === 1
        && typeof r.owner === "string" && !!r.owner && r.owner.length <= 256 && !/[\x00-\x1f\x7f]/.test(r.owner)
        && typeof r.backup === "string" && !!r.backup && r.backup.length <= 256 && !/[\x00-\x1f\x7f]/.test(r.backup)
        && [r.beforeDigest, r.afterDigest].every(s => typeof s === "string" && /^[a-f0-9]{64}$/.test(s))
        && r.beforeDigest === codexCliDigest(undefined);
}
function currentGuard(deps: CodexCliDependencies, owner: string, signal: AbortSignal | undefined, start: number): boolean {
    try { return !signal?.aborted && deps.enabled() === true && deps.fingerprint() === owner && performance.now() - start < 60000; } catch { return false; }
}
async function confirm(deps: CodexCliDependencies, operation: "configure" | "restore", signal: AbortSignal | undefined, maximum: number, gateway = false): Promise<boolean> {
    let timer: ReturnType<typeof setTimeout> | undefined, cancel: (() => void) | undefined;
    try { return await Promise.race([deps.confirm(preview(operation, gateway)), new Promise<boolean>(done => {
        cancel = () => done(false); signal?.addEventListener("abort", cancel, { once: true }); if (signal?.aborted) cancel();
        timer = setTimeout(() => done(false), Math.max(1, maximum)); timer.unref?.();
    })]) === true; } finally { if (timer) clearTimeout(timer); if (cancel) signal?.removeEventListener("abort", cancel); }
}
async function verifyBackup(receipt: CodexCliReceipt, deps: CodexCliDependencies): Promise<void> {
    const text = await deps.backups.retrieve(receipt.backup);
    if (typeof text !== "string" || text.length > 256) return fail();
    const value = JSON.parse(text);
    if (!value || Object.keys(value).sort().join(",") !== "present,version" || value.version !== 1 || value.present !== false) return fail();
}
export class CodexCliConfigPlan {
    #used = false;
    constructor(private readonly after: string, private readonly gateway = false) {}
    preview(): CodexCliPreview { return preview("configure", this.gateway); }
    async apply(deps: CodexCliDependencies, signal?: AbortSignal): Promise<CodexCliResult> {
        if (this.#used) return { status: "UNAVAILABLE" }; this.#used = true;
        const start = performance.now(); let receipt: CodexCliReceipt | undefined, attempted = false;
        try {
            const owner = deps.fingerprint(), valid = () => currentGuard(deps, owner, signal, start);
            if (!owner || owner.length > 256 || /[\x00-\x1f\x7f]/.test(owner) || !valid()) return { status: "UNAVAILABLE" };
            if (await deps.read() !== undefined) return { status: "CHANGED" };
            if (!valid()) return { status: "UNAVAILABLE" };
            if (!await confirm(deps, "configure", signal, 60000 - (performance.now() - start), this.gateway)) return { status: "CANCELLED" };
            if (!valid()) return { status: "UNAVAILABLE" };
            if (await deps.read() !== undefined) return { status: "CHANGED" };
            if (!valid()) return { status: "UNAVAILABLE" };
            const backup = await deps.backups.store("codex-cli-profile", '{"version":1,"present":false}\n');
            receipt = { version: 1, owner, backup, beforeDigest: codexCliDigest(undefined), afterDigest: codexCliDigest(this.after) };
            if (!validReceipt(receipt) || !valid()) return { status: "UNAVAILABLE" };
            await deps.prepare(receipt);
            if (!valid()) return { status: "UNAVAILABLE" };
            if (await deps.read() !== undefined) return { status: "CHANGED" };
            if (!valid()) return { status: "UNAVAILABLE" };
            attempted = true; await deps.write(this.after);
            if (!valid() || await deps.read() !== this.after || !valid()) throw Error("Unavailable");
            return { status: "APPLIED", receipt };
        } catch {
            if (!attempted || !receipt) return { status: "UNAVAILABLE" };
            try { const now = await deps.read();
                if (now === undefined) return { status: "ROLLED_BACK" };
                if (codexCliDigest(now) !== receipt.afterDigest) return { status: "INCOMPLETE", receipt };
                await verifyBackup(receipt, deps); await deps.write(undefined, receipt.afterDigest);
                if (await deps.read() === undefined) return { status: "ROLLED_BACK" };
            } catch { /* retain recovery metadata; never replace unowned data */ }
            return { status: "INCOMPLETE", receipt };
        }
    }
}
export function createCodexCliPlan(before: string | undefined, connection: CodexCliConnection, gateway?: CodexCliConnection): CodexCliConfigPlan {
    if (before !== undefined) return fail(); return new CodexCliConfigPlan(renderCodexCliProfile(connection, gateway), gateway !== undefined);
}
export async function codexCliProfileCurrent(receipt: CodexCliReceipt | undefined, deps: CodexCliDependencies): Promise<boolean> {
    try { return validReceipt(receipt) && deps.enabled() === true && deps.fingerprint() === receipt.owner && codexCliDigest(await deps.read()) === receipt.afterDigest
        && deps.enabled() === true && deps.fingerprint() === receipt.owner; } catch { return false; }
}
export async function undoCodexCliProfile(receipt: CodexCliReceipt | undefined, deps: CodexCliDependencies, signal?: AbortSignal): Promise<CodexCliResult> {
    let attempted = false;
    try {
        if (!validReceipt(receipt)) return { status: "UNAVAILABLE" };
        const start = performance.now(), valid = () => currentGuard(deps, receipt.owner, signal, start);
        if (!valid()) return { status: "UNAVAILABLE" };
        if (codexCliDigest(await deps.read()) !== receipt.afterDigest) return { status: "CHANGED" };
        await verifyBackup(receipt, deps);
        if (!valid()) return { status: "UNAVAILABLE" };
        if (!await confirm(deps, "restore", signal, 60000 - (performance.now() - start))) return { status: "CANCELLED" };
        if (!valid() || codexCliDigest(await deps.read()) !== receipt.afterDigest || !valid()) return { status: "CHANGED" };
        attempted = true; await deps.write(undefined, receipt.afterDigest);
        return { status: await deps.read() === undefined ? "RESTORED" : "INCOMPLETE" };
    } catch { return { status: attempted ? "INCOMPLETE" : "UNAVAILABLE", ...(attempted && receipt ? { receipt } : {}) }; }
}
