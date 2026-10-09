import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createSafeGit, gitCandidates, safeGitArguments, safeGitEnvironment, supportsDisabledFsmonitor } from "../security/SafeGit";
const execute = promisify(execFile);

test("safe Git accepts only versions with boolean fsmonitor support", () => {
    assert.equal(supportsDisabledFsmonitor("git version 2.35.1.windows.1"), false);
    assert.equal(supportsDisabledFsmonitor("git version 2.36.0.windows.1"), true);
    assert.equal(supportsDisabledFsmonitor("not Git"), false);
});

test("Git launch policy excludes ambient credentials and configuration inputs", () => {
    const job = path.resolve("synthetic-git-job");
    const env = safeGitEnvironment(job, { SystemRoot: "C:\\Windows", PATH: "untrusted", OPENAI_API_KEY: "fake", GIT_CONFIG_GLOBAL: "untrusted", GIT_CONFIG_PARAMETERS: "untrusted", GIT_EXEC_PATH: "untrusted", NODE_OPTIONS: "untrusted" });
    for (const name of ["PATH", "OPENAI_API_KEY", "GIT_CONFIG_PARAMETERS", "GIT_EXEC_PATH", "NODE_OPTIONS"]) assert.equal(env[name], undefined);
    assert.equal(env.GIT_CONFIG_GLOBAL, path.join(job, "empty.gitconfig"));
    assert.equal(env.GIT_CONFIG_NOSYSTEM, "1");
    assert.deepEqual(safeGitArguments(job, ["diff"]).slice(-7), ["-c", "core.fsmonitor=false", "-c", "credential.helper=", "-c", "commit.gpgSign=false", "diff"]);
    assert.ok(gitCandidates({ PATH: "untrusted" }, "win32").every(candidate => path.win32.isAbsolute(candidate)));
});

test("missing Git fails closed with a usable message", async () => {
    await assert.rejects(createSafeGit([]), /Install Git 2\.36 or newer.*no diff was shared/);
});

test("Windows Git global override uses an explicit empty file, with benign configuration controls", { skip: process.platform !== "win32" }, async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "soter-git-config-test-"));
    const git = await createSafeGit();
    try {
        const home = path.join(root, "synthetic-home"); await mkdir(home);
        const config = path.join(home, ".gitconfig");
        await writeFile(config, "[soterFixture]\n    marker = synthetic-only\n");
        const env = { ...git.env, HOME: home, USERPROFILE: home };
        const control = await execute(git.executable, ["config", "--file", config, "--get", "soterFixture.marker"], { cwd: root, env, windowsHide: true });
        assert.equal(control.stdout.trim(), "synthetic-only");
        const empty = await execute(git.executable, ["config", "--global", "--list"], { cwd: root, env, windowsHide: true });
        assert.equal(empty.stdout.trim(), "");
        const disabled = await git.run(root, ["config", "--get", "core.fsmonitor"]);
        assert.equal(disabled.stdout.trim(), "false");
        let nul: { exitCode: number; empty: boolean };
        try {
            const result = await execute(git.executable, ["config", "--global", "--list"], { cwd: root, env: { ...env, GIT_CONFIG_GLOBAL: "NUL" }, windowsHide: true });
            nul = { exitCode: 0, empty: result.stdout.trim() === "" };
        } catch (error) { nul = { exitCode: Number((error as { code?: number }).code ?? -1), empty: false }; }
        if (process.env.SOTERAI_TEST_RESULTS_DIR) {
            await mkdir(process.env.SOTERAI_TEST_RESULTS_DIR, { recursive: true });
            await writeFile(path.join(process.env.SOTERAI_TEST_RESULTS_DIR, "windows-git-config.json"), JSON.stringify({ classification: "PASS_CONFIG_TEST_ONLY", executable: git.executable,
                version: (await execute(git.executable, ["--version"], { cwd: root, env, windowsHide: true })).stdout.trim(), explicitEmptyFile: "PASS", nulObserved: nul, selectedMechanism: "explicit empty file; no reliance on NUL" }, null, 2), { flag: "wx" });
        }
    } finally { await git.dispose(); await rm(root, { recursive: true, force: true }); }
});
