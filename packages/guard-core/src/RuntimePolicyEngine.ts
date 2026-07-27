export type ProtectionMode = "observe" | "standard" | "strict" | "enterprise_locked" | "air_gapped";

export type EnforcementAction =
    | "ALLOW"
    | "ALLOW_ONCE"
    | "ALLOW_WITH_TRANSFORMATION"
    | "ALLOW_IN_SANDBOX"
    | "ASK"
    | "DENY"
    | "QUARANTINE";

export type RuntimeCoverageLevel =
    | "FULL_ENFORCEMENT"
    | "STRONG_ENFORCEMENT"
    | "PARTIAL_VISIBILITY"
    | "DETECTION_ONLY"
    | "UNSUPPORTED"
    | "UNKNOWN_NOT_TESTED";

export type RuntimeActionType =
    | "context_egress"
    | "file_read"
    | "file_write"
    | "file_delete"
    | "terminal_command"
    | "network_request"
    | "credential_use"
    | "mcp_tool_call"
    | "git_operation"
    | "package_install"
    | "policy_change"
    | "audit_log_change";

export type DestinationTrust = "local" | "approved" | "unknown" | "untrusted" | "private_network" | "cloud_metadata";
export type SourceTrust = "trusted" | "untrusted" | "unknown";
export type ParserStatus = "parsed" | "failed_suspicious" | "failed_unknown";

export type ReasonCode =
    | "OBSERVE_MODE_NO_BLOCK"
    | "POLICY_ENGINE_UNHEALTHY"
    | "RAW_CREDENTIAL_EXPOSURE"
    | "SECRET_EGRESS"
    | "SENSITIVE_EGRESS_NEEDS_TRANSFORMATION"
    | "AIR_GAPPED_EXTERNAL_EGRESS"
    | "UNKNOWN_NETWORK_STRICT_MODE"
    | "PRIVATE_OR_METADATA_NETWORK"
    | "TERMINAL_PARSE_FAILED"
    | "TERMINAL_DESTRUCTIVE_EFFECT"
    | "TERMINAL_REMOTE_EXECUTION"
    | "PRODUCTION_IMPACT"
    | "PROMPT_INJECTION_TAINT"
    | "UNSUPPORTED_HIGH_RISK_PATH"
    | "POLICY_OR_AUDIT_WEAKENING"
    | "HIGH_RISK_REQUIRES_REVIEW"
    | "LOW_RISK_LOCAL_ACTION";

export interface RuntimePolicyRequest {
    actionType: RuntimeActionType;
    protectionMode: ProtectionMode;
    coverageLevel: RuntimeCoverageLevel;
    riskScore?: number;
    categories?: string[];
    destinationTrust?: DestinationTrust;
    sourceTrust?: SourceTrust;
    parserStatus?: ParserStatus;
    rawCredentialExposure?: boolean;
    containsSecrets?: boolean;
    containsSensitiveData?: boolean;
    transformed?: boolean;
    reversible?: boolean;
    productionContext?: boolean;
    requestedPersistence?: boolean;
    policyEngineHealthy?: boolean;
    taintedByPromptInjection?: boolean;
}

export interface RuntimePolicyDecision {
    action: EnforcementAction;
    coverageLevel: RuntimeCoverageLevel;
    deterministic: true;
    blockingMoment: "pre_execution" | "observe_only";
    rollbackAvailable: boolean;
    reasonCodes: ReasonCode[];
    explanation: string;
}

const ACTION_PRECEDENCE: Record<EnforcementAction, number> = {
    ALLOW: 0,
    ALLOW_ONCE: 1,
    ALLOW_WITH_TRANSFORMATION: 2,
    ALLOW_IN_SANDBOX: 3,
    ASK: 4,
    QUARANTINE: 5,
    DENY: 6,
};

const EXPLANATIONS: Record<ReasonCode, string> = {
    OBSERVE_MODE_NO_BLOCK: "Observe mode records the risk but does not block execution.",
    POLICY_ENGINE_UNHEALTHY: "The policy engine is unhealthy, so protected modes fail safely.",
    RAW_CREDENTIAL_EXPOSURE: "The request would expose a raw credential instead of a scoped capability.",
    SECRET_EGRESS: "Secret-like content is present in a path that could leave the local boundary.",
    SENSITIVE_EGRESS_NEEDS_TRANSFORMATION: "Sensitive content requires redaction, tokenization, or summarization before sharing.",
    AIR_GAPPED_EXTERNAL_EGRESS: "Air-gapped mode forbids external network or model destinations.",
    UNKNOWN_NETWORK_STRICT_MODE: "Strict mode does not allow unknown network destinations without review.",
    PRIVATE_OR_METADATA_NETWORK: "The destination targets private, localhost, link-local, or cloud metadata space.",
    TERMINAL_PARSE_FAILED: "The terminal command could not be parsed safely.",
    TERMINAL_DESTRUCTIVE_EFFECT: "The command may delete, overwrite, or irreversibly mutate local or remote resources.",
    TERMINAL_REMOTE_EXECUTION: "The command may download and execute remote code.",
    PRODUCTION_IMPACT: "The action is associated with production resources or authority.",
    PROMPT_INJECTION_TAINT: "The action is influenced by untrusted or prompt-injected content.",
    UNSUPPORTED_HIGH_RISK_PATH: "SoterAI does not have an enforcing boundary on this high-risk path.",
    POLICY_OR_AUDIT_WEAKENING: "The action could weaken policy, logging, or audit controls.",
    HIGH_RISK_REQUIRES_REVIEW: "The computed risk requires explicit review before execution.",
    LOW_RISK_LOCAL_ACTION: "The action is low-risk, local, and within the supported policy boundary.",
};

export class RuntimePolicyEngine {
    evaluate(request: RuntimePolicyRequest): RuntimePolicyDecision {
        const normalized = normalizeRequest(request);
        const reasonCodes: ReasonCode[] = [];
        const candidates: EnforcementAction[] = [];

        const add = (action: EnforcementAction, reason: ReasonCode) => {
            candidates.push(action);
            if (!reasonCodes.includes(reason)) reasonCodes.push(reason);
        };

        if (normalized.protectionMode === "observe") {
            add("ALLOW", "OBSERVE_MODE_NO_BLOCK");
            return buildDecision(normalized, "ALLOW", reasonCodes);
        }

        if (!normalized.policyEngineHealthy) {
            add(isLockedMode(normalized.protectionMode) ? "DENY" : "ASK", "POLICY_ENGINE_UNHEALTHY");
        }

        if (normalized.rawCredentialExposure) add("DENY", "RAW_CREDENTIAL_EXPOSURE");

        if (normalized.protectionMode === "air_gapped" && isExternalDestination(normalized.destinationTrust)) {
            add("DENY", "AIR_GAPPED_EXTERNAL_EGRESS");
        }

        if (normalized.destinationTrust === "private_network" || normalized.destinationTrust === "cloud_metadata") {
            add("DENY", "PRIVATE_OR_METADATA_NETWORK");
        }

        if (normalized.actionType === "context_egress" || normalized.actionType === "network_request") {
            if (normalized.containsSecrets && isExternalDestination(normalized.destinationTrust)) {
                add("DENY", "SECRET_EGRESS");
            } else if (normalized.containsSensitiveData && !normalized.transformed && isExternalDestination(normalized.destinationTrust)) {
                add(normalized.protectionMode === "strict" || normalized.protectionMode === "enterprise_locked"
                    ? "DENY"
                    : "ALLOW_WITH_TRANSFORMATION", "SENSITIVE_EGRESS_NEEDS_TRANSFORMATION");
            }
        }

        if (
            normalized.actionType === "network_request" &&
            normalized.protectionMode === "strict" &&
            normalized.destinationTrust === "unknown"
        ) {
            add("DENY", "UNKNOWN_NETWORK_STRICT_MODE");
        }

        if (normalized.actionType === "terminal_command") {
            if (normalized.parserStatus === "failed_suspicious") add(isLockedMode(normalized.protectionMode) ? "DENY" : "ASK", "TERMINAL_PARSE_FAILED");
            if (hasAnyCategory(normalized, ["destructive_rm", "force_delete", "disk_wipe", "fork_bomb", "k8s_destructive", "docker_cleanup"])) {
                add("DENY", "TERMINAL_DESTRUCTIVE_EFFECT");
            }
            if (hasAnyCategory(normalized, ["remote_exec", "encoded_exec", "reverse_shell"])) {
                add("DENY", "TERMINAL_REMOTE_EXECUTION");
            }
        }

        if (normalized.productionContext && isMutatingAction(normalized.actionType)) {
            add(normalized.reversible ? "ASK" : "DENY", "PRODUCTION_IMPACT");
        }

        if (normalized.taintedByPromptInjection && isHighImpactAction(normalized.actionType)) {
            add(isLockedMode(normalized.protectionMode) ? "DENY" : "ASK", "PROMPT_INJECTION_TAINT");
        }

        if (isUnsupported(normalized.coverageLevel) && normalized.riskScore >= 35) {
            add(isLockedMode(normalized.protectionMode) || normalized.riskScore >= 70 ? "DENY" : "ASK", "UNSUPPORTED_HIGH_RISK_PATH");
        }

        if (normalized.actionType === "policy_change" || normalized.actionType === "audit_log_change") {
            add(isLockedMode(normalized.protectionMode) ? "DENY" : "ASK", "POLICY_OR_AUDIT_WEAKENING");
        }

        if (normalized.riskScore >= 70) add(isLockedMode(normalized.protectionMode) ? "DENY" : "ASK", "HIGH_RISK_REQUIRES_REVIEW");

        if (candidates.length === 0) add("ALLOW", "LOW_RISK_LOCAL_ACTION");

        return buildDecision(normalized, maxAction(candidates), reasonCodes);
    }
}

function normalizeRequest(request: RuntimePolicyRequest): Required<RuntimePolicyRequest> {
    return {
        actionType: request.actionType,
        protectionMode: request.protectionMode,
        coverageLevel: request.coverageLevel,
        riskScore: request.riskScore ?? 0,
        categories: request.categories ?? [],
        destinationTrust: request.destinationTrust ?? "local",
        sourceTrust: request.sourceTrust ?? "unknown",
        parserStatus: request.parserStatus ?? "parsed",
        rawCredentialExposure: request.rawCredentialExposure ?? false,
        containsSecrets: request.containsSecrets ?? false,
        containsSensitiveData: request.containsSensitiveData ?? false,
        transformed: request.transformed ?? false,
        reversible: request.reversible ?? false,
        productionContext: request.productionContext ?? false,
        requestedPersistence: request.requestedPersistence ?? false,
        policyEngineHealthy: request.policyEngineHealthy ?? true,
        taintedByPromptInjection: request.taintedByPromptInjection ?? false,
    };
}

function buildDecision(
    request: Required<RuntimePolicyRequest>,
    action: EnforcementAction,
    reasonCodes: ReasonCode[],
): RuntimePolicyDecision {
    const uniqueReasons: ReasonCode[] = reasonCodes.length ? reasonCodes : ["LOW_RISK_LOCAL_ACTION"];
    return {
        action,
        coverageLevel: request.coverageLevel,
        deterministic: true,
        blockingMoment: request.protectionMode === "observe" ? "observe_only" : "pre_execution",
        rollbackAvailable: request.reversible && action !== "DENY",
        reasonCodes: uniqueReasons,
        explanation: uniqueReasons.map((code) => EXPLANATIONS[code]).join(" "),
    };
}

function maxAction(actions: EnforcementAction[]): EnforcementAction {
    return actions.reduce<EnforcementAction>(
        (winner, action) => ACTION_PRECEDENCE[action] > ACTION_PRECEDENCE[winner] ? action : winner,
        "ALLOW",
    );
}

function hasAnyCategory(request: Required<RuntimePolicyRequest>, categories: string[]): boolean {
    return categories.some((category) => request.categories.includes(category));
}

function isExternalDestination(destinationTrust: DestinationTrust): boolean {
    return destinationTrust !== "local" && destinationTrust !== "approved";
}

function isLockedMode(mode: ProtectionMode): boolean {
    return mode === "strict" || mode === "enterprise_locked" || mode === "air_gapped";
}

function isUnsupported(level: RuntimeCoverageLevel): boolean {
    return level === "UNSUPPORTED" || level === "UNKNOWN_NOT_TESTED" || level === "DETECTION_ONLY";
}

function isMutatingAction(actionType: RuntimeActionType): boolean {
    return [
        "file_write",
        "file_delete",
        "terminal_command",
        "network_request",
        "credential_use",
        "mcp_tool_call",
        "git_operation",
        "package_install",
        "policy_change",
        "audit_log_change",
    ].includes(actionType);
}

function isHighImpactAction(actionType: RuntimeActionType): boolean {
    return actionType !== "file_read" && actionType !== "context_egress";
}
