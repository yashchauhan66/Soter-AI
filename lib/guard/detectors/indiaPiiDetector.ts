import { detectPatterns, type PatternRule } from "./helpers";

const rules: PatternRule[] = [
  { pattern: /(?<!\d)(?:\d{4}[ -]?){2}\d{4}(?!\d)/, label: "Aadhaar-like pattern", message: "A 12-digit Aadhaar-like pattern was detected; it has not been verified as an Aadhaar number.", severity: "HIGH", score: 30, redactionToken: "[REDACTED_AADHAAR_LIKE]", sensitive: true },
  { pattern: /\b[A-Z]{5}\d{4}[A-Z]\b/i, label: "PAN-like pattern", message: "A PAN-format identifier was detected.", severity: "HIGH", score: 30, redactionToken: "[REDACTED_PAN]", sensitive: true },
  { pattern: /\b\d{2}[A-Z]{5}\d{4}[A-Z][A-Z0-9]Z[A-Z0-9]\b/i, label: "GSTIN-like pattern", message: "A GSTIN-format identifier was detected.", severity: "MEDIUM", score: 30, redactionToken: "[REDACTED_GSTIN]", sensitive: true },
  { pattern: /\b[\w.-]{2,256}@(?![A-Z0-9]{2,64}\.)[A-Z][A-Z0-9]{1,63}\b/i, label: "UPI ID", message: "A UPI identifier was detected.", severity: "HIGH", score: 30, redactionToken: "[REDACTED_UPI]", sensitive: true },
  { pattern: /(?<!\d)(?:\+91[ -]?)?[6-9]\d{9}(?!\d)/, label: "Indian mobile number", message: "An Indian mobile number pattern was detected.", severity: "MEDIUM", score: 30, redactionToken: "[REDACTED_PHONE]", sensitive: true },
  { pattern: /\b[A-Z]{4}0[A-Z0-9]{6}\b/i, label: "IFSC code", message: "An IFSC code pattern was detected.", severity: "MEDIUM", score: 25, redactionToken: "[REDACTED_IFSC]", sensitive: true },
  { pattern: /\b(?:account|a\/c|bank account)\s*(?:number|no\.?|#)?\s*[:=-]?\s*\d{9,18}\b/i, label: "Bank account-like number", message: "A bank-account-like number with context was detected.", severity: "HIGH", score: 30, redactionToken: "[REDACTED_BANK_ACCOUNT]", sensitive: true },
  { pattern: /\b(?:roll|admission)\s*(?:number|no\.?|#|id)\s*[:=-]?\s*[A-Z0-9/-]{4,20}\b/i, label: "Student identifier", message: "A student roll or admission identifier was detected.", severity: "MEDIUM", score: 25, redactionToken: "[REDACTED_STUDENT_ID]", sensitive: true },
  { pattern: /\b(?:patient|medical record|MRN)\s*(?:number|no\.?|#|id)?\s*[:=-]?\s*[A-Z0-9/-]{4,20}\b/i, label: "Patient identifier", message: "A patient identifier was detected.", severity: "HIGH", score: 30, redactionToken: "[REDACTED_PATIENT_ID]", sensitive: true },
];

export function indiaPiiDetector(text: string) {
  return detectPatterns(text, "INDIA_PII_DETECTED", rules);
}
