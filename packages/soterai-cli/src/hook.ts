import path from "node:path";
import { homedir } from "node:os";
import { HIGH_RISK_SECRET_CLASSES, highRiskSecretClasses, type ScanResponse } from "@soterai/ide-protocol";

/**
 * `soterai hook` — the deny-capable enforcement point.
 *
 * Everything else SoterAI ships is advisory: it can observe a request and
 * report on it, but the coding agent is free to proceed. Agent hook interfaces
 * are the one place a third party can actually REFUSE a tool call, so this is
 * the only component that can honestly be described as enforcement.
 *
 * It runs as a short-lived process per tool call: the agent writes the pending
 * call to stdin as JSON, this reads it, decides, and answers on stdout plus an
 * exit code. Three checks run:
 *
 *   1. CONTENT — the text the tool is about to send or write.
 *   2. FILE TARGET — the file the tool is about to pull INTO the model's
 *      context. This is the check that matters most, and the one an
 *      output-scanner cannot do: by the time a secret appears in a prompt it
 *      has already left the machine. Here we resolve the path the agent named,
 *      read it locally, and scan it BEFORE the agent ever sees a byte.
 *   3. SECRET-BY-REFERENCE — a shell command whose TEXT names no secret but
 *      whose OUTPUT would carry one (`echo $OPENAI_API_KEY`, `printenv`, `env`).
 *      A content scan is blind to it because the value is not in the string, so
 *      this is a tight heuristic on the command — see `detectEnvSecretReference`.
 *      It narrows, but does not close, the input-side blind spot: a secret in a
 *      genuine API/DB response still needs a post-execution output scan.
 *
 * Scope, stated honestly: this blocks CREDENTIAL EGRESS. It is not a
 * destructive-command guard — the terminal-risk detector runs on model
 * responses, not on requests, so `rm -rf /` scores zero here. Use the agent's
 * own permission rules for that.
 */

export type HookAgent = "claude-code" | "cursor" | "codex";
export type HookAction = "allow" | "ask" | "deny";
export type OnError = "deny" | "allow";

/** What the hook is about to let happen, normalized across agents. */
export interface NormalizedHookCall {
    agent: HookAgent;
    /** The host's own event name, echoed back verbatim in the response. */
    event: string;
    toolName: string;
    /** Text arguments of the call — scanned directly. */
    inline: Array<{ label: string; text: string }>;
    /** Paths the call would pull into context — read locally, then scanned. */
    filePaths: string[];
    /** File content the host already handed us (Cursor `beforeReadFile`). */
    supplied: Array<{ label: string; text: string }>;
}

export interface HookFinding {
    origin: "input" | "file" | "command";
    label: string;
    classes: string[];
    decision: string;
    riskScore: number;
    /** True when the file was larger than the read budget and was sampled. */
    sampled?: boolean;
    /**
     * Why a `command` finding fired. Kept separate from `label` so the reason can
     * be shown without the class name reading as part of a sentence.
     */
    detail?: string;
}

export interface HookVerdict {
    action: HookAction;
    reason: string;
    findings: HookFinding[];
    /** Set when the verdict came from a failure rather than a clean scan. */
    errored?: boolean;
}

export interface HookRendered {
    stdout?: string;
    stderr?: string;
    exitCode: number;
}

export interface BoundedFile {
    text: string;
    sampled: boolean;
}

/** Side effects the evaluator needs, injected so the policy stays testable. */
export interface HookDeps {
    scan: (content: string) => Promise<ScanResponse>;
    /** Read a candidate file under a byte budget. null = not a readable file. */
    readTarget: (absPath: string) => Promise<BoundedFile | null>;
    /** Resolve whether a shell token names a real file (for path extraction). */
    isFile: (absPath: string) => Promise<boolean>;
    cwd: string;
    home: string;
}

export interface HookOptions {
    onError: OnError;
    timeoutMs: number;
    /** Cap on how many file targets one call may pull in. */
    maxFiles: number;
}

export const DEFAULT_HOOK_OPTIONS: HookOptions = { onError: "deny", timeoutMs: 5_000, maxFiles: 8 };

/** Read budget per file. Beyond this the head and tail are sampled. */
export const FILE_READ_BUDGET = 512 * 1024;

// ─── 1. Normalizing the host's payload ───────────────────────────────────────

/**
 * Identify which agent sent a payload. Explicit selection always wins; this is
 * only the fallback so a mis-wired install still gets a correctly shaped answer
 * instead of a silently ignored one.
 */
export function detectAgent(raw: Record<string, unknown>): HookAgent | undefined {
    if (typeof raw.cursor_version === "string" || typeof raw.mcp_server_name === "string") return "cursor";
    if (typeof raw.hook_event_name === "string" && typeof raw.tool_name === "string") return "claude-code";
    if (typeof raw.command === "string" && typeof raw.cwd === "string") return "cursor";
    return undefined;
}

function str(value: unknown): string | undefined {
    return typeof value === "string" && value.length > 0 ? value : undefined;
}

/**
 * Pull the text and file targets out of a pending call.
 *
 * Unknown tools fall through to scanning the whole serialized input. That is
 * deliberate: a tool this build has never heard of is exactly the case where a
 * hand-written field list would silently pass a secret through.
 */
export function normalizeCall(agent: HookAgent, raw: Record<string, unknown>): NormalizedHookCall {
    const inline: Array<{ label: string; text: string }> = [];
    const supplied: Array<{ label: string; text: string }> = [];
    const filePaths: string[] = [];

    if (agent === "cursor") {
        const event = str(raw.hook_event_name) ?? "beforeShellExecution";
        // beforeReadFile hands us the content directly — no need to re-read it,
        // and it is precisely the bytes that would enter the context.
        const filePath = str(raw.file_path);
        if (filePath) filePaths.push(filePath);
        const content = str(raw.content);
        if (content) supplied.push({ label: filePath ?? "file content", text: content });
        for (const att of Array.isArray(raw.attachments) ? raw.attachments : []) {
            const p = att && typeof att === "object" ? str((att as Record<string, unknown>).file_path) : undefined;
            if (p) filePaths.push(p);
        }
        const command = str(raw.command);
        if (command) inline.push({ label: "shell command", text: command });
        const toolInput = raw.tool_input;
        if (toolInput !== undefined) {
            inline.push({
                label: `MCP tool ${str(raw.tool_name) ?? "call"}`,
                text: typeof toolInput === "string" ? toolInput : JSON.stringify(toolInput),
            });
        }
        return {
            agent,
            event,
            toolName: str(raw.tool_name) ?? (command ? "shell" : "read_file"),
            inline,
            filePaths,
            supplied,
        };
    }

    // claude-code and codex share the PreToolUse shape.
    const event = str(raw.hook_event_name) ?? "PreToolUse";
    const toolName = str(raw.tool_name) ?? "unknown";
    const input = (raw.tool_input ?? {}) as Record<string, unknown>;

    const filePath = str(input.file_path) ?? str(input.path) ?? str(input.notebook_path);
    if (filePath) filePaths.push(filePath);

    // Content the agent would WRITE. The secret is already in its context by
    // now, so blocking does not protect the context — it keeps the secret from
    // being committed to disk in plaintext, which is the other half of the goal.
    for (const key of ["content", "new_string", "new_source", "prompt", "query", "command", "url", "description"]) {
        const text = str(input[key]);
        if (text) inline.push({ label: `${toolName}.${key}`, text });
    }
    if (inline.length === 0 && Object.keys(input).length > 0) {
        inline.push({ label: `${toolName} input`, text: JSON.stringify(input) });
    }

    return { agent, event, toolName, inline, filePaths, supplied };
}

// ─── 2. Shell path extraction ────────────────────────────────────────────────

const SHELL_SEPARATORS = /[|;&\n]+/g;

/**
 * Best-effort extraction of file operands from a shell command.
 *
 * A command like `cat ~/.claude/settings.json` carries its payload in a file it
 * names, not in its own text, so scanning the command string alone would pass
 * it. Rather than parse shell (which cannot be done correctly here), every
 * token is tested against the filesystem and only real files are kept. A false
 * candidate costs one clean scan; a missed one costs the secret.
 */
export async function extractShellPaths(command: string, deps: HookDeps, max: number): Promise<string[]> {
    const tokens = command
        .replace(SHELL_SEPARATORS, " ")
        .split(/\s+/)
        .map((t) => t.replace(/^[@<>(]+/, "").replace(/^["']|["']$/g, "").replace(/[),;]+$/, ""))
        .filter((t) => t.length > 1 && !t.startsWith("-") && !/^[A-Za-z_][A-Za-z0-9_]*=/.test(t));

    const seen = new Set<string>();
    const found: string[] = [];
    for (const token of tokens) {
        if (found.length >= max) break;
        const abs = resolveUserPath(token, deps);
        if (!abs || seen.has(abs)) continue;
        seen.add(abs);
        if (await deps.isFile(abs)) found.push(abs);
    }
    return found;
}

// ─── 2b. Secret-by-reference in a shell command ──────────────────────────────

/**
 * The credential-egress path a content scan cannot see: a shell command that
 * prints an environment secret to stdout. The command TEXT carries only the
 * variable NAME (`echo $OPENAI_API_KEY`), so the scanner finds nothing to
 * redact; the VALUE materializes when the shell runs and lands in the model's
 * NEXT turn. This is the same secret the P1 vault moves out of files and into
 * the child env — flowing right back to the model by reference.
 *
 * This is a heuristic on the command string, not a scan: it is the one lever an
 * input-side hook has on an output-side leak. It is scoped tight on purpose,
 * because over-defense gets a guard turned off and a disabled guard leaks
 * everything. It flags commands whose JOB is to surface env/credential values —
 * `echo`/`printf` of a credential-named variable, a whole-environment dump via
 * `env`/`printenv`, a read of `/proc/<pid>/environ` — including inside a `$(…)`
 * substitution. It deliberately does NOT flag handing a secret to a remote tool
 * (`curl -H "Authorization: $TOKEN"`): that is egress to a server, a different
 * threat, and blocking every such call here would be a high false-positive.
 */
export const ENV_SECRET_REFERENCE_CLASS = "env_secret_reference";

/**
 * A credential-named variable: any underscore-delimited segment is itself a
 * credential word. Matched segment-exact, not as a substring, so `KEYBOARD`,
 * `AUTHOR`, `PATH`, `TOKENIZER`, `HOME`, `PWD` do NOT match, while
 * `OPENAI_API_KEY`, `AWS_SECRET_ACCESS_KEY`, `DB_PASSWORD`, `GH_TOKEN` do.
 */
const CREDENTIAL_NAME_SEGMENTS = new Set([
    "KEY", "KEYS", "TOKEN", "TOKENS", "SECRET", "SECRETS", "PASSWORD", "PASSWD",
    "CREDENTIAL", "CREDENTIALS", "APIKEY", "AUTH", "PRIVATEKEY", "ACCESSKEY",
]);

function isCredentialVarName(name: string): boolean {
    return name.toUpperCase().split(/_+/).filter(Boolean).some((s) => CREDENTIAL_NAME_SEGMENTS.has(s));
}

const VAR_REF = /\$\{?([A-Za-z_][A-Za-z0-9_]*)\}?/g;

function referencedCredentialVars(text: string): string[] {
    const out: string[] = [];
    for (const m of text.matchAll(VAR_REF)) if (isCredentialVarName(m[1])) out.push(m[1]);
    return out;
}

// Split on pipeline/sequence operators AND command-substitution delimiters, so
// the body of `$(printenv API_SECRET)` is analyzed as its own segment.
const COMMAND_SEGMENTS = /\|\||&&|[|;&\n]|\$\(|`|\)/g;

/**
 * Reasons a shell command would surface an environment secret to stdout.
 * Empty ⇒ nothing to flag. Pure and synchronous, so it is trivially testable.
 */
export function detectEnvSecretReference(command: string): string[] {
    const reasons: string[] = [];
    const seen = new Set<string>();
    const add = (r: string) => { if (!seen.has(r)) { seen.add(r); reasons.push(r); } };

    // Reading the environ pseudo-file dumps every variable at once.
    if (/\/proc\/(?:self|\d+)\/environ\b/.test(command)) {
        add("reads /proc/<pid>/environ, which exposes the whole environment");
    }

    for (const rawSeg of command.split(COMMAND_SEGMENTS)) {
        const seg = rawSeg.trim();
        if (!seg) continue;
        const words = seg.split(/\s+/);
        const cmd = words[0].replace(/^["']|["']$/g, "").replace(/.*\//, "");
        const operands = words.slice(1).filter((w) => w && !w.startsWith("-"));

        if (cmd === "echo" || cmd === "printf") {
            for (const v of referencedCredentialVars(seg)) add(`prints credential variable $${v} to output (${cmd})`);
        } else if (cmd === "printenv") {
            if (operands.length === 0) add("printenv with no argument dumps the whole environment");
            else for (const a of operands) if (isCredentialVarName(a)) add(`printenv prints credential variable ${a}`);
        } else if (cmd === "env") {
            // `env VAR=val prog` SETS variables for a program; a bare `env`
            // (optionally piped) DUMPS every variable. Any non-flag operand means
            // it is running a program, not dumping.
            if (operands.length === 0) add("bare env dumps the whole environment");
        }
    }
    return reasons;
}

/** Expand `~` and resolve against the call's working directory. */
export function resolveUserPath(candidate: string, deps: HookDeps): string | undefined {
    try {
        let value = candidate;
        if (value === "~") return deps.home;
        if (value.startsWith("~/") || value.startsWith("~\\")) {
            value = path.join(deps.home, value.slice(2));
        }
        return path.resolve(deps.cwd, value);
    } catch {
        return undefined;
    }
}

// ─── 3. The policy ───────────────────────────────────────────────────────────

/**
 * Turn one scan result into a finding, or null when it is not block-worthy.
 *
 * The policy keys on CATEGORY, not on `decision` alone and never on `safe` or
 * `redacted`. Measured against the live scanner: `safe` is computed on the
 * redacted copy and is `true` even for text carrying a live API key, and
 * `redacted` is `true` for a bare email address. Category names, by contrast,
 * name the credential class actually found in the original text.
 */
export function findingFor(
    result: ScanResponse,
    origin: HookFinding["origin"],
    label: string,
    sampled = false,
): HookFinding | null {
    const classes = highRiskSecretClasses(result.categories ?? []);
    const blocked = result.decision === "block";
    if (classes.length === 0 && !blocked) return null;
    return {
        origin,
        label,
        classes,
        decision: result.decision,
        riskScore: result.riskScore,
        ...(sampled ? { sampled: true } : {}),
    };
}

/**
 * Compose the user-facing reason. Names classes, paths and variable NAMES, never
 * values.
 *
 * The remedy is chosen per finding type, because the wrong remedy is worse than
 * none: telling someone to "move the value into the vault and reference it by
 * name" when they were blocked for `echo $OPENAI_API_KEY` is advice they have
 * already followed — the reference IS the leak. A block a user cannot act on is
 * a block they switch off.
 */
export function explain(findings: HookFinding[]): string {
    const lines = findings.map((f) => {
        const what = f.classes.length > 0 ? f.classes.join(", ") : `risk ${f.riskScore} (${f.decision})`;
        const where = f.origin === "file" ? `the file ${f.label}` : f.label;
        const why = f.origin === "command" && f.detail ? ` — ${f.detail}` : "";
        return `  - ${what} in ${where}${why}${f.sampled ? " (large file: head and tail sampled)" : ""}`;
    });

    const remedies: string[] = [];
    if (findings.some((f) => f.origin === "command")) {
        remedies.push(
            "This command carries no secret in its TEXT, but running it would print one into the",
            "model's context. Referencing the variable is what leaks it, so vaulting the value does",
            "not help here. To proceed: do not print the secret. If a program needs it, run that",
            "program with `soterai run -- <command>` so the value is injected into that process only.",
        );
    }
    if (findings.some((f) => f.origin !== "command")) {
        remedies.push(
            "Move the value into the Protected Vault and reference it by name, or remove it from the",
            "file or command.",
        );
    }

    return [
        "SoterAI blocked this tool call: it would have put credentials into the model's context.",
        ...lines,
        "",
        "Nothing was sent.",
        ...remedies,
        "This hook reports classes, paths and variable names only — never values.",
    ].join("\n");
}

/** Run both checks and decide. All IO goes through `deps`, so this is testable. */
export async function evaluateHook(
    call: NormalizedHookCall,
    deps: HookDeps,
    options: HookOptions = DEFAULT_HOOK_OPTIONS,
): Promise<HookVerdict> {
    const findings: HookFinding[] = [];

    for (const { label, text } of [...call.inline, ...call.supplied]) {
        if (!text.trim()) continue;
        const finding = findingFor(await deps.scan(text), "input", label, false);
        if (finding) findings.push(finding);
    }

    // A shell command's payload usually lives in the files it names.
    const shellText = call.inline.filter((i) => /command/.test(i.label)).map((i) => i.text);
    const targets = [...call.filePaths.map((p) => resolveUserPath(p, deps)).filter(isString)];
    for (const command of shellText) {
        targets.push(...(await extractShellPaths(command, deps, options.maxFiles)));
    }

    const seen = new Set<string>();
    let budget = options.maxFiles;
    for (const target of targets) {
        if (budget <= 0) break;
        if (seen.has(target)) continue;
        seen.add(target);
        const file = await deps.readTarget(target);
        if (!file || !file.text.trim()) continue;
        budget--;
        const finding = findingFor(await deps.scan(file.text), "file", target, file.sampled);
        if (finding) findings.push(finding);
    }

    // Secret-by-reference: a command whose OUTPUT would carry a secret its TEXT
    // does not. The scanner cannot see this (the value is not in the string), so
    // it is a heuristic on the command itself — the only lever a pre-execution
    // hook has on an output-side leak.
    for (const command of shellText) {
        const reasons = detectEnvSecretReference(command);
        if (reasons.length === 0) continue;
        findings.push({
            origin: "command",
            label: "the shell command",
            detail: reasons.join("; "),
            classes: [ENV_SECRET_REFERENCE_CLASS],
            decision: "block",
            riskScore: 90,
        });
    }

    if (findings.length === 0) return { action: "allow", reason: "", findings: [] };
    return { action: "deny", reason: explain(findings), findings };
}

/** The verdict to use when the hook could not reach a real decision. */
export function errorVerdict(message: string, onError: OnError): HookVerdict {
    if (onError === "allow") {
        return {
            action: "allow",
            reason: `SoterAI hook could not check this call (${message}). Allowed because --on-error=allow is set.`,
            findings: [],
            errored: true,
        };
    }
    return {
        action: "deny",
        reason:
            `SoterAI blocked this tool call because it could not be checked: ${message}\n` +
            `Start the broker with "soterai broker start", or pass --on-error=allow to let unchecked calls ` +
            "through (this turns the guard into a monitor).",
        findings: [],
        errored: true,
    };
}

// ─── 4. Rendering, per host ──────────────────────────────────────────────────

/**
 * Serialize a verdict into what each host actually understands.
 *
 * The exit codes are load-bearing and differ per host, so they are not
 * guesswork:
 *
 * - Claude Code: exit 2 is the ONLY code that blocks on its own; exit 1 is a
 *   NON-blocking error and the call proceeds. So a deny emits the JSON, the
 *   reason on stderr, AND exit 2 — any one of the three is sufficient.
 *   On allow it emits NOTHING and exits 0: a `permissionDecision: "allow"`
 *   would suppress the user's own permission prompt, which is not this hook's
 *   call to make.
 *
 * - Cursor: hooks fail OPEN unless `failClosed: true` is set, and under
 *   `failClosed` an empty stdout counts as a failure. So Cursor must receive an
 *   explicit `{"permission":"allow"}` — silence would block every clean call.
 *   Its merge is strictest-wins across config sources, so an explicit allow
 *   here cannot override another source's deny.
 *
 * - Codex: its response schema is NOT verified in this build. It is sent the
 *   Claude Code shape plus exit 2, because exit 2 is the part most likely to be
 *   honored, and `hook status` says plainly that it is unverified.
 */
export function renderVerdict(call: NormalizedHookCall, verdict: HookVerdict): HookRendered {
    if (call.agent === "cursor") {
        const permission = verdict.action === "deny" ? "deny" : verdict.action === "ask" ? "ask" : "allow";
        const payload: Record<string, unknown> = { permission };
        if (verdict.action !== "allow") {
            payload.user_message = verdict.reason;
            payload.agent_message =
                "This call was blocked by SoterAI because it would expose credentials. " +
                "Do not retry it; ask the user to vault the value instead.";
        }
        return {
            stdout: JSON.stringify(payload),
            stderr: verdict.action === "deny" ? verdict.reason : undefined,
            exitCode: verdict.action === "deny" ? 2 : 0,
        };
    }

    if (verdict.action === "allow") {
        // No decision: the host's normal permission flow applies unchanged.
        return { stderr: verdict.errored ? verdict.reason : undefined, exitCode: 0 };
    }

    return {
        stdout: JSON.stringify({
            hookSpecificOutput: {
                hookEventName: call.event,
                permissionDecision: "deny",
                permissionDecisionReason: verdict.reason,
            },
        }),
        stderr: verdict.reason,
        exitCode: 2,
    };
}

function isString(value: string | undefined): value is string {
    return typeof value === "string";
}

/** Parse the host payload. Malformed input is an error, never a silent allow. */
export function parseHookInput(raw: string): Record<string, unknown> {
    const trimmed = raw.trim();
    if (!trimmed) throw new Error("no hook payload on stdin");
    let parsed: unknown;
    try {
        parsed = JSON.parse(trimmed);
    } catch {
        throw new Error("hook payload on stdin was not valid JSON");
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("hook payload on stdin was not a JSON object");
    }
    return parsed as Record<string, unknown>;
}

/** Default home directory, injected so tests never touch the real one. */
export function defaultHome(): string {
    return homedir();
}

export { HIGH_RISK_SECRET_CLASSES };
