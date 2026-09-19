import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createInterface } from "node:readline";
import path from "node:path";
import { homedir, constants as osConstants } from "node:os";
import {
    buildChildEnv,
    decryptSecrets,
    encryptSecrets,
    isValidSecretName,
    parseEnvFile,
    passphrasesMatch,
    rewriteEnvWithoutValues,
    type Secrets,
    type VaultFile,
} from "./vault";
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
    type OutputIncident,
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
    /** Where post-execution output-leak incidents are appended (JSON lines). */
    incidentLogPath: string;
    /** Append one output-leak incident (class only, never the value). */
    recordIncident: (file: string, record: OutputIncident) => Promise<void>;
    /** Read a JSON config, returning undefined when it does not exist. */
    readJsonFile: (file: string) => Promise<unknown>;
    /** Write a JSON config atomically (temp file in the same dir, then rename). */
    writeJsonFile: (file: string, value: unknown) => Promise<void>;
    home: string;
    execPath: string;
    /** Absolute path to this CLI's entry script, used in generated hook config. */
    cliEntry: string;
    // ---- vault support ----------------------------------------------------
    /** Where this CLI's own encrypted vault lives (own store; see vault.ts). */
    vaultPath: string;
    /** Read + parse the vault file. null = no vault yet. Throws on corrupt. */
    readVault: (file: string) => Promise<VaultFile | null>;
    /** Write the vault atomically, mode 0o600 (ciphertext only — no key). */
    writeVault: (file: string, vault: VaultFile) => Promise<void>;
    /** Overwrite a text file atomically, preserving its mode (for `vault import --replace`). */
    writeFileText: (file: string, text: string) => Promise<void>;
    /**
     * Read the vault passphrase. `confirm` asks twice (for a new vault) and must
     * match. Never comes from argv — env var SOTERAI_VAULT_PASSPHRASE, else a
     * hidden TTY prompt. Throws when neither is available (e.g. piped, no env).
     */
    readPassphrase: (prompt: string, confirm?: boolean) => Promise<string>;
    /** The parent environment `run` overlays secrets onto. */
    env: NodeJS.ProcessEnv;
    /**
     * Spawn a child with the given env, inheriting stdio, and resolve to the
     * exit code the parent should adopt (128+signal when it was killed).
     */
    spawnProcess: (command: string, argv: string[], env: NodeJS.ProcessEnv, cwd: string) => Promise<number>;
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
        incidentLogPath: process.env.SOTERAI_INCIDENT_LOG || path.join(homedir(), ".soterai", "incidents.log"),
        recordIncident: appendIncident,
        readJsonFile: readJsonFile,
        writeJsonFile: writeJsonFile,
        home: homedir(),
        execPath: process.execPath,
        cliEntry: process.argv[1] ?? path.join(__dirname, "cli.js"),
        vaultPath: process.env.SOTERAI_VAULT_PATH || path.join(homedir(), ".soterai", "vault.enc"),
        readVault: readVault,
        writeVault: writeVault,
        writeFileText: writeFileText,
        readPassphrase: readPassphrase,
        env: process.env,
        spawnProcess: spawnProcess,
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
  soterai vault init              Create the CLI secret vault (passphrase-locked)
  soterai vault add <NAME>        Add a secret (value read from stdin, never argv)
  soterai vault import <.env>     Import a .env's secrets into the vault
  soterai vault list              List secret names in the vault (never values)
  soterai vault rm <NAME>         Remove a secret from the vault
  soterai run -- <cmd> [args]     Run a command with vault secrets in its env
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
never printed — scans show a redacted decision, not the matched value.

Vault: secrets are encrypted with a key DERIVED FROM YOUR PASSPHRASE (scrypt) and
never written to disk — the vault file holds only ciphertext. Set the passphrase
in SOTERAI_VAULT_PASSPHRASE for non-interactive use, else you are prompted.
"soterai run" injects the secrets into a child process's environment just in time,
so they need not sit in a .env the agent can read. This shrinks the file surface
an agent reads; it is not a process sandbox (a same-user process can still read
/proc/<pid>/environ).`;

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
    // `run` is parsed BEFORE the generic flag parser: everything after it is the
    // child command line, and the child's own flags (`--port 3000`) must not be
    // read as soterai flags. A leading `--` separator is optional and stripped.
    if (argv[0] === "run") {
        const rest = argv[1] === "--" ? argv.slice(2) : argv.slice(1);
        return await cmdRun(deps, rest);
    }

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
        if (command === "vault") return await cmdVault(deps, args, sub, rest);

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

// ---- vault commands -------------------------------------------------------

/**
 * Dispatch for `soterai vault …`.
 *
 * Note what is NOT here: no `vault get`, no `vault export`. There is no command
 * that prints a stored secret's value. The only way a value leaves the vault is
 * into a child process's environment via `soterai run`, so a secret cannot be
 * exfiltrated by asking an agent to run `soterai vault get X`.
 */
async function cmdVault(deps: CliDeps, args: ParsedArgs, sub?: string, rest: string[] = []): Promise<number> {
    if (sub === "init") return await cmdVaultInit(deps, args);
    if (sub === "add") return await cmdVaultAdd(deps, args, rest[0]);
    if (sub === "import") return await cmdVaultImport(deps, args, rest[0]);
    if (sub === "list") return await cmdVaultList(deps, args);
    if (sub === "rm" || sub === "remove") return await cmdVaultRemove(deps, args, rest[0]);
    deps.err("Usage: soterai vault <init|add <NAME>|import <.env>|list|rm <NAME>>");
    return 2;
}

async function cmdVaultInit(deps: CliDeps, args: ParsedArgs): Promise<number> {
    const existing = await deps.readVault(deps.vaultPath);
    if (existing) {
        deps.err(`A vault already exists at ${deps.vaultPath}. Refusing to overwrite it (that would destroy every stored secret).`);
        return 2;
    }
    const passphrase = await deps.readPassphrase("Choose a vault passphrase: ", true);
    const vault = encryptSecrets({}, passphrase);
    await deps.writeVault(deps.vaultPath, vault);
    emit(deps, args, `Created an empty vault at ${deps.vaultPath}. Add a secret with "soterai vault add <NAME>".`, {
        created: true,
        path: deps.vaultPath,
    });
    return 0;
}

async function cmdVaultAdd(deps: CliDeps, args: ParsedArgs, name?: string): Promise<number> {
    if (!name) { deps.err("Usage: soterai vault add <NAME>   (the value is read from stdin)"); return 2; }
    if (!isValidSecretName(name)) {
        deps.err(`"${name}" is not a valid environment variable name (letters, digits, underscore; not starting with a digit).`);
        return 2;
    }
    const vault = await deps.readVault(deps.vaultPath);
    if (!vault) { deps.err(`No vault at ${deps.vaultPath}. Create one with "soterai vault init".`); return 2; }

    // The value comes from stdin, never argv — an argv value is visible to every
    // process on the machine via the process list (ps / Get-Process).
    const value = stripOneTrailingNewline(await deps.readStdin());
    if (!value) { deps.err("No secret value on stdin. Pipe it: printf %s \"$SECRET\" | soterai vault add NAME"); return 2; }

    const passphrase = await deps.readPassphrase("Vault passphrase: ");
    const secrets = decryptSecrets(vault, passphrase);
    const existed = Object.prototype.hasOwnProperty.call(secrets, name);
    secrets[name] = value;
    await deps.writeVault(deps.vaultPath, encryptSecrets(secrets, passphrase));
    // Never echo the value. Confirm by NAME only.
    emit(deps, args, `${existed ? "Updated" : "Added"} ${name} in the vault (${Object.keys(secrets).length} secret${Object.keys(secrets).length === 1 ? "" : "s"} total).`, {
        name,
        updated: existed,
        count: Object.keys(secrets).length,
    });
    return 0;
}

async function cmdVaultImport(deps: CliDeps, args: ParsedArgs, file?: string): Promise<number> {
    if (!file) { deps.err("Usage: soterai vault import <.env> [--replace]"); return 2; }
    const vault = await deps.readVault(deps.vaultPath);
    if (!vault) { deps.err(`No vault at ${deps.vaultPath}. Create one with "soterai vault init".`); return 2; }

    let text: string;
    try {
        text = await deps.readFileText(file);
    } catch {
        deps.err(`Could not read ${file}.`);
        return 2;
    }
    const { entries, skipped } = parseEnvFile(text);
    if (entries.length === 0) {
        deps.err(`No importable KEY=value assignments found in ${file}.`);
        return 2;
    }

    const passphrase = await deps.readPassphrase("Vault passphrase: ");
    const secrets = decryptSecrets(vault, passphrase);
    // Last-wins within the file is already handled by the parser order; a name
    // already in the vault is OVERWRITTEN by the file's value (the file is the
    // source of truth the user is importing from).
    for (const { name, value } of entries) secrets[name] = value;
    await deps.writeVault(deps.vaultPath, encryptSecrets(secrets, passphrase));

    const names = entries.map((e) => e.name);
    // The `--replace` flag strips the raw values from the file on disk. It is
    // OPT-IN because it edits the user's file: destructive, and it breaks any
    // tool that reads the .env directly WITHOUT going through `soterai run`.
    let replaced = false;
    if (args.flags.replace === "true") {
        try {
            await deps.writeFileText(file, rewriteEnvWithoutValues(text, entries));
            replaced = true;
        } catch (error) {
            deps.err(`Imported to the vault, but could NOT rewrite ${file}: ${error instanceof Error ? error.message : "unknown error"}. The raw values are still on disk.`);
            return 1;
        }
    }

    // Names are safe to print; values never are.
    if (args.json) {
        deps.out(JSON.stringify({ imported: names, skipped, replaced, count: Object.keys(secrets).length }));
    } else {
        deps.out(`Imported ${names.length} secret${names.length === 1 ? "" : "s"} from ${file}: ${names.join(", ")}`);
        if (skipped.length) deps.out(`  skipped (invalid env var names): ${skipped.join(", ")}`);
        if (replaced) deps.out(`  ${file} rewritten — raw values removed from disk. Run your app with "soterai run -- <cmd>".`);
        else deps.out(`  NOTE: raw values are STILL in ${file}. Re-run with --replace to strip them, or remove them yourself.`);
    }
    return 0;
}

async function cmdVaultList(deps: CliDeps, args: ParsedArgs): Promise<number> {
    const vault = await deps.readVault(deps.vaultPath);
    if (!vault) { deps.err(`No vault at ${deps.vaultPath}. Create one with "soterai vault init".`); return 2; }
    const passphrase = await deps.readPassphrase("Vault passphrase: ");
    const secrets = decryptSecrets(vault, passphrase);
    const names = Object.keys(secrets).sort();
    if (args.json) { deps.out(JSON.stringify({ names })); return 0; }
    if (names.length === 0) deps.out("The vault is empty.");
    else { deps.out(`${names.length} secret${names.length === 1 ? "" : "s"}:`); for (const n of names) deps.out(`  ${n}`); }
    return 0;
}

async function cmdVaultRemove(deps: CliDeps, args: ParsedArgs, name?: string): Promise<number> {
    if (!name) { deps.err("Usage: soterai vault rm <NAME>"); return 2; }
    const vault = await deps.readVault(deps.vaultPath);
    if (!vault) { deps.err(`No vault at ${deps.vaultPath}. Create one with "soterai vault init".`); return 2; }
    const passphrase = await deps.readPassphrase("Vault passphrase: ");
    const secrets = decryptSecrets(vault, passphrase);
    if (!Object.prototype.hasOwnProperty.call(secrets, name)) {
        deps.err(`No secret named ${name} in the vault.`);
        return 1;
    }
    delete secrets[name];
    await deps.writeVault(deps.vaultPath, encryptSecrets(secrets, passphrase));
    emit(deps, args, `Removed ${name} (${Object.keys(secrets).length} secret${Object.keys(secrets).length === 1 ? "" : "s"} left).`, {
        name,
        count: Object.keys(secrets).length,
    });
    return 0;
}

// ---- run: JIT secret injection --------------------------------------------

/**
 * `soterai run -- <cmd> [args…]` — decrypt the vault in memory, overlay its
 * secrets onto the child's environment, run the child, and adopt its exit code.
 *
 * The secret value never touches disk and never appears in this process's own
 * argv (only the child command does). It lands only in the child's environment.
 * That keeps it out of the files an agent reads, which is the point — but it is
 * a file-surface reduction, not a sandbox: a same-user process can still read
 * the child's /proc/<pid>/environ. cmdRun states that in help; it does not
 * pretend the boundary is stronger than it is.
 */
async function cmdRun(deps: CliDeps, childArgv: string[]): Promise<number> {
    const [command, ...childArgs] = childArgv;
    if (!command) {
        deps.err('Usage: soterai run -- <cmd> [args…]\n\nRuns <cmd> with the vault\'s secrets added to its environment.');
        return 2;
    }
    try {
        const vault = await deps.readVault(deps.vaultPath);
        if (!vault) { deps.err(`No vault at ${deps.vaultPath}. Create one with "soterai vault init".`); return 2; }
        const passphrase = await deps.readPassphrase("Vault passphrase: ");
        const secrets = decryptSecrets(vault, passphrase);
        const childEnv = buildChildEnv(deps.env, secrets);
        return await deps.spawnProcess(command, childArgs, childEnv, deps.cwd);
    } catch (error) {
        // Fail CLOSED: if the vault cannot be opened we do NOT run the child
        // without its secrets (that would silently start it half-configured and
        // possibly leak a fallback path). Report and stop.
        deps.err(error instanceof Error ? error.message : "Could not open the vault.");
        return 1;
    }
}

/**
 * Strip exactly ONE trailing newline (the one a shell's `echo` or a here-string
 * appends), not all trailing whitespace — a secret may legitimately end in a
 * space, and trimming it would silently store the wrong value.
 */
function stripOneTrailingNewline(text: string): string {
    if (text.endsWith("\r\n")) return text.slice(0, -2);
    if (text.endsWith("\n")) return text.slice(0, -1);
    return text;
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
    let call = { agent: requested, event: "PreToolUse", phase: "pre", toolName: "unknown", inline: [], filePaths: [], supplied: [], outputs: [] } as
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
            recordIncident: (record) => deps.recordIncident(deps.incidentLogPath, record),
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
            "PreToolUse blocks with exit code 2 plus a deny decision on stdout — either alone is sufficient.",
            "PostToolUse DETECTS secrets in tool output (already in context, so it warns + logs, never blocks).",
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
    deps.out("Scope: this hook blocks CREDENTIAL egress into the model's context (PreToolUse), and");
    deps.out("  DETECTS credentials that arrive only in tool OUTPUT (PostToolUse). Detection cannot");
    deps.out("  block — the tool has already run — so it warns and logs an incident for rotation:");
    deps.out(`  ${deps.incidentLogPath}`);
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

export async function isFile(absPath: string): Promise<boolean> {
    try {
        const { stat } = await import("node:fs/promises");
        return (await stat(absPath)).isFile();
    } catch {
        return false;
    }
}

/**
 * Append one output-leak incident as a single JSON line.
 *
 * The record is written class-only by `evaluateOutput` — this function never
 * sees the secret value, and must never be changed to log the scanned text,
 * because this file persists on disk and a log that quotes the secret is a
 * second copy of it. The directory is created 0o700 and the file 0o600: an
 * incident log names which credentials leaked and is itself sensitive.
 */
export async function appendIncident(file: string, record: OutputIncident): Promise<void> {
    const { mkdir, appendFile } = await import("node:fs/promises");
    await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
    await appendFile(file, JSON.stringify(record) + "\n", { encoding: "utf8", mode: 0o600 });
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
export async function readTargetFile(absPath: string): Promise<BoundedFile | null> {
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

// ---- vault filesystem + passphrase + spawn helpers ------------------------

/** Read + validate the vault file. null when absent; throws when corrupt. */
async function readVault(file: string): Promise<VaultFile | null> {
    let text: string;
    try {
        text = await readFile(file, "utf8");
    } catch {
        return null;
    }
    let parsed: unknown;
    try {
        parsed = JSON.parse(text);
    } catch {
        throw new Error(`The vault at ${file} is not valid JSON — it may be corrupt.`);
    }
    const v = parsed as Partial<VaultFile>;
    if (!v || v.version !== 1 || !v.kdf || typeof v.payload !== "string") {
        throw new Error(`The vault at ${file} is not a recognized SoterAI vault.`);
    }
    return v as VaultFile;
}

/**
 * Write the vault atomically at mode 0o600. Same discipline as writeJsonFile:
 * temp file in the same directory then rename, so a crash mid-write cannot
 * leave a half-written vault that no passphrase can open. The vault holds only
 * ciphertext, but 0o600 keeps even that from other users by default.
 */
async function writeVault(file: string, vault: VaultFile): Promise<void> {
    const { mkdir, writeFile, rename, rm } = await import("node:fs/promises");
    await mkdir(path.dirname(file), { recursive: true });
    const temp = path.join(path.dirname(file), `.${path.basename(file)}.soterai-${process.pid}.tmp`);
    try {
        await writeFile(temp, JSON.stringify(vault) + "\n", { encoding: "utf8", mode: 0o600 });
        await rename(temp, file);
    } catch (error) {
        await rm(temp, { force: true }).catch(() => undefined);
        throw error;
    }
}

/**
 * Overwrite a text file atomically, preserving its existing mode (a `.env` is
 * typically 0o600 and must stay that way). Same temp-then-rename discipline as
 * the vault write, so `vault import --replace` cannot leave a half-written file.
 */
async function writeFileText(file: string, text: string): Promise<void> {
    const { writeFile, rename, rm, stat, chmod } = await import("node:fs/promises");
    let mode = 0o600;
    try {
        mode = (await stat(file)).mode & 0o777;
    } catch { /* keep the 0o600 default if the file vanished */ }
    const temp = path.join(path.dirname(file), `.${path.basename(file)}.soterai-${process.pid}.tmp`);
    try {
        await writeFile(temp, text, { encoding: "utf8", mode });
        await chmod(temp, mode).catch(() => undefined);
        await rename(temp, file);
    } catch (error) {
        await rm(temp, { force: true }).catch(() => undefined);
        throw error;
    }
}

/**
 * Read the passphrase, preferring the env var so CI and scripting work, else a
 * hidden TTY prompt. NEVER argv. When neither a TTY nor the env var is present
 * (e.g. the command is piped) it throws rather than reading a visible line —
 * silently accepting an echoed passphrase would train an unsafe habit.
 */
async function readPassphrase(prompt: string, confirm = false): Promise<string> {
    const fromEnv = process.env.SOTERAI_VAULT_PASSPHRASE;
    if (fromEnv) return fromEnv;
    if (!process.stdin.isTTY) {
        throw new Error(
            "No passphrase available: set SOTERAI_VAULT_PASSPHRASE, or run in a terminal so it can be prompted (stdin here is not a TTY).",
        );
    }
    const first = await promptHidden(prompt);
    if (!confirm) return first;
    const second = await promptHidden("Confirm passphrase: ");
    if (!passphrasesMatch(first, second)) throw new Error("The passphrases did not match.");
    return first;
}

/** Prompt on the TTY without echoing the typed characters. */
function promptHidden(prompt: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
        const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
        const stdout = process.stdout as NodeJS.WriteStream & { isTTY?: boolean };
        // Suppress echo: while the answer is being typed, the readline "output"
        // write is swallowed so keystrokes do not appear on screen.
        let muted = false;
        const realWrite = stdout.write.bind(stdout) as typeof stdout.write;
        (stdout as unknown as { write: typeof stdout.write }).write = ((chunk: string | Uint8Array, ...rest: unknown[]) => {
            if (muted && typeof chunk === "string" && !chunk.includes(prompt)) return true;
            return (realWrite as (...a: unknown[]) => boolean)(chunk, ...rest);
        }) as typeof stdout.write;
        rl.question(prompt, (answer) => {
            (stdout as unknown as { write: typeof stdout.write }).write = realWrite;
            rl.close();
            realWrite("\n");
            resolve(answer);
        });
        muted = true;
        rl.on("error", (e) => { (stdout as unknown as { write: typeof stdout.write }).write = realWrite; reject(e); });
    });
}

/**
 * Spawn the child, inherit stdio, and resolve to the exit code the parent
 * should adopt. A child killed by a signal maps to 128+signal (the shell
 * convention), so `soterai run` propagates the child's fate rather than
 * masking a crash as success.
 *
 * `shell: true` on Windows so `.cmd`/`.bat` shims (npm, npx) resolve — the
 * command comes from the user's own argv, not untrusted input, so this adds no
 * injection surface the user did not already have at their own prompt.
 */
async function spawnProcess(command: string, argv: string[], env: NodeJS.ProcessEnv, cwd: string): Promise<number> {
    return await new Promise<number>((resolve) => {
        const child = spawn(command, argv, { stdio: "inherit", env, cwd, shell: process.platform === "win32" });
        child.on("exit", (code, signal) => {
            if (signal) {
                const signals = osConstants.signals as Record<string, number>;
                resolve(128 + (signals[signal] ?? 0));
            } else {
                resolve(code ?? 0);
            }
        });
        child.on("error", (error) => {
            process.stderr.write(`soterai run: could not start "${command}": ${error.message}\n`);
            resolve(127); // shell "command not found"
        });
    });
}
