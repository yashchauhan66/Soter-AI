const assert = require("node:assert/strict");
const fs = require("node:fs");

const files = [
  "app/api/enterprise/saml/route.ts",
  "app/api/enterprise/scim-tokens/route.ts",
  "app/api/scim/v2/Users/route.ts",
  "app/api/scim/v2/Users/[id]/route.ts",
  "app/api/scim/v2/Groups/route.ts",
  "app/api/scim/v2/Groups/[id]/route.ts",
  "app/api/sso/saml/acs/route.ts",
  "lib/enterprise/samlProvisioning.ts",
  "lib/webhooks/store.ts",
  "lib/usage-governance/index.ts",
].filter((path) => fs.existsSync(path));

const sources = files.map((path) => ({ path, source: fs.readFileSync(path, "utf8") }));
const joined = sources.map((file) => file.source).join("\n");

const expectedActions = [
  "saml_config_updated",
  "saml_jit_user_created",
  "saml_login_provisioned",
  "scim_token_created",
  "scim_token_revoked",
  "scim_user_created",
  "scim_user_updated",
  "scim_user_deprovisioned",
  "scim_group_created",
  "scim_group_updated",
  "scim_group_deleted",
];

for (const action of expectedActions) {
  assert.match(joined, new RegExp(action), `missing audit action ${action}`);
}

for (const { path, source } of sources) {
  assert.doesNotMatch(source, /rawAssertion/, `${path}: raw assertion storage/logging`);
  assert.doesNotMatch(source, /SAMLResponse[\s\S]{0,500}organizationAuditLog/, `${path}: SAMLResponse near audit metadata`);
  assert.doesNotMatch(source, /rawToken[\s\S]{0,500}organizationAuditLog/, `${path}: raw SCIM token near audit metadata`);
  const metadataBlocks = [...source.matchAll(/metadata:\s*\{([^}]+)\}/g)].map((match) => match[1]);
  for (const block of metadataBlocks) {
    assert.doesNotMatch(block, /tokenHash|rawToken|SAMLResponse|rawAssertion/, `${path}: secret in audit metadata`);
  }
}
assert.match(joined, /sanitizeMetadata|minimizedScimUserMetadata/);
assert.match(fs.readFileSync("prisma/schema.prisma", "utf8"), /model OrganizationAuditLog[\s\S]*organizationId[\s\S]*metadata/);

console.log(JSON.stringify({
  result: "PASS",
  auditedActions: expectedActions.length,
  note: "Audit source validation passed. Login failure and cross-tenant-denial audit coverage remains partial and is documented as a gap.",
}));
