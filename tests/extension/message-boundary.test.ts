/**
 * SS-3 adversarial tests for the runtime message boundary.
 *
 * These are written from the attacker's side: each test is a message a hostile page,
 * a hostile extension, a compromised subframe or a fuzzer would send, and asserts the
 * guard refuses it. The "legitimate traffic still works" tests exist so the guard
 * cannot be made to pass by rejecting everything.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  ALLOWED_MESSAGE_TYPES,
  MAX_MESSAGE_CHARS,
  MESSAGE_CONTRACTS,
  validateRuntimeMessage,
  type MessageSenderLike,
} from "../../apps/extension/src/lib/message-guard";

const OWN_ID = "abcdefghijklmnopabcdefghijklmnop";
const OTHER_ID = "ponmlkjihgponmlkjihgponmlkjihgpo";

/** A content script on a declared AI host, top frame. */
const contentScript: MessageSenderLike = {
  id: OWN_ID,
  origin: "https://chatgpt.com",
  url: "https://chatgpt.com/c/abc",
  frameId: 0,
  tab: { id: 42 },
};

/** The extension's own popup / side panel. */
const extensionPage: MessageSenderLike = {
  id: OWN_ID,
  origin: `chrome-extension://${OWN_ID}`,
  url: `chrome-extension://${OWN_ID}/popup.html`,
};

function reject(message: unknown, sender: MessageSenderLike | undefined) {
  const result = validateRuntimeMessage(message, sender, OWN_ID);
  assert.equal(result.ok, false, `expected rejection, got ${JSON.stringify(result)}`);
  return result as Extract<typeof result, { ok: false }>;
}

function accept(message: unknown, sender: MessageSenderLike | undefined) {
  const result = validateRuntimeMessage(message, sender, OWN_ID);
  assert.equal(result.ok, true, `expected acceptance, got ${JSON.stringify(result)}`);
  return result as Extract<typeof result, { ok: true }>;
}

/* ── The deleted privileged write ─────────────────────────────────────────── */

test("MSG-001: SOTER_SET_STATE no longer exists as a message type", () => {
  assert.equal(ALLOWED_MESSAGE_TYPES.includes("SOTER_SET_STATE"), false);
  const result = reject({ type: "SOTER_SET_STATE", state: { enabled: false } }, extensionPage);
  assert.equal(result.code, "unknown_type");
});

test("MSG-002: the service worker contains no SOTER_SET_STATE handler at all", () => {
  const source = readFileSync(
    resolve(import.meta.dirname, "../../apps/extension/src/background/service-worker.ts"),
    "utf8",
  );
  assert.equal(source.includes("SOTER_SET_STATE"), false,
    "the unrestricted privileged state write must be deleted, not merely validated");
  assert.equal(/if \(!isObject\(message\)\) return;/.test(source), false,
    "the old unconditional accept-any-object guard must be gone");
  assert.ok(source.includes("validateRuntimeMessage"),
    "every message must cross the validated boundary");
});

/* ── Sender identity ─────────────────────────────────────────────────────── */

test("MSG-003: a message from another extension id is refused", () => {
  const result = reject({ type: "SOTER_GET_STATE" }, { ...extensionPage, id: OTHER_ID });
  assert.equal(result.code, "foreign_sender");
});

test("MSG-004: a message with no sender at all is refused", () => {
  assert.equal(reject({ type: "SOTER_GET_STATE" }, undefined).code, "foreign_sender");
  assert.equal(reject({ type: "SOTER_GET_STATE" }, {}).code, "foreign_sender");
});

/* ── Scope ───────────────────────────────────────────────────────────────── */

test("MSG-005: a content script cannot read extension state", () => {
  const result = reject({ type: "SOTER_GET_STATE" }, contentScript);
  assert.equal(result.code, "wrong_scope");
});

test("MSG-006: a content script cannot trigger enrollment (endpoint rebinding vector)", () => {
  const result = reject(
    { type: "SOTER_ENROLL", apiBaseUrl: "https://attacker.example/", enrollmentCode: "abc" },
    contentScript,
  );
  assert.equal(result.code, "wrong_scope");
});

test("MSG-007: a subframe content script is refused (content scripts declare no all_frames)", () => {
  const result = reject(
    { type: "SOTER_SCAN_TEXT", text: "hello", url: "https://chatgpt.com/", eventType: "submit" },
    { ...contentScript, frameId: 7 },
  );
  assert.equal(result.code, "subframe_sender");
});

test("MSG-008: an extension page cannot impersonate a content-script-only message", () => {
  const result = reject(
    { type: "SOTER_DISCOVER_SHADOW_AI", domain: "x.example", destination: "X", riskLevel: "high", url: "https://x.example/" },
    extensionPage,
  );
  assert.equal(result.code, "wrong_scope");
});

test("MSG-009: a sender claiming an extension URL under a different id is refused", () => {
  const result = reject({ type: "SOTER_GET_STATE" }, {
    id: OWN_ID,
    origin: `chrome-extension://${OTHER_ID}`,
    url: `chrome-extension://${OTHER_ID}/popup.html`,
  });
  assert.equal(result.code, "wrong_scope");
});

/* ── Type confusion and schema ───────────────────────────────────────────── */

test("MSG-010: non-objects, arrays and primitives are refused", () => {
  for (const value of [null, undefined, 0, 1, "SOTER_GET_STATE", true, [], [{ type: "SOTER_GET_STATE" }]]) {
    assert.equal(reject(value, extensionPage).code, "not_an_object");
  }
});

test("MSG-011: unknown and near-miss message types are refused (fail-safe default)", () => {
  for (const type of ["", "SOTER_", "soter_get_state", "SOTER_GET_STATE_", "__proto__", "constructor", "toString"]) {
    assert.equal(reject({ type }, extensionPage).code, "unknown_type", `type ${JSON.stringify(type)}`);
  }
});

test("MSG-012: prototype keys cannot be used to reach a contract", () => {
  // `MESSAGE_CONTRACTS.toString` exists on the prototype; the lookup must not find it.
  const result = reject({ type: "toString" }, extensionPage);
  assert.equal(result.code, "unknown_type");
});

test("MSG-013: type-confused fields are refused instead of coerced", () => {
  // The old router did String(message.approvalId ?? "") — an object became "[object Object]".
  assert.equal(reject({ type: "SOTER_CHECK_APPROVAL_STATUS", approvalId: { toString: 1 } }, contentScript).code, "invalid_payload");
  assert.equal(reject({ type: "SOTER_CHECK_APPROVAL_STATUS", approvalId: ["a"] }, contentScript).code, "invalid_payload");
  assert.equal(reject({ type: "SOTER_CHECK_APPROVAL_STATUS" }, contentScript).code, "invalid_payload");
  assert.equal(reject({ type: "SOTER_SCAN_TEXT", text: 12345, url: "https://chatgpt.com/" }, contentScript).code, "invalid_payload");
});

test("MSG-014: only allowlisted enum values are accepted", () => {
  assert.equal(reject({ type: "SOTER_SCAN_TEXT", text: "x", url: "https://chatgpt.com/", eventType: "exfiltrate" }, contentScript).code, "invalid_payload");
  assert.equal(reject({ type: "SOTER_AUDIT_BYPASS", text: "x", url: "https://chatgpt.com/", action: "delete_everything" }, contentScript).code, "invalid_payload");
});

test("MSG-015: non-http(s) URLs are refused (javascript:, data:, chrome-extension:)", () => {
  for (const url of ["javascript:alert(1)", "data:text/html,<script>1</script>", `chrome-extension://${OWN_ID}/x.html`, "file:///etc/passwd"]) {
    assert.equal(
      reject({ type: "SOTER_SCAN_TEXT", text: "x", url, eventType: "submit" }, contentScript).code,
      "invalid_payload",
      url,
    );
  }
});

test("MSG-016: unknown extra fields are stripped, never forwarded to handlers", () => {
  const result = accept(
    {
      type: "SOTER_SCAN_TEXT",
      text: "hello",
      url: "https://chatgpt.com/",
      eventType: "submit",
      // Attacker-added fields that must not survive validation.
      __proto__: { polluted: true },
      apiBaseUrl: "https://attacker.example/",
      deviceToken: "stolen",
      organizationId: "victim-org",
    },
    contentScript,
  );
  assert.deepEqual(Object.keys(result.payload).sort(), ["eventType", "text", "url"]);
  assert.equal("apiBaseUrl" in result.payload, false);
  assert.equal("deviceToken" in result.payload, false);
  assert.equal(({} as Record<string, unknown>).polluted, undefined);
});

/* ── Resource bounds ─────────────────────────────────────────────────────── */

test("MSG-017: an oversized message is refused before any handler runs", () => {
  const huge = "a".repeat(MAX_MESSAGE_CHARS + 1);
  assert.equal(reject({ type: "SOTER_SCAN_TEXT", text: huge, url: "https://chatgpt.com/" }, contentScript).code, "too_large");
  // Small-message types have much tighter bounds.
  assert.equal(reject({ type: "SOTER_CLAIM_APPROVAL", requestId: "a".repeat(5000), destination: "chatgpt.com" }, contentScript).code, "too_large");
});

test("MSG-018: a cyclic message is refused, not thrown on", () => {
  const cyclic: Record<string, unknown> = { type: "SOTER_GET_STATE" };
  cyclic.self = cyclic;
  assert.equal(reject(cyclic, extensionPage).code, "invalid_payload");
});

test("MSG-019: every contract has a bound no larger than the hard ceiling", () => {
  for (const [type, contract] of Object.entries(MESSAGE_CONTRACTS)) {
    assert.ok(contract.maxChars > 0 && contract.maxChars <= MAX_MESSAGE_CHARS, `${type} bound`);
  }
});

/* ── Attribution spoofing ────────────────────────────────────────────────── */

test("MSG-020: a content script cannot attribute telemetry to another employee or tenant", () => {
  const shadow = accept(
    {
      type: "SOTER_DISCOVER_SHADOW_AI",
      domain: "sketchy-ai.example",
      destination: "Sketchy AI",
      riskLevel: "high",
      url: "https://sketchy-ai.example/chat",
      employeeId: "ceo@victim.example",
      organizationId: "other-tenant",
    },
    contentScript,
  );
  assert.equal("employeeId" in shadow.payload, false);
  assert.equal("organizationId" in shadow.payload, false);

  const fileEvent = accept(
    {
      type: "SOTER_FILE_SCAN_EVENT",
      event: {
        organizationId: "other-tenant",
        employeeId: "ceo@victim.example",
        destinationDomain: "chatgpt.com",
        fileNameHash: "a".repeat(64),
        originalExtension: "pdf",
        sizeBytes: 10,
        scannedBytes: 10,
        supported: true,
        encryptedOrBinary: false,
        detectedDataTypes: ["pan"],
        riskScore: 80,
        severity: "high",
        actionTaken: "block",
      },
    },
    contentScript,
  );
  const event = fileEvent.payload.event as Record<string, unknown>;
  assert.equal("organizationId" in event, false);
  assert.equal("employeeId" in event, false);
});

/* ── Legitimate traffic still works ──────────────────────────────────────── */

test("MSG-021: real content-script and extension-page traffic is accepted", () => {
  accept({ type: "SOTER_SCAN_TEXT", text: "hello", url: "https://chatgpt.com/", eventType: "submit" }, contentScript);
  accept({ type: "SOTER_REQUEST_APPROVAL", text: "hello", url: "https://chatgpt.com/", justification: "needed" }, contentScript);
  accept({ type: "SOTER_CHECK_APPROVAL_STATUS", approvalId: "req_123" }, contentScript);
  accept({ type: "SOTER_CLAIM_APPROVAL", requestId: "req_123", destination: "chatgpt.com" }, contentScript);
  accept({ type: "SOTER_AUDIT_BYPASS", text: "hello", url: "https://chatgpt.com/", action: "block", dismissedOnly: true }, contentScript);
  accept({ type: "SOTER_GET_DESTINATION_CONTEXT", url: "https://chatgpt.com/" }, contentScript);
  accept({ type: "SOTER_GET_SOURCE_APPS" }, contentScript);
  accept({ type: "SOTER_GET_STATE" }, extensionPage);
  accept({ type: "SOTER_SYNC_POLICY" }, extensionPage);
  accept({ type: "SOTER_ENROLL", enrollmentCode: "CODE-123", apiBaseUrl: "https://soterai.in/" }, extensionPage);
});

test("MSG-022: a side panel with no tab is a valid extension page", () => {
  accept({ type: "SOTER_REQUEST_APPROVAL", text: "hello", url: "https://chatgpt.com/" }, {
    id: OWN_ID,
    origin: `chrome-extension://${OWN_ID}`,
    url: `chrome-extension://${OWN_ID}/sidepanel.html`,
  });
});

test("MSG-023: a missing page URL degrades to unknown destination instead of dropping the scan", () => {
  const result = accept({ type: "SOTER_SCAN_TEXT", text: "hello" }, contentScript);
  assert.equal(result.payload.url, "");
  assert.equal(result.payload.eventType, "scan");
});

test("MSG-024: lineage context is bounded and rejected when malformed", () => {
  const ok = accept({
    type: "SOTER_SCAN_TEXT",
    text: "hello",
    url: "https://chatgpt.com/",
    eventType: "paste",
    lineageContext: {
      sourceDomain: "mail.google.com",
      sourceApp: "Gmail",
      sourceCategory: "email",
      sourceUrlHash: "b".repeat(64),
      selectedTextHash: "c".repeat(64),
      detectedDataTypes: ["pan"],
      createdAt: new Date(0).toISOString(),
      expiresAt: new Date(1000).toISOString(),
    },
  }, contentScript);
  assert.ok(ok.payload.lineageContext);
  assert.equal(
    reject({
      type: "SOTER_SCAN_TEXT", text: "hello", url: "https://chatgpt.com/",
      lineageContext: { sourceDomain: "x".repeat(5000) },
    }, contentScript).code,
    "invalid_payload",
  );
});
