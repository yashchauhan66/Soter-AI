import * as vscode from "vscode";
import path from "node:path";
import { RemovalCoordinator, type RemovalAction, type RemovalOwner } from "./RemovalCoordinator";
import { lifecycleRecoveryEnabled } from "./LifecycleFlags";

const NATIVE = Object.freeze({
    checkedPowerShell: "soterai.restoreCheckedPowerShell",
    checkedCmd: "soterai.restoreCheckedCmd",
    checkedGitBash: "soterai.restoreCheckedGitBash",
    secureEditorAssociation: "soterai.undoSecureEditorAssociation",
    codexCli: "soterai.restorePinnedCodexCli",
    codexIde: "soterai.restorePinnedCodexIde",
    geminiCli: "soterai.restorePinnedGeminiCli",
    preCommit: "soterai.restorePreCommitGuard",
    prePush: "soterai.restorePrePushGuard",
    psReadLine: "soterai.restorePSReadLineHistoryGuard",
});
const LABELS: Readonly<Record<RemovalAction, string>> = Object.freeze({
    checkedPowerShell: "PowerShell terminal profile", checkedCmd: "Command Prompt terminal profile",
    checkedGitBash: "Git Bash terminal profile", secureEditorAssociation: "Secure editor associations",
    codexCli: "Codex CLI dedicated profile", codexIde: "Codex IDE dedicated profile",
    geminiCli: "Gemini CLI dedicated profile", preCommit: "Pre-commit hook", prePush: "Pre-push hook",
    psReadLine: "PSReadLine history integration", cline: "Cline configuration (manual recovery)",
    claude: "Claude configuration (manual recovery)", legacyBroker: "Earlier broker configuration (manual recovery)",
    legacyAIConfigs: "Earlier AI configuration backups (manual recovery)",
});
export interface LifecycleRecoveryServices {
    probe(id: RemovalAction, owner: RemovalOwner): Promise<unknown>;
    stopBroker(): Promise<unknown>;
}

/** Only delegates to existing native transactions; never reads or restores backup contents. */
export function registerLifecycleRecovery(context: vscode.ExtensionContext, services: LifecycleRecoveryServices): vscode.Disposable {
    let disposed = false, revision = 0;
    const subscriptions: vscode.Disposable[] = [];
    const owner = (): RemovalOwner | undefined => {
        try {
            if (disposed || vscode.env.remoteName || !vscode.workspace.isTrusted) return;
            if (!lifecycleRecoveryEnabled()) return;
            const folders = vscode.workspace.workspaceFolders;
            if (folders?.length !== 1) return;
            const uri = folders[0].uri;
            if (!(uri instanceof vscode.Uri) || uri.scheme !== "file" || uri.authority || uri.query || uri.fragment) return;
            const value = uri.fsPath;
            if (!/^[a-z]:\\/i.test(value) || /[\x00-\x1f\x7f]/.test(value)
                || value.split(/[\\/]/).some(part => part === "." || part === "..")
                || path.win32.normalize(value).toLowerCase() !== value.toLowerCase()
                || vscode.Uri.file(value).path.toLowerCase() !== uri.path.toLowerCase()) return;
            return Object.freeze({ root: uri.toString(), local: true, trusted: true, revision });
        } catch { return; }
    };
    const coordinator = new RemovalCoordinator({
        owner,
        probe: (id, captured) => services.probe(id, captured),
        async confirmSummary(items) {
            const detail = items.map(row => `${LABELS[row.id]}: ${row.status}`).join("\n");
            return await vscode.window.showWarningMessage(
                "Review SoterAI changes before removal",
                { modal: true, detail: `${detail}\n\nEach supported change still requires its own native review. Policy, vault values and encrypted backups are retained. Manual or unknown recovery stays pending. Unrecorded earlier changes require manual review.` },
                "Review restoration",
            ) === "Review restoration";
        },
        async restore(id) {
            if (!Object.hasOwn(NATIVE, id)) return;
            return vscode.commands.executeCommand(NATIVE[id as keyof typeof NATIVE]);
        },
        stopBroker: () => services.stopBroker(),
    });
    const invalidate = () => { revision++; };
    subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(event => { if (event.affectsConfiguration("soterai")) invalidate(); }),
        vscode.workspace.onDidChangeWorkspaceFolders(invalidate),
        vscode.workspace.onDidGrantWorkspaceTrust(invalidate),
        vscode.commands.registerCommand("soterai.restoreChangesBeforeRemoval", async (..._ignored: unknown[]) => {
            const result = await coordinator.run();
            if (!disposed && result.status !== "BUSY") {
                const pending = result.actions.filter(row => row.status === "PENDING" || row.status === "MANUAL_RECOVERY").length;
                const message = result.status === "COMPLETE"
                    ? "Recorded SoterAI changes restored; the owned broker has stopped. Policy, vault values and encrypted backups remain. Review any unrecorded earlier changes before uninstalling."
                    : `Removal review ${result.status.toLowerCase()}. ${pending} recorded routes need review; retained recovery and protection settings were preserved. Keep SoterAI installed until recovery is resolved.`;
                try { void vscode.window.showInformationMessage(message).then(undefined, () => undefined); } catch { /* Fixed report remains authoritative. */ }
            }
            return result;
        }),
    );
    const registration = new vscode.Disposable(() => {
        if (disposed) return;
        disposed = true; invalidate(); coordinator.dispose();
        subscriptions.splice(0).forEach(item => item.dispose());
    });
    context.subscriptions.push(registration);
    return registration;
}
