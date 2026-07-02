import { ZodError } from "zod";
import {
  containsDisallowedRawField,
  createPrivacySafePreview,
  sanitizePrivacyPayload,
  type PrivacyContextType,
} from "@/packages/shared/src/privacy";

export function rejectDisallowedRawContent(payload: unknown) {
  const field = containsDisallowedRawField(payload);
  if (!field) return;
  throw new ZodError([{
    code: "custom",
    path: field.split("."),
    message: `Raw content field '${field}' is not accepted. Send privacy-safe metadata instead.`,
  }]);
}

export function sanitizeExtensionPreview(preview: string | undefined, contextType: PrivacyContextType, dataTypes: string[] = [], maxLength = 1000, allowFullText = false) {
  if (!preview) return undefined;
  return createPrivacySafePreview({
    rawText: preview,
    dataTypes,
    contextType,
    logMode: allowFullText ? "full_prompt_explicit_admin_enabled" : "redacted_prompt",
    allowFullText,
    maxLength,
  });
}

export function sanitizeExtensionMetadata(metadata: Record<string, unknown>) {
  return sanitizePrivacyPayload(metadata) as Record<string, unknown>;
}
