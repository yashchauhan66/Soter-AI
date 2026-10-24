/** F23 exact packaged native commands over one fresh retained synthetic repo.
 * Modal decisions are scripted native API decisions (LOW independence).
 * Setup and product children drain to actual close plus both EOFs; no signals,
 * process timeouts, pipe destruction, downloads or existing history are used. */
import * as vscode from "vscode";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import childProcess, { type ChildProcess, type SpawnOptions } from "node:child_process";
import fs from "node:fs";
import fsp from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import type { Writable } from "node:stream";

const GIT = "C:\\Program Files\\Git\\cmd\\git.exe", VERSION = "git version 2.53.0.windows.1";
const VALUE = "TEST_ONLY_F23_HOST_PRIVATE_f48d19c6", CALLER = "TEST_ONLY_F23_CALLER_NOT_AUTHORITY_42ba7e01";
const ORIGINAL = ".env.history-private", RENAMED = "renamed-history-private.snapshot";
const AUTHOR = "HISTORY_AUTHOR_CANARY_F23", MESSAGE = "HISTORY_COMMIT_CANARY_F23";
const SOURCE = "API_KEY=" + VALUE + "\nPORT=3000\n";
const KEY = "soterai.hygiene.hmacKey.v1", STATE = "soterai.lite.hygiene.exposure.v1", FLAG = "lite.historyScanner";
const nativeSpawn = childProcess.spawn, nativeRead = fsp.readFile, nativeReadSync = fs.readFileSync;
const restores: Array<() => void> = [], listeners: vscode.Disposable[] = [], displayed: vscode.TextDocument[] = [], opened: vscode.TextDocument[] = [];
const metadata: string[] = [], reviews: Array<{ action: string; safe: boolean }> = [];
const children: ChildReceipt[] = [], historyClosures: Array<Promise<Completion>> = [];
const started = performance.now();
const trace: Array<{ event: string; milliseconds: number; status?: string; files?: number; findings?: number }> = [];
let root = "", setupJob = "", setupEnvironment: NodeJS.ProcessEnv = {}, setupPrefix: string[] = [];
let stores = 0, vaultStores = 0, sourceCalls = 0, sourceEvents = 0, historyBodyReads = 0;
let approve = true, holdPrompt = false, promptEntered = false, heldAction: string | undefined;
let finishPrompt: ((choice: string | undefined) => void) | undefined;
let holdDocument = false, documentEntered = false, finishDocument: (() => void) | undefined;
let lastReview: any, setupStage = "initial";
type ChildReceipt = { phase: "setup" | "history"; operation: string; closed: boolean; code: number | null; signal: NodeJS.Signals | null;
    stdoutEOF: boolean; stderrEOF: boolean; stdoutBytes: number; stderrBytes: number; stdoutSha256: string; stderrSha256: string;
    spawnFailed: boolean; streamError: boolean; overflow: boolean; signalsRequested: number; stdinObjects: number; invalidInput: boolean };
type Completion = { receipt: ChildReceipt; stdout: Buffer };
const sha = (bytes: Uint8Array | string) => createHash("sha256").update(bytes).digest("hex");
const note = (event: string) => trace.push({ event, milliseconds: performance.now() - started });
const within = (base: string, file: string) => { const part = relative(resolve(base), resolve(file)); return part === "" || !part.startsWith("..") && !isAbsolute(part); };
function noValues(value: unknown): void {
    const text = typeof value === "string" ? value : JSON.stringify(value) ?? "";
    for (const privateValue of [VALUE, CALLER, ORIGINAL, RENAMED, AUTHOR, MESSAGE]) assert(!text.includes(privateValue), "Private history entered metadata.");
    if (root) assert(!text.includes(root), "Original workspace path entered metadata.");
}
function patch(object: object, name: string, value: unknown): void {
    const prior = Object.getOwnPropertyDescriptor(object, name);
    Object.defineProperty(object, name, { configurable: true, writable: true, value });
    restores.push(() => prior ? Object.defineProperty(object, name, prior) : Reflect.deleteProperty(object, name));
}
async function until(predicate: () => boolean): Promise<void> {
    const end = Date.now() + 5000;
    while (!predicate() && Date.now() < end) await new Promise<void>(done => setTimeout(done, 10));
    assert(predicate(), "Expected synthetic native UI stage was not reached.");
}
function closedSuccess(receipt: ChildReceipt): void {
    assert.equal(receipt.closed, true); assert.equal(receipt.code, 0); assert.equal(receipt.signal, null);
    assert.equal(receipt.stdoutEOF, true); assert.equal(receipt.stderrEOF, true); assert.equal(receipt.spawnFailed, false);
    assert.equal(receipt.streamError, false); assert.equal(receipt.overflow, false); assert.equal(receipt.signalsRequested, 0); assert.equal(receipt.invalidInput, false);
    if (receipt.phase === "history") assert.equal(receipt.stderrBytes, 0);
}
function observe(child: ChildProcess, phase: ChildReceipt["phase"], operation: string): Promise<Completion> {
    const row: ChildReceipt = { phase, operation, closed: false, code: null, signal: null, stdoutEOF: false, stderrEOF: false,
        stdoutBytes: 0, stderrBytes: 0, stdoutSha256: "", stderrSha256: "", spawnFailed: false, streamError: false,
        overflow: false, signalsRequested: 0, stdinObjects: 0, invalidInput: false };
    children.push(row);
    return new Promise(done => {
        const stdout: Buffer[] = [], outHash = createHash("sha256"), errHash = createHash("sha256"); let resolved = false;
        child.kill = (() => { row.signalsRequested++; throw Error("Synthetic history verification forbids signals."); }) as typeof child.kill;
        if (phase === "history" && child.stdin) {
            const end = child.stdin.end;
            child.stdin.end = function (this: Writable, ...values: any[]) {
                const value = values[0], input = typeof value === "string" || Buffer.isBuffer(value) ? Buffer.from(value).toString("ascii") : "";
                if (operation !== "batch" || !/^(?:[a-f0-9]{40}\n){1,128}$/.test(input)) row.invalidInput = true;
                else row.stdinObjects = input.trimEnd().split("\n").length;
                // Always delegate so an assertion cannot strand an owned child.
                return Reflect.apply(end, this, values);
            } as Writable["end"];
        }
        const finish = () => {
            if (resolved || !row.closed || !row.spawnFailed && (!row.stdoutEOF || !row.stderrEOF)) return;
            resolved = true; row.stdoutSha256 = outHash.digest("hex"); row.stderrSha256 = errHash.digest("hex");
            done({ receipt: row, stdout: Buffer.concat(stdout) });
        };
        child.once("error", () => { row.spawnFailed = child.pid === undefined; row.streamError = !row.spawnFailed; });
        child.once("close", (code, signal) => { row.closed = true; row.code = code; row.signal = signal; finish(); });
        for (const channel of ["stdout", "stderr"] as const) {
            const stream = child[channel]; assert(stream);
            stream.on("data", (bytes: Buffer) => {
                if (channel === "stdout") { row.stdoutBytes += bytes.length; outHash.update(bytes); }
                else { row.stderrBytes += bytes.length; errHash.update(bytes); }
                if (row.stdoutBytes + row.stderrBytes > (phase === "setup" ? 65536 : 1048576 + 128 * 96 + 8192)) row.overflow = true;
                if (phase === "setup" && channel === "stdout" && !row.overflow) stdout.push(Buffer.from(bytes));
            });
            stream.once("end", () => { if (channel === "stdout") row.stdoutEOF = true; else row.stderrEOF = true; finish(); });
            stream.once("error", () => { row.streamError = true; });
        }
    });
}
async function git(operation: string, args: string[]): Promise<string> {
    assert(setupJob); const complete = await observe(nativeSpawn(GIT, [...setupPrefix, ...args], {
        cwd: root, env: setupEnvironment, shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
    }), "setup", operation);
    closedSuccess(complete.receipt); return complete.stdout.toString("utf8");
}
async function repositoryBytes(): Promise<{ files: number; sha256: string }> {
    const entries: Array<{ path: string; bytes: number; sha256: string }> = [];
    const walk = async (directory: string): Promise<void> => {
        for (const entry of await fsp.readdir(directory, { withFileTypes: true })) {
            assert.equal(entry.isSymbolicLink(), false); const file = join(directory, entry.name);
            if (entry.isDirectory()) await walk(file);
            else { assert(entry.isFile()); const bytes = await nativeRead(file); entries.push({ path: relative(root, file).replaceAll("\\", "/"), bytes: bytes.length, sha256: sha(bytes) }); }
        }
    };
    await walk(root); entries.sort((a, b) => a.path.localeCompare(b.path));
    return { files: entries.length, sha256: sha(JSON.stringify(entries)) };
}
async function prepareUnborn(): Promise<void> {
    const temporary = process.env.TEMP; assert(temporary && within(process.env.USERPROFILE!, temporary));
    await assert.rejects(fsp.stat(join(root, ".git")), { code: "ENOENT" });
    setupJob = await fsp.mkdtemp(join(temporary, "f23-host-git-setup-"));
    await fsp.mkdir(join(setupJob, "empty-hooks")); await fsp.writeFile(join(setupJob, "empty.gitconfig"), "", { flag: "wx" });
    setupEnvironment = { HOME: setupJob, USERPROFILE: setupJob, XDG_CONFIG_HOME: setupJob, TEMP: setupJob, TMP: setupJob, PATHEXT: ".EXE",
        GIT_CONFIG_SYSTEM: join(setupJob, "empty.gitconfig"), GIT_CONFIG_GLOBAL: join(setupJob, "empty.gitconfig"), GIT_CONFIG_NOSYSTEM: "1",
        GIT_TERMINAL_PROMPT: "0", GIT_OPTIONAL_LOCKS: "0", GIT_NO_LAZY_FETCH: "1", GIT_NO_REPLACE_OBJECTS: "1", GIT_ATTR_NOSYSTEM: "1", GIT_PROTOCOL_FROM_USER: "0" };
    for (const key of ["SystemRoot", "WINDIR", "COMSPEC"]) {
        const value = process.env[key]; if (value && isAbsolute(value) && !/[\x00-\x1f\x7f-\x9f]/.test(value) && !value.startsWith("\\\\")) setupEnvironment[key] = value;
    }
    setupPrefix = ["--no-pager", "--literal-pathspecs", "--no-lazy-fetch", "--no-replace-objects", "--no-optional-locks",
        "-c", "core.hooksPath=" + join(setupJob, "empty-hooks"), "-c", "core.fsmonitor=false", "-c", "credential.helper=", "-c", "protocol.allow=never",
        "-c", "core.autocrlf=false", "-c", "commit.gpgSign=false", "-c", "gc.auto=0", "-c", "maintenance.auto=false",
        "-c", "user.name=" + AUTHOR, "-c", "user.email=synthetic-f23-host@example.invalid"];
    assert.equal((await git("version", ["--version"])).trim(), VERSION);
    await git("init", ["init", "--quiet", "--initial-branch=main", "--object-format=sha1", "--template=" + join(setupJob, "empty-hooks")]);
}
function historyOperation(args: readonly string[], settings: SpawnOptions): string {
    const job = settings.env?.HOME; assert(job && isAbsolute(job));
    const prefix = ["--no-pager", "--literal-pathspecs", "-c", "core.hooksPath=" + join(job, "empty-hooks"), "-c", "core.fsmonitor=false",
        "-c", "credential.helper=", "-c", "commit.gpgSign=false", "--no-lazy-fetch", "--no-replace-objects", "--no-optional-locks",
        "-c", "protocol.allow=never", "-c", "core.pager=", "-c", "color.ui=false", "-c", "core.attributesFile=" + join(job, "empty.gitconfig"),
        "-c", "gc.auto=0", "-c", "maintenance.auto=false"];
    assert.deepEqual(args.slice(0, prefix.length), prefix); const suffix = args.slice(prefix.length);
    if (suffix.length === 1 && suffix[0] === "--version") { assert.equal(settings.cwd, job); return "version"; }
    assert.equal(settings.cwd, root);
    if (suffix[0] === "rev-list") { assert.deepEqual(suffix, ["rev-list", "--max-count=33", "--all", "--"]); return "commits"; }
    if (suffix[0] === "ls-tree") { assert.equal(suffix.length, 7); assert.match(suffix[5], /^[a-f0-9]{40}$/); assert.deepEqual(suffix, ["ls-tree", "-r", "-z", "--full-tree", "--long", suffix[5], "--"]); return "tree"; }
    assert.deepEqual(suffix, ["cat-file", "--batch"]); return "batch";
}
export function setupDiagnostic() {
    return { syntheticOnly: true, stage: setupStage, sourceCalls, sourceEvents, historyBodyReads, stores, vaultStores,
        historyChildren: children.filter(child => child.phase === "history").length, setupChildren: children.filter(child => child.phase === "setup").length };
}
export async function beforeActivate(context: vscode.ExtensionContext): Promise<void> {
    assert.equal(vscode.workspace.workspaceFolders?.length, 1); root = vscode.workspace.workspaceFolders![0].uri.fsPath;
    assert.match(resolve(process.env.USERPROFILE ?? ""), /^D:\\SoterAI-Lite-test-profiles\\/i);
    assert.match(resolve(root), /^D:\\SoterAI-Lite-test-profiles\\/i); assert(!within(root, context.globalStorageUri.fsPath));
    assert.equal(process.platform, "win32");
    const phase = process.env.SOTERAI_LITE_F17_PHASE; assert(phase === "primary" || phase === "restart");
    setupStage = "synthetic-repository-preparation"; if (phase === "primary") await prepareUnborn();
    const historyPath = (value: unknown) => typeof value === "string" && within(join(root, ".git", "objects"), value);
    patch(fs, "readFileSync", (...args: unknown[]) => { if (historyPath(args[0])) historyBodyReads++; return Reflect.apply(nativeReadSync, fs, args); });
    patch(fsp, "readFile", (...args: unknown[]) => { if (historyPath(args[0])) historyBodyReads++; return Reflect.apply(nativeRead, fsp, args); });
    patch(childProcess, "spawn", (...values: unknown[]) => {
        const executable = values[0], args = values[1] as readonly string[], settings = values[2] as SpawnOptions;
        assert.equal(executable, GIT); assert(Array.isArray(args)); assert.equal(settings.shell, false); assert.equal(settings.windowsHide, true);
        assert.equal(settings.timeout, undefined); assert.equal(settings.signal, undefined); assert.equal(settings.killSignal, undefined);
        for (const key of ["PATH", "OPENAI_API_KEY", "GIT_CONFIG_COUNT", "GIT_CONFIG_KEY_0", "GIT_CONFIG_VALUE_0", "GIT_OBJECT_DIRECTORY", "GIT_ALTERNATE_OBJECT_DIRECTORIES", "NODE_OPTIONS"])
            assert.equal(settings.env?.[key], undefined);
        assert.equal(settings.env?.GIT_NO_LAZY_FETCH, "1"); assert.equal(settings.env?.GIT_NO_REPLACE_OBJECTS, "1");
        const operation = historyOperation(args, settings);
        const child = Reflect.apply(nativeSpawn, childProcess, values) as ChildProcess;
        historyClosures.push(observe(child, "history", operation)); return child;
    });
    const store = context.secrets.store;
    patch(context.secrets, "store", async (key: string, value: string) => {
        if (key === KEY) { stores++; assert.equal(Buffer.from(value, "base64").length, 32); }
        if (key === "soterai.vaultKey") vaultStores++;
        return store.call(context.secrets, key, value);
    });
    listeners.push(vscode.workspace.onDidChangeConfiguration(event => { if (event.affectsConfiguration("soterai")) note("soterai-configuration-event"); }),
        context.secrets.onDidChange(event => { if (event.key === KEY) note("history-key-event"); }));
    const originalFile = (value: unknown) => value instanceof vscode.Uri && value.scheme === "file"
        && ([ORIGINAL, RENAMED, "public.txt"].some(name => value.toString() === vscode.Uri.file(join(root, name)).toString()) || within(join(root, ".git"), value.fsPath));
    const open = vscode.workspace.openTextDocument;
    patch(vscode.workspace, "openTextDocument", async (...args: unknown[]) => {
        if (originalFile(args[0])) sourceCalls++;
        const input = args[0] as { content?: string };
        if (typeof input?.content === "string") { noValues(input.content); metadata.push(input.content); }
        const document = await Reflect.apply(open, vscode.workspace, args) as vscode.TextDocument;
        if (typeof input?.content === "string") opened.push(document);
        if (holdDocument && typeof input?.content === "string") { documentEntered = true; await new Promise<void>(done => finishDocument = done); }
        return document;
    });
    listeners.push(vscode.workspace.onDidOpenTextDocument(document => { if (originalFile(document.uri)) sourceEvents++; }));
    const show = vscode.window.showTextDocument;
    patch(vscode.window, "showTextDocument", async (...args: unknown[]) => {
        const document = args[0] as vscode.TextDocument; noValues(document.getText()); displayed.push(document); return Reflect.apply(show, vscode.window, args);
    });
    patch(vscode.window, "showWarningMessage", async (message: string, options: vscode.MessageOptions, ...items: string[]) => {
        noValues([message, options, items]);
        const history = /history/i.test(message), action = history ? items.length === 1 ? items[0] : undefined : items.find(item => item === "Create metadata export");
        if (!action) return undefined; assert.equal(options.modal, true); reviews.push({ action, safe: true });
        if (history && holdPrompt) { promptEntered = true; heldAction = action; return new Promise<string | undefined>(done => finishPrompt = done); }
        return approve ? action : undefined;
    });
    for (const name of ["showInformationMessage", "showErrorMessage"]) patch(vscode.window, name, async (message: unknown) => { noValues(message); return undefined; });
    setupStage = "instrumented-before-production-activation";
}

export async function run(context: vscode.ExtensionContext): Promise<void> {
    const phase = process.env.SOTERAI_LITE_F17_PHASE!, output = process.env.SOTERAI_LITE_F17_EVIDENCE!;
    const config = vscode.workspace.getConfiguration("soterai"), oldGlobal = config.inspect<boolean>(FLAG)?.globalValue;
    const runtime = sha(await nativeRead(join(context.extensionUri.fsPath, "dist/extension.js")));
    assert.equal(runtime, process.env.SOTERAI_LITE_F17_BUNDLE_SHA256);
    const receipt = join(dirname(root), "history-restart.json"), observations: Array<{ id: string; scope: string; status: string; errorName?: string }> = [];
    const check = async (scope: string, work: () => Promise<void>) => {
        const row = { id: "F23-N" + String(observations.length + 1).padStart(2, "0"), scope, status: "NOT_RUN", errorName: undefined as string | undefined }; observations.push(row);
        try { await work(); row.status = "PASS"; } catch (error) { row.status = "FAIL"; row.errorName = error instanceof Error ? error.name : "UnknownFailure"; }
    };
    const call = async (name: string, ...args: unknown[]): Promise<any> => {
        note("command-start-" + name); const value: any = await vscode.commands.executeCommand("soterai." + name, ...args); noValues(value);
        trace.push({ event: "command-end-" + name, milliseconds: performance.now() - started,
            status: typeof value?.status === "string" && /^[A-Z_]{1,80}$/.test(value.status) ? value.status : "METADATA",
            files: Number.isSafeInteger(value?.files) ? value.files : undefined, findings: Array.isArray(value?.findings) ? value.findings.length : undefined });
        return value;
    };
    const count = () => children.filter(child => child.phase === "history").length;
    const closed = async () => { for (const completion of await Promise.all(historyClosures)) closedSuccess(completion.receipt); };
    const clean = () => {
        assert.equal(sourceCalls, 0); assert.equal(sourceEvents, 0); assert.equal(historyBodyReads, 0); assert.equal(vaultStores, 0);
        assert(!vscode.workspace.textDocuments.some(document => document.uri.scheme === "file"
            && ([ORIGINAL, RENAMED, "public.txt"].some(name => document.uri.toString() === vscode.Uri.file(join(root, name)).toString()) || within(join(root, ".git"), document.uri.fsPath))));
        noValues(context.globalState.get(STATE)); noValues(metadata); children.forEach(child => assert.equal(child.signalsRequested, 0));
    };
    const scan = async (...args: unknown[]) => {
        const before = await repositoryBytes(), value = await call("reviewGitHistory", ...args); await closed();
        assert.deepEqual(await repositoryBytes(), before, "Read-only history command changed repository bytes."); clean(); return value;
    };
    let driverFailure: string | undefined;
    try {
        if (phase === "primary") {
            await check("Exact runtime, two native commands and no startup history body, child, document or analyzer key", async () => {
                assert.equal(await context.secrets.get(KEY), undefined); assert.equal(stores, 0); assert.equal(count(), 0); assert.equal(metadata.length, 0);
                const status = await call("historyScannerStatus", { approved: true, root: CALLER, ref: CALLER });
                assert.equal(status.status, "OWNER_REVIEW_REQUIRED"); assert.equal(status.busy, false); assert.equal(typeof status.scope, "string");
                const commands = await vscode.commands.getCommands(true); for (const name of ["reviewGitHistory", "historyScannerStatus"]) assert(commands.includes("soterai." + name)); clean();
            });
            await check("Native history cancellation rejects caller approval, root and ref before key or children", async () => {
                approve = false; const before = reviews.length, value = await scan({ approved: true, root: CALLER, ref: CALLER, text: CALLER }, true); approve = true;
                assert.equal(value.status, "CANCELLED"); assert.equal(reviews.length, before + 1); assert.equal(count(), 0); assert.equal(stores, 0); assert.equal(metadata.length, 0);
            });
            await check("One pending real owner modal exposes busy status and refuses a second review without a child", async () => {
                holdPrompt = true; promptEntered = false; const pending = call("reviewGitHistory"); await until(() => promptEntered);
                assert.equal((await call("historyScannerStatus")).busy, true); assert.equal((await call("reviewGitHistory", { approved: true })).status, "UNAVAILABLE");
                assert.equal(count(), 0); assert.equal(stores, 0); finishPrompt?.(undefined); assert.equal((await pending).status, "CANCELLED"); holdPrompt = false;
                assert.equal((await call("historyScannerStatus")).busy, false); clean();
            });
            await check("Actual pinned Git unborn control is a bounded zero-commit analysis with closed native children", async () => {
                const value = await scan(); assert.equal(value.status, "ANALYZED"); assert.equal(value.commits, 0); assert.equal(value.files, 0); assert.deepEqual(value.findings, []);
                assert.deepEqual(children.filter(child => child.phase === "history").map(child => child.operation), ["version", "commits"]);
            });
            await check("Actual one-commit public control reports no findings and preserves every repository byte", async () => {
                await fsp.writeFile(join(root, "public.txt"), "PORT=3000\nMODE=public\n", { flag: "wx" });
                await git("public-add", ["add", "--", "public.txt"]); await git("public-commit", ["commit", "--quiet", "-m", MESSAGE]);
                const value = await scan(); assert.equal(value.status, "ANALYZED"); assert.equal(value.commits, 1); assert.equal(value.files, 1); assert.deepEqual(value.findings, []);
            });
            await check("Synthetic secret is committed, renamed and deleted while the public tip remains clean", async () => {
                await fsp.writeFile(join(root, ORIGINAL), SOURCE, { flag: "wx" }); await git("secret-add", ["add", "--", ORIGINAL]);
                await git("secret-commit", ["commit", "--quiet", "-m", MESSAGE]); await git("secret-rename", ["mv", "--", ORIGINAL, RENAMED]);
                await git("rename-commit", ["commit", "--quiet", "-m", MESSAGE]); await git("secret-remove", ["rm", "--quiet", "--", RENAMED]);
                await git("deletion-commit", ["commit", "--quiet", "-m", MESSAGE]);
                await assert.rejects(nativeRead(join(root, ORIGINAL)), { code: "ENOENT" }); await assert.rejects(nativeRead(join(root, RENAMED)), { code: "ENOENT" });
                assert.equal(await nativeRead(join(root, "public.txt"), "utf8"), "PORT=3000\nMODE=public\n"); clean();
            });
            await check("Actual reachable history detects deleted and renamed credentials once through blob deduplication", async () => {
                lastReview = await scan(); assert.equal(lastReview.status, "ANALYZED"); assert.equal(lastReview.commits, 4); assert.equal(lastReview.files, 2); assert.equal(lastReview.findings.length, 1);
                assert.equal(Buffer.from((await context.secrets.get(KEY))!, "base64").length, 32); assert.equal(await context.secrets.get("soterai.vaultKey"), undefined);
            });
            await check("Current native report is JSON metadata without originals, author, commit message, paths or values", async () => {
                assert(metadata.length >= 3); const document = JSON.parse(metadata.at(-1)!); assert.deepEqual(document, lastReview);
                for (const finding of document.findings) for (const field of ["id", "fileRef", "valueRef"]) assert.match(finding[field], /^[a-f0-9]{64}$/);
                assert(displayed.length >= 3); clean();
            });
            await check("Canonical possible-exposure ledger records exactly one keyed historical finding", async () => {
                const value = await call("openHygieneExposureLedger"); assert.equal(value.rows.length, 1);
                for (const row of value.rows) { assert.equal(row.lastAction, "possible-project-exposure"); for (const field of ["id", "rootRef", "fileRef", "valueRef"]) assert.match(row[field], /^[a-f0-9]{64}$/); }
                clean();
            });
            await check("A fresh actual history review keeps stable keyed identity while incrementing canonical observations", async () => {
                const before = await call("openHygieneExposureLedger"), fresh = await scan(); assert.equal(fresh.findings.length, 1);
                assert.equal(fresh.findings[0].id, lastReview.findings[0].id); const after = await call("openHygieneExposureLedger");
                assert.equal(after.rows.length, 1); assert(after.rows[0].observations > before.rows[0].observations); lastReview = fresh;
            });
            await check("Public path, revision, text and approval arguments cannot redirect actual repository review", async () => {
                const value = await scan(vscode.Uri.file("C:\\foreign-f23-history"), { root: CALLER, ref: CALLER, approved: true, content: CALLER });
                assert.equal(value.status, "ANALYZED"); assert.equal(value.commits, 4); assert.equal(value.findings[0].id, lastReview.findings[0].id);
            });
            await check("Historical findings grant no canonical current-file vault mutation authority", async () => {
                const before = await repositoryBytes(); assert.equal((await call("reviewHygieneVault", lastReview.findings[0], { approved: true })).status, "REVIEW_FILES_FIRST");
                assert.deepEqual(await repositoryBytes(), before); assert.equal(await context.secrets.get("soterai.vaultKey"), undefined); clean();
            });
            await check("Metadata export cancellation leaves no export file", async () => {
                approve = false; assert.equal((await call("exportHygieneExposureLedger")).status, "CANCELLED"); approve = true;
                assert.equal((await fsp.readdir(join(context.globalStorageUri.fsPath, "hygiene-exports")).catch(() => [])).length, 0); clean();
            });
            await check("Reviewed actual export contains one keyed row and no original history or credentials", async () => {
                assert.equal((await call("exportHygieneExposureLedger")).status, "EXPORTED");
                const directory = join(context.globalStorageUri.fsPath, "hygiene-exports"), files = await fsp.readdir(directory); assert.equal(files.length, 1);
                const exported = await nativeRead(join(directory, files[0]), "utf8"); noValues(exported); assert.equal(JSON.parse(exported).rows.length, 1); clean();
            });
            await check("Native historical guidance offers only manual rotation and owner-coordinated removal", async () => {
                assert.match(lastReview.guidance, /rotat/i); assert.match(lastReview.guidance, /owner/i); assert.match(lastReview.guidance, /never rewrites history/i);
                assert.match(lastReview.scope, /unreachable/i); assert.match(lastReview.scope, /credential-validity/i);
                assert.deepEqual(lastReview.findings[0].suggestions, ["rotation-checklist"]); clean();
            });
            await check("Native finite grammar, isolated environment and actual close plus both EOFs hold for every history child", async () => {
                await closed(); const product = children.filter(child => child.phase === "history"); assert(product.some(child => child.operation === "batch"));
                assert(product.filter(child => child.operation === "batch").every(child => child.stdinObjects >= 1 && child.stdinObjects <= 128));
                product.forEach(closedSuccess); clean();
            });
            await check("Disable then reenable during an owner modal irreversibly withdraws that pending history approval", async () => {
                holdPrompt = true; promptEntered = false; const beforeChildren = count(), beforeMetadata = metadata.length;
                const pending = call("reviewGitHistory"); await until(() => promptEntered);
                await config.update(FLAG, false, vscode.ConfigurationTarget.Global); await config.update(FLAG, true, vscode.ConfigurationTarget.Global);
                finishPrompt?.(heldAction); assert.equal((await pending).status, "UNAVAILABLE"); holdPrompt = false;
                assert.equal(count(), beforeChildren); assert.equal(metadata.length, beforeMetadata); clean();
            });
            await check("Owner disable prevents history children, analyzer-key writes, ledger changes and documents", async () => {
                await config.update(FLAG, false, vscode.ConfigurationTarget.Global); const before = JSON.stringify(context.globalState.get(STATE));
                const beforeChildren = count(), beforeStores = stores, beforeMetadata = metadata.length;
                assert.equal((await call("reviewGitHistory", { approved: true, enabled: true })).status, "UNAVAILABLE");
                assert.equal((await call("historyScannerStatus")).status, "UNAVAILABLE"); assert.equal(JSON.stringify(context.globalState.get(STATE)), before);
                assert.equal(count(), beforeChildren); assert.equal(stores, beforeStores); assert.equal(metadata.length, beforeMetadata); clean();
            });
            await check("Native machine scope rejects a repository override while owner disable remains effective", async () => {
                await assert.rejects(async () => config.update(FLAG, true, vscode.ConfigurationTarget.Workspace), { name: "CodeExpectedError" });
                assert.equal((await call("historyScannerStatus")).status, "UNAVAILABLE");
                assert.equal((await call("reviewGitHistory", { approved: true })).status, "UNAVAILABLE");
                await config.update(FLAG, true, vscode.ConfigurationTarget.Global); clean();
            });
            await check("Disable then reenable after native metadata document creation suppresses stale display", async () => {
                holdDocument = true; documentEntered = false; const beforeDisplay = displayed.length;
                const pending = call("reviewGitHistory"); await until(() => documentEntered);
                await config.update(FLAG, false, vscode.ConfigurationTarget.Global); await config.update(FLAG, true, vscode.ConfigurationTarget.Global);
                finishDocument?.(); assert.equal((await pending).status, "UNAVAILABLE"); holdDocument = false; assert.equal(displayed.length, beforeDisplay); await closed(); clean();
            });
            await check("Reenabled status preserves exact keyed restart metadata without history or vault mutation", async () => {
                assert.equal((await call("historyScannerStatus")).status, "OWNER_REVIEW_REQUIRED"); await closed(); clean(); assert(stores >= 1);
                const ledger = await call("openHygieneExposureLedger"); assert.equal(ledger.rows.length, 1);
                await fsp.writeFile(receipt, JSON.stringify({ ledger: context.globalState.get(STATE), repository: await repositoryBytes(), findingId: lastReview.findings[0].id, ledgerRowId: ledger.rows[0].id }) + "\n", { flag: "wx" });
            });
        } else {
            const prior = JSON.parse(await nativeRead(receipt, "utf8"));
            await check("Restart preserves keyed metadata and existing key without startup history, child, document or key writes", async () => {
                assert.equal(stores, 0); assert.equal(count(), 0); assert.equal(metadata.length, 0); assert.equal((await call("historyScannerStatus")).status, "OWNER_REVIEW_REQUIRED");
                assert.deepEqual(context.globalState.get(STATE), prior.ledger); assert.deepEqual(await repositoryBytes(), prior.repository); clean();
            });
            await check("Restart cancellation still requires native owner consent before fresh history authority", async () => {
                approve = false; assert.equal((await call("reviewGitHistory", { approved: true, findingId: prior.findingId })).status, "CANCELLED"); approve = true;
                assert.equal(count(), 0); assert.equal(stores, 0); assert.equal(metadata.length, 0); assert.deepEqual(context.globalState.get(STATE), prior.ledger); clean();
            });
            await check("Restart carries no stale current-file vault authority from historical findings", async () => {
                assert.equal((await call("reviewHygieneVault", prior.findingId, { approved: true })).status, "REVIEW_FILES_FIRST");
                const ledger = await call("openHygieneExposureLedger"); assert.equal(ledger.rows.length, 1); assert.equal(ledger.rows[0].id, prior.ledgerRowId);
                assert.equal(stores, 0); assert.deepEqual(await repositoryBytes(), prior.repository); clean();
            });
            await check("Fresh actual native restart review reestablishes one keyed historical finding without rewriting history or replacing its key", async () => {
                const value = await scan(); assert.equal(value.status, "ANALYZED"); assert.equal(value.commits, 4); assert.equal(value.files, 2);
                assert.equal(value.findings.length, 1); assert.equal(value.findings[0].id, prior.findingId); assert.equal(stores, 0); clean();
            });
        }
    } catch { driverFailure = "NativeHistoryDriverFailure"; }
    finally {
        try {
            finishPrompt?.(undefined); finishDocument?.(); holdPrompt = false; holdDocument = false;
            await config.update(FLAG, oldGlobal, vscode.ConfigurationTarget.Global);
            await closed(); clean();
            for (const document of new Set([...opened, ...displayed])) if (!document.isClosed && document.isUntitled) {
                await vscode.window.showTextDocument(document); await vscode.commands.executeCommand("workbench.action.revertAndCloseActiveEditor");
            }
        } catch { driverFailure = "NativeHistoryWithdrawalUnconfirmed"; }
        listeners.forEach(listener => listener.dispose()); for (const restore of restores.reverse()) restore();
    }
    const result = { schemaVersion: 1, phase, syntheticOnly: true, hostVersion: vscode.version, extensionBundleSha256: runtime,
        currentDeveloperBundleSha256: sha(await nativeRead(join(context.extensionUri.fsPath, "dist/extension.js"))), hostProbeSha256: sha(await nativeRead(__filename)),
        observations, passed: observations.filter(row => row.status === "PASS").length, failed: observations.filter(row => row.status === "FAIL").length,
        notRun: observations.filter(row => row.status === "NOT_RUN").length, sourceDocumentCalls: sourceCalls, sourceDocumentEvents: sourceEvents,
        directHistoryBodyReads: historyBodyReads, secretStorageStores: stores, vaultKeyStores: vaultStores, reviews, metadataDocuments: metadata.length,
        children, processSignalsRequested: children.reduce((sum, child) => sum + child.signalsRequested, 0), trace, driverFailure,
        independence: "LOW", ownerPresence: "SCRIPTED_NATIVE_API_DECISIONS_NOT_HUMAN_REVIEW",
        notTested: ["Human usability/accessibility", "Credential validity, provider rotation, actual AI access or remote copies",
            "History removal/rewrite and unreachable/reflog/message scanning", "Same-user unmanaged reads or independent uploads"] };
    noValues(result); await fsp.writeFile(output, JSON.stringify(result, null, 2) + "\n", { flag: "wx" });
    if (result.failed || driverFailure) throw Error("Native history scanner incomplete");
}
