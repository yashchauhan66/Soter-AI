import * as vscode from "vscode";
import { VaultManager } from "./VaultManager";
import { CanaryManager } from "./CanaryManager";

export const APPROVAL_STATE_ID = "soterai.contextApproval";

export interface ApprovalSession {
    id: string;
    expiresAt: number;
}

/** Active editor file uri, or undefined. */
export function activeFileUri(): vscode.Uri | undefined {
    return vscode.window.activeTextEditor?.document.uri;
}

/** Read the active context-approval session, expiring it if past its window. */
export async function readContextApproval(
    context: vscode.ExtensionContext,
): Promise<ApprovalSession | undefined> {
    const s = context.globalState.get<ApprovalSession>(APPROVAL_STATE_ID);
    if (!s) return undefined;
    if (Date.now() > s.expiresAt) {
        await context.globalState.update(APPROVAL_STATE_ID, undefined);
        return undefined;
    }
    return s;
}

/** Shared dependencies for all firewall command modules. */
export interface FirewallDeps {
    context: vscode.ExtensionContext;
    refreshViews: () => void;
    vault: VaultManager;
    canary: CanaryManager;
    requireTrust: (feature: string) => boolean;
}
