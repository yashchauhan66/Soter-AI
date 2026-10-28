import assert from "node:assert/strict";
import { syncBuiltinESMExports } from "node:module";
import { mkdtemp, mkdir, writeFile, readFile, lstat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname, resolve, relative, isAbsolute, sep } from "node:path";
import { test } from "node:test";
import { prepareCheckedHookFile } from "../history-hooks/CheckedHookFile";
const before = Buffer.from("#!/bin/sh\n# synthetic original\nexit 7\n"), after = Buffer.from("#!/bin/sh\n# generated guard\nexit 0\n");
const owner = Buffer.from("#!/bin/sh\n# synthetic owner edit\nexit 9\n");

for (const ownerEdit of [false, true]) test("F26a hook stage foreign equal-byte inode survives " + (ownerEdit ? "failed target CAS cleanup" : "replacement adoption refusal"), { skip: process.platform !== "win32" }, async () => {
    const container = await mkdtemp(join(tmpdir(), "soter-f26a-hook-stage-")), root = join(container, "repo"), directory = join(root, ".git", "hooks"), file = join(directory, "pre-commit");
    await mkdir(directory, { recursive: true }); await writeFile(file, before, { flag: "wx" });
    const cap = prepareCheckedHookFile(root, ".git/hooks", () => true); assert.ok(cap);
    const expected = cap.read(); assert.ok(expected);
    const fs = require("node:fs"), originals = { openSync: fs.openSync, closeSync: fs.closeSync };
    let stage: string | undefined, held: number | undefined, swapped = false;
    const retained = join(directory, "retained-exclusively-created-stage");
    try {
        fs.openSync = (...args: any[]) => {
            const fd = Reflect.apply(originals.openSync, fs, args) as number;
            if (typeof args[0] === "string" && dirname(args[0]) === directory && args[0] !== file && args[1] === "wx") { stage = args[0]; held = fd; }
            return fd;
        };
        fs.closeSync = (fd: number) => {
            const value = originals.closeSync(fd);
            if (!swapped && fd === held && stage) {
                swapped = true; held = undefined;
                const rel = relative(resolve(container), resolve(stage));
                assert.ok(rel && !isAbsolute(rel) && rel !== ".." && !rel.startsWith(".." + sep), "Stage move stays in the exact synthetic container.");
                fs.renameSync(stage, retained); fs.writeFileSync(stage, after, { flag: "wx", mode: expected.mode });
                if (ownerEdit) fs.writeFileSync(file, owner);
            }
            return value;
        };
        syncBuiltinESMExports();
        assert.equal(cap.write(expected, after, expected.mode), false, "An equal-byte foreign inode cannot become the owned replacement.");
    } finally { fs.openSync = originals.openSync; fs.closeSync = originals.closeSync; syncBuiltinESMExports(); }
    assert.ok(swapped && stage, "Fixture must replace the actual exclusively created stage pathname.");
    assert.ok((await readFile(stage!)).equals(after), "Unknown foreign stage must survive cleanup unchanged.");
    assert.ok((await readFile(retained)).equals(after), "Originally created stage remains retained as separate evidence.");
    assert.notEqual((await lstat(stage!)).ino, (await lstat(retained)).ino, "Fixture must exercise distinct filesystem identities.");
    assert.ok((await readFile(file)).equals(ownerEdit ? owner : before), "The target owner state must remain exact.");
});
