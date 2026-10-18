import "./phase2/register.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";
import { PassThrough } from "node:stream";
import { runMcpServer } from "../agent/mcpServer";
import { SAFE_READ_TOOL, safeReadResult } from "../agent/SafeReadProtocol";
const tick = () => new Promise<void>(done => setImmediate(done));
function transport(read: (args: unknown, signal: AbortSignal) => Promise<any>) {
    const input = new PassThrough(), output = new PassThrough(), replies: any[] = []; let buffer = "";
    output.setEncoding("utf8"); output.on("data", chunk => { buffer += chunk; let i; while ((i = buffer.indexOf("\n")) >= 0) { replies.push(JSON.parse(buffer.slice(0, i))); buffer = buffer.slice(i + 1); } });
    const running = runMcpServer(input, output, { read });
    const send = (value: unknown) => input.write(JSON.stringify(value) + "\n");
    const call = (id: unknown, args: unknown = { path: "readme.txt" }) => send({ jsonrpc: "2.0", id, method: "tools/call", params: { name: SAFE_READ_TOOL, arguments: args } });
    return { input, output, replies, send, call, running, init: () => send({ jsonrpc: "2.0", id: "init", method: "initialize" }) };
}
test("F17 review exact result schema refuses originals/unknown kinds/oversized release", () => {
    for (const value of [{ status: "ALLOWED_ONCE", kind: "raw", text: "private" }, { status: "ALLOWED_ONCE", kind: "redacted-file", text: "public", original: "private" },
        { status: "ALLOWED_ONCE", kind: "redacted-file", text: "x".repeat(16385) }, { status: "DENIED", text: "private" }, null]) assert.deepEqual(safeReadResult(value), { status: "UNAVAILABLE" });
});
test("F17 review preinitialize, spoofed fields and duplicate pending IDs reach no additional reader", async () => {
    let calls = 0; let finish!: (value: any) => void;
    const wire = transport(async () => { calls++; return new Promise(done => { finish = done; }); });
    wire.call(1); await tick(); assert.equal(calls, 0); wire.init();
    wire.call(2, { path: "readme.txt", approved: true }); wire.call(3, { path: "readme.txt", raw: true }); await tick(); assert.equal(calls, 0);
    wire.call(4); wire.call(4); await tick(); assert.equal(calls, 1); assert.ok(wire.replies.filter(row => row.error).length >= 4);
    finish({ status: "DENIED" }); await tick(); wire.input.end(); await wire.running;
});
test("F17 review cancellation is request-bound and no late public text is released", async () => {
    let signal!: AbortSignal; let finish!: (value: any) => void;
    const wire = transport(async (_args, token) => { signal = token; return new Promise(done => { finish = done; }); }); wire.init(); wire.call(1); await tick();
    wire.send({ jsonrpc: "2.0", method: "notifications/cancelled", params: { requestId: 2 } }); assert.equal(signal.aborted, false);
    wire.send({ jsonrpc: "2.0", method: "notifications/cancelled", params: { requestId: 1 } }); assert.equal(signal.aborted, true);
    finish({ status: "ALLOWED_ONCE", kind: "redacted-file", text: "late public" }); await tick();
    assert.ok(!JSON.stringify(wire.replies).includes("late public")); assert.ok(JSON.stringify(wire.replies).includes("EXPIRED")); wire.input.end(); await wire.running;
});
test("F17 review pending queue is bounded and EOF aborts every active read", async () => {
    const signals: AbortSignal[] = []; const wire = transport(async (_args, signal) => { signals.push(signal); return new Promise(() => undefined); }); wire.init();
    for (let i = 0; i < 9; i++) wire.call(i); await tick(); assert.equal(signals.length, 4); assert.equal(wire.replies.filter(row => JSON.stringify(row).includes("BUSY")).length, 5);
    wire.input.end(); await wire.running; assert.ok(signals.every(signal => signal.aborted));
});
test("F17 review malformed and oversized frames resynchronize without executing a valid tail", async () => {
    let calls = 0; const wire = transport(async () => { calls++; return { status: "DENIED" }; }); wire.init();
    wire.input.write("{bad\n"); wire.input.write("x".repeat(1024 * 1024 + 1));
    wire.input.write(JSON.stringify({ jsonrpc: "2.0", id: "tail", method: "tools/call", params: { name: SAFE_READ_TOOL, arguments: { path: "readme.txt" } } }) + "\n");
    await tick(); assert.equal(calls, 0); wire.call("good"); await tick(); assert.equal(calls, 1); wire.input.end(); await wire.running;
});
test("F17 review synchronous route exceptions are fixed errors and transport survives", async () => {
    const wire = transport(() => { throw new Error("TEST_ONLY_PRIVATE_ERROR_F17"); }); wire.init(); wire.call(1); await tick();
    wire.send({ jsonrpc: "2.0", id: 2, method: "ping" }); await tick(); assert.ok(!JSON.stringify(wire.replies).includes("TEST_ONLY_PRIVATE_ERROR_F17")); assert.ok(wire.replies.some(row => row.id === 2 && row.result)); wire.input.end(); await wire.running;
});
