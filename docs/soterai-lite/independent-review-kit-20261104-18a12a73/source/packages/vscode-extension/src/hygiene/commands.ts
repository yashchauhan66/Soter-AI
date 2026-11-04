import * as vscode from "vscode";
import { HygieneController } from "./HygieneController";
import { HYGIENE_PROVIDERS } from "./HygieneAnalysis";
import { hygieneRotationChecklist, type HygieneRotationMode } from "./HygieneRotation";

/** Native owner flows only. Public command arguments are intentionally ignored. */
export function registerHygieneAssistant(context: vscode.ExtensionContext): HygieneController {
    const controller = new HygieneController(context); let pending = false, disposed = false;
    const available = () => !disposed && (controller.status() as { status: string }).status === "OWNER_REVIEW_REQUIRED";
    const metadata = async (value: unknown): Promise<void> => {
        if (!available()) return;
        const document = await vscode.workspace.openTextDocument({ content: JSON.stringify(value, null, 2), language: "json" });
        if (available()) await vscode.window.showTextDocument(document, { preview: true });
    };
    const reg = (id: string, work: () => Promise<unknown>) => context.subscriptions.push(vscode.commands.registerCommand(id, async () => {
        if (pending || !available()) return { status: "UNAVAILABLE" }; pending = true;
        try { return await work(); } catch { return { status: "UNAVAILABLE" }; } finally { pending = false; }
    }));
    const selected = async (action: "vault" | "restore" | "example") => {
        const choices = controller.selections();
        if (!choices.length) return { status: "REVIEW_FILES_FIRST" };
        const choice = await vscode.window.showQuickPick(choices, { title: "Review local hygiene finding", placeHolder: "Select a finding from the last reviewed saved-file analysis" });
        if (!available()) return { status: "UNAVAILABLE" };
        if (!choice || !choices.includes(choice)) return { status: "CANCELLED" };
        return action === "vault" ? controller.vaultFinding(choice.id) : action === "restore" ? controller.restoreFinding(choice.id) : controller.writeExample(choice.id);
    };
    reg("soterai.reviewWorkspaceHygiene", async () => { const result = await controller.reviewWorkspace(); await metadata(result); return result; });
    reg("soterai.reviewSelectedFileHygiene", async () => {
        const files = await vscode.window.showOpenDialog({ title: "Choose one saved project file for local hygiene review", canSelectMany: false, canSelectFiles: true, canSelectFolders: false, defaultUri: vscode.workspace.workspaceFolders?.[0]?.uri });
        if (!available()) return { status: "UNAVAILABLE" };
        if (!files || files.length !== 1) return { status: "CANCELLED" };
        const result = await controller.reviewFile(files[0]); await metadata(result); return result;
    });
    reg("soterai.reviewHygieneVault", () => selected("vault"));
    reg("soterai.generateHygieneEnvExample", () => selected("example"));
    reg("soterai.restoreHygieneVault", () => selected("restore"));
    reg("soterai.openHygieneExposureLedger", async () => { const result = await controller.exposures(); await metadata(result); return result; });
    reg("soterai.exportHygieneExposureLedger", () => controller.exportLedger());
    reg("soterai.openHygieneRotationChecklist", async () => {
        const providers = HYGIENE_PROVIDERS.map(provider => ({ label: provider, provider }));
        const choice = await vscode.window.showQuickPick(providers, { title: "Choose the credential provider", placeHolder: "Provider labels are heuristic; no credential is requested" });
        if (!available()) return { status: "UNAVAILABLE" };
        if (!choice || !providers.includes(choice)) return { status: "CANCELLED" };
        const modes: Array<{ label: string; mode: HygieneRotationMode }> = [{ label: "Routine replacement", mode: "routine" }, { label: "Suspected exposure", mode: "suspected-exposure" }];
        const mode = await vscode.window.showQuickPick(modes, { title: "Manual credential checklist", placeHolder: "This assistant performs no account or credential changes" });
        if (!available()) return { status: "UNAVAILABLE" };
        if (!mode || !modes.includes(mode)) return { status: "CANCELLED" };
        const result = hygieneRotationChecklist(choice.provider, mode.mode); await metadata(result); return result;
    });
    context.subscriptions.push(controller, new vscode.Disposable(() => { disposed = true; controller.dispose(); }),
        vscode.commands.registerCommand("soterai.hygieneStatus", () => controller.status()));
    return controller;
}
