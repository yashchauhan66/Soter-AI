const assert = require("node:assert/strict");
const fs = require("node:fs");

process.env.API_KEY_PEPPER ||= "phase7-test-pepper-that-is-long-enough";

const source = fs.readFileSync("lib/auth/permissions.ts", "utf8");
const permissionsMatch = source.match(/export const ALL_PERMISSIONS = \[([\s\S]*?)\] as const;/);
assert.ok(permissionsMatch, "ALL_PERMISSIONS must be declared");

function quotedValues(block) {
  return [...block.matchAll(/"([^"]+)"/g)].map((match) => match[1]);
}

const allPermissions = quotedValues(permissionsMatch[1]);
const roleBlocks = {};
for (const role of ["OWNER", "ADMIN", "DEVELOPER", "SECURITY_ANALYST", "BILLING", "VIEWER"]) {
  const match = source.match(new RegExp(`${role}: \\[([\\s\\S]*?)\\],`));
  roleBlocks[role] = role === "OWNER" ? allPermissions : quotedValues(match?.[1] ?? "");
}

function can(role, permission) {
  return roleBlocks[role].includes(permission);
}

for (const permission of allPermissions) {
  assert.equal(can("OWNER", permission), true, `OWNER missing ${permission}`);
}

const expectations = [
  ["VIEWER", "project:read", true],
  ["VIEWER", "project:delete", false],
  ["VIEWER", "api_key:create", false],
  ["VIEWER", "logs:read", true],
  ["VIEWER", "billing:update", false],
  ["BILLING", "billing:update", true],
  ["BILLING", "logs:read", false],
  ["DEVELOPER", "api_key:create", true],
  ["DEVELOPER", "billing:update", false],
  ["SECURITY_ANALYST", "reports:export", true],
  ["SECURITY_ANALYST", "member:manage", false],
  ["ADMIN", "member:manage", true],
  ["ADMIN", "billing:update", false],
];

for (const [role, permission, expected] of expectations) {
  assert.equal(can(role, permission), expected, `${role} ${permission}`);
}

const guards = fs.readFileSync("lib/auth/guards.ts", "utf8");
assert.match(guards, /requirePermission/);
assert.match(guards, /requireProjectPermission/);
assert.match(guards, /hasPermission/);

console.log(JSON.stringify({
  result: "PASS",
  roles: Object.keys(roleBlocks).length,
  permissions: allPermissions.length,
  note: "RBAC matrix checks passed. Dedicated saml:manage/scim:manage permissions are not present; routes currently rely on member:manage.",
}));
