"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RISKY_MCP_CATEGORIES = exports.DANGEROUS_TERMINAL_CATEGORIES = exports.PII_CATEGORIES = exports.DATABASE_URL_CATEGORIES = exports.PROVIDER_TOKEN_CATEGORIES = exports.PRIVATE_KEY_CATEGORIES = exports.SAFE_MODE_LEVELS = void 0;
exports.generateSafeModePolicy = generateSafeModePolicy;
exports.strictest = strictest;
exports.applySafeMode = applySafeMode;
const ProjectPolicy_1 = require("./ProjectPolicy");
exports.SAFE_MODE_LEVELS = ["developer", "strict", "enterprise"];
// ─── Category groups (from the detector `type` vocabulary) ───────────────────
exports.PRIVATE_KEY_CATEGORIES = ["private_key"];
exports.PROVIDER_TOKEN_CATEGORIES = [
    "ai_api_key", "anthropic_api_key", "openai_api_key", "gemini_api_key",
    "deepseek_api_key", "groq_api_key", "aws_access_key", "aws_secret_key",
    "github_token", "gitlab_token", "slack_token", "stripe_key", "razorpay_key",
    "bearer_token", "generic_api_key", "webhook_secret", "jwt",
];
exports.DATABASE_URL_CATEGORIES = ["database_url"];
exports.PII_CATEGORIES = [
    "email", "phone_number", "ssn", "credit_card", "ip_address", "address",
    "date_of_birth", "aadhaar", "pan", "gstin", "ifsc", "upi_id",
    "indian_passport", "voter_id",
];
exports.DANGEROUS_TERMINAL_CATEGORIES = [
    "destructive_rm", "force_delete", "disk_wipe", "fork_bomb", "reverse_shell",
    "remote_exec", "remote_write", "encoded_exec", "priv_escalation", "setuid",
    "credential_access", "key_access", "env_dump", "data_exfil", "history_clear",
    "k8s_destructive", "docker_privileged", "docker_cleanup",
];
exports.RISKY_MCP_CATEGORIES = [
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
function generateSafeModePolicy(level) {
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
    let projectPolicy;
    let settings;
    if (level === "developer") {
        settings = { ...base };
        projectPolicy = makePolicy("standard", {
            defaultAction: "warn",
            protectedFileAction: "block",
            sensitivePathAction: "warn",
            allowSessionMinutes: 30,
        });
    }
    else if (level === "strict") {
        settings = { ...base };
        projectPolicy = makePolicy("strict", {
            defaultAction: "warn",
            protectedFileAction: "block",
            sensitivePathAction: "approval_required",
            allowSessionMinutes: 15,
        });
    }
    else {
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
function makePolicy(mode, ai) {
    return {
        version: ProjectPolicy_1.PROJECT_POLICY_VERSION,
        mode,
        protectedFiles: [...PROTECTED_FILE_PATTERNS, ...CUSTOMER_DATA_PATTERNS],
        sensitivePaths: [...SENSITIVE_PATH_PATTERNS],
        aiContext: { ...ai },
        cloud: { enabled: false, sendRawContent: false },
    };
}
// ─── Decision escalation ─────────────────────────────────────────────────────
const ACTION_RANK = {
    allow: 0,
    warn: 1,
    redact: 2,
    approval_required: 3,
    block: 4,
};
/** Return the stricter of two actions. */
function strictest(a, b) {
    return ACTION_RANK[a] >= ACTION_RANK[b] ? a : b;
}
/**
 * Escalate a base action according to a Safe Mode level. Safe Mode can only make
 * a decision STRICTER, never looser. A canary is always blocked.
 */
function applySafeMode(level, input) {
    const { settings } = generateSafeModePolicy(level);
    let action = input.baseAction;
    const cats = new Set(input.categories);
    const has = (group) => group.some((c) => cats.has(c));
    // A leaked canary is unambiguous — always block.
    if (input.canaryPresent)
        return "block";
    if (settings.blockPrivateKeys && has(exports.PRIVATE_KEY_CATEGORIES)) {
        action = strictest(action, "block");
    }
    if (has(exports.PROVIDER_TOKEN_CATEGORIES)) {
        // developer redacts provider tokens; strict/enterprise block them.
        action = strictest(action, level === "developer" ? "redact" : "block");
    }
    if (settings.blockDatabaseUrls && has(exports.DATABASE_URL_CATEGORIES)) {
        action = strictest(action, level === "developer" ? "redact" : "block");
    }
    if (settings.redactPII && has(exports.PII_CATEGORIES)) {
        action = strictest(action, "redact");
    }
    if (settings.blockDangerousTerminalCommands && has(exports.DANGEROUS_TERMINAL_CATEGORIES)) {
        action = strictest(action, "block");
    }
    if (settings.blockRiskyMCP && has(exports.RISKY_MCP_CATEGORIES)) {
        action = strictest(action, has(["mcp_command_exec"]) && level !== "developer" ? "block" : "approval_required");
    }
    // Path-based escalation.
    if (input.pathClassification === "protected") {
        action = strictest(action, "block");
    }
    else if (input.pathClassification === "sensitive") {
        action = strictest(action, "approval_required");
    }
    // Fail-closed levels never allow silently.
    if (settings.failClosed) {
        if (input.scannerError)
            return "block";
        if (input.riskScore > 0 && ACTION_RANK[action] < ACTION_RANK["approval_required"]) {
            action = "approval_required";
        }
    }
    else if (input.scannerError) {
        action = strictest(action, "warn");
    }
    return action;
}
function describeSafeMode(level, s) {
    const rules = [
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
    if (s.failClosed)
        rules.push("Fail closed: unknown/sensitive content defaults to approval_required");
    return rules;
}
//# sourceMappingURL=SafeMode.js.map