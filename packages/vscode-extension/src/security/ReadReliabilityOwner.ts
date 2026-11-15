import * as vscode from "vscode";
import { ReadReliability, installReadReliabilityOwner } from "./ReadReliability";

export function reliabilityEnabled(): boolean {
    try {
        const value = vscode.workspace.getConfiguration("soterai").inspect<unknown>("lite.reliability");
        return (value?.globalValue === undefined ? value?.defaultValue ?? true : value.globalValue) === true;
    } catch { return false; }
}
/** One owner per extension host. Disable/teardown never restores a weaker reader. */
export function registerReadReliability(context: vscode.ExtensionContext) {
    const owner = new ReadReliability({ enabled: () => reliabilityEnabled() && vscode.workspace.isTrusted && !vscode.env.remoteName });
    installReadReliabilityOwner(owner);
    const started = owner.startupClock(); let finished = false;
    const status = () => Object.freeze({ ...owner.status(), scope: "Checked shared managed file reads only. Cooperative routes; portable path APIs cannot eliminate every filesystem race.",
        message: owner.status().status === "READY" ? "Managed reader checks are available."
            : "Managed reads are withheld. Check the owner reliability setting, workspace trust and available resources; reload this isolated window after a startup or handle-closure failure." });
    context.subscriptions.push({ dispose: () => owner.dispose() },
        vscode.workspace.onDidChangeConfiguration(event => { if (event.affectsConfiguration("soterai")) owner.withdraw(); }),
        vscode.workspace.onDidChangeWorkspaceFolders(() => owner.withdraw()),
        vscode.commands.registerCommand("soterai.readReliabilityStatus", () => status()));
    return Object.freeze({ status, finishStartup: () => { if (!finished) { finished = true; owner.finishStartup(started); } } });
}
