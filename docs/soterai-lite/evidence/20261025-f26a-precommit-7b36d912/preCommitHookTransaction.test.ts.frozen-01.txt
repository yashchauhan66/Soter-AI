import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { win32 } from "node:path";
import { test } from "node:test";

// TEST FIRST: entirely in-memory transaction dependencies, synthetic hook/pins.
// No filesystem, SecretStorage provider, listener, shell/Git/child or permission
// change. The backup encryption and actual hook execution have separate gates.
const ROOT = "C:\\Synthetic Repo", HOOKS = ".git/hooks", HOOK = HOOKS + "/pre-commit";
const GENERATION = "a1234567-1234-4567-8123-123456789abc", PROJECTION = "a".repeat(64);
const WORKER = "b".repeat(64), RUNTIME = "c".repeat(64), BEFORE_ID = "1".repeat(64), BACKUP = "d".repeat(32);
const PRIVATE = "TEST_ONLY_F26A_TRANSACTION_PRIVATE_e892a174";
const ORIGINAL = Buffer.from('#!/bin/sh\n# ' + PRIVATE + '\nprintf "%s\\n" "$@"\nexit 7\n');
const ABSENT_MODE = process.platform === "win32" ? 0o666 : 0o755;
const PUBLIC_KEY = generateKeyPairSync("ed25519").publicKey.export({ format: "der", type: "spki" }).toString("base64");
type Status = "APPLIED" | "CANCELLED" | "UNAVAILABLE" | "ROLLED_BACK" | "INCOMPLETE";
type State = "PREPARED" | "APPLIED" | "ROLLED_BACK" | "INCOMPLETE";
interface Snapshot { bytes?: Buffer; mode?: number; identity: string }
interface Input { root: string; hooksRelative: string; generation: string; projectionFingerprint: string; workerSha256: string; runtimeSha256: string; before: Snapshot }
interface Preview { operation: "install"; hookRelative: string; existing: boolean; originalBytes: number; workerSha256: string; runtimeSha256: string }
interface Receipt { version: 1; generation: string; root: string; hooksRelative: string; backup: string; beforeDigest: string; afterDigest: string; originalPresent: boolean; originalMode?: number; mode: number }
interface Prepared { pin: Buffer; withdraw(): void | Promise<void> }
interface Deps {
    current(): boolean; confirm(preview: Preview): Promise<boolean>; read(): Snapshot | undefined;
    queryProjection(): Promise<string | undefined>; prepare(): Promise<Prepared | undefined>;
    backups: { store(originalPath: string, content: string): Promise<string>; retrieve(handle: string): Promise<string | null> };
    save(receipt: Receipt, state: State): Promise<void>;
    write(expected: Snapshot, bytes: Buffer | undefined, mode: number | undefined): boolean;
}
interface Transaction { run(deps: Deps): Promise<Readonly<{ status: Status }>> }
type Factory = new (input: Input) => Transaction;
type WriteMode = "apply" | "false-original" | "throw-original" | "false-after" | "throw-after";
const snapshot = (value: Snapshot): Snapshot => ({ identity: value.identity, bytes: value.bytes === undefined ? undefined : Buffer.from(value.bytes), mode: value.mode });
const same = (a: Snapshot | undefined, b: Snapshot | undefined) => !!a && !!b && a.identity === b.identity && a.mode === b.mode
    && (a.bytes === undefined ? b.bytes === undefined : Buffer.isBuffer(b.bytes) && a.bytes.equals(b.bytes));
function rawPin(overrides: Record<string, unknown> = {}): Buffer {
    return Buffer.from(JSON.stringify({ version: 1, root: ROOT, generation: GENERATION, publicKey: PUBLIC_KEY,
        worker: "C:\\Synthetic Extension\\pre-commit-client.js", workerSha256: WORKER,
        runtime: "C:\\Synthetic Code\\Code.exe", runtimeSha256: RUNTIME,
        descriptor: "C:\\Synthetic Profile\\pre-commit-endpoint.json", systemRoot: "C:\\Windows", ...overrides }));
}
interface Model {
    state: Snapshot; original: Snapshot; input: Input; events: string[];
    counts: { confirm: number; read: number; query: number; prepare: number; store: number; retrieve: number; withdraw: number };
    previews: Preview[]; saves: { receipt: Receipt; state: State }[];
    writes: { expected: Snapshot; bytes?: Buffer; mode?: number }[]; backupCalls: { path: string; content: string }[];
    backupText?: string; hooks: Record<string, (model: Model) => void>;
    control: { enabled: unknown; confirm: boolean; pin: Buffer; projection?: string; prepareMissing: boolean; prepareThrow: boolean;
        storeThrow: boolean; retrieveThrow: boolean; retrieved?: string | null; backupHandle: string;
        saveThrow: Set<State>; readUnavailable: boolean; readThrow: boolean; writeModes: WriteMode[]; withdrawThrow: boolean };
}
async function fixture(settings: { absent?: boolean; before?: Buffer; mode?: number; input?: Partial<Input> } = {}) {
    const module = await import("../history-hooks/PreCommitHookTransaction");
    assert(typeof module.PreCommitHookTransaction === "function", "The frozen private hook transaction must exist.");
    const before: Snapshot = { bytes: settings.absent ? undefined : Buffer.from(settings.before ?? ORIGINAL),
        mode: settings.absent ? undefined : settings.mode ?? 0o755, identity: BEFORE_ID };
    const input: Input = { root: ROOT, hooksRelative: HOOKS, generation: GENERATION, projectionFingerprint: PROJECTION,
        workerSha256: WORKER, runtimeSha256: RUNTIME, before, ...settings.input };
    const model: Model = { state: snapshot(before), original: snapshot(before), input, events: [],
        counts: { confirm: 0, read: 0, query: 0, prepare: 0, store: 0, retrieve: 0, withdraw: 0 },
        previews: [], saves: [], writes: [], backupCalls: [], hooks: {},
        control: { enabled: true, confirm: true, pin: rawPin(), projection: PROJECTION, prepareMissing: false, prepareThrow: false,
            storeThrow: false, retrieveThrow: false, backupHandle: BACKUP, saveThrow: new Set(), readUnavailable: false,
            readThrow: false, writeModes: [], withdrawThrow: false } };
    const action = (name: string) => { model.events.push(name); model.hooks[name]?.(model); };
    const deps: Deps = {
        current: () => { action("current"); return model.control.enabled as boolean; },
        confirm: async preview => { model.counts.confirm++; model.previews.push({ ...preview }); action("confirm"); return model.control.confirm; },
        read: () => { model.counts.read++; action("read"); if (model.control.readThrow) throw Error(PRIVATE);
            return model.control.readUnavailable ? undefined : snapshot(model.state); },
        queryProjection: async () => { model.counts.query++; action("query"); return model.control.projection; },
        prepare: async () => {
            model.counts.prepare++; action("prepare"); if (model.control.prepareThrow) throw Error(PRIVATE);
            if (model.control.prepareMissing) return undefined;
            return { pin: Buffer.from(model.control.pin), withdraw: async () => { model.counts.withdraw++; action("withdraw"); if (model.control.withdrawThrow) throw Error(PRIVATE); } };
        },
        backups: {
            store: async (path, content) => { model.counts.store++; model.backupCalls.push({ path, content }); action("store");
                if (model.control.storeThrow) throw Error(PRIVATE); model.backupText = content; return model.control.backupHandle; },
            retrieve: async handle => { model.counts.retrieve++; assert(handle === model.control.backupHandle, "Readback must use the exact encrypted backup handle.");
                action("retrieve"); if (model.control.retrieveThrow) throw Error(PRIVATE);
                return model.control.retrieved === undefined ? model.backupText ?? null : model.control.retrieved; },
        },
        save: async (receipt, state) => {
            model.saves.push({ receipt: { ...receipt }, state }); action("save:" + state);
            if (model.control.saveThrow.has(state)) throw Error(PRIVATE);
        },
        write: (expected, bytes, mode) => {
            model.writes.push({ expected: snapshot(expected), bytes: bytes === undefined ? undefined : Buffer.from(bytes), mode }); action("write");
            if (!same(expected, model.state)) return false;
            const behavior = model.control.writeModes.shift() ?? "apply";
            if (behavior === "false-original") return false; if (behavior === "throw-original") throw Error(PRIVATE);
            model.state = { bytes: bytes === undefined ? undefined : Buffer.from(bytes), mode,
                identity: String(model.writes.length + 1).repeat(64).slice(0, 64) };
            action("afterWrite");
            if (behavior === "false-after") return false; if (behavior === "throw-after") throw Error(PRIVATE); return true;
        },
    };
    const tx = new (module.PreCommitHookTransaction as unknown as Factory)(input);
    assert(model.events.length === 0, "Transaction construction must copy private input without performing dependency I/O.");
    return { tx, deps, model, run: () => tx.run(deps) };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
function result(value: Readonly<{ status: Status }>, expected: Status): void {
    assert(value && Object.isFrozen(value) && Reflect.ownKeys(value).length === 1 && Reflect.ownKeys(value)[0] === "status", "Only a frozen fixed status may leave the private transaction.");
    assert(value.status === expected, "The guarded transaction must return the expected fixed lifecycle state.");
    const encoded = JSON.stringify(value);
    for (const privateValue of [PRIVATE, ROOT, HOOK, ORIGINAL.toString("base64")]) assert(!encoded.includes(privateValue), "Results must not expose original body/path/backup payload or raw errors.");
}
function noSensitive(f: Fixture): void {
    const m = f.model; assert(m.counts.prepare === 0 && m.counts.store === 0 && m.counts.retrieve === 0 && m.saves.length === 0 && m.writes.length === 0,
        "Unavailable or cancelled review must create no service/key, backup, durable record or write.");
}
function withdrawn(f: Fixture): void { assert(f.model.counts.withdraw === 1, "Every unsuccessful prepared attempt must withdraw exactly once, without leaking cleanup errors."); }
function receipt(value: Receipt, existing: boolean, mode: number): void {
    const fields = Reflect.ownKeys(value).filter(key => key !== "originalMode").sort().join(",");
    assert(fields === "afterDigest,backup,beforeDigest,generation,hooksRelative,mode,originalPresent,root,version", "Private receipt must use the exact value-free recovery schema.");
    assert(value.version === 1 && value.root === ROOT && value.hooksRelative === HOOKS && value.generation === GENERATION && value.backup === BACKUP,
        "Recovery receipt binds the reviewed root, generation, hook location and opaque encrypted backup handle.");
    assert(/^[a-f0-9]{64}$/.test(value.beforeDigest) && /^[a-f0-9]{64}$/.test(value.afterDigest) && value.beforeDigest !== value.afterDigest,
        "Private recovery receipt must bind distinct bounded before/after digests without exposing originals in public UI.");
    assert(value.originalPresent === existing && value.mode === mode, "Receipt must retain applicable output mode and original presence.");
    assert(!JSON.stringify(value).includes(PRIVATE) && !JSON.stringify(value).includes(ORIGINAL.toString("base64")), "Recovery metadata cannot include original body or encoded raw backup payload.");
}

test("F26a hook transaction current authority is strict with no default or truthy enable fallback", async () => {
    for (const enabled of [false, undefined, null, 0, 1, "true"]) {
        const f = await fixture(); f.model.control.enabled = enabled; result(await f.run(), "UNAVAILABLE");
        noSensitive(f); assert(f.model.counts.confirm === 0, "Disabled authority must refuse before native review.");
    }
});
test("F26a hook transaction owner cancellation precedes every key service backup record and mutation", async () => {
    const f = await fixture(); f.model.control.confirm = false; result(await f.run(), "CANCELLED"); noSensitive(f);
    assert(f.model.counts.confirm === 1, "Exactly one native owner confirmation is required.");
});
test("F26a hook transaction privately copies original bytes and rejects duplicate runs without new authority", async () => {
    const f = await fixture(); f.model.input.before.bytes!.fill(0); result(await f.run(), "APPLIED");
    assert(f.model.state.bytes?.subarray(-ORIGINAL.length + 10).equals(ORIGINAL.subarray(10)), "Caller Buffer mutation after construction cannot change captured original recovery bytes.");
    const events = f.model.events.length; result(await f.run(), "UNAVAILABLE");
    assert(f.model.events.length === events && f.model.counts.confirm === 1 && f.model.counts.prepare === 1, "Duplicate run must not call any dependency or replace held state.");
});
test("F26a hook transaction useful absent install stores exact absence and platform-applicable mode", async () => {
    const f = await fixture({ absent: true }); result(await f.run(), "APPLIED");
    const m = f.model, preview = m.previews[0], payload = JSON.parse(m.backupCalls[0].content);
    assert(preview.operation === "install" && preview.hookRelative === HOOK && !preview.existing && preview.originalBytes === 0
        && preview.workerSha256 === WORKER && preview.runtimeSha256 === RUNTIME, "Owner preview must identify the finite operation without original body.");
    assert(Reflect.ownKeys(preview).sort().join(",") === "existing,hookRelative,operation,originalBytes,runtimeSha256,workerSha256", "Preview may expose only the announced value-free fields.");
    assert(m.backupCalls[0].path === win32.join(ROOT, ...HOOK.split("/")) && payload.version === 1 && payload.present === false && payload.mode === null && payload.bytes === null,
        "Encrypted backup boundary must receive exact absence under the captured absolute hook path.");
    assert(m.state.bytes?.toString().startsWith("#!/bin/sh\n") && m.state.bytes?.toString().endsWith("exit 0\n") && m.state.mode === ABSENT_MODE,
        "Absent install remains useful with the actual applicable new-file mode.");
    assert(m.saves.map(row => row.state).join(",") === "PREPARED,APPLIED" && m.counts.withdraw === 0, "Prepared recovery must precede an applied receipt, retaining the live service only on APPLIED.");
    receipt(m.saves[1].receipt, false, ABSENT_MODE); assert(m.saves[1].receipt.originalMode === undefined, "Absent original has no invented mode.");
});
test("F26a hook transaction preserves supported original body exit7 and exact existing modes in private recovery", async () => {
    for (const mode of [0o755, 0o666]) {
        const f = await fixture({ mode }); result(await f.run(), "APPLIED"); const m = f.model, after = m.state.bytes!, text = after.toString();
        assert(text.startsWith("#!/bin/sh\n# SoterAI Lite pre-commit v1 " + GENERATION + "\n") && text.endsWith(ORIGINAL.subarray(10).toString()), "New finite prefix must preserve the original shell body and exit7 exactly.");
        assert(text.indexOf(PRIVATE) === text.lastIndexOf(PRIVATE) && m.state.mode === mode, "Original body must occur exactly once and applicable existing mode must survive.");
        const payload = JSON.parse(m.backupCalls[0].content); assert(payload.version === 1 && payload.present === true && payload.mode === mode
            && Buffer.from(payload.bytes, "base64").equals(ORIGINAL), "Encrypted backup input must retain exact original body/mode, never a plaintext sibling.");
        assert(m.counts.retrieve === 1 && !JSON.stringify(m.previews).includes(PRIVATE), "Encrypted readback is mandatory and previews cannot include body text.");
        receipt(m.saves[m.saves.length - 1].receipt, true, mode); assert(m.saves[m.saves.length - 1].receipt.originalMode === mode, "Private original mode remains exact.");
    }
});
test("F26a hook transaction malformed or mismatched prepared pins cannot reach backups or writes", async () => {
    for (const bytes of [Buffer.from("{}"), rawPin({ root: "C:\\Other Synthetic Repo" }), rawPin({ generation: "b1234567-1234-4567-8123-123456789abc" }),
        rawPin({ workerSha256: "e".repeat(64) }), rawPin({ runtimeSha256: "f".repeat(64) })]) {
        const f = await fixture(); f.model.control.pin = bytes; result(await f.run(), "UNAVAILABLE"); withdrawn(f);
        assert(f.model.counts.prepare === 1 && f.model.counts.store === 0 && f.model.saves.length === 0 && f.model.writes.length === 0, "Only a matching canonical prepared public pin may enter backup custody.");
    }
});
test("F26a hook transaction unsupported originals refuse before modal key service and backup creation", async () => {
    for (const before of [Buffer.alloc(0), Buffer.from("#!/bin/bash\nexit 7\n"), Buffer.from("#!/bin/sh -e\nexit 7\n"), Buffer.from("#!/bin/sh\r\nexit 7\r\n"),
        Buffer.from("\uFEFF#!/bin/sh\nexit 7\n"), Buffer.from("#!/bin/sh\n\0"), Buffer.concat([Buffer.from("#!/bin/sh\n"), Buffer.from([255])]),
        Buffer.from("#!/bin/sh\n" + "#".repeat(65536)), Buffer.from("#!/bin/sh\n# SoterAI Lite pre-commit v1 existing\nexit 7\n")]) {
        const f = await fixture({ before }); result(await f.run(), "UNAVAILABLE"); noSensitive(f);
        assert(f.model.counts.confirm === 0, "Known unsupported original must refuse before owner modal or prepared service creation.");
    }
});
test("F26a hook transaction preparation key errors or absent authority cannot write or fabricate cleanup ownership", async () => {
    for (const kind of ["missing", "throw"] as const) {
        const f = await fixture(); f.model.control.prepareMissing = kind === "missing"; f.model.control.prepareThrow = kind === "throw";
        result(await f.run(), "UNAVAILABLE");
        assert(f.model.counts.prepare === 1 && f.model.counts.withdraw === 0 && f.model.counts.store === 0 && f.model.writes.length === 0 && f.model.saves.length === 0,
            "Failure before a prepared lease exists cannot create backups, writes or invented withdrawal receipts.");
    }
});
test("F26a hook transaction encrypted backup failure or nonexact readback refuses every write and withdraws once", async () => {
    for (const kind of ["store", "missing", "changed", "throw", "bad-handle", "cleanup-throw"] as const) {
        const f = await fixture();
        if (kind === "store" || kind === "cleanup-throw") f.model.control.storeThrow = true;
        if (kind === "cleanup-throw") f.model.control.withdrawThrow = true;
        if (kind === "missing") f.model.control.retrieved = null;
        if (kind === "changed") f.model.hooks.retrieve = m => { m.control.retrieved = " " + m.backupText; };
        if (kind === "throw") f.model.control.retrieveThrow = true;
        if (kind === "bad-handle") f.model.control.backupHandle = "D".repeat(32);
        result(await f.run(), "UNAVAILABLE"); withdrawn(f);
        assert(f.model.writes.length === 0 && f.model.saves.length === 0, "Missing or byte-different encrypted readback cannot acquire a durable/write phase.");
    }
});
test("F26a hook transaction durable PREPARED success is required before the first guarded write", async () => {
    const failed = await fixture(); failed.model.control.saveThrow.add("PREPARED"); result(await failed.run(), "UNAVAILABLE"); withdrawn(failed);
    assert(failed.model.writes.length === 0 && !failed.model.saves.some(row => row.state === "APPLIED"), "A failing durable preparation write cannot mutate the hook.");
    const live = await fixture(); result(await live.run(), "APPLIED");
    const events = live.model.events;
    assert(events.indexOf("confirm") < events.indexOf("prepare") && events.indexOf("prepare") < events.indexOf("store")
        && events.indexOf("store") < events.indexOf("retrieve") && events.indexOf("retrieve") < events.indexOf("save:PREPARED")
        && events.indexOf("save:PREPARED") < events.indexOf("write"), "Owner review, preparation, encrypted exact readback and durable PREPARED must precede mutation in order.");
});
test("F26a hook transaction pre-key source identity mode or projection drift refuses before preparation", async () => {
    for (const kind of ["bytes", "identity", "mode", "projection", "flag"] as const) {
        const f = await fixture(); f.model.hooks.confirm = m => {
            if (kind === "bytes") m.state.bytes = Buffer.from("#!/bin/sh\n# owner edit\nexit 8\n");
            if (kind === "identity") m.state.identity = "4".repeat(64);
            if (kind === "mode") m.state.mode = 0o666;
            if (kind === "projection") m.control.projection = "4".repeat(64);
            if (kind === "flag") m.control.enabled = false;
        };
        result(await f.run(), "UNAVAILABLE"); noSensitive(f);
    }
});
test("F26a hook transaction post-prepare source identity projection and live flag races prevent first write", async () => {
    for (const kind of ["bytes", "identity", "mode", "projection", "flag"] as const) {
        const f = await fixture(); f.model.hooks["save:PREPARED"] = m => {
            if (kind === "bytes") m.state.bytes = Buffer.from("#!/bin/sh\n# owner changed after review\nexit 8\n");
            if (kind === "identity") m.state.identity = "5".repeat(64);
            if (kind === "mode") m.state.mode = 0o666;
            if (kind === "projection") m.control.projection = "5".repeat(64);
            if (kind === "flag") m.control.enabled = false;
        };
        result(await f.run(), "UNAVAILABLE"); withdrawn(f);
        assert(f.model.writes.length === 0 && !f.model.saves.some(row => row.state === "APPLIED"), "Fresh final projection/source/current checks must defeat stale pre-write approval.");
    }
});
test("F26a hook transaction failed write with exact original preserved reports unavailable without overwriting it", async () => {
    for (const mode of ["false-original", "throw-original"] as const) {
        const f = await fixture(); f.model.control.writeModes = [mode]; result(await f.run(), "UNAVAILABLE"); withdrawn(f);
        assert(f.model.writes.length === 1 && same(f.model.state, f.model.original), "A refused write cannot justify another hook mutation when original bytes/identity/mode remain exact.");
        assert(f.model.saves.some(row => row.state === "INCOMPLETE") && !f.model.saves.some(row => row.state === "APPLIED"), "Durable PREPARED must receive best-effort not-installed bookkeeping after write failure.");
    }
});
test("F26a hook transaction failed write that nevertheless installed exact owned after bytes safely rolls back", async () => {
    for (const behavior of ["false-after", "throw-after"] as const) {
        const f = await fixture(); f.model.control.writeModes = [behavior]; result(await f.run(), "ROLLED_BACK"); withdrawn(f);
        assert(f.model.writes.length === 2 && f.model.state.bytes?.equals(ORIGINAL) && f.model.state.mode === 0o755,
            "A failed operation that left exact owned after bytes must restore original bytes and mode through one guarded rollback.");
        assert(f.model.writes[1].expected.identity !== BEFORE_ID && f.model.writes[1].bytes?.equals(ORIGINAL), "Rollback must expect current owned identity rather than stale pre-install identity.");
        assert(f.model.saves.some(row => row.state === "ROLLED_BACK"), "Exact rollback readback must be durably recorded.");
    }
});
test("F26a hook transaction postwrite projection and APPLIED save failures roll back only exact owned after bytes", async () => {
    for (const kind of ["projection", "save", "identity-changed"] as const) {
        const f = await fixture();
        if (kind === "projection") f.model.hooks.query = m => { if (m.writes.length === 1) m.control.projection = "6".repeat(64); };
        else { f.model.control.saveThrow.add("APPLIED"); if (kind === "identity-changed") f.model.hooks["save:APPLIED"] = m => { m.state.identity = "6".repeat(64); }; }
        result(await f.run(), "ROLLED_BACK"); withdrawn(f);
        assert(f.model.writes.length === 2 && f.model.state.bytes?.equals(ORIGINAL) && f.model.state.mode === 0o755, "Owned exact after bytes may be restored even when atomic-write identity changed.");
        assert(f.model.saves.some(row => row.state === "ROLLED_BACK"), "Rollback must retain durable exact recovery evidence.");
    }
});
test("F26a hook transaction final read and current are synchronous with a paired immediate withdrawal control", async () => {
    for (const immediate of [true, false]) {
        const f = await fixture(); let observed = false;
        f.model.hooks.read = m => {
            if (observed || !m.saves.some(row => row.state === "APPLIED") || m.writes.length !== 1) return;
            observed = true;
            if (immediate) m.control.enabled = false; else queueMicrotask(() => { m.control.enabled = false; });
        };
        result(await f.run(), immediate ? "ROLLED_BACK" : "APPLIED");
        assert(observed && f.model.control.enabled === false, "The final-read callback must exercise the actual completion boundary.");
        if (immediate) { withdrawn(f); assert(f.model.state.bytes?.equals(ORIGINAL), "Synchronous final withdrawal must safely restore exact owned bytes."); }
        else assert(f.model.counts.withdraw === 0 && f.model.writes.length === 1, "No await may be inserted between final read/current/return; later microtask withdrawal is a separate publication guard responsibility.");
    }
});
test("F26a hook transaction preserves owner-edited or unknown bytes and records incomplete recovery", async () => {
    for (const kind of ["bytes", "mode", "unknown"] as const) {
        const f = await fixture(), edited = Buffer.from("#!/bin/sh\n# synthetic owner edit after install\nexit 9\n");
        f.model.hooks.afterWrite = m => { if (m.writes.length !== 1) return;
            if (kind === "bytes") m.state.bytes = Buffer.from(edited);
            if (kind === "mode") m.state.mode = 0o644;
            if (kind === "unknown") m.control.readUnavailable = true;
        };
        result(await f.run(), "INCOMPLETE"); withdrawn(f);
        assert(f.model.writes.length === 1 && f.model.saves.some(row => row.state === "INCOMPLETE"), "Unknown or edited state must never be overwritten by rollback and must retain recovery status.");
        if (kind === "bytes") assert(f.model.state.bytes?.equals(edited), "Owner edit must remain byte exact.");
        if (kind === "mode") assert(f.model.state.mode === 0o644, "Owner mode change must remain exact.");
    }
});
test("F26a hook transaction rollback write readback or durable-save failure remains incomplete with one cleanup attempt", async () => {
    for (const kind of ["write", "readback", "save"] as const) {
        const f = await fixture(); f.model.hooks.query = m => { if (m.writes.length === 1) m.control.projection = "7".repeat(64); };
        if (kind === "write") f.model.control.writeModes = ["apply", "false-original"];
        if (kind === "readback") f.model.hooks.afterWrite = m => { if (m.writes.length === 2) m.state.bytes = Buffer.from("#!/bin/sh\n# owner bytes during rollback\nexit 9\n"); };
        if (kind === "save") f.model.control.saveThrow.add("ROLLED_BACK");
        result(await f.run(), "INCOMPLETE"); withdrawn(f);
        assert(f.model.writes.length === 2 && f.model.saves.some(row => row.state === "INCOMPLETE"), "Failed exact recovery cannot be promoted or retried over unknown owner state.");
    }
});
