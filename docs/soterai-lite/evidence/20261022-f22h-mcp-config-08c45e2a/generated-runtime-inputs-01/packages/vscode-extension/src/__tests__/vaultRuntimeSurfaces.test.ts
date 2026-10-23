import "./phase2/register.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";
import type { OutputResult } from "../../../core/src/StreamingOutputRedactor";

// Design05 surfaces only: actual VS Code stub EventEmitter plumbing, structural
// coordinator and finite deferred jobs. No process, vault, profile or file IO.
const DESCRIPTOR = "8823e891-d8c8-4ce4-b22a-745235d76850";
const JOB = "e546d0f6-21b0-4d13-96b9-0b69ef831eab";
const PRIVATE = "synthetic-f09-surface-private-value-Z6";
const MASK = "[REDACTED_SECRET_OUTPUT]";
type Message = { seq?: number; type: string; command?: string; request_seq?: number; success?: boolean; event?: string; body?: Record<string, unknown>; arguments?: Record<string, unknown>; [key: string]: unknown };
type Snapshot = { id: string; state: string; pid?: number; exitCode?: number };
const tick = async () => { await new Promise<void>(done => setImmediate(done)); };
const flush = async () => { await tick(); await tick(); };
function deferred<T>() { let resolve!: (value: T) => void, reject!: (error: unknown) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
function safe(value: unknown): void { assert.ok(!JSON.stringify(value).includes(PRIVATE), "Native surface messages must exclude private values and exception text."); }
function fakeJob() {
    const pending = deferred<{ snapshot: Snapshot; output: OutputResult }>(); let state = "RUNNING", exitCode: number | undefined;
    let stopped = 0, cancelled = 0, completed = false;
    return { completion: pending.promise, snapshot: (): Readonly<Snapshot> => Object.freeze({ id: JOB, state, pid: 32145, ...(exitCode === undefined ? {} : { exitCode }) }),
        requestStop() { stopped++; state = "STOP_REQUESTED"; }, cancel() { cancelled++; state = "STOP_REQUESTED"; }, dispose() { cancelled++; state = "STOP_REQUESTED"; },
        get stops() { return stopped + cancelled; }, unconfirmed() { state = "STOP_UNCONFIRMED"; },
        finish(output: OutputResult = { status: "COMPLETE", stdout: "public output\n", stderr: "", redacted: false, exitCode: 0 }, code = output.exitCode ?? 0) {
            if (completed) return; completed = true; state = stopped || cancelled ? "STOPPED" : "EXITED"; exitCode = code;
            pending.resolve(Object.freeze({ snapshot: this.snapshot(), output: Object.freeze(output) }));
        } };
}
type FakeJob = ReturnType<typeof fakeJob>;
function coordinator(mode: "immediate" | "held" | "throws" = "immediate") {
    const job = fakeJob(), pending = deferred<FakeJob | undefined>(), runs: { id: string; signal?: AbortSignal }[] = [], stops: string[] = [];
    const runtime = { async run(id: string, signal?: AbortSignal) { runs.push({ id, signal }); if (mode === "throws") throw new Error(PRIVATE); return mode === "held" ? pending.promise : job; },
        stop(id: string) { stops.push(id); if (id === JOB) job.requestStop(); } };
    return { runtime, job, pending, runs, stops, requestedStop: () => job.stops > 0 || stops.includes(JOB) || runs.some(call => call.signal?.aborted) };
}
async function terminal(mode: "immediate" | "held" | "throws" = "immediate") {
    const module = await import("../vault-runtime/VaultSurfaces"), f = coordinator(mode), writes: string[] = [], closes: (number | void)[] = [];
    const instance = new module.VaultTaskTerminal(f.runtime as unknown as ConstructorParameters<typeof module.VaultTaskTerminal>[0], DESCRIPTOR);
    const a = instance.onDidWrite(text => writes.push(text)), b = instance.onDidClose!(code => closes.push(code));
    return { ...f, instance, writes, closes, async cleanup() { f.job.finish(); f.pending.resolve(undefined); await flush(); instance.close(); a.dispose(); b.dispose(); } };
}
async function adapter(mode: "immediate" | "held" | "throws" = "immediate") {
    const module = await import("../vault-runtime/VaultSurfaces"), f = coordinator(mode), messages: Message[] = [];
    const instance = new module.VaultDebugAdapter(f.runtime as unknown as ConstructorParameters<typeof module.VaultDebugAdapter>[0], DESCRIPTOR);
    const listener = instance.onDidSendMessage(message => messages.push(message as Message)); let seq = 0;
    const send = (command: string, args?: Record<string, unknown>) => { const request = { seq: ++seq, type: "request", command, ...(args ? { arguments: args } : {}) }; instance.handleMessage(request); return request.seq; };
    return { ...f, instance, messages, send, response: (request: number) => messages.find(message => message.type === "response" && message.request_seq === request),
        async launch() { send("launch", { descriptorId: DESCRIPTOR }); send("configurationDone"); await flush(); },
        async cleanup() { f.job.finish(); f.pending.resolve(undefined); await flush(); instance.dispose(); listener.dispose(); } };
}
const outputEvents = (messages: readonly Message[]) => messages.filter(message => message.type === "event" && message.event === "output");
const exits = (messages: readonly Message[]) => messages.filter(message => message.type === "event" && ["exited", "terminated"].includes(message.event ?? ""));

test("F09-S01 task open is single-use and releases only completed sanitized output", async t => {
    const f = await terminal(); t.after(() => f.cleanup()); f.instance.open(); f.instance.open(); await flush();
    assert.equal(f.runs.length, 1); assert.equal(f.runs[0].id, DESCRIPTOR); assert.equal(f.writes.length, 0); assert.equal(f.closes.length, 0);
    f.job.finish({ status: "COMPLETE", stdout: MASK, stderr: "", redacted: true, exitCode: 0 }); await flush();
    assert.ok(f.writes.join("").includes(MASK)); assert.deepEqual(f.closes, [0]); safe(f.writes); f.instance.open(); await flush(); assert.equal(f.runs.length, 1);
});

test("F09-S02 task close aborts held approval and no-job cancellation closes once after approval settles", async t => {
    const f = await terminal("held"); t.after(() => f.cleanup()); f.instance.open(); await flush(); assert.equal(f.runs.length, 1);
    f.instance.close(); assert.equal(f.runs[0].signal?.aborted, true); assert.equal(f.closes.length, 0); assert.equal(f.writes.length, 0);
    f.pending.resolve(undefined); await flush(); assert.equal(f.closes.length, 1); safe(f.writes); safe(f.closes);
});

test("F09-S03 task close requests cooperative stop and waits for real completion before nonzero close", async t => {
    const f = await terminal(); t.after(() => f.cleanup()); f.instance.open(); await flush(); f.instance.close(); await flush();
    assert.equal(f.requestedStop(), true); assert.ok(f.stops.every(id => id === JOB)); assert.equal(f.closes.length, 0); assert.equal(f.writes.length, 0);
    f.job.finish({ status: "WITHHELD", stdout: "", stderr: "", redacted: false, reason: "cancelled" }, 17); await flush();
    assert.deepEqual(f.closes, [17]); safe(f.writes); safe(f.closes);
});

test("F09-S04 task preserves finalized public Unicode and both output channels with a nonzero result", async t => {
    const f = await terminal(); t.after(() => f.cleanup()); f.instance.open(); await flush();
    f.job.finish({ status: "COMPLETE", stdout: "public caf\u00e9 \u96ea\n", stderr: "ordinary warning\n", redacted: false, exitCode: 9 }); await flush();
    const text = f.writes.join("").replace(/\r\n/g, "\n"); assert.ok(text.includes("public caf\u00e9 \u96ea\n")); assert.ok(text.includes("ordinary warning\n")); assert.deepEqual(f.closes, [9]); safe(f.writes);
});

test("F09-S05 withheld completion supplies no stdout or stderr fallback to a task", async t => {
    const f = await terminal(); t.after(() => f.cleanup()); f.instance.open(); await flush();
    f.job.finish({ status: "WITHHELD", stdout: "", stderr: "", redacted: false, reason: "managed_application_withheld" }); await flush();
    assert.equal(f.closes.length, 1); safe(f.writes); assert.ok(!f.writes.join("").includes("undefined"));
});

test("F09-S06 unconfirmed cooperative task stop emits a constant waiting notice without false close", { timeout: 2500 }, async t => {
    const f = await terminal(); t.after(() => f.cleanup()); f.instance.open(); await flush(); f.instance.close(); f.job.unconfirmed();
    await new Promise<void>(done => setTimeout(done, 1150)); assert.equal(f.closes.length, 0); assert.ok(f.writes.join("").length > 0);
    assert.match(f.writes.join(""), /waiting|STOP_UNCONFIRMED|still running|stop pending/i); safe(f.writes);
    f.job.finish({ status: "WITHHELD", stdout: "", stderr: "", redacted: false }); await flush(); assert.equal(f.closes.length, 1);
});

test("F09-S07 debug initialize declares only lifecycle capabilities and emits initialized", async t => {
    const f = await adapter(); t.after(() => f.cleanup()); const request = f.send("initialize", { clientID: "synthetic-f09" }); await flush();
    const response = f.response(request); assert.equal(response?.success, true); assert.equal(response?.body?.supportsConfigurationDoneRequest, true); assert.equal(response?.body?.supportsTerminateRequest, true);
    for (const name of ["supportsEvaluateForHovers", "supportsSetVariable", "supportsReadMemoryRequest", "supportsWriteMemoryRequest", "supportsFunctionBreakpoints", "supportsDataBreakpoints", "supportsInstructionBreakpoints", "supportsSteppingGranularity"]) assert.notEqual(response?.body?.[name], true, name);
    assert.ok(f.messages.some(message => message.type === "event" && message.event === "initialized")); assert.equal(f.runs.length, 0); safe(f.messages);
});

test("F09-S08 debug launch and configurationDone start once in either order and hold output until completion", async t => {
    const f = await adapter(); t.after(() => f.cleanup()); f.send("configurationDone"); await flush(); assert.equal(f.runs.length, 0);
    const launch = f.send("launch", { descriptorId: DESCRIPTOR, type: "soterai-vault", request: "launch", name: "Synthetic lifecycle app", noDebug: true }); await flush();
    assert.equal(f.response(launch)?.success, true); assert.equal(f.runs.length, 1); assert.equal(f.runs[0].id, DESCRIPTOR);
    f.send("configurationDone"); f.send("launch", { descriptorId: DESCRIPTOR }); await flush(); assert.equal(f.runs.length, 1);
    assert.equal(outputEvents(f.messages).length, 0); assert.equal(exits(f.messages).length, 0);
    f.job.finish({ status: "COMPLETE", stdout: MASK, stderr: "public warning\n", redacted: true, exitCode: 6 }); await flush();
    assert.ok(outputEvents(f.messages).some(message => message.body?.output === MASK)); assert.ok(outputEvents(f.messages).some(message => message.body?.output === "public warning\n"));
    assert.equal(f.messages.filter(message => message.event === "exited").length, 1); assert.equal(f.messages.find(message => message.event === "exited")?.body?.exitCode, 6);
    assert.equal(f.messages.filter(message => message.event === "terminated").length, 1); safe(f.messages);
});

test("F09-S09 debug launch rejects execution overrides, unknown keys and a different descriptor", async t => {
    for (const args of [{ descriptorId: DESCRIPTOR, env: { DB_URL: PRIVATE } }, { descriptorId: DESCRIPTOR, program: PRIVATE }, { descriptorId: DESCRIPTOR, args: [PRIVATE] }, { descriptorId: "different-descriptor" }, { descriptorId: DESCRIPTOR, extra: PRIVATE }]) {
        const f = await adapter(); t.after(() => f.cleanup()); const request = f.send("launch", args); f.send("configurationDone"); await flush();
        assert.equal(f.response(request)?.success, false); assert.equal(f.runs.length, 0); safe(f.messages);
    }
});

test("F09-S10 unsupported source debugging, evaluation, memory and mutation requests fail safely", async t => {
    const f = await adapter(); t.after(() => f.cleanup());
    for (const command of ["setBreakpoints", "setFunctionBreakpoints", "stackTrace", "scopes", "variables", "evaluate", "readMemory", "writeMemory", "setVariable", "continue", "next", "stepIn", "source"]) {
        const request = f.send(command, { expression: PRIVATE, value: PRIVATE }); await flush(); assert.equal(f.response(request)?.success, false, command);
    }
    assert.equal(f.runs.length, 0); assert.equal(outputEvents(f.messages).length, 0); safe(f.messages);
});

test("F09-S11 debug terminate acknowledgement cannot imply exited before actual job completion", async t => {
    const f = await adapter(); t.after(() => f.cleanup()); await f.launch(); const request = f.send("terminate"); await flush();
    assert.equal(f.response(request)?.success, true); assert.equal(f.requestedStop(), true); assert.equal(exits(f.messages).length, 0); assert.equal(outputEvents(f.messages).length, 0);
    f.job.finish({ status: "WITHHELD", stdout: "", stderr: "", redacted: false }, 0); await flush();
    assert.equal(f.messages.filter(message => message.event === "exited").length, 1); assert.equal(f.messages.filter(message => message.event === "terminated").length, 1); safe(f.messages);
});

test("F09-S12 debug disconnect acknowledges cooperative stop and retains ownership until completion", async t => {
    const f = await adapter(); t.after(() => f.cleanup()); await f.launch(); const request = f.send("disconnect", { terminateDebuggee: true }); await flush();
    assert.equal(f.response(request)?.success, true); assert.equal(f.requestedStop(), true); assert.ok(f.stops.every(id => id === JOB)); assert.equal(exits(f.messages).length, 0);
    f.job.finish({ status: "WITHHELD", stdout: "", stderr: "", redacted: false }); await flush(); assert.equal(f.messages.filter(message => message.event === "terminated").length, 1); safe(f.messages);
});

test("F09-S13 debug disposal aborts held approval and stops a late owned job without publishing output", async t => {
    const f = await adapter("held"); t.after(() => f.cleanup()); await f.launch(); assert.equal(f.runs.length, 1); f.instance.dispose();
    assert.equal(f.runs[0].signal?.aborted, true); const count = f.messages.length; f.pending.resolve(f.job); await flush();
    assert.ok(f.job.stops > 0 || f.stops.includes(JOB), "Disposal must also stop a late returned owned job."); assert.equal(outputEvents(f.messages).length, 0); assert.equal(exits(f.messages).length, 0);
    f.job.finish({ status: "WITHHELD", stdout: "", stderr: "", redacted: false }); await flush(); assert.equal(f.messages.length, count); safe(f.messages);
});

test("F09-S14 failed no-child launches complete task/debug lifecycles with constant safe errors", async t => {
    const task = await terminal("throws"), debug = await adapter("throws"); t.after(() => task.cleanup()); t.after(() => debug.cleanup());
    task.instance.open(); await debug.launch(); await flush(); assert.equal(task.runs.length, 1); assert.equal(task.closes.length, 1);
    assert.equal(debug.runs.length, 1); assert.equal(debug.messages.filter(message => message.event === "terminated").length, 1);
    safe(task.writes); safe(debug.messages); assert.equal(outputEvents(debug.messages).some(message => String(message.body?.output).includes(PRIVATE)), false);
});
