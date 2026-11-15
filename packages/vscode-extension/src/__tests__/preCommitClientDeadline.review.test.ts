import assert from "node:assert/strict";
import { createHash, createPublicKey, generateKeyPairSync, randomUUID } from "node:crypto";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { createServer, type ServerResponse } from "node:http";
import { Socket } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { runPreCommitClient } from "../history-hooks/PreCommitClient";
import { prepareCheckedHookIndex } from "../history-hooks/CheckedHookIndex";
import { parseHookRequest, signHookDescriptor } from "../history-hooks/PreCommitWire";
import type { HookClientPin } from "../history-hooks/PreCommitHookText";

// ADDITIVE BEFORE-CORRECTION TEST. Actual default HTTP only, synthetic ordinary
// artifacts/index/key. Capture/trigger the actual outer JS deadline early;
// inactivity heartbeat remains real. No request/clock override, real60s wait,
// process signal, executable/child, external connect, deletion or real profile.
const options = { skip: process.platform !== "win32", timeout: 12000 };
function indexBytes(): Buffer {
    const header = Buffer.alloc(12), name = Buffer.from("public.txt"), row = Buffer.alloc(Math.ceil((62 + name.length + 1) / 8) * 8);
    header.write("DIRC", 0, "ascii"); header.writeUInt32BE(2, 4); header.writeUInt32BE(1, 8);
    row.writeUInt32BE(0o100644, 24); Buffer.from("1".repeat(40), "hex").copy(row, 40); row.writeUInt16BE(name.length, 60); name.copy(row, 62);
    const body = Buffer.concat([header, row]); return Buffer.concat([body, createHash("sha1").update(body).digest()]);
}
async function ordinaryFixture() {
    const root = await mkdtemp(join(tmpdir(), "soter-f26a-http-deadline-"));
    for (const folder of [".git/objects/info", ".git/objects/pack", ".git/refs/heads", "assets", "profile", "synthetic-windows"])
        await mkdir(join(root, ...folder.split("/")), { recursive: true });
    await writeFile(join(root, ".git", "config"), "[core]\n repositoryformatversion = 0\n bare = false\n", { flag: "wx" });
    await writeFile(join(root, ".git", "HEAD"), "ref: refs/heads/main\n", { flag: "wx" });
    await writeFile(join(root, ".git", "index"), indexBytes(), { flag: "wx" });
    const worker = join(root, "assets", "pre-commit-client.js"), runtime = join(root, "assets", "Code.exe"), descriptor = join(root, "profile", "endpoint.json");
    const workerBytes = Buffer.from("// Synthetic deadline worker; never executed.\n"), runtimeBytes = Buffer.from("MZ_SYNTHETIC_DEADLINE_RUNTIME_NEVER_EXECUTED");
    await writeFile(worker, workerBytes, { flag: "wx" }); await writeFile(runtime, runtimeBytes, { flag: "wx" });
    assert(await prepareCheckedHookIndex(root, undefined,
        { SystemRoot: process.env.SystemRoot, WINDIR: process.env.WINDIR, COMSPEC: process.env.COMSPEC }, () => true), "Manual retained DIRC must establish genuine root-bound metadata without a child.");
    const key = generateKeyPairSync("ed25519").privateKey, generation = randomUUID(), session = randomUUID();
    const pin: HookClientPin = { version: 1, root, generation,
        publicKey: (createPublicKey(key).export({ format: "der", type: "spki" }) as Buffer).toString("base64"),
        worker, workerSha256: createHash("sha256").update(workerBytes).digest("hex"), runtime,
        runtimeSha256: createHash("sha256").update(runtimeBytes).digest("hex"), descriptor, systemRoot: join(root, "synthetic-windows") };
    return { root, worker, runtime, descriptor, key, generation, session, pin };
}

test("F26a absolute client deadline settles unavailable and closes its exact active streaming HTTP ownership", options, async t => {
    const f = await ordinaryFixture(), originalTimeout = globalThis.setTimeout, originalConnect = Socket.prototype.connect;
    let peer: Socket | undefined, client: Socket | undefined, response: ServerResponse | undefined;
    let peerClosed = false, clientClosed = false, allowed = 0, blocked = 0, requests = 0, requestValid = false, sent = 0;
    let wire = Buffer.alloc(0), heartbeat: ReturnType<typeof setInterval> | undefined;
    let pending: ReturnType<typeof runPreCommitClient> | undefined;
    const acceptedSockets = new Set<Socket>();
    const capture: { trigger?: () => void; count: number; delay?: number } = { count: 0 };
    const server = createServer((req, res) => {
        const chunks: Buffer[] = []; let size = 0; peer = req.socket; peer.once("close", () => { peerClosed = true; });
        req.on("data", chunk => { size += chunk.length; if (size <= 4096) chunks.push(Buffer.from(chunk)); });
        req.once("end", () => {
            requests++; requestValid = size <= 4096 && req.method === "POST" && req.url === "/pre-commit"
                && !!parseHookRequest(Buffer.concat(chunks), { generation: f.generation, session: f.session });
            response = res;
            res.writeHead(200, { "Content-Type": "application/json", "Content-Length": "8192", Connection: "close" });
            const send = () => { if (!res.destroyed && !res.writableEnded && sent < 8191) { sent++; res.write("."); } };
            res.flushHeaders(); send(); heartbeat = setInterval(send, 25);
        });
        req.on("error", () => { /* Production cancellation may close only this transport. */ });
    });
    server.on("connection", socket => { acceptedSockets.add(socket); socket.once("close", () => acceptedSockets.delete(socket)); });
    t.after(async () => {
        // Cleanup runs after the ownership assertion. Complete only the fake
        // peer's bounded response normally; do not hide production closure.
        globalThis.setTimeout = originalTimeout; Socket.prototype.connect = originalConnect;
        if (heartbeat) clearInterval(heartbeat);
        if (response && !response.destroyed && !response.writableEnded) response.end(Buffer.alloc(8192 - sent, 46));
        const closing = new Promise<void>(done => server.close(() => done()));
        for (const socket of acceptedSockets) if (!socket.destroyed) socket.end();
        capture.trigger?.();
        if (pending) await pending;
        await closing;
    });
    await new Promise<void>((done, fail) => { server.once("error", fail); server.listen(0, "127.0.0.1", () => { server.removeListener("error", fail); done(); }); });
    const address = server.address(); assert(address && typeof address !== "string" && address.address === "127.0.0.1", "Deadline peer must bind actual numeric loopback.");
    const descriptor = signHookDescriptor({ version: 1, root: f.root, generation: f.generation, session: f.session,
        endpoint: "http://127.0.0.1:" + address.port + "/pre-commit", workerSha256: f.pin.workerSha256, runtimeSha256: f.pin.runtimeSha256 }, f.key);
    assert(Buffer.isBuffer(descriptor), "Loopback peer descriptor must be genuinely signed before the deadline race.");
    await writeFile(f.descriptor, descriptor, { flag: "wx" });
    Socket.prototype.connect = function(this: Socket, ...args: unknown[]) {
        let first = args[0]; if (Array.isArray(first)) first = first[0];
        const object = first && typeof first === "object" ? first as { host?: unknown; hostname?: unknown; port?: unknown } : undefined;
        const host = object ? object.host ?? object.hostname : typeof args[1] === "string" ? args[1] : undefined;
        if (host !== "127.0.0.1" || Number(object ? object.port : first) !== address.port) { blocked++; throw Error("Synthetic deadline guard refused a noncaptured target before I/O."); }
        allowed++; client = this; this.once("close", () => { clientClosed = true; });
        this.on("data", chunk => { if (wire.length < 16384) wire = Buffer.concat([wire, Buffer.from(chunk)]); });
        return Reflect.apply(originalConnect, this, args);
    } as typeof originalConnect;
    globalThis.setTimeout = function(handler: (...args: unknown[]) => void, delay?: number, ...args: unknown[]) {
        if (typeof handler === "function" && typeof delay === "number" && delay >= 50000 && delay <= 60000) {
            capture.count++; capture.delay = delay; let triggered = false;
            capture.trigger = () => { if (!triggered) { triggered = true; Reflect.apply(handler, undefined, args); } };
        }
        return Reflect.apply(originalTimeout, globalThis, [handler, delay, ...args]);
    } as typeof originalTimeout;
    try {
        pending = runPreCommitClient(Buffer.from(JSON.stringify(f.pin)), undefined, { runtime: f.runtime, worker: f.worker });
    } finally { globalThis.setTimeout = originalTimeout; }
    // Bounded event polling uses the original real timer; no test sleeps through
    // the actual60s deadline, and no assumption is made about clock sample count.
    const waitFor = async (predicate: () => boolean): Promise<boolean> => {
        const until = performance.now() + 2000;
        while (!predicate() && performance.now() < until) await new Promise<void>(done => originalTimeout(done, 5));
        return predicate();
    };
    assert(capture.count === 1 && capture.trigger && capture.delay! >= 50000, "Capture must identify the one actual outer absolute deadline without replacing the request adapter.");
    assert(await waitFor(() => {
        const boundary = wire.indexOf("\r\n\r\n"); return requests === 1 && requestValid && sent > 0 && boundary >= 0 && wire.length > boundary + 4;
    }), "A valid request and at least one actual streamed body byte must cross the real default HTTP transport before deadline withdrawal.");
    assert(allowed === 1 && blocked === 0 && peer && client && !peerClosed && !clientClosed && !peer.destroyed && !client.destroyed,
        "Exactly the accepted live loopback socket must be owned before the deadline trigger.");
    capture.trigger();
    assert(await pending === "UNAVAILABLE", "The absolute deadline must revoke the client result.");
    assert(await waitFor(() => peerClosed && clientClosed), "Deadline result settlement must also close the exact accepted HTTP ownership before fake-peer cleanup.");
    assert(allowed === 1 && blocked === 0 && requests === 1, "Deadline cancellation cannot retry, redirect or create another connection.");
});
