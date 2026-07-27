import { SecretReferenceManager } from "./SecretReferenceManager";
import { SensitiveContextPolicyEngine } from "./SensitiveContextPolicy";
import { type BrokerAuditEvent, type BrokerOperation } from "./types";

export interface BrokerRequest {
    operation: string;
    secretRef?: string;
    purpose: string;
    workspace: string;
    approved?: boolean;
    input?: Record<string, unknown>;
}

export interface BrokerResponse {
    allowed: boolean;
    result?: Record<string, unknown>;
    reason?: string;
    audit: BrokerAuditEvent;
}

const MALICIOUS_PURPOSE = /\b(reveal|print|show|dump|exfiltrat|upload|send raw|copy secret|bypass)\b/i;

export class CapabilityBroker {
    constructor(private readonly refs: SecretReferenceManager, private readonly policy: SensitiveContextPolicyEngine) {}

    async handle(request: BrokerRequest): Promise<BrokerResponse> {
        if (!this.policy.isOperationAllowed(request.operation) || MALICIOUS_PURPOSE.test(request.purpose)) {
            return this.block(request, "Operation denied by sensitive context policy");
        }
        const operation = request.operation as BrokerOperation;
        if (!request.approved) return this.block(request, "User approval required for brokered secret use");

        const record = request.secretRef ? await this.refs.lookup(request.secretRef, request.workspace, operation) : undefined;
        if (request.secretRef && !record) return this.block(request, "Secret reference is expired, revoked, out of scope, or not allowed for this operation");

        const result = this.execute(operation, record?.value, request.input);
        const audit: BrokerAuditEvent = {
            timestamp: new Date().toISOString(),
            action: operation,
            verdict: "broker",
            riskCategory: "sensitive_context",
            secretType: record?.type,
            secretHash: record?.hash,
            ref: record?.ref,
            userDecision: "approved",
        };
        return { allowed: true, result, audit };
    }

    private execute(operation: BrokerOperation, value?: string, input?: Record<string, unknown>): Record<string, unknown> {
        switch (operation) {
            case "validate_api_key_format":
            case "validate_token_format":
                return { formatValid: Boolean(value && value.length >= 12), lengthRange: this.lengthRange(value), sanitizedError: undefined };
            case "check_url_scheme":
                return { schemeAllowed: Boolean(value && /^(?:postgres|postgresql|mysql|mongodb|redis|https):\/\//i.test(value)) };
            case "test_database_connection":
                return {
                    hostReachable: false,
                    databaseReachable: false,
                    authSucceeded: false,
                    sanitizedError: "network execution disabled in local privacy mode",
                };
            case "validate_jwt_expiry_without_payload_leak":
                return this.jwtExpiry(value);
            case "generate_env_example":
            case "generate_config_example_without_values":
                return { example: this.exampleFromKeys(input?.keys), valuesIncluded: false };
            case "compare_env_keys":
            case "compare_required_env_keys":
                return { missingKeys: this.compareKeys(input?.requiredKeys, input?.presentKeys), valuesIncluded: false };
            case "inspect_secret_metadata":
                return { typeKnown: true, valueReturned: false, lengthRange: this.lengthRange(value) };
            default:
                return { completed: true, valueReturned: false };
        }
    }

    private block(request: BrokerRequest, reason: string): BrokerResponse {
        return {
            allowed: false,
            reason,
            audit: {
                timestamp: new Date().toISOString(),
                action: request.operation,
                verdict: "block",
                riskCategory: "sensitive_context",
                ref: request.secretRef,
                reason,
            },
        };
    }

    private lengthRange(value?: string): string {
        if (!value) return "unknown";
        if (value.length < 16) return "short";
        if (value.length < 64) return "medium";
        return "long";
    }

    private jwtExpiry(value?: string): Record<string, unknown> {
        if (!value) return { expiryKnown: false };
        const [, payload] = value.split(".");
        try {
            const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { exp?: number };
            return { expiryKnown: typeof parsed.exp === "number", expired: parsed.exp ? parsed.exp * 1000 < Date.now() : undefined };
        } catch {
            return { expiryKnown: false };
        }
    }

    private exampleFromKeys(keys: unknown): string {
        const list = Array.isArray(keys) ? keys.filter((key): key is string => typeof key === "string") : [];
        return list.map((key) => `${key}=`).join("\n");
    }

    private compareKeys(required: unknown, present: unknown): string[] {
        const req = Array.isArray(required) ? required.filter((key): key is string => typeof key === "string") : [];
        const got = new Set(Array.isArray(present) ? present.filter((key): key is string => typeof key === "string") : []);
        return req.filter((key) => !got.has(key));
    }
}
