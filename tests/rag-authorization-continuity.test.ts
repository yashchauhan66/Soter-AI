import assert from "node:assert/strict";
import test from "node:test";
import { createRagAuthorizationReceipt, evaluateRagAuthorization, withRagAuthorizationMetadata } from "../lib/rag/authorizationContinuity";

const base = {
  id: "chunk-1",
  organizationId: "org-1",
  projectId: "project-1",
  collectionId: "collection-1",
  documentId: "document-1",
  documentStatus: "INDEXED",
  textRedacted: "safe content",
  allowedRoles: ["VIEWER"],
  sensitivityLabel: "INTERNAL",
};

test("RAG authorization continuity applies explicit deny before role or group allow", () => {
  const metadata = withRagAuthorizationMetadata({}, {
    allowedGroupIds: ["role:VIEWER"],
    deniedPrincipalIds: ["user-denied"],
    source: "ENTRA",
    permissionVersion: 7,
    now: new Date("2026-06-28T00:00:00.000Z"),
  });
  const context = { organizationId: "org-1", projectId: "project-1", role: "VIEWER", principalId: "user-denied", principalGroups: ["role:VIEWER"] };
  assert.equal(evaluateRagAuthorization({ ...base, metadata }, context).reason, "PRINCIPAL_DENIED");
});

test("RAG authorization continuity enforces permission freshness and emits a privacy-safe receipt", () => {
  const metadata = withRagAuthorizationMetadata({}, {
    allowedPrincipalIds: ["user-1"],
    source: "SHAREPOINT",
    permissionVersion: 3,
    now: new Date("2026-06-01T00:00:00.000Z"),
  });
  const context = {
    organizationId: "org-1",
    projectId: "project-1",
    role: "VIEWER",
    principalId: "user-1",
    maxPermissionAgeMs: 24 * 3_600_000,
    authorizationTime: new Date("2026-06-28T00:00:00.000Z"),
  };
  assert.equal(evaluateRagAuthorization({ ...base, metadata }, context).reason, "PERMISSION_METADATA_STALE");
  const receipt = createRagAuthorizationReceipt({ ...base, metadata }, { ...context, maxPermissionAgeMs: undefined });
  assert.equal(receipt.decision, "ALLOW");
  assert.equal(JSON.stringify(receipt).includes("user-1"), false);
  assert.match(receipt.proofHash, /^[a-f0-9]{64}$/);
});

test("strict principal mode fails closed when permission metadata is absent", () => {
  const decision = evaluateRagAuthorization(base, { organizationId: "org-1", projectId: "project-1", role: "VIEWER", principalId: "user-1", requireExplicitPrincipalAcl: true });
  assert.equal(decision.allowed, false);
  assert.equal(decision.reason, "PERMISSION_METADATA_MISSING");
});
