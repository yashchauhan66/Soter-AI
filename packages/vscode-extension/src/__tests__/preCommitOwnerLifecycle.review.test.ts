import assert from "node:assert/strict";
import { createHash, createPublicKey, generateKeyPairSync, randomUUID, type KeyObject } from "node:crypto";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { request as httpRequest, type ClientRequest, type Server } from "node:http";
import { syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import type { CheckedHookIndex } from "../history-hooks/CheckedHookIndex";
import { verifyHookDescriptor, type HookDescriptor } from "../history-hooks/PreCommitWire";

// Additive before-correction lifecycle regressions. Original owner28 unchanged.
// Real IPv4 loopback only, manually encoded retained DIRC roots, fake scanners.
// No Git/other child, process-handle enumeration, signal or forced process close.
const options = { skip: process.platform !== "win32", timeout: 12000 };
const WORKER = "a".repeat(64), RUNTIME = "b".repeat(64);
type Result = Readonly<{ status: "ALLOW" | "BLOCK" | "UNAVAILABLE" | "STOP_UNCONFIRMED" }>;
interface ScanOptions { index: CheckedHookIndex; valid: () => boolean; deadline: number }
interface Scan { start(): Promise<Result>; readonly closed: Promise<void>; readonly busy: boolean; withdraw(): void; canRelease(result: Result): boolean }
interface Owner { start(): Promise<Buffer | undefined>; readonly busy: boolean; close(): Promise<void> }
interface Reply { status?: number; bytes: Buffer; error?: Error }
const tick = async () => { await new Promise<void>(done => setImmediate(done)); };
async function observed(predicate: () => boolean): Promise<boolean> {
    for (let i = 0; i < 125; i++) { if (predicate()) return true; await new Promise<void>(done => setTimeout(done, 4)); }
    return predicate();
}
function indexBytes(): Buffer {
    const name = Buffer.from("public.txt"), header = Buffer.alloc(12), row = Buffer.alloc(Math.ceil((62 + name.length + 1) / 8) * 8);
    header.write("DIRC", 0, "ascii"); header.writeUInt32BE(2, 4); header.writeUInt32BE(1, 8);
    row.writeUInt32BE(0o100644, 24); Buffer.from("1".repeat(40), "hex").copy(row, 40); row.writeUInt16BE(name.length, 60); name.copy(row, 62);
    const body = Buffer.concat([header, row]); return Buffer.concat([body, createHash("sha1").update(body).digest()]);
}
async function syntheticIndex(): Promise<CheckedHookIndex> {
    const root = await mkdtemp(join(tmpdir(), "soter-f26a-owner-lifecycle-"));
    for (const relative of ["objects/info", "objects/pack", "refs/heads"]) await mkdir(join(root, ".git", ...relative.split("/")), { recursive: true });
    await writeFile(join(root, ".git", "config"), "[core]\n repositoryformatversion = 0\n bare = false\n", { flag: "wx" });
    await writeFile(join(root, ".git", "HEAD"), "ref: refs/heads/main\n", { flag: "wx" });
    await writeFile(join(root, ".git", "index"), indexBytes(), { flag: "wx" });
    const { prepareCheckedHookIndex } = await import("../history-hooks/CheckedHookIndex");
    const index = await prepareCheckedHookIndex(root, undefined, { SystemRoot: process.env.SystemRoot, WINDIR: process.env.WINDIR, COMSPEC: process.env.COMSPEC }, () => true);
    assert(index, "Manual synthetic index must produce a genuine capability without executing Git."); return index;
}
class FakeScan implements Scan {
    readonly closed: Promise<void>; private close!: () => void; private resolve!: (result: Result) => void;
    private readonly result: Promise<Result>; private active = false; private ended = false; private replied = false; private revoked = false;
    readonly held = Object.freeze({ status: "ALLOW" as const }); startCalls = 0; childStarts = 0; withdrawals = 0;
    constructor(readonly options: ScanOptions) { this.closed = new Promise(done => this.close = done); this.result = new Promise(done => this.resolve = done); }
    get busy(): boolean { return this.active; }
    private reply(value: Result): void { if (!this.replied) { this.replied = true; this.resolve(value); } }
    start(): Promise<Result> {
        this.startCalls++;
        if (this.revoked) { this.finish(); return this.result; }
        this.active = true; this.childStarts++; return this.result;
    }
    withdraw(): void { this.withdrawals++; this.revoked = true; if (this.active) this.reply(Object.freeze({ status: "STOP_UNCONFIRMED" })); }
    finish(): void {
        if (this.ended) return; this.ended = true; this.active = false;
        this.reply(this.revoked ? Object.freeze({ status: "UNAVAILABLE" }) : this.held); this.close();
    }
    canRelease(value: Result): boolean { return value === this.held && this.ended && !this.revoked && this.options.valid(); }
}
async function fixture(settings: { valid?: () => boolean; create?: (options: ScanOptions) => Scan } = {}) {
    const module = await import("../history-hooks/PreCommitOwnerService"), index = await syntheticIndex();
    const key = generateKeyPairSync("ed25519").privateKey, generation = randomUUID();
    const pin = (createPublicKey(key).export({ format: "der", type: "spki" }) as Buffer).toString("base64");
    let loads = 0; const scans: FakeScan[] = [];
    const owner: Owner = new module.PreCommitOwnerService({ root: index.root, generation, workerSha256: WORKER, runtimeSha256: RUNTIME,
        valid: settings.valid ?? (() => true), loadKey: async (): Promise<KeyObject> => { loads++; return key; },
        prepareIndex: async () => index,
        createScan: options => { if (settings.create) return settings.create(options); const scan = new FakeScan(options); scans.push(scan); return scan; } });
    let descriptor: Readonly<HookDescriptor> | undefined;
    return { owner, index, scans, get loads() { return loads; },
        async start() {
            const raw = await owner.start(); assert(Buffer.isBuffer(raw), "Live synthetic owner must start before lifecycle challenge.");
            descriptor = verifyHookDescriptor(raw, pin, { root: index.root, generation, workerSha256: WORKER, runtimeSha256: RUNTIME });
            assert(descriptor, "Synthetic descriptor must verify under the installation pin."); return descriptor;
        },
        post() {
            assert(descriptor, "Start the exact owner before loopback request.");
            const body = Buffer.from(JSON.stringify({ version: 1, generation, session: descriptor.session, nonce: randomUUID(), indexFile: ".git/index" }));
            return request(descriptor.endpoint, body);
        } };
}
function request(endpoint: string, body: Buffer): { request: ClientRequest; result: Promise<Reply> } {
    const url = new URL(endpoint); assert(url.hostname === "127.0.0.1" && url.protocol === "http:", "Fixture requests may target only their numeric IPv4 loopback owner.");
    let client!: ClientRequest;
    const result = new Promise<Reply>(resolve => {
        let settled = false; const done = (value: Reply) => { if (!settled) { settled = true; resolve(value); } };
        client = httpRequest({ hostname: "127.0.0.1", port: Number(url.port), path: "/pre-commit", method: "POST", agent: false,
            headers: { "Content-Type": "application/json", "Content-Length": String(body.length), "Connection": "close" } }, response => {
            const chunks: Buffer[] = []; let count = 0;
            response.on("data", chunk => { const bytes = Buffer.from(chunk); count += bytes.length; if (count <= 16384) chunks.push(bytes); else client.destroy(); });
            response.once("end", () => done({ status: response.statusCode, bytes: Buffer.concat(chunks) }));
            response.once("error", error => done({ bytes: Buffer.concat(chunks), error }));
        });
        client.setTimeout(1800, () => client.destroy(new Error("Finite synthetic owner HTTP deadline.")));
        client.once("error", error => done({ bytes: Buffer.alloc(0), error })); client.end(body);
    });
    return { request: client, result };
}
async function closeCaptured(server: Server | undefined): Promise<void> {
    if (server?.listening) await new Promise<void>(done => server.close(() => done()));
}

test("F26a owner lifecycle closes a cancelled never-started scanner job without waiting for nonexistent child ownership", options, async t => {
    let enabled = true, scan: FakeScan | undefined;
    const f = await fixture({ valid: () => enabled, create: input => { scan = new FakeScan(input); enabled = false; return scan; } });
    let pending: ReturnType<typeof request> | undefined;
    t.after(async () => { pending?.request.destroy(); scan?.finish(); await f.owner.close(); });
    await f.start(); pending = f.post(); const response = await pending.result;
    assert(scan && scan.withdrawals > 0 && scan.childStarts === 0 && !scan.busy, "Factory revocation must happen before any fake child starts.");
    assert(response.status !== 200 && !response.bytes.includes(Buffer.from('"status":"ALLOW"')), "Cancelled admission must refuse the request.");
    let closed = false; const closing = f.owner.close().then(() => { closed = true; });
    const completed = await observed(() => closed);
    assert(completed && !f.owner.busy, "Owner close must finish before fixture completion when no child ever started.");
    await closing;
});

test("F26a owner lifecycle closes a listener that becomes live after close was requested during pending listen", options, async t => {
    const f = await fixture(), http = require("node:http") as typeof import("node:http"), originalCreate = http.createServer;
    let captured: Server | undefined, nativeListen: Server["listen"] | undefined, listenArguments: unknown[] | undefined;
    let released = false, startup: Promise<Buffer | undefined> | undefined;
    const restore = () => { http.createServer = originalCreate; syncBuiltinESMExports(); };
    const release = () => {
        if (released || !captured || !nativeListen || !listenArguments) return;
        released = true; captured.listen = nativeListen;
        Reflect.apply(nativeListen, captured, listenArguments);
    };
    t.after(async () => {
        restore(); release();
        if (startup) await startup;
        // Explicit fixture cleanup closes only its captured real loopback
        // listener AFTER the production assertion. This cannot regrade it.
        await closeCaptured(captured); await f.owner.close();
    });
    http.createServer = ((...args: unknown[]) => {
        const server = Reflect.apply(originalCreate, http, args) as Server; captured = server; nativeListen = server.listen;
        server.listen = ((...args: unknown[]) => { listenArguments = args; return server; }) as typeof server.listen;
        return server;
    }) as typeof originalCreate;
    syncBuiltinESMExports(); startup = f.owner.start();
    assert(await observed(() => !!captured && !!listenArguments), "Owner must enter its pending listen boundary.");
    let closed = false, started = false; const closing = f.owner.close().then(() => { closed = true; });
    const starting = startup.then(value => { started = true; return value; });
    await tick(); release();
    assert(await observed(() => started && closed), "Stopped startup and close must both settle after the delayed loopback bind.");
    assert(captured && !captured.listening, "Production close must close its late listener before reporting lifecycle completion.");
    assert(await starting === undefined, "Stopped startup must never expose a descriptor for the late listener."); await closing;
});

test("F26a owner lifecycle known aborted scan cancellation never initiates another private signing-key load", options, async t => {
    const f = await fixture(); let pending: ReturnType<typeof request> | undefined;
    t.after(async () => { pending?.request.destroy(); f.scans.forEach(scan => scan.finish()); await f.owner.close(); });
    await f.start(); assert(f.loads === 1, "Startup must load exactly one synthetic private signing key."); pending = f.post();
    assert(await observed(() => f.scans.length === 1 && f.scans[0].childStarts === 1), "One fake owned scanner must be active before abort.");
    pending.request.destroy(); await pending.result;
    assert(await observed(() => f.scans[0].withdrawals > 0), "Transport abort must become known cooperative cancellation.");
    await tick(); await tick();
    assert(f.owner.busy && f.scans[0].busy, "Cancellation must retain real fake-child ownership until natural fixture completion.");
    assert(f.loads === 1, "An already-cancelled request must not initiate a fresh final signing-key read.");
});
