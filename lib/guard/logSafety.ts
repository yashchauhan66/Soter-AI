import { indiaPiiDetector } from "./detectors/indiaPiiDetector";
import { piiDetector } from "./detectors/piiDetector";
import { secretsDetector } from "./detectors/secretsDetector";
import { redactText } from "./redactor";
import type { GuardResult } from "./types";

const CONFIDENTIAL_RISKS = new Set([
  "SECRET_DETECTED",
  "PII_DETECTED",
  "INDIA_PII_DETECTED",
  "SYSTEM_PROMPT_LEAKAGE",
]);

export function prepareSafeLogContent(
  result: GuardResult,
  requestMetadata?: Record<string, unknown>,
) {
  const confidential = result.riskTypes.some((type) => CONFIDENTIAL_RISKS.has(type));
  const containsSystemLeak = result.riskTypes.includes("SYSTEM_PROMPT_LEAKAGE");
  const fallback = containsSystemLeak
    ? "[REDACTED_SYSTEM_INSTRUCTIONS]"
    : "[REDACTED_SENSITIVE_CONTENT]";
  const redactedText = containsSystemLeak
    ? fallback
    : result.redactedText ?? (confidential ? fallback : undefined);

  return {
    originalText: confidential ? null : result.originalText,
    redactedText,
    safeText: confidential ? redactedText : result.safeText,
    metadata: {
      request: sanitizeMetadata(requestMetadata),
      findings: result.findings.map(({ type, label, severity, score, message }) => ({
        type,
        label,
        severity,
        score,
        message,
      })),
    },
  };
}

export function sanitizeMetadata(metadata?: Record<string, unknown>) {
  if (!metadata) return {};
  const safe: Record<string, string | number | boolean | null> = {};

  for (const [key, value] of Object.entries(metadata)) {
    if (/token|secret|password|authorization|api.?key/i.test(key)) continue;
    if (typeof value === "string") {
      const findings = [
        ...piiDetector(value),
        ...indiaPiiDetector(value),
        ...secretsDetector(value),
      ];
      safe[key] = findings.length ? redactText(value, findings) : value;
    } else if (typeof value === "number" || typeof value === "boolean" || value === null) {
      safe[key] = value;
    }
  }

  return safe;
}

export function sanitizeLogText(value: string) {
  const findings = [...piiDetector(value), ...indiaPiiDetector(value), ...secretsDetector(value)];
  return findings.length ? redactText(value, findings) : value;
}
