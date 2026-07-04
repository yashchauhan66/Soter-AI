import { redactByDataTypes } from "../packages/policy-engine/src/evaluatePolicy.js";
export function redactSensitiveText(text, detectedDataTypes) {
    return redactByDataTypes(text, detectedDataTypes);
}
export function auditSafePreview(text, detectedDataTypes, maxLength = 500) {
    const redacted = redactSensitiveText(text, detectedDataTypes);
    return redacted.length > maxLength ? `${redacted.slice(0, maxLength)}...` : redacted;
}
