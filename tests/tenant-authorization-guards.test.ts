import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  assertOrganizationAvailable,
  assertProjectAvailable,
  buildActiveMembershipWhere,
} from "../lib/auth/availability";
import { ForbiddenError } from "../lib/auth/errors";
import { hasPermission, permissionsFor } from "../lib/auth/permissions";

const MEMBER = { id: "user_synthetic_member", isAdmin: false };
const PLATFORM_ADMIN = { id: "user_synthetic_platform_admin", isAdmin: true };

test("active-organization scope excludes disabled tenants for ordinary members", () => {
  assert.deepEqual(buildActiveMembershipWhere(MEMBER), {
    userId: MEMBER.id,
    organization: { disabled: false },
  });
  assert.deepEqual(buildActiveMembershipWhere(MEMBER, "org_synthetic_requested"), {
    userId: MEMBER.id,
    organizationId: "org_synthetic_requested",
    organization: { disabled: false },
  });
});

test("platform admins retain disabled-tenant recovery scope", () => {
  assert.deepEqual(buildActiveMembershipWhere(PLATFORM_ADMIN, "org_synthetic_disabled"), {
    userId: PLATFORM_ADMIN.id,
    organizationId: "org_synthetic_disabled",
  });
});

test("disabled organizations fail closed for members without leaking the stored reason", () => {
  const privateReason = "synthetic private suspension evidence";

  assert.throws(
    () => assertOrganizationAvailable({ disabled: true }, MEMBER),
    (error: unknown) => {
      assert.ok(error instanceof ForbiddenError);
      assert.equal(error.status, 403);
      assert.equal(error.message, "This organization is currently unavailable.");
      assert.equal(error.message.includes(privateReason), false);
      return true;
    },
  );
});

test("active organizations remain available and platform admins can recover disabled organizations", () => {
  assert.doesNotThrow(() => assertOrganizationAvailable({ disabled: false }, MEMBER));
  assert.doesNotThrow(() => assertOrganizationAvailable({ disabled: true }, PLATFORM_ADMIN));
});

test("disabled projects fail closed for members while platform admins retain recovery access", () => {
  const disabledAt = new Date("2030-01-01T00:00:00.000Z");

  assert.throws(
    () => assertProjectAvailable({ disabledAt }, MEMBER),
    (error: unknown) => {
      assert.ok(error instanceof ForbiddenError);
      assert.equal(error.status, 403);
      assert.equal(error.message, "This project is currently unavailable.");
      return true;
    },
  );
  assert.doesNotThrow(() => assertProjectAvailable({ disabledAt: null }, MEMBER));
  assert.doesNotThrow(() => assertProjectAvailable({ disabledAt }, PLATFORM_ADMIN));
});

test("runtime role drift remains fail-closed instead of inheriting permissions", () => {
  const unknownRole = "SYNTHETIC_UNKNOWN_ROLE" as Parameters<typeof permissionsFor>[0];

  assert.deepEqual(permissionsFor(unknownRole), []);
  assert.equal(hasPermission(unknownRole, "project:read"), false);
  assert.equal(hasPermission(unknownRole, "member:manage"), false);
});

test("explicit project lookup fails closed instead of falling back to another project", () => {
  const source = readFileSync("lib/auth.ts", "utf8");
  const helper = source.slice(source.indexOf("export async function getCurrentProjectById"));

  assert.match(helper, /if\s*\(\s*projectId\s*\)\s*{[\s\S]*requireProjectAccess\(projectId\)[\s\S]*return access\.project;/);
  assert.doesNotMatch(helper, /catch\s*\(/);
  assert.doesNotMatch(helper, /Project access fallback/);
});
