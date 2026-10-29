/** PREPARED_NOT_EXECUTED F26a native owning-editor hook fixture.
 * Actual commands, real pinned Git and delegated real HTTP/child observers.
 * Synthetic marked D: profile only; scripted owner decisions are LOW independence.
 * The launcher must supply the actual closed-editor/offline-commit interphase
 * receipt. This fixture never substitutes scanner arguments for owner commits. */
import * as vscode from "vscode";
import { InstallDiagnostics07 } from "./install-diagnostics-07";
const diagnostics07 = new InstallDiagnostics07();
import assert from "node:assert/strict";
import { createHash, createPublicKey, verify } from "node:crypto";
import childProcess, { type ChildProcess, type SpawnOptions } from "node:child_process";
import fs from "node:fs";
import fsp from "node:fs/promises";
import http, { type IncomingMessage, type ServerResponse } from "node:http";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import type { Writable } from "node:stream";

const GIT = "C:\\Program Files\\Git\\cmd\\git.exe", VERSION = "git version 2.53.0.windows.1";
const PREFIX = "SOTERAI_LITE_F26A_HOOK_", FLAG = "lite.historyHooks.preCommit";
const MARKER = ".synthetic-lite-f26a-precommit-host", SOURCE = ".env.precommit-native";
const RENAMED = ".env.precommit-renamed";
const CUSTOM = ".synthetic hooks", ALT = ".git/f26a-alternate-index";
const PRIVATE = "sk-proj-" + "SYNTHETIC_F26A_NATIVE_PROVIDER_ONLY_VALUE".repeat(2);
const SECRET = "API_KEY=" + PRIVATE + "\nPORT=3000\n";
const ORIGINAL_ENV = "TEST_ONLY_F26A_ORIGINAL_ENV_37b912ab";
const RUNTIME_FILES = ["extension.js", "local-ai-broker.js", "soterai-mcp-server.js", "pre-commit-client.js"] as const;
const COMMANDS = ["installPreCommitGuard", "resumePreCommitGuard", "restorePreCommitGuard", "preCommitGuardStatus"] as const;
const ACTIONS = ["Review and install", "Resume reviewed owner", "Review and restore"] as const;
const CHILD_LIMIT = 90000, STREAM_LIMIT = 1048576 + 128 * 96 + 8192;
const nativeSpawn = childProcess.spawn, nativeRead = fsp.readFile, nativeReadSync = fs.readFileSync;
const nativeCreateServer = http.createServer;
const restorers: Array<() => void> = [], listeners: vscode.Disposable[] = [];
const children: ChildReceipt[] = [], pendingChildren: Array<Promise<Completion>> = [], wires: WireReceipt[] = [];
const reviews: Array<{ caseId: string; action: string; modal: boolean; approved: boolean }> = [];
const stores = { signing: 0, backupKey: 0, record: 0, unrelated: 0 };
let root = "", profile = "", parent = "", setupDirectory = "", caseId = "SETUP", setupStage = "initial";
let phase: "primary" | "restart", output = "", approve = true, halted = false, metadataLeak = false;
let sourceDocuments = 0, sourceDocumentEvents = 0, directWorktreeReads = 0, directObjectReads = 0, ownerServers = 0;
let contextRef: vscode.ExtensionContext, ownerEnvironment: NodeJS.ProcessEnv = {}, parentEnvironment = "";
let currentPin: Pin | undefined;
let codeSha256 = "";
const originalBodies = new Map<number, Buffer>();

type ChildKind = "setup" | "owner" | "projection" | "scan" | "client";
type ChildReceipt = { caseId: string; kind: ChildKind; operation: string; closed: boolean; code: number | null;
    signal: NodeJS.Signals | null; stdoutEOF: boolean; stderrEOF: boolean; stdoutBytes: number; stderrBytes: number;
    stdoutSha256: string; stderrSha256: string; signalsRequested: number; spawnFailed: boolean; streamError: boolean;
    overflow: boolean; timedOut: boolean; busy: boolean; argumentsValid: boolean; environmentValid: boolean;
    parentEnvironmentUnchanged: boolean; stdinObjects: number; invalidInput: boolean };
type Completion = { receipt: ChildReceipt; stdout: Buffer; stderr: Buffer };
type Observation = { id: string; scope: string; status: "NOT_RUN" | "PASS" | "FAIL"; errorName?: string };
type Fact = { present: boolean; bytes: number; sha256: string | null; mode: number | null };
type RuntimeFact = { file: string; bytes: number; sha256: string };
type PublicStatus = { status: "LIVE" | "OWNER_REVIEW_REQUIRED" | "UNAVAILABLE"; busy: boolean; scope: string };
type Pin = { version: number; root: string; generation: string; publicKey: string; worker: string; workerSha256: string;
    runtime: string; runtimeSha256: string; descriptor: string; systemRoot: string };
type Saved = { version: number; pin: string; projectionFingerprint: string; receipt: { generation: string; hooksRelative: string;
    backup: string; beforeDigest: string; afterDigest: string; originalPresent: boolean; originalMode?: number; mode: number }; state: string };
type WireReceipt = { caseId: string; requestEnded: boolean; requestClosed: boolean; responseFinished: boolean; responseClosed: boolean;
    requestValid: boolean; signatureValid: boolean; indexMatched: boolean; overflow: boolean; status?: string;
    generation?: string; session?: string; nonce?: string; indexSha256?: string; indexIdentity?: string; selected?: "default" | "alternate" | "other" };
type RestartState = { schemaVersion: 1; syntheticOnly: true; root: string; phase: "primary"; ready: true; oldFlag?: boolean;
    runtimeBindings: RuntimeFact[]; executionManifest: Fact; hook: Fact; customHook: Fact; index: Fact; source: Fact; config: Fact; head: string;
    generation: string; publicPinSha256: string; recordSha256: string; descriptor: Fact; session: string;
    backupFacts: Array<{ name: string; fact: Fact }>; ownerEnvironmentSha256: string;
    offlineArguments: string[]; offlineEnvironmentSha256: string; driverSha256: string };

const sha = (bytes: Uint8Array | string) => createHash("sha256").update(bytes).digest("hex");
const within = (base: string, file: string) => { const part = relative(resolve(base), resolve(file)); return part === "" || !part.startsWith("..") && !isAbsolute(part); };
const samePath = (a: string, b: string) => resolve(a).toLowerCase() === resolve(b).toLowerCase();
const selectedFile = (value?: string) => value === undefined ? join(root, ".git", "index") : resolve(root, value);
const recordKey = () => "soterai.preCommit.record.v1." + sha(root.toLowerCase());
const markerFile = () => join(root, ".git", "f26a-original-marker");
const stateFile = () => join(parent, "precommit-restart-state.json");
const absentFile = () => join(parent, "precommit-owner-absent.json");
const publicText = (label: string) => "PORT=3000\nMODE=development\n# public " + label + "\n";
function safeMetadata(value: unknown): void {
    const text = typeof value === "string" ? value : JSON.stringify(value) ?? "";
    if (text.includes(PRIVATE) || text.includes(SECRET) || text.includes(ORIGINAL_ENV)) { metadataLeak = true; throw Error("Synthetic private content entered public metadata."); }
}
function patch(target: object, name: string, value: unknown): void {
    const previous = Object.getOwnPropertyDescriptor(target, name);
    Object.defineProperty(target, name, { configurable: true, writable: true, value });
    restorers.push(() => previous ? Object.defineProperty(target, name, previous) : Reflect.deleteProperty(target, name));
}
async function until(predicate: () => boolean | Promise<boolean>, label: string, ms = 10000): Promise<void> {
    const end = performance.now() + ms;
    while (performance.now() < end) { if (await predicate()) return; await new Promise<void>(done => setTimeout(done, 20)); }
    throw Error(label);
}
function ordinary(file: string): void {
    assert(within(parent, file) || within(profile, file), "Fixture filesystem access escaped its retained synthetic container.");
    assert(!fs.lstatSync(file).isSymbolicLink()); assert(samePath(fs.realpathSync(file), file));
}
async function fact(file: string): Promise<Fact> {
    try { ordinary(file); const stat = await fsp.lstat(file); assert(stat.isFile() && stat.nlink === 1 && stat.size <= 536870912);
        const bytes = await nativeRead(file); return { present: true, bytes: bytes.length, sha256: sha(bytes), mode: stat.mode & 0o777 }; }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return { present: false, bytes: 0, sha256: null, mode: null }; throw error; }
}
function hashCode(): string {
    const digest = createHash("sha256"), chunk = Buffer.alloc(65536), fd = fs.openSync(process.execPath, "r");
    try { let offset = 0; for (;;) { const count = fs.readSync(fd, chunk, 0, chunk.length, offset); if (count === 0) break;
        offset += count; assert(offset <= 536870912); digest.update(chunk.subarray(0, count)); }
        return digest.digest("hex"); }
    finally { fs.closeSync(fd); chunk.fill(0); }
}
function closed(row: ChildReceipt): void {
    assert(row.closed && row.stdoutEOF && row.stderrEOF && !row.busy && !row.spawnFailed && !row.streamError && !row.overflow && !row.timedOut);
    assert.equal(row.signal, null); assert.equal(row.signalsRequested, 0);
    assert(row.argumentsValid && row.environmentValid && row.parentEnvironmentUnchanged && !row.invalidInput);
}
function success(row: ChildReceipt): void { closed(row); assert.equal(row.code, 0); }
function observe(child: ChildProcess, kind: ChildKind, operation: string, argumentsValid = true, environmentValid = true): Promise<Completion> {
    const row: ChildReceipt = { caseId, kind, operation, closed: false, code: null, signal: null, stdoutEOF: false, stderrEOF: false,
        stdoutBytes: 0, stderrBytes: 0, stdoutSha256: "", stderrSha256: "", signalsRequested: 0, spawnFailed: false,
        streamError: false, overflow: false, timedOut: false, busy: true, argumentsValid, environmentValid,
        parentEnvironmentUnchanged: false, stdinObjects: 0, invalidInput: false };
    children.push(row);
    let finish!: (value: Completion) => void, completed = false;
    const actual = new Promise<Completion>(done => finish = done); pendingChildren.push(actual);
    const out: Buffer[] = [], err: Buffer[] = [], outHash = createHash("sha256"), errHash = createHash("sha256");
    const timer = setTimeout(() => { row.timedOut = true; halted = true; }, CHILD_LIMIT);
    child.kill = (() => { row.signalsRequested++; halted = true; throw Error("Native pre-commit fixture forbids signals."); }) as typeof child.kill;
    if (kind === "scan" && child.stdin) {
        const end = child.stdin.end;
        child.stdin.end = function (this: Writable, ...values: any[]) {
            const input = typeof values[0] === "string" || Buffer.isBuffer(values[0]) ? Buffer.from(values[0]).toString("ascii") : "";
            if (!["sizes", "batch"].includes(operation) || !/^(?:[a-f0-9]{40}\n){1,128}$/.test(input)) row.invalidInput = true;
            else row.stdinObjects = input.trimEnd().split("\n").length;
            return Reflect.apply(end, this, values);
        } as Writable["end"];
    }
    const joinClose = () => {
        if (completed || !row.closed || !row.stdoutEOF || !row.stderrEOF) return;
        completed = true; clearTimeout(timer); row.busy = false;
        row.stdoutSha256 = outHash.digest("hex"); row.stderrSha256 = errHash.digest("hex");
        row.parentEnvironmentUnchanged = JSON.stringify(process.env) === parentEnvironment;
        finish({ receipt: row, stdout: Buffer.concat(out), stderr: Buffer.concat(err) });
    };
    child.once("error", () => { row.spawnFailed = child.pid === undefined; row.streamError = child.pid !== undefined; halted = true; });
    child.once("close", (code, signal) => { row.closed = true; row.code = code; row.signal = signal; joinClose(); });
    for (const channel of ["stdout", "stderr"] as const) {
        const stream = child[channel];
        if (!stream) { row.streamError = true; halted = true; continue; }
        stream.on("data", (bytes: Buffer) => {
            if (channel === "stdout") { row.stdoutBytes += bytes.length; outHash.update(bytes); }
            else { row.stderrBytes += bytes.length; errHash.update(bytes); }
            if (row.stdoutBytes + row.stderrBytes > STREAM_LIMIT) { row.overflow = true; halted = true; }
            // Raw staged bodies remain solely in the real production consumer.
            if (kind !== "scan" && !row.overflow) (channel === "stdout" ? out : err).push(Buffer.from(bytes));
        });
        stream.once("end", () => { if (channel === "stdout") row.stdoutEOF = true; else row.stderrEOF = true; joinClose(); });
        stream.once("error", () => { row.streamError = true; halted = true; });
    }
    // Timeout publishes STOP_UNCONFIRMED but never signals, destroys pipes or
    // resolves actual closure. No later launch/check can advance after timeout.
    return Promise.race([actual, new Promise<never>((_done, reject) => {
        const watch = setInterval(() => { if (completed) clearInterval(watch); else if (row.timedOut) { clearInterval(watch); reject(Error("STOP_UNCONFIRMED")); } }, 25);
    })]);
}
function minimalEnvironment(): NodeJS.ProcessEnv {
    const env: NodeJS.ProcessEnv = {};
    for (const key of ["HOME", "USERPROFILE", "XDG_CONFIG_HOME", "GIT_CONFIG_GLOBAL", "GIT_CONFIG_SYSTEM", "GIT_CONFIG_NOSYSTEM", "SystemRoot", "WINDIR", "COMSPEC"])
        if (process.env[key] !== undefined) env[key] = process.env[key];
    return { ...env, GIT_TERMINAL_PROMPT: "0", GCM_INTERACTIVE: "never", GIT_OPTIONAL_LOCKS: "0", GIT_PAGER: "", PAGER: "",
        GIT_NO_LAZY_FETCH: "1", GIT_NO_REPLACE_OBJECTS: "1", GIT_PROTOCOL_FROM_USER: "0", LC_ALL: "C", LANG: "C" };
}
function ownerEnv(index?: string): NodeJS.ProcessEnv {
    return { ...ownerEnvironment, SOTERAI_F26A_ORIGINAL_ENV: ORIGINAL_ENV, ...(index === undefined ? {} : { GIT_INDEX_FILE: selectedFile(index) }) };
}
function assertDiscovery(env: NodeJS.ProcessEnv | undefined): void {
    assert(env);
    for (const key of ["HOME", "USERPROFILE", "XDG_CONFIG_HOME", "GIT_CONFIG_GLOBAL", "GIT_CONFIG_SYSTEM", "GIT_CONFIG_NOSYSTEM"])
        assert.equal(env[key], ownerEnvironment[key]);
    for (const key of ["PATH", "NODE_OPTIONS", "NODE_PATH", "GIT_CONFIG_COUNT", "GIT_CONFIG_PARAMETERS", "GIT_CONFIG", "GIT_DIR", "GIT_WORK_TREE"])
        assert.equal(env[key], undefined);
}
async function setupGit(operation: string, args: string[], index?: string): Promise<string> {
    assert(!halted, "STOP_UNCONFIRMED forbids advancing fixture setup.");
    const prefix = ["--no-pager", "--literal-pathspecs", "--no-lazy-fetch", "--no-replace-objects", "--no-optional-locks",
        "-c", "core.hooksPath=" + join(setupDirectory, "empty-hooks"), "-c", "core.fsmonitor=false", "-c", "credential.helper=", "-c", "protocol.allow=never"];
    const env = { ...ownerEnvironment, ...(index === undefined ? {} : { GIT_INDEX_FILE: selectedFile(index) }) };
    const value = await observe(nativeSpawn(GIT, [...prefix, ...args], { cwd: root, env, shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] }), "setup", operation);
    success(value.receipt); assert(!halted); return value.stdout.toString("utf8");
}
function ownerArguments(label: string): string[] { assert(/^[A-Za-z0-9 -]{1,90}$/.test(label)); return ["--no-pager", "commit", "--quiet", "-m", "F26a synthetic " + label]; }
async function ownerCommit(label: string, expected: "allow" | "block", scan: "ALLOW" | "BLOCK" | "none", index?: string): Promise<void> {
    assert(!halted); const args = ownerArguments(label), env = ownerEnv(index);
    assert(!args.some(arg => /core[.]hooksPath|no-verify|^-c$/i.test(arg))); assertDiscovery(env);
    const beforeHead = head(), beforeSource = await fact(join(root, SOURCE));
    const beforeIndex = await fact(selectedFile(index));
    const beforeDefault = await fact(selectedFile());
    const listing = await setupGit("before-owner-listing", ["ls-files", "--stage", "-z"], index);
    const firstWire = wires.length, firstChild = children.length;
    const value = await observe(nativeSpawn(GIT, args, { cwd: root, env, shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] }), "owner", label);
    closed(value.receipt); assert(!halted);
    const afterHead = head(), afterSource = await fact(join(root, SOURCE)), afterIndex = await fact(selectedFile(index));
    assert.deepEqual(afterSource, beforeSource, "Owner hook must never rewrite the worktree source.");
    if (expected === "allow") { assert.equal(value.receipt.code, 0); assert.notEqual(afterHead, beforeHead); }
    else { assert.notEqual(value.receipt.code, 0); assert.equal(afterHead, beforeHead); }
    const afterListing = await setupGit("after-owner-listing", ["ls-files", "--stage", "-z"], index);
    assert.equal(afterListing, listing, "Hook must not rewrite staged paths/object ids; Git may refresh its own index stat cache.");
    if (index !== undefined) assert.deepEqual(await fact(selectedFile()), beforeDefault, "Alternate-index owner must leave the default index byte exact.");
    const observed = wires.slice(firstWire);
    if (scan === "none") assert.equal(observed.length, 0);
    else {
        assert.equal(observed.length, 1); const wire = observed[0];
        await until(() => wire.requestClosed && wire.responseFinished && wire.responseClosed, "Actual hook HTTP exchange did not close.");
        assert(wire.requestEnded && wire.requestClosed && wire.responseFinished && wire.responseClosed && wire.requestValid && wire.signatureValid && wire.indexMatched && !wire.overflow);
        assert.equal(wire.status, scan); assert.equal(wire.selected, index === undefined ? "default" : "alternate");
        const scans = children.slice(firstChild).filter(row => row.kind === "scan");
        for (const operation of ["version", "entries", ...(listing.length ? ["sizes", "batch"] : [])]) assert(scans.some(row => row.operation === operation), "Commit needs the actual complete staged-tree child witnesses.");
        if (!listing.length) assert(!scans.some(row => row.operation === "sizes" || row.operation === "batch"), "An empty staged tree must not read deleted objects.");
        scans.forEach(success);
    }
    commitProofs.push({ caseId, expected, observedExitCode: value.receipt.code, headAdvanced: afterHead !== beforeHead,
        selectedIndexBefore: beforeIndex, selectedIndexAfter: afterIndex, worktreeUnchanged: true,
        stagedListingUnchanged: true, defaultIndexUnchanged: index === undefined ? undefined : true, scan,
        ownerArgumentsHaveNoHooksOverride: true, requestCount: observed.length });
}
const commitProofs: Array<Record<string, unknown>> = [];
function head(): string {
    const value = nativeReadSync(join(root, ".git", "HEAD"), "utf8").trim();
    assert.equal(value, "ref: refs/heads/main");
    try { const oid = nativeReadSync(join(root, ".git", "refs", "heads", "main"), "utf8").trim(); assert.match(oid, /^[a-f0-9]{40}$/); return oid; }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return "UNBORN"; throw error; }
}
async function stage(text: string, index?: string): Promise<void> {
    assert(!halted); await fsp.writeFile(join(root, SOURCE), text);
    await setupGit("stage-owned-source", ["add", "--force", "--", SOURCE], index);
}
function original(exit: 0 | 7): Buffer {
    const value = Buffer.from("#!/bin/sh\n# TEST_ONLY_F26A_ORIGINAL_BODY_" + exit + "\nprintf '%s\\n' \"$#\" \"$SOTERAI_F26A_ORIGINAL_ENV\" \"${GIT_INDEX_FILE-unset}\" >> '.git/f26a-original-marker'\nexit " + exit + "\n");
    originalBodies.set(exit, value); return value;
}
async function markerCount(): Promise<number> {
    try { const lines = (await nativeRead(markerFile(), "utf8")).trimEnd().split("\n"); assert.equal(lines.length % 3, 0);
        for (let i = 0; i < lines.length; i += 3) { assert.equal(lines[i], "0"); assert.equal(lines[i + 1], ORIGINAL_ENV);
            assert(samePath(resolve(root, lines[i + 2]), selectedFile()), "Original hook must retain Git's default index environment."); }
        return lines.length / 3; }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return 0; throw error; }
}
async function runtimeFacts(): Promise<RuntimeFact[]> {
    const result: RuntimeFact[] = [];
    for (const file of RUNTIME_FILES) { const bytes = await nativeRead(join(contextRef.extensionUri.fsPath, "dist", file)); result.push({ file, bytes: bytes.length, sha256: sha(bytes) }); }
    assert.equal(result[0].sha256, process.env[PREFIX + "BUNDLE_SHA256"]);
    assert.equal(result[3].sha256, process.env[PREFIX + "WORKER_SHA256"]); return result;
}
async function backupFacts(): Promise<Array<{ name: string; fact: Fact }>> {
    const directory = join(contextRef.globalStorageUri.fsPath, "config-backups");
    try { const names = (await fsp.readdir(directory)).sort(); assert(names.length <= 32);
        const result: Array<{ name: string; fact: Fact }> = [];
        for (const name of names) { assert.match(name, /^[a-f0-9]{32}[.]enc$/); const bytes = await nativeRead(join(directory, name));
            for (const forbidden of [PRIVATE, SECRET, ...[...originalBodies.values()].map(body => body.toString()), ...[...originalBodies.values()].map(body => body.toString("base64"))])
                assert(!bytes.includes(Buffer.from(forbidden)), "Recovery must not retain a plaintext original in its encrypted file.");
            result.push({ name, fact: await fact(join(directory, name)) }); }
        return result; }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return []; throw error; }
}
function envelope(raw: Buffer, domain: string): any {
    assert(currentPin); assert(raw.length <= 8192);
    const text = raw.toString("utf8"), value = JSON.parse(text); assert.equal(JSON.stringify(value), text);
    assert.deepEqual(Object.keys(value).sort(), ["domain", "payload", "signature"]); assert.equal(value.domain, domain);
    assert.match(value.signature, /^[A-Za-z0-9_-]{86}$/);
    const signature = Buffer.from(value.signature, "base64url"); assert.equal(signature.toString("base64url"), value.signature);
    assert(verify(null, Buffer.from(domain + "\0" + JSON.stringify(value.payload)), createPublicKey({ key: Buffer.from(currentPin.publicKey, "base64"), format: "der", type: "spki" }), signature));
    assert.equal(value.payload.root, root); assert.equal(value.payload.generation, currentPin.generation); return value.payload;
}
async function saved(): Promise<{ raw: string; value: Saved; pin: Pin; descriptor: any }> {
    const raw = await contextRef.secrets.get(recordKey()); assert(raw); const value = JSON.parse(raw) as Saved;
    assert.equal(value.version, 1); assert.match(value.receipt.generation, /^[a-f0-9-]{36}$/);
    const pinBytes = Buffer.from(value.pin, "base64"); assert.equal(pinBytes.toString("base64"), value.pin);
    const pin = JSON.parse(pinBytes.toString("utf8")) as Pin; assert.equal(pin.root, root); assert.equal(pin.generation, value.receipt.generation);
    assert.equal(pin.worker, join(contextRef.extensionUri.fsPath, "dist", "pre-commit-client.js")); assert.equal(pin.runtime, process.execPath);
    assert.equal(pin.workerSha256, process.env[PREFIX + "WORKER_SHA256"]); assert(within(contextRef.globalStorageUri.fsPath, pin.descriptor));
    currentPin = pin;
    const descriptor = envelope(await nativeRead(pin.descriptor), "SoterAI-PreCommit-Descriptor-v1");
    assert.equal(descriptor.workerSha256, pin.workerSha256); assert.equal(pin.runtimeSha256, codeSha256); assert.equal(descriptor.runtimeSha256, codeSha256);
    const url = new URL(descriptor.endpoint); assert.equal(url.hostname, "127.0.0.1"); assert.equal(url.pathname, "/pre-commit");
    assert(!url.username && !url.password && !url.search && !url.hash && Number(url.port) > 0); return { raw, value, pin, descriptor };
}
async function call(name: typeof COMMANDS[number]): Promise<any> {
    assert(!halted); diagnostics07.record("command-start", { command: name }); const value = await vscode.commands.executeCommand("soterai." + name); diagnostics07.record("command-return", { command: name, status: value?.status }); safeMetadata(value); assert(value); return value;
}
async function idle(): Promise<void> { await until(async () => !(await call("preCommitGuardStatus") as PublicStatus).busy, "Owner remained busy."); }
async function status(expected: PublicStatus["status"]): Promise<void> { const value = await call("preCommitGuardStatus") as PublicStatus; assert.equal(value.status, expected); assert.equal(value.busy, false); }
async function install(hooks: string): Promise<void> {
    const beforeReview = reviews.length; assert.equal((await call("installPreCommitGuard")).status, "APPLIED");
    assert.equal(reviews.length, beforeReview + 1); assert.equal(reviews.at(-1)?.action, ACTIONS[0]); await status("LIVE");
    const record = await saved(); assert.equal(record.value.state, "APPLIED"); assert.equal(record.value.receipt.hooksRelative, hooks);
    const hook = await nativeRead(join(root, hooks, "pre-commit"), "utf8");
    assert(hook.startsWith("#!/bin/sh\n# SoterAI Lite pre-commit v1 " + record.pin.generation + "\n"));
    assert(hook.includes("'C:/Program Files/Git/usr/bin/env.exe' -i ") && hook.includes('"${GIT_INDEX_FILE-.git/index}"'));
    assert(hook.includes(Buffer.from(record.value.pin, "base64").toString("base64url")));
    assert((await backupFacts()).some(row => row.name === record.value.receipt.backup + ".enc"));
    const names = await fsp.readdir(join(root, hooks)); assert.deepEqual(names, ["pre-commit"], "No plaintext sibling backup or leftover generated stage may remain.");
}
async function directClient(index: string, expected: 0 | 1, scan: boolean): Promise<void> {
    assert(currentPin && !halted); const raw = Buffer.from(JSON.stringify(currentPin));
    const firstWire = wires.length, beforeHead = head(), beforeSource = await fact(join(root, SOURCE));
    const env: NodeJS.ProcessEnv = { SystemRoot: currentPin.systemRoot, WINDIR: currentPin.systemRoot, ELECTRON_RUN_AS_NODE: "1" };
    assert.equal(env.NODE_OPTIONS, undefined); assert.equal(env.NODE_PATH, undefined); assert.equal(env.PATH, undefined);
    const result = await observe(nativeSpawn(process.execPath, [currentPin.worker, "--pin", raw.toString("base64url"), "--index", index], {
        cwd: root, env, shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] }), "client", expected === 0 ? "actual-worker-positive" : "actual-worker-invalid-index");
    closed(result.receipt); assert.equal(result.receipt.code, expected); assert.equal(head(), beforeHead); assert.deepEqual(await fact(join(root, SOURCE)), beforeSource);
    assert.equal(wires.length - firstWire, scan ? 1 : 0);
    if (scan) { const row = wires.at(-1)!; await until(() => row.requestClosed && row.responseFinished && row.responseClosed, "Direct client HTTP exchange did not close.");
        assert.equal(row.status, "ALLOW"); assert(row.requestValid && row.signatureValid && row.indexMatched); }
}
function observeRequest(req: IncomingMessage, res: ServerResponse): void {
    if (req.method !== "POST" || req.url !== "/pre-commit") return;
    const row: WireReceipt = { caseId, requestEnded: false, requestClosed: false, responseFinished: false, responseClosed: false,
        requestValid: false, signatureValid: false, indexMatched: false, overflow: false };
    wires.push(row); const chunks: Buffer[] = []; let bytes = 0, request: any;
    req.on("data", (chunk: Buffer) => { bytes += chunk.length; if (bytes > 4096) row.overflow = true; else chunks.push(Buffer.from(chunk)); });
    req.once("end", () => {
        row.requestEnded = true;
        try {
            const body = Buffer.concat(chunks).toString("utf8"); request = JSON.parse(body); safeMetadata(body);
            assert.equal(JSON.stringify(request), body); assert.deepEqual(Object.keys(request).sort(), ["generation", "indexFile", "nonce", "session", "version"]);
            assert.equal(req.socket.remoteAddress, "127.0.0.1"); assert.match(req.headers.host ?? "", /^127[.]0[.]0[.]1:[0-9]+$/);
            assert.equal(req.headers.origin, undefined); assert.equal(request.version, 1); assert.equal(request.generation, currentPin?.generation);
            assert.match(request.session, /^[a-f0-9-]{36}$/); assert.match(request.nonce, /^[a-f0-9-]{36}$/);
            const file = selectedFile(request.indexFile); assert(within(join(root, ".git"), file)); ordinary(file);
            const index = nativeReadSync(file); assert(index.length <= 4 * 1024 * 1024);
            row.indexSha256 = sha(index); row.generation = request.generation; row.session = request.session; row.nonce = request.nonce;
            row.selected = samePath(file, selectedFile()) ? "default" : samePath(file, selectedFile(ALT)) ? "alternate" : "other";
            row.requestValid = true;
        } catch { row.requestValid = false; }
        chunks.forEach(chunk => chunk.fill(0));
    });
    req.once("close", () => { row.requestClosed = true; });
    const end = res.end;
    res.end = function (this: ServerResponse, ...values: any[]) {
        try {
            const value = values[0];
            if (Buffer.isBuffer(value) || typeof value === "string") {
                const decision = envelope(Buffer.from(value), "SoterAI-PreCommit-Decision-v1"); safeMetadata(decision);
                assert(request && row.requestValid); assert.equal(decision.session, request.session); assert.equal(decision.nonce, request.nonce);
                assert.deepEqual(Object.keys(decision).sort(), ["generation", "indexIdentity", "indexSha256", "nonce", "root", "session", "status", "version"]);
                assert.match(decision.indexIdentity, /^[a-f0-9]{64}$/); assert(["ALLOW", "BLOCK", "UNAVAILABLE", "BUSY"].includes(decision.status));
                row.signatureValid = true; row.indexMatched = decision.indexSha256 === row.indexSha256;
                row.indexIdentity = decision.indexIdentity; row.status = decision.status;
            }
        } catch { row.signatureValid = false; }
        return Reflect.apply(end, this, values);
    } as ServerResponse["end"];
    res.once("finish", () => { row.responseFinished = true; }); res.once("close", () => { row.responseClosed = true; });
}
function productOperation(args: readonly string[], options: SpawnOptions): { kind: "projection" | "scan"; operation: string } {
    const config = ["--no-pager", "--no-optional-locks", "-c", "protocol.allow=never", "-c", "credential.helper=", "-c", "credential.interactive=false",
        "config", "--null", "--show-origin", "--show-scope", "--no-includes", "--get-regexp", "^(core[.]hookspath|include[.]path|includeif[.].*[.]path|extensions[.]worktreeconfig)$"];
    if (args.length === 1 && args[0] === "--version") { assertDiscovery(options.env); return { kind: "projection", operation: "version" }; }
    if (args[0] === "--no-pager" && args.includes("--show-origin")) { assert.deepEqual(args, config); assert.equal(options.cwd, root); assertDiscovery(options.env); return { kind: "projection", operation: "config" }; }
    const job = options.env?.HOME; assert(job && within(profile, job));
    const prefix = ["--no-pager", "--literal-pathspecs", "-c", "core.hooksPath=" + join(job, "empty-hooks"), "-c", "core.fsmonitor=false", "-c", "credential.helper=", "-c", "commit.gpgSign=false",
        "--no-lazy-fetch", "--no-replace-objects", "--no-optional-locks", "-c", "protocol.allow=never", "-c", "core.pager=", "-c", "color.ui=false", "-c", "core.attributesFile=" + join(job, "empty.gitconfig"), "-c", "gc.auto=0", "-c", "maintenance.auto=false"];
    assert.deepEqual(args.slice(0, prefix.length), prefix); const suffix = args.slice(prefix.length);
    assert(options.env?.GIT_INDEX_FILE && within(join(root, ".git"), options.env.GIT_INDEX_FILE));
    for (const key of ["PATH", "NODE_OPTIONS", "NODE_PATH", "GIT_CONFIG_COUNT", "GIT_CONFIG_PARAMETERS"]) assert.equal(options.env?.[key], undefined);
    if (suffix.length === 1 && suffix[0] === "--version") { assert.equal(options.cwd, job); return { kind: "scan", operation: "version" }; }
    assert.equal(options.cwd, root);
    if (suffix[0] === "ls-files") { assert.deepEqual(suffix, ["ls-files", "--stage", "-z"]); return { kind: "scan", operation: "entries" }; }
    if (suffix[1] === "--batch-check=%(objectname) %(objecttype) %(objectsize)") { assert.deepEqual(suffix, ["cat-file", "--batch-check=%(objectname) %(objecttype) %(objectsize)"]); return { kind: "scan", operation: "sizes" }; }
    assert.deepEqual(suffix, ["cat-file", "--batch"]); return { kind: "scan", operation: "batch" };
}
export function setupDiagnostic(): Record<string, unknown> {
    return { preparedNotExecutedAuthoring: true, syntheticOnly: true, stage: setupStage, phase, caseId, halted,
        busyChildren: children.filter(row => row.busy).length, timedOutChildren: children.filter(row => row.timedOut).length,
        sourceDocuments, sourceDocumentEvents, directWorktreeReads, directObjectReads, ownerServers };
}
export async function beforeActivate(context: vscode.ExtensionContext): Promise<void> {
    contextRef = context; assert.equal(process.platform, "win32"); assert.equal(vscode.workspace.workspaceFolders?.length, 1);
    assert(vscode.workspace.isTrusted && !vscode.env.remoteName);
    root = vscode.workspace.workspaceFolders![0].uri.fsPath; parent = dirname(root);
    profile = process.env[PREFIX + "PROFILE"] ?? ""; output = process.env[PREFIX + "EVIDENCE"] ?? "";
    const selectedPhase = process.env[PREFIX + "PHASE"]; assert(selectedPhase === "primary" || selectedPhase === "restart"); phase = selectedPhase;
    assert.equal(process.env[PREFIX + "DRIVER_KIND"], "native-bootstrap");
    assert.match(resolve(root), /^D:\\SoterAI-Lite-test-profiles\\/i); assert.match(resolve(profile), /^D:\\SoterAI-Lite-test-profiles\\/i);
    assert(within(parent, profile) && within(parent, output) && !within(root, output) && !within(root, context.globalStorageUri.fsPath));
    ordinary(root); ordinary(profile); ordinary(parent);
    assert.equal((await nativeRead(join(root, MARKER), "utf8")).trim(), "synthetic-only-v1");
    for (const key of ["HOME", "USERPROFILE", "XDG_CONFIG_HOME"]) assert.equal(process.env[key], profile);
    for (const key of ["GIT_CONFIG_GLOBAL", "GIT_CONFIG_SYSTEM"]) { const file = process.env[key]; assert(file && within(profile, file)); assert.equal((await nativeRead(file)).length, 0); }
    assert.equal(process.env.GIT_CONFIG_NOSYSTEM, "1");
    for (const key of Object.keys(process.env)) if (/^GIT_/i.test(key)) assert(["GIT_CONFIG_GLOBAL", "GIT_CONFIG_SYSTEM", "GIT_CONFIG_NOSYSTEM"].includes(key.toUpperCase()), "Code ambient Git selectors must match the supported synthetic owner-discovery context.");
    assert(process.env.TEMP && within(profile, process.env.TEMP)); assert(process.env.TMP && within(profile, process.env.TMP));
    ownerEnvironment = minimalEnvironment(); parentEnvironment = JSON.stringify(process.env); codeSha256 = hashCode();
    setupDirectory = join(profile, "f26a-hook-fixture");
    if (phase === "primary") {
        setupStage = "synthetic-repository-preparation";
        await assert.rejects(fsp.lstat(join(root, ".git")), { code: "ENOENT" });
        await fsp.mkdir(setupDirectory); await fsp.mkdir(join(setupDirectory, "empty-hooks"));
        assert.equal((await setupGit("version", ["--version"])).trim(), VERSION);
        await setupGit("init", ["init", "--quiet", "--initial-branch=main", "--object-format=sha1", "--template=" + join(setupDirectory, "empty-hooks")]);
        for (const [key, value] of [["user.name", "F26a Synthetic Owner"], ["user.email", "synthetic-f26a@example.invalid"], ["core.autocrlf", "false"]])
            await setupGit("local-owner-config", ["config", "--local", key, value]);
    } else { ordinary(setupDirectory); ordinary(join(root, ".git")); }
    setupStage = "delegated-real-observers";
    diagnostics07.record("storage-uri", {fileScheme:context.globalStorageUri.scheme === "file", authority:!!context.globalStorageUri.authority, query:!!context.globalStorageUri.query, fragment:!!context.globalStorageUri.fragment, withinWorkspace:within(root,context.globalStorageUri.fsPath)});
    for (const operation of ["mkdirSync", "lstatSync", "openSync"] as const) {
        const delegate = fs[operation] as (...args: any[]) => unknown;
        patch(fs, operation, function (this: unknown, ...args: any[]) {
            let target: "storage" | "storage-parent" | undefined;
            try { if (typeof args[0] === "string") { if (within(context.globalStorageUri.fsPath,args[0])) target="storage"; else if(samePath(dirname(context.globalStorageUri.fsPath),args[0])) target="storage-parent"; } } catch {}
            try { const value=Reflect.apply(delegate,this,args); if(target)diagnostics07.record("filesystem",{operation,outcome:"RETURNED",target}); return value; }
            catch(error) { if(target)diagnostics07.record("filesystem",{operation,outcome:"THREW",target,code:(error as NodeJS.ErrnoException).code}); throw error; }
        });
    }
    listeners.push(vscode.workspace.onDidChangeConfiguration(event=>{if(event.affectsConfiguration("soterai"))diagnostics07.record("configuration-event");}));
    listeners.push(vscode.workspace.onDidChangeWorkspaceFolders(()=>diagnostics07.record("workspace-event")));
    patch(childProcess, "spawn", (...values: unknown[]) => {
        assert(!halted); const executable = values[0], args = values[1] as readonly string[], options = values[2] as SpawnOptions;
        assert.equal(executable, GIT); assert(Array.isArray(args)); assert.equal(options.shell, false); assert.equal(options.windowsHide, true);
        assert.equal(options.timeout, undefined); assert.equal(options.signal, undefined); assert.equal(options.killSignal, undefined);
        const selected = productOperation(args, options); const child = Reflect.apply(nativeSpawn, childProcess, values) as ChildProcess;
        // Observe and delegate real bytes/streams; never return a fake worker.
        void observe(child, selected.kind, selected.operation).catch(() => { halted = true; }); return child;
    });
    patch(http, "createServer", (...values: unknown[]) => {
        const listener = values.at(-1); if (typeof listener !== "function") return Reflect.apply(nativeCreateServer, http, values);
        const args = values.slice(); args[args.length - 1] = function (this: unknown, req: IncomingMessage, res: ServerResponse) { observeRequest(req, res); return Reflect.apply(listener, this, [req, res]); };
        const options = values[0] as { maxHeaderSize?: number }; if (options?.maxHeaderSize === 4096) ownerServers++;
        const server = Reflect.apply(nativeCreateServer, http, args);
        if(options?.maxHeaderSize === 4096) {
            diagnostics07.record("listener-created");
            server.once("listening",()=>{const address=server.address();diagnostics07.record("listener-listening",{loopback:!!address&&typeof address!=="string"&&address.address==="127.0.0.1"});});
            server.once("close",()=>diagnostics07.record("listener-close"));
            server.once("error",error=>diagnostics07.record("listener-error",{code:(error as NodeJS.ErrnoException).code}));
        }
        return server;
    });
    const store = context.secrets.store;
    patch(context.secrets, "store", async (key: string, value: string) => {
        if (key.startsWith("soterai.preCommit.signing.v1.")) stores.signing++;
        else if (key.startsWith("soterai.configBackupKey.v1.")) stores.backupKey++;
        else if (key.startsWith("soterai.preCommit.record.v1.")) { stores.record++; safeMetadata(value); }
        else stores.unrelated++;
        return store.call(context.secrets, key, value);
    });
    const originalFile = (value: unknown): string | undefined => typeof value === "string" ? value : value instanceof vscode.Uri && value.scheme === "file" ? value.fsPath : undefined;
    const readObserved = (value: unknown) => { const file = originalFile(value); if (!file) return;
        if ([SOURCE, RENAMED].some(name => samePath(file, join(root, name)))) directWorktreeReads++;
        if (within(join(root, ".git", "objects"), file)) directObjectReads++; };
    patch(fs, "readFileSync", (...values: unknown[]) => { readObserved(values[0]); return Reflect.apply(nativeReadSync, fs, values); });
    patch(fsp, "readFile", (...values: unknown[]) => { readObserved(values[0]); return Reflect.apply(nativeRead, fsp, values); });
    const open = vscode.workspace.openTextDocument;
    patch(vscode.workspace, "openTextDocument", async (...values: unknown[]) => {
        const file = originalFile(values[0]); if (file && within(root, file)) sourceDocuments++;
        const content = (values[0] as { content?: string })?.content; if (typeof content === "string") safeMetadata(content);
        return Reflect.apply(open, vscode.workspace, values);
    });
    listeners.push(vscode.workspace.onDidOpenTextDocument(document => { if (document.uri.scheme === "file" && within(root, document.uri.fsPath)) sourceDocumentEvents++; }));
    patch(vscode.window, "showWarningMessage", async (message: string, options: vscode.MessageOptions, ...items: string[]) => {
        safeMetadata([message, options, items]); const action = items.find(item => (ACTIONS as readonly string[]).includes(item));
        if (!action) return undefined; assert.equal(options.modal, true);
        reviews.push({ caseId, action, modal: true, approved: approve }); return approve ? action : undefined;
    });
    for (const name of ["showInformationMessage", "showErrorMessage"]) patch(vscode.window, name, async (...values: unknown[]) => { safeMetadata(values); return undefined; });
    setupStage = "instrumented-before-real-extension-activation";
}

export async function run(context: vscode.ExtensionContext): Promise<void> {
    assert.equal(context, contextRef); const configuration = vscode.workspace.getConfiguration("soterai");
    const initialFlag = configuration.inspect<boolean>(FLAG)?.globalValue;
    const runtimes = await runtimeFacts(), executionManifest = await fact(join(context.extensionUri.fsPath, "package.json"));
    let driverFailure: string | undefined, restartState: RestartState | undefined;
    const observations: Observation[] = [], checks: Array<{ scope: string; work(): Promise<void> }> = [];
    const add = (scope: string, work: () => Promise<void>) => checks.push({ scope, work });
    const hook = (hooks = ".git/hooks") => join(root, hooks, "pre-commit");
    let beforeCustom: Fact | undefined, customBody: Buffer | undefined, prior: RestartState | undefined;
    const privateClean = () => { assert.equal(sourceDocuments, 0); assert.equal(sourceDocumentEvents, 0); assert.equal(directWorktreeReads, 0); assert.equal(directObjectReads, 0); assert(!metadataLeak); assert.equal(JSON.stringify(process.env), parentEnvironment); };
    const noEffects = () => ({ stores: { ...stores }, servers: ownerServers, wires: wires.length });
    const setFlag = async (value: boolean | undefined) => { await configuration.update(FLAG, value, vscode.ConfigurationTarget.Global); await idle(); };
    if (phase === "primary") {
        add("Fresh marked profile exposes the four exact runtimes, commands and default-false restricted machine setting", async () => {
            assert.equal(configuration.inspect<boolean>(FLAG)?.defaultValue, false); assert(initialFlag === undefined || initialFlag === false);
            const commands = await vscode.commands.getCommands(true); for (const name of COMMANDS) assert(commands.includes("soterai." + name));
            const manifest = JSON.parse(await nativeRead(join(context.extensionUri.fsPath, "package.json"), "utf8"));
            for (const name of COMMANDS) assert(manifest.contributes.commands.some((item: { command: string }) => item.command === "soterai." + name));
            const property = manifest.contributes.configuration.properties["soterai." + FLAG]; assert.equal(property.scope, "machine"); assert.equal(property.default, false);
            assert(manifest.capabilities.untrustedWorkspaces.restrictedConfigurations.includes("soterai." + FLAG));
            assert.equal((await fact(hook())).present, false); assert.equal(head(), "UNBORN"); await status("UNAVAILABLE"); privateClean();
        });
        add("Disabled install has no key backup hook listener or caller-approval authority", async () => {
            const before = noEffects(); assert.equal((await call("installPreCommitGuard")).status, "UNAVAILABLE");
            assert.deepEqual(noEffects(), before); assert.equal((await fact(hook())).present, false); assert.equal(reviews.length, 0);
        });
        add("Repository setting cannot enable the strict machine owner route", async () => {
            let refused = false;
            try { await configuration.update(FLAG, true, vscode.ConfigurationTarget.Workspace); }
            catch (error) { assert(error instanceof Error && error.name === "CodeExpectedError"); refused = true; }
            try { assert.equal((await call("installPreCommitGuard")).status, "UNAVAILABLE"); assert(refused || configuration.inspect<boolean>(FLAG)?.globalValue !== true); }
            finally { if (!refused) await configuration.update(FLAG, undefined, vscode.ConfigurationTarget.Workspace); }
        });
        add("Enable plus cancelled native review creates no signing key encrypted backup or service", async () => {
            await setFlag(true); const before = noEffects(); approve = false;
            try { assert.equal((await call("installPreCommitGuard")).status, "CANCELLED"); } finally { approve = true; }
            assert.deepEqual(noEffects(), before); assert.equal((await fact(hook())).present, false); assert.equal((await backupFacts()).length, 0);
            assert.equal(reviews.at(-1)?.action, ACTIONS[0]);
        });
        add("Reviewed default installation owns exact hook bytes and encrypted absence recovery", async () => {
            await install(".git/hooks"); const record = await saved(); assert.equal(record.value.receipt.originalPresent, false);
            assert.equal(stores.signing, 1); assert.equal(stores.backupKey, 1);
        });
        add("Actual default owner public commit succeeds with signed request and complete object-scan witnesses", async () => {
            await stage(publicText("default positive")); await ownerCommit("default positive", "allow", "ALLOW");
        });
        add("Actual staged secret with public worktree is blocked by the signed full object scan", async () => {
            await stage(SECRET); await fsp.writeFile(join(root, SOURCE), publicText("sanitized worktree"));
            await ownerCommit("staged private public worktree", "block", "BLOCK");
        });
        add("Actual staged public with unstaged secret succeeds without worktree fallback", async () => {
            await stage(publicText("staged public control")); await fsp.writeFile(join(root, SOURCE), SECRET);
            await ownerCommit("public stage private worktree", "allow", "ALLOW");
        });
        add("Actual staged rename retains secret blob analysis despite a public renamed worktree", async () => {
            await stage(SECRET); await setupGit("rename-staged-source", ["mv", "--", SOURCE, RENAMED]);
            await fsp.writeFile(join(root, RENAMED), publicText("renamed worktree public"));
            const renamed = await fact(join(root, RENAMED));
            await ownerCommit("renamed staged private", "block", "BLOCK");
            assert.deepEqual(await fact(join(root, RENAMED)), renamed);
            await setupGit("restore-synthetic-source-name", ["mv", "--", RENAMED, SOURCE]);
        });
        add("Actual staged deletion permits the empty tree without reading removed secret objects", async () => {
            await stage(SECRET); await setupGit("remove-staged-source", ["rm", "--force", "--", SOURCE]);
            assert.equal((await setupGit("empty-stage-listing", ["ls-files", "--stage", "-z"])).length, 0);
            await ownerCommit("staged deletion empty tree", "allow", "ALLOW");
            await stage(publicText("restored public after deletion")); await ownerCommit("public after deletion", "allow", "ALLOW");
        });
        add("Alternate secret index blocks while the default public index remains byte exact", async () => {
            await stage(publicText("default public alternate private"));
            await fsp.copyFile(selectedFile(), selectedFile(ALT), fs.constants.COPYFILE_EXCL);
            await stage(SECRET, ALT); await fsp.writeFile(join(root, SOURCE), publicText("alternate worktree public"));
            await ownerCommit("alternate private", "block", "BLOCK", ALT);
        });
        add("Alternate public index succeeds while the default secret index remains byte exact", async () => {
            await stage(SECRET); await stage(publicText("alternate public"), ALT); await fsp.writeFile(join(root, SOURCE), SECRET);
            await ownerCommit("alternate public", "allow", "ALLOW", ALT);
        });
        add("Exact fourth runtime is an actual directly observed finite Code Node child with close and both EOFs", async () => {
            await stage(publicText("direct worker control")); await directClient(".git/index", 0, true);
        });
        add("Explicit empty missing and directory client indexes refuse without HTTP or default-index fallback", async () => {
            for (const index of ["", ".git/f26a-missing-index", ".git"]) await directClient(index, 1, false);
        });
        add("Cancelled native restore preserves exact default hook and live reviewed owner", async () => {
            const before = await fact(hook()), effects = noEffects(); approve = false;
            try { assert.equal((await call("restorePreCommitGuard")).status, "CANCELLED"); } finally { approve = true; }
            assert.deepEqual(await fact(hook()), before); assert.deepEqual(noEffects(), effects); await status("LIVE");
        });
        add("Reviewed default undo restores absence and a later actual public commit needs no owned request", async () => {
            assert.equal((await call("restorePreCommitGuard")).status, "RESTORED"); await idle(); assert.equal((await fact(hook())).present, false);
            await stage(publicText("after default restore")); await ownerCommit("after default restore", "allow", "none");
        });
        add("Supported actual local custom hooksPath selects one preserved existing shell body and mode", async () => {
            await setupGit("set-local-custom-hooks", ["config", "--local", "core.hooksPath", CUSTOM]);
            await fsp.mkdir(join(root, CUSTOM)); customBody = original(0); await fsp.writeFile(hook(CUSTOM), customBody, { flag: "wx", mode: 0o755 });
            beforeCustom = await fact(hook(CUSTOM)); assert.equal((await fact(hook())).present, false);
        });
        add("Custom review cancellation is inert and accepted install preserves the original body once", async () => {
            const effects = noEffects(); approve = false;
            try { assert.equal((await call("installPreCommitGuard")).status, "CANCELLED"); } finally { approve = true; }
            assert.deepEqual(noEffects(), effects); assert.deepEqual(await fact(hook(CUSTOM)), beforeCustom);
            await install(CUSTOM); const bytes = await nativeRead(hook(CUSTOM)); assert(bytes.subarray(-customBody!.length + 10).equals(customBody!.subarray(10)));
            assert.equal((await fact(hook(CUSTOM))).mode, beforeCustom!.mode); assert.equal((await fact(hook())).present, false);
        });
        add("Actual custom owner public commit invokes original exactly once with unmodified Git args and environment", async () => {
            const count = await markerCount(); await stage(publicText("custom public")); await ownerCommit("custom public", "allow", "ALLOW"); assert.equal(await markerCount(), count + 1);
        });
        add("Custom secret block never reaches original body and preserves its prior marker", async () => {
            const count = await markerCount(); await stage(SECRET); await fsp.writeFile(join(root, SOURCE), publicText("custom sanitized worktree"));
            await ownerCommit("custom staged private", "block", "BLOCK"); assert.equal(await markerCount(), count);
        });
        add("Reviewed custom undo restores exact original bytes and mode with subsequent original-only successful commit", async () => {
            assert.equal((await call("restorePreCommitGuard")).status, "RESTORED"); await idle(); assert.deepEqual(await fact(hook(CUSTOM)), beforeCustom);
            const count = await markerCount(); await stage(publicText("custom original only")); await ownerCommit("custom original only", "allow", "none"); assert.equal(await markerCount(), count + 1);
        });
        add("New reviewed custom round retains a supported literal exit-seven original", async () => {
            customBody = original(7); await fsp.writeFile(hook(CUSTOM), customBody); beforeCustom = await fact(hook(CUSTOM)); await install(CUSTOM);
        });
        add("Actual scanner ALLOW falls through once to original exit seven while Git aborts with its observed outer code", async () => {
            const count = await markerCount(); await stage(publicText("custom exit seven")); await ownerCommit("custom exit seven", "block", "ALLOW"); assert.equal(await markerCount(), count + 1);
        });
        add("Exact custom exit-seven undo preserves its bytes mode arguments environment and independent abort behavior", async () => {
            assert.equal((await call("restorePreCommitGuard")).status, "RESTORED"); await idle(); assert.deepEqual(await fact(hook(CUSTOM)), beforeCustom);
            const count = await markerCount(); await stage(publicText("restored original exit seven")); await ownerCommit("restored exit seven", "block", "none"); assert.equal(await markerCount(), count + 1);
        });
        add("Return to the actual default effective hooksPath without any owner-command override", async () => {
            await setupGit("unset-local-custom-hooks", ["config", "--local", "--unset", "core.hooksPath"]); assert.equal((await fact(hook())).present, false);
            await install(".git/hooks");
        });
        add("Actual machine disable withdraws service and blocks installed owner commit without original execution", async () => {
            await setFlag(false); await status("UNAVAILABLE"); const count = await markerCount();
            await stage(publicText("disabled owner")); await ownerCommit("disabled owner", "block", "none"); assert.equal(await markerCount(), count);
        });
        add("Explicit reviewed restore stays available while machine flag is false and restores absence", async () => {
            const keys = { signing: stores.signing, backupKey: stores.backupKey };
            assert.equal((await call("restorePreCommitGuard")).status, "RESTORED"); await idle(); assert.equal((await fact(hook())).present, false);
            assert.deepEqual({ signing: stores.signing, backupKey: stores.backupKey }, keys);
            await stage(publicText("flag off restored")); await ownerCommit("flag off restored", "allow", "none");
        });
        add("Fresh reviewed default installation establishes the exact retained restart owner basis", async () => {
            await setFlag(true); await install(".git/hooks"); await stage(publicText("restart pending public"));
            // Finish Git's own cache-tree preparation before the launcher
            // freezes the byte-exact offline index; never attribute Git's
            // ordinary cache maintenance to a hook rewrite.
            await setupGit("prepare-offline-cache-tree", ["write-tree"]);
            const record = await saved(); assert.equal(record.value.receipt.originalPresent, false); assert.equal(record.value.state, "APPLIED");
        });
        add("All actual direct children close with both EOFs zero signals and unchanged parent environment", async () => {
            assert(!halted); await Promise.all(pendingChildren); children.forEach(closed); privateClean();
            for (const row of children.filter(row => row.kind === "projection" || row.kind === "scan")) {
                if (row.kind === "projection" && row.operation === "config") assert(row.code === 0 || row.code === 1 && row.stdoutBytes === 0);
                else success(row); assert.equal(row.stderrBytes, 0);
            }
            assert.deepEqual(await runtimeFacts(), runtimes); assert.deepEqual(await fact(join(context.extensionUri.fsPath, "package.json")), executionManifest);
            assert.equal(hashCode(), codeSha256); assert.equal(JSON.stringify(process.env), parentEnvironment);
        });
        add("Retain exact before-close source index hooks manifest/runtime and encrypted recovery facts for launcher offline proof", async () => {
            const record = await saved();
            restartState = { schemaVersion: 1, syntheticOnly: true, root, phase: "primary", ready: true, oldFlag: initialFlag,
                runtimeBindings: runtimes, executionManifest, hook: await fact(hook()), customHook: await fact(hook(CUSTOM)), index: await fact(selectedFile()),
                source: await fact(join(root, SOURCE)), config: await fact(join(root, ".git", "config")), head: head(),
                generation: record.pin.generation, publicPinSha256: sha(Buffer.from(record.value.pin, "base64")), recordSha256: sha(record.raw),
                descriptor: await fact(record.pin.descriptor), session: record.descriptor.session, backupFacts: await backupFacts(),
                ownerEnvironmentSha256: sha(JSON.stringify(ownerEnvironment)), offlineArguments: ownerArguments("offline owner absent"),
                offlineEnvironmentSha256: sha(JSON.stringify(ownerEnv())), driverSha256: sha(await nativeRead(__filename)) };
            safeMetadata(restartState); await fsp.writeFile(stateFile(), JSON.stringify(restartState, null, 2) + "\n", { flag: "wx" });
        });
    } else {
        add("Restart does not auto-resume query create key or mutate exact retained installation bytes", async () => {
            prior = JSON.parse(await nativeRead(stateFile(), "utf8")) as RestartState;
            assert(prior.schemaVersion === 1 && prior.ready && prior.syntheticOnly && prior.phase === "primary" && prior.root === root);
            assert.equal(children.length, 0); assert.equal(wires.length, 0); assert.equal(ownerServers, 0); assert.equal(reviews.length, 0);
            assert.deepEqual(stores, { signing: 0, backupKey: 0, record: 0, unrelated: 0 }); await status("OWNER_REVIEW_REQUIRED");
            assert.deepEqual(await runtimeFacts(), prior.runtimeBindings); assert.equal(sha(await nativeRead(__filename)), prior.driverSha256);
            assert.deepEqual(executionManifest, prior.executionManifest);
            for (const [file, expected] of [[hook(), prior.hook], [hook(CUSTOM), prior.customHook], [selectedFile(), prior.index], [join(root, SOURCE), prior.source], [join(root, ".git", "config"), prior.config]] as const)
                assert.deepEqual(await fact(file), expected);
            assert.equal(head(), prior.head); const record = await saved(); assert.equal(sha(record.raw), prior.recordSha256);
            assert.equal(record.pin.generation, prior.generation); assert.equal(record.descriptor.session, prior.session);
            assert.equal(sha(Buffer.from(record.value.pin, "base64")), prior.publicPinSha256); assert.deepEqual(await fact(record.pin.descriptor), prior.descriptor);
            assert.deepEqual(await backupFacts(), prior.backupFacts); assert.equal(sha(JSON.stringify(ownerEnvironment)), prior.ownerEnvironmentSha256); privateClean();
        });
        add("Launcher actual closed-editor and offline owner commit receipt proves unavailable owner without stale ALLOW", async () => {
            assert(prior); const offline = JSON.parse(await nativeRead(absentFile(), "utf8"));
            assert.equal(offline.schemaVersion, 1); assert.equal(offline.status, "ACTUAL_OWNER_ABSENT_BLOCKED"); assert.equal(offline.syntheticOnly, true);
            assert.equal(offline.primaryStateSha256, sha(await nativeRead(stateFile()))); assert.equal(offline.generation, prior.generation);
            assert.equal(offline.code.observedExit, true); assert.equal(offline.code.exitCode, 0); assert.equal(offline.code.stdoutEOF, true); assert.equal(offline.code.stderrEOF, true);
            assert.equal(offline.code.signalsRequested, 0); assert.equal(offline.code.pidAbsentTwice, true); assert.equal(offline.code.streamsStable, true);
            assert.equal(offline.code.ownedWindowClose, "workbench.action.closeWindow"); assert.equal(offline.code.executable, process.execPath);
            assert.equal(offline.owner.executable, GIT); assert.deepEqual(offline.owner.args, prior.offlineArguments); assert.equal(offline.owner.cwd, root);
            assert.equal(offline.owner.environmentSha256, prior.offlineEnvironmentSha256); assert.equal(offline.owner.closed, true);
            assert.equal(offline.owner.stdoutEOF, true); assert.equal(offline.owner.stderrEOF, true); assert.equal(offline.owner.signalsRequested, 0);
            assert.equal(offline.owner.signal, null); assert(Number.isInteger(offline.owner.exitCode) && offline.owner.exitCode !== 0);
            assert.equal(offline.owner.timedOut, false); assert.equal(offline.owner.ownerArgumentsHaveNoHooksOverride, true);
            assert.equal(offline.headBefore, prior.head); assert.equal(offline.headAfter, prior.head);
            assert.deepEqual(offline.sourceBefore, prior.source); assert.deepEqual(offline.sourceAfter, prior.source);
            assert.deepEqual(offline.indexBefore, prior.index); assert.deepEqual(offline.indexAfter, prior.index);
            assert.deepEqual(offline.hookBefore, prior.hook); assert.deepEqual(offline.hookAfter, prior.hook);
            for (const stream of [offline.owner.stdout, offline.owner.stderr]) {
                assert(typeof stream.path === "string" && within(parent, stream.path)); const bytes = await nativeRead(stream.path);
                assert.equal(bytes.length, stream.bytes); assert.equal(sha(bytes), stream.sha256);
            }
            await ownerCommit("before explicit restart resume", "block", "none"); await status("OWNER_REVIEW_REQUIRED");
        });
        add("Cancelled explicit resume leaves the retained key backup hook and old signed endpoint unchanged", async () => {
            assert(prior); const before = noEffects(); approve = false;
            try { assert.equal((await call("resumePreCommitGuard")).status, "CANCELLED"); } finally { approve = true; }
            assert.deepEqual(noEffects(), before); assert.equal(reviews.at(-1)?.action, ACTIONS[1]);
            const record = await saved(); assert.equal(record.descriptor.session, prior.session); assert.equal(sha(record.raw), prior.recordSha256);
            assert.deepEqual(await fact(hook()), prior.hook); await status("OWNER_REVIEW_REQUIRED");
        });
        add("Reviewed resume signs a fresh session and commits public staged data; unknown hook owner edit is preserved INCOMPLETE", async () => {
            assert(prior); assert.equal((await call("resumePreCommitGuard")).status, "RESUMED"); await status("LIVE");
            assert.equal(reviews.at(-1)?.action, ACTIONS[1]); const record = await saved(); assert.notEqual(record.descriptor.session, prior.session);
            assert.equal(record.pin.generation, prior.generation); assert.equal(sha(Buffer.from(record.value.pin, "base64")), prior.publicPinSha256);
            assert.equal(stores.signing, 0); assert.equal(stores.backupKey, 0); assert.deepEqual(await backupFacts(), prior.backupFacts);
            await ownerCommit("reviewed restart public", "allow", "ALLOW");
            const edit = Buffer.from("#!/bin/sh\n# TEST_ONLY_F26A_OWNER_EDIT_RETAIN_EXACT\nexit 9\n");
            await fsp.writeFile(join(parent, "precommit-owner-edit-retained.sh"), edit, { flag: "wx" }); await fsp.writeFile(hook(), edit);
            const ownerEdit = await fact(hook()), beforeReview = reviews.length;
            assert.equal((await call("restorePreCommitGuard")).status, "INCOMPLETE"); assert.equal(reviews.length, beforeReview);
            assert.deepEqual(await fact(hook()), ownerEdit); assert((await nativeRead(hook())).equals(await nativeRead(join(parent, "precommit-owner-edit-retained.sh"))));
            const raw = await contextRef.secrets.get(recordKey()); assert(raw && JSON.parse(raw).state === "INCOMPLETE");
            assert.deepEqual(await backupFacts(), prior.backupFacts); await until(async () => (await call("preCommitGuardStatus")).status !== "LIVE", "Edited hook must withdraw owner.");
            await setFlag(prior.oldFlag); assert(!halted); await Promise.all(pendingChildren); children.forEach(closed); privateClean(); assert.deepEqual(await runtimeFacts(), runtimes);
        });
    }
    assert.equal(checks.length, phase === "primary" ? 30 : 4);
    for (let index = 0; index < checks.length; index++) observations.push({ id: "F26A-H" + (phase === "primary" ? "P" : "R") + String(index + 1).padStart(2, "0"), scope: checks[index].scope, status: "NOT_RUN" });
    try {
        for (let index = 0; index < checks.length; index++) {
            caseId = observations[index].id; setupStage = caseId;
            try { assert(!halted); await checks[index].work(); observations[index].status = "PASS"; }
            catch (error) { diagnostics07.frames(error); observations[index].status = "FAIL"; observations[index].errorName = error instanceof Error ? error.name : "UnknownFailure";
                driverFailure = halted ? "STOP_UNCONFIRMED" : "NativePreCommitGuardFailure"; break; }
        }
    } finally {
        const busy = children.some(row => row.busy);
        if (!busy) { listeners.forEach(listener => listener.dispose()); for (const restore of restorers.reverse()) restore(); }
        // Retain installed hook and machine true at successful primary close.
        // An unknown owner edit at restart remains retained INCOMPLETE, never
        // silently repaired or deleted to make the suite look successful.
        const summary = { schemaVersion: 1, phase, syntheticOnly: true, fixtureStatus: "PREPARED_NATIVE_FIXTURE_ACTUAL_RESULTS_ONLY",
            hostVersion: vscode.version, extensionBundleSha256: runtimes[0].sha256, workerSha256: runtimes[3].sha256,
            runtimeBindings: runtimes, currentRuntimeBindings: await runtimeFacts(), executionManifest,
            currentExecutionManifest: await fact(join(context.extensionUri.fsPath, "package.json")), hostProbeSha256: sha(await nativeRead(__filename)), codeSha256,
            observations, expectedChecks: phase === "primary" ? 30 : 4, passed: observations.filter(row => row.status === "PASS").length,
            failed: observations.filter(row => row.status === "FAIL").length, notRun: observations.filter(row => row.status === "NOT_RUN").length,
            children, requests: wires, commitProofs, reviews, secretStores: stores, ownerServers, diagnostics07: diagnostics07.snapshot(),
            sourceDocuments, sourceDocumentEvents, directWorktreeReads, directObjectReads, metadataLeak,
            parentEnvironmentUnchanged: JSON.stringify(process.env) === parentEnvironment, driverFailure,
            busyChildren: children.filter(row => row.busy).length, timedOutChildren: children.filter(row => row.timedOut).length,
            readyForInterphase: phase === "primary" && !!restartState && !driverFailure && !busy,
            interphaseEvidence: phase === "restart" && observations[1].status === "PASS" ? "ACTUAL_LAUNCHER_RECEIPT_VALIDATED" : "NOT_RUN",
            nestedClientClosure: "NOT_INFERRED_FROM_OWNER_GIT;ADDITIONAL_DIRECT_PACKAGED_CLIENT_CLOSE_EOF_CONTROLS",
            limits: { stagedEntries: 128, blobBytes: 65536, admittedBytes: 1048576, operationMilliseconds: 60000, fixtureChildMilliseconds: CHILD_LIMIT },
            independence: "LOW", ownerPresence: "SCRIPTED_NATIVE_API_DECISIONS_NOT_HUMAN_REVIEW",
            notTested: ["Same-user bypass or atomic OS confinement", "Human review accessibility/usability", "Registered-value guarantee or credential validity",
                "Other platforms/remote workspaces", "Held-result withdrawal is UNIT_ONLY unless separately witnessed in actual native receipt"] };
        safeMetadata(summary); await fsp.writeFile(output, JSON.stringify(summary, null, 2) + "\n", { flag: "wx" });
        if (busy) throw Error("STOP_UNCONFIRMED: retain editor ownership; do not close or advance phases.");
    }
    if (driverFailure || observations.some(row => row.status !== "PASS")) throw Error("Native pre-commit guard incomplete.");
}
