import "./phase2/register.mjs";
import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import type { OutputResult } from "../../../core/src/StreamingOutputRedactor";
import { VaultDebugAdapter, VaultTaskTerminal, type VaultRunCoordinator } from "../vault-runtime/VaultSurfaces";

// F25 native sink contract: real surface/EventEmitter code with a finite
// structural job. No child, vault, filesystem, profile, environment or network.
const DESCRIPTOR = "ac39172a-2c64-43a8-b528-3497215f2501";
const JOB = "d384b426-0251-4599-9d72-63096b0f2502";
const STDOUT = "Public F25 completed stdout candidate\n";
const STDERR = "Public F25 completed stderr candidate\n";
const GUARD_ERROR = "TEST_ONLY_F25_OWNED_OUTPUT_GUARD_ERROR_407b2a9e";
type Surface = "task" | "debug";
type Snapshot = Readonly<{ id: string; state: "RUNNING" | "EXITED"; pid: number; exitCode?: number }>;
type Completion = Readonly<{ snapshot: Snapshot; output: OutputResult }>;
type Message = { type: string; event?: string; body?: Record<string, unknown> };

function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>(done => { resolve = done; });
    return { promise, resolve };
}
async function flush(): Promise<void> { for (let index = 0; index < 8; index++) await Promise.resolve(); }
const publicOutput = (exitCode = 17): OutputResult => Object.freeze({
    status: "COMPLETE", stdout: STDOUT, stderr: STDERR, redacted: false, exitCode,
});

function fakeJob(hasGuard: boolean) {
    const pending = deferred<Completion>();
    let completed = false, exitCode: number | undefined, authorized: OutputResult | undefined;
    const state = { allowed: true, throws: false, checks: [] as OutputResult[], disposals: 0, onDispose: undefined as (() => void) | undefined };
    const snapshot = (): Snapshot => Object.freeze({ id: JOB, state: completed ? "EXITED" : "RUNNING", pid: 43210,
        ...(exitCode === undefined ? {} : { exitCode }) });
    const job = {
        completion: pending.promise, snapshot,
        ...(hasGuard ? { canRelease(candidate: OutputResult): boolean {
            state.checks.push(candidate);
            if (state.throws) throw Error(GUARD_ERROR);
            return state.allowed && candidate === authorized;
        } } : {}),
        dispose(): void { state.disposals++; state.allowed = false; state.onDispose?.(); },
    };
    return { job, state, finish(output: OutputResult = publicOutput()): void {
        if (completed) return;
        completed = true; exitCode = output.exitCode ?? 1; authorized = output;
        pending.resolve(Object.freeze({ snapshot: snapshot(), output }));
    } };
}

function fixture(t: TestContext, surface: Surface, hasGuard = true) {
    const f = fakeJob(hasGuard), deliveries: string[] = [], exitCodes: number[] = [];
    const runs: string[] = [], stops: string[] = [];
    let listener: ((text: string) => void) | undefined;
    const receive = (text: string): void => { deliveries.push(text); listener?.(text); };
    const runtime = {
        async run(id: string) { runs.push(id); return f.job; },
        stop(id: string): void { stops.push(id); },
    } as unknown as VaultRunCoordinator;
    const terminal = surface === "task" ? new VaultTaskTerminal(runtime, DESCRIPTOR) : undefined;
    const adapter = surface === "debug" ? new VaultDebugAdapter(runtime, DESCRIPTOR) : undefined;
    const subscriptions = terminal ? [terminal.onDidWrite(receive), terminal.onDidClose!(code => { if (typeof code === "number") exitCodes.push(code); })]
        : [adapter!.onDidSendMessage(raw => {
            const message = raw as Message;
            if (message.type !== "event") return;
            if (message.event === "output" && typeof message.body?.output === "string") receive(message.body.output);
            if (message.event === "exited" && typeof message.body?.exitCode === "number") exitCodes.push(message.body.exitCode);
        })];
    t.after(async () => {
        listener = undefined; f.state.onDispose = undefined;
        f.finish(); await flush(); terminal?.close(); adapter?.dispose();
        for (const subscription of subscriptions) subscription.dispose();
    });
    return { ...f, runs, stops, exitCodes,
        outputs: () => deliveries.map(text => text.replace(/\r\n/g, "\n")),
        onDelivery(callback: (text: string) => void): void { listener = callback; },
        async start(): Promise<void> {
            if (terminal) terminal.open();
            else {
                adapter!.handleMessage({ seq: 1, type: "request", command: "launch", arguments: { descriptorId: DESCRIPTOR } });
                adapter!.handleMessage({ seq: 2, type: "request", command: "configurationDone" });
            }
            await flush();
            assert.equal(runs.length === 1 && runs[0] === DESCRIPTOR, true, "The surface must acquire exactly its saved job.");
            assert.equal(deliveries.length === 0 && exitCodes.length === 0, true, "Uncompleted output must remain private.");
        },
    };
}
type Fixture = ReturnType<typeof fixture>;
const contains = (f: Fixture, value: string): boolean => f.outputs().some(text => text.includes(value));
function noCandidates(f: Fixture): void {
    assert.equal(contains(f, STDOUT) || contains(f, STDERR), false, "Withdrawn or unauthenticated candidates must not reach a native sink.");
    assert.equal(contains(f, GUARD_ERROR), false, "An authority exception must not become native output.");
}

test("F25-O01 useful completed public task and lifecycle output preserves both channels and actual nonzero exit", async t => {
    const fixtures = [fixture(t, "task"), fixture(t, "debug")]; await Promise.all(fixtures.map(f => f.start()));
    for (const f of fixtures) f.finish(publicOutput(23)); await flush();
    for (const f of fixtures) {
        assert.equal(contains(f, STDOUT) && contains(f, STDERR), true, "Current public output must remain useful on both channels.");
        assert.equal(f.exitCodes.length === 1 && f.exitCodes[0] === 23, true, "Output filtering must retain actual job exit status.");
        assert.equal(f.stops.length === 0, true, "Completed delivery must not request a process stop.");
    }
});

test("F25-O02 authority withdrawn after COMPLETE but before the await continuation suppresses both native sinks", async t => {
    const fixtures = [fixture(t, "task"), fixture(t, "debug")]; await Promise.all(fixtures.map(f => f.start()));
    for (const f of fixtures) { f.finish(publicOutput(19)); f.state.allowed = false; } await flush();
    for (const f of fixtures) {
        noCandidates(f);
        assert.equal(f.exitCodes.length === 1 && f.exitCodes[0] === 19, true, "A withheld completion must still finish its owned lifecycle.");
    }
});

test("F25-O03 task withdrawal from the stdout listener prevents the following stderr write", async t => {
    const f = fixture(t, "task"); await f.start();
    f.onDelivery(text => { if (text.replace(/\r\n/g, "\n").includes(STDOUT)) f.state.allowed = false; });
    f.finish(); await flush();
    assert.equal(contains(f, STDOUT), true, "The initially authorized stdout delivery must remain useful.");
    assert.equal(contains(f, STDERR), false, "Task authority must be rechecked after synchronous stdout listeners run.");
    assert.equal(f.exitCodes.length === 1, true, "Withdrawal between channels must not strand completion.");
});

test("F25-O04 lifecycle withdrawal from the stdout event listener prevents the following stderr event", async t => {
    const f = fixture(t, "debug"); await f.start();
    f.onDelivery(text => { if (text.includes(STDOUT)) f.state.allowed = false; });
    f.finish(); await flush();
    assert.equal(contains(f, STDOUT), true, "The initially authorized DAP stdout event must remain useful.");
    assert.equal(contains(f, STDERR), false, "DAP authority must be rechecked after synchronous stdout listeners run.");
    assert.equal(f.exitCodes.length === 1, true, "Withdrawal between DAP events must not strand completion.");
});

test("F25-O05 throwing final release guards withhold candidate output and exception text", async t => {
    const fixtures = [fixture(t, "task"), fixture(t, "debug")]; await Promise.all(fixtures.map(f => f.start()));
    for (const f of fixtures) { f.state.throws = true; f.finish(); } await flush();
    for (const f of fixtures) {
        noCandidates(f);
        assert.equal(f.exitCodes.length === 1, true, "A guard failure must still finish the already completed job.");
    }
});

test("F25-O06 a completed structural job without a release guard fails closed at both native sinks", async t => {
    const fixtures = [fixture(t, "task", false), fixture(t, "debug", false)]; await Promise.all(fixtures.map(f => f.start()));
    for (const f of fixtures) f.finish(); await flush();
    for (const f of fixtures) {
        noCandidates(f);
        assert.equal(f.exitCodes.length === 1, true, "Missing authority must not prevent lifecycle completion.");
    }
});

test("F25-O07 each native release check receives the exact completed output capability", async t => {
    const fixtures = [fixture(t, "task"), fixture(t, "debug")], output = publicOutput();
    await Promise.all(fixtures.map(f => f.start())); for (const f of fixtures) f.finish(output); await flush();
    for (const f of fixtures) {
        assert.equal(f.state.checks.length > 0, true, "A COMPLETE label must not bypass final output authority.");
        assert.equal(f.state.checks.every(candidate => candidate === output), true, "Clones, snapshots and completion envelopes are not the output capability.");
        assert.equal(contains(f, STDOUT) && contains(f, STDERR), true, "The exact current output capability must authorize useful delivery.");
    }
});

test("F25-O08 completed jobs release collector authority exactly once after native delivery", async t => {
    const fixtures = [fixture(t, "task"), fixture(t, "debug")], observations = fixtures.map(() => ({ deliveredBeforeDisposal: false, disposedDuringDelivery: false }));
    await Promise.all(fixtures.map(f => f.start()));
    for (const [index, f] of fixtures.entries()) {
        f.onDelivery(() => { if (f.state.disposals !== 0) observations[index].disposedDuringDelivery = true; });
        f.state.onDispose = () => { observations[index].deliveredBeforeDisposal = contains(f, STDOUT) && contains(f, STDERR); };
        f.finish();
    }
    await flush();
    for (const [index, f] of fixtures.entries()) {
        assert.equal(observations[index].disposedDuringDelivery, false, "The current collector must survive all authorized synchronous deliveries.");
        assert.equal(f.state.disposals === 1, true, "Finished native surfaces must dispose retained job authority exactly once.");
        assert.equal(observations[index].deliveredBeforeDisposal, true, "Disposal must follow useful native delivery.");
    }
});
