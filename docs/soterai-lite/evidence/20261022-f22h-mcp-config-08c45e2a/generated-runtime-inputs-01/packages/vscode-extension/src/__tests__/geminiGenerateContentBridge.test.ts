import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
const CREDENTIAL = "TEST_ONLY_F20C_INTERNAL_OWNED_BROKER_CREDENTIAL", SESSION = "c9999999-9999-4999-8999-999999999999";
const body = () => readFileSync(join(__dirname, "fixtures/gemini-cli-0.55.1-request-1.json"), "utf8");
const SSE = 'data: {"candidates":[{"content":{"role":"model","parts":[{"text":"PUBLIC_DONE"}]},"finishReason":"STOP"}]}\n\n';
async function fixture(t: TestContext, options: any = {}) {
    const { GeminiGenerateContentBridge } = await import("../adapters/GeminiGenerateContentBridge"); const calls: any[] = [];
    const bridge = new GeminiGenerateContentBridge({ enabled: () => true, ready: async () => true, target: "http://127.0.0.1:31337/v1/ai/gemini/generate-content", credential: CREDENTIAL, session: SESSION,
        fetchImpl: async (url: any, init: any) => { calls.push({ url, init }); return new Response(SSE, { headers: { "content-type": "text/event-stream" } }); }, ...options });
    t.after(() => bridge.dispose()); return { bridge, connection: await bridge.start(), calls };
}
async function post(c: any, value = body(), extra: any = {}, suffix = "/v1beta/models/gemini-3.5-flash:streamGenerateContent?alt=sse") {
    const r = await fetch(c.endpoint + suffix, { method: "POST", headers: { "x-goog-api-key": c.token, "content-type": "application/json", connection: "close", ...extra }, body: value });
    return { status: r.status, text: await r.text() };
}
test("F20C native provider role forwards validated envelope using only private broker credential", async t => {
    const f = await fixture(t), r = await post(f.connection); assert.equal(r.status, 200); assert.equal(r.text, SSE); assert.equal(f.calls.length, 1);
    const call = f.calls[0]; assert.equal(String(call.url), "http://127.0.0.1:31337/v1/ai/gemini/generate-content"); assert.equal(new Headers(call.init.headers).get("authorization"), "Bearer " + CREDENTIAL);
    const forwarded = JSON.parse(call.init.body); assert.equal(forwarded.model, "gemini-3.5-flash"); assert.equal(forwarded.stream, true); delete forwarded.model; delete forwarded.stream; assert.deepEqual(forwarded, JSON.parse(body()));
    assert(!JSON.stringify(call).includes(f.connection.token));
});
test("F20C native provider role rejects forged key, other role, origin, media and malformed body before broker", async t => {
    const f = await fixture(t);
    for (const extra of [{ "x-goog-api-key": "wrong" }, { authorization: "Bearer " + f.connection.token }, { origin: "http://127.0.0.1" }, { "content-type": "text/plain" }, { "content-encoding": "gzip" }]) assert((await post(f.connection, body(), extra)).status >= 400);
    for (const invalid of ['{"contents":[],"contents":[]}', JSON.stringify({ ...JSON.parse(body()), model: "override" }), '{"raw":"' + "P".repeat(131073) + '"}']) assert((await post(f.connection, invalid)).status >= 400);
    assert.equal(f.calls.length, 0);
});
test("F20C provider alternate operation/query/model/path never forwards", async t => {
    const f = await fixture(t);
    for (const suffix of ["/v1beta/models/gemini-3.5-flash:generateContent", "/v1beta/models/gemini-3.5-flash:streamGenerateContent?alt=sse&key=x", "/v1beta/models/../other:streamGenerateContent?alt=sse", "/v1beta/files", "/mcp"])
        assert((await post(f.connection, body(), {}, suffix)).status >= 400);
    assert.equal(f.calls.length, 0);
});
test("F20C provider capability rotation aborts pending broker work and releases no prefix", async t => {
    let reached!: () => void; const entered = new Promise<void>(resolve => reached = resolve); let signal: AbortSignal | undefined;
    const f = await fixture(t, { fetchImpl: async (_url: string, init: RequestInit) => { signal = init.signal as AbortSignal; reached(); return new Promise<Response>(() => {}); } });
    const response = post(f.connection); await entered; f.bridge.rotate(); const r = await response; assert.equal(r.status, 503); assert.equal(signal?.aborted, true); assert(!r.text.includes("PUBLIC_DONE"));
});
test("F20C provider rechecks owner after complete broker output", async t => {
    let current = true; const f = await fixture(t, { ready: async () => current, fetchImpl: async () => { current = false; return new Response(SSE, { headers: { "content-type": "text/event-stream" } }); } });
    const r = await post(f.connection); assert.equal(r.status, 503); assert(!r.text.includes("PUBLIC_DONE"));
});
test("F20C provider target/session validation precedes binding", async () => {
    const { GeminiGenerateContentBridge } = await import("../adapters/GeminiGenerateContentBridge");
    for (const target of ["https://provider.invalid", "http://localhost:31337/v1/ai/gemini/generate-content", "http://127.0.0.1:31337/v1/ai/gemini/generate-content?override=1"]) {
        const bridge = new GeminiGenerateContentBridge({ enabled: () => true, ready: async () => true, target, credential: CREDENTIAL, session: SESSION }); await assert.rejects(bridge.start()); await bridge.dispose();
    }
});

test("F20C explicit broker policy rejection is nonretryable and never relays its body; outage stays unavailable", async t => {
    for (const status of [400, 403, 413, 422, 503]) {
        const f = await fixture(t, { fetchImpl: async () => new Response("SYNTHETIC_PRIVATE_REJECTED_BODY", { status }) });
        const result = await post(f.connection); assert.equal(result.status, status === 503 ? 503 : 400);
        assert(!result.text.includes("SYNTHETIC_PRIVATE_REJECTED_BODY"));
    }
});
