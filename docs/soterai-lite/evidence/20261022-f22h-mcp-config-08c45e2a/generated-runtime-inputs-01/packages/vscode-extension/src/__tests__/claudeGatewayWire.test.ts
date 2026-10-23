import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createServer, type Server } from "node:http";
import { BrokerServer } from "../../../../apps/local-ai-broker/src/BrokerServer";
const DATA = "TEST_ONLY_F19_DATA_CLIENT_CREDENTIAL", CONTROL = "TEST_ONLY_F19_OWNER_CONTROL_CREDENTIAL", KEY = "TEST_ONLY_F19_UPSTREAM_CREDENTIAL", VALUE = "TEST_ONLY_F19_REGISTERED_GATEWAY_VALUE";
const protocol = JSON.parse(readFileSync(join(__dirname, "fixtures/claude-protocol-2.1.301-01.json"), "utf8"));
const SDK = "/v1/ai/anthropic-compatible/v1/messages", LEGACY = "/v1/ai/anthropic-compatible/messages";
const body = () => ({ model: "fixture", messages: [{ role: "user", content: "Public synthetic request" }], thinking: { type: "disabled" }, output_config: { effort: "high" }, tools: [] });
async function close(server: Server) { await new Promise<void>(done => { server.close(() => done()); server.closeIdleConnections(); }); }
async function fixture(enabled: boolean, run: (url: string, wires: Array<{ path: string; body: unknown; headers: Record<string, unknown> }>) => Promise<void>) {
    const wires: Array<{ path: string; body: unknown; headers: Record<string, unknown> }> = [];
    const provider = createServer((req, res) => { let data = ""; req.on("data", chunk => { data += chunk; }); req.on("end", () => { wires.push({ path: req.url!, body: JSON.parse(data), headers: { ...req.headers } }); res.setHeader("content-type", "application/json"); res.end(JSON.stringify({ content: [{ type: "text", text: "Public synthetic output" }] })); }); });
    await new Promise<void>(done => provider.listen(0, "127.0.0.1", done)); const address = provider.address(); assert.ok(address && typeof address !== "string");
    const broker = new BrokerServer({ token: DATA, controlToken: CONTROL, port: 0, providerApiKey: KEY, anthropicProviderUrl: "http://127.0.0.1:" + address.port + "/v1/messages", registeredValues: [VALUE], gatewayPolicy: true, claudeToolSchemas: enabled } as never);
    const { url } = await broker.start(); try { await run(url, wires); } finally { await broker.stop(); await close(provider); }
}
async function post(url: string, route: string, value: unknown = body()) { const response = await fetch(url + route, { method: "POST", headers: { authorization: "Bearer " + DATA, "content-type": "application/json", "anthropic-version": "2023-06-01", "x-ignored-client": VALUE, "anthropic-beta": VALUE }, body: JSON.stringify(value) }); return { status: response.status, body: await response.json() }; }
test("F19 owned broker acknowledges its exact declared Claude capability", async () => fixture(true, async url => {
    const response = await fetch(url + "/v1/gateway/status", { headers: { authorization: "Bearer " + CONTROL } }); assert.equal((await response.json() as any).claudeToolSchemas, true);
}));
test("F19 exact native SDK alias and beta marker forward only current controlled provider auth/body", async () => fixture(true, async (url, wires) => {
    assert.equal((await post(url, SDK + "?beta=true")).status, 200); assert.equal(wires.length, 1); assert.deepEqual(wires[0].body, body()); assert.equal(wires[0].path, "/v1/messages");
    assert.equal(wires[0].headers["anthropic-beta"], protocol.beta); assert.equal(wires[0].headers["x-api-key"], KEY); assert.equal(wires[0].headers.authorization, undefined); assert.equal(wires[0].headers["x-ignored-client"], undefined); assert.ok(!JSON.stringify(wires).includes(DATA));
    assert.equal((await post(url, LEGACY)).status, 200);
}));
test("F19 native protected input and encoded schema metadata send zero provider bytes", async () => fixture(true, async (url, wires) => {
    for (const value of [VALUE, Buffer.from(VALUE).toString("base64")]) {
        const request = { ...body(), tools: [{ name: "Read", description: value, input_schema: {} }] };
        const response = await post(url, SDK + "?beta=true", request); assert.equal(response.status, 422); assert.equal((response.body as any).error.code, "gateway_sensitive");
    } assert.equal(wires.length, 0);
}));
test("F19 unknown/duplicate beta parameters and unknown native routes never forward", async () => fixture(true, async (url, wires) => {
    for (const route of [SDK + "?beta=false", SDK + "?beta=true&beta=true", SDK + "?beta=true&raw=1", SDK + "?%62eta=true", SDK + "/other?beta=true"]) assert.ok((await post(url, route)).status >= 400);
    assert.equal(wires.length, 0);
}));
test("F19 flagoff preserves original alias/query/unknown-control refusal", async () => fixture(false, async (url, wires) => {
    assert.ok((await post(url, SDK + "?beta=true")).status >= 400); assert.ok((await post(url, LEGACY + "?beta=true")).status >= 400); assert.ok((await post(url, LEGACY)).status >= 400); assert.equal(wires.length, 0);
}));
