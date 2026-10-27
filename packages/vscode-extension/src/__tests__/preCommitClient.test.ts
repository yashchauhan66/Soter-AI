import assert from "node:assert/strict";
import { createHash, createPublicKey, generateKeyPairSync, randomUUID, type KeyObject } from "node:crypto";
import { mkdtemp, mkdir, writeFile, readFile, rename, lstat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, relative, isAbsolute, sep } from "node:path";
import { test } from "node:test";
import { parseHookClientPin, type HookClientPin } from "../history-hooks/PreCommitHookText";
import { parseHookRequest, signHookDecision, signHookDescriptor, type HookDecision, type HookDescriptor, type HookRequest } from "../history-hooks/PreCommitWire";
import { captureHookIndex, prepareCheckedHookIndex } from "../history-hooks/CheckedHookIndex";

// TEST FIRST: retained manual SHA1 DIRC roots and ordinary synthetic artifacts.
// Real Ed25519 wire helpers, fake request seam only. No network, Git/other child,
// native runtime execution, real profile/credential access, signals or deletion.
const options = { skip: process.platform !== "win32", timeout: 10000 };
const PRIVATE = "TEST_ONLY_F26A_CLIENT_PRIVATE_8e36f9ad";
const CONFIG = "[core]\n repositoryformatversion = 0\n bare = false\n";
type Result = "ALLOW" | "BLOCK" | "UNAVAILABLE";
type ClientOptions = { runtime?: string; worker?: string; now?: () => number;
    request?: (endpoint: string, rawRequest: Buffer, deadline: number) => Promise<Buffer | undefined> };
type Client = (rawPin: Buffer, indexPath: unknown, options?: ClientOptions) => Promise<Result>;
type Snapshot = NonNullable<ReturnType<typeof captureHookIndex>>;
interface RequestContext {
    endpoint: string; raw: Buffer; request: Readonly<HookRequest>; deadline: number;
    reply(patch?: Partial<HookDecision>, key?: KeyObject): Buffer;
}
interface Invocation { pin?: Buffer; runtime?: string; worker?: string; now?: () => number; request?: (context: RequestContext) => Promise<Buffer | undefined> }
const digest = (bytes: Buffer): string => createHash("sha256").update(bytes).digest("hex");
function indexBytes(oid = "1".repeat(40)): Buffer {
    const header = Buffer.alloc(12), name = Buffer.from("public.txt"), row = Buffer.alloc(Math.ceil((62 + name.length + 1) / 8) * 8);
    header.write("DIRC", 0, "ascii"); header.writeUInt32BE(2, 4); header.writeUInt32BE(1, 8);
    row.writeUInt32BE(0o100644, 24); Buffer.from(oid, "hex").copy(row, 40); row.writeUInt16BE(name.length, 60); name.copy(row, 62);
    const body = Buffer.concat([header, row]); return Buffer.concat([body, createHash("sha1").update(body).digest()]);
}
function inside(root: string, target: string): void {
    const rel = relative(resolve(root), resolve(target));
    assert(rel && !isAbsolute(rel) && rel !== ".." && !rel.startsWith(".." + sep), "All retained fixture mutations must remain inside their exact synthetic root.");
}
async function retainWrite(root: string, target: string, bytes: Buffer): Promise<void> {
    inside(root, target); const retained = target + ".before-" + randomUUID(); inside(root, retained);
    await writeFile(retained, await readFile(target), { flag: "wx" }); await writeFile(target, bytes);
}
async function sameBytesReplace(root: string, target: string): Promise<void> {
    inside(root, target); const bytes = await readFile(target), before = await lstat(target);
    const incoming = target + ".incoming-" + randomUUID(), retained = target + ".before-" + randomUUID();
    inside(root, incoming); inside(root, retained);
    await writeFile(retained, bytes, { flag: "wx" }); await writeFile(incoming, bytes, { flag: "wx" }); await rename(incoming, target);
    assert((await lstat(target)).ino !== before.ino, "Byte-identical replacement fixture must change underlying file identity.");
}
async function implementation(): Promise<Client> {
    const module = await import("../history-hooks/PreCommitClient");
    assert(typeof module.runPreCommitClient === "function", "The frozen finite pre-commit client API must exist."); return module.runPreCommitClient as Client;
}
async function fixture() {
    const run = await implementation(), root = await mkdtemp(join(tmpdir(), "soter-f26a-client-"));
    for (const folder of [".git/objects/info", ".git/objects/pack", ".git/refs/heads", "assets", "profile", "synthetic-windows"])
        await mkdir(join(root, ...folder.split("/")), { recursive: true });
    await writeFile(join(root, ".git", "config"), CONFIG, { flag: "wx" });
    await writeFile(join(root, ".git", "HEAD"), "ref: refs/heads/main\n", { flag: "wx" });
    const indexFile = join(root, ".git", "index"); await writeFile(indexFile, indexBytes(), { flag: "wx" });
    const worker = join(root, "assets", "pre-commit-client.js"), runtime = join(root, "assets", "Code.exe"), descriptor = join(root, "profile", "endpoint.json");
    const workerBytes = Buffer.from("// SYNTHETIC F26a worker bytes; never executed.\n"), runtimeBytes = Buffer.from("MZ_SYNTHETIC_F26A_RUNTIME_NEVER_EXECUTED");
    await writeFile(worker, workerBytes, { flag: "wx" }); await writeFile(runtime, runtimeBytes, { flag: "wx" });
    const key = generateKeyPairSync("ed25519").privateKey, generation = randomUUID(), session = randomUUID();
    const publicKey = (createPublicKey(key).export({ format: "der", type: "spki" }) as Buffer).toString("base64");
    let pin: HookClientPin = { version: 1, root, generation, publicKey, worker, workerSha256: digest(workerBytes), runtime,
        runtimeSha256: digest(runtimeBytes), descriptor, systemRoot: join(root, "synthetic-windows") };
    function signedDescriptor(patch: Partial<HookDescriptor> = {}, signingKey = key): Buffer {
        const raw = signHookDescriptor({ version: 1, root, generation, session, endpoint: "http://127.0.0.1:43127/pre-commit",
            workerSha256: pin.workerSha256, runtimeSha256: pin.runtimeSha256, ...patch }, signingKey);
        assert(Buffer.isBuffer(raw), "Synthetic descriptor framing must be valid before any tested rejection."); return raw;
    }
    await writeFile(descriptor, signedDescriptor(), { flag: "wx" });
    const index = await prepareCheckedHookIndex(root, undefined,
        { SystemRoot: process.env.SystemRoot, WINDIR: process.env.WINDIR, COMSPEC: process.env.COMSPEC }, () => true);
    assert(index, "Manual synthetic DIRC fixture must acquire genuine root-bound index metadata without a child.");
    const requests: RequestContext[] = [];
    return { root, index, indexFile, worker, runtime, descriptor, key, generation, session, requests, signedDescriptor,
        get pin() { return pin; }, rawPin() { return Buffer.from(JSON.stringify(pin)); },
        rebind(patch: Partial<HookClientPin>) { pin = { ...pin, ...patch }; },
        async run(selected: unknown = undefined, settings: Invocation = {}): Promise<Result> {
            const expected = captureHookIndex(root, selected);
            const request = async (endpoint: string, rawRequest: Buffer, deadline: number): Promise<Buffer | undefined> => {
                const parsed = parseHookRequest(rawRequest, { generation, session });
                assert(parsed, "Client must send the exact canonical finite request schema bound to the initial descriptor.");
                assert(expected, "Invalid effective-index selection must refuse before any request or fallback.");
                const context: RequestContext = { endpoint, raw: Buffer.from(rawRequest), request: parsed, deadline,
                    reply(patch = {}, signingKey = key) {
                        const raw = signHookDecision({ version: 1, root, generation, session, nonce: parsed.nonce, status: "ALLOW",
                            indexSha256: (expected as Snapshot).indexSha256, indexIdentity: (expected as Snapshot).indexIdentity, ...patch }, signingKey);
                        assert(Buffer.isBuffer(raw), "Synthetic decision framing must be valid before any tested rejection."); return raw;
                    } };
                requests.push(context); return settings.request ? settings.request(context) : context.reply();
            };
            return run(settings.pin ?? this.rawPin(), selected, { runtime: settings.runtime ?? runtime, worker: settings.worker ?? worker,
                now: settings.now ?? (() => 1000), request });
        } };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
async function unavailable(f: Fixture, selected: unknown = undefined, settings: Invocation = {}): Promise<void> {
    assert(await f.run(selected, settings) === "UNAVAILABLE", "Invalid, unavailable or withdrawn authority must never authorize a commit.");
}

test("F26a client allows only reviewed artifacts signed current owner and exact genuine index metadata", options, async () => {
    const f = await fixture(), before = new Map<string, Buffer>();
    for (const file of [f.worker, f.runtime, f.descriptor, f.indexFile]) before.set(file, await readFile(file));
    const rawPin = f.rawPin(), copy = Buffer.from(rawPin); assert(parseHookClientPin(rawPin), "Fixture must start from a valid reviewed public pin.");
    assert(await f.run(undefined, { pin: rawPin }) === "ALLOW" && f.requests.length === 1, "Complete unchanged cooperative commit must remain useful.");
    const request = f.requests[0];
    assert(request.endpoint === "http://127.0.0.1:43127/pre-commit" && request.request.indexFile === ".git/index", "Undefined index selects only the default literal index path.");
    assert(request.deadline > 1000 && request.deadline <= 61000, "Private request must share the bounded whole-client deadline.");
    assert(rawPin.equals(copy), "Client must preserve reviewed caller pin bytes.");
    for (const [file, bytes] of before) assert((await readFile(file)).equals(bytes), "Client must preserve every observed fixture artifact and index.");
});
test("F26a client creates a fresh nonce for each invocation and never sends body findings or environment", options, async () => {
    const f = await fixture(); await writeFile(join(f.root, "public.txt"), PRIVATE, { flag: "wx" });
    assert(await f.run() === "ALLOW" && await f.run() === "ALLOW", "Public staged index remains useful despite an unstaged synthetic private worktree.");
    assert(f.requests.length === 2 && f.requests[0].request.nonce !== f.requests[1].request.nonce, "Each finite invocation needs a fresh nonce.");
    for (const request of f.requests) {
        assert(Reflect.ownKeys(request.request).sort().join(",") === "generation,indexFile,nonce,session,version", "Only fixed signed-owner binding and selected-index data enter requests.");
        assert(!request.raw.includes(Buffer.from(PRIVATE)) && !request.raw.includes(Buffer.from("public.txt"))
            && !request.raw.includes(Buffer.from("NODE_OPTIONS")) && !request.raw.includes(Buffer.from("publicKey")), "No worktree content, filenames, credentials or ambient fields enter the request.");
    }
});
test("F26a client honors an exact selected alternative index instead of a public default fallback", options, async () => {
    const f = await fixture(), alternative = join(f.root, ".git", "index.lock"); await writeFile(alternative, indexBytes("2".repeat(40)), { flag: "wx" });
    assert(await f.run(".git/index.lock") === "ALLOW", "A genuine bounded alternate index may complete.");
    assert(f.requests[0].request.indexFile === ".git/index.lock", "Selected relative index must remain literal request data.");
    assert(await f.run(alternative) === "ALLOW" && f.requests[1].request.indexFile === alternative, "Selected absolute index must retain its exact reviewed data.");
});
test("F26a client explicit empty invalid missing and outside index selectors refuse without a request", options, async () => {
    const f = await fixture(); await writeFile(join(f.root, "public.txt"), PRIVATE, { flag: "wx" });
    for (const selected of ["", null, 0, {}, ".git/missing-index", "public.txt", ".git/../.git/index", "C:relative", "\\\\server\\share\\index"])
        await unavailable(f, selected);
    assert(f.requests.length === 0, "Explicitly invalid or absent selected indexes cannot use default/worktree/request fallback.");
});
test("F26a client malformed noncanonical duplicate and oversized pins refuse before any request", options, async () => {
    const f = await fixture(), good = f.rawPin();
    for (const pin of [Buffer.from("{}"), Buffer.from(" " + good.toString()), Buffer.from(good.toString().replace('"version":1', '"version":1,"version":1')),
        Buffer.from([0xef, 0xbb, 0xbf, ...good]), Buffer.from([0xff]), Buffer.alloc(12289, 32)]) await unavailable(f, undefined, { pin });
    assert(f.requests.length === 0, "Invalid reviewed pin bytes cannot admit a request.");
});
test("F26a client invalid pin versions paths hashes and signing key cannot borrow real files", options, async () => {
    const f = await fixture();
    for (const patch of [{ version: 2 }, { worker: "relative" }, { descriptor: f.descriptor + ":stream" }, { root: "C:\\MissingSyntheticRoot" },
        { workerSha256: "0".repeat(64) }, { runtimeSha256: "0".repeat(64) }, { publicKey: "not-a-key" }, { extra: true }])
        await unavailable(f, undefined, { pin: Buffer.from(JSON.stringify({ ...f.pin, ...patch })) });
    assert(f.requests.length === 0, "Pin validation and artifact checks must precede request admission.");
});
test("F26a client exact runtime and worker invocation paths cannot be replaced by same-byte siblings", options, async () => {
    const f = await fixture(), otherRuntime = join(f.root, "assets", "OtherCode.exe"), otherWorker = join(f.root, "assets", "other-client.js");
    await writeFile(otherRuntime, await readFile(f.runtime), { flag: "wx" }); await writeFile(otherWorker, await readFile(f.worker), { flag: "wx" });
    await unavailable(f, undefined, { runtime: otherRuntime }); await unavailable(f, undefined, { worker: otherWorker });
    assert(f.requests.length === 0, "Matching hashes cannot substitute an unreviewed invocation path.");
});
test("F26a client missing or changed initial artifacts refuse before owner request", options, async () => {
    for (const kind of ["runtime", "worker", "descriptor"] as const) {
        const f = await fixture(), file = f[kind], retained = file + ".missing-retained"; inside(f.root, retained); await rename(file, retained);
        await unavailable(f); assert(f.requests.length === 0, "Missing artifacts must not attempt endpoint fallback.");
    }
    const f = await fixture(); await retainWrite(f.root, f.worker, Buffer.from(PRIVATE)); await unavailable(f);
    assert(f.requests.length === 0, "Unpinned worker bytes cannot admit a request.");
});
test("F26a client descriptor key root installation and artifact bindings must all verify before request", options, async () => {
    const patches: Partial<HookDescriptor>[] = [{ root: "C:\\DifferentSyntheticRoot" }, { generation: randomUUID() },
        { workerSha256: "c".repeat(64) }, { runtimeSha256: "d".repeat(64) }];
    for (const patch of patches) {
        const f = await fixture(); await retainWrite(f.root, f.descriptor, f.signedDescriptor(patch)); await unavailable(f);
        assert(f.requests.length === 0, "Wrong descriptor bindings must refuse before any request.");
    }
    const f = await fixture(); await retainWrite(f.root, f.descriptor, f.signedDescriptor({}, generateKeyPairSync("ed25519").privateKey));
    await unavailable(f); assert(f.requests.length === 0, "Foreign descriptor signature cannot authenticate the owner.");
});
test("F26a client descriptor framing and8192 byte cap withhold malformed endpoint metadata", options, async () => {
    for (const kind of ["oversize", "malformed", "forged-endpoint"] as const) {
        const f = await fixture(); let bytes = Buffer.alloc(8193, 32);
        if (kind === "malformed") bytes = Buffer.from("{");
        if (kind === "forged-endpoint") {
            const value = JSON.parse((await readFile(f.descriptor)).toString()); value.payload.endpoint = "http://example.invalid/pre-commit"; bytes = Buffer.from(JSON.stringify(value));
        }
        await retainWrite(f.root, f.descriptor, bytes); await unavailable(f); assert(f.requests.length === 0, "Malformed/capped descriptors cannot select another endpoint.");
    }
});
test("F26a client verified current BLOCK remains useful while BUSY unavailable empty and thrown transport refuse", options, async () => {
    const f = await fixture();
    assert(await f.run(undefined, { request: async context => context.reply({ status: "BLOCK" }) }) === "BLOCK", "Correctly bound signed candidate refusal must remain BLOCK.");
    for (const status of ["BUSY", "UNAVAILABLE"] as const) await unavailable(f, undefined, { request: async context => context.reply({ status }) });
    await unavailable(f, undefined, { request: async () => undefined });
    await unavailable(f, undefined, { request: async () => { throw Error(PRIVATE); } });
});
test("F26a client rejects wrong signed decision nonce session root and installation generation", options, async () => {
    const f = await fixture();
    for (const patch of [{ nonce: randomUUID() }, { session: randomUUID() }, { root: "C:\\AnotherSyntheticRoot" }, { generation: randomUUID() }])
        await unavailable(f, undefined, { request: async context => context.reply(patch) });
});
test("F26a client rejects signed decisions with different index digest or identity including BLOCK", options, async () => {
    const f = await fixture();
    for (const status of ["ALLOW", "BLOCK"] as const) for (const patch of [{ indexSha256: "e".repeat(64) }, { indexIdentity: "f".repeat(64) }])
        await unavailable(f, undefined, { request: async context => context.reply({ status, ...patch }) });
});
test("F26a client foreign forged malformed and oversized decision signatures cannot authorize", options, async () => {
    const f = await fixture();
    await unavailable(f, undefined, { request: async context => context.reply({}, generateKeyPairSync("ed25519").privateKey) });
    await unavailable(f, undefined, { request: async context => { const value = JSON.parse(context.reply().toString()); value.signature = "A".repeat(86); return Buffer.from(JSON.stringify(value)); } });
    await unavailable(f, undefined, { request: async () => Buffer.from("{") });
    await unavailable(f, undefined, { request: async () => Buffer.alloc(8193, 32) });
});
test("F26a client signed prior nonce replay cannot authorize a later invocation", options, async () => {
    const f = await fixture(); let old: Buffer | undefined;
    assert(await f.run(undefined, { request: async context => { old = context.reply(); return old; } }) === "ALLOW", "First correctly bound decision must verify.");
    await unavailable(f, undefined, { request: async () => old });
    assert(f.requests.length === 2 && f.requests[0].request.nonce !== f.requests[1].request.nonce, "Replay test must actually use a new request nonce.");
});
test("F26a client final synchronous index recapture rejects changed bytes and same-byte replacement", options, async () => {
    for (const status of ["ALLOW", "BLOCK"] as const) for (const replacement of [false, true]) {
        const f = await fixture(); await unavailable(f, undefined, { request: async context => {
            const decision = context.reply({ status });
            if (replacement) await sameBytesReplace(f.root, f.indexFile); else await retainWrite(f.root, f.indexFile, indexBytes("2".repeat(40)));
            return decision;
        } });
        assert(f.requests.length === 1, "Final-index race must occur after the authenticated request was actually admitted.");
    }
});
test("F26a client descriptor restart byte drift and same-byte identity replacement revoke held decisions", options, async () => {
    for (const kind of ["restart", "byte-drift", "same-bytes"] as const) {
        const f = await fixture(); await unavailable(f, undefined, { request: async context => {
            const decision = context.reply();
            if (kind === "same-bytes") await sameBytesReplace(f.root, f.descriptor);
            else await retainWrite(f.root, f.descriptor, kind === "restart" ? f.signedDescriptor({ session: randomUUID() }) : Buffer.from(PRIVATE));
            return decision;
        } });
    }
});
test("F26a client final runtime and worker hashes and identities reject await-time artifact replacement", options, async () => {
    for (const kind of ["worker", "runtime"] as const) for (const identical of [false, true]) {
        const f = await fixture(); await unavailable(f, undefined, { request: async context => {
            const decision = context.reply(), file = f[kind];
            if (identical) await sameBytesReplace(f.root, file); else await retainWrite(f.root, file, Buffer.from(PRIVATE));
            return decision;
        } });
    }
});
test("F26a client monotonic whole-operation deadline rejects expiry reversal and nonfinite clocks", options, async () => {
    for (const final of [61000, 61001, 999, Number.NaN, Number.POSITIVE_INFINITY]) {
        let now = 1000; const f = await fixture();
        await unavailable(f, undefined, { now: () => now, request: async context => { const decision = context.reply(); now = final; return decision; } });
    }
    const f = await fixture(); await unavailable(f, undefined, { now: () => Number.NaN });
    assert(f.requests.length === 0, "Invalid initial clock cannot admit a request.");
});
test("F26a client worker2MiB cap is inclusive and refuses larger actual pinned files before request", options, async () => {
    for (const size of [2097152, 2097153]) {
        const f = await fixture(), bytes = Buffer.alloc(size, 35); await retainWrite(f.root, f.worker, bytes);
        f.rebind({ workerSha256: digest(bytes) }); await retainWrite(f.root, f.descriptor, f.signedDescriptor());
        const result = await f.run();
        assert(result === (size === 2097152 ? "ALLOW" : "UNAVAILABLE"), "Worker byte cap must be inclusive and checked even when its hash is pinned.");
        assert(f.requests.length === (size === 2097152 ? 1 : 0), "Oversize worker must refuse before owner request.");
    }
});
