import "./phase2/register.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { request } from "node:http";
import { SafeReadBridge } from "../agent/SafeReadBridge";
const hooks = () => import("../adapters/ClineHookProtocol");
async function wire(connection: { endpoint: string; token: string; session: string }, path: string, operation: string, workspace = "D:/fixture/project"): Promise<any> {
    return new Promise((done, reject) => { const req = request(connection.endpoint, { method: "POST", headers: { authorization: "Bearer " + connection.token, "content-type": "application/json" } }, res => { let text = ""; res.setEncoding("utf8"); res.on("data", part => text += part); res.on("end", () => done(JSON.parse(text))); }); req.on("error", reject); req.end(JSON.stringify({ version: 1, id: randomUUID(), session: connection.session, path, operation, workspace })); });
}
test("F18 existing bridge grants no classification capability unless explicitly supplied", async t => {
    const bridge = new SafeReadBridge({ enabled: () => true, read: async () => ({ status: "DENIED" }) }); t.after(() => bridge.dispose());
    assert.notEqual((await wire(await bridge.start(), ".env", "classify-read")).status, "PUBLIC");
});
for (const purpose of ["read", "write"] as const) test(`F18 private native ${purpose} classification returns metadata only`, async t => {
    let called = false;
    const bridge = new SafeReadBridge({ workspace: "D:/fixture/project", enabled: () => true, read: async () => ({ status: "DENIED" }), classify: async (file: string, intent: string) => { called = true; assert.equal(file, "public.txt"); assert.equal(intent, purpose); return "PUBLIC"; } } as any); t.after(() => bridge.dispose());
    const connection = await bridge.start();
    assert.deepEqual(await wire(connection, "public.txt", "classify-" + purpose), { status: "PUBLIC", session: connection.session }); assert.ok(called);
});
test("F18 private classification never treats an unknown object/original as a public decision", async t => {
    const bridge = new SafeReadBridge({ workspace: "D:/fixture/project", enabled: () => true, read: async () => ({ status: "DENIED" }), classify: async () => ({ status: "PUBLIC", text: "TEST_ONLY_F18_PRIVATE" }) } as any); t.after(() => bridge.dispose());
    const result = await wire(await bridge.start(), ".env", "classify-read"); assert.notEqual(result.status, "PUBLIC"); assert.ok(!JSON.stringify(result).includes("TEST_ONLY_F18_PRIVATE"));
});
test("F18 native classifier withdrawal while a decision is pending releases no public grant", async t => {
    let resolve!: (value: string) => void, entered = false;
    const bridge = new SafeReadBridge({ workspace: "D:/fixture/project", enabled: () => true, read: async () => ({ status: "DENIED" }), classify: async () => { entered = true; return new Promise<string>(done => { resolve = done; }); } } as any); t.after(() => bridge.dispose());
    const pending = wire(await bridge.start(), "public.txt", "classify-read");
    for (let i = 0; i < 100 && !entered; i++) await new Promise(done => setTimeout(done, 5)); assert.ok(entered); bridge.rotate(); resolve("PUBLIC"); assert.notEqual((await pending).status, "PUBLIC");
});
test("F18 hook public reads require every explicit target to pass the current classifier", async () => {
    const { evaluateClineHook } = await hooks(), observed: string[] = [];
    const result = await evaluateClineHook({ preToolUse: { toolName: "read_files", parameters: { paths: '["public.txt","docs/readme.md"]' } } }, async (file: string, intent: string) => { observed.push(file); assert.equal(intent, "read"); return "PUBLIC"; });
    assert.deepEqual(result, { cancel: false }); assert.deepEqual(observed, ["public.txt", "docs/readme.md"]);
});
test("F18 any protected/malformed/unknown/read outage path withholds the native operation", async () => {
    const { evaluateClineHook } = await hooks();
    for (const [frame, verdict] of [
        [{ preToolUse: { toolName: "read_files", parameters: { path: ".env" } } }, "RESTRICTED"],
        [{ preToolUse: { toolName: "read_files", parameters: { path: "../.env" } } }, "PUBLIC"],
        [{ preToolUse: { toolName: "read_files", parameters: { path: "public.txt", approved: "true" } } }, "PUBLIC"],
        [{ preToolUse: { toolName: "unknown_tool", parameters: {} } }, "PUBLIC"],
        [{ preToolUse: { toolName: "read_files", parameters: { path: "public.txt" } } }, "UNAVAILABLE"],
    ] as const) assert.equal((await evaluateClineHook(frame, async () => verdict)).cancel, true);
});
test("F18 unknown shell/history/search scope cannot inherit a public file decision", async () => {
    const { evaluateClineHook } = await hooks(); let calls = 0;
    for (const toolName of ["run_commands", "search_codebase", "fetch_web_content"]) assert.equal((await evaluateClineHook({ preToolUse: { toolName, parameters: { command: "Get-Content .env", path: "public.txt" } } }, async () => { calls++; return "PUBLIC"; })).cancel, true);
    assert.equal(calls, 0);
});
test("F18 TaskStart requires the current private session before the first model request", async t => {
    let fileCalls = 0;
    const bridge = new SafeReadBridge({ workspace: "D:/fixture/project", ready: async () => true, enabled: () => true, read: async () => ({ status: "DENIED" }), classify: async () => { fileCalls++; return "RESTRICTED"; } } as any); t.after(() => bridge.dispose());
    const connection = await bridge.start(); assert.deepEqual(await wire(connection, "__soterai_session__", "classify-ready"), { status: "PUBLIC", session: connection.session }); assert.equal(fileCalls, 0);
    const { evaluateClineHook } = await hooks();
    assert.deepEqual(await (evaluateClineHook as Function)({ taskStart: { taskMetadata: {} } }, async () => "RESTRICTED", async () => true), { cancel: false });
    assert.equal((await (evaluateClineHook as Function)({ taskStart: { taskMetadata: {} } }, async () => "PUBLIC", async () => false)).cancel, true);
});
test("F18 a copied hook from another workspace receives no native grant", async t => {
    let calls = 0;
    const bridge = new SafeReadBridge({ workspace: "D:/fixture/project", ready: async () => true, enabled: () => true, read: async () => ({ status: "DENIED" }), classify: async () => { calls++; return "PUBLIC"; } } as any); t.after(() => bridge.dispose());
    const connection = await bridge.start();
    assert.notEqual((await wire(connection, "public.txt", "classify-read", "D:/fixture/other-project")).status, "PUBLIC");
    assert.notEqual((await wire(connection, "__soterai_session__", "classify-ready", "D:/fixture/other-project")).status, "PUBLIC"); assert.equal(calls, 0);
});
