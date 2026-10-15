import * as vscode from "vscode";
import { type FirewallDeps, activeFileUri } from "./shared";
import { LedgerStore } from "./LedgerStore";
import { PolicyStore } from "./PolicyStore";
import { escapeHtml, showInfoWebview, workspacePseudoId } from "./util";

export function registerVaultCommands(deps: FirewallDeps): void {
    const { context, refreshViews, vault, requireTrust } = deps;
    const reg = (id: string, handler: (...args: any[]) => any) => context.subscriptions.push(vscode.commands.registerCommand(id, handler));
    const target = (requested?: unknown): vscode.Uri | undefined => {
        if (requested instanceof vscode.Uri) return requested;
        const current = vscode.window.tabGroups?.activeTabGroup?.activeTab?.input;
        return current instanceof vscode.TabInputCustom ? current.uri : activeFileUri();
    };
    const run = async (requested: unknown, operation: (uri: vscode.Uri) => Promise<void>) => {
        if (!requireTrust("Protected vault")) return;
        const uri = target(requested); if (!uri) return void vscode.window.showErrorMessage("Choose a project file or open it in the masked editor first.");
        try { await operation(uri); refreshViews(); }
        catch { void vscode.window.showErrorMessage("Vault operation withheld. Encrypted recovery is retained. Use Complete Safe Vault Recovery for an interrupted migration; original values are never restored automatically."); }
    };
    const migrateSecretsToVault = (requested?: unknown) => run(requested, async uri => {
        const count = await vault.migrate(uri); if (!count) return;
        await LedgerStore.append({ eventId: `mig_${Date.now()}`, workspacePseudoId: await workspacePseudoId(), eventType: "vault_migrated", action: "redact",
            severity: "high", riskScore: 50, categories: ["secret"], filePaths: [vscode.workspace.asRelativePath(uri)],
            policyVersion: String((await PolicyStore.load()).version), redactedEvidencePreview: `${count} values vaulted` });
        void vscode.window.showInformationMessage(`Migrated ${count} values. Placeholders and a safe example are on disk; encrypted recovery is outside the project. Other copies and history may remain.`);
    });
    const restoreSecretPlaceholders = (requested?: unknown) => run(requested, async uri => {
        const count = await vault.restore(uri); if (count) void vscode.window.showInformationMessage(`Restored ${count} values after disclosure approval. Saved restrictions remain.`);
    });
    const restoreFileFromBackup = (requested?: unknown) => run(requested, async uri => {
        if (await vault.restoreFromBackup(uri)) void vscode.window.showInformationMessage("Restored the bound encrypted original after disclosure approval. Saved restrictions remain.");
    });
    const recoverVaultMigration = (requested?: unknown) => run(requested, async uri => {
        if (await vault.recoverMigration(uri)) void vscode.window.showInformationMessage("Interrupted migration completed with placeholders and a safe example. Original values remain encrypted.");
    });
    const generateEnvExampleSafely = (requested?: unknown) => run(requested, async uri => {
        const example = await vault.writeEnvExample(uri); await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(example));
        void vscode.window.showInformationMessage("Safe example contains unique names and empty values. Conflicting existing examples are preserved.");
    });
    const openVaultStatus = async () => {
        try {
            const status = await vault.status(), rows = status.entries.map(entry => `<tr><td><code>${escapeHtml(entry.key)}</code></td><td>${escapeHtml(entry.type)}</td><td><code>${escapeHtml(entry.placeholder)}</code></td><td>${escapeHtml(entry.originalFile)}</td></tr>`).join("");
            showInfoWebview("soteraiVaultStatus", "SoterAI: Protected Vault", `<h1>Protected Vault</h1><p>${status.entryCount} stored values for this project. Encrypted recovery is outside the project.</p><table><tr><th>Name</th><th>Type</th><th>Placeholder</th><th>Source</th></tr>${rows || '<tr><td colspan="4">No values stored.</td></tr>'}</table><p class="note">Values, fragments and value hashes are withheld. Verified SecretStorage API access does not certify OS custody or isolation from same-user software. Legacy unbound entries are retained encrypted and withheld from restoration.</p>`);
        } catch { void vscode.window.showErrorMessage("Protected vault metadata is unavailable. Existing ciphertext is preserved."); }
    };
    reg("soterai.migrateSecretsToVault", migrateSecretsToVault);
    reg("soterai.restoreSecretPlaceholders", restoreSecretPlaceholders);
    reg("soterai.restoreFileFromBackup", restoreFileFromBackup);
    reg("soterai.recoverVaultMigration", recoverVaultMigration);
    reg("soterai.openVaultStatus", openVaultStatus);
    reg("soterai.generateEnvExample", generateEnvExampleSafely);
}
