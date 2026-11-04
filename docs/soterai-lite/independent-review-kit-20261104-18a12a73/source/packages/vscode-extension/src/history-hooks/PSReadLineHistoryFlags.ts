import * as vscode from "vscode";

/** Repository scopes cannot enable this owner-profile write capability. */
export function psReadLineHistoryEnabled(): boolean {
    try {
        const inspected = vscode.workspace.getConfiguration("soterai").inspect<unknown>("lite.historyHooks.psReadLine");
        return (inspected?.globalValue === undefined ? inspected?.defaultValue ?? false : inspected.globalValue) === true;
    } catch { return false; }
}
