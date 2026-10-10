// Run after build/minification and test:unit. This loads the actual publishable
// files rather than the separate TypeScript test build.
const assert = require("node:assert/strict");
const { Expression } = require("n8n-workflow");
const { SoterApi } = require("../dist/credentials/SoterApi.credentials");
const { executeSoterGuard } = require("../dist/nodes/SoterGuard/shared/execute");
const { makeCtx, cleanInputGuard } = require("../test-build/test/helpers");

async function main() {
  const expression = String(new SoterApi().test.request.baseURL).slice(1);
  function resolve(baseUrl) {
    const data = { $credentials: { baseUrl } };
    Expression.initializeGlobalContext(data);
    return Expression.resolveWithoutWorkflow(expression, data);
  }
  assert.equal(resolve("https://soterai.in"), "https://soterai.in");
  for (const url of ["https://169.254.169.254", "https://[fe80::1]", "https://0xa9fe.0xa9fe"]) {
    let result;
    try { result = resolve(url); } catch { result = null; }
    assert.notEqual(result, url);
  }
  const cases = [
    { action: "inputGuard", params: { inputText: null }, expectedBranch: 1, verify: (result) => assert.equal(result.verdictCode, "INVALID_INPUT") },
    { action: "universalGuard", params: { inputText: "", universalOutputText: "Deploy AKIAIOSFODNN7EXAMPLE", detectionEngine: "LOCAL", protectionProfile: "BALANCED", onThreat: "REDACT" }, expectedBranch: 0, verify: (result) => { assert.match(result.outputText, /REDACTED/); assert.doesNotMatch(result.outputText, /AKIAIOSFODNN7EXAMPLE/); } },
    { action: "toolCall", params: { toolName: "rag.search", toolAction: "search", passportToken: "passport_secret_123456" }, respond: () => ({ body: { decision: "ALLOW" } }), expectedBranch: 0, verify: (result) => { assert.equal(result.passportToken, undefined); assert.ok(result.passportTokenMasked); } },
    { action: "universalGuard", params: { inputText: "Hello", protectionProfile: "MAXIMUM", onThreat: "BLOCK" }, respond: () => ({ body: { ...cleanInputGuard, riskScore: 1 } }), expectedBranch: 0, verify: (result) => assert.equal(result.riskScore, 1) },
  ];
  for (const entry of cases) {
    const { ctx } = makeCtx(entry);
    const outputs = await executeSoterGuard.call(ctx);
    assert.equal(outputs[entry.expectedBranch].length, 1);
    entry.verify(outputs[entry.expectedBranch][0].json);
  }
  console.log("Built-package smoke passed: credential expressions and 4 runtime audit scenarios.");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
