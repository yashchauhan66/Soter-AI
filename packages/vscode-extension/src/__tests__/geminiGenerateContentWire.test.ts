import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BrokerServer } from "../../../../apps/local-ai-broker/src/BrokerServer";
const DATA = "TEST_ONLY_F20C_GEMINI_CLIENT_CREDENTIAL", CONTROL = "TEST_ONLY_F20C_GEMINI_CONTROL_CREDENTIAL", KEY = "TEST_ONLY_F20C_GEMINI_PROVIDER_CREDENTIAL", VALUE = "TEST_ONLY_F20C_REGISTERED_PRIVATE_VALUE";
const ROUTE = "/v1/ai/gemini/generate-content";
const body = (): any => ({ ...JSON.parse(readFileSync(join(__dirname, "fixtures/gemini-cli-0.55.1-request-2.json"), "utf8")), model: "gemini-3.5-flash", stream: true });
const wire = (value = "PUBLIC_GEMINI_DONE") => 'data: ' + JSON.stringify({ candidates: [{ content: { role: "model", parts: [{ text: value }] }, finishReason: "STOP", index: 0 }], usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1, totalTokenCount: 2 } }) + "\n\n";
async function fixture(enabled: boolean, run: (url: string, records: any[], setOutput: (v: string) => void) => Promise<void>) {
    const records: any[] = []; let output = wire();
    const provider = createServer((req, res) => { let bytes = ""; req.on("data", b => bytes += b); req.on("end", () => { records.push({ path: req.url, headers: req.headers, body: JSON.parse(bytes) }); res.setHeader("content-type", "text/event-stream"); res.end(output); }); });
    await new Promise<void>(resolve => provider.listen(0, "127.0.0.1", resolve)); const address = provider.address(); assert(address && typeof address !== "string");
    let broker: BrokerServer | undefined;
    try {
        broker = new BrokerServer({ token: DATA, controlToken: CONTROL, port: 0, providerApiKey: KEY, geminiProviderUrl: "http://127.0.0.1:" + address.port, geminiGenerateContent: enabled, registeredValues: [VALUE], gatewayPolicy: true } as never);
        (broker as any).server.on("request", (req: any, res: any) => res.once("finish", () => req.resume()));
        const { url } = await broker.start(); await run(url, records, value => output = value);
    } finally { await broker?.stop(); await new Promise<void>(resolve => { provider.close(() => resolve()); provider.closeIdleConnections(); }); }
}
async function post(url: string, value = body(), route = ROUTE, auth = DATA) {
    const r = await fetch(url + route, { method: "POST", headers: { authorization: "Bearer " + auth, "content-type": "application/json", connection: "close", "x-goog-api-key": "CALLER_KEY_MUST_NOT_FORWARD", "x-client-ignored": VALUE }, body: JSON.stringify(value) });
    return { status: r.status, text: await r.text(), headers: r.headers };
}
test("F20C Gemini owned capability status is explicit", async () => fixture(true, async url => {
    const r = await fetch(url + "/v1/gateway/status", { headers: { authorization: "Bearer " + CONTROL } }); assert.equal((await r.json() as any).geminiGenerateContent, true);
}));
test("F20C Gemini configured target gets native body and only upstream Google credential", async () => fixture(true, async (url, records) => {
    const r = await post(url); assert.equal(r.status, 200); assert.equal(r.text, wire()); assert.equal(r.headers.get("x-soterai-stream-buffered"), "1"); assert.equal(records.length, 1);
    assert.equal(records[0].path, "/v1beta/models/gemini-3.5-flash:streamGenerateContent?alt=sse");
    assert.equal(records[0].headers["x-goog-api-key"], KEY); assert.equal(records[0].headers.authorization, undefined); assert.equal(records[0].headers["x-client-ignored"], undefined);
    const original = body(); delete original.model; delete original.stream; assert.deepEqual(records[0].body, original);
}));
test("F20C Gemini original and encoded masked-result substitutions send zero collector requests", async () => fixture(true, async (url, records) => {
    for (const value of [VALUE, Buffer.from(VALUE).toString("base64")]) { const b = body(); b.contents[2].parts[0].functionResponse.response.output = value; const r = await post(url, b); assert.equal(r.status, 422); assert.match(r.text, /gateway_sensitive/); }
    assert.equal(records.length, 0);
}));
test("F20C Gemini registered output is completely withheld", async () => fixture(true, async (url, records, setOutput) => {
    setOutput(wire(VALUE)); const r = await post(url); assert.equal(r.status, 422); assert.equal(records.length, 1); assert(!r.text.includes(VALUE)); assert.match(r.text, /gateway_output_withheld/);
}));
test("F20C Gemini invalid model, query, state and native alternate endpoints never forward", async () => fixture(true, async (url, records) => {
    for (const route of [ROUTE + "?raw=1", ROUTE + "/other", "/v1/ai/gemini/models"]) assert((await post(url, body(), route)).status >= 400);
    for (const model of ["../raw", "model?key=override", "", "https://provider.invalid"]) assert((await post(url, { ...body(), model })).status >= 400);
    assert((await post(url, { ...body(), cachedContent: "PUBLIC" })).status >= 400); assert.equal((await post(url, body(), ROUTE, "wrong")).status, 401); assert.equal(records.length, 0);
}));
test("F20C Gemini disabled capability never forwards", async () => fixture(false, async (url, records) => { assert((await post(url)).status >= 400); assert.equal(records.length, 0); }));
test("F20C Gemini rejects unsafe or ambiguous upstream base before binding", () => {
    for (const geminiProviderUrl of ["http://example.invalid", "http://127.0.0.1:31337/path", "http://127.0.0.1:31337/?key=override", "http://name:private@127.0.0.1:31337", "https://provider.invalid/#state"])
        assert.throws(() => new BrokerServer({ token: DATA, port: 0, geminiGenerateContent: true, geminiProviderUrl } as never));
});
