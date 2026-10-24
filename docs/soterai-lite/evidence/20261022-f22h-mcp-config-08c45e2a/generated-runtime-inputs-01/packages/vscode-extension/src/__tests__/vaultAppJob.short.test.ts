import assert from "node:assert/strict";
import { test } from "node:test";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import type { ChildProcess, spawn } from "node:child_process";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import type { VaultAppDescriptor } from "../../../core/src/VaultAppDescriptor";

// F09 short-value consumer policy only. F07/F08's short-value classifier and
// public prose semantics remain separately covered by their retained suites.
const MASK = "[REDACTED_SECRET_OUTPUT]";
const tick = async () => { await new Promise<void>(done => setImmediate(done)); };
function descriptor(): VaultAppDescriptor {
    const root = resolve(tmpdir(), "synthetic-f09-short-not-created");
    return { schemaVersion: 1, id: "f585ebef-9bc9-46bb-81f9-08cfef6513c3", root, program: join(root, "public.cjs"), cwd: root,
        source: join(root, ".env.synthetic"), programDigest: "c".repeat(64), args: [],
        selections: [{ name: "TOKEN", placeholder: "[SOTERAI_PROTECTED_0123456789ABCDEF0123456789ABCDEF_0]" }] };
}
class Child extends EventEmitter {
    readonly stdout = new PassThrough(); readonly stderr = new PassThrough(); readonly stdin = null; readonly pid = 45216;
    readonly channel = { unref() {} }; connected = true; killCalls = 0;
    send(_message: unknown, ...tail: unknown[]): boolean { const callback = tail.find(value => typeof value === "function") as ((error: null) => void) | undefined; callback?.(null); return true; }
    kill(): never { this.killCalls++; throw new Error("Fixture forbids forced termination."); }
}
async function result(value: string, stdout: string, stderr = "") {
    const { VaultAppJob } = await import("../vault-runtime/VaultAppJob"), child = new Child();
    const job = new VaultAppJob({ descriptor: descriptor(), values: { TOKEN: value }, runtime: { executable: process.execPath, electron: false }, parentEnvironment: {} }, {
        spawn: (() => { queueMicrotask(() => { child.emit("spawn"); child.emit("message", { type: "READY" }); }); return child as unknown as ChildProcess; }) as unknown as typeof spawn,
        setTimer() { return {}; }, clearTimer() {},
    });
    assert.equal((await job.start()).state, "RUNNING"); child.stdout.write(stdout); if (stderr) child.stderr.write(stderr);
    child.stdout.end(); child.stderr.end(); await tick(); child.emit("exit", 0, null); child.emit("close", 0, null);
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
        const completion = await Promise.race([job.completion, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("Finite synthetic close did not complete.")), 300); })]);
        assert.equal(child.killCalls, 0); return completion;
    } finally { if (timer) clearTimeout(timer); }
}

test("F09-JS01 embedded raw and supported encodings of a selected short value never leave either channel", async () => {
    const value = "qZ4", representations = [value, Buffer.from(value).toString("base64"), Buffer.from(value).toString("hex"), "%71%5A%34", JSON.stringify(value)];
    for (const representation of representations) {
        const completion = await result(value, "public-prefix(" + representation + ")public-suffix", "ordinary warning");
        if (completion.output.status === "WITHHELD") { assert.equal(completion.output.stdout, ""); assert.equal(completion.output.stderr, ""); }
        else { assert.equal(completion.output.stdout, MASK); assert.equal(completion.output.stderr, MASK); assert.equal(completion.output.redacted, true); }
        assert.ok(!JSON.stringify(completion).includes(value), "A selected short value is private even when embedded in public prose.");
    }
});

test("F09-JS02 an unmatched public response with a short registration is conservatively masked as a whole", async () => {
    const completion = await result("qZ4", "ordinary public text\n", "public warning\n");
    if (completion.output.status === "WITHHELD") { assert.equal(completion.output.stdout, ""); assert.equal(completion.output.stderr, ""); }
    else { assert.equal(completion.output.stdout, MASK); assert.equal(completion.output.stderr, MASK); assert.equal(completion.output.redacted, true); assert.equal(completion.output.exitCode, 0); }
});

test("F09-JS03 a short value contained in the fixed replacement marker withholds instead of releasing that value", async () => {
    const completion = await result("SECRET", "ordinary public text\n");
    assert.equal(completion.output.status, "WITHHELD"); assert.equal(completion.output.stdout, ""); assert.equal(completion.output.stderr, "");
    assert.equal(completion.output.redacted, false); assert.ok(!JSON.stringify(completion).includes("SECRET"));
});

test("F09-JS04 an eight-scalar selected value retains the paired ordinary-public-output behavior", async () => {
    const completion = await result("qZ4ab7T9", "ordinary public text\n", "public warning\n");
    assert.deepEqual(completion.output, { status: "COMPLETE", stdout: "ordinary public text\n", stderr: "public warning\n", redacted: false, exitCode: 0 });
});
