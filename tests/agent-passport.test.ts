import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";
import {
  createAgentIdentityId,
  createPassportId,
  hashPassportToken,
  mergePassportPolicy,
  normalizePassportPolicy,
  scorePassportRisk,
  toPublicPassport,
  validateAgentPassport,
  type AgentIdentitySnapshot,
  type AgentSessionPassportSnapshot,
} from "../lib/agent-passport";

process.env.API_KEY_PEPPER = process.env.API_KEY_PEPPER ?? "cybersecurityguard-test-pepper-value-1234567890";

const token = "ap_test_passport_token_1234567890";
const agent: AgentIdentitySnapshot = {
  id: "agent_identity_1",
  projectId: "project_a",
  name: "support-agent",
  agentType: "RAG_AGENT",
  status: "ACTIVE",
};

function passport(overrides: Partial<AgentSessionPassportSnapshot> = {}): AgentSessionPassportSnapshot {
  return {
    id: "agent_passport_1",
    projectId: "project_a",
    agentIdentityId: agent.id,
    sessionId: "agent_sess_1",
    passportHash: hashPassportToken(token),
    status: "ACTIVE",
    allowedTools: ["browser.read", "rag.search"],
    blockedTools: ["terminal.run", "filesystem.delete"],
    approvalRequiredTools: ["gmail.send", "browser.submit_form"],
    allowedDomains: ["example.com"],
    blockedDomains: ["blocked.example"],
    dataScopes: ["project:read"],
    memoryScopes: ["session"],
    riskScore: 25,
    riskLevel: "LOW",
    expiresAt: new Date(Date.now() + 60_000),
    ...overrides,
  };
}

test("Agent Passport 1: create identity id and default policy shape", () => {
  assert.match(createAgentIdentityId(), /^agent_identity_/);
  const policy = normalizePassportPolicy({
    allowedTools: ["RAG.Search", "rag.search"],
    blockedTools: ["terminal.run"],
  });
  assert.deepEqual(policy.allowedTools, ["rag.search"]);
  assert.ok(policy.blockedTools.includes("terminal.run"));
});

test("Agent Passport 2: issue policy for active agent produces bounded risk", () => {
  assert.match(createPassportId(), /^agent_passport_/);
  const policy = mergePassportPolicy(agent.defaultPolicyJson, {
    allowedTools: ["browser.read"],
    approvalRequiredTools: ["gmail.send"],
    blockedTools: ["terminal.run"],
  });
  const risk = scorePassportRisk(policy);
  assert.ok(risk.riskScore >= 0 && risk.riskScore <= 100);
  assert.ok(["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(risk.riskLevel));
});

test("Agent Passport 3: validate valid passport allows allowed tool", () => {
  const result = validateAgentPassport({
    agent,
    passport: passport(),
    passportToken: token,
    tool: "browser.read",
    action: "read_page",
    target: "https://example.com/docs",
  });
  assert.equal(result.decision, "ALLOW");
});

test("Agent Passport 4: expired passport blocks", () => {
  const result = validateAgentPassport({
    agent,
    passport: passport({ expiresAt: new Date(Date.now() - 1000) }),
    passportToken: token,
    tool: "browser.read",
  });
  assert.equal(result.decision, "BLOCK");
  assert.match(result.reason, /expired/i);
});

test("Agent Passport 5: revoked passport blocks", () => {
  const result = validateAgentPassport({
    agent,
    passport: passport({ status: "REVOKED" }),
    passportToken: token,
    tool: "browser.read",
  });
  assert.equal(result.decision, "BLOCK");
  assert.match(result.reason, /revoked/i);
});

test("Agent Passport 6: disabled agent blocks", () => {
  const result = validateAgentPassport({
    agent: { ...agent, status: "DISABLED" },
    passport: passport(),
    passportToken: token,
    tool: "browser.read",
  });
  assert.equal(result.decision, "BLOCK");
  assert.match(result.reason, /disabled/i);
});

test("Agent Passport 7: blocked tool blocks", () => {
  const result = validateAgentPassport({
    agent,
    passport: passport(),
    passportToken: token,
    tool: "terminal.run",
    action: "run_command",
  });
  assert.equal(result.decision, "BLOCK");
  assert.match(result.reason, /blocked/i);
});

test("Agent Passport 8: approval-required tool asks approval", () => {
  const result = validateAgentPassport({
    agent,
    passport: passport(),
    passportToken: token,
    tool: "gmail.send",
    action: "send_email",
    target: "client@example.com",
  });
  assert.equal(result.decision, "ASK_APPROVAL");
});

test("Agent Passport 9: cross-project passport lookup is project scoped", () => {
  const serverSource = readFileSync("lib/agent-passport/server.ts", "utf8");
  assert.match(serverSource, /WHERE p\."projectId" = \$\{projectId\} AND p\."sessionId" = \$\{sessionId\}/);
  assert.match(serverSource, /WHERE "id" = \$\{input\.agentIdentityId\} AND "projectId" = \$\{auth\.project\.id\}/);
});

test("Agent Passport 10: dashboard and API routes exist", () => {
  assert.equal(existsSync("app/dashboard/agent-passports/page.tsx"), true);
  assert.equal(existsSync("app/api/agent/identity/create/route.ts"), true);
  assert.equal(existsSync("app/api/agent/passport/issue/route.ts"), true);
  assert.equal(existsSync("app/api/agent/passport/validate/route.ts"), true);
  assert.equal(existsSync("app/api/agent/passport/revoke/route.ts"), true);
  assert.equal(existsSync("app/api/agent/passport/[sessionId]/route.ts"), true);
  assert.equal(existsSync("app/api/agent/identities/route.ts"), true);
});

test("Agent Passport 11: raw passport token is not the stored hash or public output", () => {
  const hash = hashPassportToken(token);
  assert.notEqual(hash, token);
  assert.equal(hash.includes(token), false);
  const publicPassport = toPublicPassport({ id: "p1", passportHash: hash, sessionId: "s1" });
  assert.equal("passportHash" in publicPassport, false);
});

test("Agent Passport 12: existing guard API route files remain present", () => {
  assert.equal(existsSync("app/api/guard/input/route.ts"), true);
  assert.equal(existsSync("app/api/guard/output/route.ts"), true);
  assert.equal(existsSync("app/api/guard/analyze/route.ts"), true);
});
