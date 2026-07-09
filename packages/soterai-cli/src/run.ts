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
  soterai version                 Show CLI and broker protocol version

Global flags:
  --url <url>     Broker base URL (default ${DEFAULT_BROKER_URL}, loopback only)
  --token <t>     Broker token (else SOTERAI_BROKER_TOKEN or the token file)
  --json          Emit machine-readable JSON

Local-first: file contents are sent only to the loopback broker. Raw secrets are
never printed — scans show a redacted decision, not the matched value.`;

interface ParsedArgs {
    positionals: string[];
    url: string; // can be overridden via --url flag
    token?: string;
    json: boolean;
}

export function parseArgs(argv: string[]): ParsedArgs {
    const positionals: string[] = [];
    let url: string = DEFAULT_BROKER_URL;
    let token: string | undefined;
    let json = false;
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === "--url") url = argv[++i] ?? url;
        else if (arg === "--token") token = argv[++i];
        else if (arg === "--json") json = true;
        else positionals.push(arg);
    }
    return { positionals, url, token, json };
}

/** Run the CLI. Returns a process exit code (0 = success). */
export async function run(argv: string[], deps: CliDeps): Promise<number> {
    const args = parseArgs(argv);
    const [command, sub, ...rest] = args.positionals;

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
