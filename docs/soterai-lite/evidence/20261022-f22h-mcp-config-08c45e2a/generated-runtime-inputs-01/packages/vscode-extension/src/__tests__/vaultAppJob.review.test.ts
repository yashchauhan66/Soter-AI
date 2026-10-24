import assert from "node:assert/strict";
import { test } from "node:test";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import type { ChildProcess, spawn } from "node:child_process";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
import type { VaultAppDescriptor } from "../../../core/src/VaultAppDescriptor";

// LOW review regressions: synthetic metadata and in-memory children only.
// Bounded races fail visibly without leaving native processes or real timers.
const PRIVATE = "synthetic-f09-review-private-id-value-K6";
const ID = "23439b40-dfd6-468b-a2d6-a579de86d8ee";
const tick = async () => { await new Promise<void>(done => setImmediate(done)); };
async function bounded<T>(promise: Promise<T>, label: string): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try { return await Promise.race([promise, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(label)), 250); })]); }
    finally { if (timer) clearTimeout(timer); }
}
function descriptor(): VaultAppDescriptor {
    const root = resolve(tmpdir(), "synthetic-f09-review-not-created");
    return { schemaVersion: 1, id: ID, root, program: join(root, "public.cjs"), cwd: root, source: join(root, ".env.synthetic"),
        programDigest: "b".repeat(64), args: [], selections: [{ name: "DB_URL", placeholder: "[SOTERAI_PROTECTED_0123456789ABCDEF0123456789ABCDEF_0]" }] };
}
function noPrivate(value: unknown): void { assert.ok(!JSON.stringify(value).includes(PRIVATE), "Safe metadata must not copy unvalidated input text."); }
function options(desc = descriptor()) {
    return { descriptor: desc, values: { DB_URL: PRIVATE }, runtime: { executable: process.execPath, electron: false }, parentEnvironment: {} };
}
class IncompleteChild extends EventEmitter {
    readonly pid = 45123; readonly stdin = null; readonly stdout: PassThrough | null; readonly stderr: PassThrough | null;
    readonly sent: unknown[] = []; connected = true; killCalls = 0; readonly channel = { unref() {} };
    constructor(missing: "stdout" | "stderr") { super(); this.stdout = missing === "stdout" ? null : new PassThrough(); this.stderr = missing === "stderr" ? null : new PassThrough(); }
    send(message: unknown, ...tail: unknown[]): boolean { this.sent.push(message); const callback = tail.find(value => typeof value === "function") as ((error: null) => void) | undefined; callback?.(null); return true; }
    kill(): never { this.killCalls++; throw new Error("No termination is authorized in this fixture."); }
}

test("F09-JR01 an invalid raw descriptor id never becomes the safe snapshot or completion id", async () => {
    const { VaultAppJob } = await import("../vault-runtime/VaultAppJob"); let spawns = 0;
    const desc = { ...descriptor(), id: PRIVATE };
    const job = new VaultAppJob(options(desc), { spawn: (() => { spawns++; throw new Error("Unexpected spawn."); }) as unknown as typeof spawn });
    assert.equal(job.snapshot().state, "BLOCKED"); noPrivate(job.snapshot()); noPrivate(job);
    const started = await bounded(job.start(), "Invalid descriptor start did not settle.");
    const result = await bounded(job.completion, "Invalid descriptor completion did not settle.");
    assert.equal(started.state, "BLOCKED"); assert.equal(result.snapshot.state, "BLOCKED"); assert.equal(result.output.status, "WITHHELD");
    assert.equal(result.output.stdout, ""); assert.equal(result.output.stderr, ""); assert.equal(spawns, 0); noPrivate(started); noPrivate(result);
});

for (const missing of ["stdout", "stderr"] as const) {
    test(`F09-JR02-${missing} a malformed child still drains its available pipe and proves actual close before completing`, async () => {
        const { VaultAppJob } = await import("../vault-runtime/VaultAppJob"); const child = new IncompleteChild(missing), timers: { active: boolean }[] = [];
        const job = new VaultAppJob(options(), {
            spawn: (() => { queueMicrotask(() => { child.emit("spawn"); child.emit("message", { type: "READY" }); }); return child as unknown as ChildProcess; }) as unknown as typeof spawn,
            setTimer() { const timer = { active: true }; timers.push(timer); return timer; }, clearTimer(handle) { (handle as { active: boolean }).active = false; },
        });
        let settled = false; void job.completion.then(() => { settled = true; });
        const available = (missing === "stdout" ? child.stderr : child.stdout)!;
        let drained = false, earlyCompletion = false;
        try {
            const started = await bounded(job.start(), "Malformed child start did not settle."); noPrivate(started);
            available.write(PRIVATE); await tick(); drained = available.readableLength === 0; earlyCompletion = settled;
            available.end(); await tick(); assert.equal(settled, false, "Pipe EOF is not proof that the owned child closed.");
        } finally {
            if (!available.writableEnded) available.end(); await tick(); child.emit("exit", 0, null); child.emit("close", 0, null);
        }
        const result = await bounded(job.completion, "Malformed child lost its close listener and never completed.");
        assert.equal(earlyCompletion, false); assert.equal(drained, true, "An available pipe must still be drained when its sibling is missing.");
        assert.equal(result.output.status, "WITHHELD"); assert.equal(result.output.stdout, ""); assert.equal(result.output.stderr, "");
        assert.ok(["BLOCKED", "STOPPED"].includes(result.snapshot.state)); assert.equal(result.snapshot.pid, child.pid); assert.equal(child.killCalls, 0);
        assert.ok(!child.sent.some(message => (message as { type?: string })?.type === "START"), "A malformed child receives no selected values.");
        assert.ok(timers.every(timer => !timer.active), "Completion releases every owned lifecycle timer."); noPrivate(result); noPrivate(job.snapshot()); noPrivate(job);
    });
}
