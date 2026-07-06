import type { GuardAction } from "./types";
import type { PathSensitivity } from "./ProjectPolicy";
import { PROJECT_POLICY_VERSION, type ProjectPolicy } from "./ProjectPolicy";

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

export const SAFE_MODE_LEVELS: SafeModeLevel[] = ["developer", "strict", "enterprise"];

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

// ─── Category groups (from the detector `type` vocabulary) ───────────────────

export const PRIVATE_KEY_CATEGORIES = ["private_key"];

export const PROVIDER_TOKEN_CATEGORIES = [
    "ai_api_key", "anthropic_api_key", "openai_api_key", "gemini_api_key",
    "deepseek_api_key", "groq_api_key", "aws_access_key", "aws_secret_key",
    "github_token", "gitlab_token", "slack_token", "stripe_key", "razorpay_key",
    "bearer_token", "generic_api_key", "webhook_secret", "jwt",
];

export const DATABASE_URL_CATEGORIES = ["database_url"];

export const PII_CATEGORIES = [
    "email", "phone_number", "ssn", "credit_card", "ip_address", "address",
    "date_of_birth", "aadhaar", "pan", "gstin", "ifsc", "upi_id",
    "indian_passport", "voter_id",
];

export const DANGEROUS_TERMINAL_CATEGORIES = [
    "destructive_rm", "force_delete", "disk_wipe", "fork_bomb", "reverse_shell",
    "remote_exec", "remote_write", "encoded_exec", "priv_escalation", "setuid",
    "credential_access", "key_access", "env_dump", "data_exfil", "history_clear",
    "k8s_destructive", "docker_privileged", "docker_cleanup",
];

export const RISKY_MCP_CATEGORIES = [
    "mcp_command_exec", "mcp_remote_url", "mcp_env_secret", "mcp_api_key",
];

/** Files that commonly hold customer/PII data — matched by path pattern. */
const CUSTOMER_DATA_PATTERNS = [
    "**/customer-*.csv", "**/customers*.csv", "**/users*.csv", "**/pii*.csv",
    "**/*.customers.json", "**/exports/*.csv",
];

const PROTECTED_FILE_PATTERNS = [
    ".env", ".env.*", "**/*.pem", "**/*.key", "**/id_rsa", "**/id_dsa",
    "**/credentials", "**/secrets.*", "**/*.p12", "**/*.pfx",
    "**/production*.json", "**/prod.env",
];

const SENSITIVE_PATH_PATTERNS = [
    "src/auth/**", "src/payments/**", "infra/**", "prisma/schema.prisma",
    "**/terraform/**", "**/.aws/**",
];

/** Generate the complete policy + settings for a Safe Mode level. */
export function generateSafeModePolicy(level: SafeModeLevel): SafeModePolicy {
    const base = {
        redactPII: true,
        blockPrivateKeys: true,
        blockProviderTokens: true,
        blockDatabaseUrls: true,
        blockCustomerDataFiles: true,
        blockDangerousTerminalCommands: true,
        blockRiskyMCP: true,
        requireApprovalForCommandRunnerMCP: true,
        scanSafeContextBeforeCopy: true,
        scanBrokeredRequests: true,
        scanBrokeredResponses: true,
        canaryLeakDetection: true,
        whatAISawLedger: true,
        rawCloudTelemetry: false,
        localOnlyMode: true,
        failClosed: false,
    };

    let projectPolicy: ProjectPolicy;
    let settings: SafeModeSettings;

    if (level === "developer") {
        settings = { ...base };
        projectPolicy = makePolicy("standard", {
            defaultAction: "warn",
            protectedFileAction: "block",
            sensitivePathAction: "warn",
            allowSessionMinutes: 30,
        });
    } else if (level === "strict") {
        settings = { ...base };
        projectPolicy = makePolicy("strict", {
            defaultAction: "warn",
            protectedFileAction: "block",
            sensitivePathAction: "approval_required",
            allowSessionMinutes: 15,
        });
    } else {
        // enterprise — fail closed
        settings = { ...base, failClosed: true };
        projectPolicy = makePolicy("enterprise", {
            defaultAction: "approval_required",
            protectedFileAction: "block",
            sensitivePathAction: "approval_required",
            allowSessionMinutes: 10,
        });
    }

    return { level, projectPolicy, settings, rules: describeSafeMode(level, settings) };
}

function makePolicy(
    mode: ProjectPolicy["mode"],
    ai: ProjectPolicy["aiContext"],
): ProjectPolicy {
    return {
        version: PROJECT_POLICY_VERSION,
        mode,
        protectedFiles: [...PROTECTED_FILE_PATTERNS, ...CUSTOMER_DATA_PATTERNS],
        sensitivePaths: [...SENSITIVE_PATH_PATTERNS],
        aiContext: { ...ai },
        cloud: { enabled: false, sendRawContent: false },
    };
}

// ─── Decision escalation ─────────────────────────────────────────────────────

const ACTION_RANK: Record<GuardAction, number> = {
    allow: 0,
    warn: 1,
    redact: 2,
    approval_required: 3,
    block: 4,
};

/** Return the stricter of two actions. */
export function strictest(a: GuardAction, b: GuardAction): GuardAction {
    return ACTION_RANK[a] >= ACTION_RANK[b] ? a : b;
}

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
export function applySafeMode(level: SafeModeLevel, input: SafeModeDecisionInput): GuardAction {
    const { settings } = generateSafeModePolicy(level);
    let action = input.baseAction;
    const cats = new Set(input.categories);
    const has = (group: string[]) => group.some((c) => cats.has(c));

    // A leaked canary is unambiguous — always block.
    if (input.canaryPresent) return "block";

    if (settings.blockPrivateKeys && has(PRIVATE_KEY_CATEGORIES)) {
        action = strictest(action, "block");
    }
    if (has(PROVIDER_TOKEN_CATEGORIES)) {
        // developer redacts provider tokens; strict/enterprise block them.
        action = strictest(action, level === "developer" ? "redact" : "block");
    }
    if (settings.blockDatabaseUrls && has(DATABASE_URL_CATEGORIES)) {
        action = strictest(action, level === "developer" ? "redact" : "block");
    }
    if (settings.redactPII && has(PII_CATEGORIES)) {
        action = strictest(action, "redact");
    }
    if (settings.blockDangerousTerminalCommands && has(DANGEROUS_TERMINAL_CATEGORIES)) {
        action = strictest(action, "block");
    }
    if (settings.blockRiskyMCP && has(RISKY_MCP_CATEGORIES)) {
        action = strictest(
            action,
            has(["mcp_command_exec"]) && level !== "developer" ? "block" : "approval_required",
        );
    }

    // Path-based escalation.
    if (input.pathClassification === "protected") {
        action = strictest(action, "block");
    } else if (input.pathClassification === "sensitive") {
        action = strictest(action, "approval_required");
    }

    // Fail-closed levels never allow silently.
    if (settings.failClosed) {
        if (input.scannerError) return "block";
        if (input.riskScore > 0 && ACTION_RANK[action] < ACTION_RANK["approval_required"]) {
            action = "approval_required";
        }
    } else if (input.scannerError) {
        action = strictest(action, "warn");
    }

    return action;
}

function describeSafeMode(level: SafeModeLevel, s: SafeModeSettings): string[] {
    const rules: string[] = [
        "Block .env* and private keys",
        "Block AWS/GitHub/OpenAI/Anthropic/Gemini tokens" + (level === "developer" ? " (redacted at Developer level)" : ""),
        "Block database connection URLs" + (level === "developer" ? " (redacted at Developer level)" : ""),
        "Block customer-data files by pattern",
        "Redact PII before sharing with AI",
        `Require approval for src/auth/**, src/payments/**, infra/** (${level === "developer" ? "warn" : "approval_required"})`,
        "Block dangerous terminal commands",
        "Block risky MCP servers; command-runner MCP requires approval",
        "Scan all safe context before copy",
        "Scan all brokered AI requests and responses",
        "Canary leak detection enabled",
        "What AI Saw ledger enabled",
        "Raw cloud telemetry disabled — local-only by default",
    ];
    if (s.failClosed) rules.push("Fail closed: unknown/sensitive content defaults to approval_required");
    return rules;
}
