import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash, createPublicKey, generateKeyPairSync, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test, type TestContext } from "node:test";
import { build } from "esbuild";
import { parseHookRequest, signHookDescriptor, signHookDecision } from "../history-hooks/PrePushWire";
import { prePushTranscriptDigest } from "../history-hooks/PrePushProtocol";
import { pushRootIdentity } from "../history-hooks/PushRootSnapshot";

// Actual emitted production main and installed Node, synthetic Ed25519 endpoint
// on numeric loopback. No fake request or CLI override; no owner/Git child,
// push, real profile or secrets. Every spawned child closes naturally and both
// output streams reach EOF; retained emitted workers are never deleted.
const options = { skip: process.platform !== "win32", timeout: 30000 };
const TRANSCRIPT = Buffer.from("refs/heads/main " + "1".repeat(40) + " refs/heads/main " + "0".repeat(40) + "\n");
const sha = (raw: Uint8Array) => createHash("sha256").update(raw).digest("hex");
let artifact: Promise<{ bytes: Uint8Array; runtimeSha256: string }> | undefined;
function currentArtifact() {
    return artifact ??= (async () => {
        const repo = resolve(__dirname, "../../../.."), entry = resolve(__dirname, "../history-hooks/preCommitClientMain.ts");
        const result = await build({ absWorkingDir: repo, entryPoints: [entry], write: false, bundle: true, platform: "node", format: "cjs", target: "node18",
            minify: true, sourcemap: false, logLevel: "silent", tsconfig: resolve(__dirname, "../../tsconfig.json"), external: ["vscode"] });
        assert.equal(result.outputFiles.length, 1); const digest = createHash("sha256");
        for await (const chunk of createReadStream(process.execPath, { highWaterMark: 65536 })) digest.update(chunk);
        return { bytes: result.outputFiles[0].contents, runtimeSha256: digest.digest("hex") };
    })();
}
async function fixture(t: TestContext, status: "ALLOW" | "BLOCK" | "BUSY" | "UNAVAILABLE" = "ALLOW", foreignNonce = false) {
    const built = await currentArtifact(), root = await mkdtemp(join(tmpdir(), "soter-f26b-main-")), worker = join(root, "pre-commit-client.js"), descriptorFile = join(root, "endpoint.json");
    await mkdir(join(root, "synthetic-windows")); await writeFile(worker, built.bytes, { flag: "wx" });
    const key = generateKeyPairSync("ed25519").privateKey, generation = randomUUID(), session = randomUUID();
    const publicKey = (createPublicKey(key).export({ format: "der", type: "spki" }) as Buffer).toString("base64"), requests: Buffer[] = [], paths: string[] = [];
    const server = createServer({ maxHeaderSize: 4096 }, (req, res) => {
        const chunks: Buffer[] = []; req.on("data", chunk => chunks.push(Buffer.from(chunk)));
        req.once("end", () => {
            const raw = Buffer.concat(chunks); requests.push(raw); paths.push(req.url ?? "");
            const request = parseHookRequest(raw, { generation, session }); assert(request);
            const transcript = Buffer.from(request.transcript, "base64url"), transcriptSha256 = prePushTranscriptDigest(transcript), rootIdentity = pushRootIdentity(root); assert(transcriptSha256 && rootIdentity);
            const reply = signHookDecision({ version: 1, root, generation, session, nonce: foreignNonce ? randomUUID() : request.nonce, status, transcriptSha256, rootIdentity }, key); assert(reply);
            res.writeHead(200, { "Content-Type": "application/json", "Content-Length": String(reply.length), "Connection": "close" }); res.end(reply);
        });
    });
    server.on("clientError", (_error, socket) => socket.end());
    await new Promise<void>((done, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", done); });
    t.after(async () => { await new Promise<void>(done => server.close(() => done())); });
    const address = server.address(); assert(address && typeof address === "object" && address.address === "127.0.0.1");
    const workerSha256 = sha(built.bytes), descriptor = signHookDescriptor({ version: 1, root, generation, session,
        endpoint: "http://127.0.0.1:" + address.port + "/pre-push", workerSha256, runtimeSha256: built.runtimeSha256 }, key); assert(descriptor);
    await writeFile(descriptorFile, descriptor, { flag: "wx" });
    const pin = Buffer.from(JSON.stringify({ version: 1, root, generation, publicKey, worker, workerSha256, runtime: process.execPath,
        runtimeSha256: built.runtimeSha256, descriptor: descriptorFile, systemRoot: join(root, "synthetic-windows") })).toString("base64url");
    return { root, worker, pin, requests, paths,
        args: () => ["--pre-push", "--pin", pin, "--replay"],
        run(args = ["--pre-push", "--pin", pin, "--replay"], raw = TRANSCRIPT, holdInput = false) {
            const env: NodeJS.ProcessEnv = { SystemRoot: process.env.SystemRoot, WINDIR: process.env.WINDIR, COMSPEC: process.env.COMSPEC,
                TEMP: root, TMP: root, HOME: root, USERPROFILE: root };
            const child = spawn(process.execPath, [worker, ...args], { cwd: root, env, shell: false, windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
            child.kill = () => { throw Error("No process signals are authorized."); };
            const stdout: Buffer[] = [], stderr: Buffer[] = []; let outBytes = 0, errBytes = 0, outEOF = false, errEOF = false, overflow = false, spawnError: Error | undefined;
            child.stdin.on("error", () => {}); child.stdout.on("data", chunk => { outBytes += chunk.length; if (outBytes <= 131072) stdout.push(Buffer.from(chunk)); else overflow = true; });
            child.stderr.on("data", chunk => { errBytes += chunk.length; if (errBytes <= 8192) stderr.push(Buffer.from(chunk)); else overflow = true; });
            child.stdout.once("end", () => outEOF = true); child.stderr.once("end", () => errEOF = true); child.once("error", error => spawnError = error);
            const result = new Promise<{ code: number | null; stdout: Buffer; stderr: Buffer }>((done, reject) => child.once("close", (code, signal) => {
                try { assert.equal(signal, null); assert.equal(spawnError, undefined); assert(outEOF && errEOF && !overflow); done({ code, stdout: Buffer.concat(stdout), stderr: Buffer.concat(stderr) }); } catch (error) { reject(error); }
            }));
            if (holdInput) child.stdin.write(raw); else child.stdin.end(raw);
            return { child, result, observed: () => ({ outBytes, errBytes, outEOF, errEOF }) };
        } };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
async function withheld(f: Fixture, args = f.args(), raw = TRANSCRIPT) { const result = await f.run(args, raw).result; assert.equal(result.code, 1); assert.equal(result.stdout.length, 0); assert.equal(result.stderr.length, 0); }

test("F26b emitted main authorizes exact bounded stdin only through signed actual pre-push transport", options, async t => {
    const f = await fixture(t), result = await f.run().result; assert.equal(result.code, 0); assert(result.stdout.equals(Buffer.concat([TRANSCRIPT, Buffer.from(".")]))); assert.equal(result.stderr.length, 0);
    assert.deepEqual(f.paths, ["/pre-push"]); assert.equal(f.requests.length, 1); assert.equal(JSON.parse(f.requests[0].toString()).transcript, TRANSCRIPT.toString("base64url"));
});
test("F26b emitted main preserves empty and delete-only stdin with one final replay sentinel", options, async t => {
    for (const raw of [Buffer.alloc(0), Buffer.from("(delete) " + "0".repeat(40) + " refs/heads/main " + "2".repeat(40) + "\n")]) {
        const f = await fixture(t), result = await f.run(f.args(), raw).result; assert.equal(result.code, 0); assert(result.stdout.equals(Buffer.concat([raw, Buffer.from(".")]))); assert.equal(result.stderr.length, 0);
    }
});
test("F26b emitted main rejects malformed oversized incomplete and duplicate transcript before HTTP", options, async t => {
    const f = await fixture(t);
    for (const raw of [Buffer.from("bad\n"), Buffer.from(TRANSCRIPT.toString().trimEnd()), Buffer.concat([TRANSCRIPT, TRANSCRIPT]), Buffer.alloc(32769, 65), Buffer.from([0xff])]) await withheld(f, f.args(), raw);
    assert.equal(f.requests.length, 0);
});
test("F26b emitted main signed refusal busy unavailable or wrong nonce emits no replay bytes", options, async t => {
    for (const status of ["BLOCK", "BUSY", "UNAVAILABLE"] as const) { const f = await fixture(t, status); await withheld(f); assert.equal(f.requests.length, 1); }
    const f = await fixture(t, "ALLOW", true); await withheld(f); assert.equal(f.requests.length, 1);
});
test("F26b emitted main CLI grammar rejects extra missing reordered and test-override authority", options, async t => {
    const f = await fixture(t), args = f.args();
    for (const wrong of [[], args.slice(0, 3), [...args, "extra"], ["--pin", f.pin, "--pre-push", "--replay"], ["--pre-push", "--pin", f.pin, "--index"],
        [...args, "--request", "synthetic"], [...args, "--runtime", process.execPath], [...args, "--worker", f.worker], [...args, "--url", "http://127.0.0.1:1/pre-push"], [...args, "--deadline", "1"]]) await withheld(f, wrong);
    assert.equal(f.requests.length, 0);
});
test("F26b emitted main noncanonical malformed and oversized public pin data emits no output", options, async t => {
    const f = await fixture(t);
    for (const pin of ["", "=", f.pin + "=", "a".repeat(16385), Buffer.from("{}").toString("base64url")]) await withheld(f, ["--pre-push", "--pin", pin, "--replay"]);
    assert.equal(f.requests.length, 0);
});
test("F26b emitted main waits for actual stdin EOF before authorizing or emitting replay", options, async t => {
    const f = await fixture(t), pending = f.run(f.args(), TRANSCRIPT, true);
    await new Promise<void>(done => setTimeout(done, 120)); const before = pending.observed();
    assert.equal(before.outBytes, 0); assert.equal(before.errBytes, 0); assert.equal(f.requests.length, 0);
    pending.child.stdin.end(); const result = await pending.result; assert.equal(result.code, 0); assert(result.stdout.equals(Buffer.concat([TRANSCRIPT, Buffer.from(".")])));
});
test("F26b emitted shared main retains the legacy exact four-argument index grammar without pre-push fallback", options, async t => {
    const f = await fixture(t); await withheld(f, ["--pin", f.pin, "--index", ".git/index"]); assert.equal(f.requests.length, 0);
});
