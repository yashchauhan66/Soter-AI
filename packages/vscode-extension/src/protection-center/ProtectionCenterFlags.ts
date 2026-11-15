import * as vscode from "vscode";
/** Presentation only; repository settings cannot replace the owner's selection. */
export function protectionCenterEnabled(): boolean {
    try {
        const value = vscode.workspace.getConfiguration("soterai").inspect<unknown>("lite.protectionCenter");
        return (value?.globalValue !== undefined ? value.globalValue : value?.defaultValue !== undefined ? value.defaultValue : true) === true;
    } catch { return false; }
}
