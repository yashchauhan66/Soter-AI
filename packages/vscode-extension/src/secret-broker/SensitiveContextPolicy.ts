import * as fs from "fs";
import * as path from "path";
import { type BrokerOperation, type SecretHandlingAction, type SecretType } from "./types";

export interface SensitiveContextPolicy {
    sensitiveContext: {
        defaultAction: SecretHandlingAction;
        allowRawReveal: boolean;
        requireApprovalForBroker: boolean;
        maxSecretRefTtlMinutes: number;
        allowNetworkInLocalMode: boolean;
        auditRawPrompt: boolean;
        storeRawSecrets: boolean;
        enterpriseLocked?: boolean;
    };
    secretTypes: Partial<Record<SecretType, SecretHandlingAction>>;
    allowedBrokerOperations: BrokerOperation[];
    deniedOperations: string[];
}

export const DEFAULT_SENSITIVE_CONTEXT_POLICY: SensitiveContextPolicy = {
    sensitiveContext: {
        defaultAction: "broker",
        allowRawReveal: false,
        requireApprovalForBroker: true,
        maxSecretRefTtlMinutes: 5,
        allowNetworkInLocalMode: false,
        auditRawPrompt: false,
        storeRawSecrets: false,
    },
    secretTypes: {
        api_key: "broker",
        database_url: "broker",
        private_key: "block",
        ssh_key: "block",
        aadhaar: "redact",
        pan: "redact",
        phone: "redact",
        password: "broker",
    },
    allowedBrokerOperations: [
        "test_database_connection",
        "validate_token_format",
        "validate_api_key_format",
        "generate_config_example_without_values",
        "compare_env_keys",
        "generate_env_example",
        "inspect_secret_metadata",
        "check_url_scheme",
        "validate_jwt_expiry_without_payload_leak",
        "run_safe_config_validation",
    ],
    deniedOperations: ["reveal_secret", "send_secret_to_llm", "run_arbitrary_shell", "exfiltrate_secret", "print_secret"],
};

const ACTIONS = new Set(["block", "redact", "broker", "summarize", "reveal_once", "enterprise_locked"]);

export class SensitiveContextPolicyEngine {
    constructor(private readonly policy: SensitiveContextPolicy = DEFAULT_SENSITIVE_CONTEXT_POLICY) {}

    static loadFromWorkspace(workspacePath: string): SensitiveContextPolicy {
        const file = path.join(workspacePath, ".soterai-policy.json");
        try {
            const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
            return this.parse(parsed);
        } catch {
            return DEFAULT_SENSITIVE_CONTEXT_POLICY;
        }
    }

    static parse(raw: unknown): SensitiveContextPolicy {
        const source = (raw && typeof raw === "object" ? raw : {}) as Partial<SensitiveContextPolicy>;
        const merged: SensitiveContextPolicy = {
            sensitiveContext: { ...DEFAULT_SENSITIVE_CONTEXT_POLICY.sensitiveContext, ...(source.sensitiveContext ?? {}) },
            secretTypes: { ...DEFAULT_SENSITIVE_CONTEXT_POLICY.secretTypes, ...(source.secretTypes ?? {}) },
            allowedBrokerOperations: Array.isArray(source.allowedBrokerOperations)
                ? source.allowedBrokerOperations.filter((op): op is BrokerOperation => typeof op === "string")
                : DEFAULT_SENSITIVE_CONTEXT_POLICY.allowedBrokerOperations,
            deniedOperations: Array.isArray(source.deniedOperations)
                ? source.deniedOperations.filter((op): op is string => typeof op === "string")
                : DEFAULT_SENSITIVE_CONTEXT_POLICY.deniedOperations,
        };
        if (!ACTIONS.has(merged.sensitiveContext.defaultAction)) merged.sensitiveContext.defaultAction = "broker";
        if (!Number.isFinite(merged.sensitiveContext.maxSecretRefTtlMinutes) || merged.sensitiveContext.maxSecretRefTtlMinutes < 1) {
            merged.sensitiveContext.maxSecretRefTtlMinutes = 5;
        }
        if (merged.sensitiveContext.enterpriseLocked) {
            merged.sensitiveContext.allowRawReveal = false;
            merged.sensitiveContext.defaultAction = "enterprise_locked";
        }
        return merged;
    }

    actionFor(type: SecretType): SecretHandlingAction {
        if (this.policy.sensitiveContext.enterpriseLocked) return "enterprise_locked";
        return this.policy.secretTypes[type] ?? this.policy.sensitiveContext.defaultAction;
    }

    canReveal(): boolean {
        return this.policy.sensitiveContext.allowRawReveal && !this.policy.sensitiveContext.enterpriseLocked;
    }

    requiresApproval(): boolean {
        return this.policy.sensitiveContext.requireApprovalForBroker;
    }

    isOperationAllowed(operation: string): operation is BrokerOperation {
        return !this.policy.deniedOperations.includes(operation) && this.policy.allowedBrokerOperations.includes(operation as BrokerOperation);
    }

    ttlMs(): number {
        return this.policy.sensitiveContext.maxSecretRefTtlMinutes * 60 * 1000;
    }

    snapshot(): SensitiveContextPolicy {
        return JSON.parse(JSON.stringify(this.policy));
    }
}
