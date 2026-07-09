import * as vscode from "vscode";
import { type FirewallDeps } from "./shared";
import { LedgerStore } from "./LedgerStore";
import { escapeHtml, showInfoWebview } from "./util";

export function registerLedgerCommands(deps: FirewallDeps): void {
    const { context, refreshViews } = deps;
    const reg = (id: string, handler: (...args: any[]) => any) =>
        context.subscriptions.push(vscode.commands.registerCommand(id, handler));

    const openAILedger = async () => {
        const entries = await LedgerStore.readAll();
        const rows = entries
            .slice()
            .reverse()
            .slice(0, 200)
            .map(
                (e) =>
                    `<tr><td>${escapeHtml(e.timestamp)}</td><td>${escapeHtml(e.eventType)}</td>` +
                    `<td><span class="badge ${escapeHtml(e.decision)}">${escapeHtml(e.decision)}</span></td>` +
                    `<td>${escapeHtml(String(e.riskScore))}</td><td>${escapeHtml((e.categories ?? []).join(", "))}</td>` +
                    `<td>${escapeHtml((e.filePaths ?? []).join(", "))}</td><td>${escapeHtml(e.redactedEvidencePreview ?? "")}</td></tr>`,
            )
            .join("");
        showInfoWebview(
            "soteraiLedger",
            "SoterAI: What AI Saw — Ledger",
            `<h1>📒 What AI Saw</h1>
         <p>${entries.length} recorded event(s). Newest first (max 200 shown). Hashes and redacted previews only — no raw secrets.</p>
         <table><tr><th>Time</th><th>Event</th><th>Decision</th><th>Risk</th><th>Categories</th><th>Files</th><th>Evidence</th></tr>${
             rows || `<tr><td colspan="7">Ledger is empty.</td></tr>`
         }</table>`,
        );
    };

    const exportAILedger = async () => {
        const jsonl = await LedgerStore.exportSafe();
        const doc = await vscode.workspace.openTextDocument({ content: jsonl || "", language: "json" });
        await vscode.window.showTextDocument(doc);
        vscode.window.showInformationMessage("Exported sanitized AI access ledger (no raw secrets).");
    };

    const clearAILedger = async () => {
        const confirm = await vscode.window.showWarningMessage(
            "Delete the local AI access ledger? This history cannot be recovered.",
            { modal: true },
            "Delete Ledger",
        );
        if (confirm !== "Delete Ledger") return;
        await LedgerStore.clear();
        vscode.window.showInformationMessage("Local AI ledger cleared.");
        refreshViews();
    };

    const showWhatAISawLastSession = async () => {
        const entries = await LedgerStore.readAll();
        const last = entries.filter((e) => e.eventType === "context_built" || e.eventType === "context_approved").pop();
        if (!last) return void vscode.window.showInformationMessage("No AI context has been built yet this workspace.");
        vscode.window.showInformationMessage(
            `Last AI context: ${last.decision.toUpperCase()} — ${last.redactedEvidencePreview ?? ""} (${last.timestamp}).`,
        );
    };

    reg("soterai.openAILedger", openAILedger);
    reg("soterai.exportAILedger", exportAILedger);
    reg("soterai.clearAILedger", clearAILedger);
    reg("soterai.showWhatAISawLastSession", showWhatAISawLastSession);
}
