import * as vscode from "vscode";
export function containerScannerEnabled(): boolean {
    try {
        const config = vscode.workspace.getConfiguration("soterai"), entry = config.inspect<boolean>("lite.configScanner.dockerKubernetes");
        return vscode.workspace.isTrusted === true && !vscode.env.remoteName
            && (entry ? entry.globalValue ?? entry.defaultValue ?? true : config.get("lite.configScanner.dockerKubernetes", true)) === true;
    } catch { return false; }
}
