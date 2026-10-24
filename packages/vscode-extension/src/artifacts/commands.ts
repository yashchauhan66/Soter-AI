import * as vscode from "vscode";
import { ArtifactController } from "./ArtifactController";

export function registerArtifactScanner(context: vscode.ExtensionContext): ArtifactController {
    const controller = new ArtifactController(context); let pending = false, disposed = false;
    const available = () => !disposed && controller.status().status === "OWNER_REVIEW_REQUIRED";
    context.subscriptions.push(vscode.commands.registerCommand("soterai.artifactScannerStatus", () => controller.status()));
    context.subscriptions.push(vscode.commands.registerCommand("soterai.reviewArtifacts", async () => {
        if (pending || !available()) return { status: "UNAVAILABLE" }; pending = true;
        try {
            const result = await controller.review();
            if (result.status !== "ANALYZED" && result.status !== "PARTIAL") return result;
            if (!available() || !controller.current(result)) return { status: "UNAVAILABLE" };
            const document = await vscode.workspace.openTextDocument({ content: JSON.stringify(result, null, 2), language: "json" });
            if (!available() || !controller.current(result)) return { status: "UNAVAILABLE" };
            await vscode.window.showTextDocument(document, { preview: true });
            if (!available() || !controller.current(result)) return { status: "UNAVAILABLE" };
            return result;
        } catch { return { status: "UNAVAILABLE" }; } finally { pending = false; }
    }));
    context.subscriptions.push({ dispose() { disposed = true; controller.dispose(); } });
    return controller;
}
