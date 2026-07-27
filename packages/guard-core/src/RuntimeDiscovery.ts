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

export function discoverRuntimeCapabilities(input: RuntimeDiscoveryInput = {}): RuntimeCapabilityMap {
    const protectionMode = input.protectionMode ?? "standard";
    const capabilities: RuntimeCapability[] = [
        capability("workspace-files", "Workspace files", Boolean(input.workspaceRoots?.length), "PARTIAL_VISIBILITY", input.workspaceTrusted === false ? "high" : "medium", "SoterAI can scan and build safe context, but cannot stop other local readers."),
        capability("terminal", "Terminal", input.terminalEnabled === true, input.terminalEnabled ? "DETECTION_ONLY" : "UNSUPPORTED", input.terminalEnabled ? "critical" : "low", input.terminalEnabled ? "Raw terminal execution can bypass SoterAI unless routed through the controlled broker." : "No terminal capability was reported."),
        capability("network", "Network", input.networkReach !== "none", input.networkReach === "restricted" ? "PARTIAL_VISIBILITY" : "UNSUPPORTED", input.networkReach === "unrestricted" || input.networkReach === "unknown" ? "critical" : "medium", `Network reach is ${input.networkReach ?? "unknown"}. Arbitrary process egress is not controlled by the extension.`),
        capability("git-auth", "Git authenticated authority", input.gitAuthAvailable === true, "PARTIAL_VISIBILITY", input.gitAuthAvailable ? "high" : "low", "Authenticated git operations require a broker or hook to enforce before push."),
        capability("cloud-context", "Cloud CLI context", Boolean(input.cloudContexts?.length), "PARTIAL_VISIBILITY", hasProduction(input.cloudContexts) ? "critical" : "high", "Cloud authority is treated as sensitive even when token values are not visible."),
        capability("kubernetes", "Kubernetes context", Boolean(input.kubernetesContext), "PARTIAL_VISIBILITY", mentionsProd(input.kubernetesContext) ? "critical" : "high", "Kubernetes mutation is not enforced unless routed through a future broker rule."),
        capability("docker", "Docker socket", input.dockerSocketAvailable === true, "PARTIAL_VISIBILITY", input.dockerSocketAvailable ? "high" : "low", "Docker socket access can imply host-level authority."),
        capability("mcp", "MCP servers", (input.mcpServerCount ?? 0) > 0, "PARTIAL_VISIBILITY", (input.mcpServerCount ?? 0) > 0 ? "high" : "low", "Config scanning is available; runtime enforcement requires the MCP gateway path."),
        capability("ai-extensions", "Installed AI extensions", Boolean(input.installedAIExtensions?.length), "PARTIAL_VISIBILITY", Boolean(input.installedAIExtensions?.length) ? "high" : "low", "SoterAI cannot prove what third-party extensions send unless they integrate with SoterAI."),
        capability("sandbox", "Sandbox", input.sandbox === "enabled", input.sandbox === "enabled" ? "STRONG_ENFORCEMENT" : "UNSUPPORTED", input.sandbox === "enabled" ? "low" : "high", input.sandbox === "enabled" ? "Sandbox is reported enabled for supported routes." : "No enforced sandbox is available for arbitrary commands."),
    ];

    const score = Math.min(100, capabilities.reduce((sum, item) => sum + (item.present ? riskPoints(item.risk) : 0), 0) + (input.productionIndicators?.length ? 20 : 0));
    const effectiveRisk = riskFromScore(score);
    const unsupportedWarnings = capabilities
        .filter((item) => item.present && (item.coverageLevel === "UNSUPPORTED" || item.coverageLevel === "DETECTION_ONLY"))
        .map((item) => `${item.label}: ${item.note}`);

    return {
        agent: input.agentName ?? "Unknown agent",
        integrationType: input.integrationType ?? "unknown",
        protectionMode,
        effectiveRiskScore: score,
        effectiveRisk,
        capabilities,
        unsupportedWarnings,
        summaryLines: [
            `Agent: ${input.agentName ?? "Unknown agent"}`,
            `Workspace files: ${input.workspaceRoots?.length ? "reachable" : "unknown"}`,
            `Terminal: ${input.terminalEnabled ? `enabled${input.shell ? ` (${input.shell})` : ""}` : "not reported"}`,
            `Network: ${input.networkReach ?? "unknown"}`,
            `Git credentials: ${input.gitAuthAvailable ? "available" : "not reported"}`,
            `MCP servers: ${input.mcpServerCount ?? 0}`,
            `Sandbox: ${input.sandbox ?? "unknown"}`,
            `Effective risk: ${effectiveRisk.toUpperCase()} (${score})`,
        ],
    };
}

function capability(id: string, label: string, present: boolean, coverageLevel: RuntimeCoverageLevel, risk: RuntimeRiskLevel, note: string): RuntimeCapability {
    return { id, label, present, coverageLevel, risk, note };
}

function riskPoints(risk: RuntimeRiskLevel): number {
    return risk === "critical" ? 22 : risk === "high" ? 14 : risk === "medium" ? 8 : 2;
}

function riskFromScore(score: number): RuntimeRiskLevel {
    if (score >= 70) return "critical";
    if (score >= 40) return "high";
    if (score >= 18) return "medium";
    return "low";
}

function hasProduction(values: string[] | undefined): boolean {
    return Boolean(values?.some(mentionsProd));
}

function mentionsProd(value: string | undefined): boolean {
    return /\b(prod|production|live|mainnet)\b/i.test(value ?? "");
}
