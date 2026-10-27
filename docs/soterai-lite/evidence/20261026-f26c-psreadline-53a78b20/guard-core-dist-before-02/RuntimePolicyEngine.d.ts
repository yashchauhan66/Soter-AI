export type ProtectionMode = "observe" | "standard" | "strict" | "enterprise_locked" | "air_gapped";
export type EnforcementAction = "ALLOW" | "ALLOW_ONCE" | "ALLOW_WITH_TRANSFORMATION" | "ALLOW_IN_SANDBOX" | "ASK" | "DENY" | "QUARANTINE";
export type RuntimeCoverageLevel = "FULL_ENFORCEMENT" | "STRONG_ENFORCEMENT" | "PARTIAL_VISIBILITY" | "DETECTION_ONLY" | "UNSUPPORTED" | "UNKNOWN_NOT_TESTED";
export type RuntimeActionType = "context_egress" | "file_read" | "file_write" | "file_delete" | "terminal_command" | "network_request" | "credential_use" | "mcp_tool_call" | "git_operation" | "package_install" | "policy_change" | "audit_log_change";
export type DestinationTrust = "local" | "approved" | "unknown" | "untrusted" | "private_network" | "cloud_metadata";
export type SourceTrust = "trusted" | "untrusted" | "unknown";
export type ParserStatus = "parsed" | "failed_suspicious" | "failed_unknown";
export type ReasonCode = "OBSERVE_MODE_NO_BLOCK" | "POLICY_ENGINE_UNHEALTHY" | "RAW_CREDENTIAL_EXPOSURE" | "SECRET_EGRESS" | "SENSITIVE_EGRESS_NEEDS_TRANSFORMATION" | "AIR_GAPPED_EXTERNAL_EGRESS" | "UNKNOWN_NETWORK_STRICT_MODE" | "PRIVATE_OR_METADATA_NETWORK" | "TERMINAL_PARSE_FAILED" | "TERMINAL_DESTRUCTIVE_EFFECT" | "TERMINAL_REMOTE_EXECUTION" | "PRODUCTION_IMPACT" | "PROMPT_INJECTION_TAINT" | "UNSUPPORTED_HIGH_RISK_PATH" | "POLICY_OR_AUDIT_WEAKENING" | "HIGH_RISK_REQUIRES_REVIEW" | "LOW_RISK_LOCAL_ACTION";
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
export declare class RuntimePolicyEngine {
    evaluate(request: RuntimePolicyRequest): RuntimePolicyDecision;
}
//# sourceMappingURL=RuntimePolicyEngine.d.ts.map