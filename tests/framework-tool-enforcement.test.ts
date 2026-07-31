import assert from "node:assert/strict";
import test from "node:test";
import { withSoterLangChainTool } from "../packages/langchain-middleware/src/index";
import { soterVercelTool } from "../packages/vercel-ai-sdk-middleware/src/index";

test("LangChain wrapper prevents blocked and approval-required calls from executing", async () => {
  for (const blockedDecision of ["BLOCK", "ASK_APPROVAL"] as const) {
    let calls = 0;
    const wrapped = withSoterLangChainTool("email.send", async () => {
      calls += 1;
      return "sent";
    }, {
      checkAgentAction: async () => ({ decision: blockedDecision }),
    }, { sessionId: "session-1", destination: "external" });
    const result = await wrapped({ to: "user@example.test" });
    assert.equal(result.executed, false);
    assert.equal(calls, 0);
  }
});

test("LangChain wrapper sends only redacted string content to the executor", async () => {
  let received = "";
  const wrapped = withSoterLangChainTool("message", async (value: string) => {
    received = value;
    return "ok";
  }, {
    checkAgentAction: async () => ({ decision: "REDACT", safeContent: "token=[REDACTED]" }),
  });
  const result = await wrapped("token=secret");
  assert.equal(result.executed, true);
  assert.equal(received, "token=[REDACTED]");
});

test("Vercel AI tool wrapper checks before execution and fail-safe decisions pause", async () => {
  let calls = 0;
  const tool = soterVercelTool("payment.charge", async () => {
    calls += 1;
    return "charged";
  }, {
    checkAgentAction: async (input) => {
      assert.equal(input.tool, "vercel-ai.payment.charge");
      return { decision: "SANDBOX_ONLY" };
    },
  }, { sessionId: "session-2", destination: "external" });
  const result = await tool.execute({ amount: 100 });
  assert.equal(result.executed, false);
  assert.equal(calls, 0);
});

test("Vercel AI tool wrapper executes an explicitly allowed call once", async () => {
  let calls = 0;
  const tool = soterVercelTool("read.status", async () => {
    calls += 1;
    return "ok";
  }, { checkAgentAction: async () => ({ decision: "ALLOW" }) });
  const result = await tool.execute({});
  assert.equal(result.executed, true);
  assert.equal(calls, 1);
});
