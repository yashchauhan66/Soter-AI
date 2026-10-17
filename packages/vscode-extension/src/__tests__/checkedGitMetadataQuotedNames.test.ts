import assert from "node:assert/strict";
import { test } from "node:test";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { StreamingOutputRedactor } from "../../../core/src/StreamingOutputRedactor";

// Actual exact-runtime regressions frozen before the quotePath correction.
// Retained synthetic repositories only; no network/history, timeout or kill.
const GIT = "C:\\Program Files\\Git\\cmd\\git.exe";
const PS = "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe";
const REGISTERED = "\u79d8\u5bc6\u96ea\u306e\u5408\u6210\u767b\u9332\u5024";
const quotedBytes = (value: string) => [...Buffer.from(value, "utf8")].map(byte => "\\" + byte.toString(8).padStart(3, "0")).join("");
const options = { skip: process.platform !== "win32", timeout: 15000 };
async function finite(file: string, args: string[], cwd: string, env: NodeJS.ProcessEnv) {
    return new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve, reject) => {
        const child = spawn(file, args, { cwd, env, shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
        const out: Buffer[] = [], err: Buffer[] = []; let total = 0; child.once("error", reject);
        child.stdout!.on("data", bytes => { total += bytes.length; if (total <= 65536) out.push(Buffer.from(bytes)); });
        child.stderr!.on("data", bytes => { total += bytes.length; if (total <= 65536) err.push(Buffer.from(bytes)); });
        child.once("close", code => total > 65536 ? reject(new Error("Finite synthetic setup output exceeded bound."))
            : resolve({ code, stdout: Buffer.concat(out).toString("utf8"), stderr: Buffer.concat(err).toString("utf8") }));
    });
}
async function fixture(filename: string) {
    const root = await mkdtemp(join(tmpdir(), "soter-f10-git-quoted-name-")), job = await mkdtemp(join(tmpdir(), "soter-f10-git-quoted-setup-"));
    await mkdir(join(job, "empty-hooks")); await writeFile(join(job, "empty.gitconfig"), "", { flag: "wx" });
    const env: NodeJS.ProcessEnv = { SystemRoot: process.env.SystemRoot, WINDIR: process.env.WINDIR, COMSPEC: process.env.COMSPEC, PATHEXT: ".EXE",
        HOME: job, USERPROFILE: job, XDG_CONFIG_HOME: job, TEMP: job, TMP: job, GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_SYSTEM: join(job, "empty.gitconfig"), GIT_CONFIG_GLOBAL: join(job, "empty.gitconfig"),
        GIT_NO_LAZY_FETCH: "1", GIT_NO_REPLACE_OBJECTS: "1", GIT_OPTIONAL_LOCKS: "0", GIT_TERMINAL_PROMPT: "0", GIT_ATTR_NOSYSTEM: "1", GIT_PROTOCOL_FROM_USER: "0" };
    const prefix = ["--no-pager", "--no-lazy-fetch", "--no-replace-objects", "--no-optional-locks", "-c", "core.fsmonitor=false", "-c", "core.hooksPath=" + join(job, "empty-hooks"),
        "-c", "credential.helper=", "-c", "protocol.allow=never"];
    const git = async (...args: string[]) => { const value = await finite(GIT, [...prefix, ...args], root, env); assert.equal(value.code, 0); return value; };
    await git("init", "--initial-branch=main", "--object-format=sha1", "--template=" + join(job, "empty-hooks"));
    await writeFile(join(root, filename), "public synthetic contents\n", { flag: "wx" }); await git("add", "--", filename);
    const run = async (action: "status" | "diff-stat", registrations: readonly string[]) => {
        const { prepareCheckedGitMetadata } = await import("../terminal/CheckedGitMetadata"), { PowerShell51Worker } = await import("../terminal/PowerShell51Worker");
        const d = await prepareCheckedGitMetadata(root, env, () => true); assert.ok(d);
        const worker = new PowerShell51Worker({ id: randomUUID(), executable: PS, root, operation: { kind: "GIT", action }, git: d,
            parentEnvironment: env, enabled: () => true, output: new StreamingOutputRedactor(registrations) });
        assert.equal((await worker.start()).state, "RUNNING"); return worker.completion;
    };
    return { root, job, env, git, run };
}
for (const action of ["status", "diff-stat"] as const) {
    test(`F10-GQN01-${action} registered Unicode staged filename metadata is masked rather than C-octal disclosed`, options, async () => {
        const f = await fixture("synthetic-" + REGISTERED + ".txt");
        const control = await f.git("diff", "--cached", "--name-status", "--no-renames", "--no-ext-diff", "--no-textconv", "--ignore-submodules=all", "--");
        assert.ok(control.stdout.includes(quotedBytes(REGISTERED)), "Direct pinned Git control must exhibit its default octal representation.");
        const result = await f.run(action, [REGISTERED]); assert.equal(result.output.status, "COMPLETE"); assert.equal(result.output.redacted, true);
        assert.ok(result.output.stdout.includes("[REDACTED_SECRET_OUTPUT]")); assert.ok(!result.output.stdout.includes(REGISTERED));
        assert.ok(!result.output.stdout.includes(quotedBytes(REGISTERED))); assert.equal(result.output.stderr, "");
    });
}
test("F10-GQN02 public Unicode staged filename is preserved by fixed UTF8 metadata rendering", options, async () => {
    const filename = "public-\u96ea.txt", f = await fixture(filename), result = await f.run("status", []);
    assert.equal(result.output.status, "COMPLETE"); assert.equal(result.output.redacted, false); assert.ok(result.output.stdout.includes(filename));
    assert.ok(!result.output.stdout.includes(quotedBytes("\u96ea"))); assert.equal(result.output.stderr, "");
});
