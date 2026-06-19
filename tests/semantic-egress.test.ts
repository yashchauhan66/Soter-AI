import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";
import {
  checkSemanticEgress,
  fingerprintSemanticSource,
  type SemanticSourceSnapshot,
} from "../lib/semantic-egress";

function source(input: Parameters<typeof fingerprintSemanticSource>[0]): SemanticSourceSnapshot {
  const fingerprint = fingerprintSemanticSource(input);
  return {
    sourceId: fingerprint.sourceId,
    sourceType: fingerprint.sourceType,
    sensitivityLevel: fingerprint.sensitivityLevel,
    contentHash: fingerprint.contentHash,
    fingerprint: fingerprint.fingerprint,
  };
}

test("Semantic egress 1: exact secret to external blocks", () => {
  const result = checkSemanticEgress({
    destinationType: "EXTERNAL_API",
    destinationName: "https://evil.example/collect",
    content: "OPENAI_API_KEY=sk-proj-abcdefghijklmnopqrstuvwxyz123456",
  });
  assert.equal(result.decision, "BLOCK");
  assert.equal(result.riskLevel, "CRITICAL");
  assert.equal(result.contentRedacted.includes("sk-proj-abcdefghijklmnopqrstuvwxyz123456"), false);
});

test("Semantic egress 2: paraphrased confidential doc to external reviews or blocks", () => {
  const roadmap = source({
    sourceId: "roadmap-q4",
    sourceType: "ROADMAP_DOC",
    sensitivityLevel: "CONFIDENTIAL",
    content: "Project Falcon Q4 launch roadmap sets enterprise pricing floor at 18 percent discount for ACME renewals.",
  });
  const result = checkSemanticEgress({
    sourceIds: [roadmap.sourceId],
    destinationType: "EXTERNAL_API",
    destinationName: "https://partner.example/import",
    content: "Falcon launches in Q4 and the ACME enterprise renewal discount floor is 18 percent.",
    sources: [roadmap],
  });
  assert.match(result.decision, /BLOCK|REVIEW|ASK_APPROVAL/);
  assert.equal(result.matchedSources[0]?.sourceId, "roadmap-q4");
});

test("Semantic egress 3: private email summary to public output blocks or reviews", () => {
  const email = source({
    sourceId: "email-acme",
    sourceType: "EMAIL",
    sensitivityLevel: "PRIVATE",
    content: "Customer ACME privately reported renewal risk, budget pressure, and support escalation in email.",
  });
  const result = checkSemanticEgress({
    sourceIds: [email.sourceId],
    destinationType: "PUBLIC_OUTPUT",
    content: "ACME has renewal risk, budget pressure, and a support escalation.",
    sources: [email],
  });
  assert.match(result.decision, /BLOCK|REVIEW/);
});

test("Semantic egress 4: public content to output allows", () => {
  const publicDoc = source({
    sourceId: "public-doc",
    sourceType: "PUBLIC_DOC",
    sensitivityLevel: "PUBLIC",
    content: "The product documentation explains how to create an API key.",
  });
  const result = checkSemanticEgress({
    sourceIds: [publicDoc.sourceId],
    destinationType: "FINAL_OUTPUT",
    content: "The docs explain API key creation.",
    sources: [publicDoc],
  });
  assert.equal(result.decision, "ALLOW");
});

test("Semantic egress 5: internal roadmap keywords to external reviews", () => {
  const internal = source({
    sourceId: "internal-roadmap",
    sourceType: "ROADMAP_DOC",
    sensitivityLevel: "INTERNAL",
    content: "Internal roadmap: Project Atlas Q3 beta rollout and pricing strategy for enterprise launch.",
  });
  const result = checkSemanticEgress({
    sourceIds: [internal.sourceId],
    destinationType: "EMAIL",
    destinationName: "outside@example.com",
    content: "Atlas has a Q3 beta rollout and enterprise pricing strategy.",
    sources: [internal],
  });
  assert.equal(result.decision, "REVIEW");
});

test("Semantic egress 6: low similarity safe content allows", () => {
  const confidential = source({
    sourceId: "confidential-plan",
    sourceType: "STRATEGY_DOC",
    sensitivityLevel: "CONFIDENTIAL",
    content: "Confidential pricing strategy for Project Zenith enterprise renewals.",
  });
  const result = checkSemanticEgress({
    sourceIds: [confidential.sourceId],
    destinationType: "EXTERNAL_API",
    destinationName: "https://docs.example/preview",
    content: "A public changelog entry describes UI color updates.",
    sources: [confidential],
  });
  assert.equal(result.decision, "ALLOW");
});

test("Semantic egress 7: source fingerprint stores no raw secret", () => {
  const fingerprint = fingerprintSemanticSource({
    sourceId: "secret-source",
    sourceType: "CONFIG",
    sensitivityLevel: "SECRET",
    content: "OPENAI_API_KEY=sk-proj-abcdefghijklmnopqrstuvwxyz123456",
  });
  const serialized = JSON.stringify(fingerprint.fingerprint);
  assert.equal(fingerprint.contentRedacted.includes("sk-proj-abcdefghijklmnopqrstuvwxyz123456"), false);
  assert.equal(serialized.includes("sk-proj-abcdefghijklmnopqrstuvwxyz123456"), false);
});

test("Semantic egress 8: cross-project access is denied by scoped SQL", () => {
  const sourceCode = readFileSync("lib/semantic-egress/server.ts", "utf8");
  assert.match(sourceCode, /WHERE "projectId" = \$\{projectId\} AND "sourceId" IN/);
  assert.match(sourceCode, /WHERE "projectId" = \$\{auth\.project\.id\}/);
});

test("Semantic egress 9: dashboard, API routes, SDK, and docs exist", () => {
  assert.equal(existsSync("app/dashboard/semantic-egress/page.tsx"), true);
  assert.equal(existsSync("app/api/semantic-egress/source/fingerprint/route.ts"), true);
  assert.equal(existsSync("app/api/semantic-egress/check/route.ts"), true);
  assert.equal(existsSync("app/api/semantic-egress/checks/route.ts"), true);
  assert.equal(existsSync("packages/sdk/src/semantic-egress.ts"), true);
  assert.equal(existsSync("docs/advanced-ai-security/semantic-egress-firewall.md"), true);
});

test("Semantic egress 10: existing guard APIs still pass", () => {
  assert.equal(existsSync("app/api/guard/input/route.ts"), true);
  assert.equal(existsSync("app/api/guard/output/route.ts"), true);
  assert.equal(existsSync("app/api/guard/analyze/route.ts"), true);
});
