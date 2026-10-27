import type { ProtectionMode, RuntimeCoverageLevel } from "./RuntimePolicyEngine";
export type RuntimeRiskLevel = "low" | "medium" | "high" | "critical";
export interface RuntimeDiscoveryInput {
    agentName?: string;
    integrationType?: string;
    protectionMode?: ProtectionMode;
    workspaceTrusted?: boolean;
    workspaceRoots?: string[];
    terminalEnabled?: boolean;
    shell?: string;
    networkReach?: "none" | "restricted" | "unrestricted" | "unknown";
    gitRemotePresent?: boolean;
    gitAuthAvailable?: boolean;
    cloudContexts?: string[];
    kubernetesContext?: string;
    dockerSocketAvailable?: boolean;
    mcpServerCount?: number;
    installedAIExtensions?: string[];
    remoteEnvironment?: "local" | "ssh" | "wsl" | "container" | "codespaces" | "unknown";
    sandbox?: "enabled" | "available" | "disabled" | "unknown";
    productionIndicators?: string[];
}
export interface RuntimeCapability {
    id: string;
    label: string;
    present: boolean;
    coverageLevel: RuntimeCoverageLevel;
    risk: RuntimeRiskLevel;
    note: string;
}
export interface RuntimeCapabilityMap {
    agent: string;
    integrationType: string;
    protectionMode: ProtectionMode;
    effectiveRiskScore: number;
    effectiveRisk: RuntimeRiskLevel;
    capabilities: RuntimeCapability[];
    unsupportedWarnings: string[];
    summaryLines: string[];
}
export declare function discoverRuntimeCapabilities(input?: RuntimeDiscoveryInput): RuntimeCapabilityMap;
//# sourceMappingURL=RuntimeDiscovery.d.ts.map