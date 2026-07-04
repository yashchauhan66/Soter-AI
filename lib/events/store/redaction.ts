import { createPrivacySafePreview, sanitizePrivacyPayload } from "@/packages/shared/src/privacy";

import { dynamoEventsConfig } from "../../dynamodb/config";

const BLOCKED_METADATA_KEYS = /^(authorization|proxy-authorization|cookie|set-cookie|password|passwd|pwd|privatekey|private_key|rawapikey|raw_api_key|apikey|api_key|accesskey|access_key|secret|token|prompt|fullprompt|rawprompt|response|rawresponse|body|requestbody|responsebody)$/i;

export function redactEventPreview(
  rawText: string | null | undefined,
  kind: "input" | "output",
): string | null {
  if (!rawText) return null;
  const config = dynamoEventsConfig();
  return createPrivacySafePreview({
    rawText,
    contextType: kind === "input" ? "prompt" : "response",
    logMode: "redacted_prompt",
    maxLength: kind === "input" ? config.maxInputPreviewChars : config.maxOutputPreviewChars,
  });
}

export function minimizeEventMetadata(metadata: Record<string, unknown> | null | undefined): Record<string, unknown> {
  const config = dynamoEventsConfig();
  const sanitized = sanitizeNode(metadata ?? {}, 0) as Record<string, unknown>;
  const serialized = JSON.stringify(sanitized);
  if (Buffer.byteLength(serialized, "utf8") <= config.maxMetadataBytes) return sanitized;

  const preview = serialized.slice(0, Math.max(0, config.maxMetadataBytes - 128));
  return {
    truncated: true,
    originalBytes: Buffer.byteLength(serialized, "utf8"),
    preview,
  };
}

function sanitizeNode(value: unknown, depth: number): unknown {
  if (depth > 6) return "[MAX_DEPTH]";
  if (Array.isArray(value)) return value.slice(0, 100).map((item) => sanitizeNode(item, depth + 1));
  if (value && typeof value === "object") {
    const safe: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (BLOCKED_METADATA_KEYS.test(key)) continue;
      safe[key] = sanitizeNode(nested, depth + 1);
    }
    return safe;
  }
  if (typeof value === "string") {
    return sanitizePrivacyPayload(value, "metadata");
  }
  if (typeof value === "number" || typeof value === "boolean" || value === null) return value;
  return undefined;
}

