import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import test from "node:test";

process.env.API_KEY_PEPPER = "phase6-test-pepper-that-is-long-enough";
process.env.SCIM_TOKEN_PEPPER = "phase6-scim-token-pepper-that-is-long-enough";

import {
  applyGroupPatch,
  applyUserPatch,
  constantTimeEquals,
  deriveRoleFromGroupName,
  generateScimToken,
  hashScimToken,
  minimizedScimUserMetadata,
  parsePatchPayload,
  scimGroupMembersFromValue,
} from "../lib/enterprise/scim";
import { expectedDeletionConfirmation, retentionCutoff, retentionDays } from "../lib/retention/policy";

test("SCIM tokens are hashed and raw values are not embedded in the hash", () => {
  const token = generateScimToken();
  assert.match(token.rawToken, /^scim_/);
  assert.equal(hashScimToken(token.rawToken), token.tokenHash);
  assert.equal(token.tokenHash.includes(token.rawToken), false);
  assert.equal(constantTimeEquals(token.tokenHash, hashScimToken(token.rawToken)), true);
  assert.equal(constantTimeEquals(token.tokenHash, hashScimToken(`${token.rawToken}x`)), false);
});

test("SCIM user PATCH handles active, names, and email changes", () => {
  const ops = parsePatchPayload({
    Operations: [
      { op: "replace", path: "active", value: false },
      { op: "replace", path: "name", value: { givenName: "Priya", familyName: "Shah" } },
      { op: "replace", path: "emails", value: [{ value: "Priya@example.com" }] },
    ],
  });
  assert.deepEqual(applyUserPatch({ active: true, name: null, email: "old@example.com" }, ops), {
    active: false,
    name: "Priya Shah",
    email: "priya@example.com",
  });
});

test("SCIM user metadata is minimized and raw mapping payload writes stay disabled", async () => {
  const metadata = minimizedScimUserMetadata({
    externalId: "idp-user-123",
    userName: "alice@example.com",
    active: true,
    operation: "create",
  });
  const serialized = JSON.stringify(metadata);

  assert.equal(serialized.includes("alice@example.com"), false);
  assert.equal(serialized.includes("password"), false);
  assert.equal(serialized.includes("token"), false);
  assert.equal(metadata.userNameDomain, "example.com");

  const scimSources = await Promise.all([
    readFile("app/api/scim/v2/Users/route.ts", "utf8"),
    readFile("app/api/scim/v2/Users/[id]/route.ts", "utf8"),
    readFile("lib/enterprise/scim.ts", "utf8"),
  ]);
  for (const source of scimSources) {
    assert.doesNotMatch(source, /raw\s*:/);
  }
});

test("SCIM group PATCH maps members and roles deterministically", () => {
  const members = scimGroupMembersFromValue([{ value: "mapping-1", display: "Asha" }, { value: "mapping-2" }]);
  assert.deepEqual(members.map((member) => member.value), ["mapping-1", "mapping-2"]);
  const next = applyGroupPatch({ displayName: "viewer", members: [] }, [{ op: "add", path: "members", value: members }]);
  assert.deepEqual(next.members.map((member) => member.value), ["mapping-1", "mapping-2"]);
  assert.equal(deriveRoleFromGroupName("Security Analyst"), "SECURITY_ANALYST");
});

test("SCIM v2 routes cover users, groups, auth, tenant scope, and audits", async () => {
  const files = await Promise.all([
    readFile("app/api/scim/v2/Users/route.ts", "utf8"),
    readFile("app/api/scim/v2/Users/[id]/route.ts", "utf8"),
    readFile("app/api/scim/v2/Groups/route.ts", "utf8"),
    readFile("app/api/scim/v2/Groups/[id]/route.ts", "utf8"),
    readFile("app/api/enterprise/scim-tokens/route.ts", "utf8"),
  ]);
  for (const file of files.slice(0, 4)) {
    assert.match(file, /authorizeScimRequest/);
    assert.match(file, /organizationId/);
    assert.match(file, /organizationAuditLog/);
  }
  assert.match(files[1], /scim_user_deprovisioned/);
  assert.match(files[2], /deriveRoleFromGroupName/);
  assert.match(files[4], /token: token\.rawToken/);
  assert.match(files[4], /tokenHash/);
  assert.doesNotMatch(files[4], /tokenHash.*rawToken/);
});

test("retention windows and deletion confirmations are deterministic", () => {
  assert.equal(retentionDays("DAYS_365"), 365);
  assert.equal(retentionCutoff(new Date("2026-06-14T00:00:00Z"), "DAYS_7").toISOString(), "2026-06-07T00:00:00.000Z");
  assert.equal(expectedDeletionConfirmation("ORGANIZATION", "acme"), "DELETE ORGANIZATION acme");
  assert.equal(expectedDeletionConfirmation("PROJECT", "Support Bot"), "DELETE PROJECT Support Bot");
});

test("enterprise admin routes enforce server-side authorization and audits", async () => {
  const [securityRoute, deletionRoute, apiKey] = await Promise.all([
    readFile("app/api/enterprise/security/route.ts", "utf8"),
    readFile("app/api/enterprise/data-deletion/route.ts", "utf8"),
    readFile("lib/apiKey.ts", "utf8"),
  ]);
  assert.match(securityRoute, /requireOrganizationAccess/);
  assert.match(securityRoute, /organizationAuditLog/);
  assert.match(securityRoute, /force_api_key_rotation/);
  assert.match(deletionRoute, /Only organization owners/);
  assert.match(apiKey, /organization\?\.disabled/);
});

test("self-hosted Docker, Helm, and backup assets exist", () => {
  for (const path of [
    "Dockerfile",
    "Dockerfile.worker",
    "docker-compose.prod.yml",
    "scripts/backup.sh",
    "scripts/restore.sh",
    "scripts/healthcheck.sh",
    "helm/cyberrakshak/Chart.yaml",
    "helm/cyberrakshak/values.yaml",
    "helm/cyberrakshak/templates/deployment.yaml",
    "helm/cyberrakshak/templates/worker.yaml",
    "helm/cyberrakshak/templates/service.yaml",
    "helm/cyberrakshak/templates/ingress.yaml",
    "helm/cyberrakshak/templates/secrets.yaml",
    "helm/cyberrakshak/templates/configmap.yaml",
    "helm/cyberrakshak/templates/migrations-job.yaml",
  ]) {
    assert.equal(existsSync(path), true, path);
  }
});

test("public trust and compliance pages avoid false certification claims", async () => {
  const files = await Promise.all([
    readFile("app/trust/page.tsx", "utf8"),
    readFile("app/security/page.tsx", "utf8"),
    readFile("app/compliance/soc2-readiness/page.tsx", "utf8"),
    readFile("app/compliance/iso27001-readiness/page.tsx", "utf8"),
    readFile("docs/compliance/security-whitepaper.md", "utf8"),
  ]);
  const joined = files.join("\n");
  assert.match(joined, /OWASP LLM Top 10 aligned/);
  assert.match(joined, /defense-in-depth/);
  assert.doesNotMatch(joined, /100% secure|guaranteed protection|perfectly solves OWASP/i);
  assert.doesNotMatch(joined, /SOC 2 certified|ISO 27001 certified/i);
});
