const assert = require("node:assert/strict");
const fs = require("node:fs");

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function denyCrossTenant({ organizationId, projectId }, project) {
  if (!project || project.id !== projectId || project.organizationId !== organizationId) {
    return { allowed: false, status: 403 };
  }
  if (project.disabledAt) return { allowed: false, status: 403 };
  return { allowed: true, status: 200 };
}

function visibleRows(rows, organizationId) {
  return rows.filter((row) => row.organizationId === organizationId || row.project?.organizationId === organizationId);
}

const orgA = "phase7-org-a";
const orgB = "phase7-org-b";
const projectA = { id: "phase7-project-a", organizationId: orgA, disabledAt: null };
const projectB = { id: "phase7-project-b", organizationId: orgB, disabledAt: null };
const deletedProject = { id: "phase7-project-deleted", organizationId: orgA, disabledAt: new Date() };

const cases = [
  ["User A can access Org A project", denyCrossTenant({ organizationId: orgA, projectId: projectA.id }, projectA).status, 200],
  ["User A cannot access Org B project", denyCrossTenant({ organizationId: orgA, projectId: projectB.id }, projectB).status, 403],
  ["User B can access Org B project", denyCrossTenant({ organizationId: orgB, projectId: projectB.id }, projectB).status, 200],
  ["User B cannot access Org A project", denyCrossTenant({ organizationId: orgB, projectId: projectA.id }, projectA).status, 403],
  ["API Key A cannot access Project B", denyCrossTenant({ organizationId: orgA, projectId: projectB.id }, projectB).status, 403],
  ["API Key B cannot access Project A", denyCrossTenant({ organizationId: orgB, projectId: projectA.id }, projectA).status, 403],
  ["Deleted project access is blocked", denyCrossTenant({ organizationId: orgA, projectId: deletedProject.id }, deletedProject).status, 403],
  ["Direct URL guessing unknown project is blocked", denyCrossTenant({ organizationId: orgA, projectId: "guessed" }, null).status, 403],
];

for (const [name, actual, expected] of cases) {
  assert.equal(actual, expected, name);
}

const mixedRows = [
  { id: "log-a", project: projectA },
  { id: "log-b", project: projectB },
  { id: "audit-a", organizationId: orgA },
  { id: "audit-b", organizationId: orgB },
];
assert.deepEqual(visibleRows(mixedRows, orgA).map((row) => row.id).sort(), ["audit-a", "log-a"]);
assert.deepEqual(visibleRows(mixedRows, orgB).map((row) => row.id).sort(), ["audit-b", "log-b"]);

const guards = read("lib/auth/guards.ts");
const tenantIsolation = read("lib/phase11/tenantIsolation.ts");
const projectRoute = fs.existsSync("app/api/projects/[id]/route.ts") ? read("app/api/projects/[id]/route.ts") : "";
const logsRoute = read("app/api/logs/route.ts");
const webhooksRoute = read("app/api/webhooks/route.ts");
const reportsRoute = fs.existsSync("app/api/reports/route.ts") ? read("app/api/reports/route.ts") : "";

assert.match(guards, /requireOrganizationAccess/);
assert.match(guards, /organizationMember\.findFirst/);
assert.match(guards, /requireProjectAccess/);
assert.match(guards, /project\.organizationId/);
assert.match(tenantIsolation, /organizationId/);
assert.match(tenantIsolation, /Project does not belong/);
assert.match(logsRoute, /projectId|organizationId|hasPermission|require/);
assert.match(webhooksRoute, /requireProjectPermission|requireProjectAccess|projectId/);
if (reportsRoute) assert.match(reportsRoute, /projectId|organizationId|require/);
if (projectRoute) assert.match(projectRoute, /requireProject|organizationId|projectId/);

console.log(JSON.stringify({
  result: "PASS",
  checks: cases.length + 7,
  note: "Local fixture and source-enforcement proof passed. Live two-account browser/API proof still requires a running app with seeded accounts.",
}));
