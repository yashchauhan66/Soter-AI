import * as vscode from "vscode";
import { POLICY_PACKS, getPolicyPack, type PolicyPack } from "./PolicyPacks";
import { escapeHtml, showInfoWebview } from "../firewall/util";

const ACTIVE_PACK_KEY = "soterai.activePolicyPack";

export function registerPolicyPackCommands(context: vscode.ExtensionContext, refresh: () => void): void {
    const reg = (id: string, handler: (...args: any[]) => any) => context.subscriptions.push(vscode.commands.registerCommand(id, handler));

    reg("soterai.applyPolicyPack", async () => {
        const pick = await vscode.window.showQuickPick(
            POLICY_PACKS.map((p) => ({ label: p.name, detail: p.description, id: p.id })),
            { title: "Apply Policy Pack", placeHolder: "Select a policy pack" }
        );
        if (!pick) return;

        const pack = getPolicyPack(pick.id);
        if (!pack) return;

        await context.globalState.update(ACTIVE_PACK_KEY, pack.id);

        const config = vscode.workspace.getConfiguration("soterai");
        await config.update("policy.mode", pack.cloudEnabled ? "enterprise" : "local", vscode.ConfigurationTarget.Global);
        await config.update("cloud.enabled", pack.cloudEnabled, vscode.ConfigurationTarget.Global);

        refresh();
        vscode.window.showInformationMessage(`SoterAI Policy Pack "${pack.name}" applied.`);
    });

    reg("soterai.comparePolicyPacks", async () => {
        const picks = await vscode.window.showQuickPick(
            POLICY_PACKS.map((p) => ({ label: p.name, id: p.id, picked: false })),
            { title: "Compare Policy Packs", placeHolder: "Select two packs to compare", canPickMany: true }
        );
        if (!picks || picks.length < 2) return;

        const pack1 = getPolicyPack(picks[0].id);
        const pack2 = getPolicyPack(picks[1].id);
        if (!pack1 || !pack2) return;

        const rows = [
            "protectedPatterns", "terminalRules", "mcpRules", "brokerRules", "memoryRules"
        ].map((key) => {
            const v1 = (pack1 as any)[key];
            const v2 = (pack2 as any)[key];
            const a1 = Array.isArray(v1) ? v1.join(", ") : String(v1);
            const a2 = Array.isArray(v2) ? v2.join(", ") : String(v2);
            return `<tr><td>${escapeHtml(key)}</td><td>${escapeHtml(a1)}</td><td>${escapeHtml(a2)}</td></tr>`;
        }).join("");

        showInfoWebview("soteraiPolicyCompare", "SoterAI: Compare Policy Packs",
            `<h1>Compare: ${escapeHtml(pack1.name)} vs ${escapeHtml(pack2.name)}</h1>
            <table><tr><th>Setting</th><th>${escapeHtml(pack1.name)}</th><th>${escapeHtml(pack2.name)}</th></tr>${rows}</table>`
        );
    });

    reg("soterai.exportPolicy", async () => {
        const activeId = context.globalState.get<string>(ACTIVE_PACK_KEY);
        const pack = activeId ? getPolicyPack(activeId) : undefined;
        const exportData = {
            activePack: pack?.name ?? "None (default)",
            packs: POLICY_PACKS.map((p) => ({
                id: p.id,
                name: p.name,
                description: p.description,
                cloudEnabled: p.cloudEnabled,
                protectedPatterns: p.protectedPatterns,
                terminalRules: p.terminalRules,
                mcpRules: p.mcpRules,
                brokerRules: p.brokerRules,
                memoryRules: p.memoryRules,
                reportRetention: p.reportRetention,
                approvalBehavior: p.approvalBehavior,
            })),
        };
        const doc = await vscode.workspace.openTextDocument({ content: JSON.stringify(exportData, null, 2), language: "json" });
        await vscode.window.showTextDocument(doc);
    });
}
