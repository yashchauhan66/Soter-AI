import { spawn, type ChildProcess } from "node:child_process";
import * as path from "node:path";
import { PS51_LIMITS, powerShell51Literal, powerShell51RelativePath, type PowerShell51Command } from "../../../core/src/PowerShell51Command";
import type { OutputChannel, OutputResult } from "../../../core/src/StreamingOutputRedactor";
import { brokerChildEnvironment } from "../security/childEnvironment";
import { isCheckedGitMetadata, type CheckedGitMetadata } from "./CheckedGitMetadata";

export const POWERSHELL51_EXECUTABLE = "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe";
type PublicOperation = Extract<PowerShell51Command, { kind: "PUBLIC" }>;
export interface PowerShell51Output {
    push(channel: OutputChannel, bytes: Uint8Array): Readonly<{ status: "BUFFERED" | "WITHHELD" }>;
    finish(code: number): OutputResult;
    cancel(): void;
    dispose(): void;
}
export interface PowerShell51Snapshot {
    readonly id: string;
    readonly state: "READY" | "BLOCKED" | "RUNNING" | "CANCEL_PENDING" | "STOP_UNCONFIRMED" | "EXITED" | "CANCELLED";
    readonly pid?: number;
    readonly exitCode?: number;
}
export interface PowerShell51Completion { readonly snapshot: PowerShell51Snapshot; readonly output: OutputResult }
interface Options { id: string; executable: string; root: string; operation: PublicOperation | Extract<PowerShell51Command, { kind: "GIT" }>;
    git?: CheckedGitMetadata;
    parentEnvironment: NodeJS.ProcessEnv; output: PowerShell51Output; enabled?: () => boolean }
interface Dependencies { spawn?: typeof spawn; setTimer?: (callback: () => void, ms: number) => unknown; clearTimer?: (handle: unknown) => void }

// This source is identical for every command. The private stdin request is data,
// never a script, executable, expression, profile or workspace file.
const SCRIPT = String.raw`
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$env:PSModulePath = $PSHOME + '\Modules'
$utf8 = New-Object System.Text.UTF8Encoding($false, $true)
[Console]::InputEncoding = $utf8
[Console]::OutputEncoding = $utf8
$OutputEncoding = $utf8
function Get-Content { throw 'Use the approved reader.' }
function Select-String { throw 'Use the approved reader.' }
function Copy-Item { throw 'Use the approved reader.' }
function Get-Item { throw 'Use the approved reader.' }
function Invoke-Expression { throw 'Unsupported checked command.' }
try {
    $request = Microsoft.PowerShell.Utility\ConvertFrom-Json -InputObject ([Console]::In.ReadToEnd())
    $op = $request.operation
    if ($op.kind -ceq 'GIT') {
        $git = 'C:\Program Files\Git\cmd\git.exe'
        $version = @(& $git --version)
        if ($LASTEXITCODE -ne 0 -or $version.Count -ne 1 -or $version[0] -cne 'git version 2.53.0.windows.1') { throw 'Unsupported Git.' }
        $job = [string]$request.git.job
        $gitArgs = @('--no-pager', '--literal-pathspecs', '--no-lazy-fetch', '--no-replace-objects', '--no-optional-locks', '--attr-source=4b825dc642cb6eb9a060e54bf8d69288fbee4904',
            '-c', ('core.hooksPath=' + $job + '\empty-hooks'), '-c', 'core.fsmonitor=false', '-c', 'credential.helper=', '-c', 'commit.gpgSign=false',
            '-c', 'core.pager=', '-c', 'core.quotePath=false', '-c', 'color.ui=false', '-c', 'diff.external=', '-c', ('core.attributesFile=' + $job + '\empty.gitconfig'), '-c', 'protocol.allow=never', 'diff', '--cached')
        if ($op.action -ceq 'status') { $gitArgs += '--name-status' }
        elseif ($op.action -ceq 'diff-stat') { $gitArgs += '--stat' }
        else { throw 'Unsupported Git metadata.' }
        $gitArgs += @('--no-renames', '--no-ext-diff', '--no-textconv', '--ignore-submodules=all', '--')
        [Console]::WriteLine('Staged changes only; unstaged and untracked files are not inspected.')
        & $git @gitArgs | Microsoft.PowerShell.Core\ForEach-Object { [Console]::WriteLine([string]$_) }
        if ($LASTEXITCODE -ne 0) { throw 'Git metadata unavailable.' }
        return
    }
    if ($op.kind -cne 'PUBLIC') { throw 'Invalid operation.' }
    switch -CaseSensitive ($op.action) {
        'location' { [Console]::WriteLine((Microsoft.PowerShell.Management\Get-Location).Path); break }
        'version' { [Console]::WriteLine($PSVersionTable.PSVersion.ToString()); break }
        'date' { [Console]::WriteLine((Microsoft.PowerShell.Utility\Get-Date).ToString('o')); break }
        'write' { foreach ($item in $op.args) { [Console]::WriteLine([string]$item) }; break }
        'sleep' { Microsoft.PowerShell.Utility\Start-Sleep -Milliseconds ([int]$op.args[0]); break }
        'list' {
            $entries = @(Microsoft.PowerShell.Management\Get-ChildItem -LiteralPath ([string]$op.args[0]) | Microsoft.PowerShell.Utility\Select-Object -First 257)
            if ($entries.Count -gt 256) { throw 'Directory limit.' }
            foreach ($entry in $entries) { [Console]::WriteLine($entry.Name) }
            break
        }
        default { throw 'Unsupported checked command.' }
    }
} catch { throw 'Checked PowerShell operation unavailable.' }
`;
const ENCODED_SCRIPT = Buffer.from(SCRIPT, "utf16le").toString("base64");
const withheld = (): OutputResult => Object.freeze({ status: "WITHHELD", stdout: "", stderr: "", redacted: false, reason: "checked_command_withheld" });

/** Only the fresh minimal base; no caller credential, loader or search path. */
export function powerShell51Environment(source: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
    const result: NodeJS.ProcessEnv = {};
    for (const [name, value] of Object.entries(brokerChildEnvironment(source))) {
        if (typeof value !== "string" || !value || value.length > 4096 || /[\x00-\x1f\x7f-\x9f]/u.test(value)) continue;
        if (["LANG", "LC_ALL", "TZ"].includes(name)) {
            if (/^[A-Za-z0-9_./@+:-]{1,128}$/.test(value)) result[name] = value;
        } else if ((path.isAbsolute(value) || /^[a-z]:\\/i.test(value)) && !value.startsWith("\\\\") && !value.startsWith("//")) result[name] = value;
    }
    return result;
}
function publicRequest(input: unknown): string | undefined {
    try {
        if (!input || typeof input !== "object" || ![Object.prototype, null].includes(Object.getPrototypeOf(input))) return undefined;
        const fields = Object.getOwnPropertyDescriptors(input), keys = Reflect.ownKeys(fields);
        if (keys.length !== 3 || keys.some(key => typeof key !== "string" || !["kind", "action", "args"].includes(key)
            || !Object.hasOwn(fields[key], "value") || !fields[key].enumerable)) return undefined;
        const kind = fields.kind.value, action = fields.action.value, raw = fields.args.value;
        if (kind !== "PUBLIC" || !["location", "version", "date", "write", "list", "sleep"].includes(action)
            || !Array.isArray(raw) || Object.getPrototypeOf(raw) !== Array.prototype || raw.length >= PS51_LIMITS.maxTokens) return undefined;
        const properties = Object.getOwnPropertyDescriptors(raw);
        if (Reflect.ownKeys(properties).length !== raw.length + 1) return undefined;
        const args: string[] = [];
        for (let index = 0; index < raw.length; index++) {
            const item = properties[String(index)];
            if (!item || !Object.hasOwn(item, "value") || !item.enumerable || !powerShell51Literal(item.value)) return undefined;
            args.push(item.value);
        }
        if (["location", "version", "date"].includes(action) && args.length !== 0) return undefined;
        if (action === "list" && (args.length !== 1 || !powerShell51RelativePath(args[0], true))) return undefined;
        if (action === "sleep" && (args.length !== 1 || !/^(?:0|[1-9]\d{0,3})$/.test(args[0]) || Number(args[0]) > PS51_LIMITS.maxSleepMs)) return undefined;
        const request = JSON.stringify({ operation: { kind, action, args } });
        return Buffer.byteLength(request, "utf8") <= PS51_LIMITS.maxRequestBytes ? request : undefined;
    } catch { return undefined; }
}

/** Owns one finite child. Cancellation abandons output; actual close and drained
 * pipes prove completion. No process termination or raw output fallback. */
export class PowerShell51Worker {
    #id = "unavailable";
    #state: PowerShell51Snapshot["state"] = "READY";
    #pid: number | undefined;
    #exitCode: number | undefined;
    #root = "";
    #request: string | undefined;
    #environment: NodeJS.ProcessEnv = {};
    #git: CheckedGitMetadata | undefined;
    #output: PowerShell51Output | undefined;
    #enabled: () => boolean;
    #spawn: typeof spawn;
    #setTimer: NonNullable<Dependencies["setTimer"]>;
    #clearTimer: NonNullable<Dependencies["clearTimer"]>;
    #timers = new Set<unknown>();
    #child: ChildProcess | undefined;
    #started = false;
    #spawned = false;
    #failed = false;
    #cancelled = false;
    #closed = false;
    #finished = false;
    #ends = { stdout: false, stderr: false };
    #drained = { stdout: false, stderr: false };
    #resolve!: (value: PowerShell51Completion) => void;
    #completion: Promise<PowerShell51Completion>;
    #startResolve: (() => void) | undefined;
    constructor(options: Options, deps: Dependencies = {}) {
        this.#completion = new Promise(done => { this.#resolve = done; });
        this.#enabled = options?.enabled ?? (() => true);
        this.#spawn = deps.spawn ?? spawn;
        this.#setTimer = deps.setTimer ?? ((callback, ms) => { const timer = setTimeout(callback, ms); timer.unref(); return timer; });
        this.#clearTimer = deps.clearTimer ?? (handle => clearTimeout(handle as ReturnType<typeof setTimeout>));
        try {
            this.#output = options.output;
            if (typeof options.id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(options.id)) throw new Error();
            this.#id = options.id;
            if (options.executable !== POWERSHELL51_EXECUTABLE || typeof options.root !== "string" || !path.isAbsolute(options.root)
                || /[\x00-\x1f\x7f-\x9f]/u.test(options.root)) throw new Error();
            this.#root = options.root;
            const fields: PropertyDescriptorMap = options.operation && typeof options.operation === "object" ? Object.getOwnPropertyDescriptors(options.operation) : {};
            if (Object.hasOwn(fields.kind ?? {}, "value") && fields.kind.value === "GIT") {
                if (!isCheckedGitMetadata(options.git) || !options.git.available() || ![Object.prototype, null].includes(Object.getPrototypeOf(options.operation))
                    || Reflect.ownKeys(fields).length !== 2 || Reflect.ownKeys(fields).some(key => typeof key !== "string" || !["kind", "action"].includes(key) || !Object.hasOwn(fields[key], "value") || !fields[key].enumerable)
                    || !["status", "diff-stat"].includes(fields.action.value)) throw new Error();
                this.#git = options.git;
                this.#request = JSON.stringify({ operation: { kind: "GIT", action: fields.action.value }, git: { job: options.git.job } });
                this.#environment = { ...options.git.environment };
            } else {
                this.#request = publicRequest(options.operation); if (this.#request === undefined) throw new Error();
                this.#environment = powerShell51Environment(options.parentEnvironment);
            }
        } catch { this.#failed = true; this.#state = "BLOCKED"; this.#request = undefined; }
    }
    get completion(): Promise<PowerShell51Completion> { return this.#completion; }
    snapshot(): Readonly<PowerShell51Snapshot> {
        return Object.freeze({ id: this.#id, state: this.#state, ...(this.#pid === undefined ? {} : { pid: this.#pid }),
            ...(this.#exitCode === undefined ? {} : { exitCode: this.#exitCode }) });
    }
    async start(): Promise<PowerShell51Snapshot> {
        if (this.#started || this.#finished) return this.snapshot(); this.#started = true;
        if (!this.#available()) { this.#withoutChild(); return this.snapshot(); }
        const started = new Promise<void>(done => { this.#startResolve = done; });
        try {
            const child = this.#spawn(POWERSHELL51_EXECUTABLE, ["-NoLogo", "-NoProfile", "-NonInteractive", "-EncodedCommand", ENCODED_SCRIPT], {
                cwd: this.#root, env: this.#environment, shell: false, windowsHide: true, stdio: ["pipe", "pipe", "pipe"],
            });
            this.#child = child; this.#environment = {};
            if (Number.isInteger(child.pid) && child.pid! > 0) this.#pid = child.pid;
            child.once("spawn", () => {
                this.#spawned = true;
                if (!this.#cancelled && this.#available()) {
                    this.#state = "RUNNING";
                    try { child.stdin!.end(this.#request, "utf8"); } catch { this.cancel(); }
                } else { this.cancel(); try { child.stdin?.end(); } catch { /* Keep close ownership. */ } }
                this.#request = undefined; this.#settleStart();
            });
            child.on("error", () => {
                this.#failed = true;
                if (!this.#spawned && this.#pid === undefined) this.#withoutChild(); else this.cancel();
                this.#settleStart();
            });
            child.once("close", code => {
                this.#closed = true;
                if (Number.isInteger(code) && code! >= -2147483648 && code! <= 2147483647) this.#exitCode = code!;
                if (!this.#ends.stdout || !this.#ends.stderr || this.#exitCode === undefined) this.cancel();
                this.#settleStart(); this.#tryFinish();
            });
            for (const channel of ["stdout", "stderr"] as const) {
                const stream = child[channel];
                if (!stream) { this.#drained[channel] = true; this.cancel(); continue; }
                stream.on("data", bytes => this.#data(channel, bytes));
                stream.once("end", () => { this.#ends[channel] = true; this.#drained[channel] = true; this.#tryFinish(); });
                stream.on("error", () => this.cancel());
                stream.once("close", () => { this.#drained[channel] = true; if (!this.#ends[channel]) this.cancel(); this.#tryFinish(); });
            }
            if (!child.stdin) this.cancel(); else child.stdin.on("error", () => this.cancel());
            this.#timer(() => this.cancel(), PS51_LIMITS.maxRuntimeMs); this.#poll();
        } catch { this.#failed = true; if (!this.#child) this.#withoutChild(); else this.cancel(); this.#settleStart(); }
        await started; return this.snapshot();
    }
    cancel(): void {
        if (this.#finished || this.#cancelled) return;
        this.#cancelled = true; this.#request = undefined;
        try { this.#output?.cancel(); } catch { /* No raw fallback. */ }
        if (!this.#child) { this.#withoutChild(); return; }
        this.#state = "CANCEL_PENDING";
        this.#timer(() => { if (!this.#closed && !this.#finished) this.#state = "STOP_UNCONFIRMED"; }, PS51_LIMITS.stopGraceMs);
    }
    dispose(): void { this.cancel(); }
    #available(): boolean {
        if (this.#cancelled || this.#finished || this.#failed) return false;
        try { return this.#enabled() === true && (!this.#git || this.#git.available()) && !this.#cancelled && !this.#finished && !this.#failed; } catch { return false; }
    }
    #data(channel: OutputChannel, bytes: unknown): void {
        if (this.#finished || this.#cancelled) return;
        try { if (!this.#available() || !(bytes instanceof Uint8Array) || this.#output?.push(channel, bytes).status !== "BUFFERED") this.cancel(); }
        catch { this.cancel(); }
    }
    #timer(callback: () => void, ms: number): void {
        let handle: unknown; handle = this.#setTimer(() => { this.#timers.delete(handle); callback(); }, ms); this.#timers.add(handle);
    }
    #poll(): void { this.#timer(() => { if (this.#closed || this.#finished || this.#cancelled) return; if (!this.#available()) this.cancel(); else this.#poll(); }, 250); }
    #settleStart(): void { this.#startResolve?.(); this.#startResolve = undefined; }
    #withoutChild(): void { this.#state = this.#failed || !this.#cancelled ? "BLOCKED" : "CANCELLED"; this.#complete(withheld()); }
    #tryFinish(): void {
        if (!this.#closed || !this.#drained.stdout || !this.#drained.stderr || this.#finished) return;
        let output = withheld();
        try { if (this.#available() && this.#exitCode !== undefined && (!this.#git || this.#exitCode === 0)) output = this.#output?.finish(this.#exitCode) ?? withheld(); }
        catch { output = withheld(); }
        if (!this.#available()) output = withheld();
        this.#state = this.#failed ? "BLOCKED" : this.#cancelled ? "CANCELLED" : "EXITED"; this.#complete(output);
    }
    #complete(output: OutputResult): void {
        if (this.#finished) return; this.#finished = true; this.#request = undefined; this.#environment = {}; this.#child = undefined;
        try { this.#output?.dispose(); } catch { /* No original output retained. */ } this.#output = undefined;
        for (const timer of this.#timers) this.#clearTimer(timer); this.#timers.clear(); this.#settleStart();
        this.#resolve(Object.freeze({ snapshot: this.snapshot(), output }));
    }
}
