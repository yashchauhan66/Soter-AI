import * as vscode from "vscode";

export function historyScannerEnabled(): boolean {
    try {
        const entry = vscode.workspace.getConfiguration("soterai").inspect<boolean>("lite.historyScanner");
        const value = entry?.globalValue !== undefined ? entry.globalValue : entry?.defaultValue !== undefined ? entry.defaultValue : true;
        return vscode.workspace.isTrusted === true && !vscode.env.remoteName && value === true;
    } catch { return false; }
}
