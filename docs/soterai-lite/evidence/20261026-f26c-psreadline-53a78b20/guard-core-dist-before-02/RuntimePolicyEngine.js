"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RuntimePolicyEngine = void 0;
const ACTION_PRECEDENCE = {
    ALLOW: 0,
    ALLOW_ONCE: 1,
    ALLOW_WITH_TRANSFORMATION: 2,
    ALLOW_IN_SANDBOX: 3,
    ASK: 4,
    QUARANTINE: 5,
    DENY: 6,
};
const EXPLANATIONS = {
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
class RuntimePolicyEngine {
    evaluate(request) {
        const normalized = normalizeRequest(request);
        const reasonCodes = [];
        const candidates = [];
        const add = (action, reason) => {
            candidates.push(action);
            if (!reasonCodes.includes(reason))
                reasonCodes.push(reason);
        };
        if (normalized.protectionMode === "observe") {
            add("ALLOW", "OBSERVE_MODE_NO_BLOCK");
            return buildDecision(normalized, "ALLOW", reasonCodes);
        }
        if (!normalized.policyEngineHealthy) {
            add(isLockedMode(normalized.protectionMode) ? "DENY" : "ASK", "POLICY_ENGINE_UNHEALTHY");
        }
        if (normalized.rawCredentialExposure)
            add("DENY", "RAW_CREDENTIAL_EXPOSURE");
        if (normalized.protectionMode === "air_gapped" && isExternalDestination(normalized.destinationTrust)) {
            add("DENY", "AIR_GAPPED_EXTERNAL_EGRESS");
        }
        if (normalized.destinationTrust === "private_network" || normalized.destinationTrust === "cloud_metadata") {
            add("DENY", "PRIVATE_OR_METADATA_NETWORK");
        }
        if (normalized.actionType === "context_egress" || normalized.actionType === "network_request") {
            if (normalized.containsSecrets && isExternalDestination(normalized.destinationTrust)) {
                add("DENY", "SECRET_EGRESS");
            }
            else if (normalized.containsSensitiveData && !normalized.transformed && isExternalDestination(normalized.destinationTrust)) {
                add(normalized.protectionMode === "strict" || normalized.protectionMode === "enterprise_locked"
                    ? "DENY"
                    : "ALLOW_WITH_TRANSFORMATION", "SENSITIVE_EGRESS_NEEDS_TRANSFORMATION");
            }
        }
        if (normalized.actionType === "network_request" &&
            normalized.protectionMode === "strict" &&
            normalized.destinationTrust === "unknown") {
            add("DENY", "UNKNOWN_NETWORK_STRICT_MODE");
        }
        if (normalized.actionType === "terminal_command") {
            if (normalized.parserStatus === "failed_suspicious")
                add(isLockedMode(normalized.protectionMode) ? "DENY" : "ASK", "TERMINAL_PARSE_FAILED");
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
        if (normalized.riskScore >= 70)
            add(isLockedMode(normalized.protectionMode) ? "DENY" : "ASK", "HIGH_RISK_REQUIRES_REVIEW");
        if (candidates.length === 0)
            add("ALLOW", "LOW_RISK_LOCAL_ACTION");
        return buildDecision(normalized, maxAction(candidates), reasonCodes);
    }
}
exports.RuntimePolicyEngine = RuntimePolicyEngine;
function normalizeRequest(request) {
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
function buildDecision(request, action, reasonCodes) {
    const uniqueReasons = reasonCodes.length ? reasonCodes : ["LOW_RISK_LOCAL_ACTION"];
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
function maxAction(actions) {
    return actions.reduce((winner, action) => ACTION_PRECEDENCE[action] > ACTION_PRECEDENCE[winner] ? action : winner, "ALLOW");
}
function hasAnyCategory(request, categories) {
    return categories.some((category) => request.categories.includes(category));
}
function isExternalDestination(destinationTrust) {
    return destinationTrust !== "local" && destinationTrust !== "approved";
}
function isLockedMode(mode) {
    return mode === "strict" || mode === "enterprise_locked" || mode === "air_gapped";
}
function isUnsupported(level) {
    return level === "UNSUPPORTED" || level === "UNKNOWN_NOT_TESTED" || level === "DETECTION_ONLY";
}
function isMutatingAction(actionType) {
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
function isHighImpactAction(actionType) {
    return actionType !== "file_read" && actionType !== "context_egress";
}
//# sourceMappingURL=RuntimePolicyEngine.js.map