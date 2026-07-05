import type { DetectorResult, RegexDetectorSpec } from "../types";
import { runRegexDetectors } from "./utils";

export const INDIA_PII_DETECTOR_VERSION = "1.0.0";

const INDIA_PII_SPECS: RegexDetectorSpec[] = [
    {
        type: "aadhaar",
        label: "Aadhaar number",
        severity: "high",
        score: 30,
        pattern: /\b[2-9]\d{3}\s?\d{4}\s?\d{4}\b/g,
        message: "Aadhaar-like identifier detected.",
        confidence: 0.85,
        validator: (value) => value.replace(/\s/g, "").length === 12,
    },
    {
        type: "pan",
        label: "PAN",
        severity: "high",
        score: 28,
        pattern: /\b[A-Z]{5}[0-9]{4}[A-Z]\b/g,
        message: "Indian PAN identifier detected.",
        confidence: 0.9,
    },
    {
        type: "gstin",
        label: "GSTIN",
        severity: "high",
        score: 28,
        pattern: /\b[0-3][0-9][A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]\b/g,
        message: "GSTIN detected.",
        confidence: 0.95,
    },
    {
        type: "upi_id",
        label: "UPI ID",
        severity: "medium",
        score: 18,
        pattern: /\b[a-zA-Z0-9.\-_]{2,256}@(?:ok(?:axis|hdfcbank|sbi|icici)|ybl|paytm|ibl|axl|upi|apl|yesbank|kotak|hdfcbank|sbi|icici|axisbank|phonepe|gpay|bhim|\w{2,10})\b/gi,
        message: "UPI ID detected.",
        confidence: 0.8,
        validator: (value) => {
            const handle = value.includes("@") ? value.split("@")[1]?.toLowerCase() : "";
            if (!handle) return false;
            const knownUpiHandles = new Set([
                "okaxis", "okhdfcbank", "oksbi", "okicici", "ybl", "paytm",
                "ibl", "axl", "upi", "apl", "yesbank", "kotak",
                "hdfcbank", "sbi", "icici", "axisbank", "phonepe",
                "gpay", "bhim", "cred", "postpe", "slice", "jupiter",
                "freecharge", "mobikwik", "amazonpay",
            ]);
            if (/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(handle)) return false;
            return knownUpiHandles.has(handle);
        },
    },
    {
        type: "ifsc",
        label: "IFSC code",
        severity: "medium",
        score: 16,
        pattern: /\b[A-Z]{4}0[A-Z0-9]{6}\b/g,
        message: "IFSC code detected.",
        confidence: 0.85,
    },
    {
        type: "indian_passport",
        label: "Indian passport number",
        severity: "high",
        score: 28,
        pattern: /\b[A-Z][1-9]\d{6}\b/g,
        message: "Indian passport-like number detected.",
        confidence: 0.5,
        validator: (value) => /^[A-PR-WY][1-9]\d{6}$/.test(value),
    },
    {
        type: "voter_id",
        label: "Voter ID",
        severity: "high",
        score: 24,
        pattern: /\b[A-Z]{3}\d{7}\b/g,
        message: "Indian voter ID-like pattern detected.",
        confidence: 0.6,
    },
];

export function detectIndiaPII(text: string): DetectorResult {
    return {
        detectorName: "IndiaPIIDetector",
        detectorVersion: INDIA_PII_DETECTOR_VERSION,
        matches: runRegexDetectors(text, INDIA_PII_SPECS),
    };
}
