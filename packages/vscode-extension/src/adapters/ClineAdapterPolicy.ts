import { createHash } from "node:crypto";
import * as path from "node:path";
import { decodeBoundedJson } from "../../../../apps/local-ai-broker/src/BoundedJson";
import type { BackupSink } from "../broker/IntegrationAdapter";

export interface ClinePin { publisher: string; name: string; version: string; manifestSha256: string; runtimeSha256: string }
export const CLINE_PIN: Readonly<ClinePin> = Object.freeze({ publisher: "saoudrizwan", name: "claude-dev", version: "4.1.25",
    manifestSha256: "4a91298536329c8987b77223c06d3a6778af3a7e3678ed7173dd430f3636d7eb", runtimeSha256: "a3e8eda18b38547df9c614e62d04106cdf3bf2df2cb16241af3f7b3770088022" });
const digest = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
const unavailable = (): never => { throw new Error("Cline adapter schema unavailable or unsupported."); };
const record = (value: unknown): value is Record<string, any> => !!value && typeof value === "object" && !Array.isArray(value);
function json(value: string | undefined): Record<string, any> {
    if (typeof value !== "string") return unavailable();
    try {
        // The shared parser publishes frozen nodes. A config writer needs its
        // own validated copy, never an attempted mutation of that snapshot.
        const parsed = decodeBoundedJson(Buffer.from(value), { maxBytes: 262144, maxDepth: 16, maxNodes: 4096 });
        return JSON.parse(parsed.canonical) as Record<string, any>;
    } catch { return unavailable(); }
}
export function verifyClineArtifact(manifest: Uint8Array, runtime: Uint8Array, pin: Readonly<ClinePin> = CLINE_PIN): boolean {
    try {
        if (manifest.byteLength > 65536 || runtime.byteLength > 32 * 1024 * 1024 || digest(manifest) !== pin.manifestSha256 || digest(runtime) !== pin.runtimeSha256) return false;
        const item = json(Buffer.from(manifest).toString("utf8")); return item.publisher === pin.publisher && item.name === pin.name && item.version === pin.version && item.main === "./dist/extension.js";
    } catch { return false; }
}
export type ClineFileKey = "providers" | "mcp" | "globals" | "hook" | "taskHook";
export type ClineFiles = Record<ClineFileKey, string | undefined>;
export interface ClineBinding { url: string; credential: string; codePath: string; mcpPath: string; ticketPath: string; workspace: string; session: string }
export interface ClinePreview { version: "4.1.25"; operation: "configure" | "restore"; changes: ClineFileKey[]; diff: string[]; treatment: string }
export interface ClineDependencies {
    enabled(): boolean; fingerprint(): string;
    read(key: ClineFileKey): Promise<string | undefined>;
    /** Host performs bounded, canonical, atomic writes to only these owned files. */
    write(key: ClineFileKey, text: string | undefined): Promise<void>;
    backups: BackupSink; confirm(preview: ClinePreview): Promise<boolean>;
}
export interface ClineReceipt { version: 1; entries: Array<{ key: ClineFileKey; backup: string; beforeDigest: string; afterDigest: string }>; owner: string }
export interface ClineResult { status: "APPLIED" | "RESTORED" | "CANCELLED" | "CHANGED" | "UNAVAILABLE" | "ROLLED_BACK" | "INCOMPLETE"; receipt?: ClineReceipt }
const keys: ClineFileKey[] = ["providers", "mcp", "globals", "hook", "taskHook"];
export const clineFileDigest = (value: string | undefined) => digest(JSON.stringify({ present: value !== undefined, value }));
const fileDigest = clineFileDigest;
const encode = (value: unknown) => JSON.stringify(value, null, 2) + "\n";
const psLiteral = (value: string) => "'" + value.replaceAll("'", "''") + "'";
export const CLINE_HOOK_MARKER = "# SoterAI F18 pinned managed hook v1";
export function clineHook(binding: ClineBinding): string {
    return `${CLINE_HOOK_MARKER}
$ErrorActionPreference='Stop'
$taskProcess=$null
try {
  [Console]::InputEncoding=[Text.UTF8Encoding]::new($false)
  [Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)
  $taskInputBuffer=[char[]]::new(8193)
  $taskInputCount=[Console]::In.ReadBlock($taskInputBuffer,0,$taskInputBuffer.Length)
  if($taskInputCount -gt 8192){throw 'Unavailable'}
  $taskInput=[string]::new($taskInputBuffer,0,$taskInputCount)
  if([Text.Encoding]::UTF8.GetByteCount($taskInput) -gt 8192){throw 'Unavailable'}
  $taskInfo=[Diagnostics.ProcessStartInfo]::new()
  $taskInfo.FileName=${psLiteral(binding.codePath)}
  $taskInfo.Arguments=${psLiteral('"' + binding.mcpPath + '" --cline-hook')}
  $taskInfo.UseShellExecute=$false
  $taskInfo.CreateNoWindow=$true
  $taskInfo.WindowStyle=[Diagnostics.ProcessWindowStyle]::Hidden
  $taskInfo.RedirectStandardInput=$true
  $taskInfo.RedirectStandardOutput=$true
  $taskInfo.RedirectStandardError=$true
  $taskInfo.StandardOutputEncoding=[Text.UTF8Encoding]::new($false)
  $taskInfo.EnvironmentVariables.Clear()
  foreach($taskKey in @('SystemRoot','WINDIR','USERPROFILE','APPDATA','LOCALAPPDATA','TEMP','TMP')){
    $taskValue=[Environment]::GetEnvironmentVariable($taskKey)
    if($taskValue){$taskInfo.EnvironmentVariables[$taskKey]=$taskValue}
  }
  $taskInfo.EnvironmentVariables['ELECTRON_RUN_AS_NODE']='1'
  $taskInfo.EnvironmentVariables['SOTERAI_CLINE_WORKSPACE']=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
  $taskInfo.EnvironmentVariables['SOTERAI_SAFE_READ_TICKET_PATH']=${psLiteral(binding.ticketPath)}
  $taskProcess=[Diagnostics.Process]::new()
  $taskProcess.StartInfo=$taskInfo
  [void]$taskProcess.Start()
  $taskProcess.StandardInput.Write($taskInput)
  $taskProcess.StandardInput.Close()
  $taskOut=[char[]]::new(8193)
  $taskErr=[char[]]::new(1025)
  $taskOutCount=0;$taskErrCount=0;$taskOutEnd=$false;$taskErrEnd=$false
  $taskOutRead=$taskProcess.StandardOutput.ReadAsync($taskOut,0,$taskOut.Length)
  $taskErrRead=$taskProcess.StandardError.ReadAsync($taskErr,0,$taskErr.Length)
  $taskTimer=[Diagnostics.Stopwatch]::StartNew()
  while($taskTimer.ElapsedMilliseconds -lt 10000){
    if(-not $taskOutEnd -and $taskOutRead.IsCompleted){
      $taskCount=$taskOutRead.GetAwaiter().GetResult()
      if($taskCount -eq 0){$taskOutEnd=$true}else{
        $taskOutCount+=$taskCount
        if($taskOutCount -gt 8192){throw 'Unavailable'}
        $taskOutRead=$taskProcess.StandardOutput.ReadAsync($taskOut,$taskOutCount,$taskOut.Length-$taskOutCount)
      }
    }
    if(-not $taskErrEnd -and $taskErrRead.IsCompleted){
      $taskCount=$taskErrRead.GetAwaiter().GetResult()
      if($taskCount -eq 0){$taskErrEnd=$true}else{
        $taskErrCount+=$taskCount
        if($taskErrCount -gt 1024){throw 'Unavailable'}
        $taskErrRead=$taskProcess.StandardError.ReadAsync($taskErr,$taskErrCount,$taskErr.Length-$taskErrCount)
      }
    }
    if($taskProcess.HasExited -and $taskOutEnd -and $taskErrEnd){break}
    Start-Sleep -Milliseconds 10
  }
  if(-not $taskProcess.HasExited -or -not $taskOutEnd -or -not $taskErrEnd -or $taskProcess.ExitCode -ne 0 -or $taskErrCount -ne 0){throw 'Unavailable'}
  $taskObject=([string]::new($taskOut,0,$taskOutCount))|ConvertFrom-Json
  if($taskObject.cancel -isnot [bool]){throw 'Unavailable'}
  [Console]::Out.WriteLine(($taskObject|ConvertTo-Json -Compress -Depth 8))
} catch {
  [Console]::Out.WriteLine('{"cancel":true,"errorMessage":"Managed route unavailable; use the approved SoterAI safe reader."}')
} finally {
  if($null -ne $taskProcess){$taskProcess.Dispose()}
}
`;
}
/** Exact current schema only; credentials and source config remain private. */
export function createClinePlan(input: ClineFiles, binding: ClineBinding): ClineConfigPlan {
    try {
        const url = new URL(binding.url);
        if (url.href !== binding.url || url.protocol !== "http:" || url.hostname !== "127.0.0.1" || !url.port || Number(url.port) > 65535 || url.pathname !== "/v1/ai/openai-compatible" || url.search || url.hash || url.username || url.password) return unavailable();
        if (typeof binding.credential !== "string" || binding.credential.length < 8 || binding.credential.length > 1024 || /[\x00-\x20\x7f]/.test(binding.credential)) return unavailable();
        for (const key of ["codePath", "mcpPath", "ticketPath", "workspace"] as const) if (!path.win32.isAbsolute(binding[key]) || binding[key].length > 1024 || /[\x00-\x1f\x7f"<>|?*]/.test(binding[key])) return unavailable();
        const ticketRelative = path.win32.relative(binding.workspace, binding.ticketPath);
        if (!ticketRelative || !path.win32.isAbsolute(ticketRelative) && ticketRelative !== ".." && !ticketRelative.startsWith("..\\")) return unavailable();
        if (path.win32.basename(binding.ticketPath) !== "cline-session.ticket" || path.win32.basename(binding.mcpPath) !== "soterai-mcp-server.js" || !binding.session || binding.session.length > 128) return unavailable();
        const providers = json(input.providers), mcp = json(input.mcp), globals = json(input.globals);
        if (providers.version !== 1 || !record(providers.providers) || !record(providers.modes) || Object.keys(providers.modes).length) return unavailable();
        if (!record(mcp.mcpServers) || Object.hasOwn(mcp.mcpServers, "soterai_safe_read")) return unavailable();
        for (const key of ["hook", "taskHook"] as const) if (input[key] !== undefined && !input[key]!.startsWith(CLINE_HOOK_MARKER + "\n")) return unavailable();
        const previous = providers.providers["openai-compatible"];
        if (!record(previous) || !record(previous.settings) || previous.settings.provider !== "openai-compatible" || typeof previous.settings.model !== "string" || !previous.settings.model || previous.settings.model.length > 256) return unavailable();
        const headers = previous.settings.headers ?? {};
        if (!record(headers) || Object.keys(headers).length > 16 || Object.entries(headers).some(([key, value]) => !/^[!#$%&'*+.^_`|~0-9A-Za-z-]{1,64}$/.test(key)
            || typeof value !== "string" || Buffer.byteLength(value) > 2048 || /[\x00-\x1f\x7f]/.test(value))) return unavailable();
        const ownedHeaders = Object.fromEntries(Object.entries(headers).filter(([key]) => key.toLowerCase() !== "authorization"));
        ownedHeaders.Authorization = "Bearer " + binding.credential;
        // The pinned vendor merges a legacy API key ahead of the file key.
        // Its explicit custom Authorization header binds the actual request to
        // the current owned session without changing another extension's secrets.
        providers.providers["openai-compatible"] = { ...previous, settings: { ...previous.settings, apiKey: binding.credential, baseUrl: binding.url, headers: ownedHeaders } };
        providers.lastUsedProvider = "openai-compatible";
        mcp.mcpServers.soterai_safe_read = { command: binding.codePath, args: [binding.mcpPath], env: { ELECTRON_RUN_AS_NODE: "1", SOTERAI_SAFE_READ_TICKET_PATH: binding.ticketPath }, disabled: false, autoApprove: [] };
        globals.autoUpdateEnabled = false; globals.telemetryOptOut = true;
        return new ClineConfigPlan({ ...input }, { providers: encode(providers), mcp: encode(mcp), globals: encode(globals), hook: clineHook(binding), taskHook: clineHook(binding) });
    } catch { return unavailable(); }
}
export class ClineConfigPlan {
    #consumed = false;
    constructor(before: ClineFiles, after: ClineFiles) { this.#before = before; this.#after = after; }
    #before: ClineFiles; #after: ClineFiles;
    preview(): ClinePreview { return { version: "4.1.25", operation: "configure", changes: [...keys], diff: [
        "providers.json / openai-compatible.baseUrl: [current route withheld] -> current owned loopback broker",
        "providers.json / openai-compatible.apiKey: [MASKED] -> [MASKED current-session credential]",
        "providers.json / openai-compatible.headers.Authorization: [MASKED if present] -> [MASKED current-session bearer]",
        "cline_mcp_settings.json / soterai_safe_read: absent -> bundled approved reader with sealed session ticket",
        "global-settings.json / autoUpdateEnabled: [current setting] -> false; telemetryOptOut: [current setting] -> true",
        ".clinerules/hooks/PreToolUse.ps1 and TaskStart.ps1: absent or previously managed -> current managed session hooks",
    ], treatment: "Route the selected OpenAI-compatible provider through the current owned broker; install the approved MCP reader and managed hook; pin vendor updates and opt out of vendor telemetry. Previous config is encrypted before writes. Credentials, original config and ticket contents are withheld from this review." }; }
    async apply(deps: ClineDependencies, signal?: AbortSignal): Promise<ClineResult> {
        if (this.#consumed) return { status: "UNAVAILABLE" }; this.#consumed = true;
        const started = performance.now(); let owner: string;
        try { owner = deps.fingerprint(); if (!owner || !deps.enabled()) return { status: "UNAVAILABLE" }; } catch { return { status: "UNAVAILABLE" }; }
        const valid = () => { try { return !signal?.aborted && deps.enabled() === true && deps.fingerprint() === owner && performance.now() - started < 60000; } catch { return false; } };
        const entries: ClineReceipt["entries"] = [], written: ClineFileKey[] = [];
        try {
            for (const key of keys) if (await deps.read(key) !== this.#before[key]) return { status: "CHANGED" };
            if (!valid()) return { status: "UNAVAILABLE" };
            let timer: ReturnType<typeof setTimeout> | undefined, cancel: (() => void) | undefined;
            const approved = await Promise.race([deps.confirm(this.preview()), new Promise<boolean>(done => { cancel = () => done(false); signal?.addEventListener("abort", cancel, { once: true }); if (signal?.aborted) cancel(); timer = setTimeout(() => done(false), 60000); timer.unref?.(); })]).finally(() => { if (timer) clearTimeout(timer); if (cancel) signal?.removeEventListener("abort", cancel); });
            if (approved !== true) return { status: "CANCELLED" }; if (!valid()) return { status: "UNAVAILABLE" };
            for (const key of keys) if (await deps.read(key) !== this.#before[key]) return { status: "CHANGED" };
            for (const key of keys) { if (!valid()) return { status: "UNAVAILABLE" }; const backup = await deps.backups.store(key, encode({ version: 1, present: this.#before[key] !== undefined, before: this.#before[key] })); if (typeof backup !== "string" || !backup || backup.length > 256) throw Error("Backup unavailable"); entries.push({ key, backup, beforeDigest: fileDigest(this.#before[key]), afterDigest: fileDigest(this.#after[key]) }); }
            for (const key of keys) {
                if (!valid() || await deps.read(key) !== this.#before[key]) throw Error("Configuration changed");
                await deps.write(key, this.#after[key]); written.push(key);
                if (!valid() || await deps.read(key) !== this.#after[key]) throw Error("Configuration changed");
            }
            return { status: "APPLIED", receipt: { version: 1, entries, owner } };
        } catch {
            if (!written.length) return { status: "UNAVAILABLE" };
            let restored = true;
            for (const key of written.reverse()) { try { if (await deps.read(key) !== this.#after[key]) { restored = false; continue; } const entry = entries.find(item => item.key === key)!; const old = await restoreValue(entry, deps.backups); await deps.write(key, old); if (await deps.read(key) !== old) restored = false; } catch { restored = false; } }
            return { status: restored ? "ROLLED_BACK" : "INCOMPLETE", ...(restored ? {} : { receipt: { version: 1, entries, owner } }) };
        }
    }
}
async function restoreValue(entry: ClineReceipt["entries"][number], backups: BackupSink): Promise<string | undefined> {
    const encoded = await backups.retrieve(entry.backup); if (typeof encoded !== "string") return unavailable(); const value = json(encoded);
    if (value.version !== 1 || typeof value.present !== "boolean" || value.present && typeof value.before !== "string") return unavailable();
    return value.present ? value.before : undefined;
}
export async function undoClineFiles(receipt: ClineReceipt | undefined, deps: ClineDependencies): Promise<ClineResult> {
    try {
        if (!receipt || receipt.version !== 1 || receipt.entries.length !== keys.length || !deps.enabled() || deps.fingerprint() !== receipt.owner) return { status: "UNAVAILABLE" };
        if (new Set(receipt.entries.map(entry => entry.key)).size !== keys.length || receipt.entries.some(entry => !keys.includes(entry.key) || typeof entry.backup !== "string" || !/^[a-f0-9]{64}$/.test(entry.afterDigest) || !/^[a-f0-9]{64}$/.test(entry.beforeDigest))) return { status: "UNAVAILABLE" };
        for (const entry of receipt.entries) { const current = fileDigest(await deps.read(entry.key)); if (current !== entry.afterDigest && current !== entry.beforeDigest) return { status: "CHANGED" }; }
        const originals = new Map<ClineFileKey, string | undefined>(); for (const entry of receipt.entries) originals.set(entry.key, await restoreValue(entry, deps.backups));
        if (await deps.confirm({ version: "4.1.25", operation: "restore", changes: [...keys], diff: ["Five unchanged owned entries -> their exact encrypted previous state", "Managed provider, MCP reader and session hooks -> previous configuration; vendor routes become unverified"], treatment: "Restore the exact encrypted previous Cline config. The managed session will be withdrawn; direct vendor routes are outside SoterAI. Saved project denies remain." }) !== true) return { status: "CANCELLED" };
        if (!deps.enabled() || deps.fingerprint() !== receipt.owner) return { status: "UNAVAILABLE" };
        for (const entry of receipt.entries) { const current = fileDigest(await deps.read(entry.key)); if (current !== entry.afterDigest && current !== entry.beforeDigest) return { status: "CHANGED" }; }
        let written = 0;
        try { for (const entry of [...receipt.entries].reverse()) {
            if (!deps.enabled() || deps.fingerprint() !== receipt.owner) return { status: written ? "INCOMPLETE" : "CHANGED" };
            const current = fileDigest(await deps.read(entry.key)); if (current === entry.beforeDigest) continue;
            if (current !== entry.afterDigest) return { status: written ? "INCOMPLETE" : "CHANGED" };
            await deps.write(entry.key, originals.get(entry.key)); written++;
            if (fileDigest(await deps.read(entry.key)) !== entry.beforeDigest) return { status: "INCOMPLETE" };
        } }
        catch { return { status: "INCOMPLETE" }; }
        return { status: "RESTORED" };
    } catch { return { status: "UNAVAILABLE" }; }
}
