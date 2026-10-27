import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { mkdir, mkdtemp, readFile, writeFile, readdir, link, symlink } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

async function api() { return import("../history-hooks/CheckedHistoryProfileFile"); }
async function fixture() {
    const root = await mkdtemp(join(tmpdir(), "soterai-f26c-file-")), parent = join(root, "WindowsPowerShell"); await mkdir(parent);
    return { root, parent, file: join(parent, "Microsoft.PowerShell_profile.ps1") };
}

test("F26c checked profile backend reads and CAS-creates only its fixed absent profile", async () => {
    const { CheckedHistoryProfileFile } = await api(), f = await fixture(), file = new CheckedHistoryProfileFile(f.root, f.file, () => true);
    const before = await file.snapshot(); assert.equal(before.content, undefined); assert.match(before.identity, /^[a-f0-9]{64}$/);
    await file.replace(before, Buffer.from("# synthetic created\n")); assert.equal((await readFile(f.file)).toString(), "# synthetic created\n");
    assert.equal((await file.snapshot()).identity, before.identity); assert.deepEqual(await readdir(f.parent), ["Microsoft.PowerShell_profile.ps1"]);
    assert.equal(JSON.stringify(file), "{}");
});

test("F26c checked profile backend replaces exact existing bytes and removes exact owned bytes", async () => {
    const { CheckedHistoryProfileFile } = await api(), f = await fixture(); await writeFile(f.file, "# before\r\n");
    const file = new CheckedHistoryProfileFile(f.root, f.file, () => true), before = await file.snapshot(); assert.equal(before.content!.toString(), "# before\r\n");
    await file.replace(before, Buffer.from("# after\n")); const after = await file.snapshot(); assert.equal(after.content!.toString(), "# after\n");
    await file.replace(after, undefined); assert.deepEqual(await readdir(f.parent), []);
});

test("F26c checked profile backend refuses stale snapshot and preserves independent edit", async () => {
    const { CheckedHistoryProfileFile } = await api(), f = await fixture(); await writeFile(f.file, "# initial");
    const file = new CheckedHistoryProfileFile(f.root, f.file, () => true), before = await file.snapshot(); await writeFile(f.file, "# independent");
    await assert.rejects(file.replace(before, Buffer.from("# should not write"))); assert.equal((await readFile(f.file)).toString(), "# independent");
});

test("F26c checked profile backend refuses file created after absent snapshot", async () => {
    const { CheckedHistoryProfileFile } = await api(), f = await fixture(), file = new CheckedHistoryProfileFile(f.root, f.file, () => true), before = await file.snapshot();
    await writeFile(f.file, "# independently created"); await assert.rejects(file.replace(before, Buffer.from("# no"))); assert.equal((await readFile(f.file)).toString(), "# independently created");
});

test("F26c checked profile backend withdrawal refuses reads and mutation", async () => {
    const { CheckedHistoryProfileFile } = await api(), f = await fixture(); await writeFile(f.file, "# retained"); let allowed = true;
    const file = new CheckedHistoryProfileFile(f.root, f.file, () => allowed), before = await file.snapshot(); allowed = false;
    await assert.rejects(file.snapshot()); await assert.rejects(file.replace(before, Buffer.from("# no"))); assert.equal((await readFile(f.file)).toString(), "# retained");
});

test("F26c checked profile backend refuses paths outside the fixed owner root", async () => {
    const { CheckedHistoryProfileFile } = await api(), f = await fixture(), other = await fixture(); await writeFile(other.file, "# outside synthetic");
    const file = new CheckedHistoryProfileFile(f.root, other.file, () => true); await assert.rejects(file.snapshot()); assert.equal((await readFile(other.file)).toString(), "# outside synthetic");
});

test("F26c checked profile backend refuses unsupported profile name and missing parent", async () => {
    const { CheckedHistoryProfileFile } = await api(), f = await fixture();
    for (const target of [join(f.parent, "Microsoft.VSCode_profile.ps1"), join(f.parent, "other.ps1"), join(f.root, "missing", "WindowsPowerShell", "Microsoft.PowerShell_profile.ps1")])
        await assert.rejects(new CheckedHistoryProfileFile(f.root, target, () => true).snapshot());
});

test("F26c checked profile backend refuses directory and oversized profile targets", async () => {
    const { CheckedHistoryProfileFile } = await api(), f = await fixture(); await mkdir(f.file); await assert.rejects(new CheckedHistoryProfileFile(f.root, f.file, () => true).snapshot());
    const large = await fixture(); await writeFile(large.file, Buffer.alloc(131073, 35)); await assert.rejects(new CheckedHistoryProfileFile(large.root, large.file, () => true).snapshot());
});

test("F26c checked profile backend refuses hardlinked profile before reading content", async () => {
    const { CheckedHistoryProfileFile } = await api(), f = await fixture(), other = join(f.root, "synthetic-link-source.ps1"); await writeFile(other, "# linked synthetic"); await link(other, f.file);
    await assert.rejects(new CheckedHistoryProfileFile(f.root, f.file, () => true).snapshot()); assert.equal((await readFile(other)).toString(), "# linked synthetic");
});

test("F26c checked profile backend refuses junction parent into another synthetic root", async () => {
    const { CheckedHistoryProfileFile } = await api(), other = await fixture(); await writeFile(other.file, "# synthetic outside junction");
    const root = await mkdtemp(join(tmpdir(), "soterai-f26c-junction-")), alias = join(root, "WindowsPowerShell"); await symlink(other.parent, alias, "junction");
    await assert.rejects(new CheckedHistoryProfileFile(root, join(alias, "Microsoft.PowerShell_profile.ps1"), () => true).snapshot()); assert.equal((await readFile(other.file)).toString(), "# synthetic outside junction");
});

test("F26c checked profile backend refuses foreign ownership snapshot", async () => {
    const { CheckedHistoryProfileFile } = await api(), f = await fixture(), file = new CheckedHistoryProfileFile(f.root, f.file, () => true), before = await file.snapshot();
    await assert.rejects(file.replace({ ...before, identity: "0".repeat(64) }, Buffer.from("# no"))); assert.deepEqual(await readdir(f.parent), []);
});

test("F26c checked profile backend refuses oversized or nonbuffer output before staging", async () => {
    const { CheckedHistoryProfileFile } = await api(), f = await fixture(), file = new CheckedHistoryProfileFile(f.root, f.file, () => true), before = await file.snapshot();
    await assert.rejects(file.replace(before, Buffer.alloc(131073, 35))); await assert.rejects(file.replace(before, "# no" as never)); assert.deepEqual(await readdir(f.parent), []);
});

test("F26c checked profile backend refuses same-inode staging tamper and retains foreign bytes", async () => {
    const { CheckedHistoryProfileFile } = await api(), f = await fixture(); await writeFile(f.file, "# original retained\n");
    const file = new CheckedHistoryProfileFile(f.root, f.file, () => true), before = await file.snapshot();
    const native = require("node:fs/promises") as typeof import("node:fs/promises"), originalOpen = native.open;
    mock.method(native, "open", async (...args: Parameters<typeof native.open>) => {
        const handle = await originalOpen(...args);
        if (args[1] === "wx" && String(args[0]).includes(".soterai-history-")) {
            const originalWrite = handle.writeFile.bind(handle);
            mock.method(handle, "writeFile", async (...writeArgs: Parameters<typeof handle.writeFile>) => {
                await originalWrite(...writeArgs); const bytes = writeArgs[0]; assert(Buffer.isBuffer(bytes));
                const foreign = Buffer.alloc(bytes.length, 88); await handle.write(foreign, 0, foreign.length, 0);
            });
        }
        return handle;
    });
    try { await assert.rejects(file.replace(before, Buffer.from("# desired owned bytes\n"))); } finally { mock.restoreAll(); }
    assert.equal((await readFile(f.file)).toString(), "# original retained\n");
    const stages = (await readdir(f.parent)).filter(name => name.startsWith(".soterai-history-")); assert.equal(stages.length, 1);
    const retained = await readFile(join(f.parent, stages[0])); assert(retained.equals(Buffer.alloc(retained.length, 88)));
});
