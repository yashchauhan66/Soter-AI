import { DEFAULT_POLICY_VERSION, EXTENSION_STATE_KEY, POLICY_CACHE_KEY } from "../../../../packages/shared/src/constants";
import type { ExtensionOrgPolicy } from "../../../../packages/policy-engine/src/types";
import type { ExtensionState } from "./types";
import { BUILT_IN_AI_DESTINATIONS } from "../../../../packages/shared/src/ai-destinations";
import { createStorageSafeScanResult } from "./privacy-preview";

const defaultPolicy: ExtensionOrgPolicy = {
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

export const defaultState: ExtensionState = {
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

export async function getState(): Promise<ExtensionState> {
  const stored = await chrome.storage.local.get<Record<string, ExtensionState>>([EXTENSION_STATE_KEY]);
  return { ...defaultState, ...(stored[EXTENSION_STATE_KEY] ?? {}) };
}

export async function setState(update: Partial<ExtensionState>) {
  const current = await getState();
  const safeUpdate = update.latestScan
    ? { ...update, latestScan: await createStorageSafeScanResult(update.latestScan, update.latestScan.redactedText) }
    : update;
  const next = { ...current, ...safeUpdate, config: { ...current.config, ...(safeUpdate.config ?? {}) } };
  await chrome.storage.local.set({ [EXTENSION_STATE_KEY]: next });
  return next;
}

export async function getCachedPolicy() {
  const stored = await chrome.storage.local.get<Record<string, ExtensionOrgPolicy>>([POLICY_CACHE_KEY]);
  return stored[POLICY_CACHE_KEY] ?? (await getState()).policy ?? defaultPolicy;
}

export async function cachePolicy(policy: ExtensionOrgPolicy) {
  await chrome.storage.local.set({ [POLICY_CACHE_KEY]: policy });
  await setState({ policy, policySyncStatus: "fresh" });
}
