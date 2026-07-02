import test from "node:test";
import assert from "node:assert/strict";
import { lockdownPolicy, LOCKDOWN_BLOCKED_DATA_TYPES } from "../../lib/extension/emergencyLockdown";

test("lockdownPolicy returns disabled state when no state provided", () => {
  const policy = lockdownPolicy(null);
  assert.equal(policy.enabled, false);
  assert.equal(policy.policyVersion, 1);
  assert.equal(policy.reason, null);
  assert.equal(policy.blockUnknownDestinations, true);
  assert.equal(policy.blockAllFileUploads, true);
});

test("lockdownPolicy returns enabled state from DB record", () => {
  const state = {
    enabled: true, policyVersion: 3,
    reason: "Security incident", enabledAt: new Date("2026-07-01"),
  };
  const policy = lockdownPolicy(state);
  assert.equal(policy.enabled, true);
  assert.equal(policy.policyVersion, 3);
  assert.equal(policy.reason, "Security incident");
  assert.ok(policy.enabledAt);
});

test("lockdownPolicy blocks secrets and customer data types", () => {
  const policy = lockdownPolicy({ enabled: true, policyVersion: 2, reason: null, enabledAt: new Date() });
  assert.ok(LOCKDOWN_BLOCKED_DATA_TYPES.includes("env_file"));
  assert.ok(LOCKDOWN_BLOCKED_DATA_TYPES.includes("api_key"));
  assert.ok(LOCKDOWN_BLOCKED_DATA_TYPES.includes("customer_data"));
  assert.ok(LOCKDOWN_BLOCKED_DATA_TYPES.includes("hr_salary"));
  assert.ok(LOCKDOWN_BLOCKED_DATA_TYPES.includes("legal_contract"));
  assert.ok(LOCKDOWN_BLOCKED_DATA_TYPES.includes("financial_text"));
  assert.ok(LOCKDOWN_BLOCKED_DATA_TYPES.includes("password"));
  assert.equal(policy.blockedDataTypes.length, LOCKDOWN_BLOCKED_DATA_TYPES.length);
});

test("lockdownPolicy requires approval for source code", () => {
  const policy = lockdownPolicy({ enabled: true, policyVersion: 2, reason: null, enabledAt: new Date() });
  assert.ok(policy.requireApprovalDataTypes.includes("source_code"));
});

test("lockdownPolicy blocks unknown destinations and file uploads", () => {
  const policy = lockdownPolicy({ enabled: true, policyVersion: 2, reason: null, enabledAt: new Date() });
  assert.equal(policy.blockUnknownDestinations, true);
  assert.equal(policy.blockAllFileUploads, true);
  assert.equal(policy.allowOnlyEnterpriseDestinations, true);
});
