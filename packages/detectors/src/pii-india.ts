import { runRegexDetectors, type DetectorFinding } from "./core";

const INDIA_PII_SPECS = [
  {
    type: "aadhaar",
    label: "Aadhaar-like number",
    severity: "high" as const,
    score: 28,
    pattern: /\b[2-9]\d{3}\s?\d{4}\s?\d{4}\b/g,
    message: "Aadhaar-like identifier detected.",
    validator: (value: string) => value.replace(/\s/g, "").length === 12,
  },
  {
    type: "pan",
    label: "PAN",
    severity: "high" as const,
    score: 26,
    pattern: /\b[A-Z]{5}[0-9]{4}[A-Z]\b/g,
    message: "Indian PAN identifier detected.",
  },
  {
    type: "gstin",
    label: "GSTIN",
    severity: "high" as const,
    score: 26,
    pattern: /\b[0-3][0-9][A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]\b/g,
    message: "GSTIN detected.",
  },
  {
    type: "upi_id",
    label: "UPI ID",
    severity: "medium" as const,
    score: 18,
    pattern: /\b[a-zA-Z0-9.\-_]{2,256}@(?:ok(?:axis|hdfcbank|sbi|icici)|ybl|paytm|ibl|axl|upi|apl|yesbank|kotak|hdfcbank|sbi|icici|axisbank|\w{2,10})\b/gi,
    message: "UPI ID detected.",
    validator: (value: string) => {
      const handle = value.includes("@") ? value.split("@")[1]?.toLowerCase() : "";
      if (!handle) return false;
      // Known UPI handle list - must match known PSPs
      const knownUpiHandles = new Set([
        "okaxis", "okhdfcbank", "oksbi", "okicici", "ybl", "paytm",
        "ibl", "axl", "upi", "apl", "yesbank", "kotak",
        "hdfcbank", "sbi", "icici", "axisbank", "paypal",
        "freecharge", "mobikwik", "phonepe", "amazonpay", "cred",
        "gpay", "bhim", "postpe", "slice", "jupiter",
        "niyo", "induspay", "bankofbaroda", "pnb", "unionbankofindia",
        "canarabank", "idbi", "rbl", "yesbankltd", "dbs",
      ]);
      // Reject if the handle looks like an email domain (has dots and TLD pattern)
      if (/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(handle)) return false;
      return knownUpiHandles.has(handle);
    },
  },
  {
    type: "ifsc",
    label: "IFSC",
    severity: "medium" as const,
    score: 18,
    pattern: /\b[A-Z]{4}0[A-Z0-9]{6}\b/g,
    message: "IFSC code detected.",
  },
];

export function detectPiiIndia(text: string): DetectorFinding[] {
  return runRegexDetectors(text, INDIA_PII_SPECS);
}
