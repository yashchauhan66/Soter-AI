export type PrivacyLogMode = "metadata_only" | "redacted_prompt" | "full_prompt_explicit_admin_enabled";
export type PrivacyContextType = "prompt" | "response" | "file" | "fingerprint" | "lineage" | "approval";

export interface PrivacySafePreviewInput {
  rawText: string;
  detectedFindings?: unknown[];
  dataTypes?: string[];
  logMode?: PrivacyLogMode;
  maxLength?: number;
  contextType: PrivacyContextType;
  allowFullText?: boolean;
}

const RAW_CONTENT_KEYS = new Set([
  "rawtext", "prompt", "fullprompt", "filecontent", "copiedtext", "matchedtext", "rawcontent",
  "documentcontent", "response", "rawresponse", "chunktext", "sample", "snippet",
]);

const TEST_SECRET_PATTERNS = [
  /synthetic_api_key_[A-Za-z0-9_-]+/i,
  /fake[_-]?(?:api[_-]?key|secret|token)[=:][^\s"']+/i,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
];

export function redactSensitiveText(input: string): string {
  let text = String(input ?? "");
  const replacements: Array<[RegExp, string]> = [
    [/-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g, "[REDACTED_PRIVATE_KEY]"],
    [/\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g, "[REDACTED_AWS_KEY]"],
    [/\bgh(?:p|o|u|s|r)_[A-Za-z0-9_]{20,255}\b/g, "[REDACTED_GITHUB_TOKEN]"],
    [/\bxox[baprs]-[A-Za-z0-9-]{10,255}\b/g, "[REDACTED_SLACK_TOKEN]"],
    [/\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\b/g, "[REDACTED_JWT]"],
    [/\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|mssql):\/\/[^\s"']+/gi, "[REDACTED_DATABASE_URL]"],
    [/\b(?:sk_(?:live|test|prod|fake)|sk-|pk_(?:live|test))[-_A-Za-z0-9]{8,}\b/gi, "[REDACTED_API_KEY]"],
    [/\b(?:api[_-]?key|access[_-]?key|client[_-]?secret|secret|token)\b\s*[:=]\s*["']?[^\s"']{8,}["']?/gi, "[REDACTED_API_KEY]"],
    [/\b(?:password|passwd|pwd)\b\s*[:=]\s*["']?[^\s"']+["']?/gi, "[REDACTED_PASSWORD]"],
    [/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[REDACTED_EMAIL]"],
    [/(?<!\d)(?:\+?91[-\s]?)?[6-9]\d{9}(?!\d)/g, "[REDACTED_PHONE]"],
    [/(?<!\d)\d{4}[ -]?\d{4}[ -]?\d{4}(?!\d)/g, "[REDACTED_AADHAAR]"],
    [/\b[A-Z]{5}\d{4}[A-Z]\b/g, "[REDACTED_PAN]"],
    [/\b\d{2}[A-Z]{5}\d{4}[A-Z][A-Z0-9]Z[A-Z0-9]\b/g, "[REDACTED_GSTIN]"],
    [/\b[A-Za-z0-9._-]{2,256}@[A-Za-z]{2,64}\b/g, "[REDACTED_UPI]"],
    [/\b[A-Z]{4}0[A-Z0-9]{6}\b/g, "[REDACTED_IFSC]"],
    [/(?<!\d)(?:\d[ -]*?){13,19}(?!\d)/g, "[REDACTED_CREDIT_CARD]"],
    [/\b(?:10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2})\b/g, "[REDACTED_INTERNAL_IP]"],
    [/(?:[A-Za-z]:\\(?:[^\s<>:"|?*]+\\)*[^\s<>:"|?*]*|\/(?:Users|home|root|var|etc|opt|srv)\/[A-Za-z0-9._/~-]+)/g, "[REDACTED_LOCAL_PATH]"],
    [/\bhttps?:\/\/(?:localhost|[^\s/"']+\.(?:local|internal|corp|lan))(?:\/[^\s"']*)?/gi, "[REDACTED_INTERNAL_URL]"],
    [/\b[A-Z][A-Z0-9_]{2,}\s*=\s*(?!\[REDACTED_)[^\s#]+/g, "[REDACTED_ENV_VAR]"],
  ];
  for (const [pattern, replacement] of replacements) text = text.replace(pattern, replacement);
  return text;
}

export function createPrivacySafePreview(input: PrivacySafePreviewInput): string {
  const maxLength = Math.max(0, Math.min(input.maxLength ?? 500, 1000));
  if (input.logMode === "metadata_only") return cap("[METADATA_ONLY]", maxLength);
  if (input.contextType === "fingerprint" || input.dataTypes?.includes("company_fingerprint_match")) {
    return cap("Fingerprint match detected against confidential dataset; raw matched text not retained", maxLength);
  }

  const raw = String(input.rawText ?? "");
  const redacted = redactSensitiveText(raw);
  const explicitlyRedacted = redacted !== raw || /\[REDACTED_[A-Z0-9_]+\]/.test(redacted);
  const fullTextAllowed = input.allowFullText === true && input.logMode === "full_prompt_explicit_admin_enabled";

  if (fullTextAllowed) return cap(redacted, maxLength);
  if (explicitlyRedacted) return cap(redacted || markerFor(input.contextType), maxLength);
  return cap(markerFor(input.contextType), maxLength);
}

export function containsDisallowedRawField(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (RAW_CONTENT_KEYS.has(key.toLowerCase())) return key;
    const child = containsDisallowedRawField(nested);
    if (child) return `${key}.${child}`;
  }
  return null;
}

export function sanitizePrivacyPayload(value: unknown, key = ""): unknown {
  if (Array.isArray(value)) return value.map((item) => sanitizePrivacyPayload(item));
  if (value && typeof value === "object") {
    const safe: Record<string, unknown> = {};
    for (const [nestedKey, nestedValue] of Object.entries(value as Record<string, unknown>)) {
      if (RAW_CONTENT_KEYS.has(nestedKey.toLowerCase())) continue;
      safe[nestedKey] = sanitizePrivacyPayload(nestedValue, nestedKey);
    }
    return safe;
  }
  if (typeof value === "string") {
    if (/preview|evidence/i.test(key)) {
      return createPrivacySafePreview({ rawText: value, contextType: key.toLowerCase().includes("fingerprint") ? "fingerprint" : "prompt", logMode: "redacted_prompt", maxLength: 1000 });
    }
    return redactSensitiveText(value).slice(0, 2000);
  }
  return value;
}

export function assertNoRawSensitiveData(payload: unknown): void {
  const serialized = JSON.stringify(payload);
  const match = TEST_SECRET_PATTERNS.find((pattern) => pattern.test(serialized));
  if (match) throw new Error("Privacy assertion failed: outgoing payload contains raw fake sensitive data.");
}

function markerFor(contextType: PrivacyContextType) {
  if (contextType === "prompt") return "[CLEAN_PROMPT_NOT_STORED]";
  if (contextType === "response") return "[CLEAN_RESPONSE_NOT_STORED]";
  if (contextType === "file") return "[FILE_CONTENT_NOT_STORED]";
  if (contextType === "lineage") return "[LINEAGE_CONTENT_NOT_STORED]";
  if (contextType === "approval") return "[APPROVAL_CONTENT_NOT_STORED]";
  return "[METADATA_ONLY]";
}

function cap(value: string, maxLength: number) {
  if (maxLength === 0) return "";
  return value.length <= maxLength ? value : value.slice(0, maxLength);
}
