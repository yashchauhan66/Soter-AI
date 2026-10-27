import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, writeFile, readFile } from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";
import type { CheckedHookIndex } from "../history-hooks/CheckedHookIndex";

// TEST FIRST. Genuine capabilities from retained manual DIRC synthetic roots.
// Every process below is a fake object; no Git or other child is launched.
const PROVIDER = "sk-proj-" + "SYNTHETIC_F07_PROVIDER_ONLY_VALUE".repeat(2);
const OPAQUE = "a".repeat(40);
const VERSION = Buffer.from("git version 2.53.0.windows.1\n");
const CONFIG = "[core]\n repositoryformatversion = 0\n bare = false\n";
const options = { skip: process.platform !== "win32", timeout: 10000 };
type Status = "ALLOW" | "BLOCK" | "UNAVAILABLE" | "STOP_UNCONFIRMED";
type Result = Readonly<{ status: Status }>;
type Row = Readonly<{ path: string; oid: string; mode: "100644" | "100755"; raw: Buffer }>;
type Operation = Readonly<{ kind: "version" | "entries" } | { kind: "sizes"; oids: readonly string[] } | { kind: "batch"; objects: readonly Readonly<{ oid: string; size: number }>[] }>;
type Outcome = Readonly<{ status: "COMPLETE"; bytes: Buffer } | { status: "UNAVAILABLE" | "STOP_UNCONFIRMED" }>;
interface ProcessOptions { index: CheckedHookIndex; operation: Operation; valid: () => boolean; deadline: number; now?: () => number }
interface Process { start(): Promise<Outcome>; readonly closed: Promise<void>; readonly busy: boolean; withdraw(): void }
interface ScanOptions { index: CheckedHookIndex; valid: () => boolean; deadline: number; now?: () => number; createProcess?: (options: ProcessOptions) => Process }
interface Scan { start(): Promise<Result>; readonly closed: Promise<void>; readonly busy: boolean; withdraw(): void; canRelease(result: Result): boolean }
type Factory = new (options: ScanOptions) => Scan;
const tick = async () => { await new Promise<void>(done => setImmediate(done)); };
async function until(test: () => boolean): Promise<void> { for (let i = 0; i < 40 && !test(); i++) await tick(); assert(test(), "The finite fake process transition must become observable."); }
const hash = (raw: Buffer) => createHash("sha1").update("blob " + raw.length + "\0").update(raw).digest("hex");
function file(path: string, text: string | Buffer, mode: Row["mode"] = "100644"): Row {
    const raw = typeof text === "string" ? Buffer.from(text) : Buffer.from(text); return { path, raw, mode, oid: hash(raw) };
}
function indexBytes(rows: readonly Row[]): Buffer {
    const header = Buffer.alloc(12); header.write("DIRC", 0, "ascii"); header.writeUInt32BE(2, 4); header.writeUInt32BE(rows.length, 8);
    const entries = rows.map(row => {
        const name = Buffer.from(row.path), entry = Buffer.alloc(Math.ceil((62 + name.length + 1) / 8) * 8);
        entry.writeUInt32BE(parseInt(row.mode, 8), 24); Buffer.from(row.oid, "hex").copy(entry, 40); entry.writeUInt16BE(name.length, 60); name.copy(entry, 62); return entry;
    });
    const body = Buffer.concat([header, ...entries]); return Buffer.concat([body, createHash("sha1").update(body).digest()]);
}
async function syntheticIndex(rows: readonly Row[]): Promise<CheckedHookIndex> {
    const root = await mkdtemp(join(tmpdir(), "soter-f26a-scan-"));
    for (const relative of ["objects/info", "objects/pack", "refs/heads"]) await mkdir(join(root, ".git", ...relative.split("/")), { recursive: true });
    await writeFile(join(root, ".git", "config"), CONFIG, { flag: "wx" });
    await writeFile(join(root, ".git", "HEAD"), "ref: refs/heads/main\n", { flag: "wx" });
    await writeFile(join(root, ".git", "index"), indexBytes(rows), { flag: "wx" });
    const { prepareCheckedHookIndex } = await import("../history-hooks/CheckedHookIndex");
    const index = await prepareCheckedHookIndex(root, undefined, { SystemRoot: process.env.SystemRoot, WINDIR: process.env.WINDIR, COMSPEC: process.env.COMSPEC }, () => true);
    assert(index, "Manual synthetic DIRC fixture must acquire a genuine checked index without a Git child."); return index;
}
async function implementation(): Promise<Factory> {
    const module = await import("../history-hooks/PreCommitScan");
    assert(typeof module.PreCommitScan === "function", "The frozen private pre-commit scanner must exist."); return module.PreCommitScan as unknown as Factory;
}
class FakeProcess implements Process {
    readonly closed: Promise<void>; readonly outcome: Promise<Outcome>;
    private resolveClose!: () => void; private resolveOutcome!: (value: Outcome) => void;
    private replied = false; private ended = false; private active = false;
    starts = 0; withdrawals = 0;
    constructor(readonly request: ProcessOptions, readonly output: Buffer, readonly auto: boolean,
        private readonly afterFinish?: (process: FakeProcess) => void, readonly failure?: "UNAVAILABLE") {
        this.closed = new Promise(done => this.resolveClose = done); this.outcome = new Promise(done => this.resolveOutcome = done);
    }
    get busy(): boolean { return this.active; }
    private reply(value: Outcome): void { if (!this.replied) { this.replied = true; this.resolveOutcome(value); } }
    start(): Promise<Outcome> {
        this.starts++; this.active = true;
        if (this.auto) queueMicrotask(() => this.finish()); return this.outcome;
    }
    completeBeforeClose(): void { this.reply(Object.freeze({ status: "COMPLETE", bytes: Buffer.from(this.output) })); }
    finish(): void {
        if (this.ended) return; this.ended = true; this.active = false; this.afterFinish?.(this);
        this.reply(this.failure ? Object.freeze({ status: this.failure }) : Object.freeze({ status: "COMPLETE", bytes: Buffer.from(this.output) }));
        this.resolveClose();
    }
    withdraw(): void { this.withdrawals++; if (this.active) this.reply(Object.freeze({ status: "STOP_UNCONFIRMED" })); }
}
interface FixtureOptions {
    index?: CheckedHookIndex; valid?: () => boolean; deadline?: number; now?: () => number;
    hold?: Operation["kind"]; failure?: Operation["kind"];
    response?: (operation: Operation, expected: Buffer) => Buffer;
    afterFinish?: (process: FakeProcess) => void;
}
async function fixture(rows: readonly Row[] = [file("public.txt", "Useful ordinary public text.\n")], settings: FixtureOptions = {}) {
    const Constructor = await implementation(), index = settings.index ?? await syntheticIndex(rows), processes: FakeProcess[] = [];
    const unique = new Map<string, Row>(); for (const row of rows) if (!unique.has(row.oid)) unique.set(row.oid, row);
    const expected = (operation: Operation): Buffer => {
        if (operation.kind === "version") return Buffer.from(VERSION);
        if (operation.kind === "entries") return Buffer.from(index.entries.map(row => row.mode + " " + row.oid + " 0\t" + row.path + "\0").join(""));
        if (operation.kind === "sizes") return Buffer.from(operation.oids.map(oid => { const row = unique.get(oid); assert(row, "Sizes may request only staged fixture identities."); return oid + " blob " + row.raw.length + "\n"; }).join(""));
        assert(operation.kind === "batch", "Only the four fixed operation kinds may be requested.");
        return Buffer.concat(operation.objects.map(object => { const row = unique.get(object.oid); assert(row, "Batch may request only staged fixture identities."); return Buffer.concat([Buffer.from(object.oid + " blob " + row.raw.length + "\n"), row.raw, Buffer.from("\n")]); }));
    };
    const createProcess = (request: ProcessOptions): Process => {
        const output = expected(request.operation), process = new FakeProcess(request, settings.response?.(request.operation, output) ?? output,
            settings.hold !== request.operation.kind, settings.afterFinish, settings.failure === request.operation.kind ? "UNAVAILABLE" : undefined);
        processes.push(process); return process;
    };
    const scanner = new Constructor({ index, valid: settings.valid ?? (() => true), deadline: settings.deadline ?? 61000, now: settings.now ?? (() => 1000), createProcess });
    let settled = false, closed = false; void scanner.closed.then(() => { closed = true; });
    return { scanner, index, rows, processes, get settled() { return settled; }, get closed() { return closed; },
        start() { return scanner.start().then(value => { settled = true; return value; }); },
        async begin() { const result = this.start(); await until(() => processes.length > 0 && processes[0].starts > 0); return { result }; } };
}
function outcome(value: Result, status: Status): void {
    assert(value && Object.isFrozen(value), "Scanner results must be frozen.");
    assert(Reflect.ownKeys(value).length === 1 && Reflect.ownKeys(value)[0] === "status", "Only fixed status leaves the private scanner; no raw/path/snippet/ledger metadata.");
    assert(value.status === status, "The complete owned scan must have the expected fixed status.");
    const encoded = JSON.stringify(value); assert(!encoded.includes(PROVIDER) && !encoded.includes(OPAQUE), "Private fixtures must not enter scanner results.");
}
async function watchWorktree<T>(target: string, work: () => Promise<T>): Promise<{ result: T; reads: number }> {
    const fs = require("node:fs") as typeof import("node:fs"), originalRead = fs.readFileSync, originalOpen = fs.openSync; let reads = 0;
    const matches = (value: unknown) => typeof value === "string" && resolve(value).toLowerCase() === resolve(target).toLowerCase();
    try {
        fs.readFileSync = ((...args: Parameters<typeof originalRead>) => { if (matches(args[0])) reads++; return originalRead(...args); }) as typeof originalRead;
        fs.openSync = ((...args: Parameters<typeof originalOpen>) => { if (matches(args[0])) reads++; return originalOpen(...args); }) as typeof originalOpen;
        syncBuiltinESMExports(); return { result: await work(), get reads() { return reads; } };
    } finally { fs.readFileSync = originalRead; fs.openSync = originalOpen; syncBuiltinESMExports(); }
}

test("F26a scan admits a complete public staged tree only through four exact private process phases", options, async () => {
    const f = await fixture(), result = await f.start(); outcome(result, "ALLOW"); await f.scanner.closed;
    assert(f.closed && !f.scanner.busy, "ALLOW requires completed ownership.");
    assert(f.processes.map(p => p.request.operation.kind).join(",") === "version,entries,sizes,batch", "Complete public scan must verify version, exact entries, sizes and object batch.");
    for (const process of f.processes) {
        assert(process.request.index === f.index && process.starts === 1 && !process.busy && process.withdrawals === 0, "Every finite process uses the captured index exactly once.");
        assert(process.request.valid() === true && process.request.deadline === 61000 && process.request.now?.() === 1000, "All processes inherit current validity and the whole-scan deadline.");
    }
    assert(f.scanner.canRelease(result), "Exact completed ALLOW may be released only while current authority remains live.");
});
test("F26a scan verifies version and exact empty listing but skips sizes and batch for an empty tree", options, async () => {
    const f = await fixture([]); outcome(await f.start(), "ALLOW"); await f.scanner.closed;
    assert(f.processes.map(p => p.request.operation.kind).join(",") === "version,entries", "Empty tree must not invent an object request.");
});
test("F26a scan blocks canonical staged provider candidates without releasing content or finding metadata", options, async () => {
    const f = await fixture([file("private.txt", PROVIDER)]); const result = await f.start(); outcome(result, "BLOCK"); await f.scanner.closed;
});
test("F26a scan blocks staged secret when the worktree is sanitized and never reads its body", options, async () => {
    const f = await fixture([file("owner.txt", PROVIDER)]), target = join(f.index.root, "owner.txt");
    await writeFile(target, "Public sanitized worktree.\n", { flag: "wx" });
    const watched = await watchWorktree(target, () => f.start()); outcome(watched.result, "BLOCK"); await f.scanner.closed;
    assert(watched.reads === 0, "Staged scanning must not use sanitized worktree fallback.");
    assert((await readFile(target, "utf8")) === "Public sanitized worktree.\n", "Scanner must preserve the worktree bytes.");
});
test("F26a scan allows public staged bytes despite an unstaged secret and never reads its body", options, async () => {
    const f = await fixture([file("owner.txt", "Public staged content.\n")]), target = join(f.index.root, "owner.txt");
    await writeFile(target, PROVIDER, { flag: "wx" });
    const watched = await watchWorktree(target, () => f.start()); outcome(watched.result, "ALLOW"); await f.scanner.closed;
    assert(watched.reads === 0, "Unstaged private worktree contents must not enter an effective-index scan.");
});
test("F26a scan preserves every path context when repeated object IDs have different canonical formats", options, async () => {
    const text = "PASSWORD=" + OPAQUE + "\n", rows = [file("public.txt", text), file(".env", text)];
    // Generic TXT must avoid this name-context trick: use the actual plaintext
    // opaque value, which is clean unregistered but a dotenv malformed line.
    // A second pair below proves shared bytes need a full format check as well.
    const f = await fixture([file("public.txt", OPAQUE), file(".env", OPAQUE)]);
    outcome(await f.start(), "UNAVAILABLE"); await f.scanner.closed;
    const contextual = await fixture(rows); outcome(await contextual.start(), "BLOCK"); await contextual.scanner.closed;
    const sizes = contextual.processes.find(p => p.request.operation.kind === "sizes")!.request.operation as Extract<Operation, { kind: "sizes" }>;
    assert(sizes.oids.length === 1, "Repeated identities should be fetched once while every source path is inspected.");
});
test("F26a scan keeps128 public staged entries useful and fetches repeated objects only once", options, async () => {
    const rows = Array.from({ length: 128 }, (_, i) => file("public/entry-" + String(i).padStart(3, "0") + ".txt", "Public shared bytes.\n"));
    const f = await fixture(rows); outcome(await f.start(), "ALLOW"); await f.scanner.closed;
    const sizes = f.processes.find(p => p.request.operation.kind === "sizes")!.request.operation as Extract<Operation, { kind: "sizes" }>;
    assert(sizes.oids.length === 1, "Unique object reads must not erase the128 inspected path contexts.");
});
test("F26a scan charges raw budget per path before object dedup with inclusive1MiB admission", options, async () => {
    const body = ".".repeat(65536), rows = Array.from({ length: 16 }, (_, i) => file("public/part-" + i + ".txt", body));
    const exact = await fixture(rows); outcome(await exact.start(), "ALLOW"); await exact.scanner.closed;
    const over = await fixture([...rows, file("public/part-16.txt", body)]); outcome(await over.start(), "UNAVAILABLE"); await over.scanner.closed;
    assert(!over.processes.some(p => p.request.operation.kind === "batch"), "Per-path oversize must be rejected before batch body admission despite one unique OID.");
});
test("F26a scan refuses an oversize object size before requesting batch bodies", options, async () => {
    const f = await fixture(undefined, { response: (op, expected) => op.kind === "sizes" ? Buffer.from((op as Extract<Operation, { kind: "sizes" }>).oids[0] + " blob 65537\n") : expected });
    outcome(await f.start(), "UNAVAILABLE"); await f.scanner.closed;
    assert(!f.processes.some(p => p.request.operation.kind === "batch"), "No batch may start after object-size refusal.");
});
test("F26a scan rejects path OID mode count and order listing drift against its exact captured index", options, async () => {
    const rows = [file("a.txt", "Public A"), file("b.txt", "Public B")], index = await syntheticIndex(rows);
    const correct = index.entries.map(row => row.mode + " " + row.oid + " 0\t" + row.path + "\0");
    for (const text of [correct[0], correct[1] + correct[0], correct.join("").replace("a.txt", "renamed.txt"), correct.join("").replace(rows[0].oid, "f".repeat(40)), correct.join("").replace("100644", "100755"), correct.join("") + correct[0]]) {
        const f = await fixture(rows, { index, response: (op, expected) => op.kind === "entries" ? Buffer.from(text) : expected });
        outcome(await f.start(), "UNAVAILABLE"); await f.scanner.closed;
        assert(!f.processes.some(p => p.request.operation.kind === "sizes"), "Listing disagreement must refuse before object requests.");
    }
});
test("F26a scan requires the exact pinned Git version before staged entry listing", options, async () => {
    const rows = [file("public.txt", "Public")], index = await syntheticIndex(rows);
    for (const text of ["git version 2.52.0.windows.1\n", "git version 2.53.0.windows.1 extra\n", "git version 2.53.0.windows.1\ntrailing\n"]) {
        const f = await fixture(rows, { index, response: (op, expected) => op.kind === "version" ? Buffer.from(text) : expected });
        outcome(await f.start(), "UNAVAILABLE"); await f.scanner.closed; assert(f.processes.length === 1, "Unpinned or ambiguous versions must not admit staged reads.");
    }
});
test("F26a scan cannot skip malformed or missing size rows before object batch", options, async () => {
    const rows = [file("a.txt", "Public A"), file("b.txt", "Public B")], index = await syntheticIndex(rows);
    for (const response of ["", rows[0].oid + " blob 8\n", rows[0].oid + " missing\n"]) {
        const f = await fixture(rows, { index, response: (op, expected) => op.kind === "sizes" ? Buffer.from(response) : expected });
        outcome(await f.start(), "UNAVAILABLE"); await f.scanner.closed; assert(!f.processes.some(p => p.request.operation.kind === "batch"), "Partial size metadata must not authorize a partial tree read.");
    }
});
test("F26a scan checks complete object framing and SHA1 before reporting an earlier candidate", options, async () => {
    const rows = [file("a-private.txt", PROVIDER), file("b-public.txt", "Public B")], index = await syntheticIndex(rows);
    for (const mutate of [(raw: Buffer) => raw.subarray(0, -1), (raw: Buffer) => { const bytes = Buffer.from(raw); bytes[bytes.length - 2] ^= 1; return bytes; }]) {
        const f = await fixture(rows, { index, response: (op, expected) => op.kind === "batch" ? mutate(expected) : expected });
        outcome(await f.start(), "UNAVAILABLE"); await f.scanner.closed;
    }
});
test("F26a scan rejects trailing batch records and bytes without a valid-prefix result", options, async () => {
    const f = await fixture([file("private.txt", PROVIDER)], { response: (op, expected) => op.kind === "batch" ? Buffer.concat([expected, Buffer.from("trailing\n")]) : expected });
    outcome(await f.start(), "UNAVAILABLE"); await f.scanner.closed;
});
test("F26a scan visits later known syntax failures even after an earlier staged candidate", options, async () => {
    const f = await fixture([file("a-private.txt", PROVIDER), file("b-malformed.ts", 'const password="' + PROVIDER + '"; const =')]);
    outcome(await f.start(), "UNAVAILABLE"); await f.scanner.closed;
});
test("F26a scan treats late binary or invalid UTF8 blob admission as whole-tree unavailable", options, async () => {
    for (const bytes of [Buffer.from([0xff]), Buffer.from([0]), Buffer.from([0xed, 0xa0, 0x80])]) {
        const f = await fixture([file("a-private.txt", PROVIDER), file("b-invalid.txt", bytes)]); outcome(await f.start(), "UNAVAILABLE"); await f.scanner.closed;
    }
});
test("F26a scan preserves canonical content work withholding after earlier candidate blobs", options, async () => {
    const f = await fixture([file("a-private.txt", PROVIDER), file("b-bounded.txt", '"public"\n'.repeat(3000))]);
    outcome(await f.start(), "UNAVAILABLE"); await f.scanner.closed;
});
test("F26a scan rejects forged index capabilities before process creation", options, async () => {
    const Constructor = await implementation(), genuine = await syntheticIndex([file("public.txt", "Public")]); let created = 0, reads = 0;
    const poison = new Proxy(genuine, { get() { reads++; throw Error("Synthetic proxy access forbidden."); } });
    for (const index of [{ ...genuine }, {}, null, poison]) {
        const scan = new Constructor({ index: index as never, valid: () => true, deadline: 61000, now: () => 1000,
            createProcess: () => { created++; throw Error("A forged capability must not create a process."); } });
        outcome(await scan.start(), "UNAVAILABLE"); await scan.closed; assert(!scan.busy, "Rejected capability must not own a child.");
    }
    assert(created === 0 && reads === 0, "Genuine capability admission precedes reads and process creation.");
});
test("F26a scan disabled and throwing owner validity create no private process", options, async () => {
    const rows = [file("public.txt", "Public")], index = await syntheticIndex(rows);
    for (const valid of [() => false, () => { throw Error("Synthetic private guard."); }]) {
        const f = await fixture(rows, { index, valid }); outcome(await f.start(), "UNAVAILABLE"); await f.scanner.closed;
        assert(f.processes.length === 0 && !f.scanner.busy, "Unavailable owner must not create any child phase.");
    }
});
test("F26a scan invalid initial clocks and deadlines refuse before every process", options, async () => {
    const rows = [file("public.txt", "Public")], index = await syntheticIndex(rows);
    for (const settings of [{ now: () => NaN }, { now: () => Infinity }, { deadline: 1000 }, { deadline: 999 }, { deadline: NaN }]) {
        const f = await fixture(rows, { index, ...settings }); outcome(await f.start(), "UNAVAILABLE"); await f.scanner.closed;
        assert(f.processes.length === 0, "Invalid initial whole-scan budget must refuse before process creation.");
    }
});
test("F26a scan uses one60second budget across all phases instead of renewing it per child", options, async () => {
    let clock = 1000;
    const f = await fixture(undefined, { deadline: 900000, now: () => clock, afterFinish: () => { clock += 21000; } });
    outcome(await f.start(), "UNAVAILABLE"); await f.scanner.closed;
    assert(f.processes.map(p => p.request.operation.kind).join(",") === "version,entries,sizes", "Aggregate elapsed time must prevent the batch phase.");
    assert(f.processes.every(p => p.request.deadline === 61000), "Every process receives the same bounded whole-scan deadline.");
});
test("F26a scan clock reversal between private phases is unavailable without a renewed budget", options, async () => {
    let clock = 1000;
    const f = await fixture(undefined, { now: () => clock, afterFinish: () => { clock = 999; } });
    outcome(await f.start(), "UNAVAILABLE"); await f.scanner.closed; assert(f.processes.length === 1, "Clock reversal must refuse before the next private phase.");
});
test("F26a scan cannot complete from a process result before that process actually closes", options, async () => {
    const f = await fixture(undefined, { hold: "version" }), { result } = await f.begin(), process = f.processes[0];
    process.completeBeforeClose(); await tick(); await tick();
    assert(!f.settled && !f.closed && f.scanner.busy, "A premature COMPLETE object must not replace actual process closure.");
    process.finish(); outcome(await result, "ALLOW"); await f.scanner.closed;
    assert(!f.scanner.busy, "All ownership must close before completed release.");
});
test("F26a scan active withdrawal returns STOP_UNCONFIRMED and stays busy until natural fake close", options, async () => {
    const f = await fixture(undefined, { hold: "version" }), { result } = await f.begin(), process = f.processes[0];
    f.scanner.withdraw(); outcome(await result, "STOP_UNCONFIRMED");
    assert(f.scanner.busy && !f.closed && process.busy && process.withdrawals >= 1, "Withdrawal must preserve real unfinished child ownership.");
    process.finish(); await f.scanner.closed;
    assert(!f.scanner.busy && f.processes.length === 1, "Natural close ends ownership without launching later phases.");
});
test("F26a scan exact held ALLOW is revoked by owner withdrawal and cannot be cloned or revived", options, async () => {
    let valid = true; const f = await fixture(undefined, { valid: () => valid }), result = await f.start(); outcome(result, "ALLOW"); await f.scanner.closed;
    assert(f.scanner.canRelease(result), "Current exact completed result may be released.");
    assert(!f.scanner.canRelease(Object.freeze({ status: "ALLOW" })), "A same-shaped result is not release identity.");
    assert(f.scanner.canRelease(result), "Rejecting a clone must not create or replace exact release identity.");
    valid = false; assert(!f.scanner.canRelease(result), "Final owner guard must revoke held ALLOW.");
    valid = true; assert(!f.scanner.canRelease(result), "Reenabling must not revive a withdrawn completed result.");
});
test("F26a scan final effective-index drift revokes completed ALLOW and byte restoration cannot revive it", options, async () => {
    const f = await fixture(), result = await f.start(); outcome(result, "ALLOW"); await f.scanner.closed;
    const before = await readFile(f.index.indexFile); assert(f.scanner.canRelease(result), "Exact current index initially permits held release.");
    await writeFile(f.index.indexFile, indexBytes([file("public.txt", "Different public staged bytes.")]));
    assert(!f.scanner.canRelease(result), "Final index identity/bytes must be recaptured before held release.");
    await writeFile(f.index.indexFile, before); assert(!f.scanner.canRelease(result), "Sticky index revocation survives restoring the old bytes.");
});
test("F26a scan duplicate starts and withdrawal before start never start another private process", options, async () => {
    const f = await fixture(), first = await f.start(); outcome(first, "ALLOW"); await f.scanner.closed;
    const count = f.processes.length; outcome(await f.scanner.start(), "UNAVAILABLE"); assert(f.processes.length === count, "Scanner ownership is one-shot.");
    const withdrawn = await fixture(); withdrawn.scanner.withdraw(); outcome(await withdrawn.start(), "UNAVAILABLE"); await withdrawn.scanner.closed;
    assert(withdrawn.processes.length === 0 && !withdrawn.scanner.busy, "Pre-start withdrawal must not create a child.");
    f.scanner.withdraw(); assert(!f.scanner.canRelease(first), "Explicit completed withdrawal revokes held ALLOW.");
});
test("F26a scan a closed unavailable process stops the tree without partial ALLOW or later phases", options, async () => {
    const f = await fixture(undefined, { failure: "sizes" }); outcome(await f.start(), "UNAVAILABLE"); await f.scanner.closed;
    assert(!f.scanner.busy && !f.processes.some(p => p.request.operation.kind === "batch"), "Closed transport refusal ends the scan without further admission.");
});
