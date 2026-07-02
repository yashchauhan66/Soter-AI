import { rewriteSafePrompt } from "../../../../packages/policy-engine/src/evaluatePolicy";
import type { PolicyAction } from "../../../../packages/policy-engine/src/types";

export function rewritePromptSafely(text: string, detectedDataTypes: string[], action: PolicyAction) {
  return rewriteSafePrompt(text, detectedDataTypes, action);
}
