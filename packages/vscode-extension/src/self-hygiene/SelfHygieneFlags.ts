import * as vscode from "vscode";

/** Repository scopes cannot enable an owner diagnostic sink. */
export function selfHygieneEnabled(): boolean {
    try {
        const value = vscode.workspace.getConfiguration("soterai").inspect<unknown>("lite.selfHygiene");
        return (value?.globalValue === undefined ? value?.defaultValue ?? false : value.globalValue) === true;
    } catch { return false; }
}
