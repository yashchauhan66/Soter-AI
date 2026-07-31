import { scanText } from "../../../../packages/detectors/src/index";
import { evaluatePolicy } from "../../../../packages/policy-engine/src/evaluatePolicy";
import type { DestinationType } from "../../../../packages/policy-engine/src/types";
import { auditSafePreview, redactSensitiveText } from "./redaction";
import { rewritePromptSafely } from "./rewrite";
import type { ExtensionState, ScanEventType, ScanResult } from "./types";
import { matchAIDestination } from "../../../../packages/shared/src/ai-destinations";

export function destinationTypeForUrl(url: string, state?: ExtensionState): DestinationType {
  const configured = state ? matchAIDestination(url, state.policy?.destinations ?? [], state.config.department, state.config.role) : undefined;
  if (configured) return configured.category;
  const domain = domainFromUrl(url);
  if (/chatgpt\.com|openai\.com|claude\.ai|gemini\.google\.com|bard\.google\.com|perplexity\.ai|poe\.com$/i.test(domain)) {
    return "public_ai";
  }
  return "unknown";
}

export function domainFromUrl(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "unknown";
  }
}

export function scanPrompt(text: string, url: string, state: ExtensionState, eventType: ScanEventType = "scan"): ScanResult {
  const localScan = scanText(text.slice(0, state.policy?.maxPromptChars ?? 20000));
  const customDetectedDataTypes = detectCustomPolicyMatches(text, state.policy);
  const detectedDataTypes = Array.from(new Set([...localScan.detectedDataTypes, ...customDetectedDataTypes])).sort();
  const riskScore = Math.min(100, localScan.riskScore + customDetectedDataTypes.length * 20);
  const domain = domainFromUrl(url);
  const policy = state.policy;
  if (!policy) throw new Error("Soter policy cache is not initialized.");

  const failClosed = failClosedDecision(state, policy);
  if (failClosed) {
    const redactedText = redactSensitiveText(text, detectedDataTypes);
    // SS-11: `rewrittenSafeText` used to be the *raw* prompt here. Every consumer treats
    // that field as the safe variant — the overlay renders it as "Redacted/Safe Preview",
    // "Use safe prompt" writes it back into the page input and replays the submit, and
    // "Copy safe prompt" puts it on the clipboard. A fail-closed block therefore handed
    // the unredacted text (secrets included) straight back to the page it had just
    // refused. In a state where the extension cannot trust its own policy, the only
    // text it may emit is the redacted one.
    return {
      hasFindings: true,
      riskScore: 100,
      detectedDataTypes: Array.from(new Set([...detectedDataTypes, failClosed.dataType])),
      findings: localScan.findings.map((finding) => ({ ...finding, match: auditSafePreview(finding.match, [finding.type], 120) })),
      action: "block",
      policy: {
        action: "block",
        severity: "critical",
        matchedRules: [{ id: failClosed.id, name: failClosed.name, action: "block", severity: "critical" }],
        userMessage: failClosed.userMessage,
        adminMessage: failClosed.adminMessage,
        redactedText,
        rewrittenSafeText: redactedText,
        auditMetadata: {},
      },
      redactedText,
      rewrittenSafeText: redactedText,
      scannedAt: new Date().toISOString(),
    };
  }
  const destination = matchAIDestination(url, policy.destinations ?? [], state.config.department, state.config.role);
  const destinationRules = Object.entries(destination?.policyOverrides ?? {}).map(([dataType, action]) => ({
    id: `destination-${destination?.destinationId}-${dataType}`,
    name: `${destination?.name}: ${dataType}`,
    action,
    detectedDataTypes: dataType === "secrets" ? ["env_file", "api_key", "aws_access_key", "github_token", "slack_token", "jwt", "private_key", "database_url", "password"] : [dataType],
    destinations: [domain],
  }));
  let evaluation = evaluatePolicy({
    organizationId: state.config.organizationId,
    employeeId: state.config.employeeId,
    department: state.config.department,
    role: state.config.role,
    destinationDomain: domain,
    destinationType: destinationTypeForUrl(url, state),
    text,
    detectedDataTypes,
    riskScore,
    defaultOrgPolicy: policy,
    customRules: destinationRules,
  });
  const lockdownAction = emergencyLockdownAction({
    state,
    destinationType: destination?.category ?? destinationTypeForUrl(url, state),
    detectedDataTypes,
    eventType,
  });
  if (lockdownAction) {
    evaluation = {
      ...evaluation,
      action: lockdownAction,
      severity: lockdownAction === "block" ? "critical" : "high",
      matchedRules: [{ id: "emergency-lockdown", name: "Emergency lockdown", action: lockdownAction, severity: lockdownAction === "block" ? "critical" : "high" }],
      userMessage: lockdownAction === "block" ? "Blocked by your organization's emergency AI lockdown." : "Approval is required during emergency AI lockdown.",
      adminMessage: "Emergency lockdown policy enforced locally by the extension.",
    };
  }
  const redactedText = redactSensitiveText(text, detectedDataTypes);
  return withHardEnforcement({
    hasFindings: localScan.findings.length > 0 || customDetectedDataTypes.length > 0,
    riskScore,
    detectedDataTypes,
    findings: localScan.findings.map((finding) => ({ ...finding, match: auditSafePreview(finding.match, [finding.type], 120) })),
    action: evaluation.action,
    policy: { ...evaluation, redactedText, rewrittenSafeText: rewritePromptSafely(redactedText, detectedDataTypes, evaluation.action) },
    redactedText,
    rewrittenSafeText: rewritePromptSafely(redactedText, detectedDataTypes, evaluation.action),
    scannedAt: new Date().toISOString(),
  }, hardEnforcementEnabled(state));
}

/**
 * Positive tamper signals. These mean the policy bundle was modified, replayed or
 * issued for another tenant — not merely that no key is configured.
 */
const POLICY_TAMPER_CODES = new Set(["malformed", "unsupported_algorithm", "organization_mismatch", "hash_mismatch", "signature_mismatch", "rollback"]);

/**
 * Rule ids the fail-closed gate emits. A block carrying one of these is not a normal
 * policy decision about the *content* — it means the extension cannot currently trust the
 * policy it would otherwise evaluate, so no remediation path may put text back into the
 * page or submit anything (SS-11).
 */
export const FAIL_CLOSED_RULE_IDS: readonly string[] = [
  "policy-integrity-fail-closed",
  "policy-signature-required-fail-closed",
  "offline-fail-closed",
];

/** True when this result came from the fail-closed gate rather than content evaluation. */
export function isFailClosedBlock(result: ScanResult) {
  return result.action === "block"
    && result.policy.matchedRules.some((rule) => FAIL_CLOSED_RULE_IDS.includes(rule.id));
}

/**
 * What the enforcement overlay is allowed to offer for a decision. Kept here, next to the
 * decision itself, so the UI cannot invent an affordance the kernel did not authorise.
 *
 *  - `canReplace`          — may write `rewrittenSafeText` into the page input.
 *  - `canSubmitSafeText`   — may then replay the submit with that transformed text.
 *  - `canSubmitOriginal`   — may the text as typed reach the destination.
 *
 * A fail-closed block allows none of the three: an audited dismiss (which never submits) is
 * the only way out, and the redacted preview may still be copied for the user's own records.
 */
export function remediationAffordances(result: ScanResult): {
  canReplace: boolean;
  canSubmitSafeText: boolean;
  canSubmitOriginal: boolean;
  canCopyPreview: boolean;
} {
  if (isFailClosedBlock(result)) {
    return { canReplace: false, canSubmitSafeText: false, canSubmitOriginal: false, canCopyPreview: true };
  }
  if (result.action === "block") {
    return { canReplace: true, canSubmitSafeText: true, canSubmitOriginal: false, canCopyPreview: true };
  }
  return { canReplace: true, canSubmitSafeText: true, canSubmitOriginal: !shouldPreventSubmit(result.action), canCopyPreview: true };
}

interface FailClosedDecision {
  id: string;
  name: string;
  dataType: string;
  userMessage: string;
  adminMessage: string;
}

/**
 * SS-4: a single fail-closed gate covering every state in which the extension cannot
 * trust the policy it is enforcing.
 *
 * Previously only `policySyncStatus === "offline"` was gated, and only when a
 * fail-closed flag was set — so a *tampered* bundle (which sets `"error"`) fell through
 * to normal evaluation against a policy the extension had already refused to trust.
 * A tamper signal now blocks regardless of the availability flag, because it is a
 * positive attack signal rather than a connectivity problem.
 */
function failClosedDecision(state: ExtensionState, policy: NonNullable<ExtensionState["policy"]>): FailClosedDecision | undefined {
  const integrity = state.policyIntegrity;
  if (integrity && !integrity.verified && POLICY_TAMPER_CODES.has(integrity.code)) {
    return {
      id: "policy-integrity-fail-closed",
      name: "Policy Integrity Fail-Closed",
      dataType: "policy_tamper_block",
      userMessage: "Blocked: Soter could not verify your organization's security policy. Contact your administrator.",
      adminMessage: `Policy integrity check failed (${integrity.code}); extension is failing closed locally.`,
    };
  }
  if (state.config.requirePolicySignature === true && integrity?.verified !== true) {
    return {
      id: "policy-signature-required-fail-closed",
      name: "Signed Policy Required",
      dataType: "policy_unverified_block",
      userMessage: "Blocked: your organization requires a cryptographically signed Soter policy, which is not available.",
      adminMessage: "requirePolicySignature is enabled but no verified policy bundle is present.",
    };
  }
  if (
    (state.policySyncStatus === "offline" || state.policySyncStatus === "error") &&
    (policy.offlineFailClosed || state.config.offlineFailClosed)
  ) {
    return {
      id: "offline-fail-closed",
      name: "Offline Fail-Closed Policy",
      dataType: "offline_block",
      userMessage: "Blocked by your organization's offline fail-closed policy (Soter is offline).",
      adminMessage: "Offline fail-closed policy enforced locally by the extension.",
    };
  }
  return undefined;
}

/** True when hard enforcement is on via signed org policy OR managed config. */export function hardEnforcementEnabled(state: ExtensionState) {
  return state.policy?.hardEnforcement === true || state.config.hardEnforcement === true;
}

/**
 * Tags a `block` result with the `hard-enforcement-block` rule so the overlay
 * renders a locked, non-dismissible block (the user cannot casually close it
 * and re-submit). No-op for non-block actions or when hard enforcement is off.
 * Idempotent — will not add the rule twice.
 */
export function withHardEnforcement(result: ScanResult, enabled: boolean): ScanResult {
  if (!enabled || result.action !== "block") return result;
  if (result.policy.matchedRules.some((rule) => rule.id === "hard-enforcement-block")) return result;
  return {
    ...result,
    policy: {
      ...result.policy,
      matchedRules: [
        { id: "hard-enforcement-block", name: "Hard enforcement block", action: "block", severity: "critical" },
        ...result.policy.matchedRules,
      ],
      userMessage: result.policy.userMessage
        || "Blocked by your organization's enforcement policy. This submission cannot be sent.",
    },
  };
}

export function emergencyLockdownAction(input: {
  state: ExtensionState;
  destinationType: DestinationType;
  detectedDataTypes: string[];
  eventType: ScanEventType;
}): "block" | "require_approval" | null {
  const lockdown = input.state.policy?.emergencyLockdown;
  if (!lockdown?.enabled) return null;
  if (input.eventType === "file_upload" && lockdown.blockAllFileUploads) return "block";
  if (lockdown.allowOnlyEnterpriseDestinations && !["enterprise_ai", "internal"].includes(input.destinationType)) return "block";
  if (input.detectedDataTypes.some((type) => lockdown.blockedDataTypes.includes(type))) return "block";
  if (input.detectedDataTypes.some((type) => lockdown.requireApprovalDataTypes.includes(type))) return "require_approval";
  return null;
}

export function shouldPreventSubmit(action: ScanResult["action"]) {
  return action === "block" || action === "require_approval" || action === "require_justification";
}

export function eventName(eventType: ScanEventType) {
  return eventType === "submit" ? "submit" : eventType;
}

function detectCustomPolicyMatches(text: string, policy: ExtensionState["policy"]) {
  const custom = policy as typeof policy & { customDetectors?: { keywords?: string[]; regex?: string[]; documentFingerprints?: string[] } };
  const matches: string[] = [];
  const normalized = text.toLowerCase();
  if (custom?.customDetectors?.keywords?.some((keyword) => keyword && normalized.includes(keyword.toLowerCase()))) matches.push("custom_keyword");
  for (const pattern of custom?.customDetectors?.regex ?? []) {
    try {
      if (new RegExp(pattern, "i").test(text)) {
        matches.push("custom_regex");
        break;
      }
    } catch {
      continue;
    }
  }
  return matches;
}
