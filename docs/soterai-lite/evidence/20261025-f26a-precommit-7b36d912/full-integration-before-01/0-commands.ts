import * as vscode from "vscode";
import { PreCommitController } from "./PreCommitController";
import { preCommitHooksEnabled } from "./PreCommitFlags";

export function registerPreCommitHooks(context: vscode.ExtensionContext): PreCommitController {
    const controller = new PreCommitController(context); let pending = false, disposed = false;
    const denied = () => Object.freeze({ status: "UNAVAILABLE" as const });
    const command = (name: string, method: "install" | "resume" | "restore") => context.subscriptions.push(vscode.commands.registerCommand("soterai." + name, async () => {
        if (disposed || pending || (method !== "restore" && !preCommitHooksEnabled())) return denied();
        pending = true;
        try {
            const result = await controller[method]();
            if (disposed || (["APPLIED", "RESUMED", "RESTORED"].includes(result.status) && !controller.current(result))) return denied();
            return result;
        } catch { return denied(); } finally { pending = false; }
    }));
    command("installPreCommitGuard", "install"); command("resumePreCommitGuard", "resume"); command("restorePreCommitGuard", "restore");
    command("installGitSecretHook", "install");
    context.subscriptions.push(vscode.commands.registerCommand("soterai.preCommitGuardStatus", () => controller.status()));
    context.subscriptions.push(vscode.commands.registerCommand("soterai.copyPreCommitHookScript", async () => {
        if (!disposed) try { await vscode.window.showInformationMessage("Use the owning editor's reviewed pre-commit install or restore command. A standalone copied script cannot provide live owner authority."); } catch { /* fixed result */ }
        return denied();
    }));
    context.subscriptions.push({ dispose() { disposed = true; controller.dispose(); } });
    return controller;
}
