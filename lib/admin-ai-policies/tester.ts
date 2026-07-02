import { scanText } from "@/packages/detectors/src";
import { redactByDataTypes, rewriteSafePrompt } from "@/packages/policy-engine/src";
import { strictestAction } from "./compiler";
import type { AdminAiPolicy, PolicyAction, PolicyTestInput, PolicyTestResult } from "./types";

export function validateRegexPattern(pattern: string) {
  if (!pattern.trim()) return { ok: false as const, message: "Regex pattern is required." };
  if (pattern.length > 500) return { ok: false as const, message: "Regex pattern is too long." };
  if (/(?:\([^)]*[+*][^)]*\)[+*])|(?:\.\*){3,}|(?:\[[^\]]+\]\*){3,}/.test(pattern)) {
    return { ok: false as const, message: "Regex may cause excessive backtracking. Simplify the pattern." };
  }
  try {
    new RegExp(pattern, "i");
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, message: error instanceof Error ? error.message : "Invalid regex." };
  }
}

export function testPolicy(input: PolicyTestInput): PolicyTestResult {
  const { policy, sampleText, destinationDomain = "chatgpt.com", department, role, userId, fileName } = input;
  const localScan = scanText(sampleText);
  const matchedRules: string[] = [];
  const detectedDataTypes = new Set(localScan.detectedDataTypes);

  if (!policy.enabled) {
    return buildResult(false, [], "allow", policy, Array.from(detectedDataTypes), sampleText);
  }

  if (!scopeMatches(policy, { department, role, userId })) {
    return buildResult(false, [], "allow", policy, Array.from(detectedDataTypes), sampleText);
  }
  if (!destinationMatches(policy, destinationDomain)) {
    return buildResult(false, [], "allow", policy, Array.from(detectedDataTypes), sampleText);
  }

  for (const detectorKey of policy.detectionConfig.detectorKeys) {
    if (detectedDataTypes.has(detectorKey) || semanticTextMatches(detectorKey, sampleText)) matchedRules.push(`detector:${detectorKey}`);
  }
  for (const keyword of policy.detectionConfig.keywords) {
    if (keyword && sampleText.toLowerCase().includes(keyword.toLowerCase())) matchedRules.push(`keyword:${keyword}`);
  }
  for (const pattern of policy.detectionConfig.regex) {
    const valid = validateRegexPattern(pattern);
    if (valid.ok && new RegExp(pattern, "i").test(sampleText)) matchedRules.push(`regex:${pattern}`);
  }
  for (const domain of policy.detectionConfig.domains) {
    if (domainMatches(destinationDomain, domain)) matchedRules.push(`domain:${domain}`);
  }
  for (const name of policy.detectionConfig.fileNames) {
    if (fileName?.toLowerCase().includes(name.toLowerCase())) matchedRules.push(`file:${name}`);
  }
  for (const category of policy.detectionConfig.semanticCategories) {
    if (semanticTextMatches(category, sampleText)) matchedRules.push(`semantic:${category}`);
  }
  for (const fingerprint of policy.detectionConfig.documentFingerprints) {
    if (fingerprint && privacySafeFingerprint(sampleText).startsWith(fingerprint.slice(0, 12))) matchedRules.push(`fingerprint:${fingerprint.slice(0, 12)}`);
  }

  const action = matchedRules.length ? strictestAction([policy.action]) : "allow";
  return buildResult(matchedRules.length > 0, matchedRules, action, policy, Array.from(detectedDataTypes), sampleText);
}

export function evaluateCompiledPolicies(input: {
  policies: AdminAiPolicy[];
  sampleText: string;
  destinationDomain: string;
  department?: string;
  role?: string;
  userId?: string;
}) {
  const results = input.policies.map((policy) => testPolicy({ ...input, policy }));
  const matched = results.filter((result) => result.matched);
  const action = strictestAction(matched.map((result) => result.action));
  return { action, matched };
}

function buildResult(
  matched: boolean,
  matchedRules: string[],
  action: PolicyAction,
  policy: AdminAiPolicy,
  detectedDataTypes: string[],
  sampleText: string,
): PolicyTestResult {
  const redactedOutput = redactByDataTypes(sampleText, detectedDataTypes);
  return {
    matched,
    matchedRules,
    action,
    severity: matched ? policy.severity : "info",
    detectedDataTypes,
    redactedOutput,
    rewrittenSafeOutput: rewriteSafePrompt(redactedOutput, detectedDataTypes, action),
    logPreview: policy.logMode === "metadata_only" ? "[METADATA_ONLY]" : redactedOutput.slice(0, 1000),
  };
}

function scopeMatches(policy: AdminAiPolicy, scope: { department?: string; role?: string; userId?: string }) {
  if (policy.scope.type === "all") return true;
  if (policy.scope.type === "department") return Boolean(scope.department && includes(policy.scope.departments, scope.department));
  if (policy.scope.type === "role") return Boolean(scope.role && includes(policy.scope.roles, scope.role));
  return Boolean(scope.userId && includes(policy.scope.users, scope.userId));
}

function destinationMatches(policy: AdminAiPolicy, destinationDomain: string) {
  if (policy.destinations.preset === "all_ai_tools") return true;
  return policy.destinations.domains.some((domain) => domain === "*" || domainMatches(destinationDomain, domain));
}

function domainMatches(actual: string, pattern: string) {
  const normalizedActual = actual.toLowerCase().replace(/^www\./, "");
  const normalizedPattern = pattern.toLowerCase().replace(/^\*\./, "");
  return normalizedPattern === "*" || normalizedActual === normalizedPattern || normalizedActual.endsWith(`.${normalizedPattern}`);
}

function includes(values: string[], target: string) {
  return values.includes("all") || values.some((value) => value.toLowerCase() === target.toLowerCase());
}

function semanticTextMatches(category: string, text: string) {
  const normalized = text.toLowerCase();
  const patterns: Record<string, RegExp> = {
    customer_data: /\b(customer|client|account|ticket|crm)\b/,
    legal_contract: /\b(contract|agreement|liability|indemnity|nda|governing law)\b/,
    financial_text: /\b(revenue|invoice|budget|forecast|margin|accounting|payable|receivable)\b/,
    hr_salary: /\b(salary|payroll|compensation|employee review|bonus)\b/,
    source_code: /\b(function|class|import|export|const|select\s+.+from)\b/,
    production_logs: /\b(stack trace|exception|trace id|prod|production log|error at)\b/,
    internal_roadmap: /\b(roadmap|strategy|codename|launch plan|private roadmap)\b/,
    investor_data: /\b(investor|fundraising|valuation|cap table|term sheet)\b/,
    support_tickets: /\b(ticket|zendesk|intercom|support case)\b/,
    confidential_notes: /\b(confidential|do not share|internal only)\b/,
  };
  return (patterns[category] ?? new RegExp(escapeRegex(category.replace(/_/g, " ")), "i")).test(normalized);
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function privacySafeFingerprint(text: string) {
  let hash = 2166136261;
  const normalized = text.toLowerCase().replace(/\s+/g, " ").trim();
  for (let i = 0; i < normalized.length; i += 1) {
    hash ^= normalized.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `fp_${(hash >>> 0).toString(16).padStart(8, "0")}_${normalized.length}`;
}
