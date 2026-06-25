export interface RedactionResult {
  originalText: string;
  redactedText: string;
  hasPII: boolean;
  detectedTypes: string[];
}

const PII_RULES = [
  { pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, label: "Email", replacement: "[REDACTED_EMAIL]" },
  { pattern: /(?<!\d)(?!\d{4}[ -]\d{4}[ -]\d{4}(?:[ -]\d{4})?(?!\d))(?:\+\d{1,3}[\s.-]?)?(?:\(\d{2,4}\)[\s.-]?|\d{2,4}[\s.-])\d{3,4}[\s.-]\d{3,4}(?!\d)/g, label: "Phone", replacement: "[REDACTED_PHONE]" },
  { pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g, label: "IP Address", replacement: "[REDACTED_IP]" },
  { pattern: /\b(?:\d[ -]*?){13,19}\b/g, label: "Credit Card", replacement: "[REDACTED_CARD]" },
  { pattern: /\b(?:DOB|date of birth|born on)\s*[:=-]?\s*\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/gi, label: "Date of Birth", replacement: "[REDACTED_DOB]" },
  { pattern: /\b(?:address|residing at|lives at)\s*[:=-]\s*[^\n,]{5,},[^\n]{3,}/gi, label: "Address", replacement: "[REDACTED_ADDRESS]" },
  // India specific
  { pattern: /\b[A-Z]{5}\d{4}[A-Z]\b/g, label: "PAN Card", replacement: "[REDACTED_PAN]" },
  { pattern: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, label: "Aadhaar Card", replacement: "[REDACTED_AADHAAR]" }
];

/**
 * Redacts Personally Identifiable Information (PII) from a given text string.
 * @param text The input text to scan and redact.
 * @returns A RedactionResult object containing the clean text.
 */
export function redactPII(text: string): RedactionResult {
  let redactedText = text;
  const detectedTypes = new Set<string>();

  for (const rule of PII_RULES) {
    if (rule.pattern.test(text)) {
      detectedTypes.add(rule.label);
      // Reset lastIndex because we just tested it
      rule.pattern.lastIndex = 0;
      redactedText = redactedText.replace(rule.pattern, rule.replacement);
    }
  }

  return {
    originalText: text,
    redactedText,
    hasPII: detectedTypes.size > 0,
    detectedTypes: Array.from(detectedTypes)
  };
}
