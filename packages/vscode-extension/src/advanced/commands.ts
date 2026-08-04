/**
 * Gap A + Gap B — commands that route content through the egress firewall.
 *
 * Three entry points, all local:
 *   1. soterai.checkBeforeSendingToAI — evaluate the selection/clipboard before
 *      the user pastes it into any AI chat, and offer the redacted copy.
 *   2. soterai.checkEgressPayload     — programmatic entry for other extensions
 *      and future Copilot/Cursor wrappers (Gap E). Returns the EgressResult.
 *   3. soterai.showEgressFirewallStatus — honest coverage report.
 *
 * Every decision is appended to the tamper-proof ledger (Gap C) with redacted
 * evidence only — the raw text is never stored, logged, or transmitted.
 */
import * as vscode from "vscode";
import { escapeHtml, showInfoWebview } from "../firewall/util";
import { AuditLedger } from "./auditLedger";
import {
    AI_EGRESS_HOSTS,
    EGRESS_COVERAGE,
    evaluateEgress,
    evaluateEgressToHost,
    type EgressResult,
} from "./egressFirewall";

/** Read the text to evaluate: the active selection if any, else the clipboard. */
async function resolveSubject(): Promise<{ text: string; origin: string } | undefined> {
    const editor = vscode.window.activeTextEditor;
    if (editor && !editor.selection.isEmpty) {
        return { text: editor.document.getText(editor.selection), origin: "selection" };
    }
    const clipboard = await vscode.env.clipboard.readText();
    if (clipboard.trim()) return { text: clipboard, origin: "clipboard" };
    return undefined;
}

function summarize(result: EgressResult): string {
    const top = result.findings.slice(0, 3).map((f) => f.title).join("; ");
    const variants = result.obfuscationVariants.length ? ` Hidden via: ${result.obfuscationVariants.join(", ")}.` : "";
    return `${result.reason}${top ? ` Findings: ${top}.` : ""}${variants}`;
}

/**
 * Present the decision and let the user act on it. Returns true when the content
 * is cleared to send (either it was clean or the user chose to proceed).
 */
async function presentDecision(result: EgressResult, origin: string): Promise<boolean> {
    const detail = summarize(result);

    if (result.decision === "ALLOW") {
        void vscode.window.showInformationMessage(`SoterAI Egress Firewall: safe to send (${result.riskScore}/100).`);
        return true;
    }

    if (result.decision === "BLOCK") {
        const pick = await vscode.window.showErrorMessage(
            `SoterAI blocked this send (${result.riskScore}/100). ${detail}`,
            { modal: true },
            ...(result.redactedText ? ["Copy Redacted Version"] : []),
        );
        if (pick === "Copy Redacted Version" && result.redactedText) {
            await vscode.env.clipboard.writeText(result.redactedText);
            void vscode.window.showInformationMessage("Redacted version copied to the clipboard.");
        }
        return false;
    }

    if (result.decision === "REDACT") {
        const pick = await vscode.window.showWarningMessage(
            `SoterAI: secrets detected in this ${origin} (${result.riskScore}/100). ${detail}`,
            { modal: true },
            "Copy Redacted Version",
            "Send Original Anyway",
        );
        if (pick === "Copy Redacted Version" && result.redactedText) {
            await vscode.env.clipboard.writeText(result.redactedText);
            void vscode.window.showInformationMessage("Redacted version copied — paste this into the AI tool instead.");
            return false;
        }
        return pick === "Send Original Anyway";
    }

    // ASK
    const pick = await vscode.window.showWarningMessage(
        `SoterAI: this ${origin} looks like a prompt-injection attempt (${result.riskScore}/100). ${detail}`,
        { modal: true },
        "Send Anyway",
    );
    return pick === "Send Anyway";
}

export function registerEgressFirewallCommands(context: vscode.ExtensionContext): void {
    const ledger = AuditLedger.get(context);
    const reg = (id: string, handler: (...args: any[]) => any) =>
        context.subscriptions.push(vscode.commands.registerCommand(id, handler));

    // 1. Interactive pre-send check.
    reg("soterai.checkBeforeSendingToAI", async () => {
        const subject = await resolveSubject();
        if (!subject) {
            void vscode.window.showInformationMessage("Select text or copy something first — nothing to check.");
            return undefined;
        }
        const result = evaluateEgress(subject.text);
        const proceeded = await presentDecision(result, subject.origin);
        await ledger.append(
            "egress.precheck",
            proceeded && result.decision !== "ALLOW" ? `${result.decision}_OVERRIDDEN` : result.decision,
            result.riskScore,
            result.findings.map((f) => f.redactedEvidence).join(" | "),
        );
        return result;
    });

    // 2. Programmatic entry point (Gap E hook). Callers pass text and optionally
    //    a destination URL; the EgressResult is returned for them to honour.
    reg("soterai.checkEgressPayload", async (payload?: { text?: string; url?: string }) => {
        const text = payload?.text ?? "";
        const result = payload?.url ? evaluateEgressToHost(text, payload.url) : evaluateEgress(text);
        await ledger.append(
            "egress.programmatic",
            result.decision,
            result.riskScore,
            result.findings.map((f) => f.redactedEvidence).join(" | "),
        );
        return result;
    });

    // 3. Honest coverage report.
    reg("soterai.showEgressFirewallStatus", async () => {
        const hosts = AI_EGRESS_HOSTS.map((h) => `<li><code>${escapeHtml(h)}</code></li>`).join("");
        const chain = await ledger.verifyChain();
        showInfoWebview(
            "soteraiEgressFirewall",
            "SoterAI: AI Egress Firewall",
            `<h1>AI Egress Firewall</h1>
            <p>Every text routed through a SoterAI send/approve command is scanned for secrets,
            prompt injection, jailbreak, and exfiltration instructions <em>before</em> it leaves —
            including obfuscated variants (zero-width unicode, homoglyphs, leetspeak, letter-spacing,
            reversal, and base64).</p>
            <h2>Coverage — <span class="badge">${escapeHtml(EGRESS_COVERAGE.level)}</span></h2>
            <p><strong>Enforced for:</strong> ${escapeHtml(EGRESS_COVERAGE.enforcedFor)}</p>
            <p><strong>NOT enforced for:</strong> ${escapeHtml(EGRESS_COVERAGE.notEnforcedFor)}</p>
            <h2>Recognised AI destinations</h2>
            <ul>${hosts}</ul>
            <h2>Audit ledger</h2>
            <p>${chain.entries} entry(s) recorded. Chain integrity: <strong>${chain.ok ? "VERIFIED" : `BROKEN at #${chain.brokenAt}`}</strong>.</p>
            <p class="note">All checks run locally. Findings carry redacted evidence only — raw secrets
            and prompts are never stored, logged, or transmitted.</p>`,
        );
    });
}
