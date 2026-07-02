import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createEnrollmentToken, enrollmentTokenStatus, hashSecret, redeemEnrollmentToken } from "../../lib/extension/enrollment";
import { applyEmergencyLockdown, lockdownPolicy, setEmergencyLockdown } from "../../lib/extension/emergencyLockdown";
import { defaultState } from "../../apps/extension/src/lib/storage";
import { validateManagedConfig } from "../../apps/extension/src/lib/enrollment";
import { emergencyLockdownAction } from "../../apps/extension/src/lib/scanner";
import { renderPopup } from "../../apps/extension/src/popup/PopupApp";
import type { ExtensionState } from "../../apps/extension/src/lib/types";

const root = resolve(import.meta.dirname, "..", "..");

test("Prisma schema and migration define organization-scoped hashed enrollment tokens", () => {
  const schema = readFileSync(resolve(root, "prisma/schema.prisma"), "utf8");
  const migration = readFileSync(resolve(root, "prisma/migrations/20260630173000_extension_enrollment_lockdown/migration.sql"), "utf8");
  assert.match(schema, /model ExtensionEnrollmentToken[\s\S]*tokenHash\s+String\s+@unique/);
  assert.match(schema, /model ExtensionEnrollmentToken[\s\S]*createdByAdminId\s+String\s/);
  for (const column of ["organizationId", "tokenHash", "expiresAt"]) {
    assert.match(migration, new RegExp(`ExtensionEnrollmentToken_${column}_(?:idx|key)`));
  }
  assert.doesNotMatch(schema, /model ExtensionEnrollmentToken[\s\S]*rawToken/);
});

test("enrollment token creation stores only a hash and writes an audit event", async () => {
  const writes: Array<{ kind: string; data: Record<string, unknown> }> = [];
  const tx = {
    extensionEnrollmentToken: { create: async ({ data }: { data: Record<string, unknown> }) => {
      writes.push({ kind: "token", data });
      return { id: "token-1", organizationId: data.organizationId, employeeEmail: null, department: null, role: null, maxUses: 1, usedCount: 0, expiresAt: data.expiresAt, createdAt: new Date(0) };
    } },
    adminAuditLog: { create: async ({ data }: { data: Record<string, unknown> }) => { writes.push({ kind: "audit", data }); return data; } },
  };
  const fakeDb = { $transaction: async (work: (transaction: typeof tx) => unknown) => work(tx) };
  const result = await createEnrollmentToken({ organizationId: "org-1", createdByAdminId: "admin-1", maxUses: 1, expiresAt: new Date(Date.now() + 60_000) }, fakeDb as never);
  assert.match(result.rawToken, /^soter_enroll_/);
  assert.equal(writes[0].data.tokenHash, hashSecret(result.rawToken));
  assert.equal(JSON.stringify(writes).includes(result.rawToken), false);
  assert.equal(writes[1].data.action, "extension_enrollment_token_created");
});

test("expired, revoked, and overused enrollment tokens fail", () => {
  const future = new Date(Date.now() + 60_000);
  assert.equal(enrollmentTokenStatus({ expiresAt: new Date(0), revokedAt: null, usedCount: 0, maxUses: 1 }), "expired");
  assert.equal(enrollmentTokenStatus({ expiresAt: future, revokedAt: new Date(), usedCount: 0, maxUses: 1 }), "revoked");
  assert.equal(enrollmentTokenStatus({ expiresAt: future, revokedAt: null, usedCount: 1, maxUses: 1 }), "overused");
});

test("successful enrollment returns a device credential and a single-use token cannot be reused", async () => {
  const token = { id: "token-1", organizationId: "org-1", organization: { name: "Acme" }, employeeEmail: "user@acme.test", department: "Security", role: "Engineer", maxUses: 1, usedCount: 0, expiresAt: new Date(Date.now() + 60_000), revokedAt: null };
  const audits: unknown[] = [];
  const tx = {
    extensionEnrollmentToken: {
      findUnique: async () => ({ ...token }),
      updateMany: async () => token.usedCount < token.maxUses ? (token.usedCount += 1, { count: 1 }) : { count: 0 },
    },
    deviceAgent: { create: async ({ data }: { data: Record<string, unknown> }) => ({ id: "device-1", ...data }) },
    emergencyLockdownState: { findUnique: async () => ({ policyVersion: 7 }) },
    adminAuditLog: { create: async ({ data }: { data: unknown }) => { audits.push(data); return data; } },
  };
  const fakeDb = { $transaction: async (work: (transaction: typeof tx) => unknown) => work(tx) };
  const input = { enrollmentCode: "soter_enroll_test_secret_value", apiBaseUrl: "https://soter.example" };
  const first = await redeemEnrollmentToken(input, fakeDb as never);
  const second = await redeemEnrollmentToken(input, fakeDb as never);
  assert.equal(first.ok, true);
  if (first.ok) {
    assert.equal(first.organizationId, "org-1");
    assert.equal(first.policyVersion, "7");
    assert.match(first.deviceToken, /^soter_device_/);
  }
  assert.deepEqual(second, { ok: false, status: "overused", message: "Enrollment code has reached its usage limit." });
  assert.equal(audits.length, 1);
});

test("emergency lockdown enable and disable increment policy state and are audited", async () => {
  let version = 1;
  const auditActions: string[] = [];
  const securityEvents: string[] = [];
  const tx = {
    emergencyLockdownState: { upsert: async ({ create, update }: { create: Record<string, unknown>; update: Record<string, unknown> }) => {
      version += 1;
      return { id: "lock-1", ...create, ...update, policyVersion: version };
    } },
    adminAuditLog: { create: async ({ data }: { data: { action: string } }) => { auditActions.push(data.action); return data; } },
    securityEvent: { create: async ({ data }: { data: { eventType: string } }) => { securityEvents.push(data.eventType); return data; } },
  };
  const fakeDb = { $transaction: async (work: (transaction: typeof tx) => unknown) => work(tx) };
  const enabled = await setEmergencyLockdown({ organizationId: "org-1", enabled: true, adminId: "admin-1", reason: "Incident" }, fakeDb as never);
  const disabled = await setEmergencyLockdown({ organizationId: "org-1", enabled: false, adminId: "admin-1" }, fakeDb as never);
  assert.equal(enabled.enabled, true);
  assert.equal(disabled.enabled, false);
  assert.deepEqual(auditActions, ["emergency_lockdown_enabled", "emergency_lockdown_disabled"]);
  assert.deepEqual(securityEvents, ["EMERGENCY_LOCKDOWN_ENABLED", "EMERGENCY_LOCKDOWN_DISABLED"]);
});

test("extension policy bundle carries lockdown state and strict local actions", () => {
  const state = { enabled: true, policyVersion: 9, reason: "Incident", enabledAt: new Date(0) };
  const policy = applyEmergencyLockdown(defaultState.policy!, state);
  assert.equal(policy.emergencyLockdown?.enabled, true);
  assert.match(policy.version, /emergency-9$/);
  const extensionState = { ...defaultState, enrollmentStatus: "enrolled" as const, policy };
  assert.equal(emergencyLockdownAction({ state: extensionState, destinationType: "unknown", detectedDataTypes: [], eventType: "submit" }), "block");
  assert.equal(emergencyLockdownAction({ state: extensionState, destinationType: "enterprise_ai", detectedDataTypes: ["source_code"], eventType: "submit" }), "require_approval");
  assert.equal(emergencyLockdownAction({ state: extensionState, destinationType: "enterprise_ai", detectedDataTypes: [], eventType: "file_upload" }), "block");
  assert.ok(lockdownPolicy(state).blockedDataTypes.includes("hr_salary"));
});

test("popup renders not-enrolled, enrolled, and managed states without exposing device tokens", () => {
  const render = (state: ExtensionState) => {
    const fakeRoot = { innerHTML: "", querySelector: () => null } as unknown as HTMLElement;
    renderPopup(fakeRoot, state);
    return fakeRoot.innerHTML;
  };
  assert.match(render(defaultState), /data-enrollment-view="not-enrolled"/);
  const enrolled = { ...defaultState, enrollmentStatus: "enrolled" as const, enrollmentMode: "self_service" as const, config: { ...defaultState.config, deviceToken: "do-not-render" } };
  assert.match(render(enrolled), /data-enrollment-view="enrolled"/);
  assert.match(render(enrolled), /Response scanning/);
  assert.doesNotMatch(render(enrolled), /do-not-render/);
  const managed = { ...enrolled, enrollmentMode: "managed" as const };
  assert.match(render(managed), /Managed by organization/);
  assert.deepEqual(validateManagedConfig({ organizationId: "org-1", email: "user@acme.test" }), { valid: true, missing: [] });
});

test("built extension has manifest at root and every referenced file exists", () => {
  const dist = resolve(root, "dist", "extension");
  const manifestPath = resolve(dist, "manifest.json");
  assert.equal(existsSync(manifestPath), true, "run npm run build:extension before this test");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const paths = [manifest.background.service_worker, manifest.action.default_popup, manifest.side_panel.default_path, ...manifest.content_scripts.flatMap((entry: { js?: string[]; css?: string[] }) => [...(entry.js ?? []), ...(entry.css ?? [])]), ...Object.values(manifest.icons), ...Object.values(manifest.action.default_icon)] as string[];
  for (const path of paths) assert.equal(existsSync(resolve(dist, path)), true, `missing ${path}`);
  assert.equal(existsSync(resolve(dist, "apps", "extension", "dist")), false, "nested dist output must not exist");
});
