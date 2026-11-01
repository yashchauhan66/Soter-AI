import assert from "node:assert/strict";
import { createHash, createPublicKey, generateKeyPairSync, randomUUID, type KeyObject } from "node:crypto";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { request as httpRequest } from "node:http";
import { connect } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import type { CheckedPushRefs } from "../history-hooks/CheckedPushRefs";
import { verifyHookDescriptor, verifyHookDecision, type HookDescriptor, type HookDecision } from "../history-hooks/PrePushWire";

// TEST FIRST: retained manual transcript/root metadata, synthetic Ed25519 keys and real IPv4
// loopback HTTP only. Every scanner is fake; no Git/other child or process signal.
// A signed response authenticates its owner; these tests make no caller-identity claim.
const options = { skip: process.platform !== "win32", timeout: 12000 };
const CONFIG = "[core]\n repositoryformatversion = 0\n bare = false\n";
const PRIVATE = "TEST_ONLY_F26B_OWNER_PRIVATE_13ac97e6";
const WORKER = "a".repeat(64), RUNTIME = "b".repeat(64), ZERO = "0".repeat(64);
type Status = "ALLOW" | "BLOCK" | "UNAVAILABLE" | "STOP_UNCONFIRMED";
type ScanResult = Readonly<{ status: Status }>;
interface ScanOptions { refs: CheckedPushRefs; valid: () => boolean; deadline: number }
interface Scan {
    start(): Promise<ScanResult>; readonly closed: Promise<void>; readonly busy: boolean;
    withdraw(): void; canRelease(result: ScanResult): boolean;
}
interface OwnerOptions {
    root: string; generation: string; workerSha256: string; runtimeSha256: string; valid: () => boolean;
    loadKey: () => Promise<KeyObject | undefined>; ambient?: NodeJS.ProcessEnv;
    prepareRefs?: (root: string, transcript: Buffer, ambient: NodeJS.ProcessEnv, valid: () => boolean) => Promise<CheckedPushRefs | undefined>;
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
const TRANSCRIPT = Buffer.from("refs/heads/main " + "1".repeat(40) + " refs/heads/main " + "0".repeat(40) + "\n");
async function syntheticRefs(): Promise<CheckedPushRefs> {
    const root = await mkdtemp(join(tmpdir(), "soter-f26b-owner-"));
    for (const relative of ["objects/info", "objects/pack", "refs/heads"]) await mkdir(join(root, ".git", ...relative.split("/")), { recursive: true });
    await writeFile(join(root, ".git", "config"), CONFIG, { flag: "wx" });
    await writeFile(join(root, ".git", "HEAD"), "ref: refs/heads/main\n", { flag: "wx" });
    const { prepareCheckedPushRefs } = await import("../history-hooks/CheckedPushRefs");
    const value = await prepareCheckedPushRefs(root, TRANSCRIPT, { SystemRoot: process.env.SystemRoot, WINDIR: process.env.WINDIR, COMSPEC: process.env.COMSPEC }, () => true);
    assert(value, "Manual synthetic fixture must acquire genuine root-bound refs without a child."); return value;
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
            && this.options.valid() === true && this.options.refs.available();
    }
}
interface Settings {
    valid?: () => boolean; loadKey?: (call: number, initial: KeyObject) => Promise<KeyObject | undefined>;
    status?: Status; hold?: boolean;
    prepare?: (refs: CheckedPushRefs) => CheckedPushRefs | undefined | Promise<CheckedPushRefs | undefined>;
    create?: (options: ScanOptions) => Scan;
}
async function fixture(t: TestContext, settings: Settings = {}) {
    const module = await import("../history-hooks/PrePushOwnerService");
    assert(typeof module.PrePushOwnerService === "function", "The frozen owning-editor service must exist.");
    const Constructor = module.PrePushOwnerService as unknown as Constructor, refs = await syntheticRefs();
    const key = generateKeyPairSync("ed25519").privateKey, generation = randomUUID();
    const pin = (createPublicKey(key).export({ format: "der", type: "spki" }) as Buffer).toString("base64");
    const ambient: NodeJS.ProcessEnv = { SystemRoot: process.env.SystemRoot, WINDIR: process.env.WINDIR, COMSPEC: process.env.COMSPEC,
        PATH: PRIVATE, NODE_OPTIONS: PRIVATE, OPENAI_API_KEY: PRIVATE, GIT_INDEX_FILE: PRIVATE };
    const preparations: { root: string; transcript: Buffer; ambient: NodeJS.ProcessEnv; valid: () => boolean }[] = [], scans: FakeScan[] = [];
    const cleanup: (() => void)[] = [];
    let loads = 0;
    const owner = new Constructor({ root: refs.root, generation, workerSha256: WORKER, runtimeSha256: RUNTIME,
        valid: settings.valid ?? (() => true), ambient,
        loadKey: async () => { loads++; return settings.loadKey ? settings.loadKey(loads, key) : key; },
        prepareRefs: async (root, transcript, environment, valid) => {
            preparations.push({ root, transcript: Buffer.from(transcript), ambient: environment, valid });
            return settings.prepare ? settings.prepare(refs) : refs;
        },
        createScan: input => {
            if (settings.create) return settings.create(input);
            const scan = new FakeScan(input, settings.hold !== true, settings.status ?? "ALLOW"); scans.push(scan); return scan;
        } });
    // Retain all synthetic files. A fake child is ended naturally only by this
    // fixture's explicit completion, never by the production service.
    t.after(async () => { cleanup.forEach(work => work()); scans.forEach(scan => scan.finish()); await owner.close(); });
    let descriptor: Readonly<HookDescriptor> | undefined;
    return { owner, refs, key, pin, generation, ambient, preparations, scans, cleanup,
        get loads() { return loads; }, get descriptor() { assert(descriptor, "Service must have a verified descriptor."); return descriptor; },
        async start() {
            const raw = await owner.start(); assert(Buffer.isBuffer(raw), "Live owner with a valid private key must start.");
            descriptor = verifyHookDescriptor(raw, pin, { root: refs.root, generation, workerSha256: WORKER, runtimeSha256: RUNTIME });
            assert(descriptor, "Endpoint descriptor must verify under the reviewed public pin."); return raw;
        },
        body(nonce = randomUUID(), overrides: Record<string, unknown> = {}) {
            assert(descriptor, "Start service before forming its bound request.");
            return Buffer.from(JSON.stringify({ version: 1, generation, session: descriptor.session, nonce, transcript: TRANSCRIPT.toString("base64url"), ...overrides }));
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
        const req = httpRequest({ hostname: "127.0.0.1", port: Number(url.port), method: settings.method ?? "POST", path: settings.path ?? "/pre-push",
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
    const req = httpRequest({ hostname: "127.0.0.1", port: Number(url.port), method: "POST", path: "/pre-push", agent: false,
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
    return verifyHookDecision(response.bytes, f.pin, { root: f.refs.root, generation: f.generation, session: f.descriptor.session, nonce });
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

test("F26b owner binds signed ephemeral IPv4 descriptor exactly once", options, async t => {
    const f = await fixture(t), bytes = await f.start(), descriptor = f.descriptor, url = new URL(descriptor.endpoint);
    assert(url.protocol === "http:" && url.hostname === "127.0.0.1" && Number(url.port) > 0 && url.pathname === "/pre-push", "Owner must bind only its finite loopback route.");
    assert(!url.search && !url.hash && f.loads === 1 && f.preparations.length === 0 && f.scans.length === 0, "Startup cannot scan or merge endpoint data.");
    assert(!bytes.includes(Buffer.from(PRIVATE)) && Object.isFrozen(descriptor), "Public descriptor contains reviewed metadata only.");
    assert(await f.owner.start() === undefined && f.loads === 1, "One-shot start cannot create a second listener or load another key.");
});
test("F26b owner close before start permanently refuses startup without loading a key", options, async t => {
    const f = await fixture(t); await tick();
    assert(f.loads === 0 && f.preparations.length === 0 && f.scans.length === 0 && !f.owner.busy, "Construction alone cannot acquire authority.");
    await f.owner.close(); assert(await f.owner.start() === undefined && f.loads === 0, "Closed owner cannot revive.");
});
test("F26b owner disabled startup and later disabled requests refuse before sensitive admission", options, async t => {
    const f = await fixture(t, { valid: () => false }); assert(await f.owner.start() === undefined, "Disabled machine authority must refuse startup.");
    assert(f.loads === 0 && f.preparations.length === 0 && f.scans.length === 0, "Disabled startup must have no sensitive side effects.");
    let enabled = true; const live = await fixture(t, { valid: () => enabled }); await live.start(); enabled = false;
    const { nonce, response } = await live.post(); refused(live, response, nonce);
    assert(live.preparations.length === 0 && live.scans.length === 0, "Current flag check must precede every new refs preparation.");
});
test("F26b owner missing or unsuitable startup signing keys never create a descriptor", options, async t => {
    for (const key of [undefined, generateKeyPairSync("ed25519").publicKey, generateKeyPairSync("ec", { namedCurve: "prime256v1" }).privateKey]) {
        const f = await fixture(t, { loadKey: async () => key });
        assert(await f.owner.start() === undefined && f.scans.length === 0 && f.preparations.length === 0, "Only the installation's private Ed25519 key may start an owner.");
    }
});
test("F26b owner signs a completed public ALLOW with exact captured refs digests and request binding", options, async t => {
    const f = await fixture(t); await f.start(); const { nonce, response } = await f.post(), value = decoded(f, response, nonce);
    assert(value?.status === "ALLOW", "Complete live public scan must remain useful."); privateAbsent(response);
    const refs = f.refs as CheckedPushRefs & { transcriptSha256: string; rootIdentity: string };
    assert(value.transcriptSha256 === refs.transcriptSha256 && value.rootIdentity === refs.rootIdentity && /^[a-f0-9]{64}$/.test(value.transcriptSha256) && value.transcriptSha256 !== ZERO, "ALLOW must bind exact authentic refs bytes and identity.");
    assert(f.preparations.length === 1 && f.scans.length === 1 && f.loads >= 2 && !f.owner.busy, "One completed scan and a fresh final key load are required.");
    assert(f.scans[0].releases.includes(f.scans[0].held), "Final release must ask about the exact held ALLOW result.");
});
test("F26b owner BLOCK returns fixed signed metadata without candidate content or raw failures", options, async t => {
    const f = await fixture(t, { status: "BLOCK" }); await f.start(); const { nonce, response } = await f.post();
    assert(decoded(f, response, nonce)?.status === "BLOCK", "Canonical candidate scan must block."); privateAbsent(response);
});
test("F26b owner unavailable and unconfirmed scanner outcomes cannot become ALLOW", options, async t => {
    for (const status of ["UNAVAILABLE", "STOP_UNCONFIRMED"] as const) {
        const f = await fixture(t, { status }); await f.start(); const { nonce, response } = await f.post(); refused(f, response, nonce);
        assert(f.scans.length === 1, "Refusal must preserve one admitted finite scan.");
    }
});
test("F26b owner rejects wrong version installation session nonce and extra request authority before preparation", options, async t => {
    const f = await fixture(t); await f.start();
    for (const patch of [{ version: 2 }, { generation: randomUUID() }, { session: randomUUID() }, { nonce: "invalid" }, { root: f.refs.root }, { transcript: "~" }]) {
        const nonce = randomUUID(), response = await send(f.descriptor.endpoint, f.body(nonce, patch)); refused(f, response, nonce);
    }
    assert(f.preparations.length === 0 && f.scans.length === 0, "Invalid request metadata cannot prepare an refs.");
});
test("F26b owner rejects malformed noncanonical duplicate and invalid UTF8 request bodies before preparation", options, async t => {
    const f = await fixture(t); await f.start(); const nonce = randomUUID(), good = f.body(nonce);
    for (const body of [Buffer.from(" " + good.toString()), Buffer.from(good.toString().replace('"version":1', '"version":1,"version":1')),
        Buffer.from("{"), Buffer.from([0xef, 0xbb, 0xbf, ...good]), Buffer.from([0xff]), Buffer.alloc(0)]) {
        refused(f, await send(f.descriptor.endpoint, body), nonce);
    }
    assert(f.preparations.length === 0 && f.scans.length === 0, "No valid prefix or duplicate request may admit work.");
});
test("F26b owner refuses foreign methods paths queries and route ambiguity without preparing", options, async t => {
    const f = await fixture(t); await f.start();
    for (const route of [{ method: "GET" }, { method: "PUT" }, { path: "/" }, { path: "/pre-push?" + PRIVATE }, { path: "/pre-push/" }, { path: "/%70re-push" }]) {
        const { nonce, response } = await f.post(route); refused(f, response, nonce);
    }
    assert(f.preparations.length === 0 && f.scans.length === 0, "Only the exact fixed POST route may admit work.");
});
test("F26b owner requires exact numeric loopback Host and no Origin header", options, async t => {
    const f = await fixture(t); await f.start(); const port = new URL(f.descriptor.endpoint).port;
    const headerCases: Record<string, string>[] = [{ Host: "localhost:" + port }, { Host: "127.0.0.1" }, { Host: "127.0.0.2:" + port },
        { Host: "127.0.0.1:" + port + "." }, { Origin: "http://127.0.0.1:" + port }, { Origin: "null" }];
    for (const headers of headerCases) {
        const { nonce, response } = await f.post({ headers }); refused(f, response, nonce);
    }
    assert(f.preparations.length === 0 && f.scans.length === 0, "Host or Origin refusal must precede preparation.");
});
test("F26b owner refuses missing and unsupported content types before body admission", options, async t => {
    const f = await fixture(t); await f.start();
    for (const request of [{ omitContentType: true }, { headers: { "Content-Type": "text/plain" } }, { headers: { "Content-Type": "application/json, text/plain" } }]) {
        const { nonce, response } = await f.post(request); refused(f, response, nonce);
    }
    assert(f.preparations.length === 0 && f.scans.length === 0, "Unsupported body framing must admit no scan.");
});
test("F26b owner refuses duplicate Host content headers and transfer encoding without admitting work", options, async t => {
    const f = await fixture(t); await f.start(); const url = new URL(f.descriptor.endpoint), body = f.body();
    const base = ["POST /pre-push HTTP/1.1", "Host: 127.0.0.1:" + url.port, "Content-Type: application/json", "Content-Length: " + body.length, "Connection: close"];
    for (const extra of ["Host: 127.0.0.1:" + url.port, "Content-Type: application/json", "Content-Length: " + body.length, "Transfer-Encoding: chunked"]) {
        const response = await raw(f.descriptor.endpoint, [...base, extra], body); privateAbsent(response);
        assert(!response.bytes.includes(Buffer.from('"status":"ALLOW"')), "Ambiguous HTTP framing must never carry an ALLOW.");
    }
    assert(f.preparations.length === 0 && f.scans.length === 0, "HTTP parser or owner refusal must happen before work.");
});
test("F26b owner refuses bodies beyond49152 bytes and excessive headers without scanning a prefix", options, async t => {
    const f = await fixture(t); await f.start();
    const large = await f.post({ body: Buffer.alloc(49153, 32) }); refused(f, large.response, large.nonce);
    const oversizedHeader = await f.post({ headers: { "X-Synthetic-Bounded": "x".repeat(17000) } }); refused(f, oversizedHeader.response, oversizedHeader.nonce);
    assert(f.preparations.length === 0 && f.scans.length === 0, "Body/header caps must refuse before refs admission.");
});
test("F26b owner one-active noqueue response binds BUSY nonce and starts no second preparation or scanner", options, async t => {
    const f = await fixture(t, { hold: true }); await f.start(); const nonce = randomUUID(), first = begin(f.descriptor.endpoint, f.body(nonce));
    await until(() => f.scans.length === 1 && f.scans[0].starts === 1); assert(f.owner.busy, "Held actual ownership must remain busy.");
    const second = await f.post(), busy = decoded(f, second.response, second.nonce);
    assert(busy?.status === "BUSY" && busy.transcriptSha256 === ZERO && busy.rootIdentity === ZERO, "Live Busy response must bind only its own nonce and zero refs metadata.");
    assert(f.preparations.length === 1 && f.scans.length === 1 && !first.settled, "Busy cannot queue or start another scan.");
    f.scans[0].finish(); const response = await first.result; assert(decoded(f, response, nonce)?.status === "ALLOW", "Unchanged first request may complete naturally.");
});
test("F26b owner passes only captured root and literal exact transcript data into preparation", options, async t => {
    const f = await fixture(t); await f.start(); const nonce = randomUUID(), response = await send(f.descriptor.endpoint, f.body(nonce, { transcript: TRANSCRIPT.toString("base64url") }));
    assert(decoded(f, response, nonce)?.status === "ALLOW", "Injected genuine refs may support the requested literal path data.");
    const request = f.preparations[0];
    assert(request.root === f.refs.root && Buffer.isBuffer(request.transcript) && request.transcript.equals(TRANSCRIPT) && request.ambient === f.ambient && request.valid() === true, "Request metadata cannot replace root or ambient owner authority.");
    assert(f.scans[0].options.refs === f.refs && f.scans[0].options.deadline > 0 && f.scans[0].options.deadline <= performance.now() + 60000, "Scanner receives the genuine capability and finite whole-operation deadline.");
});
test("F26b owner rejects borrowed foreign-root and structural-clone refs capabilities before scanner creation", options, async t => {
    const foreign = await syntheticRefs();
    for (const prepare of [() => foreign, (refs: CheckedPushRefs) => ({ ...refs }) as CheckedPushRefs]) {
        const f = await fixture(t, { prepare }); await f.start(); const { nonce, response } = await f.post(); refused(f, response, nonce);
        assert(f.scans.length === 0, "Foreign or forged descriptors must never enter a scanner.");
    }
});
test("F26b owner unavailable exact transcript cannot become an empty successful tree", options, async t => {
    const f = await fixture(t, { prepare: () => undefined }); await f.start(); const { nonce, response } = await f.post(); refused(f, response, nonce);
    assert(f.preparations.length === 1 && f.scans.length === 0, "Missing exact transcript must not create a scan or fallback success.");
});
test("F26b owner changed final signing key cannot authorize a decision under either installation pin", options, async t => {
    const replacement = generateKeyPairSync("ed25519").privateKey;
    const f = await fixture(t, { loadKey: async (call, initial) => call === 1 ? initial : replacement }); await f.start(); const { nonce, response } = await f.post(); refused(f, response, nonce);
    const replacementPin = (createPublicKey(replacement).export({ format: "der", type: "spki" }) as Buffer).toString("base64");
    assert(verifyHookDecision(response.bytes, replacementPin, { root: f.refs.root, generation: f.generation, session: f.descriptor.session, nonce })?.status !== "ALLOW", "A replacement key cannot silently create new installation authority.");
});
test("F26b owner missing final key and thrown key retrieval refuse without echoing raw failures", options, async t => {
    for (const throws of [false, true]) {
        const f = await fixture(t, { loadKey: async (call, initial) => { if (call === 1) return initial; if (throws) throw Error(PRIVATE); return undefined; } });
        await f.start(); const { nonce, response } = await f.post(); refused(f, response, nonce); assert(f.loads >= 2, "Key must be loaded again after scan completion.");
    }
});
test("F26b owner held final key await cannot revive after observed disable and reenable", options, async t => {
    let enabled = true; const gate = deferred<KeyObject | undefined>();
    const f = await fixture(t, { valid: () => enabled, loadKey: async (call, initial) => call === 1 ? initial : gate.promise });
    f.cleanup.push(() => gate.resolve(f.key)); await f.start(); const nonce = randomUUID(), first = begin(f.descriptor.endpoint, f.body(nonce));
    await until(() => f.loads >= 2); enabled = false;
    assert(f.scans[0].options.valid() === false, "A scanner's observed owner withdrawal must latch before reenable.");
    const refusal = await f.post(); refused(f, refusal.response, refusal.nonce); enabled = true; gate.resolve(f.key);
    refused(f, await first.result, nonce); assert(f.preparations.length === 1, "Observed disabled request must not prepare another refs or revive the held ALLOW.");
});
test("F26b owner rechecks exact refs identity and bytes after asynchronous final key loading", options, async t => {
    const gate = deferred<KeyObject | undefined>(), f = await fixture(t, { loadKey: async (call, initial) => call === 1 ? initial : gate.promise });
    f.cleanup.push(() => gate.resolve(f.key)); await f.start(); const nonce = randomUUID(), first = begin(f.descriptor.endpoint, f.body(nonce));
    await until(() => f.loads >= 2); await writeFile(join(f.refs.root, ".git", "config"), CONFIG + "[alias]\n unsafe = status\n"); gate.resolve(f.key);
    refused(f, await first.result, nonce); assert(!f.refs.available(), "Final refs drift must invalidate the captured capability.");
});
test("F26b owner asks exact completed result release again after final key await", options, async t => {
    const gate = deferred<KeyObject | undefined>(), f = await fixture(t, { loadKey: async (call, initial) => call === 1 ? initial : gate.promise });
    f.cleanup.push(() => gate.resolve(f.key)); await f.start(); const nonce = randomUUID(), first = begin(f.descriptor.endpoint, f.body(nonce));
    await until(() => f.loads >= 2); f.scans[0].allowRelease = false; gate.resolve(f.key); refused(f, await first.result, nonce);
    assert(f.scans[0].releases.includes(f.scans[0].held), "Final release must test identity of the original completed scan result.");
});
test("F26b owner premature scanner ALLOW cannot release while actual scanner ownership remains open", options, async t => {
    const f = await fixture(t, { hold: true }); await f.start(); const nonce = randomUUID(), first = begin(f.descriptor.endpoint, f.body(nonce));
    await until(() => f.scans.length === 1); f.scans[0].completeBeforeClose(); await tick(); await tick();
    assert(f.owner.busy && !first.settled && f.scans[0].busy, "A result cannot substitute for actual ownership closure.");
    f.scans[0].finish(); assert(decoded(f, await first.result, nonce)?.status === "ALLOW", "Naturally closed valid scanner may then release.");
});
test("F26b owner aborted transport withdraws scan and remains busy until actual closure", options, async t => {
    const f = await fixture(t, { hold: true }); await f.start(); const first = begin(f.descriptor.endpoint, f.body());
    await until(() => f.scans.length === 1 && f.scans[0].starts === 1); first.request.destroy(); await first.result;
    await until(() => f.scans[0].withdrawals > 0); assert(f.owner.busy && f.scans[0].busy, "Abort cannot pretend an owned scanner has closed.");
    const second = await f.post(); refused(f, second.response, second.nonce);
    assert(f.preparations.length === 1 && f.scans.length === 1, "Aborted owned scan cannot be replaced before actual close.");
    f.scans[0].finish(); await until(() => !f.owner.busy);
});
test("F26b owner close withdraws active scan and waits for actual natural closure", options, async t => {
    const f = await fixture(t, { hold: true }); await f.start(); const nonce = randomUUID(), first = begin(f.descriptor.endpoint, f.body(nonce));
    await until(() => f.scans.length === 1); let closed = false; const close = f.owner.close().then(() => { closed = true; });
    await until(() => f.scans[0].withdrawals > 0); await tick();
    assert(!closed && f.owner.busy && f.scans[0].busy, "Close must preserve actual active ownership until its natural close.");
    f.scans[0].finish(); await close; refused(f, await first.result, nonce);
    assert(await f.owner.start() === undefined && !f.owner.busy, "Closed service cannot be revived.");
});
test("F26b owner explicit close while final key is pending cannot sign a revived ALLOW", options, async t => {
    const gate = deferred<KeyObject | undefined>(), f = await fixture(t, { loadKey: async (call, initial) => call === 1 ? initial : gate.promise });
    f.cleanup.push(() => gate.resolve(f.key)); await f.start(); const nonce = randomUUID(), first = begin(f.descriptor.endpoint, f.body(nonce));
    await until(() => f.loads >= 2); const close = f.owner.close(); gate.resolve(f.key); await close; refused(f, await first.result, nonce);
    assert(await f.owner.start() === undefined, "Pending final work cannot revive a closed installation session.");
});
test("F26b owner preparation and scanner factory exceptions remain fixed refusals without raw diagnostics", options, async t => {
    for (const settings of [{ prepare: () => { throw Error(PRIVATE); } }, { create: () => { throw Error(PRIVATE); } }]) {
        const f = await fixture(t, settings); await f.start(); const { nonce, response } = await f.post(); refused(f, response, nonce);
    }
});
