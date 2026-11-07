import * as vscode from "vscode";
export function serviceAccountScannerEnabled(): boolean {
    try {
        const config = vscode.workspace.getConfiguration("soterai"), entry = config.inspect<boolean>("lite.configScanner.serviceAccount");
        return vscode.workspace.isTrusted === true && !vscode.env.remoteName
            && (entry ? entry.globalValue ?? entry.defaultValue ?? true : config.get("lite.configScanner.serviceAccount", true)) === true;
    } catch { return false; }
}
