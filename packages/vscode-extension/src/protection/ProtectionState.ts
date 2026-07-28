/**
 * Unified protection state for the extension host and all presentation layers.
 *
 * This module is deliberately pure. It does not inspect VS Code, start a
 * broker, or infer coverage from a single enabled toggle. Callers provide the
 * runtime facts they have verified; the resulting state is the only source of
 * truth that should be rendered as the product headline.
 */

export type ProtectionStateName =
    | "DISABLED"
    | "INITIALISING"
    | "MONITORING_ONLY"
    | "PARTIALLY_ENFORCED"
    | "FULLY_ENFORCED"
    | "DEGRADED"
    | "BROKER_OFFLINE"
    | "POLICY_UNAVAILABLE"
    | "BYPASS_DETECTED"
    | "LOCKDOWN"
    | "ERROR";

export type ProtectionSeverity = "info" | "warning" | "error" | "critical";

export interface ProtectionRuntimeFacts {
    enabled: boolean;
    initialising?: boolean;
    broker: "healthy" | "offline" | "starting" | "incompatible" | "error";
    workspaceTrusted: boolean;
    policy: "loaded" | "unavailable" | "expired" | "invalid";
    safeModeEnabled: boolean;
    protectedWorkspaceEnabled: boolean;
    sentinelEnabled: boolean;
    mcpStrictModeEnabled: boolean;
    liveScanEnabled: boolean;
    /** Number of detected AI integrations with a verified SoterAI route. */
    protectedAiTools: number;
    /** Number of detected AI integrations, including unsupported/bypassed ones. */
    detectedAiTools: number;
    bypassDetected?: boolean;
    lockdown?: boolean;
    errorMessage?: string;
}

export interface ProtectionStateDescriptor {
    state: ProtectionStateName;
    title: string;
    explanation: string;
    severity: ProtectionSeverity;
    activeControls: string[];
    inactiveControls: string[];
    coverage: string;
    recommendedAction: string;
    allowedTransitions: ProtectionStateName[];
}

const REQUIRED_CONTROLS = ["AI traffic protection", "Protected Workspace", "AI activity evidence", "MCP governance"] as const;

function coverage(facts: ProtectionRuntimeFacts): string {
    if (facts.detectedAiTools <= 0) return "AI integration coverage unknown until an integration is detected";
    return `${facts.protectedAiTools} of ${facts.detectedAiTools} detected AI tool${facts.detectedAiTools === 1 ? "" : "s"} routed through a verified SoterAI path`;
}

function controls(facts: ProtectionRuntimeFacts): Pick<ProtectionStateDescriptor, "activeControls" | "inactiveControls"> {
    const active: string[] = [];
    if (facts.broker === "healthy" && facts.safeModeEnabled) active.push("AI traffic protection for broker-routed traffic");
    if (facts.protectedWorkspaceEnabled) active.push("Protected Workspace for SoterAI-built context");
    if (facts.sentinelEnabled) active.push("privacy-safe AI activity evidence");
    if (facts.mcpStrictModeEnabled) active.push("MCP configuration and preflight governance");
    if (facts.liveScanEnabled) active.push("live file diagnostics (visibility only)");
    const activeControlIds = new Set<string>([
        facts.broker === "healthy" && facts.safeModeEnabled ? "AI traffic protection" : "",
        facts.protectedWorkspaceEnabled ? "Protected Workspace" : "",
        facts.sentinelEnabled ? "AI activity evidence" : "",
        facts.mcpStrictModeEnabled ? "MCP governance" : "",
    ]);
    const inactive = REQUIRED_CONTROLS.filter((control) => !activeControlIds.has(control));
    return { activeControls: active, inactiveControls: [...inactive] };
}

function transitions(state: ProtectionStateName): ProtectionStateName[] {
    if (state === "LOCKDOWN") return ["LOCKDOWN", "INITIALISING", "ERROR"];
    if (state === "ERROR") return ["ERROR", "INITIALISING", "DISABLED"];
    if (state === "DISABLED") return ["DISABLED", "INITIALISING", "MONITORING_ONLY"];
    return [state, "INITIALISING", "MONITORING_ONLY", "PARTIALLY_ENFORCED", "FULLY_ENFORCED", "DEGRADED", "BROKER_OFFLINE", "POLICY_UNAVAILABLE", "BYPASS_DETECTED", "LOCKDOWN", "ERROR"];
}

/** Derive the one truthful headline state from verified runtime facts. */
export function deriveProtectionState(facts: ProtectionRuntimeFacts): ProtectionStateDescriptor {
    const controlState = controls(facts);
    const shared = { ...controlState, coverage: coverage(facts) };

    if (facts.lockdown) {
        return { ...shared, state: "LOCKDOWN", title: "Emergency Lockdown", explanation: "Supported SoterAI workflows are blocked and temporary approvals are revoked until recovery.", severity: "critical", recommendedAction: "Review the incident evidence and unlock only after the cause is understood.", allowedTransitions: transitions("LOCKDOWN") };
    }
    if (facts.errorMessage || facts.broker === "error") {
        return { ...shared, state: "ERROR", title: "Protection error", explanation: facts.errorMessage ?? "A protection component reported an unrecoverable error.", severity: "error", recommendedAction: "Open diagnostics, repair the configuration, and run the self-test again.", allowedTransitions: transitions("ERROR") };
    }
    if (facts.initialising || facts.broker === "starting") {
        return { ...shared, state: "INITIALISING", title: "Protection starting", explanation: "SoterAI is starting the local enforcement path and has not verified protection yet.", severity: "info", recommendedAction: "Wait for the broker health check to complete.", allowedTransitions: transitions("INITIALISING") };
    }
    if (!facts.enabled) {
        return { ...shared, state: "DISABLED", title: "Protection disabled", explanation: "SoterAI controls are disabled; no protection claim is made.", severity: "warning", recommendedAction: "Enable Full Protection to configure the supported enforcement paths.", allowedTransitions: transitions("DISABLED") };
    }
    if (!facts.workspaceTrusted) {
        return { ...shared, state: "DEGRADED", title: "Restricted workspace", explanation: "Workspace trust is required for provider routing and some protected-workspace controls.", severity: "warning", recommendedAction: "Trust the workspace or continue with the explicitly limited local controls.", allowedTransitions: transitions("DEGRADED") };
    }
    if (facts.policy === "unavailable" || facts.policy === "invalid" || facts.policy === "expired") {
        return { ...shared, state: "POLICY_UNAVAILABLE", title: "Policy unavailable", explanation: "A valid policy is not loaded, so required enforcement cannot be asserted.", severity: "error", recommendedAction: "Load or repair the policy before enabling enforcement.", allowedTransitions: transitions("POLICY_UNAVAILABLE") };
    }
    if (facts.bypassDetected || facts.protectedAiTools < facts.detectedAiTools) {
        return { ...shared, state: "BYPASS_DETECTED", title: "Bypass detected", explanation: "AI activity exists outside the verified SoterAI enforcement path. SoterAI cannot block another extension or external process from sending it.", severity: "error", recommendedAction: "Route the affected integration through the broker or acknowledge its monitoring-only coverage.", allowedTransitions: transitions("BYPASS_DETECTED") };
    }
    if (facts.broker === "offline" || facts.broker === "incompatible") {
        return { ...shared, state: "BROKER_OFFLINE", title: "Broker offline", explanation: "The local broker is not healthy, so brokered AI traffic is not technically controlled.", severity: "error", recommendedAction: "Start or repair the local broker, then run the broker self-test.", allowedTransitions: transitions("BROKER_OFFLINE") };
    }

    const requiredActive = facts.broker === "healthy" && facts.safeModeEnabled && facts.protectedWorkspaceEnabled && facts.sentinelEnabled && facts.mcpStrictModeEnabled;
    if (requiredActive && facts.detectedAiTools > 0 && facts.protectedAiTools === facts.detectedAiTools) {
        return { ...shared, state: "FULLY_ENFORCED", title: "Fully enforced", explanation: "All required supported controls are active, policy is loaded, and detected AI tools are routed through verified SoterAI paths.", severity: "info", recommendedAction: "Continue working; review coverage and evidence when integrations change.", allowedTransitions: transitions("FULLY_ENFORCED") };
    }
    if (facts.broker === "healthy" && (facts.safeModeEnabled || facts.protectedWorkspaceEnabled || facts.mcpStrictModeEnabled)) {
        return { ...shared, state: "PARTIALLY_ENFORCED", title: "Partially enforced", explanation: "Some SoterAI paths are enforcing, but one or more required controls or AI integrations are not covered.", severity: "warning", recommendedAction: "Enable the missing required controls and route every supported AI integration through SoterAI.", allowedTransitions: transitions("PARTIALLY_ENFORCED") };
    }
    return { ...shared, state: "MONITORING_ONLY", title: "Monitoring only", explanation: "Risks can be observed, but supported AI traffic is not currently being technically controlled.", severity: "warning", recommendedAction: "Enable Full Protection and route AI traffic through the local broker.", allowedTransitions: transitions("MONITORING_ONLY") };
}
