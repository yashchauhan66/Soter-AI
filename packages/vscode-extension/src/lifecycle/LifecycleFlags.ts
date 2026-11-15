import * as vscode from "vscode";

export function lifecycleRecoveryEnabled(): boolean {
    try {
        const setting = vscode.workspace.getConfiguration("soterai").inspect<boolean>("lite.lifecycleRecovery");
        return (setting?.globalValue ?? setting?.defaultValue ?? true) === true;
    } catch { return false; }
}
