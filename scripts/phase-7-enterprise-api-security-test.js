const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : entry.isFile() && full.endsWith(".ts") ? [full] : [];
  });
}

const enterpriseRoutes = [
  ...walk("app/api/enterprise"),
  ...walk("app/api/scim"),
  ...walk("app/api/sso/saml"),
];

assert.ok(enterpriseRoutes.length >= 10, "enterprise API route inventory should not be empty");

const failures = [];
for (const route of enterpriseRoutes) {
  const src = fs.readFileSync(route, "utf8");
  const normalized = route.replaceAll("\\", "/");
  const isScim = normalized.includes("/api/scim/");
  const isPublicSamlEntry = normalized.includes("/api/sso/saml/login") || normalized.includes("/api/sso/saml/metadata") || normalized.includes("/api/sso/saml/acs");
  const hasAuth = /require(Permission|OrganizationAccess|ProjectPermission|User)|authorizeScimRequest|validateSamlResponse|parseIdpMetadata/.test(src);
  if (!hasAuth && !isPublicSamlEntry) failures.push(`${normalized}: missing auth/validation helper`);
  if (isScim) {
    if (!/authorizeScimRequest/.test(src)) failures.push(`${normalized}: SCIM route missing bearer authorization`);
    if (!/organizationId/.test(src)) failures.push(`${normalized}: SCIM route missing org scope`);
  }
  if (/rawToken|x509Certificate|SAMLResponse|tokenHash/.test(src) && /console\.(log|error|warn)/.test(src)) {
    failures.push(`${normalized}: sensitive value appears near console logging`);
  }
}

assert.deepEqual(failures, []);

const saml = fs.readFileSync("lib/enterprise/saml.ts", "utf8");
assert.match(saml, /Audience restriction/);
assert.match(saml, /Destination/);
assert.match(saml, /Recipient/);
assert.match(saml, /too large/);
assert.match(saml, /replay/);

console.log(JSON.stringify({
  result: "PASS",
  routesChecked: enterpriseRoutes.length,
  note: "Enterprise API source security checks passed for auth, org scope, SAML validation, and sensitive logging patterns.",
}));
