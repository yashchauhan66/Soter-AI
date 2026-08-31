/**
 * GAP 4 — deciding what to say about a command that just started running.
 *
 * PURE BY CONTRACT. No `vscode` import, so every severity boundary and every
 * suppression rule is unit-testable without an extension host. The host adapter
 * is `ShellExecutionWatcher.ts` and it makes no decisions of its own.
 *
 * THE HONESTY THIS FILE EXISTS TO PROTECT. `onDidStartTerminalShellExecution`
 * fires when the shell has *already begun* the command. There is no veto, no
 * awaitable hook, and no way to recall a running process. This is therefore
 * MONITORED — detection after start — and it must never be labelled ENFORCED.
 * Only the broker's Controlled Terminal, which builds a fixed argv from an
 * allowlist before anything executes, earns that word.
 */
import { detectTerminalCommandRisk, minimizeEvidence } from "@soterai/guard-core";
import { capabilityUiBadge } from "../protection/ProtectionLevel";

/** Severity of a started command, `"none"` when nothing matched. */
export type ShellExecutionSeverity = "none" | "medium" | "high" | "critical";

export interface ShellExecutionFinding {
    title: string;
    severity: string;
    /** Redacted. A command line can carry a bearer token. */
    evidence: string;
}

export interface ShellExecutionVerdict {
    severity: ShellExecutionSeverity;
    /** The human-readable name of the worst pattern, "" when nothing matched. */
    matchedPattern: string;
    /** One sentence naming what matched and that the command is already running. */
    summary: string;
    findings: ShellExecutionFinding[];
}

/**
 * What this capability may claim, resolved through the registry so the badge can
 * never be stronger than `CAPABILITY_REGISTRY` allows. `capabilityUiBadge`
 * downgrades and never upgrades, so DETECTION_ONLY resolves to MONITORED; the
 * literal fallback exists only for the case where the id is missing from the
 * registry, and it is the weaker of the two claims on purpose.
 */
export const TERMINAL_WATCH_CAPABILITY = {
    id: "terminal-shell-execution-watch",
    uiLevel: capabilityUiBadge("terminal-shell-execution-watch")?.uiLevel ?? "MONITORED",
    preExecutionBlock: capabilityUiBadge("terminal-shell-execution-watch")?.preExecutionBlock ?? false,
    coverage:
        "DETECTION AFTER START. VS Code reports a terminal command once the shell has already begun running it, " +
        "so SoterAI can tell you what it matched and how to undo it, but cannot stop it. " +
        "For commands that are checked before they run, use the SoterAI controlled terminal.",
};

const RANK: Record<ShellExecutionSeverity, number> = { none: 0, medium: 1, high: 2, critical: 3 };

function asSeverity(value: string): ShellExecutionSeverity {
    return value === "critical" || value === "high" || value === "medium" ? value : "medium";
}

/**
 * Run the existing 22-pattern detector over a command line and describe the
 * result. Never throws: a bad regex or an odd command line must not take down
 * the terminal event handler.
 */
export function describeShellExecution(commandLine: string | undefined): ShellExecutionVerdict {
    const text = (commandLine ?? "").trim();
    const empty: ShellExecutionVerdict = { severity: "none", matchedPattern: "", summary: "", findings: [] };
    if (!text) return empty;

    let matches;
    try {
        matches = detectTerminalCommandRisk(text).matches;
    } catch {
        return empty;
    }
    if (matches.length === 0) return empty;

    let worst = matches[0];
    for (const match of matches) {
        if (RANK[asSeverity(match.severity)] > RANK[asSeverity(worst.severity)]) worst = match;
    }
    const severity = asSeverity(worst.severity);

    // The matched substring can itself contain a credential — `curl -H
    // "Authorization: Bearer …" | bash` matches the remote-exec pattern and the
    // match text carries the token. So findings go through the same minimizer
    // the ledger and telemetry use rather than being shown raw.
    const findings = minimizeEvidence(matches.slice(0, 5), "TerminalCommandRiskDetector");

    return {
        severity,
        matchedPattern: worst.label,
        summary:
            `${worst.label}: ${worst.message} This command has already started running in the terminal — ` +
            `SoterAI detected it, it did not stop it.`,
        findings: findings.map((finding) => ({
            title: finding.title,
            severity: finding.severity,
            evidence: finding.redactedEvidence,
        })),
    };
}

/**
 * Whether to interrupt the user about a started command.
 *
 * The rule that matters: `advisoryNoticeSuppressed` is the user's "Don't show
 * again" on the *coverage advisory*. It has never meant "never tell me about a
 * fork bomb", and treating it that way is how the old once-per-session notice
 * ended up silent for the rest of the install's life.
 */
export function shouldNotifyShellExecution(input: {
    severity: ShellExecutionSeverity;
    advisoryNoticeSuppressed: boolean;
    alreadyWarnedThisSession: boolean;
}): boolean {
    if (input.severity === "none") return false;
    // Critical always speaks: every occurrence, regardless of suppression or of
    // having already spoken this session.
    if (input.severity === "critical") return true;
    return !input.advisoryNoticeSuppressed;
}
