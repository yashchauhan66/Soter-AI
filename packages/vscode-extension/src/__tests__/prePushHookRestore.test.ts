import assert from "node:assert/strict";
import { test } from "node:test";
import { buildPrePushHookText } from "../history-hooks/PrePushHookText";
import { hookSnapshotDigest, type HookRecoveryReceipt, type HookFileSnapshot } from "../history-hooks/PrePushHookTransaction";

// TEST FIRST: private in-memory dependencies only. No filesystem, child/Git,
// listener, provider, encryption/key creation or native command is used here.
const ROOT = "C:\\Synthetic Restore Repo", HOOKS = ".git/hooks";
const GENERATION = "b1234567-1234-4567-8123-123456789abc", HANDLE = "d".repeat(32);
const PRIVATE = "TEST_ONLY_F26B_RESTORE_PRIVATE_7d360a21";
const ORIGINAL = Buffer.from("#!/bin/sh\n# " + PRIVATE + "\nprintf '%s\\n' original\nexit 7\n");
const EDIT = Buffer.from("#!/bin/sh\n# synthetic owner edit, retain exactly\nexit 9\n");
// Fixed synthetic public bits, not a private signing key or service identity.
const PUBLIC_KEY = Buffer.from("302a300506032b6570032100" + "01".repeat(32), "hex").toString("base64");
const PIN = Buffer.from(JSON.stringify({ version: 1, root: ROOT, generation: GENERATION, publicKey: PUBLIC_KEY,
    worker: "C:\\Synthetic Extension\\pre-commit-client.js", workerSha256: "a".repeat(64),
    runtime: "C:\\Synthetic Code\\Code.exe", runtimeSha256: "b".repeat(64),
    descriptor: "C:\\Synthetic Profile\\pre-push-endpoint.json", systemRoot: "C:\\Windows" }));

type Status = "RESTORED" | "CANCELLED" | "UNAVAILABLE" | "INCOMPLETE";
type RecoveryState = "ROLLED_BACK" | "INCOMPLETE";
interface Preview { readonly operation: "restore"; readonly hookRelative: string; readonly originalPresent: boolean }
interface Dependencies {
    current(): boolean; confirm(preview: Preview): Promise<boolean>; read(): HookFileSnapshot | undefined;
    readonly backups: { retrieve(handle: string): Promise<string | null> };
    withdraw(): void | Promise<void>; save(receipt: HookRecoveryReceipt, state: RecoveryState): Promise<void>;
    write(expected: HookFileSnapshot, bytes: Buffer | undefined, mode: number | undefined): boolean;
}
interface Restore { run(deps: Dependencies): Promise<Readonly<{ status: Status }>> }
type Factory = new (receipt: HookRecoveryReceipt) => Restore;
type WriteMode = "apply" | "false-before" | "throw-before" | "false-after" | "throw-after";
interface Model {
    state: HookFileSnapshot; original: HookFileSnapshot; installed: HookFileSnapshot; receipt: HookRecoveryReceipt;
    events: string[]; previews: Preview[]; retrieved: string[]; withdrawals: number;
    reads: number; lastRead?: HookFileSnapshot; writes: { expected: HookFileSnapshot; bytes?: Buffer; mode?: number }[];
    saves: { receipt: HookRecoveryReceipt; state: RecoveryState }[];
    hooks: Record<string, (model: Model) => void>;
    control: { authority: unknown; featureFlag: boolean; confirmation: unknown; backup: unknown; readUnavailable: boolean;
        throws: Set<string>; writeMode: WriteMode; withdrawWait?: Promise<void> };
}
function copy(value: HookFileSnapshot): HookFileSnapshot {
    return Object.freeze({ identity: value.identity, bytes: value.bytes === undefined ? undefined : Buffer.from(value.bytes), mode: value.mode });
}
function equal(a: HookFileSnapshot | undefined, b: HookFileSnapshot, identity = false): boolean {
    return !!a && (!identity || a.identity === b.identity) && a.mode === b.mode
        && (b.bytes === undefined ? a.bytes === undefined : Buffer.isBuffer(a.bytes) && a.bytes.equals(b.bytes));
}
function payload(bytes: Buffer | undefined, mode: number | undefined): string {
    return JSON.stringify({ version: 1, present: bytes !== undefined, mode: mode ?? null, bytes: bytes?.toString("base64") ?? null });
}
function result(value: Readonly<{ status: Status }>, expected: Status): void {
    assert.deepEqual(value, { status: expected });
    assert(Object.isFrozen(value), "Only a frozen fixed status may leave the private restoration.");
    assert(!JSON.stringify(value).includes(PRIVATE), "No backup, original bytes or exception text may leave in the result.");
}
async function fixture(settings: { absent?: boolean; original?: Buffer; mode?: number; hooksRelative?: string; receipt?: unknown } = {}) {
    const module = await import("../history-hooks/PrePushHookRestore");
    assert(typeof module.PrePushHookRestore === "function", "The frozen restoration API must exist before behavioral verification.");
    const original: HookFileSnapshot = { bytes: settings.absent ? undefined : Buffer.from(settings.original ?? ORIGINAL),
        mode: settings.absent ? undefined : settings.mode ?? 0o755, identity: "1".repeat(64) };
    // Unsupported original controls intentionally bind their own digest but use
    // an otherwise valid installed hook: retrieval must still validate original.
    const installedBytes = buildPrePushHookText(original.bytes, PIN) ?? buildPrePushHookText(ORIGINAL, PIN);
    assert(installedBytes, "The known public synthetic pin must build a supported installed hook.");
    const installed: HookFileSnapshot = { bytes: installedBytes, mode: original.mode ?? 0o666, identity: "2".repeat(64) };
    const receipt: HookRecoveryReceipt = { version: 1, generation: GENERATION, root: ROOT, hooksRelative: settings.hooksRelative ?? HOOKS,
        backup: HANDLE, beforeDigest: hookSnapshotDigest(original), afterDigest: hookSnapshotDigest(installed),
        originalPresent: original.bytes !== undefined, ...(original.mode === undefined ? {} : { originalMode: original.mode }), mode: installed.mode! };
    const model: Model = { state: copy(installed), original: copy(original), installed: copy(installed), receipt,
        events: [], previews: [], retrieved: [], withdrawals: 0, reads: 0, writes: [], saves: [], hooks: {},
        control: { authority: true, featureFlag: false, confirmation: true, backup: payload(original.bytes, original.mode),
            readUnavailable: false, throws: new Set(), writeMode: "apply" } };
    const action = (name: string) => { model.events.push(name); model.hooks[name]?.(model); if (model.control.throws.has(name)) throw Error(PRIVATE); };
    const deps: Dependencies = {
        current: () => { action("current"); return model.control.authority as boolean; },
        confirm: async preview => { model.previews.push(preview); action("confirm"); return model.control.confirmation as boolean; },
        read: () => { model.reads++; action("read"); if (model.control.readUnavailable) return undefined;
            model.lastRead = copy(model.state); return model.lastRead; },
        backups: Object.freeze({ retrieve: async (handle: string) => { model.retrieved.push(handle); action("retrieve");
            return model.control.backup as string | null; } }),
        withdraw: () => { model.withdrawals++; action("withdraw"); return model.control.withdrawWait; },
        save: async (saved, state) => { model.saves.push({ receipt: saved, state }); action("save:" + state); },
        write: (expected, bytes, mode) => {
            model.writes.push({ expected: copy(expected), bytes: bytes === undefined ? undefined : Buffer.from(bytes), mode });
            action("write"); assert(expected === model.lastRead, "Write must receive the latest genuine expected snapshot returned by read.");
            if (!equal(expected, model.state, true)) return false;
            if (model.control.writeMode === "false-before") return false;
            if (model.control.writeMode === "throw-before") throw Error(PRIVATE);
            model.state = Object.freeze({ bytes: bytes === undefined ? undefined : Buffer.from(bytes), mode, identity: "3".repeat(64) });
            action("afterWrite");
            if (model.control.writeMode === "false-after") return false;
            if (model.control.writeMode === "throw-after") throw Error(PRIVATE);
            return true;
        },
    };
    const supplied = Object.prototype.hasOwnProperty.call(settings, "receipt") ? settings.receipt : receipt;
    const tx = new (module.PrePushHookRestore as unknown as Factory)(supplied as HookRecoveryReceipt);
    assert.equal(model.events.length, 0, "Construction must not perform dependency I/O.");
    return { tx, deps, model, run: () => tx.run(deps) };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
function noMutation(f: Fixture): void { assert.equal(f.model.writes.length, 0); }
function incomplete(f: Fixture): void {
    assert(f.model.saves.some(row => row.state === "INCOMPLETE"), "Uncertain recovery must retain best-effort durable INCOMPLETE evidence.");
    assert(f.model.writes.length <= 1 && f.model.withdrawals <= 1, "Restoration must not retry or overwrite unknown state.");
}
function before(f: Fixture, first: string, second: string): void {
    const a = f.model.events.indexOf(first), b = f.model.events.indexOf(second);
    assert(a >= 0 && b > a, first + " must precede " + second);
}

test("F26b restore exact existing custom hook and default absence under explicit flag-off restoration authority", async () => {
    for (const absent of [false, true]) {
        const f = await fixture({ absent, mode: 0o644, hooksRelative: absent ? HOOKS : ".synthetic hooks/owned" });
        assert(f.model.control.featureFlag === false && f.model.control.authority === true);
        result(await f.run(), "RESTORED");
        assert(equal(f.model.state, f.model.original), "Restore must return exact original bytes/mode or exact absence.");
        assert.equal(f.model.writes.length, 1); assert.equal(f.model.withdrawals, 1);
        assert.deepEqual(f.model.retrieved, [HANDLE]);
        assert.deepEqual(Object.keys(f.deps.backups), ["retrieve"], "Restore must have no store, key creation or encryption provider authority.");
        assert.deepEqual(f.model.saves.map(row => row.state), ["ROLLED_BACK"]);
        assert.deepEqual(f.model.saves[0].receipt, f.model.receipt);
        assert(Object.isFrozen(f.model.saves[0].receipt), "Saved receipt is a frozen validated private copy.");
        assert(f.model.writes[0].bytes === undefined ? absent : f.model.writes[0].bytes.equals(ORIGINAL));
    }
});

test("F26b restore rejects malformed exact receipt schema and dangerous records without dependency effects", async () => {
    const base = (await fixture()).model.receipt;
    const bad: unknown[] = [null, [], "receipt", Object.create(base), { ...base, unknown: PRIVATE },
        { ...base, version: 2 }, { ...base, originalPresent: 1 }, { ...base, originalMode: undefined },
        { ...base, originalPresent: false }, { ...base, mode: -1 }, { ...base, mode: 0o1000 },
        { ...base, mode: 1.5 }, { ...base, mode: "493" }, { ...base, originalMode: NaN },
        { ...base, generation: GENERATION.toUpperCase() }, { ...base, generation: GENERATION.replace("-4567-", "-1567-") },
        { ...base, backup: "D".repeat(32) }, { ...base, backup: "d".repeat(31) },
        { ...base, beforeDigest: "A".repeat(64) }, { ...base, afterDigest: "a".repeat(63) },
        ...["C:Synthetic", "C:\\Synthetic Restore Repo\\..\\Other", "\\\\server\\share", "C:\\CON"].map(root => ({ ...base, root })),
        ...["../hooks", ".git/../hooks", ".git\\hooks", "/hooks", ".git/hooks ", ".git/NUL"].map(hooksRelative => ({ ...base, hooksRelative }))];
    let touched = 0;
    for (const key of ["version", "generation", "root", "hooksRelative", "backup", "beforeDigest", "afterDigest", "originalPresent", "mode"]) {
        const omitted: Record<string, unknown> = { ...base }; delete omitted[key]; bad.push(omitted);
    }
    const getter = { ...base }; Object.defineProperty(getter, "root", { enumerable: true, get() { touched++; throw Error(PRIVATE); } }); bad.push(getter);
    bad.push(new Proxy(base, { get() { touched++; throw Error(PRIVATE); }, ownKeys() { touched++; throw Error(PRIVATE); } }));
    for (const receipt of bad) {
        const f = await fixture({ receipt }); result(await f.run(), "UNAVAILABLE");
        assert.deepEqual(f.model.events, [], "Malformed receipt must be inert, including no current/read/save/modal.");
    }
    assert.equal(touched, 0, "Accessors and proxies must be rejected without invoking their traps.");
});

test("F26b restore checks current owned digest and exact mode before modal and preserves unknown owner state", async () => {
    for (const kind of ["bytes", "mode", "missing", "unknown", "throw"] as const) {
        const f = await fixture();
        if (kind === "bytes") f.model.state = { ...f.model.state, bytes: Buffer.from(EDIT) };
        if (kind === "mode") f.model.state = { ...f.model.state, mode: 0o644 };
        if (kind === "missing") f.model.state = { identity: "4".repeat(64), bytes: undefined, mode: undefined };
        if (kind === "unknown") f.model.control.readUnavailable = true;
        if (kind === "throw") f.model.control.throws.add("read");
        result(await f.run(), "INCOMPLETE"); noMutation(f); incomplete(f);
        assert.equal(f.model.previews.length, 0); assert.equal(f.model.retrieved.length, 0); assert.equal(f.model.withdrawals, 0);
        if (kind === "bytes") assert(f.model.state.bytes?.equals(EDIT));
        if (kind === "mode") assert.equal(f.model.state.mode, 0o644);
    }
    const replaced = await fixture(); replaced.model.state = { ...replaced.model.state, identity: "5".repeat(64) };
    result(await replaced.run(), "RESTORED");
    assert.equal(replaced.model.writes[0].expected.identity, "5".repeat(64), "Receipt ownership uses digest/mode; fresh expected identity is captured from the current exact owned file.");
});

test("F26b restore review is frozen metadata only and cancellation or disabled authority cannot retrieve or mutate", async () => {
    for (const confirmation of [false, "true", undefined]) {
        const f = await fixture(); f.model.control.confirmation = confirmation;
        result(await f.run(), "CANCELLED"); noMutation(f);
        assert.deepEqual(f.model.previews, [{ operation: "restore", hookRelative: HOOKS + "/pre-push", originalPresent: true }]);
        assert(Object.isFrozen(f.model.previews[0])); before(f, "read", "confirm");
        assert.equal(f.model.retrieved.length, 0); assert.equal(f.model.withdrawals, 0); assert.equal(f.model.saves.length, 0);
    }
    for (const authority of [false, "true", undefined]) {
        const f = await fixture(); f.model.control.authority = authority;
        result(await f.run(), "UNAVAILABLE"); noMutation(f);
        assert.equal(f.model.previews.length, 0); assert.equal(f.model.retrieved.length, 0); assert.equal(f.model.withdrawals, 0);
    }
});

test("F26b restore withholds missing corrupt noncanonical mismatched and unsupported backup originals", async () => {
    const canonical = payload(ORIGINAL, 0o755), parsed = JSON.parse(canonical) as Record<string, unknown>;
    const invalid: unknown[] = [null, undefined, 7, {}, "", "not json", " " + canonical, canonical + "\n",
        JSON.stringify({ present: true, version: 1, mode: 0o755, bytes: ORIGINAL.toString("base64") }),
        canonical.replace('"version":1', '"version":1,"version":1'), JSON.stringify({ ...parsed, extra: PRIVATE }),
        JSON.stringify({ ...parsed, version: 2 }), JSON.stringify({ ...parsed, present: "true" }),
        JSON.stringify({ ...parsed, mode: 0o644 }), JSON.stringify({ ...parsed, mode: null }),
        JSON.stringify({ ...parsed, bytes: null }), JSON.stringify({ ...parsed, bytes: ORIGINAL.toString("base64") + "=" }),
        JSON.stringify({ ...parsed, bytes: ORIGINAL.toString("base64") + "\n" }),
        payload(Buffer.from("#!/bin/sh\n# different supported original\nexit 0\n"), 0o755), payload(undefined, undefined)];
    for (const backup of invalid) {
        const f = await fixture(); f.model.control.backup = backup;
        result(await f.run(), "INCOMPLETE"); noMutation(f); incomplete(f);
        assert.equal(f.model.previews.length, 1); assert.deepEqual(f.model.retrieved, [HANDLE]); assert.equal(f.model.withdrawals, 0);
    }
    for (const original of [Buffer.from("#!/bin/bash\nexit 0\n"), Buffer.from("#!/bin/sh\r\nexit 0\r\n"),
        Buffer.from("#!/bin/sh\n\0exit 0\n"), Buffer.from("#!/bin/sh\n" + "x".repeat(65536))]) {
        const f = await fixture({ original });
        result(await f.run(), "INCOMPLETE"); noMutation(f); incomplete(f); assert.equal(f.model.withdrawals, 0);
    }
    const absent = await fixture({ absent: true }); absent.model.control.backup = JSON.stringify({ version: 1, present: false, mode: 0, bytes: "" });
    result(await absent.run(), "INCOMPLETE"); noMutation(absent); incomplete(absent);
    const missingKey = await fixture(); missingKey.model.control.backup = null;
    result(await missingKey.run(), "INCOMPLETE"); assert.deepEqual(Object.keys(missingKey.deps.backups), ["retrieve"]);
});

test("F26b restore awaits one withdrawal after review and backup validation before exact guarded write", async () => {
    const f = await fixture(); let release!: () => void;
    f.model.control.withdrawWait = new Promise<void>(resolve => { release = resolve; });
    const pending = f.run();
    for (let turn = 0; turn < 24 && f.model.withdrawals === 0; turn++) await Promise.resolve();
    assert.equal(f.model.withdrawals, 1); noMutation(f);
    before(f, "confirm", "retrieve"); before(f, "retrieve", "withdraw");
    release(); result(await pending, "RESTORED");
    before(f, "withdraw", "write"); before(f, "write", "save:ROLLED_BACK");
    assert.equal(f.model.withdrawals, 1); assert.equal(f.model.writes.length, 1);
    assert(f.model.events.slice(f.model.events.indexOf("withdraw") + 1, f.model.events.indexOf("write")).includes("read"),
        "Withdraw completion must be followed by a fresh same-identity expected snapshot before sync write.");
});

test("F26b restore rechecks early authority and reviewed owner identity after each asynchronous boundary", async () => {
    for (const stage of ["confirm", "retrieve"] as const) {
        const authority = await fixture(); authority.model.hooks[stage] = m => { m.control.authority = false; };
        result(await authority.run(), "UNAVAILABLE"); noMutation(authority); assert.equal(authority.model.withdrawals, 0);
        for (const kind of ["bytes", "mode", "identity"] as const) {
            const f = await fixture(); f.model.hooks[stage] = m => { m.state = { ...m.state,
                ...(kind === "bytes" ? { bytes: Buffer.from(EDIT) } : kind === "mode" ? { mode: 0o644 } : { identity: "6".repeat(64) }) }; };
            result(await f.run(), "INCOMPLETE"); noMutation(f); incomplete(f); assert.equal(f.model.withdrawals, 0);
            if (kind === "bytes") assert(f.model.state.bytes?.equals(EDIT));
        }
    }
});

test("F26b restore withdrawal uncertainty or post-withdraw owner drift is incomplete without write or retry", async () => {
    for (const kind of ["authority", "bytes", "mode", "identity", "unknown", "throw"] as const) {
        const f = await fixture(); f.model.hooks.withdraw = m => {
            if (kind === "authority") m.control.authority = false;
            if (kind === "bytes") m.state = { ...m.state, bytes: Buffer.from(EDIT) };
            if (kind === "mode") m.state = { ...m.state, mode: 0o644 };
            if (kind === "identity") m.state = { ...m.state, identity: "7".repeat(64) };
            if (kind === "unknown") m.control.readUnavailable = true;
            if (kind === "throw") throw Error(PRIVATE);
        };
        result(await f.run(), "INCOMPLETE"); noMutation(f); incomplete(f); assert.equal(f.model.withdrawals, 1);
        if (kind === "bytes") assert(f.model.state.bytes?.equals(EDIT));
    }
});

test("F26b restore uncertain sync writes and readback preserve edits and never retry even when false already mutated", async () => {
    for (const writeMode of ["false-before", "throw-before", "false-after", "throw-after"] as const) {
        const f = await fixture(); f.model.control.writeMode = writeMode;
        result(await f.run(), "INCOMPLETE"); incomplete(f);
        assert.equal(f.model.withdrawals, 1); assert.equal(f.model.writes.length, 1);
        assert(equal(f.model.state, writeMode.endsWith("after") ? f.model.original : f.model.installed));
        assert(!f.model.saves.some(row => row.state === "ROLLED_BACK"), "A false/throw return is not a durable successful restore even if bytes changed.");
    }
    for (const kind of ["owner-edit", "mode", "unknown", "throw"] as const) {
        const f = await fixture(); f.model.hooks.afterWrite = m => {
            if (kind === "owner-edit") m.state = { ...m.state, bytes: Buffer.from(EDIT) };
            if (kind === "mode") m.state = { ...m.state, mode: 0o600 };
            if (kind === "unknown") m.control.readUnavailable = true;
            if (kind === "throw") m.control.throws.add("read");
        };
        result(await f.run(), "INCOMPLETE"); incomplete(f); assert.equal(f.model.writes.length, 1);
        if (kind === "owner-edit") assert(f.model.state.bytes?.equals(EDIT));
    }
    const raced = await fixture(); raced.model.hooks.write = m => { m.state = { ...m.state, bytes: Buffer.from(EDIT), identity: "8".repeat(64) }; };
    result(await raced.run(), "INCOMPLETE"); incomplete(raced); assert(raced.model.state.bytes?.equals(EDIT));
});

test("F26b restore requires durable rollback save then final exact readback and retains incomplete on save uncertainty", async () => {
    for (const kind of ["save-throws", "authority", "owner-edit", "unknown"] as const) {
        const f = await fixture();
        f.model.hooks["save:ROLLED_BACK"] = m => {
            if (kind === "save-throws") throw Error(PRIVATE);
            if (kind === "authority") m.control.authority = false;
            if (kind === "owner-edit") m.state = { ...m.state, bytes: Buffer.from(EDIT), identity: "9".repeat(64) };
            if (kind === "unknown") m.control.readUnavailable = true;
        };
        result(await f.run(), "INCOMPLETE"); incomplete(f);
        assert.equal(f.model.writes.length, 1); assert.equal(f.model.withdrawals, 1);
        if (kind === "owner-edit") assert(f.model.state.bytes?.equals(EDIT));
    }
    const saveUnavailable = await fixture(); saveUnavailable.model.control.writeMode = "false-before";
    saveUnavailable.model.control.throws.add("save:INCOMPLETE");
    result(await saveUnavailable.run(), "INCOMPLETE"); incomplete(saveUnavailable);
});

test("F26b restore has no await between final synchronous read current and success with paired immediate withdrawal", async () => {
    for (const immediate of [true, false]) {
        const f = await fixture(); let observed = false;
        f.model.hooks.read = m => {
            if (observed || !m.saves.some(row => row.state === "ROLLED_BACK")) return;
            observed = true;
            if (immediate) m.control.authority = false;
            else queueMicrotask(() => { m.control.authority = false; });
        };
        result(await f.run(), immediate ? "INCOMPLETE" : "RESTORED");
        assert(observed && f.model.control.authority === false, "The paired controls must reach the actual final-read boundary.");
        assert.equal(f.model.writes.length, 1); assert.equal(f.model.withdrawals, 1);
        if (immediate) incomplete(f);
        else assert.deepEqual(f.model.saves.map(row => row.state), ["ROLLED_BACK"], "A later queued withdrawal cannot be awaited before synchronous completion.");
    }
});

test("F26b restore is one-shot including concurrent review and sanitizes dependency exceptions without extra authority", async () => {
    const f = await fixture(); let release!: (value: boolean) => void;
    f.deps.confirm = preview => { f.model.previews.push(preview); f.model.events.push("confirm"); return new Promise(resolve => { release = resolve; }); };
    const pending = f.run();
    for (let turn = 0; turn < 16 && !release; turn++) await Promise.resolve();
    assert(release, "The private review must be pending before concurrent invocation.");
    const untouched = new Proxy({} as Dependencies, { get() { throw Error("Duplicate run touched a dependency"); } });
    result(await f.tx.run(untouched), "UNAVAILABLE");
    release(true); result(await pending, "RESTORED"); result(await f.tx.run(untouched), "UNAVAILABLE");
    assert.equal(f.model.writes.length, 1); assert.equal(f.model.withdrawals, 1);
    const cancelled = await fixture(); cancelled.model.control.confirmation = false;
    result(await cancelled.run(), "CANCELLED"); result(await cancelled.tx.run(untouched), "UNAVAILABLE");
    for (const stage of ["current", "confirm", "retrieve"] as const) {
        const bad = await fixture(); bad.model.control.throws.add(stage);
        result(await bad.run(), stage === "retrieve" ? "INCOMPLETE" : "UNAVAILABLE"); noMutation(bad);
        assert.equal(bad.model.withdrawals, 0);
    }
});
