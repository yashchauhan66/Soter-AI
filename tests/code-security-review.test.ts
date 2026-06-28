import assert from "node:assert/strict";
import test from "node:test";
import { reviewCodeSecurity } from "../lib/code-security";
import { GITHUB_CODE_REVIEW_WORKFLOW } from "../lib/code-security/githubWorkflow";

test("AI code review finds critical secrets and redacts evidence", () => {
  const rawSecret = "sk-proj-ThisMustNeverAppearInEvidence123456";
  const result = reviewCodeSecurity({
    filename: "route.ts",
    code: `const apiKey = "${rawSecret}";`,
    context: { environment: "production", internetExposed: true, aiGenerated: true },
  });

  assert.equal(result.decision, "FAIL");
  assert.ok(result.counts.CRITICAL >= 1);
  assert.ok(result.findings.some((finding) => finding.category === "SECRETS"));
  assert.equal(JSON.stringify(result).includes(rawSecret), false);
  assert.equal(result.metadata.contentStored, false);
});

test("AI code review detects auth, SQL injection, and sensitive logging flaws", () => {
  const result = reviewCodeSecurity({
    filename: "login.ts",
    code: [
      "export async function POST(req) {",
      "  const body = await req.json();",
      "  const row = db.query(`SELECT * FROM users WHERE id = ${body.id}`);",
      "  if (row.password === body.password) console.log('token', body.token);",
      "}",
    ].join("\n"),
    context: { containsAuthCode: true, handlesSensitiveData: true, environment: "production" },
  });

  for (const ruleId of ["INJ-003", "AUTH-002", "AUTH-003", "DATA-001"]) {
    assert.ok(result.findings.some((finding) => finding.ruleId === ruleId), `${ruleId} missing`);
  }
  assert.equal(result.decision, "FAIL");
});

test("AI code review ignores removed diff lines and accepts parameterized code", () => {
  const result = reviewCodeSecurity({
    filename: "users.ts",
    code: [
      "@@ -1,2 +1,2 @@",
      "-const apiKey = 'sk-proj-RemovedSecretToken123456';",
      "+const apiKey = process.env.API_KEY;",
      "+const user = await db.query('SELECT * FROM users WHERE id = $1', [id]);",
    ].join("\n"),
    context: { environment: "production" },
  });

  assert.equal(result.decision, "PASS");
  assert.equal(result.findings.length, 0);
});

test("visible server authorization guard suppresses missing-guard heuristic", () => {
  const result = reviewCodeSecurity({
    filename: "route.ts",
    code: "export async function POST() { await requireProjectPermission(projectId, 'project:update'); return update(); }",
    context: { containsAuthCode: true },
  });
  assert.equal(result.findings.some((finding) => finding.ruleId === "AUTH-003"), false);
});

test("GitHub workflow fails risky PRs without leaking shell state", () => {
  assert.match(GITHUB_CODE_REVIEW_WORKFLOW, /SOTERAI_API_KEY/);
  assert.match(GITHUB_CODE_REVIEW_WORKFLOW, /done < <\(git diff/);
  assert.match(GITHUB_CODE_REVIEW_WORKFLOW, /exit "\$\{failed\}"/);
  assert.doesNotMatch(GITHUB_CODE_REVIEW_WORKFLOW, /permissions:\s*\n\s*contents:\s*write/);
});
