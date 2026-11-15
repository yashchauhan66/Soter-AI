import * as vscode from "vscode";
import { PreCommitController } from "./PreCommitController";
import { preCommitHooksEnabled } from "./PreCommitFlags";

export function registerPreCommitHooks(context: vscode.ExtensionContext): PreCommitController {
    const controller = new PreCommitController(context); let pending = false, disposed = false;
    const denied = () => Object.freeze({ status: "UNAVAILABLE" as const });
    // A released Lite capability can withdraw new grants while leaving reviewed
    // recovery callable. Caller arguments and the machine flag cannot undo it.
    const releaseExcluded = (): boolean => {
        try {
            const excluded: unknown = context.extension?.packageJSON?.soteraiLiteRelease?.unsupportedFeatures;
            return excluded !== undefined && (!Array.isArray(excluded) || excluded.includes("preCommit"));
        } catch { return true; }
    };
    const reg = (id: string, method: "install" | "resume" | "restore") => context.subscriptions.push(vscode.commands.registerCommand(id, async () => {
        if (disposed || pending || (method !== "restore" && (releaseExcluded() || !preCommitHooksEnabled()))) return denied();
        pending = true;
        try {
            const result = await controller[method]();
            if (disposed || (["APPLIED", "RESUMED", "RESTORED"].includes(result.status) && !controller.current(result))) return denied();
            return result;
        } catch { return denied(); } finally { pending = false; }
    }));
    reg("soterai.installPreCommitGuard", "install"); reg("soterai.resumePreCommitGuard", "resume"); reg("soterai.restorePreCommitGuard", "restore");
    reg("soterai.installGitSecretHook", "install");
    context.subscriptions.push(vscode.commands.registerCommand("soterai.preCommitGuardStatus", () => controller.status()));
    context.subscriptions.push(vscode.commands.registerCommand("soterai.copyPreCommitHookScript", async () => {
        if (!disposed) try { await vscode.window.showInformationMessage("Use the owning editor's reviewed pre-commit install or restore command. A standalone copied script cannot provide live owner authority."); } catch { /* fixed result */ }
        return denied();
    }));
    context.subscriptions.push({ dispose() { disposed = true; controller.dispose(); } });
    return controller;
}
