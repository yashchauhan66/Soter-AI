/** F32 pure current-generation withdrawal checks. These doubles do not prove
 * real child close/stdout EOF/stderr EOF or installed extension withdrawal.
 * Historical recovered rows remain unconfirmed; no PID is adopted or signalled.
 * Actual VaultAppJob terminal states include STOPPED, not an invented FAILED.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

type Dependencies = {
    withdraw(): Promise<unknown>;
    snapshots(): Promise<unknown>;
    stopBroker(): Promise<unknown>;
};
type Result = { state: "stopped" | "STOP_UNCONFIRMED" };
const PRIVATE = "SYNTHETIC_ONLY_F32_OWNED_STOP_PRIVATE_e1c8a7";
const STOPPED: Result = { state: "stopped" };
const UNKNOWN: Result = { state: "STOP_UNCONFIRMED" };

async function stop(deps: Dependencies, ...extra: unknown[]): Promise<Result> {
    const module = await import("../lifecycle/OwnedLifecycleStop");
    assert.equal(typeof module.stopOwnedLifecycle, "function");
    return (module.stopOwnedLifecycle as (...args: unknown[]) => Promise<Result>)(deps, ...extra);
}
function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>(done => { resolve = done; });
    return { promise, resolve };
}
async function bounded<T>(work: Promise<T>): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
        return await Promise.race([work, new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(Error("Withdrawal fixture did not reach its bounded stage.")), 1000);
        })]);
    } finally { if (timer) clearTimeout(timer); }
}
const terminal = (state = "EXITED") => ({
    available: false, ownership: "SAVED", recovered: [],
    workers: [{ id: "00000000-0000-4000-8000-000000000001", state, pid: 123, exitCode: 0 }], terminals: 0,
});
const snapshot = () => ({ terminals: [terminal()], vault: { descriptors: [], jobs: [] } });
function fixture() {
    const events: string[] = [];
    let current: unknown = snapshot();
    const hooks = {
        async withdraw(): Promise<unknown> { return; },
        async snapshot(): Promise<unknown> { return current; },
        async broker(): Promise<unknown> { return { state: "stopped" }; },
    };
    const deps: Dependencies = {
        async withdraw(...args: unknown[]) { assert.equal(args.length, 0); events.push("withdraw"); return hooks.withdraw(); },
        async snapshots(...args: unknown[]) { assert.equal(args.length, 0); events.push("snapshot"); return hooks.snapshot(); },
        async stopBroker(...args: unknown[]) { assert.equal(args.length, 0); events.push("broker"); return hooks.broker(); },
    };
    return { deps, hooks, events, current(value: unknown) { current = value; } };
}
function privateFree(result: unknown): void {
    assert.ok(!JSON.stringify(result).includes(PRIVATE));
    assert.deepEqual(Object.keys(result as object), ["state"]);
}

test("O01 empty owned routes still withdraw before broker stop and recheck after stop", async () => {
    const f = fixture(); f.current({ terminals: [], vault: { descriptors: [], jobs: [] } });
    assert.deepEqual(f.events, [], "Creating dependencies must not request withdrawal.");
    assert.deepEqual(await stop(f.deps), STOPPED);
    assert.deepEqual(f.events, ["withdraw", "snapshot", "broker", "snapshot"]);
});

test("O02 accepts only actual terminal/current vault terminal states without retaining metadata", async () => {
    const f = fixture();
    f.current({
        terminals: [terminal("EXITED"), terminal("CANCELLED"), terminal("BLOCKED")],
        vault: {
            descriptors: [{ id: "synthetic-saved-descriptor", args: [PRIVATE], selections: [] }],
            jobs: ["EXITED", "STOPPED", "CANCELLED", "BLOCKED"].map((state, index) => ({
                id: `00000000-0000-4000-8000-00000000000${index + 2}`, state, pid: 123, exitCode: 0,
            })),
        },
    });
    const result = await stop(f.deps); assert.deepEqual(result, STOPPED); privateFree(result);
    assert.equal(f.events.filter(value => value === "broker").length, 1);
});

test("O03 awaits natural withdrawal completion before observing status or touching broker", async () => {
    const f = fixture(), entered = deferred<void>(), release = deferred<void>();
    f.hooks.withdraw = async () => { entered.resolve(); await release.promise; };
    const result = stop(f.deps); await bounded(entered.promise);
    assert.deepEqual(f.events, ["withdraw"]);
    release.resolve(); assert.deepEqual(await bounded(result), STOPPED);
});

test("O04 withdrawal rejection withholds status/broker calls and all private error text", async () => {
    const f = fixture(); f.hooks.withdraw = async () => { throw Error(PRIVATE); };
    const result = await stop(f.deps); assert.deepEqual(result, UNKNOWN); privateFree(result);
    assert.deepEqual(f.events, ["withdraw"]);
});

test("O05 current worker READY/RUNNING/cancel-pending/unknown states never authorize broker stop", async () => {
    for (const state of ["READY", "RUNNING", "CANCEL_PENDING", "STOP_UNCONFIRMED", "UNVERIFIED", "FAILED", "STOPPED", PRIVATE]) {
        const f = fixture(); f.current({ terminals: [terminal(state)], vault: { descriptors: [], jobs: [] } });
        const result = await stop(f.deps); assert.deepEqual(result, UNKNOWN, state); privateFree(result);
        assert.deepEqual(f.events, ["withdraw", "snapshot"], state);
    }
});

test("O06 open terminals, unsaved ownership and recovered PID metadata remain unconfirmed", async () => {
    for (const patch of [
        { terminals: 1 }, { terminals: -1 }, { terminals: 0.5 }, { terminals: NaN },
        { ownership: "UNVERIFIED" }, { ownership: "INCOMPLETE" },
        { recovered: [{ id: "00000000-0000-4000-8000-000000000008", state: "UNVERIFIED", pid: 999 }] },
        { recovered: [{ id: "00000000-0000-4000-8000-000000000008", state: "EXITED", pid: 999 }] },
    ]) {
        const f = fixture(); f.current({ terminals: [{ ...terminal(), ...patch }], vault: { descriptors: [], jobs: [] } });
        assert.deepEqual(await stop(f.deps), UNKNOWN);
        assert.ok(!f.events.includes("broker"), "Recovered or ambiguous rows are not physical close/EOF proof.");
    }
});

test("O07 current vault ready/running/stop-requested/unverified and invented FAILED states withhold stop", async () => {
    for (const state of ["READY", "RUNNING", "STOP_REQUESTED", "STOP_UNCONFIRMED", "UNVERIFIED", "FAILED", PRIVATE]) {
        const f = fixture(); f.current({ terminals: [], vault: { descriptors: [], jobs: [{ state }] } });
        const result = await stop(f.deps); assert.deepEqual(result, UNKNOWN, state); privateFree(result);
        assert.ok(!f.events.includes("broker"));
    }
});

test("O08 malformed root/status/row/array metadata conservatively withholds broker stop", async () => {
    const hole = new Array(1);
    const invalid: unknown[] = [
        undefined, null, false, "stopped", [], {},
        { terminals: [], vault: null }, { terminals: [], vault: {} },
        { terminals: {}, vault: { jobs: [] } }, { terminals: hole, vault: { jobs: [] } },
        { terminals: [], vault: { jobs: hole } }, { terminals: [], vault: { jobs: "EXITED" } },
        { terminals: [null], vault: { jobs: [] } },
        { terminals: [{ ...terminal(), workers: [null] }], vault: { jobs: [] } },
        { terminals: [{ ...terminal(), workers: [{ state: 1 }] }], vault: { jobs: [] } },
        { terminals: [{ ...terminal(), workers: hole }], vault: { jobs: [] } },
        { terminals: [{ ...terminal(), recovered: null }], vault: { jobs: [] } },
        { terminals: [Object.assign(Object.create({ inherited: true }), terminal())], vault: { jobs: [] } },
        { terminals: [], vault: { jobs: [Object.assign(Object.create({ state: "EXITED" }), {})] } },
    ];
    for (const value of invalid) {
        const f = fixture(); f.current(value);
        assert.deepEqual(await stop(f.deps), UNKNOWN);
        assert.ok(!f.events.includes("broker"));
    }
});

test("O09 metadata accessors are rejected without invoking getters at any ownership layer", async () => {
    let reads = 0;
    const accessor = (base: object, name: string) => Object.defineProperty(base, name, {
        enumerable: true, get() { reads++; throw Error(PRIVATE); },
    });
    const values = [
        accessor({ vault: { jobs: [] } }, "terminals"),
        accessor({ terminals: [] }, "vault"),
        { terminals: [accessor({ ...terminal() }, "ownership")], vault: { jobs: [] } },
        { terminals: [accessor({ ...terminal() }, "available")], vault: { jobs: [] } },
        { terminals: [{ ...terminal(), workers: [accessor({}, "state")] }], vault: { jobs: [] } },
        { terminals: [], vault: { jobs: [accessor({}, "state")] } },
        { terminals: [], vault: accessor({ jobs: [] }, "descriptors") },
    ];
    for (const value of values) {
        const f = fixture(); f.current(value);
        const result = await stop(f.deps); assert.deepEqual(result, UNKNOWN); privateFree(result);
        assert.ok(!f.events.includes("broker"));
    }
    assert.equal(reads, 0, "Untrusted metadata getters are never status authority.");
});

test("O10 throwing metadata proxies are contained and cannot expose error text or authorize stop", async () => {
    const traps = {
        getPrototypeOf() { throw Error(PRIVATE); },
        ownKeys() { throw Error(PRIVATE); },
        get() { throw Error(PRIVATE); },
    };
    for (const value of [new Proxy({}, traps), { terminals: new Proxy([], traps), vault: { jobs: [] } },
        { terminals: [new Proxy({}, traps)], vault: { jobs: [] } }]) {
        const f = fixture(); f.current(value);
        const result = await stop(f.deps); assert.deepEqual(result, UNKNOWN); privateFree(result);
        assert.ok(!f.events.includes("broker"));
    }
});

test("O11 successful broker call alone is insufficient without exact stopped data state", async () => {
    let reads = 0;
    const getter = Object.defineProperty({}, "state", { enumerable: true, get() { reads++; return "stopped"; } });
    for (const value of [undefined, null, true, "stopped", {}, { state: "STOP_UNCONFIRMED" },
        { state: "stopping" }, { state: "healthy" }, { state: "STOPPED" }, getter]) {
        const f = fixture(); f.hooks.broker = async () => value;
        const result = await stop(f.deps); assert.deepEqual(result, UNKNOWN); privateFree(result);
        assert.equal(f.events.filter(event => event === "broker").length, 1);
    }
    assert.equal(reads, 0);
    const f = fixture(); f.hooks.broker = async () => { throw Error(PRIVATE); };
    const result = await stop(f.deps); assert.deepEqual(result, UNKNOWN); privateFree(result);
});

test("O12 new current worker during awaited broker withdrawal prevents a stopped lifecycle report", async () => {
    const f = fixture(), entered = deferred<void>(), release = deferred<void>();
    f.hooks.broker = async () => { entered.resolve(); await release.promise; return { state: "stopped" }; };
    const result = stop(f.deps); await bounded(entered.promise);
    assert.deepEqual(f.events, ["withdraw", "snapshot", "broker"]);
    f.current({ terminals: [terminal("RUNNING")], vault: { descriptors: [], jobs: [] } });
    release.resolve(); assert.deepEqual(await bounded(result), UNKNOWN);
    assert.deepEqual(f.events, ["withdraw", "snapshot", "broker", "snapshot"]);
});

test("O13 new vault work, recovered rows or status failure after broker stop withholds completion", async () => {
    for (const value of [
        { terminals: [], vault: { descriptors: [], jobs: [{ state: "READY" }] } },
        { terminals: [{ ...terminal(), recovered: [{ state: "UNVERIFIED", pid: 123 }] }], vault: { jobs: [] } },
        undefined,
    ]) {
        const f = fixture(); let reads = 0;
        f.hooks.snapshot = async () => ++reads === 1 ? snapshot() : value;
        assert.deepEqual(await stop(f.deps), UNKNOWN);
        assert.deepEqual(f.events, ["withdraw", "snapshot", "broker", "snapshot"]);
    }
    const f = fixture(); let reads = 0;
    f.hooks.snapshot = async () => { if (++reads > 1) throw Error(PRIVATE); return snapshot(); };
    const result = await stop(f.deps); assert.deepEqual(result, UNKNOWN); privateFree(result);
});

test("O14 initial snapshot failure is conservative and extra caller paths/arguments provide no authority", async () => {
    const failing = fixture(); failing.hooks.snapshot = async () => { throw Error(PRIVATE); };
    const unknown = await stop(failing.deps); assert.deepEqual(unknown, UNKNOWN); privateFree(unknown);
    assert.deepEqual(failing.events, ["withdraw", "snapshot"]);
    let reads = 0, forbidden = 0;
    const caller = Object.defineProperty({}, "path", { get() { reads++; throw Error(PRIVATE); } });
    const f = fixture();
    Object.assign(f.deps, {
        kill() { forbidden++; }, readFile() { forbidden++; }, secrets() { forbidden++; },
        decrypt() { forbidden++; }, fetch() { forbidden++; },
    });
    const result = await stop(f.deps, caller, PRIVATE, "D:\\Synthetic-F32\\other", { approve: true });
    assert.deepEqual(result, STOPPED); privateFree(result);
    assert.equal(reads, 0); assert.equal(forbidden, 0);
});
