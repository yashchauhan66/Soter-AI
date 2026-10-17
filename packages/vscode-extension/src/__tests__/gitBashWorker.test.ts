import assert from "node:assert/strict";
import { test } from "node:test";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import type { ChildProcess, spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { StreamingOutputRedactor } from "../../../core/src/StreamingOutputRedactor";
const EXE = "C:\\Program Files\\Git\\usr\\bin\\bash.exe", ID = "ca121212-aabb-4cc0-8dd0-111111111111", PRIVATE = "synthetic-f13-output-canary-Qz81", MASK = "[REDACTED_SECRET_OUTPUT]";
const tick = () => new Promise<void>(done => setImmediate(done));
class Child extends EventEmitter {
    stdin: PassThrough | null = new PassThrough(); stdout: PassThrough | null = new PassThrough(); stderr: PassThrough | null = new PassThrough(); pid = 42712; kills = 0; input: Buffer[] = [];
    constructor() { super(); this.stdin!.on("data", bytes => this.input.push(Buffer.from(bytes))); }
    kill(): never { this.kills++; throw Error("No process termination authorized"); }
    async close(code = 0) { this.stdout?.end(); this.stderr?.end(); await tick(); this.emit("close", code); await tick(); }
}
async function fixture(operation: unknown = { kind: "PUBLIC", action: "version", args: [] }, missing?: "stdin" | "stdout" | "stderr") {
    const { GitBashWorker } = await import("../terminal/GitBashWorker"), child = new Child(), calls: any[] = [], timers: Array<{ callback(): void; ms: number; active: boolean }> = []; if (missing) child[missing] = null;
    const worker = new GitBashWorker({ id: ID, executable: EXE, root: resolve(tmpdir()), operation: operation as never, parentEnvironment: { SystemRoot: "C:\\Windows", WINDIR: "C:\\Windows", PATH: PRIVATE, NODE_OPTIONS: PRIVATE, API_KEY: PRIVATE, HTTP_PROXY: PRIVATE }, output: new StreamingOutputRedactor([PRIVATE]), enabled: () => live }, {
        spawn: ((exe: string, args: string[], options: object) => { calls.push({ exe, args, options }); queueMicrotask(() => child.emit("spawn")); return child as unknown as ChildProcess; }) as unknown as typeof spawn,
        setTimer(callback, ms) { const timer = { callback, ms, active: true }; timers.push(timer); return timer; }, clearTimer(handle) { (handle as { active: boolean }).active = false; },
    });
    let live = true, settled = false; void worker.completion.then(() => { settled = true; });
    return { worker, child, calls, timers, revoke() { live = false; }, get settled() { return settled; }, async run() { const state = await worker.start(); await tick(); assert.equal(state.state, "RUNNING"); }, async finish(code = 0) { await child.close(code); assert.equal(child.kills, 0); return await worker.completion; } };
}
test("F13-W01 only fixed Bash code enters argv; literal is private stdin and fresh env excludes inherited values", async () => {
    const f = await fixture({ kind: "PUBLIC", action: "write", args: [PRIVATE] }); await f.run(); const call = f.calls[0]; assert.equal(call.exe, EXE); assert.deepEqual(call.args, ["--noprofile", "--norc", "-c", String.raw`[[ "$BASH_VERSION" == '5.2.37(1)-release' ]] || exit 2; IFS= read -r value || exit 2; printf '%s\n' "$value"`]);
    assert.equal(call.options.shell, false); assert.equal(call.options.windowsHide, true); assert.ok(!JSON.stringify(call).includes(PRIVATE)); assert.equal(Buffer.concat(f.child.input).toString("utf8"), PRIVATE + "\n");
    f.child.stdout!.write(Buffer.from(PRIVATE + "\n", "utf8")); const result = await f.finish(); assert.equal(result.output.status, "COMPLETE"); assert.equal(result.output.stdout, MASK);
});
test("F13-W02 actual close and both drained pipes precede release", async () => {
    const f = await fixture(); await f.run(); f.child.stdout!.write(Buffer.from("public\r\n", "utf8")); f.child.emit("exit", 0); f.child.stdout!.end(); f.child.stderr!.end(); await tick(); assert.equal(f.settled, false); f.child.emit("close", 0); assert.equal((await f.worker.completion).output.stdout, "public\n");
});
test("F13-W03 byte-split UTF8 Unicode output decodes exactly through real F08", async () => {
    const f = await fixture(); await f.run(); for (const byte of Buffer.from("public café 雪 😀\r\n", "utf8")) f.child.stdout!.write(Buffer.from([byte])); assert.equal((await f.finish()).output.stdout, "public café 雪 😀\n");
});
for (const [index, invalid] of [Buffer.from([0xf0, 0x9f]), Buffer.from([0xff]), Buffer.from("public\x1b[2J", "utf8")].entries()) test(`F13-W04-${index} malformed final UTF8/control discards all channels`, async () => {
    const f = await fixture(); await f.run(); f.child.stdout!.write(Buffer.from("public\n", "utf8")); f.child.stderr!.write(invalid); const result = await f.finish(); assert.equal(result.output.status, "WITHHELD"); assert.equal(result.output.stdout, ""); assert.equal(result.output.stderr, "");
});
for (const [index, operation] of [ { kind: "READ", path: ".env" }, { kind: "PUBLIC", action: "write", args: ["x\r\ny"] }, { kind: "PUBLIC", action: "write", args: ["\ud800"] }, { kind: "PUBLIC", action: "list", args: ["../outside"] }, { kind: "PUBLIC", action: "sleep", args: ["2001"] }, { kind: "PUBLIC", action: "version", args: ["data"] }, { kind: "PUBLIC", action: "version", args: [], env: PRIVATE }, { kind: "PUBLIC", action: "date", args: [] } ].entries()) test(`F13-W05-${index} malformed/unsupported operation cannot spawn`, async () => {
    const f = await fixture(operation); await f.worker.start(); assert.equal(f.calls.length, 0); assert.equal((await f.worker.completion).output.status, "WITHHELD");
});
for (const missing of ["stdin", "stdout", "stderr"] as const) test(`F13-W06-${missing} missing pipe retains actual close ownership`, async () => {
    const f = await fixture(undefined, missing); await f.worker.start(); await tick(); assert.equal(f.settled, false); assert.equal((await f.finish()).output.status, "WITHHELD");
});
test("F13-W07 overflow cancels output and drains until actual close without kill", async () => {
    const f = await fixture(); await f.run(); f.child.stdout!.write(Buffer.alloc(262145, 0x61)); await tick(); assert.equal(f.settled, false); assert.equal(f.worker.snapshot().state, "CANCEL_PENDING"); assert.equal((await f.finish()).output.status, "WITHHELD");
});
test("F13-W08 held wait stdin releases at its bound even after cancellation", async () => {
    const f = await fixture({ kind: "PUBLIC", action: "sleep", args: ["1000"] }); await f.run(); assert.equal(f.child.stdin!.writableEnded, false); f.worker.cancel(); const timer = f.timers.find(row => row.active && row.ms === 1000); assert.ok(timer); timer.callback(); assert.equal(f.child.stdin!.writableEnded, true); assert.equal(f.settled, false); assert.equal((await f.finish()).output.status, "WITHHELD");
});
test("F13-W09 private guard withdrawal after collected public output withholds", async () => { const f = await fixture(); await f.run(); f.child.stdout!.write(Buffer.from("public", "utf8")); f.revoke(); assert.equal((await f.finish()).output.status, "WITHHELD"); });
test("F13-W10 nonzero exit withholds all error bytes", async () => { const f = await fixture(); await f.run(); f.child.stderr!.write(Buffer.from(PRIVATE, "utf8")); assert.equal((await f.finish(1)).output.status, "WITHHELD"); });
test("F13-W11 directory names have an independent 256 entry bound", async () => { const f = await fixture({ kind: "PUBLIC", action: "list", args: ["."] }); await f.run(); f.child.stdout!.write(Buffer.from(Array(257).fill("public.txt").join("\r\n") + "\r\n", "utf8")); assert.equal((await f.finish()).output.status, "WITHHELD"); });
test("F13-W12 wrong literal transport prefix cannot be published", async () => { const f = await fixture({ kind: "PUBLIC", action: "write", args: ["public"] }); await f.run(); f.child.stdout!.write(Buffer.from("other=public\r\n", "utf8")); assert.equal((await f.finish()).output.status, "WITHHELD"); });
test("F13-W13 raw chunk budget overflow withholds under byte limit", async () => { const f = await fixture(); await f.run(); for (let index = 0; index < 4097; index++) f.child.stdout!.write(Buffer.from([0x61, 0x00])); assert.equal((await f.finish()).output.status, "WITHHELD"); });
test("F13-W14 installed Git Bash version, stdin masking and finite wait execute actual pinned runtime", { skip: process.platform !== "win32" }, async () => {
    const { GitBashWorker } = await import("../terminal/GitBashWorker");
    for (const operation of [{ kind: "PUBLIC", action: "version", args: [] }, { kind: "PUBLIC", action: "write", args: [PRIVATE] }, { kind: "PUBLIC", action: "sleep", args: ["100"] }] as const) {
        const worker = new GitBashWorker({ id: ID, executable: EXE, root: resolve(tmpdir()), operation, parentEnvironment: { SystemRoot: "C:\\Windows", WINDIR: "C:\\Windows" }, output: new StreamingOutputRedactor([PRIVATE]), enabled: () => true }); await worker.start(); const result = await worker.completion; assert.equal(result.output.status, "COMPLETE"); assert.equal(result.snapshot.state, "EXITED"); if (operation.action === "version") assert.match(result.output.stdout, /^5\.2\.37/); if (operation.action === "write") assert.equal(result.output.stdout, MASK); if (operation.action === "sleep") assert.equal(result.output.stdout, "");
    }
});
test("F13-W15 transport truncation or altered literal text cannot be published", async () => {
    const f = await fixture({ kind: "PUBLIC", action: "write", args: ["public original"] }); await f.run(); f.child.stdout!.write(Buffer.from("public altered\n", "utf8")); assert.equal((await f.finish()).output.status, "WITHHELD");
});
test("F13-W16 postimplementation coverage: encoded and ANSI-split registered UTF8 output uses F08 recognition", async () => {
    for (const text of [Buffer.from(PRIVATE).toString("base64"), PRIVATE.slice(0, 9) + "\x1b[31m" + PRIVATE.slice(9) + "\x1b[0m"]) {
        const f = await fixture(); await f.run(); for (const byte of Buffer.from(text, "utf8")) f.child.stdout!.write(Buffer.from([byte])); const result = await f.finish(); assert.equal(result.output.status, "COMPLETE"); assert.equal(result.output.stdout, MASK);
    }
});
test("F13-W17 installed UTF8 literal transport preserves empty/Unicode/BOM/metacharacters as data", { skip: process.platform !== "win32" }, async () => {
    const { GitBashWorker } = await import("../terminal/GitBashWorker");
    for (const value of ["", "public café 雪", "\ufeffpublic BOM", "literal $dollar; & percent% bang! \\data"]) {
        const worker = new GitBashWorker({ id: ID, executable: EXE, root: resolve(tmpdir()), operation: { kind: "PUBLIC", action: "write", args: [value] }, parentEnvironment: { SystemRoot: "C:\\Windows" }, output: new StreamingOutputRedactor([PRIVATE]), enabled: () => true }); await worker.start(); const result = await worker.completion; assert.equal(result.output.status, "COMPLETE"); assert.equal(result.output.stdout, value + "\n");
    }
});
