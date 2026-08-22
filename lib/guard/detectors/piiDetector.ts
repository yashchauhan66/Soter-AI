import { detectPatterns, type PatternRule } from "./helpers";

const rules: PatternRule[] = [
  { pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i, label: "Email address", message: "An email address was detected.", severity: "MEDIUM", score: 25, redactionToken: "[REDACTED_EMAIL]", sensitive: true },
  { pattern: /(?<!\d)(?!\d{4}[ -]\d{4}[ -]\d{4}(?:[ -]\d{4})?(?!\d))(?:\+\d{1,3}[\s.-]?)?(?:\(\d{2,4}\)[\s.-]?|\d{2,4}[\s.-])\d{3,4}[\s.-]\d{3,4}(?!\d)/, label: "Phone number", message: "A phone-like number was detected.", severity: "MEDIUM", score: 25, redactionToken: "[REDACTED_PHONE]", sensitive: true },
  { pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/, label: "IP address", message: "An IP address was detected.", severity: "LOW", score: 15, redactionToken: "[REDACTED_IP]", sensitive: true },
  { pattern: /\b(?:\d[ -]*?){13,19}\b/, label: "Credit card-like pattern", message: "A payment-card-like number was detected; this is pattern matching, not validation.", severity: "HIGH", score: 30, redactionToken: "[REDACTED_CARD_LIKE]", sensitive: true },
  { pattern: /\b(?:DOB|date of birth|born on)\s*[:=-]?\s*\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/i, label: "Date of birth", message: "A date of birth pattern was detected.", severity: "MEDIUM", score: 25, redactionToken: "[REDACTED_DOB]", sensitive: true },
  { pattern: /\b(?:address|residing at|lives at)\s*[:=-]\s*[^\n,]{5,},[^\n]{3,}/i, label: "Address-like text", message: "Address-like personal data was detected.", severity: "MEDIUM", score: 25, redactionToken: "[REDACTED_ADDRESS]", sensitive: true },
  { pattern: /\b(?:BSN|burgerservicenummer)\s*[:=-]?\s*\d{8,9}\b/i, label: "EU NL BSN-like identifier", message: "A Netherlands BSN-like personal identifier was detected.", severity: "HIGH", score: 35, redactionToken: "[REDACTED_EU_BSN]", sensitive: true },
  { pattern: /\b(?:NIE|NIF|DNI)\s*[:=-]?\s*[XYZ]?\d{7,8}[A-Z]\b/i, label: "EU ES NIE/NIF/DNI-like identifier", message: "A Spain NIE/NIF/DNI-like personal identifier was detected.", severity: "HIGH", score: 35, redactionToken: "[REDACTED_EU_ID]", sensitive: true },
  { pattern: /\b(?:Codice\s+Fiscale|CF)\s*[:=-]?\s*[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]\b/i, label: "EU IT codice fiscale-like identifier", message: "An Italy codice fiscale-like personal identifier was detected.", severity: "HIGH", score: 35, redactionToken: "[REDACTED_EU_TAX_ID]", sensitive: true },
  { pattern: /\b(?:CPF)\s*[:=-]?\s*\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/i, label: "BR CPF-like identifier", message: "A Brazil CPF-like personal identifier was detected.", severity: "HIGH", score: 35, redactionToken: "[REDACTED_BR_CPF]", sensitive: true },
  { pattern: /\b(?:IBAN)\s*[:=-]?\s*[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]){11,30}\b/i, label: "IBAN-like bank identifier", message: "An IBAN-like financial identifier was detected.", severity: "HIGH", score: 35, redactionToken: "[REDACTED_IBAN]", sensitive: true },
  // US SSN. Two rules on purpose. The dashed form is distinctive enough to match
  // unqualified — it is also the only form the credit-card rule (13+ digits) and
  // the phone rule (three groups) both miss, which is how `123-45-6789` used to
  // survive redaction in cleartext. The structural exclusions are the SSA's own
  // never-issued ranges (area 000/666/900-999, group 00, serial 0000), and they
  // are what keeps ordinary dashed serial numbers out of the match.
  { pattern: /\b(?!000|666|9\d\d)\d{3}-(?!00)\d{2}-(?!0000)\d{4}\b/, label: "US SSN-like identifier", message: "A US Social Security number-like identifier was detected.", severity: "HIGH", score: 35, redactionToken: "[REDACTED_US_SSN]", sensitive: true },
  // Unseparated or space-separated digits are far too common to claim on shape
  // alone, so that form is only an SSN when the text says so.
  { pattern: /\b(?:SSNs?|social[\s-]?security(?:[\s-]?(?:number|no\.?|#))?)\s*[:=#-]?\s*(?!000|666|9\d\d)\d{3}[-\s]?(?!00)\d{2}[-\s]?(?!0000)\d{4}\b/i, label: "US SSN-like identifier", message: "A US Social Security number-like identifier was detected.", severity: "HIGH", score: 35, redactionToken: "[REDACTED_US_SSN]", sensitive: true },
];

export function piiDetector(text: string) {
  return detectPatterns(text, "PII_DETECTED", rules);
}
