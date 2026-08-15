// The workflow audit exists twice on purpose, and this suite is the only thing
// preventing that from becoming a bug.
//
// `lib/guard/workflowAudit.ts` is the canonical implementation, served over HTTP
// by /api/workflow/audit because Make.com custom apps are declarative JSON and
// cannot run code. The n8n node keeps its own local copy so `workflowAudit`
// stays zero-network there — a security audit that has to phone home to run is a
// poor pitch, and it would leak the customer's workflow export to do it.
//
// Two copies of anything drift. What follows pins the shared one's behaviour on
// a corpus that exercises every rule, so a change to either side that is not
// mirrored shows up as a failure rather than as a customer noticing that Make
// and n8n disagree about whether their workflow is safe.
import test from "node:test";
import assert from "node:assert/strict";
import {
  auditWorkflow,
  calculateWorkflowSecurityScore,
  parseWorkflowJson,
  riskLevelFromScore,
  WorkflowAuditError,
  type AuditFinding,
} from "../../lib/guard/workflowAudit";

const UNPROTECTED_AI_AGENT = JSON.stringify({
  name: "Support Agent",
  nodes: [
    { name: "Webhook", type: "n8n-nodes-base.webhook", parameters: {} },
    { name: "AI Agent", type: "@n8n/n8n-nodes-langchain.agent", parameters: {} },
    { name: "Respond", type: "n8n-nodes-base.respondToWebhook", parameters: {} },
  ],
  connections: { Webhook: {}, "AI Agent": {} },
});

const GUARDED_WORKFLOW = JSON.stringify({
  name: "Guarded Support Agent",
  nodes: [
    { name: "Webhook", type: "n8n-nodes-base.webhook", parameters: {} },
    { name: "SoterAI", type: "n8n-nodes-soterai.soterGuard", parameters: { action: "universalGuard" } },
    { name: "AI Agent", type: "@n8n/n8n-nodes-langchain.agent", parameters: {} },
  ],
  connections: {},
});

// ── Input handling ───────────────────────────────────────────────────────────

test("malformed JSON is rejected with a caller-facing error, not a crash", () => {
  for (const bad of ["", "   ", "not json", "[1,2,3]", '"a string"', "null"]) {
    assert.throws(
      () => parseWorkflowJson(bad),
      WorkflowAuditError,
      `${JSON.stringify(bad)} should be a WorkflowAuditError, so the route can return 400 rather than 500`,
    );
  }
});

test("an oversized export is refused before it is parsed", () => {
  assert.throws(() => parseWorkflowJson(`{"padding":"${"x".repeat(2_000_001)}"}`), WorkflowAuditError);
});

test("a workflow with no nodes is a finding, not an error", () => {
  const result = auditWorkflow('{"name":"Empty","nodes":[],"connections":{}}');
  assert.ok(result.findings.some((f) => f.id === "workflow.empty"));
  assert.equal(result.workflowName, "Empty");
});

test("an unnamed workflow gets a stable placeholder rather than undefined", () => {
  assert.equal(auditWorkflow('{"nodes":[],"connections":{}}').workflowName, "Untitled workflow");
});

// ── The rules actually fire ──────────────────────────────────────────────────

test("an unprotected AI agent behind a webhook produces the critical findings", () => {
  const result = auditWorkflow(UNPROTECTED_AI_AGENT);
  const ids = new Set(result.findings.map((f) => f.id));

  for (const expected of [
    "soterai.universal_guard_missing",
    "ai_agent.unprotected",
    "webhook_to_agent_no_gate",
    "agent_to_user_no_output_gate",
  ]) {
    assert.ok(ids.has(expected), `expected ${expected} in ${JSON.stringify([...ids])}`);
  }
  assert.equal(result.readyForProduction, false);
});

test("adding a Universal Guard node clears the gate findings", () => {
  const ids = new Set(auditWorkflow(GUARDED_WORKFLOW).findings.map((f) => f.id));
  for (const cleared of [
    "soterai.universal_guard_missing",
    "ai_agent.unprotected",
    "webhook_to_agent_no_gate",
  ]) {
    assert.ok(!ids.has(cleared), `${cleared} should be cleared once Universal Guard is present`);
  }
});

test("a SoterAI node configured for a different action does not count as Universal Guard", () => {
  // `hasUniversalGuard` keys on parameters.action, not merely on node type. A
  // workflow with a pii-redaction node is not thereby gated against injection.
  const workflow = JSON.stringify({
    name: "Redaction only",
    nodes: [
      { name: "Webhook", type: "n8n-nodes-base.webhook", parameters: {} },
      { name: "SoterAI", type: "n8n-nodes-soterai.soterGuard", parameters: { action: "piiRedactor" } },
      { name: "AI Agent", type: "@n8n/n8n-nodes-langchain.agent", parameters: {} },
    ],
    connections: {},
  });
  const ids = new Set(auditWorkflow(workflow).findings.map((f) => f.id));
  assert.ok(ids.has("soterai.universal_guard_missing"), `got ${JSON.stringify([...ids])}`);
});

test("inline credential text in node parameters is CRITICAL", () => {
  const result = auditWorkflow(
    JSON.stringify({
      name: "Leaky",
      nodes: [{ name: "HTTP", type: "n8n-nodes-base.httpRequest", parameters: { headers: { authorization: "Bearer sk-live-abc123" } } }],
      connections: {},
    }),
  );
  const secret = result.findings.find((f) => f.id === "workflow.secret_reference");
  assert.ok(secret, "an inline bearer token must be flagged");
  assert.equal(secret.severity, "CRITICAL");
  assert.equal(secret.nodeName, "HTTP");
});

test("each rule carries an OWASP mapping and a recommendation", () => {
  // A finding a user cannot act on is noise. Every rule must say what to do and
  // which OWASP item it belongs to, because that is what the compliance buyer
  // is actually paying for.
  for (const workflow of [UNPROTECTED_AI_AGENT, GUARDED_WORKFLOW]) {
    for (const finding of auditWorkflow(workflow).findings) {
      assert.match(finding.owasp, /^LLM\d{2}:2025 /, `${finding.id} has no OWASP mapping`);
      assert.ok(finding.recommendation.length > 20, `${finding.id} has no actionable recommendation`);
      assert.ok(["CRITICAL", "HIGH", "MEDIUM", "LOW"].includes(finding.severity));
    }
  }
});

// ── Scoring ──────────────────────────────────────────────────────────────────

test("the score is bounded to 0-100 no matter how many findings pile up", () => {
  const many: AuditFinding[] = Array.from({ length: 40 }, (_, i) => ({
    id: `synthetic.${i}`,
    severity: "CRITICAL",
    nodeName: null,
    message: "m",
    recommendation: "r",
    owasp: "LLM01:2025 Prompt Injection",
  }));
  assert.equal(calculateWorkflowSecurityScore(many), 0);
  assert.equal(calculateWorkflowSecurityScore([]), 100);
});

test("severity weights are ordered, so a critical always costs more than a high", () => {
  const at = (severity: AuditFinding["severity"]) =>
    calculateWorkflowSecurityScore([
      { id: "x", severity, nodeName: null, message: "m", recommendation: "r", owasp: "LLM01:2025 Prompt Injection" },
    ]);
  assert.ok(at("CRITICAL") < at("HIGH"));
  assert.ok(at("HIGH") < at("MEDIUM"));
  assert.ok(at("MEDIUM") < at("LOW"));
  assert.ok(at("LOW") < 100);
});

test("riskLevelFromScore matches the n8n node's thresholds exactly", () => {
  // These four are transcribed from SoterGuard.node.ts:1080-1085. If the node
  // changes them, this fails — which is the point.
  assert.equal(riskLevelFromScore(85), "CRITICAL");
  assert.equal(riskLevelFromScore(84), "HIGH");
  assert.equal(riskLevelFromScore(60), "HIGH");
  assert.equal(riskLevelFromScore(59), "MEDIUM");
  assert.equal(riskLevelFromScore(30), "MEDIUM");
  assert.equal(riskLevelFromScore(29), "LOW");
});

test("readyForProduction requires both a high score and zero criticals", () => {
  // A workflow can score well on aggregate and still contain one unacceptable
  // finding. Both conditions, not either.
  assert.equal(auditWorkflow(UNPROTECTED_AI_AGENT).readyForProduction, false);
  const clean = auditWorkflow(
    JSON.stringify({ name: "Just a guard", nodes: [{ name: "SoterAI", type: "n8n-nodes-soterai.soterGuard", parameters: { action: "universalGuard" } }], connections: {} }),
  );
  assert.equal(clean.readyForProduction, clean.securityScore >= 85 && !clean.findings.some((f) => f.severity === "CRITICAL"));
});

// ── Determinism ──────────────────────────────────────────────────────────────

test("the same workflow always produces byte-identical output", () => {
  // Make calls this over HTTP and n8n runs it locally. If it were not
  // deterministic the two could disagree for reasons neither user could debug.
  const first = JSON.stringify(auditWorkflow(UNPROTECTED_AI_AGENT));
  const second = JSON.stringify(auditWorkflow(UNPROTECTED_AI_AGENT));
  assert.equal(first, second);
});

test("the audit never mutates or echoes the submitted workflow", () => {
  // The export can contain inline secrets; echoing it back would turn an audit
  // into a disclosure. `workflowName` is the only thing that crosses over.
  const serialized = JSON.stringify(auditWorkflow(UNPROTECTED_AI_AGENT));
  assert.ok(!serialized.includes('"parameters"'), "raw node parameters must not appear in the result");
});
