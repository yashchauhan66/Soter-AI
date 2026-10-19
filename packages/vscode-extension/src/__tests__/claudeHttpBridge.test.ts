import assert from "node:assert/strict";
import { test } from "node:test";
import { request } from "node:http";
const bridgeModule = () => import("../adapters/ClaudeHttpBridge");
const root = "D:/synthetic/claude-project";
const packet = { cwd: root, hook_event_name: "UserPromptSubmit", permission_mode: "default",
    prompt: "public", prompt_id: "synthetic", session_id: "synthetic", transcript_path: "D:/synthetic/private/log.jsonl" };
async function wire(url: string, token: string, body: unknown, options: { media?: string; origin?: string; raw?: string } = {}): Promise<{ code: number; body: any; text: string }> {
    return new Promise((done, reject) => {
        const req = request(url, { method: "POST", agent: false, headers: { authorization: "Bearer " + token,
            "content-type": options.media ?? "application/json", ...(options.origin ? { origin: options.origin } : {}) } }, res => {
            let text = ""; res.setEncoding("utf8"); res.on("data", part => text += part); res.on("error", reject);
            res.on("end", () => done({ code: res.statusCode!, text, body: text ? JSON.parse(text) : undefined }));
        }); req.on("error", reject); req.end(options.raw ?? JSON.stringify(body));
    });
}
const base = () => ({ enabled: () => true, workspace: root, ready: async () => true,
    classify: async () => "PUBLIC" as const, read: async () => ({ status: "DENIED" as const }) });
test("F19-B01 actual loopback HTTP hook neutral public control and private denial", async t => {
    const { ClaudeHttpBridge } = await bridgeModule();
    const bridge = new ClaudeHttpBridge({ ...base(), classify: async file => file === ".env" ? "RESTRICTED" : "PUBLIC" }); t.after(() => bridge.dispose());
    const c = await bridge.start();
    assert.equal((await wire(c.hookUrl, c.hookToken, packet)).code, 200);
    const { prompt: _prompt, ...common } = packet;
    const result = await wire(c.hookUrl, c.hookToken, { ...common, hook_event_name: "PreToolUse", tool_name: "Read", tool_input: { file_path: root + "/.env" }, tool_use_id: "synthetic" });
    assert.equal(result.code, 200); assert.equal(result.body.hookSpecificOutput.permissionDecision, "deny"); assert.equal(result.text.includes(".env"), false);
});
test("F19-B02 hook/MCP credentials cannot cross roles or accept origin/media/aliases", async t => {
    const { ClaudeHttpBridge } = await bridgeModule(); const bridge = new ClaudeHttpBridge(base()); t.after(() => bridge.dispose()); const c = await bridge.start();
    for (const [url, token, options] of [[c.hookUrl, c.mcpToken, {}], [c.mcpUrl, c.hookToken, {}],
        [c.hookUrl + "?x=1", c.hookToken, {}], [c.hookUrl, c.hookToken, { origin: "https://synthetic.invalid" }],
        [c.hookUrl, c.hookToken, { media: "text/plain" }]] as const) {
        assert.notEqual((await wire(url, token, packet, options)).code, 200);
    }
});
test("F19-B03 duplicate keys, invalid Unicode, oversize packets and authority spoof cannot release", async t => {
    const { ClaudeHttpBridge } = await bridgeModule(); const bridge = new ClaudeHttpBridge(base()); t.after(() => bridge.dispose()); const c = await bridge.start();
    for (const raw of ['{"hook_event_name":"UserPromptSubmit","hook_event_name":"PreToolUse"}', '{"prompt":"\\ud800"}', JSON.stringify({ ...packet, prompt: "x".repeat(65537) })]) {
        assert.notEqual((await wire(c.hookUrl, c.hookToken, undefined, { raw })).code, 200);
    }
    assert.notEqual((await wire(c.hookUrl, c.hookToken, { ...packet, approved: true })).code, 200);
});
test("F19-B04 stateless native protocol initialize, discovery and path-only safe-read contract", async t => {
    const { ClaudeHttpBridge } = await bridgeModule(); let calls = 0;
    const bridge = new ClaudeHttpBridge({ ...base(), read: async (file, recipient) => {
        calls++; assert.equal(file, ".env"); assert.match(recipient, /identity unverified/);
        return { status: "ALLOWED_ONCE", kind: "environment-schema", text: "TEST_KEY=[MASKED]" };
    } }); t.after(() => bridge.dispose()); const c = await bridge.start();
    const rpc = (method: string, params: unknown = {}, id?: number) => wire(c.mcpUrl, c.mcpToken, { jsonrpc: "2.0", method, params, ...(id === undefined ? {} : { id }) });
    assert.equal((await rpc("initialize", { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "synthetic", version: "1" } }, 1)).body.result.protocolVersion, "2025-11-25");
    assert.equal((await rpc("notifications/initialized")).code, 202);
    const listed = await rpc("tools/list", {}, 2); assert.equal(listed.body.result.tools.length, 1);
    const name = listed.body.result.tools[0].name;
    const read = await rpc("tools/call", { name, arguments: { path: ".env" } }, 3);
    assert.equal(JSON.parse(read.body.result.content[0].text).text, "TEST_KEY=[MASKED]"); assert.equal(calls, 1);
    for (const args of [{ path: ".env", approved: true }, { path: ".env", raw: true }, { path: "../.env" }]) {
        assert.ok((await rpc("tools/call", { name, arguments: args }, 4)).body.error); assert.equal(calls, 1);
    }
    assert.ok((await rpc("server/discover", {}, 5)).body.error);
});
test("F19-B05 withdrawal during safe read never releases a late approved view", async t => {
    const { ClaudeHttpBridge } = await bridgeModule(); let release!: (value: any) => void, entered = false, aborted = false;
    const bridge = new ClaudeHttpBridge({ ...base(), read: async (_file, _recipient, signal) => {
        entered = true; signal.addEventListener("abort", () => aborted = true, { once: true });
        return new Promise<any>(done => release = done);
    } }); t.after(() => bridge.dispose()); const c = await bridge.start();
    const pending = wire(c.mcpUrl, c.mcpToken, { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "soterai_read_project_file_safely", arguments: { path: ".env" } } });
    for (let i = 0; i < 100 && !entered; i++) await new Promise(done => setTimeout(done, 5)); assert.equal(entered, true);
    bridge.rotate(); release({ status: "ALLOWED_ONCE", kind: "redacted-file", text: "SYNTHETIC_WITHHELD_LATE" });
    const result = await pending; assert.equal(aborted, true); assert.equal(result.text.includes("SYNTHETIC_WITHHELD_LATE"), false);
    assert.notEqual((await wire(c.hookUrl, c.hookToken, packet)).code, 200);
});
test("F19-B06 unavailable hooks use non-success HTTP so pinned onFailure:block applies", async t => {
    const { ClaudeHttpBridge } = await bridgeModule(); let ready = false;
    const bridge = new ClaudeHttpBridge({ ...base(), ready: async () => ready }); t.after(() => bridge.dispose()); const c = await bridge.start();
    assert.equal((await wire(c.hookUrl, c.hookToken, packet)).code, 503);
    ready = true; assert.equal((await wire(c.hookUrl, c.hookToken, packet)).code, 200);
});
test("F19-B07 observed MCP progress/tool-use metadata remains bounded and cannot approve a read", async t => {
    const { ClaudeHttpBridge } = await bridgeModule(); let calls = 0;
    const bridge = new ClaudeHttpBridge({ ...base(), read: async () => { calls++; return { status: "DENIED" }; } }); t.after(() => bridge.dispose()); const c = await bridge.start();
    const send = (_meta: unknown, args: unknown = { path: ".env" }) => wire(c.mcpUrl, c.mcpToken, { jsonrpc: "2.0", id: 7, method: "tools/call",
        params: { name: "soterai_read_project_file_safely", arguments: args, _meta } });
    const result = await send({ progressToken: 7, "claudecode/toolUseId": "toolu_synthetic" });
    assert.equal(result.code, 200); assert.ok(result.body.result); assert.equal(JSON.parse(result.body.result.content[0].text).status, "DENIED"); assert.equal(calls, 1);
    for (const metadata of [{ progressToken: [7] }, { progressToken: 7, approved: true }, { raw: true }, { "claudecode/toolUseId": "x".repeat(257) }]) {
        assert.ok((await send(metadata)).body.error); assert.equal(calls, 1);
    }
    assert.ok((await send({ progressToken: 7 }, { path: ".env", approved: true })).body.error); assert.equal(calls, 1);
});
