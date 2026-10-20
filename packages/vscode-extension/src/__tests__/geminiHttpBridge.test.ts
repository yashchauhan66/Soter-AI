import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
const NAME = "soterai_read_project_file_safely";
async function fixture(t: TestContext, options: any = {}) {
    const { GeminiHttpBridge } = await import("../adapters/GeminiHttpBridge"); let calls = 0;
    const bridge = new GeminiHttpBridge({ enabled: () => true, ready: async () => true, read: async (file: string, recipient: string) => {
        calls++; assert.equal(file, ".env"); assert.match(recipient, /Gemini.*identity unverified/);
        return { status: "ALLOWED_ONCE", kind: "environment-schema", text: "TEST_KEY=[MASKED]" };
    }, ...options }); t.after(() => bridge.dispose()); return { bridge, connection: await bridge.start(), calls: () => calls };
}
async function rpc(c: any, method = "tools/list", params: any = {}, extra: any = {}) {
    const response = await fetch(c.endpoint, { method: "POST", headers: { authorization: "Bearer " + c.token, "content-type": "application/json", connection: "close", ...extra }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
    const text = await response.text(); return { status: response.status, text, body: text ? JSON.parse(text) : undefined };
}
test("F20C native MCP initialization, discovery, UUID progress and masked path-only release", async t => {
    const f = await fixture(t), c = f.connection; assert.match(c.endpoint, /^http:\/\/127\.0\.0\.1:\d+\/gemini\/mcp$/);
    const initialized = await rpc(c, "initialize", { protocolVersion: "2025-06-18", capabilities: { roots: { listChanged: true } }, clientInfo: { name: "gemini-cli-mcp-client", version: "0.55.1" } });
    assert.equal(initialized.body.result.protocolVersion, "2025-06-18"); assert.equal((await rpc(c)).body.result.tools.length, 1);
    const result = await rpc(c, "tools/call", { name: NAME, arguments: { path: ".env" }, _meta: { progressToken: "e0a2562c-412d-4007-8083-083a1dbc82e6" } });
    assert.equal(JSON.parse(result.body.result.content[0].text).text, "TEST_KEY=[MASKED]"); assert.equal(f.calls(), 1);
});
test("F20C authenticated stateless optional GET returns405 without dropping MCP or invoking reader", async t => {
    const f = await fixture(t), response = await fetch(f.connection.endpoint, { headers: { authorization: "Bearer " + f.connection.token, accept: "text/event-stream", connection: "close" } });
    assert.equal(response.status, 405); assert.equal(await response.text(), ""); assert.equal((await rpc(f.connection)).status, 200); assert.equal(f.calls(), 0);
});
test("F20C MCP forged authority, native metadata carriers and path traversal never reach F04", async t => {
    const f = await fixture(t);
    for (const args of [{ path: "../.env" }, { path: ".env", approved: true }, { path: "C:/outside" }]) assert((await rpc(f.connection, "tools/call", { name: NAME, arguments: args })).body.error);
    for (const _meta of [{ approved: true }, { progressToken: "x".repeat(1025) }, { progressToken: {} }, { "x-codex-turn-metadata": {} }])
        assert((await rpc(f.connection, "tools/call", { name: NAME, arguments: { path: ".env" }, _meta })).body.error);
    assert.equal(f.calls(), 0);
});
test("F20C MCP wrong capability, browser origin, media and alternate role fail before reader", async t => {
    const f = await fixture(t);
    for (const extra of [{ authorization: "Bearer wrong" }, { origin: "http://127.0.0.1" }, { "content-type": "text/plain" }, { "content-encoding": "gzip" }])
        assert((await rpc(f.connection, "tools/call", { name: NAME, arguments: { path: ".env" } }, extra)).status >= 400);
    assert.equal(f.calls(), 0);
});
test("F20C MCP pending authorizer is cancelled by rotation and cannot return late content", async t => {
    let reached!: () => void; const entered = new Promise<void>(resolve => reached = resolve); let signal: AbortSignal | undefined;
    const f = await fixture(t, { read: async (_file: string, _recipient: string, pending: AbortSignal) => { signal = pending; reached(); return new Promise(() => {}); } });
    const response = rpc(f.connection, "tools/call", { name: NAME, arguments: { path: ".env" } }); await entered; f.bridge.rotate();
    const r = await response; assert.equal(r.status, 503); assert.equal(signal?.aborted, true); assert(!r.text.includes("MASKED"));
});
test("F20C MCP rechecks owner after a completed safe-read result", async t => {
    let current = true; const f = await fixture(t, { ready: async () => current, read: async () => { current = false; return { status: "ALLOWED_ONCE", kind: "redacted-file", text: "PUBLIC_BUT_LATE" }; } });
    assert(!(await rpc(f.connection, "tools/call", { name: NAME, arguments: { path: ".env" } })).text.includes("PUBLIC_BUT_LATE"));
});
