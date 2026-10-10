import * as vscode from "vscode";
import type { BrokerManager } from "../broker/BrokerManager";
import type { AISentinel } from "../sentinel/AISentinel";
import type { WorkspaceGuard } from "../workspace-guard/WorkspaceGuard";
import type { ProtectionStateService, ProtectionStateSnapshot } from "./ProtectionStateService";
import { LOCKDOWN_STATE_KEY, type LockdownRecord } from "./LockdownState";
import { isManagedSetting } from "../enterprise/managedSettingsProbe";

export interface FullProtectionResult {
    snapshot: ProtectionStateSnapshot;
    completed: string[];
    limitations: string[];
}

/** Coordinates only controls SoterAI can actually configure and verify. */
export class ProtectionController {
    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly deps: {
            brokerManager: BrokerManager;
            workspaceGuard: WorkspaceGuard;
            sentinel: AISentinel;
            protectionState: ProtectionStateService;
            refreshViews: () => void;
        },
    ) {}

    get lockdown(): LockdownRecord {
        return this.context.globalState.get<LockdownRecord>(LOCKDOWN_STATE_KEY) ?? { active: false };
    }

    async enableFullProtection(): Promise<FullProtectionResult> {
        if (!vscode.workspace.isTrusted) throw new Error("Full Protection setup requires a trusted workspace");
        if (this.lockdown.active) throw new Error("Emergency Lockdown is active; unlock before enabling supported controls");

        const completed: string[] = [];
        const limitations: string[] = [];
        const config = vscode.workspace.getConfiguration("soterai");

        for (const key of ["protectedWorkspace.enabled", "sentinel.enabled"]) {
            if (config.get(key) === false && isManagedSetting(key)) throw new Error("An administrator has disabled a required control");
        }
        const enableSetting = async (key: string) => {
            const inspection = config.inspect(key);
            const target = inspection?.workspaceFolderValue !== undefined ? vscode.ConfigurationTarget.WorkspaceFolder
                : inspection?.workspaceValue !== undefined ? vscode.ConfigurationTarget.Workspace : vscode.ConfigurationTarget.Global;
            await config.update(key, true, target);
            if (vscode.workspace.getConfiguration("soterai").get(key) !== true) throw new Error("A required setting could not be enabled");
        };

        await enableSetting("protection.enabled");
        completed.push("central protection state enabled");

        const broker = await this.deps.brokerManager.start();
        if (!broker.running || broker.state !== "healthy") throw new Error(`Broker is not healthy (${broker.state})`);
        completed.push(`authenticated loopback broker healthy (${broker.version ?? "version unknown"})`);

        await this.deps.brokerManager.request("/v1/safe-mode/enable", { method: "POST", body: JSON.stringify({ level: "strict" }) });
        await this.context.globalState.update("soterai.safeMode", { enabled: true, level: "strict" });
        completed.push("Safe Mode strict enabled for brokered traffic");

        await this.deps.workspaceGuard.enable();
        completed.push("Protected Workspace filtering enabled for SoterAI-built context");

        await this.deps.sentinel.enable();
        completed.push("privacy-safe local Sentinel monitoring enabled");

        await enableSetting("liveScan.enabled");
        await enableSetting("mcpFirewall.strictMode");
        completed.push("local diagnostics and strict MCP config checks enabled");

        const test = await this.deps.brokerManager.request<{ decision: string; redacted?: boolean }>(
            "/v1/scan",
            { method: "POST", body: JSON.stringify({ content: "OPENAI_API_KEY=sk-proj-soterai-self-test-1234567890abcdefghijkl" }) },
        );
        if (!["block", "redact"].includes(test.decision) && !(test.decision === "allow" && test.redacted === true)) {
            throw new Error("Broker protection self-test did not redact or block the synthetic test value");
        }
        completed.push(`broker self-test passed (${test.decision})`);

        const snapshot = await this.deps.protectionState.refresh();
        if (snapshot.facts.detectedAiTools > snapshot.facts.protectedAiTools) {
            limitations.push(`${snapshot.facts.detectedAiTools - snapshot.facts.protectedAiTools} detected AI tool(s) lack verified broker routing`);
        }
        limitations.push("MCP strict mode scans/configures SoterAI-routed preflight only; it is not a universal MCP interceptor");
        limitations.push("Raw terminals and direct reads by other extensions/processes remain outside SoterAI enforcement");
        this.deps.refreshViews();
        return { snapshot, completed, limitations };
    }

    async engageLockdown(reason = "user initiated"): Promise<void> {
        const record: LockdownRecord = { active: true, activatedAt: new Date().toISOString(), reason };
        await this.context.globalState.update(LOCKDOWN_STATE_KEY, record);
        await this.context.globalState.update("soterai.safeMode", { enabled: false, level: "strict" });
        try { await this.deps.brokerManager.request("/v1/approvals/clear", { method: "POST" }); } catch { /* broker may already be unavailable */ }
        await this.deps.brokerManager.stop();
        this.deps.refreshViews();
    }

    async unlock(): Promise<void> {
        await this.context.globalState.update(LOCKDOWN_STATE_KEY, { active: false } satisfies LockdownRecord);
        this.deps.refreshViews();
    }
}
