import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { homedir } from "node:os";
import {
    BrokerClient,
    resolveBrokerToken,
    DEFAULT_BROKER_URL,
    type ScanResponse,
    type SafeModeLevel,
} from "@soterai/ide-common";
import {
    DEFAULT_HOOK_OPTIONS,
    FILE_READ_BUDGET,
    detectAgent,
    errorVerdict,
    evaluateHook,
    normalizeCall,
    parseHookInput,
    renderVerdict,
    type BoundedFile,
    type HookAgent,
    type HookDeps,
    type OnError,
} from "./hook";
import {
    CURSOR_EVENTS,
    HOOK_MARKER,
    claudeSettingsPath,
    cursorCommandString,
    cursorHooksPath,
    hookCommand,
    mergeClaudeCodeHooks,
    mergeCursorHooks,
    type HookScope,
} from "./hook-install";

const execFileAsync = promisify(execFile);

/** Injectable side-effects so the command layer is fully testable. */
export interface CliDeps {
    out: (line: string) => void;
    err: (line: string) => void;
    /** Build a client for a resolved base URL + token. */
    makeClient: (baseUrl: string, token?: string) => Pick<
        BrokerClient,
        | "isHealthy"
        | "version"
        | "scanText"
        | "redact"
        | "safeModeStatus"
        | "enableSafeMode"
        | "disableSafeMode"
        | "exportRedacted"
        | "recentEvents"
    >;
    resolveToken: (explicit?: string) => Promise<string>;
    readFileText: (file: string) => Promise<string>;
    readStdin: () => Promise<string>;
    gitDiff: (cwd: string) => Promise<string>;
    findMcpConfigs: (cwd: string) => Promise<string[]>;
    startBroker: () => Promise<number>;
    cwd: string;
    // ---- hook support -----------------------------------------------------
    /** Read a hook's file target under a byte budget. null = not a real file. */
    readTargetFile: (absPath: string) => Promise<BoundedFile | null>;
    isFile: (absPath: string) => Promise<boolean>;
    /** Read a JSON config, returning undefined when it does not exist. */
    readJsonFile: (file: string) => Promise<unknown>;
    /** Write a JSON config atomically (temp file in the same dir, then rename). */
    writeJsonFile: (file: string, value: unknown) => Promise<void>;
    home: string;
    execPath: string;
    /** Absolute path to this CLI's entry script, used in generated hook config. */
    cliEntry: string;
}

export function defaultDeps(overrides: Partial<CliDeps> = {}): CliDeps {
    return {
        out: (line) => process.stdout.write(line + "\n"),
        err: (line) => process.stderr.write(line + "\n"),
        makeClient: (baseUrl, token) => new BrokerClient({ baseUrl, token }),
        resolveToken: async (explicit) => (await resolveBrokerToken(explicit)).token,
        readFileText: (file) => readFile(file, "utf8"),
        readStdin: readStdin,
        gitDiff: async (cwd) => {
            const { stdout } = await execFileAsync("git", ["diff", "--no-color"], { cwd, maxBuffer: 16 * 1024 * 1024 });
            return stdout;
        },
        findMcpConfigs: findMcpConfigs,
        startBroker: startBroker,
        cwd: process.cwd(),
        readTargetFile: readTargetFile,
        isFile: isFile,
        readJsonFile: readJsonFile,
        writeJsonFile: writeJsonFile,
        home: homedir(),
        execPath: process.execPath,
        cliEntry: process.argv[1] ?? path.join(__dirname, "cli.js"),
        ...overrides,
    };
}

const HELP = `soterai — local-first AI security guard CLI

Usage:
  soterai scan file <path>        Scan a file through the Local AI Broker
  soterai scan text               Scan text from stdin
  soterai redact file <path>      Print a redacted, AI-safe version of a file
  soterai broker start            Start the loopback Local AI Broker
  soterai broker status           Show broker health and version
  soterai safe-mode on [level]    Enable Safe Mode (developer|strict|enterprise)
  soterai safe-mode off           Disable Safe Mode
  soterai safe-mode status        Show Safe Mode status
  soterai memory export           Export the redacted "What AI Saw" ledger
  soterai mcp scan                Scan MCP config files for risky content
  soterai git scan                Scan uncommitted git changes
  soterai hook <agent>            Run as an agent hook (reads the call on stdin)
  soterai hook install <agent>    Install the hook into an agent's config
  soterai hook status             Show where the hook is installed and active
  soterai version                 Show CLI and broker protocol version

Global flags:
  --url <url>     Broker base URL (default ${DEFAULT_BROKER_URL}, loopback only)
  --token <t>     Broker token (else SOTERAI_BROKER_TOKEN or the token file)
  --json          Emit machine-readable JSON

Hook flags:
  --on-error <deny|allow>   What to do when the call cannot be checked
                            (default deny — a guard that fails open is a monitor)
  --timeout-ms <n>          Hook's own budget, kept under the agent's (default 5000)
  --scope <user|project>    Which config file "hook install" writes (default user)

Local-first: file contents are sent only to the loopback broker. Raw secrets are
never printed — scans show a redacted decision, not the matched value.`;

interface ParsedArgs {
    positionals: string[];
    url: string; // can be overridden via --url flag
    token?: string;
    json: boolean;
    /** Long flags in `--key value` or `--key=value` form. */
    flags: Record<string, string>;
}

export function parseArgs(argv: string[]): ParsedArgs {
    const positionals: string[] = [];
    const flags: Record<string, string> = {};
    let url: string = DEFAULT_BROKER_URL;
    let token: string | undefined;
    let json = false;
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === "--url") url = argv[++i] ?? url;
        else if (arg === "--token") token = argv[++i];
        else if (arg === "--json") json = true;
        else if (arg.startsWith("--")) {
            // `--key=value` and `--key value`, so unknown flags never get
            // mistaken for a subcommand (a stray `--marker=…` used to become a
            // positional and shift the command parse).
            const eq = arg.indexOf("=");
            if (eq > 2) flags[arg.slice(2, eq)] = arg.slice(eq + 1);
            else {
                const next = argv[i + 1];
                if (next !== undefined && !next.startsWith("--")) flags[arg.slice(2)] = argv[++i];
                else flags[arg.slice(2)] = "true";
            }
        } else positionals.push(arg);
    }
    return { positionals, url, token, json, flags };
}

/** Run the CLI. Returns a process exit code (0 = success). */
export async function run(argv: string[], deps: CliDeps): Promise<number> {
    const args = parseArgs(argv);
    const [command, sub, ...rest] = args.positionals;

    // The hook runs OUTSIDE the generic catch below on purpose: that handler
    // returns exit 1, which Claude Code treats as a NON-blocking error and lets
    // the tool call proceed. Routing a crash through it would turn every
    // internal error into a silent fail-open. cmdHook renders its own failures.
    if (command === "hook") return await cmdHook(deps, args, sub, rest);

    try {
        if (!command || command === "help" || command === "--help" || command === "-h") {
            deps.out(HELP);
            return 0;
        }
        if (command === "version") return await cmdVersion(deps, args);
        if (command === "broker") {
            if (sub === "start") return await deps.startBroker();
            if (sub === "status") return await cmdBrokerStatus(deps, args);
            deps.err("Usage: soterai broker <start|status>");
            return 2;
        }
        if (command === "scan") {
            if (sub === "file") return await cmdScanFile(deps, args, rest[0]);
            if (sub === "text") return await cmdScanText(deps, args);
            deps.err("Usage: soterai scan <file <path>|text>");
            return 2;
        }
        if (command === "redact" && sub === "file") return await cmdRedactFile(deps, args, rest[0]);
        if (command === "safe-mode") return await cmdSafeMode(deps, args, sub, rest[0]);
        if (command === "memory" && sub === "export") return await cmdMemoryExport(deps, args);
        if (command === "mcp" && sub === "scan") return await cmdMcpScan(deps, args);
        if (command === "git" && sub === "scan") return await cmdGitScan(deps, args);

        deps.err(`Unknown command: ${[command, sub].filter(Boolean).join(" ")}\nRun "soterai help".`);
        return 2;
    } catch (error) {
        deps.err(error instanceof Error ? error.message : "Unexpected error");
        return 1;
    }
}

// ---- commands -------------------------------------------------------------

async function cmdVersion(deps: CliDeps, args: ParsedArgs): Promise<number> {
    const client = deps.makeClient(args.url);
    let broker = "unreachable";
    try {
        const token = await deps.resolveToken(args.token);
        broker = (await deps.makeClient(args.url, token).version()).version;
    } catch {
        /* broker not running — leave as unreachable */
    }
    emit(deps, args, `soterai-cli 0.1.0 (broker ${broker})`, { cli: "0.1.0", broker });
    void client;
    return 0;
}

async function cmdBrokerStatus(deps: CliDeps, args: ParsedArgs): Promise<number> {
    const healthy = await deps.makeClient(args.url).isHealthy();
    if (!healthy) {
        emit(deps, args, `Broker: DOWN (${args.url}). Start it with "soterai broker start".`, {
            healthy: false,
            url: args.url,
        });
        return 1;
    }
    let version = "unknown";
    try {
        const token = await deps.resolveToken(args.token);
        version = (await deps.makeClient(args.url, token).version()).version;
    } catch { /* health is enough to report UP */ }
    emit(deps, args, `Broker: UP (${args.url}, v${version}, loopback only)`, { healthy: true, url: args.url, version });
    return 0;
}

async function cmdScanFile(deps: CliDeps, args: ParsedArgs, file?: string): Promise<number> {
    if (!file) { deps.err("Usage: soterai scan file <path>"); return 2; }
    const content = await deps.readFileText(file);
    const result = await scan(deps, args, content);
    return reportScan(deps, args, result, path.basename(file));
}

async function cmdScanText(deps: CliDeps, args: ParsedArgs): Promise<number> {
    const content = await deps.readStdin();
    if (!content.trim()) { deps.err("No input on stdin."); return 2; }
    const result = await scan(deps, args, content);
    return reportScan(deps, args, result, "stdin");
}

async function cmdRedactFile(deps: CliDeps, args: ParsedArgs, file?: string): Promise<number> {
    if (!file) { deps.err("Usage: soterai redact file <path>"); return 2; }
    const content = await deps.readFileText(file);
    const token = await deps.resolveToken(args.token);
    const redacted = await deps.makeClient(args.url, token).redact(content);
    // Redacted output is safe to print by contract.
    if (args.json) deps.out(JSON.stringify({ file, redacted }));
    else deps.out(redacted);
    return 0;
}

async function cmdSafeMode(deps: CliDeps, args: ParsedArgs, action?: string, level?: string): Promise<number> {
    const token = await deps.resolveToken(args.token);
    const client = deps.makeClient(args.url, token);
    if (action === "on") {
        const status = await client.enableSafeMode(coerceLevel(level));
        emit(deps, args, `Safe Mode: ON (${status.level})`, status);
        return 0;
    }
    if (action === "off") {
        const status = await client.disableSafeMode();
        emit(deps, args, "Safe Mode: OFF", status);
        return 0;
    }
    if (action === "status") {
        const status = await client.safeModeStatus();
        emit(deps, args, `Safe Mode: ${status.enabled ? "ON" : "OFF"} (${status.level})`, status);
        return 0;
    }
    deps.err("Usage: soterai safe-mode <on [level]|off|status>");
    return 2;
}

async function cmdMemoryExport(deps: CliDeps, args: ParsedArgs): Promise<number> {
    const token = await deps.resolveToken(args.token);
    const data = await deps.makeClient(args.url, token).exportRedacted();
    deps.out(JSON.stringify(data, null, args.json ? 0 : 2));
    return 0;
}

async function cmdMcpScan(deps: CliDeps, args: ParsedArgs): Promise<number> {
    const configs = await deps.findMcpConfigs(deps.cwd);
    if (configs.length === 0) {
        emit(deps, args, "No MCP config files found.", { files: [] });
        return 0;
    }
    const token = await deps.resolveToken(args.token);
    const client = deps.makeClient(args.url, token);
    let worst = 0;
    const rows: Array<{ file: string; decision: string; riskScore: number }> = [];
    for (const file of configs) {
        const content = await deps.readFileText(file);
        const result = await client.scanText(content);
        rows.push({ file: path.relative(deps.cwd, file), decision: result.decision, riskScore: result.riskScore });
        worst = Math.max(worst, result.riskScore);
        if (!args.json) deps.out(`  ${result.decision.padEnd(18)} risk ${result.riskScore}  ${path.relative(deps.cwd, file)}`);
    }
    if (args.json) deps.out(JSON.stringify({ files: rows, worstRisk: worst }));
    return worst >= 70 ? 1 : 0;
}

async function cmdGitScan(deps: CliDeps, args: ParsedArgs): Promise<number> {
    const diff = await deps.gitDiff(deps.cwd);
    if (!diff.trim()) { emit(deps, args, "No uncommitted changes to scan.", { empty: true }); return 0; }
    const result = await scan(deps, args, diff);
    return reportScan(deps, args, result, "git diff");
}

// ---- hook commands --------------------------------------------------------

const HOOK_AGENTS: HookAgent[] = ["claude-code", "cursor", "codex"];

function isHookAgent(value?: string): value is HookAgent {
    return HOOK_AGENTS.includes(value as HookAgent);
}

/**
 * Dispatch for `soterai hook …`.
 *
 * Every path through here must end in a rendered verdict. The one failure mode
 * this command cannot have is "threw, printed nothing, exited non-zero" —
 * Claude Code reads that as a non-blocking error and runs the tool anyway.
 */
async function cmdHook(deps: CliDeps, args: ParsedArgs, sub?: string, rest: string[] = []): Promise<number> {
    if (sub === "install") return await cmdHookInstall(deps, args, rest[0]);
    if (sub === "status") return await cmdHookStatus(deps, args);
    if (sub === undefined || !isHookAgent(sub)) {
        deps.err(
            `Usage: soterai hook <${HOOK_AGENTS.join("|")}>\n` +
            "       soterai hook install <claude-code|cursor>\n" +
            "       soterai hook status\n\n" +
            "The first form is what an agent invokes: it reads the pending tool call as JSON\n" +
            "on stdin and answers on stdout with an exit code the agent understands.",
        );
        return 2;
    }
    return await cmdHookCheck(deps, args, sub);
}

/** The hot path: one pending tool call in, one decision out. */
async function cmdHookCheck(deps: CliDeps, args: ParsedArgs, requested: HookAgent): Promise<number> {
    const onError: OnError = args.flags["on-error"] === "allow" ? "allow" : "deny";
    const timeoutMs = Number.parseInt(args.flags["timeout-ms"] ?? "", 10) || DEFAULT_HOOK_OPTIONS.timeoutMs;

    // Built before the payload is parsed, so an unparseable payload can still be
    // rendered in the right dialect rather than answered with silence.
    let call = { agent: requested, event: "PreToolUse", toolName: "unknown", inline: [], filePaths: [], supplied: [] } as
        ReturnType<typeof normalizeCall>;

    try {
        const raw = parseHookInput(await deps.readStdin());
        call = normalizeCall(detectAgent(raw) ?? requested, raw);

        const token = await deps.resolveToken(args.token);
        const client = deps.makeClient(args.url, token);
        const hookDeps: HookDeps = {
            scan: (content) => client.scanText(content),
            readTarget: deps.readTargetFile,
            isFile: deps.isFile,
            cwd: deps.cwd,
            home: deps.home,
        };

        const verdict = await withTimeout(
            evaluateHook(call, hookDeps, { ...DEFAULT_HOOK_OPTIONS, onError, timeoutMs }),
            timeoutMs,
            // A timed-out Claude Code hook does NOT block — the call proceeds.
            // So the timeout is enforced here and answered actively, instead of
            // letting the agent's own timeout silently release the call.
            () => errorVerdict(`the check did not finish within ${timeoutMs}ms`, onError),
        );
        return emitVerdict(deps, call, verdict);
    } catch (error) {
        const message = error instanceof Error ? error.message : "unknown error";
        return emitVerdict(deps, call, errorVerdict(message, onError));
    }
}

function emitVerdict(deps: CliDeps, call: ReturnType<typeof normalizeCall>, verdict: ReturnType<typeof errorVerdict>): number {
    const rendered = renderVerdict(call, verdict);
    if (rendered.stdout) deps.out(rendered.stdout);
    if (rendered.stderr) deps.err(rendered.stderr);
    return rendered.exitCode;
}

/** Race a promise against a deadline, resolving to a fallback on timeout. */
async function withTimeout<T>(work: Promise<T>, ms: number, onTimeout: () => T): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    try {
        return await Promise.race([
            work,
            new Promise<T>((resolve) => { timer = setTimeout(() => resolve(onTimeout()), ms); }),
        ]);
    } finally {
        if (timer) clearTimeout(timer);
    }
}

async function cmdHookInstall(deps: CliDeps, args: ParsedArgs, agent?: string): Promise<number> {
    const scope: HookScope = args.flags.scope === "project" ? "project" : "user";
    if (agent === "claude-code") {
        const file = claudeSettingsPath(scope, deps.home, deps.cwd);
        const existing = await deps.readJsonFile(file);
        const { document, alreadyInstalled } = mergeClaudeCodeHooks(
            existing,
            hookCommand(deps.execPath, deps.cliEntry, "claude-code"),
        );
        await deps.writeJsonFile(file, document);
        emit(deps, args, hookInstallReport("Claude Code", file, alreadyInstalled, [
            "Blocks with exit code 2 plus a deny decision on stdout — either alone is sufficient.",
            'Matcher is "*" so no tool is left unguarded; narrow it in the file if the per-call cost matters.',
        ]), { agent, scope, file, alreadyInstalled });
        return 0;
    }
    if (agent === "cursor") {
        const file = cursorHooksPath(scope, deps.home, deps.cwd);
        const existing = await deps.readJsonFile(file);
        const { document, alreadyInstalled } = mergeCursorHooks(existing, cursorCommandString(deps.execPath, deps.cliEntry));
        await deps.writeJsonFile(file, document);
        emit(deps, args, hookInstallReport("Cursor", file, alreadyInstalled, [
            `Installed on ${CURSOR_EVENTS.join(", ")}.`,
            "failClosed is set: Cursor hooks otherwise fail OPEN on crash, timeout, or empty output.",
        ]), { agent, scope, file, alreadyInstalled, events: CURSOR_EVENTS });
        return 0;
    }
    deps.err(
        "Usage: soterai hook install <claude-code|cursor> [--scope user|project]\n\n" +
        "Codex has no installer in this build: its hook response schema is not verified here, and\n" +
        'writing config for an unverified schema would claim protection that may not apply. Use\n' +
        '"soterai hook codex" manually if you want to wire it yourself.',
    );
    return 2;
}

function hookInstallReport(agent: string, file: string, already: boolean, notes: string[]): string {
    return [
        `${already ? "Already installed" : "Installed"}: SoterAI hook for ${agent}`,
        `  config: ${file}`,
        ...notes.map((n) => `  ${n}`),
        `  Verify with "soterai hook status". Restart ${agent} to pick up the change.`,
    ].join("\n");
}

async function cmdHookStatus(deps: CliDeps, args: ParsedArgs): Promise<number> {
    const healthy = await deps.makeClient(args.url).isHealthy();
    const targets = [
        { agent: "claude-code", scope: "user" as HookScope, file: claudeSettingsPath("user", deps.home, deps.cwd) },
        { agent: "claude-code", scope: "project" as HookScope, file: claudeSettingsPath("project", deps.home, deps.cwd) },
        { agent: "cursor", scope: "user" as HookScope, file: cursorHooksPath("user", deps.home, deps.cwd) },
        { agent: "cursor", scope: "project" as HookScope, file: cursorHooksPath("project", deps.home, deps.cwd) },
    ];
    const rows: Array<{ agent: string; scope: string; file: string; installed: boolean }> = [];
    for (const t of targets) {
        const doc = await deps.readJsonFile(t.file);
        rows.push({ ...t, installed: doc !== undefined && JSON.stringify(doc).includes(HOOK_MARKER) });
    }

    if (args.json) {
        deps.out(JSON.stringify({ brokerHealthy: healthy, url: args.url, installs: rows, codexVerified: false }));
        return healthy && rows.some((r) => r.installed) ? 0 : 1;
    }

    deps.out(`Broker: ${healthy ? "UP" : "DOWN"} (${args.url})`);
    if (!healthy) deps.out('  The hook denies every call while the broker is down (--on-error=deny is the default).');
    for (const r of rows) {
        deps.out(`  ${r.installed ? "installed    " : "not installed"}  ${r.agent} (${r.scope})  ${r.file}`);
    }
    deps.out("");
    deps.out("Scope: this hook blocks CREDENTIAL egress into and out of the model's context.");
    deps.out("  It is not a destructive-command guard — request scanning does not score shell risk,");
    deps.out("  so `rm -rf /` passes it. Use the agent's own permission rules for that.");
    deps.out("  Codex: response schema unverified in this build; no installer is provided.");
    return healthy && rows.some((r) => r.installed) ? 0 : 1;
}

// ---- helpers --------------------------------------------------------------

async function scan(deps: CliDeps, args: ParsedArgs, content: string): Promise<ScanResponse> {
    const token = await deps.resolveToken(args.token);
    return deps.makeClient(args.url, token).scanText(content);
}

function reportScan(deps: CliDeps, args: ParsedArgs, result: ScanResponse, label: string): number {
    // Never print raw content: only the decision and already-redacted preview.
    if (args.json) {
        deps.out(JSON.stringify({
            source: label,
            decision: result.decision,
            riskScore: result.riskScore,
            categories: result.categories,
            safe: result.safe,
            canaryInRequest: result.canaryInRequest,
            contentHash: result.contentHash,
            evidencePreview: result.evidencePreview,
        }));
    } else {
        deps.out(`${label}: ${result.decision.toUpperCase()} (risk ${result.riskScore})`);
        if (result.categories.length) deps.out(`  categories: ${result.categories.join(", ")}`);
        if (result.canaryInRequest) deps.out("  canary token present in input");
        if (result.evidencePreview) deps.out(`  evidence (redacted): ${result.evidencePreview}`);
    }
    if (result.decision === "block") return 1;
    if (result.decision === "approval_required") return 3;
    return 0;
}

function emit(deps: CliDeps, args: ParsedArgs, human: string, json: unknown): void {
    deps.out(args.json ? JSON.stringify(json) : human);
}

function coerceLevel(level?: string): SafeModeLevel {
    return level === "strict" || level === "enterprise" ? level : "developer";
}

async function readStdin(): Promise<string> {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    return Buffer.concat(chunks).toString("utf8");
}

/** Find common MCP config locations under a workspace root. */
async function findMcpConfigs(cwd: string): Promise<string[]> {
    const { readdir, stat } = await import("node:fs/promises");
    const candidates = [
        ".mcp.json",
        "mcp.json",
        path.join(".cursor", "mcp.json"),
        path.join(".vscode", "mcp.json"),
        path.join(".config", "mcp.json"),
    ];
    const found: string[] = [];
    for (const candidate of candidates) {
        const full = path.join(cwd, candidate);
        try {
            const info = await stat(full);
            if (info.isFile()) found.push(full);
        } catch { /* not present */ }
    }
    // Also check the user-level Claude/Cursor config directory.
    try {
        const dir = path.join(homedir(), ".config");
        const entries = await readdir(dir);
        for (const entry of entries) {
            if (entry.toLowerCase().includes("mcp")) found.push(path.join(dir, entry));
        }
    } catch { /* ignore */ }
    return found;
}

/** Spawn the Local AI Broker process (inherits stdio). */
async function startBroker(): Promise<number> {
    return await new Promise<number>((resolve) => {
        let brokerEntry: string;
        try {
            brokerEntry = require.resolve("@soterai/local-ai-broker/dist/cli.js");
        } catch {
            process.stderr.write(
                'Local AI Broker is not installed. Build it with "npm run build" in apps/local-ai-broker.\n',
            );
            resolve(1);
            return;
        }
        const child = spawn(process.execPath, [brokerEntry], { stdio: "inherit" });
        child.on("exit", (code) => resolve(code ?? 0));
        child.on("error", () => resolve(1));
    });
}

// ---- hook filesystem helpers ----------------------------------------------

/** Extensions that carry no scannable text; reading them wastes the budget. */
const BINARY_EXTENSIONS = new Set([
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".bmp", ".tiff",
    ".pdf", ".zip", ".gz", ".tar", ".7z", ".rar", ".jar", ".war",
    ".exe", ".dll", ".so", ".dylib", ".bin", ".wasm", ".onnx", ".node",
    ".mp3", ".mp4", ".mov", ".avi", ".woff", ".woff2", ".ttf", ".otf",
]);

async function isFile(absPath: string): Promise<boolean> {
    try {
        const { stat } = await import("node:fs/promises");
        return (await stat(absPath)).isFile();
    } catch {
        return false;
    }
}

/**
 * Read a hook target under a byte budget.
 *
 * Files over the budget are SAMPLED head-and-tail rather than truncated to the
 * head alone: credentials cluster at the top of config files and at the bottom
 * of appended `.env` files and logs, and a head-only read would miss the second
 * case entirely. The sampling is reported in the finding, so a decision made on
 * a partial read is never presented as a decision on the whole file.
 *
 * Returns null when the path is not a readable regular file — an unreadable
 * path cannot leak, so it is not treated as a failure to check.
 */
async function readTargetFile(absPath: string): Promise<BoundedFile | null> {
    if (BINARY_EXTENSIONS.has(path.extname(absPath).toLowerCase())) return null;
    const { open, stat } = await import("node:fs/promises");
    let size: number;
    try {
        const info = await stat(absPath);
        if (!info.isFile()) return null;
        size = info.size;
    } catch {
        return null;
    }
    if (size === 0) return null;

    let handle: Awaited<ReturnType<typeof open>> | undefined;
    try {
        handle = await open(absPath, "r");
        if (size <= FILE_READ_BUDGET) {
            const buffer = Buffer.alloc(size);
            await handle.read(buffer, 0, size, 0);
            return { text: buffer.toString("utf8"), sampled: false };
        }
        const half = Math.floor(FILE_READ_BUDGET / 2);
        const head = Buffer.alloc(half);
        const tail = Buffer.alloc(half);
        await handle.read(head, 0, half, 0);
        await handle.read(tail, 0, half, size - half);
        return { text: `${head.toString("utf8")}\n${tail.toString("utf8")}`, sampled: true };
    } catch {
        return null;
    } finally {
        await handle?.close().catch(() => undefined);
    }
}

/** Read a JSON config. Returns undefined when absent; throws on malformed. */
async function readJsonFile(file: string): Promise<unknown> {
    let text: string;
    try {
        text = await readFile(file, "utf8");
    } catch {
        return undefined;
    }
    if (!text.trim()) return undefined;
    try {
        return JSON.parse(text);
    } catch {
        throw new Error(
            `${file} is not valid JSON, so it cannot be edited safely. Fix or move it, then re-run the install.`,
        );
    }
}

/**
 * Write a JSON config atomically.
 *
 * The Claude Code user-scope target is `~/.claude/settings.json`, which often
 * holds a live provider key. So: no `.bak` (a backup of a secrets file is a
 * second copy of the secret that outlives the edit), and the temp file is
 * created in the SAME directory so the rename is atomic rather than a
 * cross-device copy that would leave the plaintext behind.
 */
async function writeJsonFile(file: string, value: unknown): Promise<void> {
    const { mkdir, writeFile, rename, rm } = await import("node:fs/promises");
    await mkdir(path.dirname(file), { recursive: true });
    const temp = path.join(path.dirname(file), `.${path.basename(file)}.soterai-${process.pid}.tmp`);
    try {
        await writeFile(temp, JSON.stringify(value, null, 2) + "\n", { encoding: "utf8", mode: 0o600 });
        await rename(temp, file);
    } catch (error) {
        await rm(temp, { force: true }).catch(() => undefined);
        throw error;
    }
}
