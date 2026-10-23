import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

// Frozen constant-environment regression; no process or Git execution, no
// ambient profile/config read, and no cleanup of the retained synthetic root.
test("F10-GNE01 absent or hostile ambient extension lists become only fixed EXE classification", async () => {
    const { prepareCheckedGitMetadata } = await import("../terminal/CheckedGitMetadata");
    for (const PATHEXT of [undefined, ".COM;.EXE;.BAT;.CMD;.PS1;.VBS", "synthetic-invalid-extension-list"]) {
        const root = await mkdtemp(join(tmpdir(), "soter-f10-git-native-environment-"));
        await mkdir(join(root, ".git", "objects", "info"), { recursive: true });
        await mkdir(join(root, ".git", "objects", "pack"), { recursive: true });
        await mkdir(join(root, ".git", "refs", "heads"), { recursive: true });
        await writeFile(join(root, ".git", "config"), "[core]\n repositoryformatversion = 0\n bare = false\n", { flag: "wx" });
        await writeFile(join(root, ".git", "HEAD"), "ref: refs/heads/main\n", { flag: "wx" });
        const d = await prepareCheckedGitMetadata(root, { SystemRoot: process.env.SystemRoot, WINDIR: process.env.WINDIR,
            PATHEXT, PATH: "synthetic-ambient-search", NODE_OPTIONS: "synthetic-ambient-loader" }, () => true);
        assert.ok(d); assert.equal(d.environment.PATHEXT, ".EXE"); assert.equal(d.environment.PATH, undefined); assert.equal(d.environment.NODE_OPTIONS, undefined);
        assert.equal(d.available(), true);
    }
});
