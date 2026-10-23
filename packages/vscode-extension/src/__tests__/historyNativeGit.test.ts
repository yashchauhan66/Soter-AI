import assert from "node:assert/strict";
import { spawn, type ChildProcess, type SpawnOptions } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFile, mkdtemp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import type { Writable } from "node:stream";
import { test } from "node:test";
import { analyzeHygieneText, type HygieneInput } from "../hygiene/HygieneAnalysis";
import { prepareCheckedGitMetadata, type CheckedGitMetadata } from "../terminal/CheckedGitMetadata";
import { HistoryGitProcess, type HistoryGitOperation, type HistoryGitOutcome } from "../history/HistoryGitProcess";
import { scanGitHistory } from "../history/HistoryScanner";

// Actual pinned-Git controls. All repositories/jobs/data are newly created
// synthetic fixtures and retained. No existing repository history is read.
// Neither setup nor scanning supplies a timeout/AbortSignal, sends a process
// signal, destroys a pipe, deletes a fixture, or performs a remote operation.
const GIT = "C:\\Program Files\\Git\\cmd\\git.exe";
const PRIVATE = "TEST_ONLY_F23_NATIVE_PRIVATE_c71a6e90";
const KEY = Buffer.alloc(32, 23);
const options = { skip: process.platform !== "win32" };
const digest = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
interface Observation {
    phase: "setup" | "history"; executable: string; args: readonly string[]; cwd: string; pid?: number;
    code: number | null; signal: NodeJS.Signals | null; stdoutEOF: boolean; stderrEOF: boolean;
    stdoutBytes: number; stderrBytes: number; stdoutSha256: string; stderrSha256: string;
    stdin?: string; overflow: boolean; spawnFailed: boolean; signalsRequested: number;
}
interface Completion { observation: Observation; stdout: Buffer; stderr: Buffer }

function observe(child: ChildProcess, phase: Observation["phase"], args: readonly string[], cwd: string): Promise<Completion> {
    return new Promise(resolve => {
        const stdout: Buffer[] = [], stderr: Buffer[] = [], hashes = { stdout: createHash("sha256"), stderr: createHash("sha256") };
        const counts = { stdout: 0, stderr: 0 }, eof = { stdout: false, stderr: false };
        let closed = false, code: number | null = null, signal: NodeJS.Signals | null = null, overflow = false, spawnFailed = false;
        let input: string | undefined, resolved = false, signalsRequested = 0;
        child.kill = (() => { signalsRequested++; throw Error("Synthetic verification forbids process signals."); }) as typeof child.kill;
        if (phase === "history" && child.stdin) {
            const original = child.stdin.end;
            child.stdin.end = function (this: Writable, ...values: any[]) {
                const value = values[0];
                if (typeof value === "string" || Buffer.isBuffer(value)) input = Buffer.from(value).toString("utf8");
                return Reflect.apply(original, this, values);
            } as Writable["end"];
        }
        const finish = () => {
            if (resolved || !spawnFailed && (!closed || !eof.stdout || !eof.stderr)) return;
            resolved = true;
            resolve({ observation: { phase, executable: GIT, args: [...args], cwd, pid: child.pid, code, signal,
                stdoutEOF: eof.stdout, stderrEOF: eof.stderr, stdoutBytes: counts.stdout, stderrBytes: counts.stderr,
                stdoutSha256: hashes.stdout.digest("hex"), stderrSha256: hashes.stderr.digest("hex"),
                ...(input === undefined ? {} : { stdin: input }), overflow, spawnFailed, signalsRequested },
                stdout: Buffer.concat(stdout), stderr: Buffer.concat(stderr) });
        };
        child.once("error", () => { if (child.pid === undefined) { spawnFailed = true; finish(); } });
        child.once("close", (actualCode, actualSignal) => { closed = true; code = actualCode; signal = actualSignal; finish(); });
        for (const channel of ["stdout", "stderr"] as const) {
            const stream = child[channel]; assert.ok(stream);
            stream.on("data", (bytes: Buffer) => {
                counts[channel] += bytes.length; hashes[channel].update(bytes);
                if (counts.stdout + counts.stderr > (phase === "setup" ? 65536 : 1048576 + 128 * 96 + 8192)) overflow = true;
                if (phase === "setup" && !overflow) (channel === "stdout" ? stdout : stderr).push(Buffer.from(bytes));
            });
            stream.once("end", () => { eof[channel] = true; finish(); });
        }
    });
}

async function repositoryBytes(root: string) {
    const records: { path: string; bytes: number; sha256: string }[] = [];
    const walk = async (directory: string): Promise<void> => {
        for (const entry of await readdir(directory, { withFileTypes: true })) {
            assert.equal(entry.isSymbolicLink(), false);
            const file = join(directory, entry.name);
            if (entry.isDirectory()) await walk(file);
            else { assert(entry.isFile()); const bytes = await readFile(file); records.push({ path: relative(root, file).replaceAll("\\", "/"), bytes: bytes.length, sha256: digest(bytes) }); }
        }
    };
    await walk(root); return records.sort((a, b) => a.path.localeCompare(b.path));
}

function closedSuccess(record: Observation): void {
    assert.equal(record.code, 0); assert.equal(record.signal, null); assert.equal(record.spawnFailed, false);
    assert.equal(record.stdoutEOF, true); assert.equal(record.stderrEOF, true); assert.equal(record.overflow, false);
    assert.equal(record.signalsRequested, 0);
}
function valueFree(value: unknown): void {
    const text = JSON.stringify(value);
    for (const denied of [PRIVATE, "renamed-private.snapshot", "old-secret-side", "PUBLIC_HISTORY_NAME_CANARY"])
        assert(!text.includes(denied));
}
function suffix(operation: HistoryGitOperation): string[] {
    if (operation.kind === "version") return ["--version"];
    if (operation.kind === "commits") return ["rev-list", "--max-count=33", "--all", "--"];
    if (operation.kind === "tree") { assert.match(operation.oid, /^[a-f0-9]{40}$/); return ["ls-tree", "-r", "-z", "--full-tree", "--long", operation.oid, "--"]; }
    for (const object of operation.objects) assert.match(object.oid, /^[a-f0-9]{40}$/);
    return ["cat-file", "--batch"];
}

async function fixture() {
    const root = await mkdtemp(join(tmpdir(), "soter-f23-native-repo-")), job = await mkdtemp(join(tmpdir(), "soter-f23-native-setup-"));
    await mkdir(join(job, "empty-hooks")); await writeFile(join(job, "empty.gitconfig"), "", { flag: "wx" });
    const env: NodeJS.ProcessEnv = { SystemRoot: process.env.SystemRoot, WINDIR: process.env.WINDIR, COMSPEC: process.env.COMSPEC,
        HOME: job, USERPROFILE: job, XDG_CONFIG_HOME: job, TEMP: job, TMP: job, PATHEXT: ".EXE", GIT_CONFIG_NOSYSTEM: "1",
        GIT_CONFIG_SYSTEM: join(job, "empty.gitconfig"), GIT_CONFIG_GLOBAL: join(job, "empty.gitconfig"), GIT_ATTR_NOSYSTEM: "1",
        GIT_TERMINAL_PROMPT: "0", GIT_OPTIONAL_LOCKS: "0", GIT_NO_LAZY_FETCH: "1", GIT_NO_REPLACE_OBJECTS: "1", GIT_PROTOCOL_FROM_USER: "0" };
    const setupPrefix = ["--no-pager", "--literal-pathspecs", "--no-lazy-fetch", "--no-replace-objects", "--no-optional-locks",
        "-c", "core.hooksPath=" + join(job, "empty-hooks"), "-c", "core.fsmonitor=false", "-c", "credential.helper=", "-c", "protocol.allow=never",
        "-c", "core.autocrlf=false", "-c", "commit.gpgSign=false", "-c", "gc.auto=0", "-c", "maintenance.auto=false",
        "-c", "user.name=Synthetic F23", "-c", "user.email=synthetic-f23@example.invalid"];
    const observations: Observation[] = [], operations: HistoryGitOperation[] = [], analyses: HygieneInput[] = [];
    const setup = async (...args: string[]) => {
        const actual = [...setupPrefix, ...args], child = spawn(GIT, actual, { cwd: root, env, shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
        const complete = await observe(child, "setup", actual, root); observations.push(complete.observation);
        await writeFile(join(job, "setup-" + observations.length + ".stdout.txt"), complete.stdout, { flag: "wx" });
        await writeFile(join(job, "setup-" + observations.length + ".stderr.txt"), complete.stderr, { flag: "wx" });
        closedSuccess(complete.observation); return complete;
    };
    const version = await setup("--version"); assert.match(version.stdout.toString("utf8"), /^git version 2\.53\.0\.windows\.1\r?\n$/); assert.equal(version.stderr.length, 0);
    await setup("init", "--initial-branch=main", "--object-format=sha1", "--template=" + join(job, "empty-hooks"));
    const prepare = () => prepareCheckedGitMetadata(root, { ...env, PATH: PRIVATE, OPENAI_API_KEY: PRIVATE, GIT_CONFIG_COUNT: "1", GIT_CONFIG_KEY_0: PRIVATE,
        GIT_CONFIG_VALUE_0: PRIVATE, GIT_OBJECT_DIRECTORY: PRIVATE, GIT_ALTERNATE_OBJECT_DIRECTORIES: PRIVATE, NODE_OPTIONS: PRIVATE }, () => true);
    const owned = async (descriptor: CheckedGitMetadata, operation: HistoryGitOperation, deadline: number, withdrawAtSpawn = false) => {
        operations.push(operation); let closure: Promise<Completion> | undefined, worker: HistoryGitProcess;
        const trackedSpawn = ((file: string, args: readonly string[], settings: SpawnOptions) => {
            const prefix = ["--no-pager", "--literal-pathspecs", "-c", "core.hooksPath=" + join(descriptor.job, "empty-hooks"),
                "-c", "core.fsmonitor=false", "-c", "credential.helper=", "-c", "commit.gpgSign=false",
                "--no-lazy-fetch", "--no-replace-objects", "--no-optional-locks", "-c", "protocol.allow=never", "-c", "core.pager=", "-c", "color.ui=false",
                "-c", "core.attributesFile=" + join(descriptor.job, "empty.gitconfig"), "-c", "gc.auto=0", "-c", "maintenance.auto=false"];
            assert.equal(file, GIT); assert.deepEqual([...args], [...prefix, ...suffix(operation)]);
            assert.equal(settings.cwd, operation.kind === "version" ? descriptor.job : root);
            assert.equal(settings.shell, false); assert.equal(settings.windowsHide, true); assert.deepEqual(settings.env, descriptor.environment);
            for (const key of ["PATH", "OPENAI_API_KEY", "GIT_CONFIG_COUNT", "GIT_CONFIG_KEY_0", "GIT_CONFIG_VALUE_0", "GIT_OBJECT_DIRECTORY", "GIT_ALTERNATE_OBJECT_DIRECTORIES", "NODE_OPTIONS"])
                assert.equal(settings.env?.[key], undefined, key);
            assert.equal(settings.signal, undefined); assert.equal(settings.timeout, undefined); assert.equal(settings.killSignal, undefined);
            const child = spawn(file, args, settings); closure = observe(child, "history", args, String(settings.cwd));
            if (withdrawAtSpawn) child.once("spawn", () => worker.withdraw());
            return child;
        }) as typeof spawn;
        worker = new HistoryGitProcess({ root, descriptor, operation, valid: () => true, deadline, spawn: trackedSpawn });
        const outcome = await worker.start(); await worker.closed; assert.equal(worker.busy, false);
        assert.ok(closure, "The fixed owned operation must actually spawn.");
        const complete = await closure; observations.push(complete.observation); closedSuccess(complete.observation);
        assert.equal(complete.observation.stderrBytes, 0);
        if (operation.kind === "batch") assert.equal(complete.observation.stdin, operation.objects.map(object => object.oid).join("\n") + "\n");
        else assert.equal(complete.observation.stdin, undefined);
        return outcome;
    };
    let receiptNumber = 0;
    const receipt = async (details: unknown) => {
        const file = join(job, "actual-history-evidence-" + ++receiptNumber + ".json");
        await writeFile(file, JSON.stringify({ root, job, observations, operations, details,
            signalsRequested: observations.reduce((sum, record) => sum + record.signalsRequested, 0),
            scope: "Only this new retained synthetic repository; actual close and both EOFs are observed for every spawned child." }, null, 2) + "\n", { flag: "wx" });
    };
    const scan = async () => {
        const before = await repositoryBytes(root), descriptor = await prepare(); assert.ok(descriptor);
        const result = await scanGitHistory({ valid: () => true, deadline: performance.now() + 60000,
            run: (operation, deadline): Promise<HistoryGitOutcome> => owned(descriptor, operation, deadline),
            analyze: input => { analyses.push(input); return analyzeHygieneText(input, KEY); } });
        const after = await repositoryBytes(root); await receipt({ status: result.status, commits: result.commits, files: result.files,
            findings: result.findings.length, before, after, repositoryBytesUnchanged: JSON.stringify(before) === JSON.stringify(after) });
        assert.deepEqual(after, before, "History scanning must preserve every synthetic repository file byte.");
        assert.equal(descriptor.available(), true); valueFree(result); return result;
    };
    return { root, job, env, setup, prepare, owned, scan, observations, operations, analyses, receipt };
}

test("F23 actual pinned Git unborn repository is an empty useful analysis with observed process closure", options, async () => {
    const f = await fixture(), result = await f.scan();
    assert.equal(result.status, "ANALYZED"); assert.equal(result.commits, 0); assert.equal(result.files, 0); assert.deepEqual(result.findings, []);
    assert.deepEqual(f.operations.map(operation => operation.kind), ["version", "commits"]);
    assert.equal(f.observations.filter(record => record.phase === "history").length, 2);
});

test("F23 actual public history remains useful and repeated commits deduplicate blob IO without repository writes", options, async () => {
    const f = await fixture(); await writeFile(join(f.root, "public.txt"), "PORT=3000\nMODE=public\n", { flag: "wx" });
    await f.setup("add", "--", "public.txt"); await f.setup("commit", "-m", "PUBLIC_HISTORY_NAME_CANARY");
    await f.setup("commit", "--allow-empty", "-m", "second public commit");
    const result = await f.scan(); assert.equal(result.status, "ANALYZED"); assert.equal(result.commits, 2); assert.equal(result.files, 1); assert.deepEqual(result.findings, []);
    assert.equal(f.operations.filter(operation => operation.kind === "batch").length, 1);
    const batch = f.operations.find(operation => operation.kind === "batch"); assert.equal(batch?.kind, "batch"); if (batch?.kind === "batch") assert.equal(batch.objects.length, 1);
});

test("F23 actual .env committed then renamed and deleted is found once behind a clean public tip", options, async () => {
    const f = await fixture(); await writeFile(join(f.root, ".env"), "PASSWORD=" + PRIVATE + "\n", { flag: "wx" });
    await writeFile(join(f.root, "public.txt"), "PORT=3000\n", { flag: "wx" });
    await f.setup("add", "--", ".env", "public.txt"); await f.setup("commit", "-m", "synthetic initial " + PRIVATE);
    await f.setup("mv", "--", ".env", "renamed-private.snapshot"); await f.setup("commit", "-m", "synthetic rename");
    await f.setup("rm", "--", "renamed-private.snapshot"); await f.setup("commit", "-m", "synthetic deletion");
    const result = await f.scan(); assert.equal(result.status, "ANALYZED"); assert.equal(result.commits, 3); assert.equal(result.files, 2); assert.equal(result.findings.length, 1);
    assert.equal(f.analyses.filter(input => input.environment).length, 1);
    assert(f.analyses.some(input => input.environment && input.source.startsWith("history-v1/") && input.source.endsWith("/.env")));
    assert.deepEqual(result.findings[0].suggestions, ["rotation-checklist"]);
    assert(result.guidance.includes("never rewrites history")); assert(result.scope.includes("No commit messages"));
});

test("F23 actual reachable side-branch secret is scanned while the current main tree is public", options, async () => {
    const f = await fixture(); await writeFile(join(f.root, "public.txt"), "MODE=public\n", { flag: "wx" });
    await f.setup("add", "--", "public.txt"); await f.setup("commit", "-m", "public main");
    await f.setup("checkout", "-b", "old-secret-side"); await writeFile(join(f.root, ".env"), "TOKEN=" + PRIVATE + "\n", { flag: "wx" });
    await f.setup("add", "--", ".env"); await f.setup("commit", "-m", "synthetic side fixture"); await f.setup("checkout", "main");
    const result = await f.scan(); assert.equal(result.status, "ANALYZED"); assert.equal(result.commits, 2); assert.equal(result.files, 2); assert.equal(result.findings.length, 1);
    assert(f.observations.some(record => record.phase === "history" && record.args.includes("--all")));
});

test("F23 actual merge-parent history retains a deleted synthetic key without exposing messages or paths", options, async () => {
    const f = await fixture(); await writeFile(join(f.root, "public.txt"), "PORT=3000\n", { flag: "wx" });
    await f.setup("add", "--", "public.txt"); await f.setup("commit", "-m", "public baseline");
    await f.setup("checkout", "-b", "old-secret-side"); await writeFile(join(f.root, ".env"), "PASSWORD=" + PRIVATE + "\n", { flag: "wx" });
    await f.setup("add", "--", ".env"); await f.setup("commit", "-m", "synthetic feature"); await f.setup("checkout", "main");
    await writeFile(join(f.root, "public.txt"), "PORT=4000\n"); await f.setup("add", "--", "public.txt"); await f.setup("commit", "-m", "diverging public commit");
    await f.setup("merge", "--no-ff", "--no-edit", "-m", "synthetic explicit merge", "old-secret-side");
    await f.setup("rm", "--", ".env"); await f.setup("commit", "-m", "synthetic delete after merge");
    const result = await f.scan(); assert.equal(result.status, "ANALYZED"); assert.equal(result.commits, 5); assert.equal(result.files, 3); assert.equal(result.findings.length, 1);
});

test("F23 actual oversized and binary blobs produce explicit PARTIAL alongside an ordinary historical finding", options, async () => {
    const f = await fixture(); await writeFile(join(f.root, "large.txt"), Buffer.alloc(65537, 0x61), { flag: "wx" });
    await writeFile(join(f.root, "binary.bin"), Buffer.from([0, 1, 2, 255]), { flag: "wx" });
    await writeFile(join(f.root, "public.txt"), "PORT=3000\n", { flag: "wx" }); await writeFile(join(f.root, ".env"), "TOKEN=" + PRIVATE + "\n", { flag: "wx" });
    await f.setup("add", "--", "large.txt", "binary.bin", "public.txt", ".env"); await f.setup("commit", "-m", "bounded synthetic blobs");
    const result = await f.scan(); assert.equal(result.status, "PARTIAL"); assert.equal(result.commits, 1); assert.equal(result.files, 3); assert.equal(result.findings.length, 1);
    assert.equal(result.skipped.oversize, 1); assert.equal(result.skipped.binary, 1);
    const batch = f.operations.find(operation => operation.kind === "batch"); assert.equal(batch?.kind, "batch"); if (batch?.kind === "batch") assert(batch.objects.every(object => object.size <= 65536));
});

test("F23 actual synthetic repositories with include or alternate metadata refuse before history processes", options, async () => {
    for (const variant of ["include", "alternate"] as const) {
        const f = await fixture(), before = f.observations.length;
        if (variant === "include") await appendFile(join(f.root, ".git", "config"), "\n[include]\n path = " + join(f.job, "unsupported.gitconfig").replaceAll("\\", "/") + "\n");
        else { const outside = join(f.job, "synthetic-outside-objects"); await mkdir(outside); await writeFile(join(f.root, ".git", "objects", "info", "alternates"), outside + "\n", { flag: "wx" }); }
        assert.equal(await f.prepare(), undefined); assert.equal(f.observations.length, before); assert.deepEqual(f.operations, []);
        await f.receipt({ status: "UNAVAILABLE_BEFORE_HISTORY_PROCESS", variant });
    }
});

test("F23 actual owned Git withdrawal suppresses output and waits natural close plus bothEOF without signals", options, async () => {
    const f = await fixture(), descriptor = await f.prepare(); assert.ok(descriptor); const before = await repositoryBytes(f.root);
    const outcome = await f.owned(descriptor, { kind: "version" }, performance.now() + 60000, true);
    assert.deepEqual(outcome, { status: "STOP_UNCONFIRMED" }); valueFree(outcome);
    assert.deepEqual(await repositoryBytes(f.root), before); assert.equal(descriptor.available(), true);
    await f.receipt({ status: outcome.status, ownedChildNaturallyClosed: true });
});
