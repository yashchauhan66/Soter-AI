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
    /** Number of routable AI integrations with a verified SoterAI route. */
    protectedAiTools: number;
    /** Number of AI integrations SoterAI can route through its broker. */
    detectedAiTools: number;
    /**
     * Real AI tools SoterAI has no routing path for (e.g. Copilot).
     *
     * These are a documented limitation, not a bypass: no setting the user can
     * change would route them, so they must never produce an enforcement
     * error. They cap the claim at "partially enforced" and are named in the
     * coverage line instead.
     */
    unmanagedAiTools?: number;
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

/**
 * Controls whose absence blocks a "fully enforced" claim.
 *
 * MCP governance is deliberately NOT here. The MCPFirewall is not a mandatory
 * gateway, so claiming it as enforcement would be false — but it was previously
 * listed as required AND its fact was hardcoded false, which made
 * FULLY_ENFORCED unreachable for every user forever. An unenforceable control
 * belongs in the advisory list, not in the required set.
 */
const REQUIRED_CONTROLS = ["AI traffic protection", "Protected Workspace", "AI activity evidence"] as const;

/** Surfaced to the user, but never gates the enforcement claim. */
const ADVISORY_CONTROLS = ["MCP governance", "Live file diagnostics"] as const;

function coverage(facts: ProtectionRuntimeFacts): string {
    const unmanaged = facts.unmanagedAiTools ?? 0;
    // Unroutable tools are stated plainly rather than folded into the ratio.
    // Counting them as uncovered denominators is what produced "0 of 32".
    const limitation = unmanaged > 0
        ? ` · ${unmanaged} other AI tool${unmanaged === 1 ? "" : "s"} cannot be routed by SoterAI (monitoring only)`
        : "";
    if (facts.detectedAiTools <= 0) {
        return unmanaged > 0
            ? `No routable AI integration detected${limitation}`
            : "AI integration coverage unknown until an integration is detected";
    }
    return `${facts.protectedAiTools} of ${facts.detectedAiTools} routable AI tool${facts.detectedAiTools === 1 ? "" : "s"} routed through a verified SoterAI path${limitation}`;
}

/** True when the user has switched on something that needs a live broker. */
function expectsEnforcement(facts: ProtectionRuntimeFacts): boolean {
    return facts.safeModeEnabled || facts.protectedAiTools > 0;
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
        facts.liveScanEnabled ? "Live file diagnostics" : "",
    ]);
    const inactive = REQUIRED_CONTROLS.filter((control) => !activeControlIds.has(control));
    // Advisory controls are listed so the panel can still offer them, but
    // marked, because their absence does not hold back the enforcement claim.
    const advisoryInactive = ADVISORY_CONTROLS
        .filter((control) => !activeControlIds.has(control))
        .map((control) => `${control} (advisory)`);
    return { activeControls: active, inactiveControls: [...inactive, ...advisoryInactive] };
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
    // Policy is only a blocker when the user has actively turned on enforcement
    // paths that require it. On a fresh install — or a machine where no
    // .soterai/policy.json has been created yet — the policy is "unavailable"
    // but NO enforcement is on, so the honest state is MONITORING_ONLY, not an
    // error. Showing a red "Policy unavailable" banner to every new user before
    // they even touched a toggle was the single most-reported confusing UX issue.
    // A missing policy only becomes an error when the user has switched on Safe
    // Mode or is routing AI tools and still has no policy file.
    const policyBlocking = (facts.policy === "unavailable" || facts.policy === "invalid" || facts.policy === "expired")
        && (facts.safeModeEnabled || facts.protectedAiTools > 0);
    if (policyBlocking) {
        return { ...shared, state: "POLICY_UNAVAILABLE", title: "Policy file missing", explanation: "Safe Mode is on but no project policy file was found. SoterAI created a default one — review it before enabling enforcement.", severity: "warning", recommendedAction: "Run 'Create Project Policy' to review and save the default policy, then re-enable Safe Mode.", allowedTransitions: transitions("POLICY_UNAVAILABLE") };
    }
    // A bypass is a routable integration that is NOT routed — something the
    // user can actually fix. Tools SoterAI cannot route are handled below as a
    // stated limitation; treating them as a bypass made this state permanent.
    if (facts.bypassDetected || facts.protectedAiTools < facts.detectedAiTools) {
        return { ...shared, state: "BYPASS_DETECTED", title: "Bypass detected", explanation: "A routable AI integration is configured to reach a provider directly instead of through SoterAI, so its traffic is not inspected.", severity: "error", recommendedAction: "Run \"Set up local checking\" to point that integration at the SoterAI broker.", allowedTransitions: transitions("BYPASS_DETECTED") };
    }
    // Broker down is an error only when the user has switched on something that
    // needs it. On a fresh install nothing is routed and Safe Mode is off, so
    // the truthful headline is "monitoring only", not a red failure for a
    // component the user never asked to run.
    if ((facts.broker === "offline" || facts.broker === "incompatible") && expectsEnforcement(facts)) {
        return { ...shared, state: "BROKER_OFFLINE", title: "Broker offline", explanation: "Enforcement is switched on but the local broker is not healthy, so brokered AI traffic is not being controlled right now.", severity: "error", recommendedAction: "Start or repair the local broker, then run the broker self-test.", allowedTransitions: transitions("BROKER_OFFLINE") };
    }

    const unmanaged = facts.unmanagedAiTools ?? 0;
    const requiredActive = facts.broker === "healthy" && facts.safeModeEnabled && facts.protectedWorkspaceEnabled && facts.sentinelEnabled;
    if (requiredActive && facts.detectedAiTools > 0 && facts.protectedAiTools === facts.detectedAiTools && unmanaged === 0) {
        return { ...shared, state: "FULLY_ENFORCED", title: "Fully enforced", explanation: "All required controls are active, policy is loaded, and every AI tool on this machine that SoterAI can route is routed through a verified SoterAI path.", severity: "info", recommendedAction: "Continue working; review coverage and evidence when integrations change.", allowedTransitions: transitions("FULLY_ENFORCED") };
    }
    if (requiredActive && unmanaged > 0 && facts.protectedAiTools === facts.detectedAiTools) {
        // Everything SoterAI can control IS controlled. The remaining gap is a
        // product limitation, so it is reported as a limit, not as a user error.
        return { ...shared, state: "PARTIALLY_ENFORCED", title: "Enforced, with known gaps", explanation: `Every routable AI integration is going through SoterAI. ${unmanaged} other AI tool${unmanaged === 1 ? "" : "s"} on this machine cannot be routed by SoterAI at all, so ${unmanaged === 1 ? "its" : "their"} traffic is observed but not controlled.`, severity: "warning", recommendedAction: "Review the uncontrolled tools and disable any you do not need; SoterAI cannot intercept them.", allowedTransitions: transitions("PARTIALLY_ENFORCED") };
    }
    if (facts.broker === "healthy" && (facts.safeModeEnabled || facts.protectedWorkspaceEnabled || facts.mcpStrictModeEnabled)) {
        return { ...shared, state: "PARTIALLY_ENFORCED", title: "Partially enforced", explanation: "Some SoterAI paths are enforcing, but one or more required controls are still off.", severity: "warning", recommendedAction: `Turn on the remaining required control${controlState.inactiveControls.length === 1 ? "" : "s"}: ${controlState.inactiveControls.join(", ") || "none"}.`, allowedTransitions: transitions("PARTIALLY_ENFORCED") };
    }
    return { ...shared, state: "MONITORING_ONLY", title: "Monitoring only", explanation: "SoterAI is watching this workspace and will warn about risks, but it is not technically blocking AI traffic yet.", severity: "warning", recommendedAction: "Run \"Set up local checking\" to turn on the local broker, then enable Safe Mode to start blocking.", allowedTransitions: transitions("MONITORING_ONLY") };
}
