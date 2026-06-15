import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { withCyberRakshakLangChain } from "../packages/langchain-middleware/src";
import { createCyberRakshakQueryWrapper } from "../packages/llamaindex-middleware/src";
import { cyberRakshakVercelAiMiddleware } from "../packages/vercel-ai-sdk-middleware/src";

const allowGuard = {
  async guardInput({ message }: { message: string }) {
    return { action: "ALLOW", safeText: message };
  },
  async guardOutput({ aiResponse }: { aiResponse: string }) {
    return { action: "ALLOW", safeText: aiResponse };
  },
};

const blockGuard = {
  async guardInput() {
    return { action: "BLOCK", reason: "blocked input" };
  },
  async guardOutput() {
    return { action: "BLOCK", reason: "blocked output" };
  },
};

const redactGuard = {
  async guardInput({ message }: { message: string }) {
    return { action: "REDACT", redactedText: message.replace(/secret/g, "[REDACTED]") };
  },
  async guardOutput({ aiResponse }: { aiResponse: string }) {
    return { action: "REDACT", redactedText: aiResponse.replace(/secret/g, "[REDACTED]") };
  },
};

test("LangChain middleware passes ALLOW input/output through unchanged", async () => {
  const chain = { async invoke(input: { input: string }) { return { output: `echo: ${input.input}` }; } };
  const wrapped = withCyberRakshakLangChain(chain, allowGuard);
  const result = await wrapped.invoke({ input: "hello" });
  assert.equal(result.output, "echo: hello");
});

test("LangChain middleware throws on BLOCK input decision", async () => {
  const chain = { async invoke() { return { output: "should-not-run" }; } };
  const wrapped = withCyberRakshakLangChain(chain, blockGuard);
  await assert.rejects(() => wrapped.invoke({ input: "anything" }), /blocked input/);
});

test("LangChain middleware applies REDACT to chain input", async () => {
  let capturedInput: string | null = null;
  const chain = {
    async invoke(input: { input: string }) {
      capturedInput = input.input;
      return { output: "ok" };
    },
  };
  const wrapped = withCyberRakshakLangChain(chain, redactGuard);
  await wrapped.invoke({ input: "tell me secret" });
  assert.equal(capturedInput, "tell me [REDACTED]");
});

test("LlamaIndex wrapper blocks query when guard returns BLOCK", async () => {
  const queryEngine = { async query() { return { answer: "should-not-run" }; } };
  const wrapped = createCyberRakshakQueryWrapper(queryEngine, blockGuard);
  await assert.rejects(() => wrapped.query({ query: "anything" }), /blocked input/);
});

test("LlamaIndex wrapper passes through ALLOW", async () => {
  let capturedQuery: string | null = null;
  const queryEngine = {
    async query(input: { query: string }) {
      capturedQuery = input.query;
      return { answer: "ok" };
    },
  };
  const wrapped = createCyberRakshakQueryWrapper(queryEngine, allowGuard);
  const result = await wrapped.query({ query: "hello" });
  assert.deepEqual(result, { answer: "ok" });
  assert.equal(capturedQuery, "hello");
});

test("Vercel AI SDK middleware blocks prompt when guard returns BLOCK", async () => {
  const middleware = cyberRakshakVercelAiMiddleware(blockGuard);
  await assert.rejects(() => middleware.preparePrompt("anything"), /blocked input/);
});

test("Vercel AI SDK middleware blocks final text when guard returns BLOCK", async () => {
  const middleware = cyberRakshakVercelAiMiddleware(blockGuard);
  await assert.rejects(() => middleware.finalizeText("anything"), /blocked output/);
});

test("Vercel AI SDK middleware redacts on REDACT decision", async () => {
  const middleware = cyberRakshakVercelAiMiddleware(redactGuard);
  assert.equal(await middleware.preparePrompt("share secret"), "share [REDACTED]");
  assert.equal(await middleware.finalizeText("the secret is X"), "the [REDACTED] is X");
});

test("Integration packages and WordPress plugin remain Preview and do not leak API keys to clients", () => {
  for (const pkg of [
    "packages/langchain-middleware/package.json",
    "packages/llamaindex-middleware/package.json",
    "packages/vercel-ai-sdk-middleware/package.json",
  ]) {
    const content = JSON.parse(readFileSync(pkg, "utf8"));
    assert.equal(content.private, true, `${pkg} must remain private (Preview, unpublished)`);
    assert.match(content.version, /^0\./, `${pkg} preview version must remain 0.x`);
  }
  assert.equal(existsSync("integrations/wordpress-plugin/cyberrakshak-guard.php"), true);
  const adminJs = readFileSync("integrations/wordpress-plugin/assets/admin.js", "utf8");
  assert.equal(/api[_-]?key\s*[:=]\s*["'`][^"'`]+/i.test(adminJs), false, "client JS must not embed an API key");
});
