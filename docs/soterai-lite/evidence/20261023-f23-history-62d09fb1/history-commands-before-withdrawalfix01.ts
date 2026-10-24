import * as vscode from "vscode";
import { HistoryController } from "./HistoryController";

export function registerHistoryScanner(context: vscode.ExtensionContext): HistoryController {
    const controller = new HistoryController(context); let pending = false, disposed = false;
    const available = () => !disposed && controller.status().status === "OWNER_REVIEW_REQUIRED";
    context.subscriptions.push(vscode.commands.registerCommand("soterai.historyScannerStatus", () => controller.status()));
    context.subscriptions.push(vscode.commands.registerCommand("soterai.reviewGitHistory", async () => {
        if (pending || !available()) return { status: "UNAVAILABLE" }; pending = true;
        try {
            const result = await controller.review();
            if (available() && controller.current(result)) {
                const document = await vscode.workspace.openTextDocument({ content: JSON.stringify(result, null, 2), language: "json" });
                if (available() && controller.current(result)) await vscode.window.showTextDocument(document, { preview: true });
            }
            return result;
        } catch { return { status: "UNAVAILABLE" }; } finally { pending = false; }
    }));
    context.subscriptions.push({ dispose() { disposed = true; controller.dispose(); } });
    return controller;
}
