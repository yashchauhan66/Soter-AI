import * as vscode from "vscode";
import { type FirewallDeps, activeFileUri } from "./shared";
import { PolicyStore } from "./PolicyStore";
import { escapeHtml, showInfoWebview, firstWorkspaceFolder } from "./util";

export function registerPolicyCommands(deps: FirewallDeps): void {
    const { context, refreshViews } = deps;
    const reg = (id: string, handler: (...args: any[]) => any) =>
        context.subscriptions.push(vscode.commands.registerCommand(id, handler));

    const createProjectPolicy = async () => {
        if (!firstWorkspaceFolder()) return void vscode.window.showErrorMessage("Open a workspace folder first.");
        if (await PolicyStore.exists()) {
            const pick = await vscode.window.showWarningMessage(
                ".soterai/policy.json already exists. Overwrite with defaults?",
                "Overwrite",
                "Cancel",
            );
            if (pick !== "Overwrite") return;
        }
        const uri = await PolicyStore.createDefault();
        await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(uri));
        vscode.window.showInformationMessage("Created .soterai/policy.json (AI Context Firewall policy).");
        refreshViews();
    };

    const editProjectPolicy = async () => {
        const uri = PolicyStore.policyUri();
        if (!uri) return void vscode.window.showErrorMessage("Open a workspace folder first.");
        if (!(await PolicyStore.exists())) await PolicyStore.createDefault();
        await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(uri));
    };

    const showProtectedFiles = async () => {
        const policy = await PolicyStore.load();
        const matches = await PolicyStore.listClassified(policy);
        const rows = matches
            .map(
                (m) =>
                    `<tr><td><code>${escapeHtml(m.relPath)}</code></td><td><span class="badge ${escapeHtml(
                        m.level,
                    )}">${escapeHtml(m.level)}</span></td><td><code>${escapeHtml(m.matchedPattern ?? "")}</code></td></tr>`,
            )
            .join("");
        const body = `<h1>🛡️ Protected & Sensitive Files</h1>
      <p>Files in this workspace matched by the AI Context Firewall policy.</p>
      <table><tr><th>File</th><th>Level</th><th>Matched pattern</th></tr>${rows || `<tr><td colspan="3">No protected/sensitive files matched.</td></tr>`}</table>
      <p class="note">Protected files are excluded from SoterAI-built AI context; sensitive files require approval. This does not stop other extensions from reading files SoterAI has not migrated — see the limitations doc.</p>`;
        showInfoWebview("soteraiProtectedFiles", "SoterAI: Protected Files", body);
    };

    const addToProtectedFiles = async () => {
        const uri = activeFileUri();
        if (!uri) return void vscode.window.showErrorMessage("Open a file to protect.");
        const rel = vscode.workspace.asRelativePath(uri);
        await PolicyStore.addProtected(rel);
        vscode.window.showInformationMessage(`Added ${rel} to protected files.`);
        refreshViews();
    };

    const removeFromProtectedFiles = async () => {
        const policy = await PolicyStore.load();
        const pick = await vscode.window.showQuickPick(policy.protectedFiles, {
            title: "Remove a protected file pattern",
            placeHolder: "Select a pattern to remove",
        });
        if (!pick) return;
        await PolicyStore.removeProtected(pick);
        vscode.window.showInformationMessage(`Removed ${pick} from protected files.`);
        refreshViews();
    };

    reg("soterai.createProjectPolicy", createProjectPolicy);
    reg("soterai.editProjectPolicy", editProjectPolicy);
    reg("soterai.showProtectedFiles", showProtectedFiles);
    reg("soterai.addToProtectedFiles", addToProtectedFiles);
    reg("soterai.removeFromProtectedFiles", removeFromProtectedFiles);
}
