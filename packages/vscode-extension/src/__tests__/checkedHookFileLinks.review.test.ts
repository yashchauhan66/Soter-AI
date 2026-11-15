import assert from "node:assert/strict";
import { mkdtemp, mkdir, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { prepareCheckedHookFile } from "../history-hooks/CheckedHookFile";

test("F26a hook file dangling junction is unavailable rather than an absent writable leaf or parent", { skip: process.platform !== "win32" }, async () => {
    for (const leaf of [true, false]) {
        const container = await mkdtemp(join(tmpdir(), "soter-f26a-hook-dangling-")), root = join(container, "repo");
        await mkdir(join(root, ".git", "hooks"), { recursive: true });
        const missingTarget = join(container, "missing-target"), selected = join(root, ".git", "hooks", "pre-commit");
        if (leaf) await symlink(missingTarget, selected, "junction");
        else await symlink(missingTarget, join(root, "custom-hooks"), "junction");
        const cap = prepareCheckedHookFile(root, leaf ? ".git/hooks" : "custom-hooks", () => true);
        assert(cap === undefined || cap.read() === undefined, "A known dangling reparse point must not produce an absence snapshot or write authority.");
    }
});
