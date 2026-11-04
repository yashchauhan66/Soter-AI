import * as vscode from "vscode";
export function hygieneAssistantEnabled(): boolean {
    try { const config = vscode.workspace.getConfiguration("soterai"), entry = config.inspect<boolean>("lite.hygieneAssistant");
        return vscode.workspace.isTrusted === true && !vscode.env.remoteName
            && (entry ? entry.globalValue ?? entry.defaultValue ?? true : config.get("lite.hygieneAssistant", true)) === true;
    } catch { return false; }
}
