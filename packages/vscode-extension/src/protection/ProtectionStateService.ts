import * as vscode from "vscode";
import { PolicyStore } from "../firewall/PolicyStore";
import { deriveProtectionState, type ProtectionRuntimeFacts, type ProtectionStateDescriptor } from "./ProtectionState";
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
        const detected = this.detectAiExtensions();
        const routed = await this.countVerifiedBrokerRoutes();
        const facts: ProtectionRuntimeFacts = {
            enabled: config.get<boolean>("protection.enabled", true),
            broker,
            workspaceTrusted: vscode.workspace.isTrusted,
            policy: await PolicyStore.exists() ? "loaded" : "unavailable",
            safeModeEnabled: Boolean(safeMode?.enabled),
            protectedWorkspaceEnabled: this.deps.workspaceGuard.isEnabled,
            sentinelEnabled: this.deps.sentinel.isEnabled,
            // The current MCPFirewall is not a mandatory gateway. Do not count
            // this toggle as a fully-enforcing required control.
            mcpStrictModeEnabled: false,
            liveScanEnabled: config.get<boolean>("liveScan.enabled", true),
            protectedAiTools: routed,
            detectedAiTools: detected,
            bypassDetected: detected > routed,
            lockdown: Boolean(this.context.globalState.get<LockdownRecord>(LOCKDOWN_STATE_KEY)?.active),
        };
        this.snapshot = { facts, descriptor: deriveProtectionState(facts) };
        return this.snapshot;
    }

    private detectAiExtensions(): number {
        return vscode.extensions.all.filter((extension) => /ai|copilot|claude|cursor|codeium|continue|tabnine|windsurf/i.test(`${extension.id} ${extension.packageJSON?.displayName ?? ""} ${extension.packageJSON?.description ?? ""}`)).length;
    }

    private async countVerifiedBrokerRoutes(): Promise<number> {
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
        return Math.min(count, this.detectAiExtensions());
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
