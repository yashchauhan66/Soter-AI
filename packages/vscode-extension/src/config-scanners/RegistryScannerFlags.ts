import * as vscode from "vscode";
export function registryScannerEnabled(): boolean {
    try {
        const config = vscode.workspace.getConfiguration("soterai"), entry = config.inspect<boolean>("lite.configScanner.registry");
        return vscode.workspace.isTrusted === true && !vscode.env.remoteName
            && (entry ? entry.globalValue ?? entry.defaultValue ?? true : config.get("lite.configScanner.registry", true)) === true;
    } catch { return false; }
}
