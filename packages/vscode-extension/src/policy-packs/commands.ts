import * as vscode from "vscode";
import { POLICY_PACKS, getPolicyPack, type PolicyPack } from "./PolicyPacks";
import { escapeHtml, showInfoWebview } from "../firewall/util";

const ACTIVE_PACK_KEY = "soterai.activePolicyPack";

function enterprisePolicyBundle(pack: PolicyPack | undefined) {
    const selected = pack ?? getPolicyPack("enterprise-strict") ?? POLICY_PACKS[0];
    return {
        schemaVersion: "soterai.enterprise-policy.v1",
        generatedAt: new Date().toISOString(),
        activePack: {
            id: selected.id,
            name: selected.name,
            description: selected.description,
        },
        enforcementModel: {
            brokeredAiTraffic: "enforced",
            soteraiBuiltContext: "redacted",
            clipboardSafePaste: "redacted_when_routed_through_soterai",
            rawCopilotOrThirdPartyExtensionTraffic: "monitored_not_enforced",
            rawTerminalAndOsProcesses: "review_only_unless_controlled_terminal_or_brokered",
            mcpRuntimeCalls: "enforced_only_when_routed_through_soterai_mcp_gateway",
        },
        requiredControls: {
            broker: {
                loopbackOnly: true,
                bearerAuthRequired: true,
                requestResponseScanRequired: true,
                canaryBlockingRequired: true,
                memoryExportRedactedOnly: true,
            },
            mcp: {
                scanConfigOnOpen: true,
                blockShellToolsByDefault: selected.mcpRules.includes("block_shell"),
                blockUnknownServers: selected.mcpRules.includes("block_unknown"),
                requireApprovalForHighRiskTools: selected.mcpRules.includes("require_approval"),
                validateSchemas: selected.mcpRules.includes("validate_schemas"),
                secretEnvValuesNeverDisplayed: true,
            },
            terminal: {
                rawTerminalWarning: true,
                controlledTerminalForEnforcement: true,
                rules: selected.terminalRules,
            },
            data: {
                protectedPatterns: selected.protectedPatterns,
                secretsLeaveMachineByDefault: false,
                rawFilesLeaveMachineByDefault: false,
                telemetryDefault: "off_or_redacted_metadata_only",
            },
            approvals: {
                behavior: selected.approvalBehavior,
                scopeBound: true,
                expiryRequired: true,
                rawRevealDisabledByDefault: true,
            },
            audit: {
                retention: selected.reportRetention,
                rawSecretLogging: false,
                redactedEvidenceOnly: true,
            },
        },
        policyPacks: POLICY_PACKS.map((p) => ({
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
        limitations: [
            "SoterAI cannot intercept arbitrary VS Code extension traffic unless that tool routes through SoterAI.",
            "SoterAI cannot OS-block raw terminal or process egress without an external OS/container enforcement layer.",
            "MCP config deny-lists are advisory unless the runtime call is routed through SoterAI MCP Gateway or the external MCP host enforces the generated policy.",
            "This policy is not a compliance certification or replacement for enterprise endpoint controls.",
        ],
    };
}

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
        const exportData = enterprisePolicyBundle(pack);
        const doc = await vscode.workspace.openTextDocument({ content: JSON.stringify(exportData, null, 2), language: "json" });
        await vscode.window.showTextDocument(doc);
    });
}
