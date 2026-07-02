import { runRegexDetectors, type DetectorFinding } from "./core";

const GLOBAL_PII_SPECS = [
  {
    type: "email",
    label: "Email address",
    severity: "medium" as const,
    score: 12,
    pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
    message: "Email address detected.",
  },
  {
    type: "phone_number",
    label: "Phone number",
    severity: "medium" as const,
    score: 14,
    pattern: /(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b/g,
    message: "Phone number detected.",
  },
  {
    type: "url",
    label: "URL",
    severity: "low" as const,
    score: 5,
    pattern: /\bhttps?:\/\/[^\s"'<>]+/gi,
    message: "URL detected.",
  },
  {
    type: "ip_address",
    label: "IP address",
    severity: "low" as const,
    score: 7,
    pattern: /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g,
    message: "IP address detected.",
  },
  {
    type: "credit_card",
    label: "Credit-card-like number",
    severity: "high" as const,
    score: 30,
    pattern: /\b(?:\d[ -]*?){13,19}\b/g,
    message: "Credit-card-like number detected.",
    validator: luhnLike,
  },
];

export function detectPiiGlobal(text: string): DetectorFinding[] {
  return runRegexDetectors(text, GLOBAL_PII_SPECS);
}

function luhnLike(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let digit = Number(digits[i]);
    if (double) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    double = !double;
  }
  return sum % 10 === 0;
}
