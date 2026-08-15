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
 * protected. A tool counts as protected only when a known workspace config
 * explicitly points at this manager's exact loopback broker URL. This is
 * configuration evidence, not network interception proof, and remains
 * labelled as verified routing rather than universal coverage.
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
        try {
            const status = await this.deps.brokerManager.status();
            broker = status.state === "incompatible" ? "incompatible" : status.running && status.state === "healthy" ? "healthy" : status.state === "starting" ? "starting" : "offline";
        } catch {
            broker = "error";
        }

        const safeMode = this.context.globalState.get<{ enabled?: boolean }>("soterai.safeMode");
        const census = this.censusAiTools();
        const detected = census.routable.length;
        const routed = await this.countVerifiedBrokerRoutes(detected);

        // Auto-create the default policy on first use so users never see a
        // "Policy unavailable" error simply because they haven't run a setup
        // wizard. The file is created silently; no notification is shown.
        // This matches the behaviour of tools like ESLint that write a default
        // config on first run rather than blocking with an error.
        const policyExists = await PolicyStore.exists();
        if (!policyExists && vscode.workspace.isTrusted && vscode.workspace.workspaceFolders?.length) {
            try { await PolicyStore.createDefault(); } catch { /* workspace may be read-only */ }
        }

        const facts: ProtectionRuntimeFacts = {
            enabled: config.get<boolean>("protection.enabled", true),
            broker,
            workspaceTrusted: vscode.workspace.isTrusted,
            policy: (policyExists || (await PolicyStore.exists())) ? "loaded" : "unavailable",
            safeModeEnabled: Boolean(safeMode?.enabled),
            protectedWorkspaceEnabled: this.deps.workspaceGuard.isEnabled,
            sentinelEnabled: this.deps.sentinel.isEnabled,
            // The current MCPFirewall is not a mandatory gateway. Do not count
            // this toggle as a fully-enforcing required control.
            mcpStrictModeEnabled: false,
            liveScanEnabled: config.get<boolean>("liveScan.enabled", true),
            protectedAiTools: routed,
            detectedAiTools: detected,
            unmanagedAiTools: census.unmanaged.length,
            bypassDetected: detected > routed,
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

    private async countVerifiedBrokerRoutes(routableCount: number): Promise<number> {
        const folder = vscode.workspace.workspaceFolders?.[0];
        if (!folder) return 0;
        const brokerUrls = [`${this.deps.brokerManager.url}/v1/ai/openai-compatible`, `${this.deps.brokerManager.url}/v1/ai/anthropic-compatible`];
        const candidates = [".continue/config.json", "continue/config.json", "config/openai.json", ".soterai/openai-client.json", ".env", ".env.local"];
        let count = 0;
        for (const relative of candidates) {
            try {
                const text = decodeUtf8(await vscode.workspace.fs.readFile(vscode.Uri.joinPath(folder.uri, relative)));
                if (brokerUrls.some((url) => text.includes(url))) count++;
            } catch {
                // Candidate is absent; no route evidence.
            }
        }
        // Several candidate paths can describe the same tool (.env and
        // .env.local both configure one client), so route evidence is capped by
        // the number of routable tools actually installed. Without the cap a
        // workspace with two brokered files would report more tools protected
        // than exist.
        return Math.min(count, routableCount);
    }
}

/** Decode small workspace configuration files without depending on DOM globals. */
function decodeUtf8(bytes: Uint8Array): string {
    let text = "";
    const chunkSize = 8192;
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
        text += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
    }
    return text;
}
