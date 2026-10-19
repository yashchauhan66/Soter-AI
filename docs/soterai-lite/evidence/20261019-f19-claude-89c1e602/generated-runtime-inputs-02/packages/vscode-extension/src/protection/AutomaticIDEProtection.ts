import * as vscode from "vscode";
import type { ProtectionController } from "./ProtectionController";
import type { ProtectionStateSnapshot } from "./ProtectionStateService";
import { reviewCoverageForSetup } from "../security/CoverageDisclosure";

export const AUTOMATIC_SETUP_STAGES = [
    { id: "controls", label: "Enable local controls" },
    { id: "routing", label: "Connect supported AI tools" },
    { id: "verification", label: "Check managed setup status" },
] as const;
export type SetupStage = typeof AUTOMATIC_SETUP_STAGES[number]["id"];
export type SetupStageStatus = "waiting" | "running" | "complete" | "attention" | "failed";
export interface SetupProgress { stage: SetupStage; status: SetupStageStatus }
/** Counts only: no config contents, credentials or file paths reach the panel. */
export interface RoutingSetupResult {
    status: "applied" | "unchanged" | "cancelled" | "unavailable" | "failed";
    changedConfigs: number;
    verifiedTools: number;
    failedTools: number;
    unsupportedConfigs: number;
}
export interface AutomaticSetupResult {
    status: "ready" | "attention" | "failed";
    summary: string;
    coverageState?: string;
    changedConfigs: number;
}

/** One entry point; config rewrites retain their combined review and backup. */
export class AutomaticIDEProtection {
    private pending?: Promise<AutomaticSetupResult>;
    constructor(private readonly deps: {
        controller: Pick<ProtectionController, "enableFullProtection" | "lockdown">;
        routeTools: () => Promise<RoutingSetupResult | undefined>;
        refresh: () => Promise<ProtectionStateSnapshot>;
    }) {}

    run(report: (progress: SetupProgress) => void = () => {}): Promise<AutomaticSetupResult> {
        // Serialize the command too: the palette and other views can invoke it.
        if (this.pending) return this.pending;
        this.pending = this.configure(report).finally(() => { this.pending = undefined; });
        return this.pending;
    }

    private async configure(report: (progress: SetupProgress) => void): Promise<AutomaticSetupResult> {
        if (!vscode.workspace.isTrusted) return { status: "attention", summary: "Review and trust this workspace before running automatic setup.", changedConfigs: 0 };
        if (!vscode.workspace.workspaceFolders?.length) return { status: "attention", summary: "Open a workspace folder before running automatic setup.", changedConfigs: 0 };
        if (this.deps.controller.lockdown.active) return { status: "attention", summary: "Emergency lockdown is active. Review the incident and unlock explicitly before setup.", changedConfigs: 0 };
        let stage: SetupStage = "controls";
        let changedConfigs = 0;
        try {
            if (!(await reviewCoverageForSetup())) return {
                status: "attention", summary: "Setup not started. Coverage disclosure was not accepted or is unavailable; no controls or settings were changed.", changedConfigs: 0,
            };
            report({ stage, status: "running" });
            await this.deps.controller.enableFullProtection();
            const config = vscode.workspace.getConfiguration("soterai");
            const startupScope = config.inspect("broker.autoStart");
            const startupTarget = startupScope?.workspaceFolderValue !== undefined ? vscode.ConfigurationTarget.WorkspaceFolder
                : startupScope?.workspaceValue !== undefined ? vscode.ConfigurationTarget.Workspace : vscode.ConfigurationTarget.Global;
            await config.update("broker.autoStart", true, startupTarget);
            if (vscode.workspace.getConfiguration("soterai").get("broker.autoStart") !== true) throw new Error("Auto-start setting was not enabled");
            report({ stage, status: "complete" });
            if (this.deps.controller.lockdown.active) throw new Error("Lockdown interrupted setup");
            stage = "routing";
            report({ stage, status: "running" });
            const routing = await this.deps.routeTools();
            changedConfigs = Number.isSafeInteger(routing?.changedConfigs) && routing!.changedConfigs >= 0 ? routing!.changedConfigs : 0;
            const routingReady = routing?.status === "applied" || routing?.status === "unchanged";
            const routingAttention = !routingReady || (routing?.failedTools ?? 0) > 0 || (routing?.unsupportedConfigs ?? 0) > 0;
            report({ stage, status: routingAttention ? "attention" : "complete" });
            stage = "verification";
            report({ stage, status: "running" });
            const snapshot = await this.deps.refresh();
            const facts = snapshot.facts;
            const controlsReady = !facts.lockdown && facts.enabled && facts.workspaceTrusted
                && facts.broker === "healthy" && facts.safeModeEnabled && facts.protectedWorkspaceEnabled
                && facts.sentinelEnabled && facts.liveScanEnabled && facts.policy === "loaded"
                && vscode.workspace.getConfiguration("soterai").get("mcpFirewall.strictMode") === true;
            if (!controlsReady) {
                report({ stage, status: "failed" });
                return { status: "failed", summary: "Setup is incomplete. Some controls did not remain active; review the current status and retry.", changedConfigs, coverageState: snapshot.descriptor.state };
            }
            const ready = !routingAttention && snapshot.descriptor.state === "FULLY_ENFORCED";
            report({ stage, status: ready ? "complete" : "attention" });
            const summary = routing?.status === "cancelled"
                ? "Local controls are enabled. AI routing changes were cancelled; review coverage before relying on them."
                : ready ? "Managed setup checks completed. Independent agent routing and selected-architecture guarantees remain UNTESTED; other tools' file and network access remains outside SoterAI."
                    : "Local controls are enabled. Agent routes are unverified or outside SoterAI; selected-architecture guarantees remain UNTESTED. Review coverage for the remaining work.";
            return { status: ready ? "ready" : "attention", summary, changedConfigs, coverageState: snapshot.descriptor.state };
        } catch {
            report({ stage, status: "failed" });
            return { status: "failed", summary: "Automatic setup did not finish. Completed changes remain in place; review status and retry. AI config changes can be undone with Restore AI Configs.", changedConfigs };
        }
    }
}
