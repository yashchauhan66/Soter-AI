import assert from "node:assert/strict";
import { test } from "node:test";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, writeFile, appendFile, access } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { StreamingOutputRedactor } from "../../../core/src/StreamingOutputRedactor";

// Design06 exact-runtime gates. Every input/helper/repository/job is synthetic
// and retained. Setup waits for each finite process's actual close, never kills,
// never uses a network/remote operation, and never touches the real repo config.
const GIT = "C:\\Program Files\\Git\\cmd\\git.exe";
const PS = "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe";
const PREFIX = "Staged changes only; unstaged and untracked files are not inspected.\n";
const PRIVATE = "synthetic-f10-staged-private-Qx9-value";
const options = { skip: process.platform !== "win32", timeout: 20000 };
async function exists(file: string) { try { await access(file); return true; } catch { return false; } }
async function finite(file: string, args: string[], cwd: string, env: NodeJS.ProcessEnv): Promise<{ code: number | null; stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
        const child = spawn(file, args, { cwd, env, shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
        const channels = { stdout: [] as Buffer[], stderr: [] as Buffer[] }; let total = 0, overflow = false;
        child.once("error", reject);
        for (const channel of ["stdout", "stderr"] as const) child[channel]!.on("data", bytes => {
            total += bytes.length; if (total > 65536) overflow = true; if (!overflow) channels[channel].push(Buffer.from(bytes));
        });
        child.once("close", code => { if (overflow) reject(new Error("Synthetic setup output exceeded its retained bound."));
            else resolve({ code, stdout: Buffer.concat(channels.stdout).toString("utf8"), stderr: Buffer.concat(channels.stderr).toString("utf8") }); });
    });
}
async function fixture() {
    const root = await mkdtemp(join(tmpdir(), "soter-f10-git-actual-")), job = await mkdtemp(join(tmpdir(), "soter-f10-git-setup-"));
    await mkdir(join(job, "empty-hooks")); await writeFile(join(job, "empty.gitconfig"), "", { flag: "wx" });
    const env: NodeJS.ProcessEnv = { SystemRoot: process.env.SystemRoot, WINDIR: process.env.WINDIR, COMSPEC: process.env.COMSPEC,
        HOME: job, USERPROFILE: job, XDG_CONFIG_HOME: job, TEMP: job, TMP: job, GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_SYSTEM: join(job, "empty.gitconfig"),
        GIT_CONFIG_GLOBAL: join(job, "empty.gitconfig"), GIT_TERMINAL_PROMPT: "0", GIT_OPTIONAL_LOCKS: "0", GIT_NO_LAZY_FETCH: "1", GIT_NO_REPLACE_OBJECTS: "1", GIT_ATTR_NOSYSTEM: "1" };
    const prefix = ["--no-pager", "--no-lazy-fetch", "--no-replace-objects", "-c", "core.hooksPath=" + join(job, "empty-hooks"), "-c", "core.fsmonitor=false", "-c", "credential.helper=", "-c", "protocol.allow=never", "-c", "commit.gpgSign=false", "-c", "user.name=Synthetic F10", "-c", "user.email=synthetic-f10@example.invalid"];
    const git = async (...args: string[]) => { const result = await finite(GIT, [...prefix, ...args], root, env); assert.equal(result.code, 0, "Pinned synthetic Git setup failed."); return result; };
    await git("init", "--initial-branch=main", "--object-format=sha1", "--template=" + join(job, "empty-hooks"));
    await writeFile(join(root, "unstaged-only.txt"), "public committed baseline\n", { flag: "wx" });
    await git("add", "--", "unstaged-only.txt"); await git("commit", "-m", "synthetic finite baseline");
    await writeFile(join(root, "unstaged-only.txt"), "public changed but not staged\n");
    await writeFile(join(root, "untracked-only.txt"), "public never staged\n", { flag: "wx" });
    await writeFile(join(root, "staged-public.txt"), "public staged content never printed\n", { flag: "wx" }); await git("add", "--", "staged-public.txt");
    const run = async (action: "status" | "diff-stat", registrations: readonly string[] = [], enabled: () => boolean = () => true) => {
        const { prepareCheckedGitMetadata } = await import("../terminal/CheckedGitMetadata"), { PowerShell51Worker } = await import("../terminal/PowerShell51Worker");
        const descriptor = await prepareCheckedGitMetadata(root, { ...env, OPENAI_API_KEY: PRIVATE, PATH: "untrusted-search", NODE_OPTIONS: "untrusted-loader" }, enabled);
        assert.ok(descriptor, "Ordinary synthetic repository must admit the exact-runtime staged Git route.");
        const worker = new PowerShell51Worker({ id: randomUUID(), executable: PS, root, operation: { kind: "GIT", action }, git: descriptor,
            parentEnvironment: env, enabled, output: new StreamingOutputRedactor(registrations) });
        assert.equal((await worker.start()).state, "RUNNING"); return { worker, completion: worker.completion };
    };
    return { root, job, env, git, run };
}

test("F10-GA01 actual pinned Git version is the reviewed runtime", options, async () => {
    const f = await fixture(), result = await finite(GIT, ["--version"], f.job, f.env);
    assert.equal(result.code, 0); assert.match(result.stdout, /^git version 2\.53\.0\.windows\.1\r?\n$/); assert.equal(result.stderr, "");
});
test("F10-GA02 actual checked status returns staged names and excludes unstaged/untracked names and bodies", options, async () => {
    const f = await fixture(), run = await f.run("status"), result = await run.completion;
    assert.equal(result.snapshot.state, "EXITED"); assert.equal(result.snapshot.exitCode, 0); assert.equal(result.output.status, "COMPLETE");
    assert.ok(result.output.stdout.startsWith(PREFIX)); assert.match(result.output.stdout, /A\s+staged-public\.txt/);
    for (const omitted of ["unstaged-only.txt", "untracked-only.txt", "public staged content never printed", "public changed but not staged"]) assert.ok(!result.output.stdout.includes(omitted));
    assert.equal(result.output.stderr, "");
});
test("F10-GA03 actual checked diff-stat returns staged counts without source lines", options, async () => {
    const f = await fixture(), run = await f.run("diff-stat"), result = await run.completion;
    assert.equal(result.output.status, "COMPLETE"); assert.ok(result.output.stdout.startsWith(PREFIX)); assert.match(result.output.stdout, /staged-public\.txt/);
    assert.match(result.output.stdout, /1 file changed, 1 insertion\(\+\)/);
    for (const omitted of ["unstaged-only.txt", "untracked-only.txt", "public staged content never printed"]) assert.ok(!result.output.stdout.includes(omitted));
});
test("F10-GA04 actual registered filename metadata is masked by completed F08 output", options, async () => {
    const f = await fixture(); await writeFile(join(f.root, PRIVATE + ".txt"), "public synthetic file\n", { flag: "wx" }); await f.git("add", "--", PRIVATE + ".txt");
    const run = await f.run("status", [PRIVATE]), result = await run.completion;
    assert.equal(result.output.status, "COMPLETE"); assert.equal(result.output.redacted, true); assert.ok(!JSON.stringify(result).includes(PRIVATE)); assert.ok(result.output.stdout.includes("[REDACTED_SECRET_OUTPUT]"));
});
test("F10-GA05 exact cached status and statistics never invoke configured synthetic callbacks", options, async () => {
    const f = await fixture(), helper = join(f.job, "helper.ps1"), control = join(f.job, "marker-control.txt"), blocked = join(f.job, "marker-must-stay-absent.txt");
    await writeFile(helper, "param([string]$Marker)\n[IO.File]::WriteAllText($Marker,'synthetic callback invoked')\n[Console]::WriteLine('public helper control')\n", { flag: "wx" });
    const positive = await finite(PS, ["-NoLogo", "-NoProfile", "-NonInteractive", "-File", helper, control], f.job, f.env);
    assert.equal(positive.code, 0); assert.equal(await exists(control), true, "Positive control proves the marker helper can run.");
    // No quotes/backslashes in config values: this is intentionally within the
    // accepted finite config grammar and remains one inert helper definition.
    const command = PS.replace(/\\/g, "/") + " -NoLogo -NoProfile -NonInteractive -File " + helper.replace(/\\/g, "/") + " " + blocked.replace(/\\/g, "/");
    await writeFile(join(f.root, ".gitattributes"), "*.txt filter=synthetic diff=synthetic\n", { flag: "wx" }); await f.git("add", "--", ".gitattributes");
    await appendFile(join(f.root, ".git", "config"), "\n[core]\n\tfsmonitor = " + command + "\n\thooksPath = " + f.job.replace(/\\/g, "/") + "\n[filter \"synthetic\"]\n\tclean = " + command + "\n\tsmudge = " + command + "\n\tprocess = " + command + "\n\trequired = true\n[diff]\n\texternal = " + command + "\n[diff \"synthetic\"]\n\tcommand = " + command + "\n\ttextconv = " + command + "\n[credential]\n\thelper = " + command + "\n");
    for (const action of ["status", "diff-stat"] as const) {
        const run = await f.run(action), result = await run.completion; assert.equal(result.output.status, "COMPLETE"); assert.ok(result.output.stdout.startsWith(PREFIX));
        assert.equal(await exists(blocked), false, "Cached metadata must not execute a configured callback.");
    }
});
test("F10-GA06 unknown missing staged object withholds errors without lazy fetch or credential callback", options, async () => {
    const f = await fixture(); await f.git("update-index", "--add", "--cacheinfo", "100644," + "e".repeat(40) + ",missing-object.txt");
    const run = await f.run("diff-stat"), result = await run.completion; assert.equal(result.output.status, "WITHHELD"); assert.equal(result.output.stdout, ""); assert.equal(result.output.stderr, "");
});
test("F10-GA07 exact Git operation cancellation withholds and waits for natural worker close", options, async () => {
    const f = await fixture(), run = await f.run("diff-stat"); run.worker.cancel(); const result = await run.completion;
    assert.equal(result.snapshot.state, "CANCELLED"); assert.equal(result.output.status, "WITHHELD"); assert.equal(result.output.stdout, ""); assert.equal(result.output.stderr, "");
});
test("F10-GA08 flag withdrawal after actual spawn is sticky and releases no metadata", options, async () => {
    const f = await fixture(); let enabled = true; const run = await f.run("status", [], () => enabled); enabled = false; run.worker.cancel(); enabled = true;
    const result = await run.completion; assert.equal(result.output.status, "WITHHELD"); assert.equal(result.output.stdout, ""); assert.equal(result.output.stderr, "");
});
