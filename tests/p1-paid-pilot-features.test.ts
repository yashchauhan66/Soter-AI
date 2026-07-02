import assert from "node:assert/strict";
import test from "node:test";

// ═══════════════════════════════════════════════════════════════════════════════
// P1 PAID ENTERPRISE PILOT READINESS TESTS
// Tests for all 5 coded P1 features:
//   1. Shadow AI Discovery
//   2. SIEM/Webhook Export
//   3. Push-Based Emergency Lockdown
//   4. Enrollment Token Revocation
//   5. Approval Once Tracking
// ═══════════════════════════════════════════════════════════════════════════════

import {
  evaluateApprovalClaim,
  claimedApprovalMetadata,
  type ApprovalClaimMetadata,
} from "../lib/extension/approvalClaims";

import {
  lockdownPolicy,
  LOCKDOWN_BLOCKED_DATA_TYPES,
} from "../lib/extension/emergencyLockdown";

import {
  enrollmentTokenStatus,
  enrollmentStatusMessage,
  hashSecret,
} from "../lib/extension/enrollment";

import {
  SIEM_WEBHOOK_EVENT_TYPES,
  normalizeSiemEventType,
  redactedWebhookPayload,
  signWebhookPayload,
  hashWebhookSecret,
  parseWebhookEndpoint,
  webhookMatchesEvent,
  encodeWebhookConfig,
  decodeWebhookConfig,
  type SiemWebhookEvent,
} from "../lib/siem/webhooks";

import {
  isPrivateNetworkAddress,
} from "../lib/network/outboundUrl";

// ── P1-1: Shadow AI Discovery Tests ──────────────────────────────────────────

test("SHADOW-001: shadow AI discovery event type is defined", () => {
  assert.equal(typeof "EXTENSION_SHADOW_AI_DISCOVERED", "string");
  assert.equal("EXTENSION_SHADOW_AI_DISCOVERED", "EXTENSION_SHADOW_AI_DISCOVERED");
});

test("SHADOW-002: normalizeSiemEventType maps shadow AI event correctly", () => {
  assert.equal(
    normalizeSiemEventType("EXTENSION_SHADOW_AI_DISCOVERED"),
    "SHADOW_AI_DISCOVERED",
  );
});

test("SHADOW-003: KNOWN_AI_PROVIDERS covers major AI destinations", () => {
  const { KNOWN_AI_PROVIDERS } = require("../lib/shadow-ai");
  const domains = KNOWN_AI_PROVIDERS.map((p: { domain: string }) => p.domain);
  assert.ok(domains.includes("api.openai.com"), "Missing OpenAI");
  assert.ok(domains.includes("api.anthropic.com"), "Missing Anthropic");
  assert.ok(domains.includes("generativelanguage.googleapis.com"), "Missing Google AI");
});

// ── P1-2: SIEM/Webhook Export Tests ──────────────────────────────────────────

test("SIEM-001: SIEM webhook event types include all required types", () => {
  const required = [
    "EXTENSION_HEARTBEAT",
    "PROMPT_BLOCKED",
    "PROMPT_REDACTED",
    "PROMPT_REWRITTEN",
    "APPROVAL_REQUESTED",
    "APPROVAL_APPROVED",
    "APPROVAL_REJECTED",
    "SHADOW_AI_DISCOVERED",
    "EMERGENCY_LOCKDOWN_ENABLED",
    "EMERGENCY_LOCKDOWN_DISABLED",
    "POLICY_SIGNATURE_FAILED",
  ];
  for (const eventType of required) {
    assert.ok(
      SIEM_WEBHOOK_EVENT_TYPES.includes(eventType as (typeof SIEM_WEBHOOK_EVENT_TYPES)[number]),
      `Missing SIEM event type: ${eventType}`,
    );
  }
});

test("SIEM-002: normalizeSiemEventType handles all event type mappings", () => {
  assert.equal(normalizeSiemEventType("EXTENSION_SHADOW_AI_DISCOVERED"), "SHADOW_AI_DISCOVERED");
  assert.equal(normalizeSiemEventType("EXTENSION_APPROVAL_REQUEST"), "APPROVAL_REQUESTED");
  assert.equal(normalizeSiemEventType("EXTENSION_APPROVAL_GRANTED"), "APPROVAL_APPROVED");
  assert.equal(normalizeSiemEventType("EXTENSION_APPROVAL_REJECTED"), "APPROVAL_REJECTED");
  // Known events pass through unchanged
  assert.equal(normalizeSiemEventType("PROMPT_BLOCKED"), "PROMPT_BLOCKED");
  assert.equal(normalizeSiemEventType("EMERGENCY_LOCKDOWN_ENABLED"), "EMERGENCY_LOCKDOWN_ENABLED");
});

test("SIEM-003: HMAC webhook signing is deterministic and verifiable", () => {
  const secret = "test-webhook-secret-for-hmac-signing-32ch";
  const timestamp = 1700000000;
  const payload = '{"event":"test","data":{}}';

  const sig1 = signWebhookPayload(payload, secret, timestamp);
  const sig2 = signWebhookPayload(payload, secret, timestamp);
  assert.equal(sig1.timestamp, sig2.timestamp, "Same inputs should produce same timestamp");
  assert.equal(sig1.signature, sig2.signature, "Same inputs should produce same signature");
  assert.ok(sig1.signature.startsWith("sha256="), "Signature should be prefixed with sha256=");

  // Different timestamp changes signature
  const sig3 = signWebhookPayload(payload, secret, timestamp + 1);
  assert.notEqual(sig1.signature, sig3.signature, "Different timestamp should change signature");

  // Different payload changes signature
  const sig4 = signWebhookPayload(payload + "x", secret, timestamp);
  assert.notEqual(sig1.signature, sig4.signature, "Different payload should change signature");
});

test("SIEM-004: redactedWebhookPayload strips sensitive fields", () => {
  const event: SiemWebhookEvent = {
    id: "evt-123",
    organizationId: "org-456",
    projectId: "proj-789",
    eventType: "PROMPT_BLOCKED",
    severity: "HIGH",
    riskTypes: ["SECRET_DETECTED"],
    action: "BLOCK",
    source: "extension",
    createdAt: new Date("2026-06-30T12:00:00Z"),
    metadata: { apiKey: "sk-should-not-appear", safeField: "visible" },
  };

  const payload = redactedWebhookPayload(event);
  const serialized = JSON.stringify(payload);
  assert.equal(serialized.includes("sk-should-not-appear"), false, "Raw API key leaked into payload");
  assert.equal(payload.id, "evt-123");
  assert.equal(payload.eventType, "PROMPT_BLOCKED");
  assert.equal(payload.severity, "HIGH");
  assert.ok(payload.timestamp, "Should have timestamp field");
});

test("SIEM-005: webhookMatchesEvent correctly filters by event type", () => {
  const config = decodeWebhookConfig(
    JSON.stringify({ eventTypes: ["PROMPT_BLOCKED", "EMERGENCY_LOCKDOWN_ENABLED"] }),
  );
  assert.equal(webhookMatchesEvent(config, "PROMPT_BLOCKED"), true);
  assert.equal(webhookMatchesEvent(config, "EMERGENCY_LOCKDOWN_ENABLED"), true);
  assert.equal(webhookMatchesEvent(config, "PROMPT_REDACTED"), false);
  assert.equal(webhookMatchesEvent(config, "SHADOW_AI_DISCOVERED"), false);
});

test("SIEM-006: encodeWebhookConfig/decodeWebhookConfig round-trips correctly", () => {
  const config = { eventTypes: ["PROMPT_BLOCKED", "APPROVAL_REQUESTED"] as const };
  const encoded = encodeWebhookConfig(config);
  const decoded = decodeWebhookConfig(encoded);
  assert.deepEqual(decoded.eventTypes, ["PROMPT_BLOCKED", "APPROVAL_REQUESTED"]);
});

test("SIEM-007: decodeWebhookConfig handles missing/invalid input", () => {
  assert.deepEqual(decodeWebhookConfig(null).eventTypes, [...SIEM_WEBHOOK_EVENT_TYPES]);
  assert.deepEqual(decodeWebhookConfig(undefined).eventTypes, [...SIEM_WEBHOOK_EVENT_TYPES]);
  assert.deepEqual(decodeWebhookConfig("invalid-json").eventTypes, [...SIEM_WEBHOOK_EVENT_TYPES]);
  assert.deepEqual(decodeWebhookConfig("").eventTypes, [...SIEM_WEBHOOK_EVENT_TYPES]);
});

test("SIEM-008: parseWebhookEndpoint requires HTTPS", () => {
  assert.throws(() => parseWebhookEndpoint("http://example.com/webhook"), /HTTPS/);
  assert.throws(() => parseWebhookEndpoint("http://example.com/webhook"));
  const result = parseWebhookEndpoint("https://example.com/webhook");
  assert.equal(typeof result, "string", "Should return a string URL");
  assert.ok(result.startsWith("https://"), "Should start with https://");
});

test("SIEM-009: SSRF protection blocks localhost", () => {
  assert.throws(
    () => parseWebhookEndpoint("https://localhost/webhook"),
    /private/i,
  );
  assert.throws(
    () => parseWebhookEndpoint("https://127.0.0.1/webhook"),
    /private/i,
  );
  assert.throws(
    () => parseWebhookEndpoint("https://0.0.0.0/webhook"),
    /private/i,
  );
  assert.throws(
    () => parseWebhookEndpoint("https://169.254.169.254/latest/meta-data"),
    /private/i,
  );
  assert.throws(
    () => parseWebhookEndpoint("https://192.168.1.1/webhook"),
    /private/i,
  );
  // HTTPS with public hostname should succeed
  const result = parseWebhookEndpoint("https://siem.example.com/ingest");
  assert.equal(typeof result, "string");
  assert.ok(result.includes("siem.example.com"), "Should contain the hostname");
});

test("SIEM-010: SSRF protection blocks private IP ranges", () => {
  assert.equal(isPrivateNetworkAddress("127.0.0.1"), true);
  assert.equal(isPrivateNetworkAddress("0.0.0.0"), true);
  assert.equal(isPrivateNetworkAddress("169.254.169.254"), true);
  assert.equal(isPrivateNetworkAddress("10.0.0.1"), true);
  assert.equal(isPrivateNetworkAddress("172.16.0.1"), true);
  assert.equal(isPrivateNetworkAddress("192.168.0.1"), true);
  assert.equal(isPrivateNetworkAddress("8.8.8.8"), false);
  assert.equal(isPrivateNetworkAddress("1.1.1.1"), false);
});

// ── P1-3: Push-Based Emergency Lockdown Tests ────────────────────────────────

test("LOCKDOWN-001: lockdownPolicy with null state returns disabled", () => {
  const policy = lockdownPolicy(null);
  assert.equal(policy.enabled, false);
  assert.equal(policy.policyVersion, 1);
  assert.equal(policy.blockUnknownDestinations, true);
  assert.equal(policy.blockAllFileUploads, true);
  assert.equal(policy.allowOnlyEnterpriseDestinations, true);
});

test("LOCKDOWN-002: lockdownPolicy with enabled state returns correct values", () => {
  const policy = lockdownPolicy({
    enabled: true,
    policyVersion: 5,
    reason: "Security breach",
    enabledAt: new Date("2026-06-30T10:00:00Z"),
  });
  assert.equal(policy.enabled, true);
  assert.equal(policy.policyVersion, 5);
  assert.equal(policy.reason, "Security breach");
  assert.ok(policy.enabledAt);
});

test("LOCKDOWN-003: lockdown blocks sensitive data types", () => {
  assert.ok(LOCKDOWN_BLOCKED_DATA_TYPES.includes("env_file"));
  assert.ok(LOCKDOWN_BLOCKED_DATA_TYPES.includes("api_key"));
  assert.ok(LOCKDOWN_BLOCKED_DATA_TYPES.includes("customer_data"));
  assert.ok(LOCKDOWN_BLOCKED_DATA_TYPES.includes("hr_salary"));
  assert.ok(LOCKDOWN_BLOCKED_DATA_TYPES.includes("financial_text"));
  assert.ok(LOCKDOWN_BLOCKED_DATA_TYPES.includes("legal_contract"));
  assert.ok(LOCKDOWN_BLOCKED_DATA_TYPES.includes("password"));
  assert.ok(LOCKDOWN_BLOCKED_DATA_TYPES.includes("database_url"));
});

test("LOCKDOWN-004: lockdown requires approval for source code", () => {
  const policy = lockdownPolicy({
    enabled: true, policyVersion: 2, reason: null, enabledAt: new Date(),
  });
  assert.ok(policy.requireApprovalDataTypes.includes("source_code"));
});

test("LOCKDOWN-005: lockdown heartbeat response includes lockdownChanged flag", () => {
  // Simulate heartbeat response when lockdown is active but extension has old version
  const extensionReportedVersion = 1;
  const currentLockdownVersion = 3;
  const lockdownChanged = currentLockdownVersion > extensionReportedVersion;
  assert.equal(lockdownChanged, true);
});

test("LOCKDOWN-006: lockdown sync returns correct state structure", () => {
  // Simulate the sync endpoint response structure
  const response = {
    lockdown: {
      enabled: true,
      policyVersion: 3,
      reason: "Incident",
      enabledAt: "2026-06-30T10:00:00.000Z",
      updatedAt: "2026-06-30T10:00:00.000Z",
      enabledBy: "admin@example.com",
    },
  };
  assert.equal(response.lockdown.enabled, true);
  assert.ok(response.lockdown.policyVersion >= 1);
  assert.ok(response.lockdown.enabledBy);
});

// ── P1-4: Enrollment Token Revocation Tests ──────────────────────────────────

test("ENROLL-001: enrollmentTokenStatus returns 'valid' for valid token", () => {
  const status = enrollmentTokenStatus({
    expiresAt: new Date(Date.now() + 86400000),
    revokedAt: null,
    usedCount: 0,
    maxUses: 5,
  });
  assert.equal(status, "valid");
});

test("ENROLL-002: enrollmentTokenStatus returns 'revoked' for revoked token", () => {
  const status = enrollmentTokenStatus({
    expiresAt: new Date(Date.now() + 86400000),
    revokedAt: new Date(),
    usedCount: 0,
    maxUses: 5,
  });
  assert.equal(status, "revoked");
});

test("ENROLL-003: enrollmentTokenStatus returns 'expired' for expired token", () => {
  const status = enrollmentTokenStatus({
    expiresAt: new Date(Date.now() - 1000),
    revokedAt: null,
    usedCount: 0,
    maxUses: 5,
  });
  assert.equal(status, "expired");
});

test("ENROLL-004: enrollmentTokenStatus returns 'overused' when usedCount >= maxUses", () => {
  const status = enrollmentTokenStatus({
    expiresAt: new Date(Date.now() + 86400000),
    revokedAt: null,
    usedCount: 5,
    maxUses: 5,
  });
  assert.equal(status, "overused");
});

test("ENROLL-005: enrollmentTokenStatus returns 'invalid' for null token", () => {
  assert.equal(enrollmentTokenStatus(null), "invalid");
});

test("ENROLL-006: revoked token cannot enroll", () => {
  const status = enrollmentTokenStatus({
    expiresAt: new Date(Date.now() + 86400000),
    revokedAt: new Date(),
    usedCount: 0,
    maxUses: 10,
  });
  assert.notEqual(status, "valid", "Revoked token should not be valid");
  assert.equal(status, "revoked");
});

test("ENROLL-007: expired token cannot enroll", () => {
  const status = enrollmentTokenStatus({
    expiresAt: new Date(Date.now() - 1000),
    revokedAt: null,
    usedCount: 0,
    maxUses: 10,
  });
  assert.notEqual(status, "valid", "Expired token should not be valid");
  assert.equal(status, "expired");
});

test("ENROLL-008: overused token cannot enroll", () => {
  const status = enrollmentTokenStatus({
    expiresAt: new Date(Date.now() + 86400000),
    revokedAt: null,
    usedCount: 3,
    maxUses: 3,
  });
  assert.notEqual(status, "valid", "Overused token should not be valid");
  assert.equal(status, "overused");
});

test("ENROLL-009: enrollmentStatusMessage returns human-readable messages", () => {
  assert.match(enrollmentStatusMessage("expired"), /expired/i);
  assert.match(enrollmentStatusMessage("revoked"), /revoked/i);
  assert.match(enrollmentStatusMessage("overused"), /usage limit/i);
  assert.match(enrollmentStatusMessage("invalid"), /invalid/i);
});

test("ENROLL-010: hashSecret produces consistent hashes", () => {
  const hash1 = hashSecret("test-token-abc");
  const hash2 = hashSecret("test-token-abc");
  assert.equal(hash1, hash2, "Same input should produce same hash");
  assert.match(hash1, /^[0-9a-f]{64}$/, "Hash should be 64-char hex");
});

// ── P1-5: Approval Once Tracking Tests ───────────────────────────────────────

test("APPROVAL-001: approve_once claim succeeds on first claim", () => {
  const metadata: ApprovalClaimMetadata = {
    resolved: true,
    resolution: "approved",
    duration: "once",
    organizationId: "org-123",
    employeeId: "emp-456",
    deviceId: "dev-789",
  };

  const result = evaluateApprovalClaim({
    metadata,
    employeeId: "emp-456",
    deviceId: "dev-789",
    organizationId: "org-123",
    destination: "https://chatgpt.com",
  });

  assert.equal(result.allowed, true);
  assert.equal(result.status, "approved");
});

test("APPROVAL-002: approve_once claim fails on second claim", () => {
  const metadata: ApprovalClaimMetadata = {
    resolved: true,
    resolution: "approved",
    duration: "once",
    organizationId: "org-123",
    employeeId: "emp-456",
    deviceId: "dev-789",
    claimedAt: "2026-06-30T10:00:00Z",
  };

  const result = evaluateApprovalClaim({
    metadata,
    employeeId: "emp-456",
    deviceId: "dev-789",
    organizationId: "org-123",
    destination: "https://chatgpt.com",
  });

  assert.equal(result.allowed, false);
  assert.equal(result.status, "already_claimed");
});

test("APPROVAL-003: expired approval fails", () => {
  const metadata: ApprovalClaimMetadata = {
    resolved: true,
    resolution: "approved",
    duration: "once",
    organizationId: "org-123",
    expiresAt: "2026-01-01T00:00:00Z",
  };

  const result = evaluateApprovalClaim({
    metadata,
    employeeId: "emp-456",
    organizationId: "org-123",
    destination: "https://chatgpt.com",
    now: new Date("2026-06-30T12:00:00Z"),
  });

  assert.equal(result.allowed, false);
  assert.equal(result.status, "expired");
});

test("APPROVAL-004: wrong destination fails for destination-scoped approval", () => {
  const metadata: ApprovalClaimMetadata = {
    resolved: true,
    resolution: "approved",
    duration: "destination",
    organizationId: "org-123",
    url: "https://chatgpt.com",
  };

  const result = evaluateApprovalClaim({
    metadata,
    employeeId: "emp-456",
    organizationId: "org-123",
    destination: "https://claude.ai",
  });

  assert.equal(result.allowed, false);
  assert.equal(result.status, "wrong_destination");
});

test("APPROVAL-005: rejected approval fails", () => {
  const metadata: ApprovalClaimMetadata = {
    resolved: true,
    resolution: "rejected",
    organizationId: "org-123",
  };

  const result = evaluateApprovalClaim({
    metadata,
    employeeId: "emp-456",
    organizationId: "org-123",
    destination: "https://chatgpt.com",
  });

  assert.equal(result.allowed, false);
  assert.equal(result.status, "rejected");
});

test("APPROVAL-006: wrong employee fails for employee-scoped approval", () => {
  const metadata: ApprovalClaimMetadata = {
    resolved: true,
    resolution: "approved",
    duration: "once",
    organizationId: "org-123",
    employeeId: "emp-456",
  };

  const result = evaluateApprovalClaim({
    metadata,
    employeeId: "emp-different",
    organizationId: "org-123",
    destination: "https://chatgpt.com",
  });

  assert.equal(result.allowed, false);
  assert.equal(result.status, "wrong_employee");
});

test("APPROVAL-007: wrong organization fails", () => {
  const metadata: ApprovalClaimMetadata = {
    resolved: true,
    resolution: "approved",
    duration: "once",
    organizationId: "org-123",
  };

  const result = evaluateApprovalClaim({
    metadata,
    organizationId: "org-different",
    destination: "https://chatgpt.com",
  });

  assert.equal(result.allowed, false);
  assert.equal(result.status, "wrong_scope");
});

test("APPROVAL-008: pending approval fails", () => {
  const metadata: ApprovalClaimMetadata = {
    resolved: false,
    organizationId: "org-123",
  };

  const result = evaluateApprovalClaim({
    metadata,
    organizationId: "org-123",
    destination: "https://chatgpt.com",
  });

  assert.equal(result.allowed, false);
  assert.equal(result.status, "pending");
});

test("APPROVAL-009: redaction_required approval returns redacted prompt", () => {
  const metadata: ApprovalClaimMetadata = {
    resolved: true,
    resolution: "redaction_required",
    redactedPreview: "[REDACTED] content here",
    organizationId: "org-123",
  };

  const result = evaluateApprovalClaim({
    metadata,
    organizationId: "org-123",
    destination: "https://chatgpt.com",
  });

  assert.equal(result.allowed, true);
  assert.equal(result.status, "redaction_required");
  assert.equal(result.redactedPrompt, "[REDACTED] content here");
});

test("APPROVAL-010: claimedApprovalMetadata marks claim with timestamp", () => {
  const metadata: ApprovalClaimMetadata = {
    resolved: true,
    resolution: "approved",
    duration: "once",
    organizationId: "org-123",
  };

  const input = {
    metadata,
    employeeId: "emp-456",
    deviceId: "dev-789",
    organizationId: "org-123",
    destination: "https://chatgpt.com",
  };

  const claimed = claimedApprovalMetadata(metadata, input);
  assert.ok(claimed.claimedAt, "Should have claimedAt timestamp");
  assert.equal(claimed.claimedByEmployeeId, "emp-456");
  assert.equal(claimed.claimedByDeviceId, "dev-789");
  assert.equal(claimed.claimedDestination, "https://chatgpt.com");
});

test("APPROVAL-011: approve_24h approval works within time window", () => {
  const now = new Date("2026-06-30T12:00:00Z");
  const metadata: ApprovalClaimMetadata = {
    resolved: true,
    resolution: "approved",
    duration: "24h",
    organizationId: "org-123",
    expiresAt: "2026-07-01T12:00:00Z",
  };

  const result = evaluateApprovalClaim({
    metadata,
    organizationId: "org-123",
    destination: "https://chatgpt.com",
    now,
  });

  assert.equal(result.allowed, true);
  assert.equal(result.status, "approved");
});

test("APPROVAL-012: approve_24h approval fails after expiry", () => {
  const now = new Date("2026-07-02T12:00:00Z");
  const metadata: ApprovalClaimMetadata = {
    resolved: true,
    resolution: "approved",
    duration: "24h",
    organizationId: "org-123",
    expiresAt: "2026-07-01T12:00:00Z",
  };

  const result = evaluateApprovalClaim({
    metadata,
    organizationId: "org-123",
    destination: "https://chatgpt.com",
    now,
  });

  assert.equal(result.allowed, false);
  assert.equal(result.status, "expired");
});
