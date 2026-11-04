import * as vscode from "vscode";
import { PolicyStore } from "../firewall/PolicyStore";
import { deriveProtectionState, type ProtectionRuntimeFacts, type ProtectionStateDescriptor } from "./ProtectionState";
import { SELF_EXTENSION_ID, censusAiTools, type AiToolCensus } from "./AiToolRegistry";
import type { BrokerManager } from "../broker/BrokerManager";
import type { AISentinel } from "../sentinel/AISentinel";
import type { WorkspaceGuard } from "../workspace-guard/WorkspaceGuard";
import { LOCKDOWN_STATE_KEY, type LockdownRecord } from "./LockdownState";

export interface ProtectionStateSnapshot {
    facts: ProtectionRuntimeFacts;
    descriptor: ProtectionStateDescriptor;
}

/**
 * Extension-host adapter for the pure ProtectionState reducer.
 *
 * This service deliberately does not treat an installed AI extension as
 * protected. Configuration text supplies no verified route count. Live broker
 * status supplies operational state only; selected-architecture verification
 * remains UNTESTED.
 */
export class ProtectionStateService {
    private snapshot: ProtectionStateSnapshot = {
        facts: {
            enabled: true,
            broker: "offline",
            workspaceTrusted: false,
            policy: "unavailable",
            safeModeEnabled: false,
            protectedWorkspaceEnabled: false,
            sentinelEnabled: false,
            mcpStrictModeEnabled: false,
            liveScanEnabled: true,
            protectedAiTools: 0,
            detectedAiTools: 0,
        },
        descriptor: deriveProtectionState({
            enabled: true,
            broker: "offline",
            workspaceTrusted: false,
            policy: "unavailable",
            safeModeEnabled: false,
            protectedWorkspaceEnabled: false,
            sentinelEnabled: false,
            mcpStrictModeEnabled: false,
            liveScanEnabled: true,
            protectedAiTools: 0,
            detectedAiTools: 0,
        }),
    };

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly deps: {
            brokerManager: BrokerManager;
            workspaceGuard: WorkspaceGuard;
            sentinel: AISentinel;
        },
    ) {}

    public get current(): ProtectionStateSnapshot { return this.snapshot; }

    public async refresh(): Promise<ProtectionStateSnapshot> {
        const config = vscode.workspace.getConfiguration("soterai");
        let broker: ProtectionRuntimeFacts["broker"] = "offline";
        let safeModeEnabled = false;
        try {
            const status = await this.deps.brokerManager.status();
            broker = status.state === "incompatible" ? "incompatible" : status.running && status.state === "healthy" ? "healthy" : status.state === "starting" ? "starting" : "offline";
            safeModeEnabled = config.get<boolean>("hardening.runtimeEvidence", true) && broker === "healthy" && status.safeMode?.enabled === true;
        } catch {
            broker = "error";
        }

        const census = this.censusAiTools();
        const detected = census.routable.length;
        const routed = 0; // No independently authenticated per-agent route observation exists.

        // A status read validates existing bytes without creating policy.
        const policyStatus = config.get<boolean>("hardening.runtimeEvidence", true) ? await PolicyStore.status() : "unavailable";

        const facts: ProtectionRuntimeFacts = {
            enabled: config.get<boolean>("protection.enabled", true),
            broker,
            workspaceTrusted: vscode.workspace.isTrusted,
            policy: policyStatus,
            safeModeEnabled,
            protectedWorkspaceEnabled: this.deps.workspaceGuard.isEnabled,
            sentinelEnabled: this.deps.sentinel.isEnabled,
            // The current MCPFirewall is not a mandatory gateway. Do not count
            // this toggle as a fully-enforcing required control.
            mcpStrictModeEnabled: false,
            liveScanEnabled: config.get<boolean>("liveScan.enabled", true),
            protectedAiTools: routed,
            routingEvidence: "unknown",
            detectedAiTools: detected,
            unmanagedAiTools: census.unmanaged.length,
            bypassDetected: false,
            lockdown: Boolean(this.context.globalState.get<LockdownRecord>(LOCKDOWN_STATE_KEY)?.active),
        };
        this.snapshot = { facts, descriptor: deriveProtectionState(facts) };
        return this.snapshot;
    }

    /**
     * Split the installed extensions into "SoterAI can route this" and "real AI
     * tool SoterAI cannot route".
     *
     * The classification itself lives in AiToolRegistry so it can be unit
     * tested without a host; this method only supplies the ids and SoterAI's
     * own id, so the product never counts itself as an unprotected AI tool.
     */
    public censusAiTools(): AiToolCensus {
        // The manifest is passed alongside the id because it is the extension
        // author's own declaration of whether their extension is an AI tool. On
        // a real 73-extension machine the id alone missed five (Verdent,
        // OpenCode, Qwen Code, NVIDIA NIM, an AI-declaring DB client) that their
        // manifests identify plainly.
        return censusAiTools(
            vscode.extensions.all.map((extension) => ({ id: extension.id, packageJSON: extension.packageJSON })),
            SELF_EXTENSION_ID,
        );
    }

}
