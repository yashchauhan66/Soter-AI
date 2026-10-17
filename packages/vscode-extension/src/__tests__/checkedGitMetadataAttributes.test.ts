import assert from "node:assert/strict";
import { test } from "node:test";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, writeFile, access, symlink } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { StreamingOutputRedactor } from "../../../core/src/StreamingOutputRedactor";

// Design09 fixtures, authored before its corresponding production fix. No
// namespace aliases are followed or enumerated by these tests. Inputs retained.
const GIT = "C:\\Program Files\\Git\\cmd\\git.exe";
const PS = "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe";
const EMPTY_TREE = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";
async function exists(file: string) { try { await access(file); return true; } catch { return false; } }
async function repository() {
    const root = await mkdtemp(join(tmpdir(), "soter-f10-git-attributes-"));
    await mkdir(join(root, ".git", "objects", "info"), { recursive: true }); await mkdir(join(root, ".git", "objects", "pack"), { recursive: true });
    await mkdir(join(root, ".git", "refs", "heads"), { recursive: true });
    await writeFile(join(root, ".git", "config"), "[core]\n repositoryformatversion = 0\n bare = false\n", { flag: "wx" });
    await writeFile(join(root, ".git", "HEAD"), "ref: refs/heads/main\n", { flag: "wx" }); return root;
}
async function prepare(root: string) { return (await import("../terminal/CheckedGitMetadata")).prepareCheckedGitMetadata(root, { SystemRoot: process.env.SystemRoot, WINDIR: process.env.WINDIR }, () => true); }
test("F10-GAT01 repository-local info attributes refuse before any body read", async () => {
    const root = await repository(); await mkdir(join(root, ".git", "info")); await writeFile(join(root, ".git", "info", "attributes"), "*.txt -diff\n", { flag: "wx" });
    assert.equal(await prepare(root), undefined);
});
test("F10-GAT02 aliased info directory refuses before target child inspection", { skip: process.platform !== "win32" }, async () => {
    const root = await repository(), outside = await mkdtemp(join(tmpdir(), "soter-f10-git-empty-info-outside-"));
    await symlink(outside, join(root, ".git", "info"), "junction"); assert.equal(await prepare(root), undefined);
});
test("F10-GAT03 newly introduced info attributes revoke captured descriptor", async () => {
    const root = await repository(); await mkdir(join(root, ".git", "info")); const d = await prepare(root); assert.ok(d);
    await writeFile(join(root, ".git", "info", "attributes"), "*.txt -diff\n", { flag: "wx" }); assert.equal(d.available(), false);
});
test("F10-GAT04 ordinary empty canonical info directory remains admitted", async () => {
    const root = await repository(); await mkdir(join(root, ".git", "info")); const d = await prepare(root); assert.ok(d); assert.equal(d.available(), true);
});
async function finite(file: string, args: string[], cwd: string, env: NodeJS.ProcessEnv) {
    return new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve, reject) => {
        const child = spawn(file, args, { cwd, env, shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
        let total = 0; const out: Buffer[] = [], err: Buffer[] = []; child.once("error", reject);
        child.stdout!.on("data", bytes => { total += bytes.length; if (total <= 65536) out.push(Buffer.from(bytes)); });
        child.stderr!.on("data", bytes => { total += bytes.length; if (total <= 65536) err.push(Buffer.from(bytes)); });
        child.once("close", code => total > 65536 ? reject(new Error("Synthetic finite setup exceeded output bound."))
            : resolve({ code, stdout: Buffer.concat(out).toString("utf8"), stderr: Buffer.concat(err).toString("utf8") }));
    });
}
async function actual() {
    const root = await mkdtemp(join(tmpdir(), "soter-f10-git-attr-actual-")), job = await mkdtemp(join(tmpdir(), "soter-f10-git-attr-setup-"));
    await mkdir(join(job, "empty-hooks")); await writeFile(join(job, "empty.gitconfig"), "", { flag: "wx" });
    const env: NodeJS.ProcessEnv = { SystemRoot: process.env.SystemRoot, WINDIR: process.env.WINDIR, COMSPEC: process.env.COMSPEC,
        HOME: job, USERPROFILE: job, TEMP: job, TMP: job, XDG_CONFIG_HOME: job, GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_SYSTEM: join(job, "empty.gitconfig"), GIT_CONFIG_GLOBAL: join(job, "empty.gitconfig"),
        GIT_NO_LAZY_FETCH: "1", GIT_NO_REPLACE_OBJECTS: "1", GIT_OPTIONAL_LOCKS: "0", GIT_TERMINAL_PROMPT: "0", GIT_ATTR_NOSYSTEM: "1" };
    const prefix = ["--no-pager", "--no-lazy-fetch", "--no-replace-objects", "--no-optional-locks", "-c", "core.fsmonitor=false", "-c", "core.hooksPath=" + join(job, "empty-hooks"),
        "-c", "credential.helper=", "-c", "protocol.allow=never", "-c", "core.attributesFile=" + join(job, "empty.gitconfig")];
    const git = async (...args: string[]) => { const value = await finite(GIT, [...prefix, ...args], root, env); assert.equal(value.code, 0); return value; };
    await git("init", "--initial-branch=main", "--object-format=sha1", "--template=" + join(job, "empty-hooks"));
    await writeFile(join(root, "public.txt"), "first public line\nsecond public line\n", { flag: "wx" }); await git("add", "--", "public.txt");
    // Created AFTER staging, so this influences only worktree attribute lookup.
    await writeFile(join(root, ".gitattributes"), "*.txt -diff\n", { flag: "wx" }); return { root, job, env, git };
}
const actualOptions = { skip: process.platform !== "win32", timeout: 15000 };
test("F10-GAT05 actual pinned empty-tree attr source supports unborn stats without creating an object", actualOptions, async () => {
    const f = await actual(), object = join(f.root, ".git", "objects", EMPTY_TREE.slice(0, 2), EMPTY_TREE.slice(2)); assert.equal(await exists(object), false);
    const result = await f.git("--attr-source=" + EMPTY_TREE, "diff", "--cached", "--stat", "--no-renames", "--no-ext-diff", "--no-textconv", "--ignore-submodules=all", "--");
    assert.match(result.stdout, /1 file changed, 2 insertions\(\+\)/); assert.ok(!result.stdout.includes("Bin")); assert.equal(await exists(object), false);
});
test("F10-GAT06 actual checked stats ignore unstaged custom diff attributes in unborn repository", actualOptions, async () => {
    const f = await actual(), { prepareCheckedGitMetadata } = await import("../terminal/CheckedGitMetadata"), { PowerShell51Worker } = await import("../terminal/PowerShell51Worker");
    const d = await prepareCheckedGitMetadata(f.root, f.env, () => true); assert.ok(d);
    const worker = new PowerShell51Worker({ id: randomUUID(), executable: PS, root: f.root, operation: { kind: "GIT", action: "diff-stat" }, git: d,
        parentEnvironment: f.env, enabled: () => true, output: new StreamingOutputRedactor([]) });
    assert.equal((await worker.start()).state, "RUNNING"); const result = await worker.completion; assert.equal(result.output.status, "COMPLETE");
    assert.match(result.output.stdout, /1 file changed, 2 insertions\(\+\)/); assert.ok(!result.output.stdout.includes("Bin"));
    assert.ok(!result.output.stdout.includes("first public line")); assert.ok(!result.output.stdout.includes(".gitattributes"));
});
