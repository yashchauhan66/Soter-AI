import assert from "node:assert/strict";
import test from "node:test";
import { NodeApiError } from "n8n-workflow";
import { redactKnownCredentials } from "../shared/credentialRedaction";
import { cleanInputGuard, run } from "./helpers";

const keys = ["qa_unknown_prefix_123456789", "qa.$+[key](special)?^\\12345"];
for (const apiKey of keys) {
  for (const action of ["inputGuard", "outputGuard", "analyzeText", "piiRedactor", "ragScanner", "universalGuard", "toolCall"]) {
    test(`${action}: known credential is removed from successful upstream fields and rawResponse`, async () => {
      const result = await run({ action, credentials: { apiKey, baseUrl: "https://guard.example" }, params: {
        detectionEngine: "CLOUD", inputText: "Hello", outputText: "Hello", piiText: "Hello", ragText: "Hello", documentId: "qa_doc",
        toolName: "rag.search", toolAction: "search", protectionProfile: "BALANCED", advancedOptions: { includeRawResponse: true },
      }, respond: () => ({ body: { ...cleanInputGuard, decision: "ALLOW", reason: `Accepted credential ${apiKey}`, nested: { note: apiKey } } }) });
      assert.equal(result.outputs.flat().length, 1);
      assert.equal(JSON.stringify(result.outputs).includes(apiKey), false);
    });
  }
  for (const continueOnFail of [false, true]) {
    test(`HTTP 401: arbitrary credential is scrubbed with continueOnFail=${continueOnFail}`, async () => {
      const options = { action: "inputGuard", credentials: { apiKey: ` ${apiKey} `, baseUrl: "https://guard.example" },
        params: { inputText: "Hello", detectionEngine: "CLOUD" }, continueOnFail,
        respond: () => ({ statusCode: 401, body: { message: `Denied credential ${apiKey}`, description: apiKey } }),
      };
      if (continueOnFail) {
        const result = await run(options);
        assert.equal(result.flagged.length, 1);
        assert.equal(JSON.stringify(result.outputs).includes(apiKey), false);
        assert.match(String(result.flagged[0].json.message), /401/);
      } else {
        await assert.rejects(() => run(options), (error: unknown) => {
          const e = error as Error;
          assert.equal(e.message.includes(apiKey), false);
          assert.equal(JSON.stringify(e).includes(apiKey), false);
          assert.match(e.message, /401/);
          return true;
        });
      }
    });
  }
  test("AUTO fallback cannot reflect the credential through the degradation reason", async () => {
    const result = await run({ action: "inputGuard", credentials: { apiKey, baseUrl: "https://guard.example" }, params: { inputText: "Hello", detectionEngine: "AUTO" },
      respond: () => ({ statusCode: 503, body: { message: `Unavailable for ${apiKey}` } }) });
    assert.equal(result.safe[0].json.engineDegraded, true);
    assert.equal(JSON.stringify(result.outputs).includes(apiKey), false);
  });
}

test("Redaction preserves error classes, causes, literal metacharacters, and cyclic structures", () => {
  const apiKey = keys[1];
  const error = new NodeApiError({ id: "qa-error", name: "QA", type: "qa", typeVersion: 3, position: [0, 0], parameters: {} }, { message: apiKey });
  const safe = redactKnownCredentials(error, [apiKey]);
  assert.ok(safe instanceof NodeApiError);
  assert.equal(safe.message.includes(apiKey), false);
  assert.equal(JSON.stringify(safe).includes(apiKey), false);
  const value: Record<string, unknown> = { note: apiKey }; value.self = value;
  const result = redactKnownCredentials(value, [apiKey]);
  assert.equal(result.note, "[REDACTED_CREDENTIAL]");
  assert.equal(result.self, result);
  assert.equal(value.note, apiKey, "do not mutate upstream objects");
});

test("Concurrent executions keep credentials separate and preserve unrelated issued tokens", async () => {
  const [first, second] = await Promise.all(keys.map((apiKey, index) => run({ action: "inputGuard", credentials: { apiKey, baseUrl: "https://guard.example" },
    params: { inputText: "Hello", detectionEngine: "CLOUD" }, respond: () => ({ body: { ...cleanInputGuard, reason: `Own ${apiKey}; unrelated ${keys[1 - index]}` } }) })));
  assert.equal(String(first.safe[0].json.reason).includes(keys[0]), false);
  assert.equal(String(first.safe[0].json.reason).includes(keys[1]), true);
  assert.equal(String(second.safe[0].json.reason).includes(keys[1]), false);
  assert.equal(String(second.safe[0].json.reason).includes(keys[0]), true);
  const result = await run({ action: "issuePassport", credentials: { apiKey: keys[0], baseUrl: "https://guard.example" }, params: { agentIdentityId: "qa_agent", sessionId: "qa_session", detectionEngine: "CLOUD" },
    respond: () => ({ body: { passportId: "qa_pass", passportToken: "qa_newly_issued_token_123456", sessionId: "qa_session", expiresAt: "2026-10-11T00:00:00Z" } }) });
  assert.equal(result.safe[0].json.passportToken, "qa_newly_issued_token_123456");
});
