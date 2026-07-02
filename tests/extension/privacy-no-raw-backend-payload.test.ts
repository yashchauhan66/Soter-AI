import assert from "node:assert/strict";
import test from "node:test";
import { SoterExtensionApiClient } from "../../apps/extension/src/lib/api-client";
import { scanPrompt } from "../../apps/extension/src/lib/scanner";
import { defaultState } from "../../apps/extension/src/lib/storage";

test("clean scan payload never sends raw prompt as redactedPreview", async () => {
  const raw = "How do I implement error handling in React?";
  const calls: string[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    calls.push(String(init?.body ?? ""));
    return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  try {
    const client = new SoterExtensionApiClient({ apiBaseUrl: "https://control.example", organizationId: "org", employeeId: "employee" });
    await client.scan({ url: "https://chatgpt.com/c/raw-query?token=secret", result: scanPrompt(raw, "https://chatgpt.com/", defaultState) });
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.includes(raw), false);
  assert.equal(calls[0]!.includes("raw-query"), false);
  assert.equal(JSON.parse(calls[0]!).redactedPreview, "[CLEAN_PROMPT_NOT_STORED]");
});

test("file, lineage and fingerprint payloads contain metadata but no source content", async () => {
  const secret = "synthetic_api_key_value";
  const calls: string[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    calls.push(String(init?.body ?? ""));
    return new Response("{\"matches\":[]}", { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  try {
    const client = new SoterExtensionApiClient({ apiBaseUrl: "https://control.example", organizationId: "org", employeeId: "employee" });
    await client.fileScanEvent({ organizationId: "org", destinationDomain: "chatgpt.com", fileNameHash: "a".repeat(64), originalExtension: ".env", sizeBytes: 20, scannedBytes: 20, supported: true, encryptedOrBinary: false, detectedDataTypes: ["api_key"], riskScore: 100, severity: "critical", actionTaken: "block", redactedPreview: `API_KEY=${secret}` });
    await client.lineageEvent({ organizationId: "org", sourceApp: "Docs", sourceCategory: "document", destinationDomain: "chatgpt.com", destinationApp: "ChatGPT", destinationCategory: "public_ai", dataTypes: ["api_key"], riskScore: 100, severity: "critical", actionTaken: "block", redactedPreview: `copied ${secret}`, eventType: "paste_to_ai" });
    await client.fingerprintMatch({ destinationDomain: "chatgpt.com", localMatches: [{ matchedFingerprintSetId: "set", matchedDocumentName: "Vault", category: "finance", similarityScore: 1, sensitivity: "critical", recommendedAction: "block", matchType: "exact", confidence: "critical", matchedChunkCount: 1, totalComparedChunks: 1, evidence: "Exact fingerprint match detected against confidential dataset" }], textHash: "b".repeat(64), redactedPreview: `matched ${secret}` });
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(calls.join("\n").includes(secret), false);
  assert.match(calls[0]!, /REDACTED_API_KEY|REDACTED_ENV_VAR/);
  assert.match(calls[2]!, /Fingerprint match detected against confidential dataset/);
});
