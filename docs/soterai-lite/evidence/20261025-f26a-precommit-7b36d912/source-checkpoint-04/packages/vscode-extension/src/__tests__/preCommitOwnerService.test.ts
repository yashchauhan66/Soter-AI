import assert from "node:assert/strict";
import { createHash, createPublicKey, generateKeyPairSync, randomUUID, type KeyObject } from "node:crypto";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { request as httpRequest } from "node:http";
import { connect } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import type { CheckedHookIndex } from "../history-hooks/CheckedHookIndex";
import { verifyHookDescriptor, verifyHookDecision, type HookDescriptor, type HookDecision } from "../history-hooks/PreCommitWire";

// TEST FIRST: retained manual DIRC roots, synthetic Ed25519 keys and real IPv4
// loopback HTTP only. Every scanner is fake; no Git/other child or process signal.
// A signed response authenticates its owner; these tests make no caller-identity claim.
const options = { skip: process.platform !== "win32", timeout: 12000 };
const CONFIG = "[core]\n repositoryformatversion = 0\n bare = false\n";
const PRIVATE = "TEST_ONLY_F26A_OWNER_PRIVATE_13ac97e6";
const WORKER = "a".repeat(64), RUNTIME = "b".repeat(64), ZERO = "0".repeat(64);
type Status = "ALLOW" | "BLOCK" | "UNAVAILABLE" | "STOP_UNCONFIRMED";
type ScanResult = Readonly<{ status: Status }>;
interface ScanOptions { index: CheckedHookIndex; valid: () => boolean; deadline: number }
interface Scan {
    start(): Promise<ScanResult>; readonly closed: Promise<void>; readonly busy: boolean;
    withdraw(): void; canRelease(result: ScanResult): boolean;
}
interface OwnerOptions {
    root: string; generation: string; workerSha256: string; runtimeSha256: string; valid: () => boolean;
    loadKey: () => Promise<KeyObject | undefined>; ambient?: NodeJS.ProcessEnv;
    prepareIndex?: (root: string, indexFile: unknown, ambient: NodeJS.ProcessEnv, valid: () => boolean) => Promise<CheckedHookIndex | undefined>;
    createScan?: (options: ScanOptions) => Scan;
}
interface Owner { start(): Promise<Buffer | undefined>; readonly busy: boolean; close(): Promise<void> }
type Constructor = new (options: OwnerOptions) => Owner;
interface Reply { status?: number; bytes: Buffer; error?: Error }
const tick = async () => { await new Promise<void>(done => setImmediate(done)); };
async function until(predicate: () => boolean, message = "Expected finite fixture transition."): Promise<void> {
    for (let i = 0; i < 250; i++) { if (predicate()) return; await new Promise<void>(done => setTimeout(done, 4)); }
    assert(predicate(), message);
}
function deferred<T>() {
    let resolve!: (value: T) => void; const promise = new Promise<T>(done => resolve = done); return { promise, resolve };
}
function indexBytes(): Buffer {
    const name = Buffer.from("public.txt"), header = Buffer.alloc(12), row = Buffer.alloc(Math.ceil((62 + name.length + 1) / 8) * 8);
    header.write("DIRC", 0, "ascii"); header.writeUInt32BE(2, 4); header.writeUInt32BE(1, 8);
    row.writeUInt32BE(0o100644, 24); Buffer.from("1".repeat(40), "hex").copy(row, 40); row.writeUInt16BE(name.length, 60); name.copy(row, 62);
    const body = Buffer.concat([header, row]); return Buffer.concat([body, createHash("sha1").update(body).digest()]);
}
async function syntheticIndex(): Promise<CheckedHookIndex> {
    const root = await mkdtemp(join(tmpdir(), "soter-f26a-owner-"));
    for (const relative of ["objects/info", "objects/pack", "refs/heads"]) await mkdir(join(root, ".git", ...relative.split("/")), { recursive: true });
    await writeFile(join(root, ".git", "config"), CONFIG, { flag: "wx" });
    await writeFile(join(root, ".git", "HEAD"), "ref: refs/heads/main\n", { flag: "wx" });
    await writeFile(join(root, ".git", "index"), indexBytes(), { flag: "wx" });
    const { prepareCheckedHookIndex } = await import("../history-hooks/CheckedHookIndex");
    const value = await prepareCheckedHookIndex(root, undefined, { SystemRoot: process.env.SystemRoot, WINDIR: process.env.WINDIR, COMSPEC: process.env.COMSPEC }, () => true);
    assert(value, "Manual synthetic fixture must acquire a genuine checked index without a child."); return value;
}
class FakeScan implements Scan {
    readonly closed: Promise<void>; private readonly result: Promise<ScanResult>;
    private resolveClose!: () => void; private resolveResult!: (value: ScanResult) => void;
    private active = false; private ended = false; private replied = false; private revoked = false;
    readonly held: ScanResult; starts = 0; withdrawals = 0; releases: ScanResult[] = []; allowRelease = true;
    constructor(readonly options: ScanOptions, readonly auto: boolean, status: Status) {
        this.held = Object.freeze({ status }); this.closed = new Promise(done => this.resolveClose = done);
        this.result = new Promise(done => this.resolveResult = done);
    }
    get busy(): boolean { return this.active; }
    private reply(value: ScanResult): void { if (!this.replied) { this.replied = true; this.resolveResult(value); } }
    start(): Promise<ScanResult> { this.starts++; this.active = true; if (this.auto) queueMicrotask(() => this.finish()); return this.result; }
    completeBeforeClose(): void { this.reply(this.held); }
    finish(): void { if (this.ended) return; this.ended = true; this.active = false; this.reply(this.held); this.resolveClose(); }
    withdraw(): void { this.withdrawals++; this.revoked = true; if (this.active) this.reply(Object.freeze({ status: "STOP_UNCONFIRMED" })); }
    canRelease(value: ScanResult): boolean {
        this.releases.push(value); return value === this.held && this.ended && !this.active && !this.revoked && this.allowRelease
            && this.options.valid() === true && this.options.index.available();
    }
}
interface Settings {
    valid?: () => boolean; loadKey?: (call: number, initial: KeyObject) => Promise<KeyObject | undefined>;
    status?: Status; hold?: boolean;
    prepare?: (index: CheckedHookIndex) => CheckedHookIndex | undefined | Promise<CheckedHookIndex | undefined>;
    create?: (options: ScanOptions) => Scan;
}
async function fixture(t: TestContext, settings: Settings = {}) {
    const module = await import("../history-hooks/PreCommitOwnerService");
    assert(typeof module.PreCommitOwnerService === "function", "The frozen owning-editor service must exist.");
    const Constructor = module.PreCommitOwnerService as unknown as Constructor, index = await syntheticIndex();
    const key = generateKeyPairSync("ed25519").privateKey, generation = randomUUID();
    const pin = (createPublicKey(key).export({ format: "der", type: "spki" }) as Buffer).toString("base64");
    const ambient: NodeJS.ProcessEnv = { SystemRoot: process.env.SystemRoot, WINDIR: process.env.WINDIR, COMSPEC: process.env.COMSPEC,
        PATH: PRIVATE, NODE_OPTIONS: PRIVATE, OPENAI_API_KEY: PRIVATE, GIT_INDEX_FILE: PRIVATE };
    const preparations: { root: string; indexFile: unknown; ambient: NodeJS.ProcessEnv; valid: () => boolean }[] = [], scans: FakeScan[] = [];
    const cleanup: (() => void)[] = [];
    let loads = 0;
    const owner = new Constructor({ root: index.root, generation, workerSha256: WORKER, runtimeSha256: RUNTIME,
        valid: settings.valid ?? (() => true), ambient,
        loadKey: async () => { loads++; return settings.loadKey ? settings.loadKey(loads, key) : key; },
        prepareIndex: async (root, indexFile, environment, valid) => {
            preparations.push({ root, indexFile, ambient: environment, valid });
            return settings.prepare ? settings.prepare(index) : index;
        },
        createScan: input => {
            if (settings.create) return settings.create(input);
            const scan = new FakeScan(input, settings.hold !== true, settings.status ?? "ALLOW"); scans.push(scan); return scan;
        } });
    // Retain all synthetic files. A fake child is ended naturally only by this
    // fixture's explicit completion, never by the production service.
    t.after(async () => { cleanup.forEach(work => work()); scans.forEach(scan => scan.finish()); await owner.close(); });
    let descriptor: Readonly<HookDescriptor> | undefined;
    return { owner, index, key, pin, generation, ambient, preparations, scans, cleanup,
        get loads() { return loads; }, get descriptor() { assert(descriptor, "Service must have a verified descriptor."); return descriptor; },
        async start() {
            const raw = await owner.start(); assert(Buffer.isBuffer(raw), "Live owner with a valid private key must start.");
            descriptor = verifyHookDescriptor(raw, pin, { root: index.root, generation, workerSha256: WORKER, runtimeSha256: RUNTIME });
            assert(descriptor, "Endpoint descriptor must verify under the reviewed public pin."); return raw;
        },
        body(nonce = randomUUID(), overrides: Record<string, unknown> = {}) {
            assert(descriptor, "Start service before forming its bound request.");
            return Buffer.from(JSON.stringify({ version: 1, generation, session: descriptor.session, nonce, indexFile: ".git/index", ...overrides }));
        },
        async post(overrides: { body?: Buffer; method?: string; path?: string; headers?: Record<string, string>; omitContentType?: boolean } = {}) {
            assert(descriptor, "Start service before a loopback request.");
            const nonce = randomUUID(), body = overrides.body ?? this.body(nonce);
            return { nonce, response: await send(descriptor.endpoint, body, overrides) };
        } };
}
function send(endpoint: string, body: Buffer, settings: { method?: string; path?: string; headers?: Record<string, string>; omitContentType?: boolean } = {}): Promise<Reply> {
    const url = new URL(endpoint);
    return new Promise(resolve => {
        let settled = false; const done = (reply: Reply) => { if (!settled) { settled = true; resolve(reply); } };
        const req = httpRequest({ hostname: "127.0.0.1", port: Number(url.port), method: settings.method ?? "POST", path: settings.path ?? "/pre-commit",
            agent: false, headers: { ...(settings.omitContentType ? {} : { "Content-Type": "application/json" }), "Content-Length": String(body.length), ...settings.headers } }, response => {
            const chunks: Buffer[] = []; let bytes = 0;
            response.on("data", chunk => { const copy = Buffer.from(chunk); bytes += copy.length; if (bytes <= 16384) chunks.push(copy); else req.destroy(); });
            response.once("end", () => done({ status: response.statusCode, bytes: Buffer.concat(chunks) }));
            response.once("error", error => done({ bytes: Buffer.concat(chunks), error }));
        });
        req.setTimeout(1800, () => req.destroy(new Error("Finite synthetic HTTP deadline.")));
        req.once("error", error => done({ bytes: Buffer.alloc(0), error })); req.end(body);
    });
}
function begin(endpoint: string, body: Buffer) {
    const url = new URL(endpoint), done = deferred<Reply>(); let settled = false;
    const finish = (reply: Reply) => { if (!settled) { settled = true; done.resolve(reply); } };
    const req = httpRequest({ hostname: "127.0.0.1", port: Number(url.port), method: "POST", path: "/pre-commit", agent: false,
        headers: { "Content-Type": "application/json", "Content-Length": String(body.length) } }, response => {
        const chunks: Buffer[] = []; response.on("data", chunk => chunks.push(Buffer.from(chunk)));
        response.once("end", () => finish({ status: response.statusCode, bytes: Buffer.concat(chunks) }));
        response.once("error", error => finish({ bytes: Buffer.concat(chunks), error }));
    });
    req.setTimeout(1800, () => req.destroy(new Error("Finite synthetic held HTTP deadline.")));
    req.once("error", error => finish({ bytes: Buffer.alloc(0), error })); req.end(body);
    return { request: req, result: done.promise, get settled() { return settled; } };
}
async function raw(endpoint: string, headers: string[], body: Buffer): Promise<Reply> {
    const url = new URL(endpoint);
    return new Promise(resolve => {
        const socket = connect({ host: "127.0.0.1", port: Number(url.port) }), chunks: Buffer[] = []; let settled = false;
        const done = (error?: Error) => { if (!settled) { settled = true; resolve({ bytes: Buffer.concat(chunks), error }); } };
        socket.setTimeout(1800, () => socket.destroy());
        socket.once("connect", () => socket.write(Buffer.concat([Buffer.from(headers.join("\r\n") + "\r\n\r\n"), body])));
        socket.on("data", chunk => chunks.push(Buffer.from(chunk))); socket.once("end", () => { socket.end(); done(); });
        socket.once("close", () => done()); socket.once("error", error => done(error));
    });
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
function decoded(f: Fixture, response: Reply, nonce: string): Readonly<HookDecision> | undefined {
    return verifyHookDecision(response.bytes, f.pin, { root: f.index.root, generation: f.generation, session: f.descriptor.session, nonce });
}
function privateAbsent(response: Reply): void {
    assert(response.bytes.length <= 16384, "Owner responses must stay finite.");
    assert(!response.bytes.includes(Buffer.from(PRIVATE)) && !response.bytes.includes(Buffer.from("public.txt")), "HTTP must never expose raw content, findings or staged paths.");
}
function refused(f: Fixture, response: Reply, nonce: string): void {
    privateAbsent(response); const value = decoded(f, response, nonce);
    assert(value?.status !== "ALLOW", "A refused request cannot authorize a commit.");
    if (value) assert(["UNAVAILABLE", "BUSY", "BLOCK"].includes(value.status), "Only fixed failure metadata may leave the owner.");
}

test("F26a owner binds signed ephemeral IPv4 descriptor exactly once", options, async t => {
    const f = await fixture(t), bytes = await f.start(), descriptor = f.descriptor, url = new URL(descriptor.endpoint);
    assert(url.protocol === "http:" && url.hostname === "127.0.0.1" && Number(url.port) > 0 && url.pathname === "/pre-commit", "Owner must bind only its finite loopback route.");
    assert(!url.search && !url.hash && f.loads === 1 && f.preparations.length === 0 && f.scans.length === 0, "Startup cannot scan or merge endpoint data.");
    assert(!bytes.includes(Buffer.from(PRIVATE)) && Object.isFrozen(descriptor), "Public descriptor contains reviewed metadata only.");
    assert(await f.owner.start() === undefined && f.loads === 1, "One-shot start cannot create a second listener or load another key.");
});
test("F26a owner close before start permanently refuses startup without loading a key", options, async t => {
    const f = await fixture(t); await tick();
    assert(f.loads === 0 && f.preparations.length === 0 && f.scans.length === 0 && !f.owner.busy, "Construction alone cannot acquire authority.");
    await f.owner.close(); assert(await f.owner.start() === undefined && f.loads === 0, "Closed owner cannot revive.");
});
test("F26a owner disabled startup and later disabled requests refuse before sensitive admission", options, async t => {
    const f = await fixture(t, { valid: () => false }); assert(await f.owner.start() === undefined, "Disabled machine authority must refuse startup.");
    assert(f.loads === 0 && f.preparations.length === 0 && f.scans.length === 0, "Disabled startup must have no sensitive side effects.");
    let enabled = true; const live = await fixture(t, { valid: () => enabled }); await live.start(); enabled = false;
    const { nonce, response } = await live.post(); refused(live, response, nonce);
    assert(live.preparations.length === 0 && live.scans.length === 0, "Current flag check must precede every new index preparation.");
});
test("F26a owner missing or unsuitable startup signing keys never create a descriptor", options, async t => {
    for (const key of [undefined, generateKeyPairSync("ed25519").publicKey, generateKeyPairSync("ec", { namedCurve: "prime256v1" }).privateKey]) {
        const f = await fixture(t, { loadKey: async () => key });
        assert(await f.owner.start() === undefined && f.scans.length === 0 && f.preparations.length === 0, "Only the installation's private Ed25519 key may start an owner.");
    }
});
test("F26a owner signs a completed public ALLOW with exact captured index digests and request binding", options, async t => {
    const f = await fixture(t); await f.start(); const { nonce, response } = await f.post(), value = decoded(f, response, nonce);
    assert(value?.status === "ALLOW", "Complete live public scan must remain useful."); privateAbsent(response);
    const index = f.index as CheckedHookIndex & { indexSha256: string; indexIdentity: string };
    assert(value.indexSha256 === index.indexSha256 && value.indexIdentity === index.indexIdentity && /^[a-f0-9]{64}$/.test(value.indexSha256) && value.indexSha256 !== ZERO, "ALLOW must bind exact authentic index bytes and identity.");
    assert(f.preparations.length === 1 && f.scans.length === 1 && f.loads >= 2 && !f.owner.busy, "One completed scan and a fresh final key load are required.");
    assert(f.scans[0].releases.includes(f.scans[0].held), "Final release must ask about the exact held ALLOW result.");
});
test("F26a owner BLOCK returns fixed signed metadata without candidate content or raw failures", options, async t => {
    const f = await fixture(t, { status: "BLOCK" }); await f.start(); const { nonce, response } = await f.post();
    assert(decoded(f, response, nonce)?.status === "BLOCK", "Canonical candidate scan must block."); privateAbsent(response);
});
test("F26a owner unavailable and unconfirmed scanner outcomes cannot become ALLOW", options, async t => {
    for (const status of ["UNAVAILABLE", "STOP_UNCONFIRMED"] as const) {
        const f = await fixture(t, { status }); await f.start(); const { nonce, response } = await f.post(); refused(f, response, nonce);
        assert(f.scans.length === 1, "Refusal must preserve one admitted finite scan.");
    }
});
test("F26a owner rejects wrong version installation session nonce and extra request authority before preparation", options, async t => {
    const f = await fixture(t); await f.start();
    for (const patch of [{ version: 2 }, { generation: randomUUID() }, { session: randomUUID() }, { nonce: "invalid" }, { root: f.index.root }, { indexFile: "" }]) {
        const nonce = randomUUID(), response = await send(f.descriptor.endpoint, f.body(nonce, patch)); refused(f, response, nonce);
    }
    assert(f.preparations.length === 0 && f.scans.length === 0, "Invalid request metadata cannot prepare an index.");
});
test("F26a owner rejects malformed noncanonical duplicate and invalid UTF8 request bodies before preparation", options, async t => {
    const f = await fixture(t); await f.start(); const nonce = randomUUID(), good = f.body(nonce);
    for (const body of [Buffer.from(" " + good.toString()), Buffer.from(good.toString().replace('"version":1', '"version":1,"version":1')),
        Buffer.from("{"), Buffer.from([0xef, 0xbb, 0xbf, ...good]), Buffer.from([0xff]), Buffer.alloc(0)]) {
        refused(f, await send(f.descriptor.endpoint, body), nonce);
    }
    assert(f.preparations.length === 0 && f.scans.length === 0, "No valid prefix or duplicate request may admit work.");
});
test("F26a owner refuses foreign methods paths queries and route ambiguity without preparing", options, async t => {
    const f = await fixture(t); await f.start();
    for (const route of [{ method: "GET" }, { method: "PUT" }, { path: "/" }, { path: "/pre-commit?" + PRIVATE }, { path: "/pre-commit/" }, { path: "/%70re-commit" }]) {
        const { nonce, response } = await f.post(route); refused(f, response, nonce);
    }
    assert(f.preparations.length === 0 && f.scans.length === 0, "Only the exact fixed POST route may admit work.");
});
test("F26a owner requires exact numeric loopback Host and no Origin header", options, async t => {
    const f = await fixture(t); await f.start(); const port = new URL(f.descriptor.endpoint).port;
    const headerCases: Record<string, string>[] = [{ Host: "localhost:" + port }, { Host: "127.0.0.1" }, { Host: "127.0.0.2:" + port },
        { Host: "127.0.0.1:" + port + "." }, { Origin: "http://127.0.0.1:" + port }, { Origin: "null" }];
    for (const headers of headerCases) {
        const { nonce, response } = await f.post({ headers }); refused(f, response, nonce);
    }
    assert(f.preparations.length === 0 && f.scans.length === 0, "Host or Origin refusal must precede preparation.");
});
test("F26a owner refuses missing and unsupported content types before body admission", options, async t => {
    const f = await fixture(t); await f.start();
    for (const request of [{ omitContentType: true }, { headers: { "Content-Type": "text/plain" } }, { headers: { "Content-Type": "application/json, text/plain" } }]) {
        const { nonce, response } = await f.post(request); refused(f, response, nonce);
    }
    assert(f.preparations.length === 0 && f.scans.length === 0, "Unsupported body framing must admit no scan.");
});
test("F26a owner refuses duplicate Host content headers and transfer encoding without admitting work", options, async t => {
    const f = await fixture(t); await f.start(); const url = new URL(f.descriptor.endpoint), body = f.body();
    const base = ["POST /pre-commit HTTP/1.1", "Host: 127.0.0.1:" + url.port, "Content-Type: application/json", "Content-Length: " + body.length, "Connection: close"];
    for (const extra of ["Host: 127.0.0.1:" + url.port, "Content-Type: application/json", "Content-Length: " + body.length, "Transfer-Encoding: chunked"]) {
        const response = await raw(f.descriptor.endpoint, [...base, extra], body); privateAbsent(response);
        assert(!response.bytes.includes(Buffer.from('"status":"ALLOW"')), "Ambiguous HTTP framing must never carry an ALLOW.");
    }
    assert(f.preparations.length === 0 && f.scans.length === 0, "HTTP parser or owner refusal must happen before work.");
});
test("F26a owner refuses bodies beyond4096 bytes and excessive headers without scanning a prefix", options, async t => {
    const f = await fixture(t); await f.start();
    const large = await f.post({ body: Buffer.alloc(4097, 32) }); refused(f, large.response, large.nonce);
    const oversizedHeader = await f.post({ headers: { "X-Synthetic-Bounded": "x".repeat(17000) } }); refused(f, oversizedHeader.response, oversizedHeader.nonce);
    assert(f.preparations.length === 0 && f.scans.length === 0, "Body/header caps must refuse before index admission.");
});
test("F26a owner one-active noqueue response binds BUSY nonce and starts no second preparation or scanner", options, async t => {
    const f = await fixture(t, { hold: true }); await f.start(); const nonce = randomUUID(), first = begin(f.descriptor.endpoint, f.body(nonce));
    await until(() => f.scans.length === 1 && f.scans[0].starts === 1); assert(f.owner.busy, "Held actual ownership must remain busy.");
    const second = await f.post(), busy = decoded(f, second.response, second.nonce);
    assert(busy?.status === "BUSY" && busy.indexSha256 === ZERO && busy.indexIdentity === ZERO, "Live Busy response must bind only its own nonce and zero index metadata.");
    assert(f.preparations.length === 1 && f.scans.length === 1 && !first.settled, "Busy cannot queue or start another scan.");
    f.scans[0].finish(); const response = await first.result; assert(decoded(f, response, nonce)?.status === "ALLOW", "Unchanged first request may complete naturally.");
});
test("F26a owner passes only captured root and literal effective-index data into preparation", options, async t => {
    const f = await fixture(t); await f.start(); const nonce = randomUUID(), response = await send(f.descriptor.endpoint, f.body(nonce, { indexFile: f.index.indexFile }));
    assert(decoded(f, response, nonce)?.status === "ALLOW", "Injected genuine index may support the requested literal path data.");
    const request = f.preparations[0];
    assert(request.root === f.index.root && request.indexFile === f.index.indexFile && request.ambient === f.ambient && request.valid() === true, "Request metadata cannot replace root or ambient owner authority.");
    assert(f.scans[0].options.index === f.index && f.scans[0].options.deadline > 0 && f.scans[0].options.deadline <= performance.now() + 60000, "Scanner receives the genuine capability and finite whole-operation deadline.");
});
test("F26a owner rejects borrowed foreign-root and structural-clone index capabilities before scanner creation", options, async t => {
    const foreign = await syntheticIndex();
    for (const prepare of [() => foreign, (index: CheckedHookIndex) => ({ ...index }) as CheckedHookIndex]) {
        const f = await fixture(t, { prepare }); await f.start(); const { nonce, response } = await f.post(); refused(f, response, nonce);
        assert(f.scans.length === 0, "Foreign or forged descriptors must never enter a scanner.");
    }
});
test("F26a owner unavailable effective index cannot become an empty successful tree", options, async t => {
    const f = await fixture(t, { prepare: () => undefined }); await f.start(); const { nonce, response } = await f.post(); refused(f, response, nonce);
    assert(f.preparations.length === 1 && f.scans.length === 0, "Missing effective index must not create a scan or fallback success.");
});
test("F26a owner changed final signing key cannot authorize a decision under either installation pin", options, async t => {
    const replacement = generateKeyPairSync("ed25519").privateKey;
    const f = await fixture(t, { loadKey: async (call, initial) => call === 1 ? initial : replacement }); await f.start(); const { nonce, response } = await f.post(); refused(f, response, nonce);
    const replacementPin = (createPublicKey(replacement).export({ format: "der", type: "spki" }) as Buffer).toString("base64");
    assert(verifyHookDecision(response.bytes, replacementPin, { root: f.index.root, generation: f.generation, session: f.descriptor.session, nonce })?.status !== "ALLOW", "A replacement key cannot silently create new installation authority.");
});
test("F26a owner missing final key and thrown key retrieval refuse without echoing raw failures", options, async t => {
    for (const throws of [false, true]) {
        const f = await fixture(t, { loadKey: async (call, initial) => { if (call === 1) return initial; if (throws) throw Error(PRIVATE); return undefined; } });
        await f.start(); const { nonce, response } = await f.post(); refused(f, response, nonce); assert(f.loads >= 2, "Key must be loaded again after scan completion.");
    }
});
test("F26a owner held final key await cannot revive after observed disable and reenable", options, async t => {
    let enabled = true; const gate = deferred<KeyObject | undefined>();
    const f = await fixture(t, { valid: () => enabled, loadKey: async (call, initial) => call === 1 ? initial : gate.promise });
    f.cleanup.push(() => gate.resolve(f.key)); await f.start(); const nonce = randomUUID(), first = begin(f.descriptor.endpoint, f.body(nonce));
    await until(() => f.loads >= 2); enabled = false;
    assert(f.scans[0].options.valid() === false, "A scanner's observed owner withdrawal must latch before reenable.");
    const refusal = await f.post(); refused(f, refusal.response, refusal.nonce); enabled = true; gate.resolve(f.key);
    refused(f, await first.result, nonce); assert(f.preparations.length === 1, "Observed disabled request must not prepare another index or revive the held ALLOW.");
});
test("F26a owner rechecks exact index identity and bytes after asynchronous final key loading", options, async t => {
    const gate = deferred<KeyObject | undefined>(), f = await fixture(t, { loadKey: async (call, initial) => call === 1 ? initial : gate.promise });
    f.cleanup.push(() => gate.resolve(f.key)); await f.start(); const nonce = randomUUID(), first = begin(f.descriptor.endpoint, f.body(nonce));
    await until(() => f.loads >= 2); const changed = indexBytes(); changed[40] ^= 1; await writeFile(f.index.indexFile, changed); gate.resolve(f.key);
    refused(f, await first.result, nonce); assert(!f.index.available(), "Final index drift must invalidate the captured capability.");
});
test("F26a owner asks exact completed result release again after final key await", options, async t => {
    const gate = deferred<KeyObject | undefined>(), f = await fixture(t, { loadKey: async (call, initial) => call === 1 ? initial : gate.promise });
    f.cleanup.push(() => gate.resolve(f.key)); await f.start(); const nonce = randomUUID(), first = begin(f.descriptor.endpoint, f.body(nonce));
    await until(() => f.loads >= 2); f.scans[0].allowRelease = false; gate.resolve(f.key); refused(f, await first.result, nonce);
    assert(f.scans[0].releases.includes(f.scans[0].held), "Final release must test identity of the original completed scan result.");
});
test("F26a owner premature scanner ALLOW cannot release while actual scanner ownership remains open", options, async t => {
    const f = await fixture(t, { hold: true }); await f.start(); const nonce = randomUUID(), first = begin(f.descriptor.endpoint, f.body(nonce));
    await until(() => f.scans.length === 1); f.scans[0].completeBeforeClose(); await tick(); await tick();
    assert(f.owner.busy && !first.settled && f.scans[0].busy, "A result cannot substitute for actual ownership closure.");
    f.scans[0].finish(); assert(decoded(f, await first.result, nonce)?.status === "ALLOW", "Naturally closed valid scanner may then release.");
});
test("F26a owner aborted transport withdraws scan and remains busy until actual closure", options, async t => {
    const f = await fixture(t, { hold: true }); await f.start(); const first = begin(f.descriptor.endpoint, f.body());
    await until(() => f.scans.length === 1 && f.scans[0].starts === 1); first.request.destroy(); await first.result;
    await until(() => f.scans[0].withdrawals > 0); assert(f.owner.busy && f.scans[0].busy, "Abort cannot pretend an owned scanner has closed.");
    const second = await f.post(); refused(f, second.response, second.nonce);
    assert(f.preparations.length === 1 && f.scans.length === 1, "Aborted owned scan cannot be replaced before actual close.");
    f.scans[0].finish(); await until(() => !f.owner.busy);
});
test("F26a owner close withdraws active scan and waits for actual natural closure", options, async t => {
    const f = await fixture(t, { hold: true }); await f.start(); const nonce = randomUUID(), first = begin(f.descriptor.endpoint, f.body(nonce));
    await until(() => f.scans.length === 1); let closed = false; const close = f.owner.close().then(() => { closed = true; });
    await until(() => f.scans[0].withdrawals > 0); await tick();
    assert(!closed && f.owner.busy && f.scans[0].busy, "Close must preserve actual active ownership until its natural close.");
    f.scans[0].finish(); await close; refused(f, await first.result, nonce);
    assert(await f.owner.start() === undefined && !f.owner.busy, "Closed service cannot be revived.");
});
test("F26a owner explicit close while final key is pending cannot sign a revived ALLOW", options, async t => {
    const gate = deferred<KeyObject | undefined>(), f = await fixture(t, { loadKey: async (call, initial) => call === 1 ? initial : gate.promise });
    f.cleanup.push(() => gate.resolve(f.key)); await f.start(); const nonce = randomUUID(), first = begin(f.descriptor.endpoint, f.body(nonce));
    await until(() => f.loads >= 2); const close = f.owner.close(); gate.resolve(f.key); await close; refused(f, await first.result, nonce);
    assert(await f.owner.start() === undefined, "Pending final work cannot revive a closed installation session.");
});
test("F26a owner preparation and scanner factory exceptions remain fixed refusals without raw diagnostics", options, async t => {
    for (const settings of [{ prepare: () => { throw Error(PRIVATE); } }, { create: () => { throw Error(PRIVATE); } }]) {
        const f = await fixture(t, settings); await f.start(); const { nonce, response } = await f.post(); refused(f, response, nonce);
    }
});
