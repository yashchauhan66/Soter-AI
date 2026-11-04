import * as vscode from "vscode";
import { PSReadLineHistoryController } from "./PSReadLineHistoryController";
import { psReadLineHistoryEnabled } from "./PSReadLineHistoryFlags";

/** No caller arguments provide paths, approvals, raw text or restore authority. */
export function registerPSReadLineHistory(context: vscode.ExtensionContext): PSReadLineHistoryController {
    const controller = new PSReadLineHistoryController(context); let pending = false, disposed = false;
    const denied = () => Object.freeze({ status: "UNAVAILABLE" as const });
    const reg = (id: string, method: "install" | "restore") => context.subscriptions.push(vscode.commands.registerCommand(id, async () => {
        if (disposed || pending || method === "install" && !psReadLineHistoryEnabled()) return denied();
        pending = true;
        try {
            const result = await controller[method]();
            if (disposed || method === "install" && !psReadLineHistoryEnabled() || !result
                || !["APPLIED", "RESTORED", "UNAVAILABLE", "INCOMPLETE", "CANCELLED"].includes(result.status)) return denied();
            return Object.freeze({ status: result.status });
        } catch { return denied(); } finally { pending = false; }
    }));
    reg("soterai.installPSReadLineHistoryGuard", "install"); reg("soterai.restorePSReadLineHistoryGuard", "restore");
    context.subscriptions.push(vscode.commands.registerCommand("soterai.psReadLineHistoryGuardStatus", () => controller.status()));
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(event => {
        if (event.affectsConfiguration("soterai")) controller.withdraw();
    }), vscode.workspace.onDidChangeWorkspaceFolders(() => controller.withdraw()), { dispose() { disposed = true; controller.dispose(); } });
    return controller;
}
