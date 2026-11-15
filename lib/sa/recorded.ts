import type { AnalyzeResult } from './review';

/**
 * A response recorded from https://soterai.in/api/guard/analyze on 2026-11-09, kept so the
 * home page can show Review Mode on first paint without calling the engine for every
 * visitor. It is always shown with its date and the word "recorded". The visitor's own
 * run replaces it. Do not edit by hand: re-record with the script in the commit message.
 */
export const RECORDED_AT = '2026-11-09';
export const RECORDED_TEXT = "Contact jane.doe@example.com or +1 415 555 0132.";
export const RECORDED_RESULT: AnalyzeResult = {
  "allowed": true,
  "action": "ALLOW_WITH_REDACTION",
  "riskScore": 33,
  "reason": "Allowed after sensitive values were redacted: Email address, Phone number.",
  "latencyMs": 21,
  "redactedText": "Contact [REDACTED_EMAIL] or [REDACTED_PHONE].",
  "safeText": "Contact [REDACTED_EMAIL] or [REDACTED_PHONE].",
  "findings": [
    {
      "type": "PII_DETECTED",
      "label": "Email address",
      "severity": "MEDIUM",
      "score": 25,
      "message": "An email address was detected.",
      "start": 8,
      "end": 28,
      "redactionToken": "[REDACTED_EMAIL]"
    },
    {
      "type": "PII_DETECTED",
      "label": "Phone number",
      "severity": "MEDIUM",
      "score": 25,
      "message": "A phone-like number was detected.",
      "start": 32,
      "end": 47,
      "redactionToken": "[REDACTED_PHONE]"
    }
  ]
};
