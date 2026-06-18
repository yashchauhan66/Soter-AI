import assert from "node:assert/strict";
import test from "node:test";
import { GuardClient } from "../../packages/sdk/src/client";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const allowDecision = {
  decision: "ALLOW",
  riskLevel: "LOW",
  reason: "allowed",
  redactions: [],
  policyMatches: [],
};

test("OpenClaw mock agent checks every tool call before execution", async () => {
  const calls: string[] = [];
  const client = new GuardClient({
    apiKey: "ck_test_secret123456789012345",
    baseUrl: "https://guard.example",
    fetch: async (input) => {
      calls.push(String(input));
      return json(allowDecision);
    },
  });
  const adapter = client.createOpenClawAdapter({ sessionId: "agent_sess_1" });
  const decision = await adapter.beforeToolCall({ tool: "browser.click", action: "click", target: "#submit" });
  assert.equal(decision.decision, "ALLOW");
  assert.equal(calls[0].endsWith("/api/agent/action/check"), true);
});

test("Browser agent mock does not execute blocked submit", async () => {
  let executed = false;
  const client = new GuardClient({
    apiKey: "ck_test_secret123456789012345",
    baseUrl: "https://guard.example",
    fetch: async () => json({ ...allowDecision, decision: "BLOCK", riskLevel: "CRITICAL", reason: "blocked" }),
  });
  const submit = client.wrapTool({ tool: "browser.submit_form", action: "submit_form", destination: "external" }, async () => {
    executed = true;
    return "submitted";
  });
  const result = await submit({ form: "data" });
  assert.equal(result.executed, false);
  assert.equal(executed, false);
});

test("MCP tool mock executes only after allow decision", async () => {
  let executed = false;
  const client = new GuardClient({
    apiKey: "ck_test_secret123456789012345",
    baseUrl: "https://guard.example",
    fetch: async () => json(allowDecision),
  });
  const tool = client.wrapMcpTool("notes.write", async () => {
    executed = true;
    return "ok";
  });
  const result = await tool({ content: "safe" });
  assert.equal(result.executed, true);
  assert.equal(executed, true);
});

test("LangChain tool mock pauses when approval is required", async () => {
  const client = new GuardClient({
    apiKey: "ck_test_secret123456789012345",
    baseUrl: "https://guard.example",
    fetch: async () => json({ ...allowDecision, decision: "ASK_APPROVAL", riskLevel: "HIGH", requiredApproval: { message: "approve", approvalToken: "af_x" } }),
  });
  const tool = client.createLangChainToolWrapper("email", async () => "sent");
  const result = await tool({ body: "hello" });
  assert.equal(result.executed, false);
  assert.equal(result.decision.decision, "ASK_APPROVAL");
});

test("Generic chatbot mock uses input guard, action guard, data guard, and output guard order", async () => {
  const paths: string[] = [];
  const client = new GuardClient({
    apiKey: "ck_test_secret123456789012345",
    baseUrl: "https://guard.example",
    fetch: async (input) => {
      paths.push(new URL(String(input)).pathname);
      if (String(input).includes("/api/guard/")) return json({ allowed: true, action: "ALLOW", riskScore: 0, riskTypes: ["LOW_RISK"], reason: "safe", safeText: "safe", findings: [] });
      return json(allowDecision);
    },
  });
  await client.input("hello");
  await client.checkAgentAction({ tool: "api.call", action: "get_status" });
  await client.checkDataLeak({ content: "safe", destination: "internal" });
  await client.checkAgentOutput({ content: "safe" });
  assert.deepEqual(paths, ["/api/guard/input", "/api/agent/action/check", "/api/agent/data/check", "/api/agent/output/check"]);
});
