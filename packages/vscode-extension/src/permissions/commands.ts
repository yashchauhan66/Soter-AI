import * as vscode from "vscode";
import { PermissionStore, type PermissionEntry } from "./PermissionStore";
import { escapeHtml, showInfoWebview } from "../firewall/util";

export function registerPermissionCommands(context: vscode.ExtensionContext, store: PermissionStore): void {
    const reg = (id: string, handler: (...args: any[]) => any) => context.subscriptions.push(vscode.commands.registerCommand(id, handler));

    reg("soterai.openPermissionCenter", () => {
        const all = store.getAll();
        const pending = store.getPending();
        const rows = all.slice().reverse().slice(0, 200).map((e) => {
            const outcomeClass = e.outcome === "allow" ? "allow" : e.outcome === "deny" ? "block" : "warn";
            return `<tr><td>${new Date(e.timestamp).toLocaleTimeString()}</td><td>${escapeHtml(e.type)}</td><td><code>${escapeHtml(e.target)}</code></td><td><span class="badge ${outcomeClass}">${escapeHtml(e.outcome)}</span></td><td>${escapeHtml(e.scope)}</td><td><code>${escapeHtml(e.contentHash.slice(0, 12))}...</code></td></tr>`;
        }).join("");

        showInfoWebview("soteraiPermissionCenter", "SoterAI: AI Permission Center",
            `<h1>AI Permission Center</h1>
            <p>${all.length} total approval(s), <strong>${pending.length} active</strong>.</p>
            <table><tr><th>Time</th><th>Type</th><th>Target</th><th>Outcome</th><th>Scope</th><th>Content Hash</th></tr>
            ${rows || "<tr><td colspan='6'>No permissions recorded yet.</td></tr>"}</table>
            <p class="note">Approval tokens are short-lived, content-hash bound, and session-scoped. They cannot be reused for changed content. No tokens are exposed in this view.</p>`
        );
    });

    reg("soterai.reviewPendingApprovals", async () => {
        const pending = store.getPending();
        if (pending.length === 0) return vscode.window.showInformationMessage("No pending AI approvals.");

        const pick = await vscode.window.showQuickPick(
            pending.map((p) => ({ label: `${p.type}: ${p.target}`, detail: `Scope: ${p.scope} | Hash: ${p.contentHash.slice(0, 12)}...`, entry: p })),
            { title: "Pending AI Approvals", placeHolder: "Select an approval to review" }
        );
        if (!pick) return;

        const action = await vscode.window.showQuickPick(
            ["Allow Once", "Allow Session", "Allow Workspace", "Redact and Allow", "Deny"],
            { title: "Approval Decision", placeHolder: "Choose an action" }
        );
        if (!action) return;

        const entry = pick.entry;
        if (action === "Deny") {
            await store.deny(entry.type, entry.target, entry.contentHash);
            vscode.window.showInformationMessage("AI access denied.");
        } else if (action === "Redact and Allow") {
            await store.redactApprove(entry.type, entry.target, entry.contentHash);
            vscode.window.showInformationMessage("AI access approved with redaction.");
        } else {
            const scope = action === "Allow Once" ? "once" : action === "Allow Session" ? "session" : "workspace";
            await store.approve(entry.type, entry.target, entry.contentHash, scope);
            vscode.window.showInformationMessage(`AI access approved (${scope}).`);
        }
    });

    reg("soterai.clearApprovals", async () => {
        const confirm = await vscode.window.showWarningMessage("Clear all AI permission approvals?", { modal: true }, "Clear All");
        if (confirm === "Clear All") {
            await store.clear();
            vscode.window.showInformationMessage("All AI approvals cleared.");
        }
    });
}
