import path from "node:path";

/**
 * Hook installation — writing the agent config that actually invokes the guard.
 *
 * A note on one specific file: on Claude Code the user-scope target is
 * `~/.claude/settings.json`, which is commonly where a live provider key lives.
 * So this module never reads that file for display, never copies it to a `.bak`
 * (a backup of a secrets file is a second copy of the secret), and never echoes
 * its contents. It parses, merges one `hooks` entry, and writes back through a
 * same-directory temp file + rename so a crash cannot truncate it.
 *
 * Installs are idempotent: re-running replaces SoterAI's own entry and leaves
 * every other hook in the file untouched.
 */

export type HookScope = "user" | "project";

export interface InstallTarget {
    agent: "claude-code" | "cursor";
    scope: HookScope;
    file: string;
}

export interface InstallPlan {
    target: InstallTarget;
    /** The merged document to write. */
    document: Record<string, unknown>;
    /** True when the file already had an equivalent SoterAI entry. */
    alreadyInstalled: boolean;
}

/** Marks an entry as ours so re-installs replace rather than duplicate. */
export const HOOK_MARKER = "soterai-hook";

export function claudeSettingsPath(scope: HookScope, home: string, cwd: string): string {
    return scope === "user"
        ? path.join(home, ".claude", "settings.json")
        : path.join(cwd, ".claude", "settings.json");
}

export function cursorHooksPath(scope: HookScope, home: string, cwd: string): string {
    return scope === "user" ? path.join(home, ".cursor", "hooks.json") : path.join(cwd, ".cursor", "hooks.json");
}

/**
 * The command that runs the guard.
 *
 * It is spawned through the current Node binary with an absolute script path
 * rather than a bare `soterai`, so the hook keeps working when the agent runs
 * with a PATH that does not include npm's bin directory — a silent fail-open
 * otherwise, since a hook that cannot start is a NON-blocking error.
 */
export function hookCommand(execPath: string, cliEntry: string, agent: string): { command: string; args: string[] } {
    return { command: execPath, args: [cliEntry, "hook", agent, `--marker=${HOOK_MARKER}`] };
}

function quote(value: string): string {
    return /\s/.test(value) ? `"${value}"` : value;
}

/** Cursor takes a single command string, with no separate argv array. */
export function cursorCommandString(execPath: string, cliEntry: string): string {
    return `${quote(execPath)} ${quote(cliEntry)} hook cursor --marker=${HOOK_MARKER}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === "object" && !Array.isArray(value);
}

function asArray(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
}

/** True when a Claude Code hook handler is one we installed. */
function isOurClaudeHook(handler: unknown): boolean {
    if (!isRecord(handler)) return false;
    const args = asArray(handler.args).filter((a): a is string => typeof a === "string");
    return args.some((a) => a.includes(HOOK_MARKER)) || String(handler.command ?? "").includes(HOOK_MARKER);
}

/**
 * Merge the SoterAI handler into a Claude Code settings document.
 *
 * `matcher: "*"` is deliberate. A narrower list would be cheaper — the hook
 * spawns a process per tool call — but every tool left out is a hole, and a
 * hole in a guard is worth more than the milliseconds it saves. Narrow it by
 * editing the matcher if the cost matters more than the coverage.
 */
export function mergeClaudeCodeHooks(
    existing: unknown,
    handler: { command: string; args: string[] },
    timeoutSeconds = 10,
): { document: Record<string, unknown>; alreadyInstalled: boolean } {
    const document: Record<string, unknown> = isRecord(existing) ? { ...existing } : {};
    const hooks: Record<string, unknown> = isRecord(document.hooks) ? { ...document.hooks } : {};
    const preToolUse = asArray(hooks.PreToolUse).slice();

    const entry = { type: "command", command: handler.command, args: handler.args, timeout: timeoutSeconds };

    let alreadyInstalled = false;
    let placed = false;
    const merged = preToolUse.map((group) => {
        if (!isRecord(group)) return group;
        const matcher = typeof group.matcher === "string" ? group.matcher : "*";
        const handlers = asArray(group.hooks);
        const ours = handlers.filter(isOurClaudeHook);
        if (ours.length === 0) return group;
        alreadyInstalled = ours.some((h) => JSON.stringify(h) === JSON.stringify(entry));
        placed = true;
        return { ...group, matcher, hooks: [...handlers.filter((h) => !isOurClaudeHook(h)), entry] };
    });

    if (!placed) merged.push({ matcher: "*", hooks: [entry] });

    hooks.PreToolUse = merged;
    document.hooks = hooks;
    return { document, alreadyInstalled };
}

/** The three Cursor events that can carry a credential into or out of context. */
export const CURSOR_EVENTS = ["beforeReadFile", "beforeShellExecution", "beforeMCPExecution"] as const;

/**
 * Merge the SoterAI handler into a Cursor `hooks.json`.
 *
 * `failClosed: true` is set on every entry. Cursor hooks fail OPEN by default —
 * a crash, a timeout, a non-zero exit or empty output all let the action
 * through — which would make this guard report protection it does not deliver
 * exactly when it is failing. The cost is that a broken install blocks work
 * loudly instead of passing secrets quietly, which is the right way round.
 */
export function mergeCursorHooks(
    existing: unknown,
    command: string,
    timeoutSeconds = 10,
): { document: Record<string, unknown>; alreadyInstalled: boolean } {
    const document: Record<string, unknown> = isRecord(existing) ? { ...existing } : {};
    if (typeof document.version !== "number" || document.version < 1) document.version = 1;
    const hooks: Record<string, unknown> = isRecord(document.hooks) ? { ...document.hooks } : {};

    const entry = { command, timeout: timeoutSeconds, failClosed: true };
    let alreadyInstalled = true;

    for (const event of CURSOR_EVENTS) {
        const current = asArray(hooks[event]);
        const others = current.filter((h) => !(isRecord(h) && String(h.command ?? "").includes(HOOK_MARKER)));
        const mine = current.filter((h) => isRecord(h) && String(h.command ?? "").includes(HOOK_MARKER));
        if (mine.length !== 1 || JSON.stringify(mine[0]) !== JSON.stringify(entry)) alreadyInstalled = false;
        hooks[event] = [...others, entry];
    }

    document.hooks = hooks;
    return { document, alreadyInstalled };
}
