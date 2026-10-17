import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, mkdir, writeFile, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Regression authored on review before the object-namespace fix. Synthetic
// empty targets only; never enumerate or read any aliased object body. No child
// or Git process is needed. Inputs and aliases are retained.
async function repository() {
    const root = await mkdtemp(join(tmpdir(), "soter-f10-git-alias-"));
    await mkdir(join(root, ".git", "objects", "info"), { recursive: true }); await mkdir(join(root, ".git", "objects", "pack"), { recursive: true });
    await mkdir(join(root, ".git", "refs", "heads"), { recursive: true });
    await writeFile(join(root, ".git", "config"), "[core]\n repositoryformatversion = 0\n bare = false\n", { flag: "wx" });
    await writeFile(join(root, ".git", "HEAD"), "ref: refs/heads/main\n", { flag: "wx" }); return root;
}
async function prepare(root: string) { return (await import("../terminal/CheckedGitMetadata")).prepareCheckedGitMetadata(root, { SystemRoot: process.env.SystemRoot, WINDIR: process.env.WINDIR }, () => true); }
test("F10-GR01 aliased loose-object namespace refuses before target enumeration or Git spawn", { skip: process.platform !== "win32" }, async () => {
    const root = await repository(), outside = await mkdtemp(join(tmpdir(), "soter-f10-git-empty-outside-"));
    await symlink(outside, join(root, ".git", "objects", "ab"), "junction");
    assert.equal(await prepare(root), undefined, "A loose-object namespace junction must not authorize Git to follow external objects.");
});
test("F10-GR02 new aliased loose-object namespace revokes an already prepared descriptor", { skip: process.platform !== "win32" }, async () => {
    const root = await repository(), d = await prepare(root); assert.ok(d);
    const outside = await mkdtemp(join(tmpdir(), "soter-f10-git-empty-outside-")); await symlink(outside, join(root, ".git", "objects", "cd"), "junction");
    assert.equal(d.available(), false);
});
test("F10-GR03 ordinary empty loose-object namespace is admitted as the paired control", async () => {
    const root = await repository(); await mkdir(join(root, ".git", "objects", "ef")); const d = await prepare(root); assert.ok(d); assert.equal(d.available(), true);
});
test("F10-GR04 unknown object namespace entry refuses without interpreting its filename as an object", async () => {
    const root = await repository(); await mkdir(join(root, ".git", "objects", "unknown-synthetic-namespace")); assert.equal(await prepare(root), undefined);
});
