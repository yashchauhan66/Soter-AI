import "./phase2/register.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";
import { request as httpRequest } from "node:http";
import { ProjectFileAccess } from "../project-privacy/ProjectFileAccess";
import { PassThrough } from "node:stream";
import { runMcpServer } from "../agent/mcpServer";

const SECRET = "TEST_ONLY_F17_PRIVATE_20261018";
const PUBLIC = "Useful public project documentation.";
const protocol = () => import("../agent/SafeReadProtocol");
const bridges = () => import("../agent/SafeReadBridge");
const tick = () => new Promise<void>(done => setImmediate(done));
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
function capture(file = "readme.txt", content = PUBLIC, sensitive = false) {
    return { workspace: "synthetic-F17", relativePath: file, policyRevision: "policy-1", fileIdentity: "file-1", content, regionView: content, sensitive };
}
async function fixture(t: { after(fn: () => unknown): unknown }, overrides: Record<string, unknown> = {}) {
    const { SafeReadBridge } = await bridges();
    const bridge = new SafeReadBridge({ enabled: () => true,
        read: async (_file: string, _recipient: string, _signal: AbortSignal) => ({ status: "ALLOWED_ONCE" as const, kind: "redacted-file" as const, text: PUBLIC }), ...overrides });
    t.after(() => bridge.dispose());
    return { bridge, connection: await bridge.start() };
}

test("F17 aborting an active F04 review promptly withholds a late approval", async t => {
    const approval = deferred<boolean>(); const abort = new AbortController();
    const access = new ProjectFileAccess({ enabled: () => true, now: () => 0, capture: async () => capture(), confirm: () => approval.promise });
    t.after(() => access.dispose());
    const pending = (access.request as Function)("readme.txt", "integration-command", abort.signal);
    await tick(); abort.abort();
    const early = await Promise.race([pending, new Promise(done => setTimeout(() => done("STILL_PENDING"), 50))]);
    approval.resolve(true); assert.deepEqual(early, { status: "EXPIRED" }); assert.deepEqual(await pending, { status: "EXPIRED" });
});
test("F17 already aborted requests never capture or review content", async t => {
    let captures = 0; const abort = new AbortController(); abort.abort();
    const access = new ProjectFileAccess({ enabled: () => true, now: () => 0, capture: async () => { captures++; return capture(); }, confirm: async () => true });
    t.after(() => access.dispose());
    assert.deepEqual(await (access.request as Function)("readme.txt", "integration-command", abort.signal), { status: "EXPIRED" }); assert.equal(captures, 0);
});
test("F17 safe path schema rejects caller approval, absolute paths, aliases and unsupported fields", async () => {
    const { safeReadPath } = await protocol();
    assert.equal(safeReadPath({ path: "docs/readme.txt" }), "docs/readme.txt");
    for (const value of [null, [], {}, { path: "x", approved: true }, { path: "x", raw: true }, { path: "x", recipient: "owner" },
        ...["../.env", "x/../.env", "C:/fake.env", "/tmp/file", "\\\\host\\share", "a\\b", "a//b", ".git/config", "x\0y", "a\nb", "a:stream", "x.", "x ", "a".repeat(2049)].map(path => ({ path }))])
        assert.equal(safeReadPath(value), undefined);
});
test("F17 connection schema accepts only the fixed local route and private session shape", async () => {
    const { validConnection } = await protocol();
    const good = { endpoint: "http://127.0.0.1:12345/safe-read", token: "a".repeat(64), session: "f17abcde-1234-4123-8123-0123456789ab" };
    assert.equal(validConnection(good), true);
    for (const patch of [{ endpoint: "https://public.invalid/safe-read" }, { endpoint: "http://127.0.0.1:12345/other" }, { endpoint: good.endpoint + "?token=x" }, { token: "short" }, { session: "wrong" }])
        assert.equal(validConnection({ ...good, ...patch }), false);
});
test("F17 actual HTTP bridge public control binds a server-owned recipient", async t => {
    let called = false;
    const { connection } = await fixture(t, { read: async (file: string, recipient: string) => {
        called = true; assert.equal(file, "docs/readme.txt"); assert.match(recipient, /MCP session .*identity unverified/);
        return { status: "ALLOWED_ONCE", kind: "redacted-file", text: PUBLIC };
    } });
    assert.deepEqual(await (await protocol()).requestSafeRead(connection, { path: "docs/readme.txt" }), { status: "ALLOWED_ONCE", kind: "redacted-file", text: PUBLIC }); assert.ok(called);
});
for (const [name, file, content, sensitive, expected] of [
    ["ordinary saved deny with approval", "restricted.txt", PUBLIC, false, PUBLIC],
    ["env names only", ".env", `TOKEN=${SECRET}\nPORT=1234`, true, "TOKEN=[MASKED]\nPORT=[MASKED]"],
    ["marked sensitive", "private.txt", SECRET, true, undefined],
] as const) test(`F17 actual bridge reuses safe-view reader: ${name}`, async t => {
    let preview = ""; const access = new ProjectFileAccess({ enabled: () => true, now: () => 0,
        capture: async () => capture(file, content, sensitive), confirm: async receipt => { preview = receipt.safeText; return true; } });
    t.after(() => access.dispose());
    const { connection } = await fixture(t, { read: (_file: string, _recipient: string, signal: AbortSignal) => (access.request as Function)(file, "integration-command", signal) });
    const result = await (await protocol()).requestSafeRead(connection, { path: file });
    assert.equal(result.status, "ALLOWED_ONCE"); assert.equal(result.text, preview); assert.ok(!JSON.stringify(result).includes(SECRET)); if (expected) assert.equal(result.text, expected);
});
test("F17 invalid auth and session never reach the native reader", async t => {
    let reads = 0; const { connection } = await fixture(t, { read: async () => { reads++; throw new Error(SECRET); } });
    for (const patch of [{ token: "b".repeat(64) }, { session: "f17abcde-1234-4123-8123-0123456789ab" }]) {
        const result = await (await protocol()).requestSafeRead({ ...connection, ...patch }, { path: ".env" }); assert.notEqual(result.status, "ALLOWED_ONCE"); assert.ok(!JSON.stringify(result).includes(SECRET));
    } assert.equal(reads, 0);
});
test("F17 flag withdrawal while native confirmation waits releases no output", async t => {
    let enabled = true; const approval = deferred<void>(); const entered = deferred<void>();
    const { connection } = await fixture(t, { enabled: () => enabled, read: async () => { entered.resolve(); await approval.promise; return { status: "ALLOWED_ONCE", kind: "redacted-file", text: PUBLIC }; } });
    const result = (await protocol()).requestSafeRead(connection, { path: "readme.txt" }); await entered.promise; enabled = false; approval.resolve(); assert.notEqual((await result).status, "ALLOWED_ONCE");
});
test("F17 explicit session rotation invalidates pending and prior clients", async t => {
    const approval = deferred<void>(); const entered = deferred<void>();
    const { bridge, connection } = await fixture(t, { read: async () => { entered.resolve(); await approval.promise; return { status: "ALLOWED_ONCE", kind: "redacted-file", text: PUBLIC }; } });
    const result = (await protocol()).requestSafeRead(connection, { path: "readme.txt" }); await entered.promise; bridge.rotate(); approval.resolve(); assert.notEqual((await result).status, "ALLOWED_ONCE");
    assert.notEqual((await (await protocol()).requestSafeRead(connection, { path: "readme.txt" })).status, "ALLOWED_ONCE");
});
test("F17 client cancellation propagates to the actual host read and withholds late data", async t => {
    const entered = deferred<void>(), cancelled = deferred<void>(); const abort = new AbortController();
    const { connection } = await fixture(t, { read: async (_file: string, _recipient: string, signal: AbortSignal) => { entered.resolve(); await new Promise<void>(done => { signal.addEventListener("abort", () => { cancelled.resolve(); done(); }, { once: true }); }); return { status: "ALLOWED_ONCE", kind: "redacted-file", text: PUBLIC }; } });
    const result = (await protocol()).requestSafeRead(connection, { path: "readme.txt" }, abort.signal); await entered.promise; abort.abort(); assert.notEqual((await result).status, "ALLOWED_ONCE"); await cancelled.promise;
});
test("F17 actual bridge malformed/oversize/unknown fields return fixed errors with no read", async t => {
    let reads = 0; const { connection } = await fixture(t, { read: async () => { reads++; throw new Error(SECRET); } });
    const send = (body: string) => new Promise<string>((done, reject) => {
        const req = httpRequest(connection.endpoint, { method: "POST", headers: { authorization: `Bearer ${connection.token}`, "content-type": "application/json" } }, res => {
            let text = ""; res.setEncoding("utf8"); res.on("data", chunk => text += chunk); res.on("end", () => done(text));
        }); req.on("error", reject); req.end(body);
    });
    for (const body of ["{broken", "x".repeat(8200), JSON.stringify({ version: 1, session: connection.session, id: "f17abcde-1234-4123-8123-0123456789ab", path: "readme.txt", approved: true })]) {
        const text = await send(body); assert.ok(!text.includes(SECRET)); assert.notEqual(JSON.parse(text).status, "ALLOWED_ONCE");
    } assert.equal(reads, 0);
});
test("F17 actual bridge outage has no original-file fallback", async t => {
    const { bridge, connection } = await fixture(t); await bridge.dispose();
    assert.deepEqual(await (await protocol()).requestSafeRead(connection, { path: ".env" }), { status: "UNAVAILABLE" });
});
test("F17 actual stdio route advertises and dispatches the safe reader", async () => {
    const input = new PassThrough(), output = new PassThrough(); let text = ""; output.setEncoding("utf8"); output.on("data", chunk => text += chunk);
    const run = (runMcpServer as Function)(input, output, { read: async (args: unknown) => { assert.deepEqual(args, { path: "readme.txt" }); return { status: "ALLOWED_ONCE", kind: "redacted-file", text: PUBLIC }; } });
    input.write(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize" }) + "\n");
    input.write(JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" }) + "\n");
    input.write(JSON.stringify({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "soterai_read_project_file_safely", arguments: { path: "readme.txt" } } }) + "\n");
    await tick(); input.end(); await run;
    const replies = text.trim().split("\n").map(line => JSON.parse(line));
    assert.ok(replies.find(row => row.id === 2)?.result?.tools.some((tool: { name: string }) => tool.name === "soterai_read_project_file_safely"));
    assert.ok(JSON.stringify(replies.find(row => row.id === 3)).includes(PUBLIC));
});
