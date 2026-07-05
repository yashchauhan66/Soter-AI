import type { DetectorResult, RegexDetectorSpec } from "../types";
import { runRegexDetectors } from "./utils";

export const PII_DETECTOR_VERSION = "1.0.0";

const PII_SPECS: RegexDetectorSpec[] = [
    {
        type: "email",
        label: "Email address",
        severity: "medium",
        score: 14,
        pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
        message: "Email address detected.",
        confidence: 0.9,
    },
    {
        type: "phone_number",
        label: "Phone number",
        severity: "medium",
        score: 14,
        pattern: /(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b/g,
        message: "Phone number detected.",
        confidence: 0.8,
    },
    {
        type: "ip_address",
        label: "IP address",
        severity: "low",
        score: 8,
        pattern: /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g,
        message: "IP address detected.",
        confidence: 0.85,
    },
    {
        type: "credit_card",
        label: "Credit card number",
        severity: "high",
        score: 32,
        pattern: /\b(?:\d[ -]*?){13,19}\b/g,
        message: "Credit-card-like number detected.",
        confidence: 0.7,
        validator: luhnCheck,
    },
    {
        type: "ssn",
        label: "Social Security Number",
        severity: "critical",
        score: 40,
        pattern: /\b\d{3}-\d{2}-\d{4}\b/g,
        message: "SSN-like number detected.",
        confidence: 0.75,
        validator: (v) => {
            const parts = v.split("-");
            return parts[0] !== "000" && parts[1] !== "00" && parts[2] !== "0000";
        },
    },
    {
        type: "date_of_birth",
        label: "Date of birth",
        severity: "medium",
        score: 12,
        pattern: /\b(?:DOB|date of birth|born on)\s*[:=-]?\s*\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/gi,
        message: "Date of birth detected.",
        confidence: 0.7,
    },
    {
        type: "address",
        label: "Physical address",
        severity: "medium",
        score: 10,
        pattern: /\b(?:address|residing at|lives at)\s*[:=-]\s*[^\n,]{5,},[^\n]{3,}/gi,
        message: "Physical address detected.",
        confidence: 0.6,
    },
];

export function detectPII(text: string): DetectorResult {
    return {
        detectorName: "PIIDetector",
        detectorVersion: PII_DETECTOR_VERSION,
        matches: runRegexDetectors(text, PII_SPECS),
    };
}

function luhnCheck(value: string): boolean {
    const digits = value.replace(/\D/g, "");
    if (digits.length < 13 || digits.length > 19) return false;
    let sum = 0;
    let double = false;
    for (let i = digits.length - 1; i >= 0; i--) {
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
