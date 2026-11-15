import * as vscode from "vscode";
import { scanDirectory } from "../../../soterai-cli/src/ci/scan";
import { protectionCenterEnabled } from "../protection-center/ProtectionCenterFlags";
import { ProjectJourney, JOURNEY_TOOLS } from "./ProjectJourney";
import { detectProjectProfile } from "./ProjectProfile";
import { toolReadiness } from "./ToolReadiness";

export function registerProjectJourney(context: vscode.ExtensionContext): void {
    let disposed = false, open = false, revision = 0;
    const root = () => {
        const folders = vscode.workspace.workspaceFolders;
        return !disposed && protectionCenterEnabled() && vscode.workspace.isTrusted && !vscode.env.remoteName && process.platform === "win32"
            && folders?.length === 1 && folders[0].uri.scheme === "file" ? folders[0] : undefined;
    };
    const journey = new ProjectJourney({
        binding: () => { const folder = root(); return folder ? `${folder.uri.toString()}:${revision}:${context.extension.packageJSON.version}` : undefined; },
        execute: command => Promise.resolve(vscode.commands.executeCommand(command)),
        chooseTool: async () => {
            const choices = JOURNEY_TOOLS.map(tool => ({ label: tool.label, tool, detail: toolReadiness(tool.label, id => vscode.extensions.getExtension(id)?.packageJSON?.version) }));
            const choice = await vscode.window.showQuickPick(choices, { title: "Connect an AI tool", matchOnDetail: true, placeHolder: "Review version compatibility, then the exact proposed configuration changes" });
            return choice && choices.includes(choice) ? choice.tool : undefined;
        },
        scan: async () => {
            const folder = root(); if (!folder) throw Error();
            const captured = revision;
            const result = await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: "Checking saved project files locally", cancellable: true },
                async (_progress, token) => {
                    const abort = new AbortController(), listener = token.onCancellationRequested(() => abort.abort());
                    if (token.isCancellationRequested) abort.abort();
                    try { const report = await scanDirectory(folder.uri.fsPath, {}, [], { signal: abort.signal }); if (abort.signal.aborted) throw new DOMException("Cancelled", "AbortError"); return report; }
                    finally { listener.dispose(); }
                });
            if (!root() || captured !== revision) throw Error();
            if (result.status === "incomplete") {
                const reasons = new Set(result.diagnostics.map(item => item.code));
                const message = reasons.has("BYTE_LIMIT") ? "Some files exceed the supported scan size. Review those files separately; this scan is incomplete."
                    : reasons.has("UNSUPPORTED_CONTENT") ? "Some files use an unsupported format. Review generated artifacts separately; this scan is incomplete."
                    : "The saved-file scan did not finish. Review access, cancellation and scan limits, then retry.";
                void vscode.window.showInformationMessage(message);
            }
            return result;
        },
    });
    const invalidate = () => { revision++; journey.invalidate(); };
    context.subscriptions.push(vscode.commands.registerCommand("soterai.openProjectJourney", async (...args: unknown[]) => {
        if (args.length || open) return { status: "UNAVAILABLE" };
        if (!root()) { void vscode.window.showInformationMessage("Open one trusted local Windows project and enable the Protection Center to start guided setup."); return { status: "UNAVAILABLE" }; }
        open = true;
        try {
            while (root()) {
                const captured = revision, folder = root()!, profile = await detectProjectProfile(folder.uri.fsPath);
                if (!root() || revision !== captured) continue;
                const rows = journey.rows(), next = journey.recommended();
                const choices = [...rows.filter(row => row.id === next), ...rows.filter(row => row.id !== next)];
                const selected = await vscode.window.showQuickPick(choices, { title: `${profile.label}: guided protection setup`, matchOnDescription: true, matchOnDetail: true,
                    placeHolder: `${profile.incomplete ? "Project detection incomplete." : `${profile.environmentFiles} known env file(s).`} ${profile.node ? "Node app workflow available." : "App runtime supports Node entrypoints."} Escape closes setup.` });
                if (!selected) return { status: "CANCELLED" };
                if (!choices.includes(selected) || !root() || captured !== revision) return { status: "UNAVAILABLE" };
                const result = await journey.run(selected.id);
                if (result.status === "SELECTION_REQUIRED") return result;
                if (result.status === "UNAVAILABLE" && root()) void vscode.window.showInformationMessage("This step is unavailable or the project changed. Review its setup and retry.");
            }
            return { status: "UNAVAILABLE" };
        } catch { return { status: "INCOMPLETE" }; }
        finally { open = false; }
    }), vscode.workspace.onDidChangeWorkspaceFolders(invalidate), vscode.workspace.onDidChangeConfiguration(event => { if (event.affectsConfiguration("soterai")) invalidate(); }),
        { dispose() { disposed = true; journey.dispose(); } });
    if (vscode.workspace.onDidSaveTextDocument) context.subscriptions.push(vscode.workspace.onDidSaveTextDocument(invalidate));
}
