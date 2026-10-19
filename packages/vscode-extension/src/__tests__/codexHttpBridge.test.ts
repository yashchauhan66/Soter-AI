import assert from "node:assert/strict";
import { test } from "node:test";
import { request } from "node:http";
const load = () => import("../adapters/CodexHttpBridge");
const base = () => ({ enabled: () => true, ready: async (_signal: AbortSignal) => true,
    read: async (_file: string, _recipient: string, _signal: AbortSignal) => ({ status: "DENIED" as const }) });
async function wire(c: { endpoint: string; token: string }, method = "tools/list", params: unknown = {}, options: { raw?: string; token?: string; origin?: string; suffix?: string; media?: string; http?: string } = {}): Promise<any> {
    return new Promise((resolve, reject) => {
        const req = request(c.endpoint + (options.suffix ?? ""), { method: options.http ?? "POST", agent: false,
            headers: { authorization: "Bearer " + (options.token ?? c.token), "content-type": options.media ?? "application/json", ...(options.origin ? { origin: options.origin } : {}) } }, res => {
            let text = ""; res.setEncoding("utf8"); res.on("data", s => text += s); res.on("error", reject); res.on("end", () => resolve({ code: res.statusCode, text, body: text ? JSON.parse(text) : undefined }));
        }); req.on("error", reject); req.end(options.http === "GET" ? undefined : options.raw ?? JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }));
    });
}
test("F20A-B01 real loopback initialization/discovery and masked path-only read", async t => {
    const { CodexHttpBridge } = await load(); let calls = 0;
    const b = new CodexHttpBridge({ ...base(), read: async (file, recipient) => { calls++; assert.equal(file, ".env"); assert.match(recipient, /identity unverified/);
        return { status: "ALLOWED_ONCE", kind: "environment-schema", text: "KEY=[MASKED]" }; } }); t.after(() => b.dispose()); const c = await b.start();
    assert.match(c.endpoint, /^http:\/\/127\.0\.0\.1:\d+\/codex\/mcp$/); assert.match(c.token, /^[a-f0-9]{64}$/);
    const init = await wire(c, "initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "codex-fixture", version: "0.160.1" } });
    assert.equal(init.body.result.protocolVersion, "2025-06-18");
    const listed = await wire(c, "tools/list", { _meta: { progressToken: 1 } }); assert.equal(listed.body.result.tools.length, 1);
    const result = await wire(c, "tools/call", { name: listed.body.result.tools[0].name, arguments: { path: ".env" },
        _meta: { callId: "synthetic", "x-codex-turn-metadata": { codex_version: "0.160.1" }, threadId: "t", sessionId: "s", windowId: "w", itemId: "i", progressToken: 2 } });
    assert.equal(JSON.parse(result.body.result.content[0].text).text, "KEY=[MASKED]"); assert.equal(calls, 1);
});
test("F20A-B02 auth, aliases, origin, media and nonPOST refuse before reader", async t => {
    const { CodexHttpBridge } = await load(); let calls = 0; const b = new CodexHttpBridge({ ...base(), read: async () => { calls++; return { status: "DENIED" }; } }); t.after(() => b.dispose()); const c = await b.start();
    for (const options of [{ token: "x" }, { suffix: "?x=1" }, { suffix: "/" }, { origin: "https://public.invalid" }, { media: "text/plain" }, { http: "GET" }]) assert.notEqual((await wire(c, "tools/list", {}, options)).code, 200);
    assert.equal(calls, 0);
});
test("F20A-B03 malformed, oversized, duplicate JSON and authority injection withhold", async t => {
    const { CodexHttpBridge } = await load(); let calls = 0; const b = new CodexHttpBridge({ ...base(), read: async () => { calls++; return { status: "DENIED" }; } }); t.after(() => b.dispose()); const c = await b.start();
    for (const raw of ['{"jsonrpc":"2.0","jsonrpc":"1.0"}', '{"s":"\\ud800"}', '{"s":"' + "x".repeat(65537) + '"}']) assert.notEqual((await wire(c, "", {}, { raw })).code, 200);
    for (const args of [{ path: ".env", approved: true }, { path: "../.env" }, { path: "C:/outside" }, { path: ".env", raw: true }])
        assert.ok((await wire(c, "tools/call", { name: "soterai_read_project_file_safely", arguments: args })).body.error);
    assert.equal(calls, 0);
});
test("F20A-B04 only bounded native metadata is ignored, never passed to authorizer", async t => {
    const { CodexHttpBridge } = await load(); let calls = 0; const b = new CodexHttpBridge({ ...base(), read: async () => { calls++; return { status: "DENIED" }; } }); t.after(() => b.dispose()); const c = await b.start();
    for (const _meta of [{ approved: true }, { callId: "x".repeat(1025) }, { threadId: {} }, { progressToken: -1 }, { raw: "true" }])
        assert.ok((await wire(c, "tools/call", { name: "soterai_read_project_file_safely", arguments: { path: ".env" }, _meta })).body.error);
    assert.equal(calls, 0);
    for (const method of ["resources/read", "prompts/get", "server/discover"]) assert.ok((await wire(c, method)).body.error);
});
test("F20A-B05 owner unready before/after read cannot return late content", async t => {
    const { CodexHttpBridge } = await load(); let ready = false, calls = 0;
    const b = new CodexHttpBridge({ ...base(), ready: async () => ready, read: async () => { calls++; ready = false; return { status: "ALLOWED_ONCE", kind: "redacted-file", text: "WITHHOLD_LATE" }; } }); t.after(() => b.dispose()); const c = await b.start();
    assert.notEqual((await wire(c)).code, 200); ready = true;
    assert.equal((await wire(c, "tools/call", { name: "soterai_read_project_file_safely", arguments: { path: "public.txt" } })).text.includes("WITHHOLD_LATE"), false); assert.equal(calls, 1);
});
test("F20A-B06 session rotation aborts pending approvals and rejects stale credentials", async t => {
    const { CodexHttpBridge } = await load(); let release!: (v: any) => void, entered = false, aborted = false;
    const b = new CodexHttpBridge({ ...base(), read: async (_f, _r, signal) => { entered = true; signal.addEventListener("abort", () => aborted = true); return new Promise<any>(r => release = r); } }); t.after(() => b.dispose()); const c = await b.start();
    const pending = wire(c, "tools/call", { name: "soterai_read_project_file_safely", arguments: { path: ".env" } });
    for (let i = 0; i < 100 && !entered; i++) await new Promise(r => setTimeout(r, 5)); assert.equal(entered, true); b.rotate(); release({ status: "ALLOWED_ONCE", kind: "redacted-file", text: "WITHHOLD_LATE" });
    assert.equal((await pending).text.includes("WITHHOLD_LATE"), false); assert.equal(aborted, true); assert.notEqual((await wire(c)).code, 200);
});
test("F20A-B07 busy admission withholds another request and flag withdrawal returns no data", async t => {
    const { CodexHttpBridge } = await load(); let release!: (v: any) => void, enabled = true, entered = false;
    const b = new CodexHttpBridge({ ...base(), enabled: () => enabled, read: async () => { entered = true; return new Promise<any>(r => release = r); } }); t.after(() => b.dispose()); const c = await b.start();
    const pending = wire(c, "tools/call", { name: "soterai_read_project_file_safely", arguments: { path: ".env" } });
    for (let i = 0; i < 100 && !entered; i++) await new Promise(r => setTimeout(r, 5)); assert.equal(entered, true);
    assert.notEqual((await wire(c)).code, 200); enabled = false; release({ status: "DENIED" }); assert.notEqual((await pending).code, 200);
});
