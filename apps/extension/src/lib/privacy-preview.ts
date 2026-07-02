import {
  assertNoRawSensitiveData,
  createPrivacySafePreview,
  redactSensitiveText,
  type PrivacyContextType,
  type PrivacySafePreviewInput,
} from "../../../../packages/shared/src/privacy";
import type { ScanResult } from "./types";

export { assertNoRawSensitiveData, createPrivacySafePreview, redactSensitiveText };
export type { PrivacyContextType, PrivacySafePreviewInput };

export function previewForScan(result: ScanResult, contextType: PrivacyContextType = "prompt", maxLength = 500, allowFullText = false) {
  return createPrivacySafePreview({
    rawText: result.redactedText,
    detectedFindings: result.findings,
    dataTypes: result.detectedDataTypes,
    logMode: allowFullText ? "full_prompt_explicit_admin_enabled" : "redacted_prompt",
    maxLength,
    contextType,
    allowFullText,
  });
}

export async function createStorageSafeScanResult(result: ScanResult, rawText: string, contextType: PrivacyContextType = "prompt"): Promise<ScanResult> {
  const preview = previewForScan(result, contextType, 500);
  return {
    ...result,
    textHash: await sha256Browser(rawText),
    length: rawText.length,
    findings: result.findings.map((finding) => ({ ...finding, match: createPrivacySafePreview({
      rawText: finding.match,
      detectedFindings: [finding],
      dataTypes: [finding.type],
      contextType,
      logMode: "redacted_prompt",
      maxLength: 120,
    }) })),
    redactedText: preview,
    rewrittenSafeText: preview,
    policy: {
      ...result.policy,
      redactedText: preview,
      rewrittenSafeText: preview,
    },
  };
}

async function sha256Browser(value: string) {
  const data = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
