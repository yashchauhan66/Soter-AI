import * as vscode from "vscode";
import { PrePushController } from "./PrePushController";
import { prePushHooksEnabled } from "./PrePushFlags";

/** Four owning-editor commands; caller arguments never confer authority. */
export function registerPrePushHooks(context: vscode.ExtensionContext): PrePushController {
    const controller = new PrePushController(context); let pending = false, disposed = false;
    const denied = () => Object.freeze({ status: "UNAVAILABLE" as const });
    const reg = (id: string, method: "install" | "resume" | "restore") => context.subscriptions.push(vscode.commands.registerCommand(id, async () => {
        if (disposed || pending || (method !== "restore" && !prePushHooksEnabled())) return denied();
        pending = true;
        try {
            const value = await controller[method]();
            if (disposed || (["APPLIED", "RESUMED", "RESTORED"].includes(value.status) && !controller.current(value))) return denied();
            return value;
        } catch { return denied(); } finally { pending = false; }
    }));
    reg("soterai.installPrePushGuard", "install");
    reg("soterai.resumePrePushGuard", "resume");
    reg("soterai.restorePrePushGuard", "restore");
    context.subscriptions.push(vscode.commands.registerCommand("soterai.prePushGuardStatus", () => controller.status()));
    context.subscriptions.push({ dispose() { disposed = true; controller.dispose(); } });
    return controller;
}
