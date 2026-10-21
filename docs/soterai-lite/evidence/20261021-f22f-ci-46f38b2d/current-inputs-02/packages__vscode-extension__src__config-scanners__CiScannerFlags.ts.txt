import * as vscode from "vscode";
export function ciScannerEnabled(): boolean {
    try {
        const config = vscode.workspace.getConfiguration("soterai"), entry = config.inspect<boolean>("lite.configScanner.ci");
        return vscode.workspace.isTrusted === true && !vscode.env.remoteName
            && (entry ? entry.globalValue ?? entry.defaultValue ?? true : config.get("lite.configScanner.ci", true)) === true;
    } catch { return false; }
}
