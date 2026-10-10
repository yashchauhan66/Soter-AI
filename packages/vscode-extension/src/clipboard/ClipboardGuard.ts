import * as vscode from "vscode";
import { ExtensionState } from "../state";
import { redactForSharing } from "@soterai/guard-core";
import type { GuardDecision } from "@soterai/guard-core";

// ── Clipboard / paste guard ───────────────────────────────────────────────────
//
// The real risk moment is "copy a secret, paste it into ChatGPT/Copilot/Claude".
// VS Code exposes no clipboard-change event, so we guard the two supported entry
// points instead:
//   1. `soterai.scanClipboard` — on demand, checks what's on the clipboard now.
//   2. `soterai.safePaste` — a paste replacement that scans the clipboard first
//      and, if risky, offers to paste a redacted version instead of the raw one.
//
// Everything is local. The raw clipboard value is never logged or stored.

function verdict(decision: GuardDecision): "Allow" | "Warn" | "Block" | "Human Review" {
    if (decision.decision === "block") return "Block";
    if (decision.decision === "approval_required") return "Human Review";
    if (decision.decision === "warn" || decision.decision === "redact") return "Warn";
    return "Allow";
}

/** Scan whatever is currently on the clipboard and report, offering a safe copy. */
async function scanClipboard(): Promise<GuardDecision | undefined> {
    const text = await vscode.env.clipboard.readText();
    if (!text.trim()) {
        vscode.window.showInformationMessage("Clipboard is empty — nothing to scan.");
        return undefined;
    }
    const state = ExtensionState.getInstance();
    const decision = await state.engine.scan(text, { context: "prompt" });
    state.latestDecision = decision;
    const v = verdict(decision);
    if (v === "Allow") {
        vscode.window.showInformationMessage(`SoterAI found no recognized high-risk content (${decision.riskScore}/100). Unmarked private text may still be present.`);
        return decision;
    }
    const reasons = decision.findings.slice(0, 3).map((f) => f.title).join("; ") || "sensitive content";
    const pick = await vscode.window.showWarningMessage(
        `SoterAI: clipboard is risky to paste into AI — ${v} (${decision.riskScore}/100). ${reasons}`,
        "Replace Clipboard with Safe Version",
        "Dismiss",
    );
    if (pick === "Replace Clipboard with Safe Version") {
        await vscode.env.clipboard.writeText(redactForSharing(decision.redactedText ?? text));
        const next = await vscode.window.showInformationMessage(
            `${decision.findings.length} recognized risk finding(s) were handled in the clipboard copy. Review it before sharing.`,
            "Protect Workspace Secrets",
        );
        if (next === "Protect Workspace Secrets") {
            await vscode.commands.executeCommand("soterai.autoMigrateWorkspace");
        }
    }
    return decision;
}

/**
 * Paste that checks the clipboard first. On risky content it offers to insert a
 * redacted version; otherwise it performs a normal paste. Bound to a command so
 * users can map it to Ctrl/Cmd+V if they want always-on protection.
 */
async function safePaste(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        void vscode.window.showWarningMessage("Safe Paste requires an active text editor. This command cannot protect pastes into other views.");
        return;
    }
    const version = editor.document.version;
    const selections = editor.selections.slice();
    const selectionIdentity = JSON.stringify(selections);
    const insertSnapshot = async (value: string): Promise<boolean> => {
        if (vscode.window.activeTextEditor !== editor || editor.document.version !== version
            || JSON.stringify(editor.selections) !== selectionIdentity) {
            void vscode.window.showWarningMessage("Safe Paste cancelled because the target editor or selection changed. Try again.");
            return false;
        }
        return editor.edit(builder => { for (const selection of selections) builder.replace(selection, value); });
    };
    const text = await vscode.env.clipboard.readText();
    if (!text.trim()) {
        return;
    }
    const state = ExtensionState.getInstance();
    const decision = await state.engine.scan(text, { context: "prompt" });
    state.latestDecision = decision;
    if (verdict(decision) === "Allow") {
        await insertSnapshot(text);
        return;
    }
    const reasons = decision.findings.slice(0, 3).map((f) => f.title).join("; ") || "sensitive content";
    const pick = await vscode.window.showWarningMessage(
        `SoterAI: this paste contains ${reasons} (${decision.riskScore}/100). Paste a redacted version instead?`,
        { modal: true },
        "Paste Redacted",
        "Paste Original",
    );
    if (pick === "Paste Redacted") {
        const safe = redactForSharing(decision.redactedText ?? text);
        if (await insertSnapshot(safe)) vscode.window.showInformationMessage("Redacted snapshot pasted.");
    } else if (pick === "Paste Original") {
        await insertSnapshot(text);
    }
    // No selection made => user cancelled; insert nothing.
}

export function registerClipboardGuard(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
        vscode.commands.registerCommand("soterai.scanClipboard", scanClipboard),
        vscode.commands.registerCommand("soterai.safePaste", safePaste),
    );
}
