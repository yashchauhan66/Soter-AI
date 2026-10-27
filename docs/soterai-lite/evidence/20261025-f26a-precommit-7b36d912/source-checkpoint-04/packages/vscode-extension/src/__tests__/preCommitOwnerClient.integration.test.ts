import assert from "node:assert/strict";
import { createHash, createPublicKey, generateKeyPairSync, randomUUID } from "node:crypto";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { createServer, type ServerResponse, type Server } from "node:http";
import { Socket } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import { prepareCheckedHookIndex, isCheckedHookIndex, type CheckedHookIndex } from "../history-hooks/CheckedHookIndex";
import { runPreCommitClient } from "../history-hooks/PreCommitClient";
import { PreCommitOwnerService } from "../history-hooks/PreCommitOwnerService";
import { parseHookRequest, signHookDecision, signHookDescriptor, verifyHookDescriptor, type HookRequest } from "../history-hooks/PreCommitWire";
import type { HookClientPin } from "../history-hooks/PreCommitHookText";

// ADDITIVE TEST FIRST: actual default HTTP adapter and actual owning service,
// with completed fake scanners and inert synthetic runtime/worker files only.
// No request/clock override, Git/other child, native executable or real profile.
// Socket guard refuses every noncaptured/non-numeric-loopback connect before I/O.
const options = { skip: process.platform !== "win32", timeout: 12000 };
const CONFIG = "[core]\n repositoryformatversion = 0\n bare = false\n";
const PRIVATE = "TEST_ONLY_F26A_HTTP_PRIVATE_2d0a45bf";
const digest = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
function indexBytes(): Buffer {
    const name = Buffer.from("public.txt"), header = Buffer.alloc(12), row = Buffer.alloc(Math.ceil((62 + name.length + 1) / 8) * 8);
    header.write("DIRC", 0, "ascii"); header.writeUInt32BE(2, 4); header.writeUInt32BE(1, 8);
    row.writeUInt32BE(0o100644, 24); Buffer.from("1".repeat(40), "hex").copy(row, 40); row.writeUInt16BE(name.length, 60); name.copy(row, 62);
    const body = Buffer.concat([header, row]); return Buffer.concat([body, createHash("sha1").update(body).digest()]);
}
async function fixture() {
    const root = await mkdtemp(join(tmpdir(), "soter-f26a-http-"));
    for (const folder of [".git/objects/info", ".git/objects/pack", ".git/refs/heads", "assets", "profile", "synthetic-windows"])
        await mkdir(join(root, ...folder.split("/")), { recursive: true });
    await writeFile(join(root, ".git", "config"), CONFIG, { flag: "wx" });
    await writeFile(join(root, ".git", "HEAD"), "ref: refs/heads/main\n", { flag: "wx" });
    await writeFile(join(root, ".git", "index"), indexBytes(), { flag: "wx" });
    const worker = join(root, "assets", "pre-commit-client.js"), runtime = join(root, "assets", "Code.exe"), descriptor = join(root, "profile", "endpoint.json");
    const workerBytes = Buffer.from("// Synthetic F26a HTTP worker; never executed.\n"), runtimeBytes = Buffer.from("MZ_SYNTHETIC_HTTP_RUNTIME_NEVER_EXECUTED");
    await writeFile(worker, workerBytes, { flag: "wx" }); await writeFile(runtime, runtimeBytes, { flag: "wx" });
    await writeFile(join(root, "public.txt"), PRIVATE, { flag: "wx" });
    const index = await prepareCheckedHookIndex(root, undefined,
        { SystemRoot: process.env.SystemRoot, WINDIR: process.env.WINDIR, COMSPEC: process.env.COMSPEC }, () => true);
    assert(index, "Retained manual DIRC fixture must acquire genuine checked metadata without a Git child.");
    const key = generateKeyPairSync("ed25519").privateKey, generation = randomUUID();
    const publicKey = (createPublicKey(key).export({ format: "der", type: "spki" }) as Buffer).toString("base64");
    const pin: HookClientPin = { version: 1, root, generation, publicKey, worker, workerSha256: digest(workerBytes), runtime,
        runtimeSha256: digest(runtimeBytes), descriptor, systemRoot: join(root, "synthetic-windows") };
    return { root, index, worker, runtime, descriptor, key, generation, publicKey, pin,
        run() { return runPreCommitClient(Buffer.from(JSON.stringify(pin)), undefined, { runtime, worker }); } };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
interface ScanOptions { index: CheckedHookIndex; valid: () => boolean; deadline: number }
class CompletedScan {
    readonly closed = Promise.resolve(); readonly busy = false;
    readonly result: Readonly<{ status: "ALLOW" | "BLOCK" }>; starts = 0; withdrawals = 0;
    constructor(readonly options: ScanOptions, status: "ALLOW" | "BLOCK") { this.result = Object.freeze({ status }); }
    start() { this.starts++; return Promise.resolve(this.result); }
    withdraw(): void { this.withdrawals++; }
    canRelease(value: unknown): boolean { return value === this.result && this.options.valid() === true && this.options.index.available(); }
}
async function ownerFixture(t: TestContext, status: "ALLOW" | "BLOCK") {
    const f = await fixture(), scans: CompletedScan[] = []; let enabled = true, loads = 0;
    const owner = new PreCommitOwnerService({ root: f.root, generation: f.generation, workerSha256: f.pin.workerSha256,
        runtimeSha256: f.pin.runtimeSha256, valid: () => enabled, loadKey: async () => { loads++; return f.key; },
        ambient: { SystemRoot: process.env.SystemRoot, WINDIR: process.env.WINDIR, COMSPEC: process.env.COMSPEC },
        createScan: input => { const scan = new CompletedScan(input, status); scans.push(scan); return scan; } });
    t.after(async () => { await owner.close(); });
    const raw = await owner.start(); assert(Buffer.isBuffer(raw), "Genuine synthetic owner must start its loopback listener.");
    const descriptor = verifyHookDescriptor(raw, f.publicKey, { root: f.root, generation: f.generation,
        workerSha256: f.pin.workerSha256, runtimeSha256: f.pin.runtimeSha256 });
    assert(descriptor, "Actual owning-service descriptor must verify under its reviewed pin.");
    await writeFile(f.descriptor, raw, { flag: "wx" });
    return { ...f, owner, scans, endpoint: descriptor.endpoint, get loads() { return loads; }, disable() { enabled = false; } };
}
async function loopbackOnly<T>(port: number, work: () => Promise<T>) {
    const original = Socket.prototype.connect; let allowed = 0, blocked = 0;
    Socket.prototype.connect = function(this: Socket, ...args: unknown[]) {
        let first = args[0]; if (Array.isArray(first)) first = first[0];
        const object = first && typeof first === "object" ? first as { host?: unknown; hostname?: unknown; port?: unknown } : undefined;
        const host = object ? object.host ?? object.hostname : typeof args[1] === "string" ? args[1] : undefined;
        const selectedPort = object ? object.port : first;
        if (host !== "127.0.0.1" || Number(selectedPort) !== port) { blocked++; throw Error("Synthetic loopback-only network guard refused a noncaptured target."); }
        allowed++; return Reflect.apply(original, this, args);
    } as typeof original;
    try { return { value: await work(), get allowed() { return allowed; }, get blocked() { return blocked; } }; }
    finally { Socket.prototype.connect = original; }
}
function networkWitness(value: { allowed: number; blocked: number }): void {
    assert(value.allowed === 1 && value.blocked === 0, "Default HTTP must attempt exactly one captured numeric-loopback connection and no other target.");
}
interface Observed { method: string | undefined; path: string | undefined; host: string | undefined; raw: Buffer; parsed?: Readonly<HookRequest> }
async function fakeEndpoint(t: TestContext, respond: (res: ServerResponse, request: Readonly<HookRequest>, f: Fixture) => void) {
    const f = await fixture(), session = randomUUID(), requests: Observed[] = []; let server: Server;
    server = createServer((req, res) => {
        const chunks: Buffer[] = []; let bytes = 0;
        req.on("data", chunk => { bytes += chunk.length; if (bytes <= 4096) chunks.push(Buffer.from(chunk)); });
        req.once("end", () => {
            const body = Buffer.concat(chunks), parsed = bytes <= 4096 ? parseHookRequest(body, { generation: f.generation, session }) : undefined;
            requests.push({ method: req.method, path: req.url, host: req.headers.host, raw: body, parsed });
            if (!parsed) { res.writeHead(503, { "Content-Length": "0", Connection: "close" }); res.end(); return; }
            respond(res, parsed, f);
        });
        req.on("error", () => { if (!res.destroyed) res.destroy(); });
    });
    t.after(async () => { await new Promise<void>(done => server.close(() => done())); });
    await new Promise<void>((done, fail) => { server.once("error", fail); server.listen(0, "127.0.0.1", () => { server.removeListener("error", fail); done(); }); });
    const address = server.address(); assert(address && typeof address !== "string" && address.address === "127.0.0.1", "Fake transport endpoint must bind actual numeric loopback.");
    const endpoint = "http://127.0.0.1:" + address.port + "/pre-commit";
    const descriptor = signHookDescriptor({ version: 1, root: f.root, generation: f.generation, session, endpoint,
        workerSha256: f.pin.workerSha256, runtimeSha256: f.pin.runtimeSha256 }, f.key);
    assert(Buffer.isBuffer(descriptor), "Synthetic fake-server descriptor must be genuinely signed."); await writeFile(f.descriptor, descriptor, { flag: "wx" });
    return { ...f, requests, endpoint, port: address.port };
}
function signedAllow(f: Fixture, request: Readonly<HookRequest>): Buffer {
    const raw = signHookDecision({ version: 1, root: f.root, generation: f.generation, session: request.session, nonce: request.nonce,
        status: "ALLOW", indexSha256: f.index.indexSha256, indexIdentity: f.index.indexIdentity }, f.key);
    assert(Buffer.isBuffer(raw), "Malformed transport controls must start with a genuine signed payload where applicable."); return raw;
}
function requestWitness(f: Awaited<ReturnType<typeof fakeEndpoint>>): void {
    assert(f.requests.length === 1 && f.requests[0].method === "POST" && f.requests[0].path === "/pre-commit"
        && f.requests[0].host === "127.0.0.1:" + f.port && f.requests[0].parsed?.indexFile === ".git/index", "Default adapter must make exactly the canonical bound loopback POST.");
    assert(!f.requests[0].raw.includes(Buffer.from(PRIVATE)) && !f.requests[0].raw.includes(Buffer.from("public.txt")), "Default HTTP must not disclose staged/worktree content or findings.");
}

test("F26a real owner and default client HTTP adapter allow a complete public synthetic index", options, async t => {
    const f = await ownerFixture(t, "ALLOW"), port = Number(new URL(f.endpoint).port), observed = await loopbackOnly(port, () => f.run());
    assert(observed.value === "ALLOW", "Actual owner plus unmodified default HTTP adapter must keep the positive path useful."); networkWitness(observed);
    assert(f.scans.length === 1 && f.scans[0].starts === 1 && isCheckedHookIndex(f.scans[0].options.index)
        && f.scans[0].options.index.root === f.root && f.loads >= 2, "Real owner must prepare one genuine index and finish one fake complete scan with a final key load.");
});
test("F26a real owner signed BLOCK crosses the default HTTP adapter without raw content", options, async t => {
    const f = await ownerFixture(t, "BLOCK"), observed = await loopbackOnly(Number(new URL(f.endpoint).port), () => f.run());
    assert(observed.value === "BLOCK" && f.scans.length === 1 && f.scans[0].starts === 1, "Real signed owner BLOCK must survive actual bounded HTTP framing."); networkWitness(observed);
});
test("F26a current descriptor with an absent owner refuses through the default HTTP adapter", options, async t => {
    const f = await ownerFixture(t, "ALLOW"); await f.owner.close();
    const observed = await loopbackOnly(Number(new URL(f.endpoint).port), () => f.run());
    assert(observed.value === "UNAVAILABLE" && f.scans.length === 0, "A retained valid descriptor cannot stand in for a currently absent owner."); networkWitness(observed);
});
test("F26a descriptor published before machine disable cannot admit a real HTTP scan", options, async t => {
    const f = await ownerFixture(t, "ALLOW"); f.disable(); const observed = await loopbackOnly(Number(new URL(f.endpoint).port), () => f.run());
    assert(observed.value === "UNAVAILABLE" && f.scans.length === 0, "Current owner flag must refuse before fake scanner admission despite a valid descriptor."); networkWitness(observed);
});
test("F26a default HTTP adapter refuses302 without following external Location or making a second request", options, async t => {
    const f = await fakeEndpoint(t, res => { res.writeHead(302, { Location: "http://example.invalid/synthetic-refused", "Content-Type": "application/json", "Content-Length": "2", Connection: "close" }); res.end("{}"); });
    const observed = await loopbackOnly(f.port, () => f.run());
    assert(observed.value === "UNAVAILABLE", "Redirect response cannot authorize a commit."); networkWitness(observed); requestWitness(f);
});
test("F26a default HTTP adapter refuses oversized malformed unsupported and truncated response framing", options, async t => {
    for (const mode of ["oversize", "malformed", "content-type", "chunked", "truncated"] as const) {
        const f = await fakeEndpoint(t, (res, request, fixture) => {
            const valid = signedAllow(fixture, request), bytes = mode === "oversize" ? Buffer.alloc(8193, 32) : mode === "malformed" ? Buffer.from("{") : valid;
            const headers: Record<string, string> = { "Content-Type": mode === "content-type" ? "text/plain" : "application/json", Connection: "close" };
            if (mode === "chunked") headers["Transfer-Encoding"] = "chunked";
            else headers["Content-Length"] = String(bytes.length + (mode === "truncated" ? 1 : 0));
            res.writeHead(200, headers); res.end(bytes);
        });
        const observed = await loopbackOnly(f.port, () => f.run());
        assert(observed.value === "UNAVAILABLE", "Malformed/capped HTTP framing cannot release even a genuinely signed ALLOW payload."); networkWitness(observed); requestWitness(f);
    }
});
