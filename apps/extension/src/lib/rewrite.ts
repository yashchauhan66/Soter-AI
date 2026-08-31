import { rewriteSafePrompt, stripSafeRewriteNote } from "../../../../packages/policy-engine/src/evaluatePolicy";
import type { PolicyAction } from "../../../../packages/policy-engine/src/types";

export function rewritePromptSafely(text: string, detectedDataTypes: string[], action: PolicyAction) {
  return rewriteSafePrompt(text, detectedDataTypes, action);
}

/**
 * The sanitized text to write back when only part of the field is being replaced.
 *
 * The whole-prompt paths (submit "Use safe prompt", "Copy safe prompt") keep the footer, which
 * explains the placeholders to the model. A pasted fragment must not carry it — see
 * `stripSafeRewriteNote`.
 */
export function safeFragmentText(result: { rewrittenSafeText?: string; redactedText?: string }): string {
  const rewritten = result.rewrittenSafeText ?? "";
  const fragment = rewritten ? stripSafeRewriteNote(rewritten) : "";
  return fragment || result.redactedText || rewritten;
}
