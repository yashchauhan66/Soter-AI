export type SecretType =
    | "api_key"
    | "jwt"
    | "database_url"
    | "private_key"
    | "oauth_token"
    | "cloud_credential"
    | "github_token"
    | "npm_token"
    | "ssh_key"
    | "webhook_url"
    | "password"
    | "aadhaar"
    | "pan"
    | "phone"
    | "email"
    | "env_secret"
    | "config_secret";

export type BrokerOperation =
    | "test_database_connection"
    | "validate_api_key_format"
    | "validate_token_format"
    | "call_api_healthcheck_with_secret"
    | "call_api_with_secret"
    | "generate_env_example"
    | "generate_config_example_without_values"
    | "compare_required_env_keys"
    | "compare_env_keys"
    | "check_token_expiry_if_possible"
    | "validate_url_reachability_without_exposing_secret"
    | "run_safe_config_validation"
    | "inspect_secret_metadata"
    | "check_url_scheme"
    | "validate_jwt_expiry_without_payload_leak"
    | "run_safe_linter";

export type SecretHandlingAction = "block" | "redact" | "broker" | "summarize" | "reveal_once" | "enterprise_locked";

export type UserApprovalState = "not_required" | "required" | "approved" | "denied";

export interface SecretFinding {
    type: SecretType;
    value: string;
    start: number;
    end: number;
    label: string;
    source?: string;
    sensitivity: "medium" | "high" | "critical";
    allowedOperations: BrokerOperation[];
    metadata?: Record<string, string | number | boolean>;
}

export interface SecretRefMetadata {
    id: string;
    ref: string;
    type: SecretType;
    source: string;
    hash: string;
    workspace: string;
    createdAt: string;
    expiresAt: string;
    ttlMs: number;
    allowedOperations: BrokerOperation[];
    sensitivity: "medium" | "high" | "critical";
    userApprovalState: UserApprovalState;
    oneTime: boolean;
    revoked: boolean;
    useCount: number;
    provider?: string;
}

export interface SecretRefRecord extends SecretRefMetadata {
    value: string;
}

export interface RedactedSecret {
    finding: Omit<SecretFinding, "value">;
    ref?: string;
    placeholder: string;
    metadata?: SecretRefMetadata;
}

export interface RedactionResult {
    text: string;
    secrets: RedactedSecret[];
    blocked: RedactedSecret[];
    allowedOperations: BrokerOperation[];
}

export interface BrokerAuditEvent {
    timestamp: string;
    action: string;
    verdict: "allow" | "block" | "redact" | "broker";
    riskCategory: string;
    secretType?: SecretType;
    secretHash?: string;
    ref?: string;
    model?: string;
    provider?: string;
    userDecision?: string;
    reason?: string;
}
