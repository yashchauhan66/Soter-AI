import { createPrivacySafePreview, redactSensitiveText as redactAllSensitiveText } from "./privacy-preview";
import { redactByDataTypes } from "../../../../packages/policy-engine/src/evaluatePolicy";

export function redactSensitiveText(text: string, detectedDataTypes: string[]) {
  return redactAllSensitiveText(redactByDataTypes(text, detectedDataTypes));
}

export function auditSafePreview(text: string, detectedDataTypes: string[], maxLength = 500) {
  return createPrivacySafePreview({
    rawText: text,
    dataTypes: detectedDataTypes,
    contextType: "prompt",
    logMode: "redacted_prompt",
    maxLength,
  });
}
