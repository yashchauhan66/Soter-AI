import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { EventEmitter } from "node:events";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { PassThrough } from "node:stream";
import { test } from "node:test";
import type { ChildProcess, spawn } from "node:child_process";
import type { CheckedHookIndex } from "../history-hooks/CheckedHookIndex";

// Additive before-correction regressions. No original frozen18/28 tests edited.
// Genuine retained manual DIRC capability; every process/child is synthetic.
const VERSION = Buffer.from("git version 2.53.0.windows.1\n"), PUBLIC = Buffer.from("Useful ordinary public text.\n");
const OID = createHash("sha1").update("blob " + PUBLIC.length + "\0").update(PUBLIC).digest("hex");
const options = { skip: process.platform !== "win32", timeout: 10000 };
type ScanResult = Readonly<{ status: "ALLOW" | "BLOCK" | "UNAVAILABLE" | "STOP_UNCONFIRMED" }>;
type ProcessResult = Readonly<{ status: "COMPLETE"; bytes: Buffer } | { status: "UNAVAILABLE" | "STOP_UNCONFIRMED" }>;
interface Scan { start(): Promise<ScanResult>; readonly closed: Promise<void>; readonly busy: boolean; withdraw(): void; canRelease(value: ScanResult): boolean }
interface Process { start(): Promise<ProcessResult>; readonly closed: Promise<void>; readonly busy: boolean; withdraw(): void }
interface Request { operation: { kind: string; oids?: readonly string[]; objects?: readonly Readonly<{ oid: string; size: number }>[] } }
const tick = async () => { await new Promise<void>(done => setImmediate(done)); };
function manualIndex(): Buffer {
    const header = Buffer.alloc(12); header.write("DIRC", 0, "ascii"); header.writeUInt32BE(2, 4); header.writeUInt32BE(1, 8);
    const name = Buffer.from("public.txt"), row = Buffer.alloc(Math.ceil((62 + name.length + 1) / 8) * 8);
    row.writeUInt32BE(0o100644, 24); Buffer.from(OID, "hex").copy(row, 40); row.writeUInt16BE(name.length, 60); name.copy(row, 62);
    const body = Buffer.concat([header, row]); return Buffer.concat([body, createHash("sha1").update(body).digest()]);
}
async function syntheticIndex(): Promise<CheckedHookIndex> {
    const root = await mkdtemp(join(tmpdir(), "soter-f26a-final-guard-"));
    for (const directory of ["objects/info", "objects/pack", "refs/heads"]) await mkdir(join(root, ".git", ...directory.split("/")), { recursive: true });
    await writeFile(join(root, ".git", "config"), "[core]\n repositoryformatversion = 0\n bare = false\n", { flag: "wx" });
    await writeFile(join(root, ".git", "HEAD"), "ref: refs/heads/main\n", { flag: "wx" });
    await writeFile(join(root, ".git", "index"), manualIndex(), { flag: "wx" });
    const { prepareCheckedHookIndex } = await import("../history-hooks/CheckedHookIndex");
    const index = await prepareCheckedHookIndex(root, undefined, { SystemRoot: process.env.SystemRoot, WINDIR: process.env.WINDIR, COMSPEC: process.env.COMSPEC }, () => true);
    assert(index, "Manual DIRC review fixture must obtain a genuine index without executing Git."); return index;
}
class CompleteFake implements Process {
    readonly closed: Promise<void>; private close!: () => void; private active = false;
    constructor(readonly bytes: Buffer) { this.closed = new Promise(done => this.close = done); }
    get busy(): boolean { return this.active; }
    start(): Promise<ProcessResult> {
        this.active = true;
        return Promise.resolve().then(() => { this.active = false; this.close(); return Object.freeze({ status: "COMPLETE" as const, bytes: Buffer.from(this.bytes) }); });
    }
    withdraw(): void { /* Completed synthetic scanner processes own no live child. */ }
}
async function completedScan(callbacks: { valid?: (scanner: Scan) => boolean; now?: (scanner: Scan) => number } = {}) {
    const module = await import("../history-hooks/PreCommitScan"), index = await syntheticIndex(); let scanner!: Scan;
    const createProcess = (request: Request): Process => {
        const op = request.operation;
        if (op.kind === "version") return new CompleteFake(VERSION);
        if (op.kind === "entries") return new CompleteFake(Buffer.from("100644 " + OID + " 0\tpublic.txt\0"));
        if (op.kind === "sizes") return new CompleteFake(Buffer.from(OID + " blob " + PUBLIC.length + "\n"));
        assert(op.kind === "batch", "Review fixture permits only the fixed four scan phases.");
        return new CompleteFake(Buffer.concat([Buffer.from(OID + " blob " + PUBLIC.length + "\n"), PUBLIC, Buffer.from("\n")]));
    };
    scanner = new module.PreCommitScan({ index, valid: () => callbacks.valid?.(scanner) ?? true,
        deadline: 61000, now: () => callbacks.now?.(scanner) ?? 1000, createProcess: createProcess as never });
    const result = await scanner.start(); await scanner.closed;
    assert(result.status === "ALLOW" && !scanner.busy, "Public complete fake tree must provide a held ALLOW before final-guard challenge.");
    return { scanner, result, index };
}
async function whileWatchingIndex<T>(index: CheckedHookIndex, onRead: () => void, work: () => Promise<T>): Promise<T> {
    const fs = require("node:fs") as typeof import("node:fs"), original = fs.readFileSync;
    try {
        fs.readFileSync = ((...args: Parameters<typeof original>) => {
            if (typeof args[0] === "string" && resolve(args[0]).toLowerCase() === resolve(index.indexFile).toLowerCase()) onRead();
            return original(...args);
        }) as typeof original;
        syncBuiltinESMExports(); return await work();
    } finally { fs.readFileSync = original; syncBuiltinESMExports(); }
}
class Child extends EventEmitter {
    readonly pid = 48672; readonly stdin = new PassThrough({ autoDestroy: false });
    readonly stdout = new PassThrough({ autoDestroy: false }); readonly stderr = new PassThrough({ autoDestroy: false });
    killCalls = 0; destroys = 0;
    constructor() {
        super();
        for (const stream of [this.stdin, this.stdout, this.stderr]) stream.destroy = (() => { this.destroys++; throw Error("Synthetic review forbids forced pipe destruction."); }) as typeof stream.destroy;
    }
    kill(): never { this.killCalls++; throw Error("Synthetic review forbids process signals."); }
    async eof(): Promise<void> { this.stdout.end(); this.stderr.end(); await tick(); }
    async close(): Promise<void> { this.emit("close", 0, null); await tick(); }
}
async function processAtClose(callbacks: { valid?: (worker: Process) => boolean; now?: (worker: Process) => number } = {}) {
    const module = await import("../history-hooks/PreCommitGitProcess"), index = await syntheticIndex(), child = new Child(); let worker!: Process; let calls = 0;
    const fakeSpawn = (() => { calls++; return child as unknown as ChildProcess; }) as typeof spawn;
    worker = new module.PreCommitGitProcess({ index, operation: { kind: "version" }, valid: () => callbacks.valid?.(worker) ?? true,
        deadline: 61000, now: () => callbacks.now?.(worker) ?? 1000, spawn: fakeSpawn });
    const result = worker.start(); await tick(); assert(calls === 1 && worker.busy, "One fake owned child must be active before the close-join challenge.");
    child.stdout.write(VERSION); await child.eof();
    return { worker, index, child, result,
        async finish() {
            await child.close(); const value = await result; await worker.closed;
            assert(!worker.busy && child.killCalls === 0 && child.destroys === 0, "Natural close/EOF must drain without signals or destruction.");
            return value;
        } };
}
function unavailable(value: ProcessResult): void {
    assert(value.status === "UNAVAILABLE", "Reentrant withdrawal or elapsed final guard must not release COMPLETE after close/EOF.");
    assert(Reflect.ownKeys(value).length === 1 && Object.isFrozen(value), "Denied final transport result must be frozen status only.");
}

test("F26a final scan release observes withdrawal invoked inside an otherwise true owner callback", options, async () => {
    let armed = false, observed = 0;
    const f = await completedScan({ valid: scanner => { if (armed) { armed = false; observed++; scanner.withdraw(); } return true; } });
    assert(f.scanner.canRelease(f.result), "Exact held result is initially live."); armed = true;
    assert(!f.scanner.canRelease(f.result), "Reentrant owner withdrawal must defeat the same final release attempt.");
    assert(observed === 1 && !f.scanner.canRelease(f.result), "Observed withdrawal remains sticky after its callback returns true.");
});
test("F26a final scan release observes withdrawal invoked inside an otherwise valid clock callback", options, async () => {
    let armed = false, observed = 0;
    const f = await completedScan({ now: scanner => { if (armed) { armed = false; observed++; scanner.withdraw(); } return 1000; } });
    armed = true; assert(!f.scanner.canRelease(f.result), "Clock callback withdrawal must defeat the same final release attempt.");
    assert(observed === 1 && !f.scanner.canRelease(f.result), "Clock-triggered withdrawal cannot revive on another valid clock read.");
});
test("F26a final scan release charges time elapsed inside the owner validity callback", options, async () => {
    let armed = false, clock = 1000, observed = 0;
    const f = await completedScan({ now: () => clock, valid: () => { if (armed) { armed = false; observed++; clock = 61000; } return true; } });
    armed = true; assert(!f.scanner.canRelease(f.result), "A guard that finishes at the deadline cannot release held ALLOW.");
    assert(observed === 1 && !f.scanner.canRelease(f.result), "Deadline crossing must remain withheld after callback completion.");
});
test("F26a final scan release charges time spent recapturing genuine effective-index metadata", options, async () => {
    let clock = 1000, observed = 0; const f = await completedScan({ now: () => clock });
    await whileWatchingIndex(f.index, () => { observed++; clock = 61000; }, async () => {
        assert(!f.scanner.canRelease(f.result), "Synchronous index recapture that crosses the deadline cannot authorize held release.");
    });
    assert(observed > 0 && !f.scanner.canRelease(f.result), "The exact synthetic index must be observed and deadline revocation must stick.");
});
test("F26a process close join observes withdrawal invoked inside its otherwise true owner callback", options, async () => {
    let armed = false, observed = 0;
    const f = await processAtClose({ valid: worker => { if (armed) { armed = false; observed++; worker.withdraw(); } return true; } });
    armed = true; unavailable(await f.finish()); assert(observed === 1, "Withdrawal must occur inside the real transport final guard.");
});
test("F26a process close join observes withdrawal invoked inside its otherwise valid clock callback", options, async () => {
    let armed = false, observed = 0;
    const f = await processAtClose({ now: worker => { if (armed) { armed = false; observed++; worker.withdraw(); } return 1000; } });
    armed = true; unavailable(await f.finish()); assert(observed === 1, "Clock callback must withdraw during the real transport final guard.");
});
test("F26a process close join charges elapsed time inside its owner validity callback", options, async () => {
    let armed = false, clock = 1000, observed = 0;
    const f = await processAtClose({ now: () => clock, valid: () => { if (armed) { armed = false; observed++; clock = 61000; } return true; } });
    armed = true; unavailable(await f.finish()); assert(observed === 1, "Deadline must cross inside close-join owner validation.");
});
test("F26a process close join charges elapsed time inside genuine effective-index recapture", options, async () => {
    let clock = 1000, observed = 0; const f = await processAtClose({ now: () => clock });
    await whileWatchingIndex(f.index, () => { observed++; clock = 61000; }, async () => unavailable(await f.finish()));
    assert(observed > 0, "The exact effective index must be recaptured inside the close-join challenge.");
});
