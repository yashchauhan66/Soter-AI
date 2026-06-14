import assert from "node:assert/strict";
import test from "node:test";
import { GuardClient } from "../packages/sdk/src/client";
import { secureChatHandler } from "../packages/sdk/src/next";

const allowed = { allowed: true, action: "ALLOW", riskScore: 0, riskTypes: ["LOW_RISK"], reason: "safe", safeText: "safe input", findings: [] };

test("Phase 2 SDK sends authenticated guard requests without exposing the key in the body", async () => {
  let request: { url: string; headers: Headers; body: string } | undefined;
  const client = new GuardClient({ apiKey: "crg_test_secret", baseUrl: "https://guard.example", fetch: async (input, init) => { request = { url: String(input), headers: new Headers(init?.headers), body: String(init?.body) }; return new Response(JSON.stringify(allowed), { status: 200 }); } });
  await client.guardInput({ message: "hello" });
  assert.equal(request?.url, "https://guard.example/api/guard/input");
  assert.equal(request?.headers.get("x-api-key"), "crg_test_secret");
  assert.equal(request?.body.includes("crg_test_secret"), false);
});

test("Phase 2 Next.js helper runs input and output guards around the model call", async () => {
  const responses = [allowed, { ...allowed, safeText: "safe output" }];
  let calls = 0;
  const handler = secureChatHandler({ apiKey: "crg_test_secret", baseUrl: "https://guard.example", fetch: async () => new Response(JSON.stringify(responses[calls++]), { status: 200 }), callLLM: async ({ safeInput }) => `reply to ${safeInput}` });
  const response = await handler(new Request("https://app.example/api/chat", { method: "POST", body: JSON.stringify({ message: "hello" }) }));
  const body = await response.json() as { blocked: boolean; reply: string };
  assert.equal(response.status, 200);
  assert.equal(body.blocked, false);
  assert.equal(body.reply, "safe output");
  assert.equal(calls, 2);
});
