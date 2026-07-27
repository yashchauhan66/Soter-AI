import * as vscode from "vscode";
import { type FirewallDeps, activeFileUri } from "./shared";
import { VaultManager } from "./VaultManager";
import { LedgerStore } from "./LedgerStore";
import { PolicyStore } from "./PolicyStore";
import { escapeHtml, showInfoWebview, workspacePseudoId } from "./util";

export function registerVaultCommands(deps: FirewallDeps): void {
    const { context, refreshViews, vault, requireTrust } = deps;
    const reg = (id: string, handler: (...args: any[]) => any) =>
        context.subscriptions.push(vscode.commands.registerCommand(id, handler));

    const migrateSecretsToVault = async () => {
        if (!requireTrust("Secret vault migration")) return;
        const uri = activeFileUri();
        if (!uri) return void vscode.window.showErrorMessage("Open a .env-style file to migrate.");

        const preview = await vault.preview(uri);
        if (preview.candidates.length === 0) {
            return void vscode.window.showInformationMessage("No migratable secrets found in this file.");
        }
        const rows = preview.candidates
            .map((c) => `<tr><td><code>${escapeHtml(c.key)}</code></td><td>${escapeHtml(c.type)}</td><td><code>${escapeHtml(
                c.placeholder,
            )}</code></td><td>${escapeHtml(c.redactedPreview)}</td></tr>`)
            .join("");
        showInfoWebview(
            "soteraiVaultPreview",
            "SoterAI: Vault Migration Preview",
            `<h1>🔐 Migration preview — ${escapeHtml(preview.file)}</h1>
         <p>These secrets will be moved into the encrypted vault and replaced with placeholders. An encrypted backup is written to extension storage (outside the workspace) first.</p>
         <table><tr><th>Key</th><th>Type</th><th>Placeholder</th><th>Value (masked)</th></tr>${rows}</table>
         <p class="note">Raw values are shown masked only. They are stored encrypted outside the workspace; never in logs or reports.</p>`,
        );

        const confirm = await vscode.window.showWarningMessage(
            `Migrate ${preview.candidates.length} secret(s) from ${preview.file} into the protected vault? An encrypted backup (outside the workspace) will be created.`,
            { modal: true },
            "Migrate & Backup",
        );
        if (confirm !== "Migrate & Backup") return;

        const count = await vault.migrate(uri);
        await LedgerStore.append({
            eventId: `mig_${Date.now()}`,
            workspacePseudoId: await workspacePseudoId(),
            eventType: "vault_migrated",
            action: "redact",
            severity: "high",
            riskScore: 50,
            categories: ["secret"],
            filePaths: [preview.file],
            policyVersion: String((await PolicyStore.load()).version),
            redactedEvidencePreview: `${count} secret(s) vaulted`,
        });
        vscode.window.showInformationMessage(
            `Migrated ${count} secret(s) to the vault. Encrypted backup saved outside the workspace (SoterAI: Restore File From Backup to undo).`,
        );
        refreshViews();
    };

    const restoreSecretPlaceholders = async () => {
        if (!requireTrust("Vault restore")) return;
        const uri = activeFileUri();
        if (!uri) return void vscode.window.showErrorMessage("Open the file whose placeholders to restore.");
        const confirm = await vscode.window.showWarningMessage(
            "Restore raw secrets from the vault back into this file? An encrypted backup (outside the workspace) will be created.",
            { modal: true },
            "Restore & Backup",
        );
        if (confirm !== "Restore & Backup") return;
        const count = await vault.restore(uri);
        vscode.window.showInformationMessage(
            count > 0 ? `Restored ${count} secret(s) from the vault.` : "No matching placeholders found for this file.",
        );
    };

    const openVaultStatus = async () => {
        const status = await vault.status();
        const rows = status.entries
            .map((e) => `<tr><td><code>${escapeHtml(e.key)}</code></td><td>${escapeHtml(e.type)}</td><td><code>${escapeHtml(
                e.placeholder,
            )}</code></td><td><code>${escapeHtml(e.hash.slice(0, 12))}…</code></td><td>${escapeHtml(e.originalFile)}</td></tr>`)
            .join("");
        showInfoWebview(
            "soteraiVaultStatus",
            "SoterAI: Protected Vault Status",
            `<h1>🔐 Protected Vault</h1>
         <p>Encrypted store: <code>${escapeHtml(status.location)}</code> (outside the workspace). ${
             status.exists ? `${status.entryCount} entr${status.entryCount === 1 ? "y" : "ies"}.` : "Not yet created."
         }</p>
         <table><tr><th>Key</th><th>Type</th><th>Placeholder</th><th>Hash</th><th>Original file</th></tr>${
             rows || `<tr><td colspan="5">Vault is empty.</td></tr>`
         }</table>
         <p class="note">Only hashes and metadata are shown — raw secret values are AES-256-GCM encrypted and never displayed.</p>`,
        );
    };

    const generateEnvExampleSafely = async () => {
        const uri = activeFileUri();
        if (!uri) return void vscode.window.showErrorMessage("Open a .env-style file first.");
        const exampleUri = await vault.writeEnvExample(uri);
        await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(exampleUri));
        vscode.window.showInformationMessage("Generated .env.example (no secret values).");
    };

    const restoreFileFromBackup = async () => {
        if (!requireTrust("Vault backup restore")) return;
        const uri = activeFileUri();
        if (!uri) return void vscode.window.showErrorMessage("Open the file to restore from its encrypted backup.");
        const confirm = await vscode.window.showWarningMessage(
            "Overwrite this file with its last encrypted SoterAI backup?",
            { modal: true },
            "Restore Backup",
        );
        if (confirm !== "Restore Backup") return;
        const ok = await vault.restoreFromBackup(uri);
        vscode.window.showInformationMessage(
            ok ? "File restored from encrypted backup." : "No encrypted backup found for this file.",
        );
    };

    reg("soterai.migrateSecretsToVault", migrateSecretsToVault);
    reg("soterai.restoreSecretPlaceholders", restoreSecretPlaceholders);
    reg("soterai.restoreFileFromBackup", restoreFileFromBackup);
    reg("soterai.openVaultStatus", openVaultStatus);
    reg("soterai.generateEnvExample", generateEnvExampleSafely);
}
