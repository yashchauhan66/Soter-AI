import * as vscode from "vscode";

import {
    TERMINAL_WATCH_CAPABILITY,
    describeShellExecution,
    shouldNotifyShellExecution,
    type ShellExecutionVerdict,
} from "./shellExecutionPolicy";

/**
 * GAP 4 — watch what actually runs in the integrated terminal.
 *
 * Before this, the only automatic terminal behaviour was a single
 * `onDidOpenTerminal` advisory with a permanent "Don't Show Again". The
 * 22-pattern `TerminalCommandRiskDetector` never saw a command unless the user
 * typed one into a SoterAI input box, so an AI agent running `rm -rf ~` in the
 * integrated terminal produced nothing.
 *
 * VERSION GATING. `window.onDidStartTerminalShellExecution` exists in the
 * installed `@types/vscode` (1.125) but not on the `^1.85.0` floor this
 * extension keeps for Cursor/Windsurf/Kiro/Antigravity. So it typechecks and is
 * absent at runtime — precisely the shape that ships as a TypeError on the
 * oldest supported host, which is the one nobody launches by hand. It is
 * feature-detected, and on a host without it this registers nothing.
 *
 * SHELL INTEGRATION. Even on a new host the event only fires for shells where
 * VS Code's shell integration is active. A shell without it runs commands this
 * never sees. That is stated in the coverage string rather than papered over,
 * and it is the main reason the claim is MONITORED.
 *
 * All decisions live in `shellExecutionPolicy.ts`; this file only adapts the
 * host event and renders the result.
 */

/** Minimal shape of the 1.93+ event, so the module compiles on the floor. */
interface ShellExecutionStartEvent {
    execution?: { commandLine?: { value?: string } };
    terminal?: vscode.Terminal;
}

/** True when this host implements the shell-execution event. */
export function supportsShellExecutionEvents(): boolean {
    return (
        typeof (vscode.window as { onDidStartTerminalShellExecution?: unknown })
            .onDidStartTerminalShellExecution === "function"
    );
}

/**
 * Subscribe to terminal shell executions. Returns whether the subscription was
 * made, so the caller can report coverage honestly instead of implying terminal
 * monitoring on a host that has none.
 */
export function registerShellExecutionWatcher(
    context: vscode.ExtensionContext,
    hooks: {
        /** Records the detection in the redacted timeline. Never raw content. */
        record: (verdict: ShellExecutionVerdict) => void;
        /** The user's "Don't show again" choice for the *advisory* notice only. */
        advisoryNoticeSuppressed: () => boolean;
    },
): boolean {
    if (!supportsShellExecutionEvents()) return false;

    // Suppression of the low-severity advisory is per session and per user
    // choice. It never gates a critical detection — see shouldNotifyShellExecution.
    let warnedThisSession = false;

    const api = vscode.window as unknown as {
        onDidStartTerminalShellExecution: (
            listener: (event: ShellExecutionStartEvent) => void,
        ) => vscode.Disposable;
    };

    context.subscriptions.push(
        api.onDidStartTerminalShellExecution((event) => {
            const commandLine = event.execution?.commandLine?.value;
            const verdict = describeShellExecution(commandLine);
            if (verdict.severity === "none") return;

            // Recorded before any UI: a user who dismisses the modal, or who has
            // notifications suppressed entirely, must still be able to find what
            // ran in the timeline afterwards.
            try {
                hooks.record(verdict);
            } catch {
                /* the timeline is best-effort; never break the terminal handler */
            }

            const notify = shouldNotifyShellExecution({
                severity: verdict.severity,
                advisoryNoticeSuppressed: hooks.advisoryNoticeSuppressed(),
                alreadyWarnedThisSession: warnedThisSession,
            });
            warnedThisSession = true;
            if (!notify) return;

            void showVerdict(verdict);
        }),
    );
    return true;
}

/**
 * Tell the user what matched, and what they can do about a command that is
 * already running. Modal only for critical: a modal for every medium finding is
 * how a security tool teaches people to dismiss it without reading.
 */
async function showVerdict(verdict: ShellExecutionVerdict): Promise<void> {
    const undo = "How do I undo this?";
    const controlled = "Use checked terminal next time";
    const message = `SoterAI: ${verdict.summary}`;

    const choice =
        verdict.severity === "critical"
            ? await vscode.window.showWarningMessage(message, { modal: true }, undo, controlled)
            : await vscode.window.showWarningMessage(message, controlled);

    if (choice === controlled) {
        await vscode.commands.executeCommand("soterai.runControlledTerminalCommand");
        return;
    }
    if (choice === undo) {
        // No generic undo exists for an arbitrary shell command, and pretending
        // otherwise would be the worst kind of false comfort. What SoterAI can
        // do is name the pattern and point at the surfaces that do enforce.
        await vscode.window.showInformationMessage(
            `SoterAI cannot undo a command the shell already ran. Matched: ${verdict.matchedPattern}. ` +
            `${TERMINAL_WATCH_CAPABILITY.coverage}`,
            { modal: true },
            "OK",
        );
    }
}
