import * as vscode from "vscode";

export const SAME_USER_CONSENT_LIMIT = "not agent-proof: an agent running as me could also change this";
/** Ordinary editor UX only; does not authenticate user presence or an agent principal. */
export async function confirmScopedChange(description: string): Promise<boolean> {
    if (!vscode.workspace.getConfiguration("soterai").get<boolean>("hardening.scopedConfirmation", true)) return false;
    const choice = await vscode.window.showWarningMessage(`${description}\n${SAME_USER_CONSENT_LIMIT}`, { modal: true }, "Confirm this change");
    return choice === "Confirm this change"
        && vscode.workspace.getConfiguration("soterai").get<boolean>("hardening.scopedConfirmation", true);
}
