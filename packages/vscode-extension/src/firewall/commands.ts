import * as vscode from "vscode";
import { VaultManager } from "./VaultManager";
import { CanaryManager } from "./CanaryManager";
import { registerPolicyCommands } from "./policy-commands";
import { registerVaultCommands } from "./vault-commands";
import { registerContextCommands } from "./context-commands";
import { registerLedgerCommands } from "./ledger-commands";
import { registerOutputCommands } from "./output-commands";
import { registerCanaryCommands } from "./canary-commands";

// Re-export readContextApproval so extension.ts can still import from this module.
export { readContextApproval } from "./shared";

/** Register every AI Context Firewall command. */
export function registerFirewallCommands(context: vscode.ExtensionContext, refreshViews: () => void): void {
    const vault = new VaultManager(context);
    const canary = new CanaryManager(context);

    const requireTrust = (feature: string): boolean => {
        if (!vscode.workspace.isTrusted) {
            vscode.window.showWarningMessage(
                `${feature} is disabled in restricted (untrusted) workspaces. Trust this workspace to use it.`,
            );
            return false;
        }
        return true;
    };

    const deps = { context, refreshViews, vault, canary, requireTrust };

    registerPolicyCommands(deps);
    registerVaultCommands(deps);
    registerContextCommands(deps);
    registerLedgerCommands(deps);
    registerOutputCommands(deps);
    registerCanaryCommands(deps);
}
