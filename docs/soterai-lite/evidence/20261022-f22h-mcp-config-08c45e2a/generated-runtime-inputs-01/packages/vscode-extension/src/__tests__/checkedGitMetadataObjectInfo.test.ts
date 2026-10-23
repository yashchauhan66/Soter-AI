import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, mkdir, writeFile, symlink, link } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

// Frozen git-object-info-contract-01 regressions. Retain every synthetic input.
// No child process, Git operation, object-body read, or outside-target directory
// enumeration occurs in these fixtures. The prepare API alone is exercised.
async function repository() {
    const root = await mkdtemp(join(tmpdir(), "soter-f10-git-object-info-"));
    await mkdir(join(root, ".git", "objects", "info"), { recursive: true });
    await mkdir(join(root, ".git", "objects", "pack"), { recursive: true });
    await mkdir(join(root, ".git", "refs", "heads"), { recursive: true });
    await writeFile(join(root, ".git", "config"), "[core]\n repositoryformatversion = 0\n bare = false\n", { flag: "wx" });
    await writeFile(join(root, ".git", "HEAD"), "ref: refs/heads/main\n", { flag: "wx" });
    return root;
}
async function prepare(root: string) {
    return (await import("../terminal/CheckedGitMetadata")).prepareCheckedGitMetadata(root,
        { SystemRoot: process.env.SystemRoot, WINDIR: process.env.WINDIR }, () => true);
}
test("F10-GOI01 nonempty object-info commit-graph metadata refuses without reading its body", async () => {
    const root = await repository();
    await writeFile(join(root, ".git", "objects", "info", "commit-graph"), "synthetic uninterpreted graph metadata\n", { flag: "wx" });
    assert.equal(await prepare(root), undefined);
});
test("F10-GOI02 aliased object-info child namespace refuses without traversing target", { skip: process.platform !== "win32" }, async () => {
    const root = await repository(), outside = await mkdtemp(join(tmpdir(), "soter-f10-empty-graph-target-"));
    await symlink(outside, join(root, ".git", "objects", "info", "commit-graphs"), "junction");
    assert.equal(await prepare(root), undefined);
});
test("F10-GOI03 later object-info child creation revokes a captured descriptor", async () => {
    const root = await repository(), d = await prepare(root); assert.ok(d); assert.equal(d.available(), true);
    await writeFile(join(root, ".git", "objects", "info", "commit-graph"), "synthetic metadata\n", { flag: "wx" });
    assert.equal(d.available(), false);
});
test("F10-GOI04 empty canonical object-info remains admitted as the paired control", async () => {
    const root = await repository(), d = await prepare(root); assert.ok(d); assert.equal(d.available(), true);
});
test("F10-GOI05 hardlinked loose-object metadata refuses before Git execution", async () => {
    const root = await repository(), outside = await mkdtemp(join(tmpdir(), "soter-f10-synthetic-object-link-")), source = join(outside, "synthetic-object");
    await mkdir(join(root, ".git", "objects", "ab")); await writeFile(source, "synthetic uninterpreted object metadata\n", { flag: "wx" });
    await link(source, join(root, ".git", "objects", "ab", "c".repeat(38)));
    assert.equal(await prepare(root), undefined);
});
test("F10-GOI06 ordinary single-link loose-object metadata remains admitted", async () => {
    const root = await repository(); await mkdir(join(root, ".git", "objects", "de"));
    await writeFile(join(root, ".git", "objects", "de", "f".repeat(38)), "synthetic uninterpreted object metadata\n", { flag: "wx" });
    const d = await prepare(root); assert.ok(d); assert.equal(d.available(), true);
});
test("F10-GOI07 later extra hardlink revokes a captured loose-object descriptor", async () => {
    const root = await repository(), outside = await mkdtemp(join(tmpdir(), "soter-f10-synthetic-later-link-"));
    await mkdir(join(root, ".git", "objects", "12")); const source = join(root, ".git", "objects", "12", "3".repeat(38));
    await writeFile(source, "synthetic uninterpreted object metadata\n", { flag: "wx" });
    const d = await prepare(root); assert.ok(d); assert.equal(d.available(), true);
    await link(source, join(outside, "extra-synthetic-link")); assert.equal(d.available(), false);
});
