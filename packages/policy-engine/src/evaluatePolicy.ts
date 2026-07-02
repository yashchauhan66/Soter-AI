import { ACTION_PRECEDENCE, maxAction, maxSeverity } from "./actions";
import { severityForRiskScore, thresholdAction } from "./riskScore";
import type { ExtensionPolicyRule, PolicyAction, PolicyEvaluationInput, PolicyEvaluationResult, PolicySeverity } from "./types";

const SECRET_OR_PII = /(api[_-]?key|secret|token|password|jwt|aws|github|slack|private_key|database_url|aadhaar|pan|gstin|upi|ifsc|credit_card|email|phone_number)/i;

export function evaluatePolicy(input: PolicyEvaluationInput): PolicyEvaluationResult {
  const policy = input.defaultOrgPolicy;
  const rules = [...(policy.rules ?? []), ...(input.customRules ?? [])].filter((rule) => rule.enabled !== false);
  const matchedRules = rules.filter((rule) => ruleMatches(rule, input));
  const thresholdBasedAction = thresholdAction(input.riskScore, policy.riskThresholds);
  const matchedActions = matchedRules.map((rule) => rule.action);
  const action = !policy.enabled ? "allow" : maxAction([policy.defaultAction, thresholdBasedAction, ...matchedActions]);
  const severity = maxSeverity([severityForRiskScore(input.riskScore), ...matchedRules.map((rule) => rule.severity ?? severityForAction(rule.action))]);
  const redactedText = redactByDataTypes(input.text, input.detectedDataTypes);
  const rewrittenSafeText = rewriteSafePrompt(redactedText, input.detectedDataTypes, action);
  const matched = matchedRules.map((rule) => ({
    id: rule.id,
    name: rule.name,
    action: rule.action,
    severity: rule.severity ?? severityForAction(rule.action),
  }));

  return {
    action,
    severity,
    matchedRules: matched,
    userMessage: userMessageFor(action, matchedRules[0]?.userMessage),
    adminMessage: matchedRules[0]?.adminMessage ?? `Soter extension policy selected ${action} for ${input.destinationDomain}.`,
    redactedText,
    rewrittenSafeText,
    auditMetadata: {
      organizationId: input.organizationId,
      employeeId: input.employeeId,
      department: input.department,
      role: input.role,
      destinationDomain: input.destinationDomain,
      destinationType: input.destinationType,
      policyVersion: policy.version,
      detectedDataTypes: input.detectedDataTypes,
      riskScore: input.riskScore,
      matchedRuleIds: matched.map((rule) => rule.id),
      textLength: input.text.length,
      containsSecretOrPii: input.detectedDataTypes.some((type) => SECRET_OR_PII.test(type)),
    },
  };
}

function ruleMatches(rule: ExtensionPolicyRule, input: PolicyEvaluationInput) {
  if (rule.destinations?.length && !rule.destinations.some((domain) => domainMatches(input.destinationDomain, domain))) return false;
  if (rule.destinationTypes?.length && !rule.destinationTypes.includes(input.destinationType)) return false;
  if (rule.departments?.length && !rule.departments.some((value) => value.toLowerCase() === "all") && (!input.department || !includesCaseInsensitive(rule.departments, input.department))) return false;
  if (rule.roles?.length && !rule.roles.some((value) => value.toLowerCase() === "all") && (!input.role || !includesCaseInsensitive(rule.roles, input.role))) return false;
  if (rule.detectedDataTypes?.length && !rule.detectedDataTypes.some((type) => input.detectedDataTypes.includes(type))) return false;
  if (rule.sourceApps?.length && (!input.sourceApp || !includesCaseInsensitive(rule.sourceApps, input.sourceApp))) return false;
  if (rule.sourceCategories?.length && (!input.sourceCategory || !includesCaseInsensitive(rule.sourceCategories, input.sourceCategory))) return false;
  if (rule.destinationCategories?.length && (!input.destinationCategory || !includesCaseInsensitive(rule.destinationCategories, input.destinationCategory))) return false;
  if (rule.fileExtensions?.length && (!input.fileMetadata?.originalExtension || !includesCaseInsensitive(rule.fileExtensions, input.fileMetadata.originalExtension))) return false;
  if (typeof rule.minFileRiskScore === "number" && (input.fileScanResult?.riskScore ?? 0) < rule.minFileRiskScore) return false;
  if (typeof rule.minFingerprintSimilarity === "number" && !(input.fingerprintMatches ?? []).some((match) => match.similarityScore >= rule.minFingerprintSimilarity!)) return false;
  if (typeof rule.minRiskScore === "number" && input.riskScore < rule.minRiskScore) return false;
  if (rule.intent?.length && (!input.intent || !includesCaseInsensitive(rule.intent, input.intent))) return false;
  return true;
}

function domainMatches(actual: string, pattern: string) {
  const normalizedActual = actual.toLowerCase();
  const normalizedPattern = pattern.toLowerCase().replace(/^\*\./, "");
  if (normalizedPattern === "*") return true;
  return normalizedActual === normalizedPattern || normalizedActual.endsWith(`.${normalizedPattern}`);
}

function includesCaseInsensitive(values: string[], value: string) {
  const normalized = value.toLowerCase();
  return values.some((item) => item.toLowerCase() === normalized);
}

function severityForAction(action: PolicyAction): PolicySeverity {
  if (action === "block") return "critical";
  if (action === "require_approval" || action === "require_justification") return "high";
  if (action === "redact" || action === "rewrite") return "medium";
  if (action === "warn") return "low";
  if (action === "log_only") return "info";
  return "info";
}

function userMessageFor(action: PolicyAction, override?: string) {
  if (override) return override;
  switch (action) {
    case "block":
      return "Soter blocked this prompt because it appears to contain sensitive company data.";
    case "require_approval":
      return "Soter requires approval before this prompt can be sent.";
    case "require_justification":
      return "Soter needs a business justification before this prompt can be sent.";
    case "redact":
      return "Soter found sensitive data and prepared a redacted version.";
    case "rewrite":
      return "Soter found sensitive data and prepared a safer rewrite.";
    case "warn":
      return "Soter found possible sensitive data. Review before sending.";
    case "log_only":
      return "Soter logged this policy match for administrator review.";
    default:
      return "Soter did not find policy-blocking sensitive data.";
  }
}

export function redactByDataTypes(text: string, detectedDataTypes: string[]) {
  let output = text;
  const replacements: Array<[RegExp, string]> = [
    [/\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g, "[REDACTED_AWS_KEY]"],
    [/\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{30,255}\b/g, "[REDACTED_GITHUB_TOKEN]"],
    [/\bxox(?:b|p|o|a|r|s)-[A-Za-z0-9-]{10,}\b/g, "[REDACTED_SLACK_TOKEN]"],
    [/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, "[REDACTED_JWT]"],
    [/-----BEGIN (?:RSA |EC |OPENSSH |DSA |)?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH |DSA |)?PRIVATE KEY-----/g, "[REDACTED_PRIVATE_KEY]"],
    [/\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis):\/\/[^\s"'<>]+/gi, "[REDACTED_DATABASE_URL]"],
    [/\b(?:api[_-]?key|secret[_-]?key|access[_-]?token|client[_-]?secret|password|passwd|pwd)\b\s*[:=]\s*["']?[^"'\s]{8,}["']?/gi, "[REDACTED_SECRET]"],
    [/\b[2-9]\d{3}\s?\d{4}\s?\d{4}\b/g, "[REDACTED_AADHAAR]"],
    [/\b[A-Z]{5}[0-9]{4}[A-Z]\b/g, "[REDACTED_PAN]"],
    [/\b[0-3][0-9][A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]\b/g, "[REDACTED_GSTIN]"],
    [/\b[A-Z]{4}0[A-Z0-9]{6}\b/g, "[REDACTED_IFSC]"],
    [/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[REDACTED_EMAIL]"],
    [/(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b/g, "[REDACTED_PHONE]"],
  ];
  for (const [pattern, replacement] of replacements) output = output.replace(pattern, replacement);
  if (detectedDataTypes.includes("credit_card")) output = output.replace(/\b(?:\d[ -]*?){13,19}\b/g, "[REDACTED_CARD]");
  if (detectedDataTypes.includes("production_logs")) {
    output = output
      .replace(/\b(?:10|127)\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, "[REDACTED_INTERNAL_IP]")
      .replace(/\b192\.168\.\d{1,3}\.\d{1,3}\b/g, "[REDACTED_INTERNAL_IP]")
      .replace(/(?:[A-Za-z]:\\|\/(?:home|Users|var|srv)\/)[^\s:]+/g, "[REDACTED_INTERNAL_PATH]");
  }
  return output;
}

/**
 * Safe Context Capsule rewrite — preserves user intent while:
 * - Secrets: remove secret and ask user to share error message only
 * - Source code: preserve structure but remove secrets, private repo names, internal URLs
 * - Customer data: anonymize names/emails/phones
 * - Legal contract: remove parties, amounts, tax IDs, signatures, confidential clauses
 * - HR: remove employee names, salary, IDs
 * - Finance: remove exact amounts, bank IDs, tax IDs
 *
 * Output preserves user intent, removes sensitive details,
 * is copyable, and explains what was changed.
 */
export function rewriteSafePrompt(redactedText: string, detectedDataTypes: string[], action: PolicyAction) {
  if (!detectedDataTypes.length || ACTION_PRECEDENCE[action] < ACTION_PRECEDENCE.redact) return redactedText;

  let text = redactedText;
  const changes: string[] = [];

  // Category-specific rewrite logic
  const categorySet = new Set(detectedDataTypes);

  if (categorySet.has("source_code")) {
    // Preserve code structure but remove secrets, private repo names, internal URLs
    text = text
      .replace(/https?:\/\/[^\s"'<>]*(?:\.internal|\/internal\/)[^\s"'<>]*/gi, "[INTERNAL_URL_REMOVED]")
      .replace(/(?:git@|https?:\/\/)(?:[^@\s]+@)?(?:github|gitlab|bitbucket)(?:\.com)?[:/]\S+/gi, "[REPO_REFERENCE_REMOVED]");
    changes.push("Internal URLs and repository references removed from code");
  }

  if (categorySet.has("customer_data")) {
    // Anonymize names, emails, phones (redaction already handles patterns)
    changes.push("Customer names, emails, and phone numbers anonymized");
  }

  if (categorySet.has("legal_contract")) {
    // Remove parties, amounts, tax IDs, signatures
    text = text
      .replace(/\b(?:party|parties)\s+(?:of the|to this)\s+(?:first|second|third)\s+part\b/gi, "[PARTY_REMOVED]")
      .replace(/\b(?:INR|USD|EUR)\s*\d+(?:[\s.,]?\d+)*\s*(?:lakh|crore|million|billion|thousand)?/gi, "[AMOUNT_REMOVED]")
      .replace(/\b\d{9,10}\b/g, "[TAX_ID_REMOVED]")
      .replace(/\b(sign(?:ed|ature)?|executed)\s+(?:this|the)\s+\d+[a-z]+\s+day/i, "[SIGNATURE_REMOVED]");
    changes.push("Contract parties, amounts, tax IDs, and signatures removed");
  }

  if (categorySet.has("hr_salary")) {
    // Remove employee names, salary, IDs
    text = text
      .replace(/\b(?:employee|staff|team member)\s+(?:name|id|code|number)\s*[:=]\s*\S+/gi, "[EMPLOYEE_INFO_REMOVED]")
      .replace(/\b(?:salary|ctc|compensation)\s*(?:is|:)\s*\S+/gi, "[SALARY_REMOVED]");
    changes.push("Employee names, salary details, and IDs removed");
  }

  if (categorySet.has("financial_text")) {
    // Remove exact amounts, bank IDs, tax IDs
    text = text
      .replace(/\b\d{9,18}\s*(?:bank|account|acct)\s*(?:number|no)?\b/gi, "[ACCOUNT_NUMBER_REMOVED]")
      .replace(/\b(?:revenue|profit|loss|budget)\s*(?:is|:|was|were)\s*\S+/gi, "[FINANCIAL_FIGURE_REMOVED]");
    changes.push("Financial figures and account identifiers removed");
  }

  if (categorySet.has("secrets") || categorySet.has("api_key") || categorySet.has("password")) {
    changes.push("Secret keys, tokens, and passwords removed — share only the error message or context");
  }

  if (categorySet.has("production_logs")) {
    text = text
      .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, "[IP_REMOVED]")
      .replace(/(?:[A-Za-z]:\/|\/(?:home|Users|var|srv|etc)\/)[^\s:]{2,}/g, "[PATH_REMOVED]");
    changes.push("IP addresses, internal paths, and hostnames removed from logs");
  }

  // Add explanation header
  const categories = categorySet.size > 0 ? Array.from(categorySet).join(", ") : "unknown";
  const note = [
    "",
    `┌─ Soter Safe Context Capsule ──────────────────────────────`,
    `│`,
    ...changes.map(c => `│ ✓ ${c}`),
    `│`,
    `│ Data categories: ${categories}`,
    `│`,
    `└──────────────────────────────────────────────────────────`,
  ].join("\n");

  return (text + note).trim();
}
