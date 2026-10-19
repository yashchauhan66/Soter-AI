import "./phase2/register.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";
import { createClinePlan } from "../adapters/ClineAdapterPolicy";
const credential = "TEST_ONLY_F18_CURRENT_SESSION", old = "TEST_ONLY_F18_OLD_HEADER";
const binding = { url: "http://127.0.0.1:12345/v1/ai/openai-compatible", credential, codePath: "D:/fixture/Code.exe", mcpPath: "D:/fixture/dist/soterai-mcp-server.js", ticketPath: "D:/fixture/storage/adapter-sessions/cline-session.ticket", workspace: "D:/fixture/project", session: "fixture-session" };
function files(headers: unknown) { return { providers: JSON.stringify({ version: 1, modes: {}, providers: { "openai-compatible": { settings: { provider: "openai-compatible", model: "fixture", apiKey: old, headers } } } }), mcp: '{"mcpServers":{}}', globals: '{}', hook: undefined as string | undefined, taskHook: undefined as string | undefined }; }
test("F18 explicit current-session authorization overrides all old case variants and preserves public headers", async () => {
    const current = files({ authorization: "Bearer " + old, AUTHORIZATION: "Bearer " + old, "X-Public-Option": "public" }), plan = createClinePlan(current, binding);
    const result = await plan.apply({ enabled: () => true, fingerprint: () => "owner", read: async key => current[key], write: async (key, value) => { current[key] = value as never; }, confirm: async () => true, backups: { store: async key => key, retrieve: async () => null } });
    assert.equal(result.status, "APPLIED");
    assert.deepEqual(JSON.parse(current.providers).providers["openai-compatible"].settings.headers, { "X-Public-Option": "public", Authorization: "Bearer " + credential });
    assert.ok(!JSON.stringify(plan.preview()).includes(old) && !JSON.stringify(plan.preview()).includes(credential));
});
test("F18 malformed custom header shapes refuse before native configuration review", () => {
    for (const headers of [[], "raw header", 42, { "X-Public": { nested: "invalid" } }, { "X-Public": "public\r\nInjected: yes" }]) assert.throws(() => createClinePlan(files(headers), binding));
});
