import { rewriteSafePrompt } from "../packages/policy-engine/src/evaluatePolicy.js";
export function rewritePromptSafely(text, detectedDataTypes, action) {
    return rewriteSafePrompt(text, detectedDataTypes, action);
}
