import * as vscode from "vscode";

export function preCommitHooksEnabled(): boolean {
    try {
        const entry = vscode.workspace.getConfiguration("soterai").inspect<boolean>("lite.historyHooks.preCommit");
        const value = entry?.globalValue !== undefined ? entry.globalValue : entry?.defaultValue;
        return vscode.workspace.isTrusted === true && !vscode.env.remoteName && value === true;
    } catch { return false; }
}
