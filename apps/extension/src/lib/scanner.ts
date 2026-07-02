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
  return {
    hasFindings: localScan.findings.length > 0 || customDetectedDataTypes.length > 0,
    riskScore,
    detectedDataTypes,
    findings: localScan.findings.map((finding) => ({ ...finding, match: auditSafePreview(finding.match, [finding.type], 120) })),
    action: evaluation.action,
    policy: { ...evaluation, redactedText, rewrittenSafeText: rewritePromptSafely(redactedText, detectedDataTypes, evaluation.action) },
    redactedText,
    rewrittenSafeText: rewritePromptSafely(redactedText, detectedDataTypes, evaluation.action),
    scannedAt: new Date().toISOString(),
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
