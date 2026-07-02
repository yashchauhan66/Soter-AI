import test from "node:test";
import assert from "node:assert/strict";
import { hashSecret, enrollmentTokenStatus, enrollmentStatusMessage } from "../../lib/extension/enrollment";

test("hashSecret returns a 64-char hex string", () => {
  const hash = hashSecret("hello");
  assert.match(hash, /^[0-9a-f]{64}$/);
});

test("hashSecret is deterministic", () => {
  assert.equal(hashSecret("test"), hashSecret("test"));
});

test("hashSecret produces different outputs for different inputs", () => {
  assert.notEqual(hashSecret("token-a"), hashSecret("token-b"));
});

test("enrollmentTokenStatus returns 'invalid' for null token", () => {
  assert.equal(enrollmentTokenStatus(null), "invalid");
});

test("enrollmentTokenStatus returns 'valid' for a valid token", () => {
  const token = {
    expiresAt: new Date(Date.now() + 86400000),
    revokedAt: null, usedCount: 0, maxUses: 5,
  };
  assert.equal(enrollmentTokenStatus(token), "valid");
});

test("enrollmentTokenStatus returns 'expired' for an expired token", () => {
  const token = {
    expiresAt: new Date(Date.now() - 1000),
    revokedAt: null, usedCount: 0, maxUses: 5,
  };
  assert.equal(enrollmentTokenStatus(token), "expired");
});

test("enrollmentTokenStatus returns 'revoked' for a revoked token", () => {
  const token = {
    expiresAt: new Date(Date.now() + 86400000),
    revokedAt: new Date(), usedCount: 0, maxUses: 5,
  };
  assert.equal(enrollmentTokenStatus(token), "revoked");
});

test("enrollmentTokenStatus returns 'overused' when usedCount >= maxUses", () => {
  const token = {
    expiresAt: new Date(Date.now() + 86400000),
    revokedAt: null, usedCount: 5, maxUses: 5,
  };
  assert.equal(enrollmentTokenStatus(token), "overused");
});

test("enrollmentTokenStatus returns 'valid' at boundary below maxUses", () => {
  const token = {
    expiresAt: new Date(Date.now() + 86400000),
    revokedAt: null, usedCount: 4, maxUses: 5,
  };
  assert.equal(enrollmentTokenStatus(token), "valid");
});

test("enrollmentStatusMessage returns correct messages", () => {
  assert.match(enrollmentStatusMessage("expired"), /expired/i);
  assert.match(enrollmentStatusMessage("revoked"), /revoked/i);
  assert.match(enrollmentStatusMessage("overused"), /usage limit/i);
  assert.match(enrollmentStatusMessage("invalid"), /invalid/i);
});
