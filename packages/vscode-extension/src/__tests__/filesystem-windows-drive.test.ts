import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile, rm, realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { verifyExistingPath } from "../security/FileSystemPathPolicy";

test("VS Code lowercase Windows drive letters preserve legitimate file access", { skip: process.platform !== "win32" }, async () => {
    const root = await mkdtemp(path.join(tmpdir(), "soterai-drive-synthetic-"));
    try {
        const file = path.join(root, "public.txt");
        await writeFile(file, "Public control.");
        const vscodeRoot = root.replace(/^[A-Z]:/, drive => drive.toLowerCase());
        const vscodeFile = file.replace(/^[A-Z]:/, drive => drive.toLowerCase());
        assert.equal(await verifyExistingPath(vscodeRoot, vscodeFile), await realpath(file));
    } finally {
        const target = path.resolve(root);
        assert.equal(path.dirname(target), path.resolve(tmpdir()));
        assert.ok(path.basename(target).startsWith("soterai-drive-synthetic-"));
        await rm(target, { recursive: true, force: true });
    }
});
