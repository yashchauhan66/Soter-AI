import { DEFAULT_EXTENSION_API_BASE_URL, DEFAULT_POLICY_VERSION, EXTENSION_STATE_KEY, POLICY_CACHE_KEY } from "../../../../packages/shared/src/constants";
import type { ExtensionOrgPolicy } from "../../../../packages/policy-engine/src/types";
import type { DestinationType } from "../../../../packages/policy-engine/src/types";
import type { ExtensionState } from "./types";
import { BUILT_IN_AI_DESTINATIONS } from "../../../../packages/shared/src/ai-destinations";
import { createStorageSafeScanResult } from "./privacy-preview";

/** Every destination type the content script is ever injected into.
 *
 *  The three built-in rules were scoped to `public_ai` alone, so they matched on seven hostnames and
 *  quietly stopped matching everywhere else the extension runs: an AWS key pasted into a browser
 *  coding sandbox fell through to the risk-threshold ladder and came out `redact` instead of the
 *  `block` the popup names. "unknown" is in this list on purpose — it is the honest floor. The
 *  extension is only ever injected on the hosts in its manifest, all of which are AI destinations,
 *  so a host permission that outruns the destination table can no longer cost the user a rule.
 */
const GUARDED_DESTINATION_TYPES: DestinationType[] = ["public_ai", "browser_coding", "local_ai", "ide", "cli_api", "custom", "unknown"];

const defaultPolicy: ExtensionOrgPolicy = {
  organizationId: "demo-org",
  version: DEFAULT_POLICY_VERSION,
  enabled: true,
  allowedDomains: [],
  monitoredDomains: BUILT_IN_AI_DESTINATIONS.flatMap((destination) => destination.domains),
  defaultAction: "allow",
  maxPromptChars: 20000,
  riskThresholds: { warn: 10, redact: 25, requireApproval: 55, block: 85 },
  rules: [
    {
      id: "local-secret-block",
      name: "Block credentials and secrets",
      action: "block",
      severity: "critical",
      destinationTypes: GUARDED_DESTINATION_TYPES,
      detectedDataTypes: ["env_file", "api_key", "aws_access_key", "github_token", "slack_token", "jwt", "private_key", "database_url", "password"],
    },
    {
      id: "local-india-pii-approval",
      name: "Require approval for India PII",
      action: "require_approval",
      severity: "high",
      destinationTypes: GUARDED_DESTINATION_TYPES,
      detectedDataTypes: ["aadhaar", "pan", "gstin", "upi_id", "ifsc"],
    },
    {
      id: "local-business-redact",
      name: "Redact business-sensitive text",
      action: "redact",
      severity: "medium",
      destinationTypes: GUARDED_DESTINATION_TYPES,
      detectedDataTypes: ["customer_data", "legal_contract", "hr_salary", "financial_text", "source_code", "production_logs"],
    },
  ],
  destinations: BUILT_IN_AI_DESTINATIONS.filter((destination) => ["public_ai", "browser_coding", "local_ai", "custom"].includes(destination.category)).map((destination) => ({ ...destination, organizationId: "demo-org" })),
  updatedAt: new Date(0).toISOString(),
};

export const defaultState: ExtensionState = {
  enabled: true,
  config: {
    apiBaseUrl: DEFAULT_EXTENSION_API_BASE_URL,
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
