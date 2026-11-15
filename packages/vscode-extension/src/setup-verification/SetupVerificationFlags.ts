import * as vscode from "vscode";
export function setupVerificationEnabled():boolean {
    try{const inspected=vscode.workspace.getConfiguration("soterai").inspect<boolean>("lite.setupVerification");if(!inspected)return false;
        const value=inspected.globalValue!==undefined?inspected.globalValue:inspected.defaultValue;return typeof value==="boolean"&&value;
    }catch{return false;}
}
