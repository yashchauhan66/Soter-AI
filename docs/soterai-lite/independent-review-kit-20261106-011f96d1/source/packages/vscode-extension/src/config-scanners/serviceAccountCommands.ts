import * as vscode from "vscode";
import { HygieneController } from "../hygiene/HygieneController";

/** Native owner decisions only; no public command argument grants authority. */
export function registerServiceAccountScanner(context: vscode.ExtensionContext): HygieneController {
    const controller = new HygieneController(context, { family: "serviceAccount" }); let pending = false, disposed = false;
    const available = () => !disposed && (controller.status() as { status: string }).status === "OWNER_REVIEW_REQUIRED";
    const metadata = async (value: unknown) => {
        if (!available()) return; const document = await vscode.workspace.openTextDocument({ content: JSON.stringify(value, null, 2), language: "json" });
        if (available()) await vscode.window.showTextDocument(document, { preview: true });
    };
    const reg = (id: string, work: () => Promise<unknown>) => context.subscriptions.push(vscode.commands.registerCommand(id, async () => {
        if (pending || !available()) return { status: "UNAVAILABLE" }; pending = true;
        try { return await work(); } catch { return { status: "UNAVAILABLE" }; } finally { pending = false; }
    }));
    const selected = async (restore: boolean) => {
        const choices = controller.selections(); if (!choices.length) return { status: "REVIEW_FILES_FIRST" };
        const choice = await vscode.window.showQuickPick(choices, { title: restore ? "Restore reviewed service-account JSON values" : "Review service-account JSON vault migration", placeHolder: "Choose a finding from the last review; disclosure restores the entire original file" });
        if (!available()) return { status: "UNAVAILABLE" }; if (!choice || !choices.includes(choice)) return { status: "CANCELLED" };
        return restore ? controller.restoreFinding(choice.id) : controller.vaultFinding(choice.id);
    };
    reg("soterai.reviewWorkspaceServiceAccountSecrets", async () => { const result = await controller.reviewWorkspace(); await metadata(result); return result; });
    reg("soterai.reviewServiceAccountSecrets", async () => {
        const files = await vscode.window.showOpenDialog({ title: "Choose one saved Service-account JSON file for local review", canSelectMany: false, canSelectFiles: true, canSelectFolders: false,
            defaultUri: vscode.workspace.workspaceFolders?.[0]?.uri, filters: { "Service-account JSON": ["json"], "All files": ["*"] } });
        if (!available()) return { status: "UNAVAILABLE" }; if (!files || files.length !== 1) return { status: "CANCELLED" };
        const result = await controller.reviewFile(files[0]); await metadata(result); return result;
    });
    reg("soterai.reviewServiceAccountSecretVault", () => selected(false));
    reg("soterai.restoreServiceAccountSecretVault", () => selected(true));
    context.subscriptions.push(controller, new vscode.Disposable(() => { disposed = true; controller.dispose(); }),
        vscode.commands.registerCommand("soterai.serviceAccountSecretScannerStatus", () => controller.status()));
    return controller;
}
