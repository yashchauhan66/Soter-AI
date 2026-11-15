import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

// F26a TEST-FIRST owner projection orchestration. Retained manual synthetic
// metadata plus fake workers only. No actual Git/config query/child executes.
const CONFIG = "[core]\n repositoryformatversion = 0\n bare = false\n", VERSION = Buffer.from("git version 2.53.0.windows.1\n");
const PRIVATE = "TEST_ONLY_F26A_DISCOVERY_PRIVATE_4d083cb1";
const options = { skip: process.platform !== "win32", timeout: 10000 };
type Context = Readonly<{ root: string; metadata: Readonly<{ executable: string; job: string; environment: NodeJS.ProcessEnv; available(): boolean }>;
    environment: Readonly<NodeJS.ProcessEnv>; available(): boolean }>;
type Outcome = Readonly<{ status: "COMPLETE"; bytes: Buffer } | { status: "UNAVAILABLE" | "STOP_UNCONFIRMED" }>;
type Result = Readonly<{ status: "COMPLETE"; hooksRelative: string; fingerprint: string } | { status: "UNAVAILABLE" | "STOP_UNCONFIRMED" }>;
interface ProcessOptions { context: Context; operation: "version" | "config"; valid: () => boolean; deadline: number; now?: () => number }
interface Worker { start(): Promise<Outcome>; readonly closed: Promise<void>; readonly busy: boolean; withdraw(): void }
interface Options { context: Context; valid: () => boolean; deadline: number; now?: () => number; createProcess?: (options: ProcessOptions) => Worker }
interface Discovery { start(): Promise<Result>; readonly closed: Promise<void>; readonly busy: boolean; withdraw(): void; canRelease(value: Result): boolean }
type Constructor = new (options: Options) => Discovery;
const tick = async () => { await new Promise<void>(done => setImmediate(done)); };
async function until(predicate: () => boolean): Promise<void> { for (let count = 0; count < 60 && !predicate(); count++) await tick(); assert.ok(predicate(), "finite fake transition must be observable"); }
const record = (path = ".synthetic-hooks", origin = "file:.git/config", scope = "local", key = "core.hookspath"): Buffer =>
    Buffer.from(scope + "\0" + origin + "\0" + key + "\n" + path + "\0");
async function genuineContext(): Promise<Context> {
    const root = await mkdtemp(join(tmpdir(), "soter-f26a-discovery-"));
    for (const name of ["objects/info", "objects/pack", "refs/heads"]) await mkdir(join(root, ".git", ...name.split("/")), { recursive: true });
    await writeFile(join(root, ".git", "config"), CONFIG, { flag: "wx" }); await writeFile(join(root, ".git", "HEAD"), "ref: refs/heads/main\n", { flag: "wx" });
    const header = Buffer.alloc(12); header.write("DIRC"); header.writeUInt32BE(2, 4);
    await writeFile(join(root, ".git", "index"), Buffer.concat([header, createHash("sha1").update(header).digest()]), { flag: "wx" });
    const source = "../history-hooks/CheckedOwnerHookContext", module = await import(source) as {
        prepareCheckedOwnerHookContext(root: string, ambient: NodeJS.ProcessEnv, enabled: () => boolean): Promise<Context | undefined> };
    const value = await module.prepareCheckedOwnerHookContext(root, { HOME: join(root, "synthetic-profile"), GIT_CONFIG_GLOBAL: join(root, "synthetic-global"),
        GIT_CONFIG_SYSTEM: join(root, "synthetic-system"), GIT_CONFIG_NOSYSTEM: "1", SystemRoot: "C:\\Windows", PATH: PRIVATE, NODE_OPTIONS: PRIVATE }, () => true);
    assert.ok(value); return value;
}
class FakeWorker implements Worker {
    readonly closed: Promise<void>; private resolveClose!: () => void; private resolveOutcome!: (value: Outcome) => void;
    private readonly result: Promise<Outcome>; private active = false; private ended = false; private replied = false;
    starts = 0; withdrawals = 0; killCalls = 0; destroyCalls = 0;
    constructor(readonly request: ProcessOptions, readonly held: Outcome, readonly auto: boolean, readonly afterFinish?: (worker: FakeWorker) => void) {
        this.closed = new Promise(done => this.resolveClose = done); this.result = new Promise(done => this.resolveOutcome = done);
    }
    get busy(): boolean { return this.active; }
    private reply(value: Outcome): void { if (!this.replied) { this.replied = true; this.resolveOutcome(value); } }
    start(): Promise<Outcome> { this.starts++; this.active = true; if (this.auto) queueMicrotask(() => this.finish()); return this.result; }
    completeBeforeClose(): void { this.reply(this.held); }
    finish(): void { if (this.ended) return; this.ended = true; this.active = false; this.afterFinish?.(this); this.reply(this.held); this.resolveClose(); }
    withdraw(): void { this.withdrawals++; if (this.active) this.reply(Object.freeze({ status: "STOP_UNCONFIRMED" })); }
    kill(): never { this.killCalls++; throw Error("Signals forbidden."); }
    destroy(): never { this.destroyCalls++; throw Error("Forced closure forbidden."); }
}
interface Settings {
    context?: Context; overrides?: Partial<Options>; valid?: () => boolean; deadline?: number; now?: () => number;
    projection?: Buffer; version?: Buffer; hold?: "version" | "config";
    outcome?: (request: ProcessOptions, expected: Outcome) => Outcome;
    afterFinish?: (worker: FakeWorker) => void; throwFactory?: boolean;
}
async function fixture(settings: Settings = {}) {
    const source = "../history-hooks/OwnerHookDiscovery", module = await import(source) as { OwnerHookDiscovery?: Constructor };
    assert.equal(typeof module.OwnerHookDiscovery, "function"); const owner = settings.context ?? await genuineContext(), processes: FakeWorker[] = [];
    const createProcess = (request: ProcessOptions): Worker => {
        if (settings.throwFactory) throw Error(PRIVATE);
        const expected: Outcome = Object.freeze({ status: "COMPLETE", bytes: Buffer.from(request.operation === "version" ? settings.version ?? VERSION : settings.projection ?? Buffer.alloc(0)) });
        const child = new FakeWorker(request, settings.outcome?.(request, expected) ?? expected, request.operation !== settings.hold, settings.afterFinish);
        processes.push(child); return child;
    };
    const Factory = module.OwnerHookDiscovery as Constructor;
    const discovery = new Factory({ context: owner, valid: settings.valid ?? (() => true), deadline: settings.deadline ?? 61000,
        now: settings.now ?? (() => 1000), createProcess, ...settings.overrides });
    let settled = false, closed = false; void discovery.closed.then(() => { closed = true; });
    return { owner, processes, discovery, get settled() { return settled; }, get closed() { return closed; },
        start() { return discovery.start().then(result => { settled = true; return result; }); },
        noActions() { for (const process of processes) { assert.equal(process.killCalls, 0); assert.equal(process.destroyCalls, 0); assert.equal(process.starts, 1); } } };
}
function complete(value: Result, relative: string): asserts value is Extract<Result, { status: "COMPLETE" }> {
    assert.equal(value.status, "COMPLETE"); assert.ok(Object.isFrozen(value));
    assert.deepEqual(Object.keys(value).sort(), ["fingerprint", "hooksRelative", "status"]);
    if (value.status === "COMPLETE") { assert.equal(value.hooksRelative, relative); assert.match(value.fingerprint, /^[a-f0-9]{64}$/); }
    assert.ok(!JSON.stringify(value).includes(PRIVATE)); assert.ok(!JSON.stringify(value).includes("file:")); assert.ok(!JSON.stringify(value).includes("core.hookspath"));
}
function unavailable(value: Result, status?: "UNAVAILABLE" | "STOP_UNCONFIRMED"): void {
    assert.notEqual(value.status, "COMPLETE"); if (status) assert.equal(value.status, status); assert.ok(Object.isFrozen(value)); assert.deepEqual(Object.keys(value), ["status"]);
    assert.ok(!JSON.stringify(value).includes(PRIVATE));
}

test("F26a discovery rejects disabled and forged contexts before properties or any worker", options, async () => {
    const owner = await genuineContext(); let traps = 0;
    const accessor = { get available() { traps++; throw Error(PRIVATE); } }, proxy = new Proxy(owner, { get() { traps++; throw Error(PRIVATE); } });
    for (const value of [undefined, null, { ...owner }, owner.metadata, accessor, proxy]) {
        const f = await fixture({ context: owner, overrides: { context: value as Context } }); unavailable(await f.start()); await f.discovery.closed; assert.equal(f.processes.length, 0); f.noActions();
    }
    const disabled = await fixture({ context: owner, valid: () => false }); unavailable(await disabled.start()); await disabled.discovery.closed; assert.equal(disabled.processes.length, 0); assert.equal(traps, 0);
});

test("F26a discovery admits useful public default and supported local custom selections", options, async () => {
    for (const [projection, expected] of [[Buffer.alloc(0), ".git/hooks"], [record(".git/custom-hooks"), ".git/custom-hooks"]] as const) {
        const f = await fixture({ projection }), value = await f.start(); complete(value, expected); await f.discovery.closed;
        assert.equal(f.discovery.busy, false); assert.equal(f.discovery.canRelease(value), true); assert.deepEqual(f.processes.map(p => p.request.operation), ["version", "config"]); f.noActions();
    }
});

test("F26a discovery withholds complete projections containing unsupported scopes includes duplicates or malformed data", options, async () => {
    const owner = await genuineContext();
    for (const projection of [record(".hooks", "file:.git/config", "global"), record(PRIVATE, "file:.git/config", "local", "include.path"),
        record(PRIVATE, "file:.git/config", "local", "includeif.onbranch:main.path"), Buffer.concat([record(), record()]), record().subarray(0, -1), Buffer.from([0xff])]) {
        const f = await fixture({ context: owner, projection }); unavailable(await f.start()); await f.discovery.closed; assert.equal(f.processes.length, 2); f.noActions();
    }
});

test("F26a discovery verifies exact pinned version before creating a config query", options, async () => {
    const owner = await genuineContext(); for (const version of [Buffer.alloc(0), Buffer.from("git version 2.53.1.windows.1\n"), Buffer.from(VERSION.toString() + "trailing"), Buffer.from(PRIVATE)]) {
        const f = await fixture({ context: owner, version }); unavailable(await f.start()); await f.discovery.closed; assert.deepEqual(f.processes.map(p => p.request.operation), ["version"]); f.noActions();
    }
});

test("F26a discovery delegates only sequential version and config with the same context deadline and clock", options, async () => {
    let clock = 1000; const now = () => clock;
    const f = await fixture({ now, deadline: 999999, afterFinish: worker => { if (worker.request.operation === "version") clock = 12000; } });
    complete(await f.start(), ".git/hooks"); await f.discovery.closed; assert.equal(f.processes.length, 2);
    for (const process of f.processes) { assert.equal(process.request.context, f.owner); assert.equal(process.request.deadline, 61000); assert.equal(process.request.now, now); assert.equal(process.request.valid(), true); }
    assert.deepEqual(f.processes.map(p => p.request.operation), ["version", "config"]); assert.equal(f.owner.environment.GIT_CONFIG_GLOBAL?.includes("synthetic-global"), true); f.noActions();
});

test("F26a discovery fingerprint is stable for exact root projection and changes for path raw origin or root", options, async () => {
    const owner = await genuineContext(), first = await fixture({ context: owner, projection: record(".hooks") }), again = await fixture({ context: owner, projection: record(".hooks") });
    const a = await first.start(), b = await again.start(); complete(a, ".hooks"); complete(b, ".hooks"); assert.equal(a.fingerprint, b.fingerprint);
    const changed = await fixture({ context: owner, projection: record(".other-hooks") }), c = await changed.start(); complete(c, ".other-hooks"); assert.notEqual(c.fingerprint, a.fingerprint);
    const origin = await fixture({ context: owner, projection: record(".hooks", "file:" + owner.root + "\\.git\\config") }), d = await origin.start(); complete(d, ".hooks"); assert.notEqual(d.fingerprint, a.fingerprint);
    const elsewhere = await fixture({ projection: record(".hooks") }), e = await elsewhere.start(); complete(e, ".hooks"); assert.notEqual(e.fingerprint, a.fingerprint);
    for (const f of [first, again, changed, origin, elsewhere]) { await f.discovery.closed; f.noActions(); }
});

test("F26a discovery premature worker COMPLETE cannot advance or release before owned closure", options, async () => {
    for (const hold of ["version", "config"] as const) {
        const f = await fixture({ hold }), result = f.start(); await until(() => f.processes.some(p => p.request.operation === hold && p.starts === 1));
        const child = f.processes.find(p => p.request.operation === hold)!; child.completeBeforeClose(); await tick();
        assert.equal(f.settled, false); assert.equal(f.closed, false); assert.equal(f.discovery.busy, true); assert.equal(f.processes.length, hold === "version" ? 1 : 2);
        assert.equal(f.discovery.canRelease(Object.freeze({ status: "COMPLETE", hooksRelative: ".git/hooks", fingerprint: "a".repeat(64) })), false);
        child.finish(); const value = await result; complete(value, ".git/hooks"); await f.discovery.closed; f.noActions();
    }
});

test("F26a discovery active withdrawal returns STOP and retains busy until the held worker naturally closes", options, async () => {
    const f = await fixture({ hold: "config" }), result = f.start(); await until(() => f.processes.length === 2 && f.processes[1].starts === 1);
    f.discovery.withdraw(); unavailable(await result, "STOP_UNCONFIRMED"); assert.equal(f.discovery.busy, true); assert.equal(f.closed, false); assert.ok(f.processes[1].withdrawals >= 1);
    f.processes[1].finish(); await f.discovery.closed; assert.equal(f.discovery.busy, false); unavailable(await f.discovery.start()); f.noActions();
});

test("F26a discovery is one shot and pre-start withdrawal creates no worker", options, async () => {
    const f = await fixture(); f.discovery.withdraw(); unavailable(await f.start()); unavailable(await f.discovery.start()); await f.discovery.closed; assert.equal(f.processes.length, 0);
    const current = await fixture(), value = await current.start(); complete(value, ".git/hooks"); unavailable(await current.discovery.start()); assert.equal(current.processes.length, 2); current.noActions();
});

test("F26a discovery final release requires exact result identity and sticky live nonreentrant authority", options, async () => {
    let enabled = true; const f = await fixture({ valid: () => enabled }), value = await f.start(); complete(value, ".git/hooks"); await f.discovery.closed;
    assert.equal(f.discovery.canRelease(value), true); assert.equal(f.discovery.canRelease({ ...value }), false);
    let traps = 0; const proxy = new Proxy(value, { get() { traps++; throw Error(PRIVATE); } }); assert.equal(f.discovery.canRelease(proxy), false); assert.equal(traps, 0);
    enabled = false; assert.equal(f.discovery.canRelease(value), false); enabled = true; assert.equal(f.discovery.canRelease(value), false); f.noActions();
    const drift = await fixture(), old = await drift.start(); complete(old, ".git/hooks"); await drift.discovery.closed;
    await writeFile(join(drift.owner.root, ".git", "config"), CONFIG + "[core]\n hooksPath = .changed\n"); assert.equal(drift.discovery.canRelease(old), false);
    await writeFile(join(drift.owner.root, ".git", "config"), CONFIG); assert.equal(drift.discovery.canRelease(old), false); drift.noActions();
    for (const kind of ["withdraw", "elapsed"]) {
        let clock = 1000, armed = false, discovery: Discovery | undefined;
        const callback = await fixture({ now: () => clock, valid: () => { if (armed) { if (kind === "withdraw") discovery!.withdraw(); else clock = 61000; } return true; } });
        discovery = callback.discovery; const held = await callback.start(); complete(held, ".git/hooks"); await discovery.closed; armed = true; assert.equal(discovery.canRelease(held), false); callback.noActions();
    }
});

test("F26a discovery enforces one aggregate deadline bad-clock refusal and independent phase caps", options, async () => {
    const owner = await genuineContext();
    for (const deadline of [1000, 999, Number.NaN, Number.POSITIVE_INFINITY]) { const f = await fixture({ context: owner, deadline }); unavailable(await f.start()); await f.discovery.closed; assert.equal(f.processes.length, 0); }
    for (const clock of [Number.NaN, Number.POSITIVE_INFINITY]) { const f = await fixture({ context: owner, now: () => clock }); unavailable(await f.start()); await f.discovery.closed; assert.equal(f.processes.length, 0); }
    for (const after of [61000, 999, Number.NaN, Number.POSITIVE_INFINITY]) {
        let clock = 1000; const f = await fixture({ context: owner, deadline: 999999, now: () => clock, afterFinish: worker => { if (worker.request.operation === "config") clock = after; } });
        unavailable(await f.start()); await f.discovery.closed; assert.ok(f.processes.every(p => p.request.deadline === 61000)); f.noActions();
    }
    for (const phase of ["version", "config"] as const) {
        const f = await fixture({ context: owner, outcome: (request, expected) => request.operation === phase ? Object.freeze({ status: "COMPLETE", bytes: Buffer.alloc(phase === "version" ? 4097 : 65537, 0x61) }) : expected });
        unavailable(await f.start()); await f.discovery.closed; f.noActions();
    }
});

test("F26a discovery propagates closed transport refusal without accepting a partial projection", options, async () => {
    const owner = await genuineContext(); for (const phase of ["version", "config"] as const) for (const status of ["UNAVAILABLE", "STOP_UNCONFIRMED"] as const) {
        const f = await fixture({ context: owner, outcome: (request, expected) => request.operation === phase ? Object.freeze({ status }) : expected });
        unavailable(await f.start()); await f.discovery.closed; assert.equal(f.discovery.busy, false); assert.equal(f.processes.length, phase === "version" ? 1 : 2); f.noActions();
    }
    const malformed = await fixture({ context: owner, outcome: (request, expected) => request.operation === "config" ? Object.freeze({ status: "COMPLETE", bytes: PRIVATE as unknown as Buffer }) : expected });
    unavailable(await malformed.start()); await malformed.discovery.closed; malformed.noActions();
    const throwing = await fixture({ context: owner, throwFactory: true }); unavailable(await throwing.start()); await throwing.discovery.closed; assert.equal(throwing.processes.length, 0);
});
