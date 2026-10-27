import type { GuardAction } from "./types";
import type { PathSensitivity } from "./ProjectPolicy";
import { type ProjectPolicy } from "./ProjectPolicy";
/**
 * AI Safe Mode — one-click strict protection applied uniformly across scans, the
 * Safe Context Builder, the Local AI Broker, terminal checks, and MCP analysis.
 *
 * Three levels, increasing strictness:
 *   developer  — warn on sensitive source, redact secrets, block private keys.
 *   strict     — block protected files, approval for auth/payment/infra, block
 *                risky commands + risky MCP.
 *   enterprise — fail closed: unknown/sensitive defaults to approval_required,
 *                approvals required, local raw content never uploaded.
 *
 * Honest scope: Safe Mode governs what SoterAI-built/brokered flows do. It does
 * not intercept another extension's private file reads — see
 * docs/broker-limitations.md.
 */
export type SafeModeLevel = "developer" | "strict" | "enterprise";
export declare const SAFE_MODE_LEVELS: SafeModeLevel[];
export interface SafeModeState {
    enabled: boolean;
    level: SafeModeLevel;
    updatedAt: string;
}
export interface SafeModeSettings {
    redactPII: boolean;
    blockPrivateKeys: boolean;
    blockProviderTokens: boolean;
    blockDatabaseUrls: boolean;
    blockCustomerDataFiles: boolean;
    blockDangerousTerminalCommands: boolean;
    blockRiskyMCP: boolean;
    requireApprovalForCommandRunnerMCP: boolean;
    scanSafeContextBeforeCopy: boolean;
    scanBrokeredRequests: boolean;
    scanBrokeredResponses: boolean;
    canaryLeakDetection: boolean;
    whatAISawLedger: boolean;
    /** Always false in every Safe Mode level — raw cloud telemetry is off. */
    rawCloudTelemetry: boolean;
    localOnlyMode: boolean;
    /** When true, scanner errors and unknown risk fail closed (block/approval). */
    failClosed: boolean;
}
export interface SafeModePolicy {
    level: SafeModeLevel;
    projectPolicy: ProjectPolicy;
    settings: SafeModeSettings;
    /** Human-readable rules for the "Show Safe Mode Rules" UI. */
    rules: string[];
}
export declare const PRIVATE_KEY_CATEGORIES: string[];
export declare const PROVIDER_TOKEN_CATEGORIES: string[];
export declare const DATABASE_URL_CATEGORIES: string[];
export declare const PII_CATEGORIES: string[];
export declare const DANGEROUS_TERMINAL_CATEGORIES: string[];
export declare const RISKY_MCP_CATEGORIES: string[];
/** Generate the complete policy + settings for a Safe Mode level. */
export declare function generateSafeModePolicy(level: SafeModeLevel): SafeModePolicy;
/** Return the stricter of two actions. */
export declare function strictest(a: GuardAction, b: GuardAction): GuardAction;
export interface SafeModeDecisionInput {
    /** Action already chosen by the base policy evaluator. */
    baseAction: GuardAction;
    /** Detector categories present in the content. */
    categories: string[];
    riskScore: number;
    /** Path sensitivity, when the content came from a classified file. */
    pathClassification?: PathSensitivity;
    /** True when a planted canary token appeared — must never pass. */
    canaryPresent?: boolean;
    /** True when a scanner threw and we must fail closed per settings. */
    scannerError?: boolean;
}
/**
 * Escalate a base action according to a Safe Mode level. Safe Mode can only make
 * a decision STRICTER, never looser. A canary is always blocked.
 */
export declare function applySafeMode(level: SafeModeLevel, input: SafeModeDecisionInput): GuardAction;
//# sourceMappingURL=SafeMode.d.ts.map