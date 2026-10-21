import * as vscode from "vscode";
export function terraformScannerEnabled(): boolean {
    try {
        const config = vscode.workspace.getConfiguration("soterai"), entry = config.inspect<boolean>("lite.configScanner.terraform");
        return vscode.workspace.isTrusted === true && !vscode.env.remoteName
            && (entry ? entry.globalValue ?? entry.defaultValue ?? true : config.get("lite.configScanner.terraform", true)) === true;
    } catch { return false; }
}
