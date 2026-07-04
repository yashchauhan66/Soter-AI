import { DEFAULT_POLICY_VERSION, EXTENSION_STATE_KEY, POLICY_CACHE_KEY } from "../packages/shared/src/constants.js";
import { BUILT_IN_AI_DESTINATIONS } from "../packages/shared/src/ai-destinations.js";
const defaultPolicy = {
    organizationId: "demo-org",
    version: DEFAULT_POLICY_VERSION,
    enabled: true,
    allowedDomains: [],
    monitoredDomains: ["chatgpt.com", "chat.openai.com", "claude.ai", "gemini.google.com", "perplexity.ai", "poe.com"],
    defaultAction: "allow",
    maxPromptChars: 20000,
    riskThresholds: { warn: 10, redact: 25, requireApproval: 55, block: 85 },
    rules: [
        {
            id: "local-secret-block",
            name: "Block credentials and secrets",
            action: "block",
            severity: "critical",
            destinationTypes: ["public_ai"],
            detectedDataTypes: ["env_file", "api_key", "aws_access_key", "github_token", "slack_token", "jwt", "private_key", "database_url", "password"],
        },
        {
            id: "local-india-pii-approval",
            name: "Require approval for India PII",
            action: "require_approval",
            severity: "high",
            destinationTypes: ["public_ai"],
            detectedDataTypes: ["aadhaar", "pan", "gstin", "upi_id", "ifsc"],
        },
        {
            id: "local-business-redact",
            name: "Redact business-sensitive text",
            action: "redact",
            severity: "medium",
            destinationTypes: ["public_ai"],
            detectedDataTypes: ["customer_data", "legal_contract", "hr_salary", "financial_text", "source_code", "production_logs"],
        },
    ],
    destinations: BUILT_IN_AI_DESTINATIONS.filter((destination) => ["public_ai", "browser_coding", "local_ai", "custom"].includes(destination.category)).map((destination) => ({ ...destination, organizationId: "demo-org" })),
    updatedAt: new Date(0).toISOString(),
};
export const defaultState = {
    enabled: true,
    config: {
        apiBaseUrl: "http://localhost:3000",
        organizationId: "demo-org",
        employeeId: "demo-employee",
    },
    enrollmentStatus: "unenrolled",
    policySyncStatus: "never",
    policy: defaultPolicy,
};
export async function getState() {
    const stored = await chrome.storage.local.get([EXTENSION_STATE_KEY]);
    return { ...defaultState, ...(stored[EXTENSION_STATE_KEY] ?? {}) };
}
export async function setState(update) {
    const current = await getState();
    const next = { ...current, ...update, config: { ...current.config, ...(update.config ?? {}) } };
    await chrome.storage.local.set({ [EXTENSION_STATE_KEY]: next });
    return next;
}
export async function getCachedPolicy() {
    const stored = await chrome.storage.local.get([POLICY_CACHE_KEY]);
    return stored[POLICY_CACHE_KEY] ?? (await getState()).policy ?? defaultPolicy;
}
export async function cachePolicy(policy) {
    await chrome.storage.local.set({ [POLICY_CACHE_KEY]: policy });
    await setState({ policy, policySyncStatus: "fresh" });
}
