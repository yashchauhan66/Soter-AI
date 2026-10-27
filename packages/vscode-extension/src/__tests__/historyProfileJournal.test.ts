import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import { mkdir, mkdtemp, readFile, readdir, writeFile, link, symlink, rename } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { HistoryProfileReceipt } from "../history-hooks/HistoryProfileTransaction";

afterEach(() => mock.restoreAll());
const row: HistoryProfileReceipt = Object.freeze({ schemaVersion: 1, generation: "716a88c1-7a95-4b61-9122-5519cfbc83b6", identity: "a".repeat(64), phase: "PREPARED", existed: true,
    beforeDigest: "b".repeat(64), afterDigest: "c".repeat(64), backupHandle: "d".repeat(32) });
const canonical = (value: unknown) => JSON.stringify(value) + "\n";
async function fixture() {
    const api = await import("../history-hooks/HistoryProfileJournal"), parent = await mkdtemp(join(tmpdir(), "soterai-f26c-journal-")), root = join(parent, "private-storage");
    return { ...api, parent, root, file: join(root, api.HISTORY_PROFILE_JOURNAL), journal: new api.HistoryProfileJournal(root) };
}

test("F26c private journal constructor and absent read do not create storage", async () => {
    const f = await fixture(); assert.equal(f.journal.read(), undefined); assert.deepEqual(await readdir(f.parent), []); assert.equal(JSON.stringify(f.journal), "{}");
});
test("F26c private journal durably transitions and new instance reads exact metadata", async () => {
    const f = await fixture(); assert.equal(f.journal.read(), undefined); await f.journal.write(row, () => true);
    assert.equal((await readFile(f.file)).toString(), canonical(row)); assert.deepEqual(f.journal.read(), row);
    const applied = { ...row, phase: "APPLIED" as const }; await f.journal.write(applied, () => true);
    assert.deepEqual(new f.HistoryProfileJournal(f.root).read(), applied); assert.deepEqual(await readdir(f.root), [f.HISTORY_PROFILE_JOURNAL]);
});
test("F26c private journal exact authorized clear preserves other private files", async () => {
    const f = await fixture(); f.journal.read(); await f.journal.write(row, () => true); await writeFile(join(f.root, "retained.txt"), "synthetic unrelated");
    f.journal.read(); await f.journal.write(undefined, () => true); assert.equal(f.journal.read(), undefined); assert.deepEqual(await readdir(f.root), ["retained.txt"]);
});
test("F26c private journal requires prior read and refuses unknown authority", async () => {
    const f = await fixture(); await assert.rejects(f.journal.write(row, () => true)); f.journal.read();
    await assert.rejects(f.journal.write(row, () => false)); await assert.rejects(f.journal.write(row, () => { throw Error("FAKE_PRIVATE_PATH"); })); assert.deepEqual(await readdir(f.parent), []);
});
test("F26c private journal refuses stale cross-instance write and clear", async () => {
    const f = await fixture(); f.journal.read(); await f.journal.write(row, () => true); const other = new f.HistoryProfileJournal(f.root); other.read(); f.journal.read();
    await other.write({ ...row, phase: "APPLIED" }, () => true); await assert.rejects(f.journal.write(row, () => true)); await assert.rejects(f.journal.write(undefined, () => true));
    assert.equal(JSON.parse((await readFile(f.file)).toString()).phase, "APPLIED");
});
test("F26c private journal refuses malformed schema without storing raw fields", async () => {
    const f = await fixture(); f.journal.read();
    for (const value of [{ ...row, unexpected: "FAKE_ONLY_JOURNAL_VALUE" }, { ...row, phase: "UNKNOWN" }, {}, null]) await assert.rejects(f.journal.write(value as never, () => true));
    assert.deepEqual(await readdir(f.parent), []);
});
test("F26c private journal refuses duplicate keys BOM trailing garbage and noncanonical JSON", async () => {
    const f = await fixture(); await mkdir(f.root);
    for (const text of [canonical(row).replace('"schemaVersion":1', '"schemaVersion":2,"schemaVersion":1'), "\ufeff" + canonical(row), canonical(row) + "x", JSON.stringify(row, null, 2), "{}\n"]) {
        await writeFile(f.file, text); assert.throws(() => f.journal.read(), /^Error: History journal unavailable\.$/); assert.equal((await readFile(f.file)).toString(), text);
    }
});
test("F26c private journal rejects oversized invalid UTF8 and directory targets", async () => {
    const f = await fixture(); await mkdir(f.root); await writeFile(f.file, Buffer.alloc(8193, 32)); assert.throws(() => f.journal.read());
    await writeFile(f.file, Buffer.from([0xff])); assert.throws(() => f.journal.read()); await rename(f.file, join(f.root, "invalid-retained")); await mkdir(f.file); assert.throws(() => f.journal.read());
});
test("F26c private journal refuses hardlink target preserving its source", async () => {
    const f = await fixture(); await mkdir(f.root); const source = join(f.parent, "source.json"); await writeFile(source, canonical(row)); await link(source, f.file);
    assert.throws(() => f.journal.read()); await assert.rejects(f.journal.write(row, () => true)); assert.equal((await readFile(source)).toString(), canonical(row));
});
test("F26c private journal refuses junction root and junction ancestor", async () => {
    const f = await fixture(), outside = await mkdtemp(join(tmpdir(), "soterai-f26c-journal-outside-")); await symlink(outside, f.root, "junction");
    assert.throws(() => f.journal.read()); const nested = new f.HistoryProfileJournal(join(f.root, "nested")); assert.throws(() => nested.read());
    await assert.rejects(nested.write(row, () => true)); assert.deepEqual(await readdir(outside), []);
});
test("F26c private journal binds root identity and refuses directory replacement", async () => {
    const f = await fixture(); await mkdir(f.root); assert.equal(f.journal.read(), undefined); await rename(f.root, join(f.parent, "retained-root")); await mkdir(f.root);
    assert.throws(() => f.journal.read()); await assert.rejects(f.journal.write(row, () => true)); assert.deepEqual(await readdir(f.root), []);
});
test("F26c private journal rejects relative roots without creating anything", async () => {
    const { HistoryProfileJournal } = await import("../history-hooks/HistoryProfileJournal"); const journal = new HistoryProfileJournal("relative-private-root");
    assert.throws(() => journal.read()); await assert.rejects(journal.write(row, () => true));
});
test("F26c private journal withdrawal during stage write preserves original metadata", async () => {
    const f = await fixture(); f.journal.read(); await f.journal.write(row, () => true); f.journal.read(); let allowed = true;
    const native = require("node:fs/promises") as typeof import("node:fs/promises"), originalOpen = native.open;
    mock.method(native, "open", async (...args: Parameters<typeof native.open>) => { const fd = await originalOpen(...args);
        if (args[1] === "wx") { const write = fd.writeFile.bind(fd); mock.method(fd, "writeFile", async (...values: Parameters<typeof fd.writeFile>) => { await write(...values); allowed = false; }); } return fd; });
    await assert.rejects(f.journal.write({ ...row, phase: "APPLIED" }, () => allowed)); assert.equal((await readFile(f.file)).toString(), canonical(row)); assert.deepEqual(await readdir(f.root), [f.HISTORY_PROFILE_JOURNAL]);
});
test("F26c private journal preserves foreign same-inode stage tampering", async () => {
    const f = await fixture(); f.journal.read(); await f.journal.write(row, () => true); f.journal.read();
    const native = require("node:fs/promises") as typeof import("node:fs/promises"), originalOpen = native.open;
    mock.method(native, "open", async (...args: Parameters<typeof native.open>) => { const fd = await originalOpen(...args);
        if (args[1] === "wx") { const write = fd.writeFile.bind(fd); mock.method(fd, "writeFile", async (...values: Parameters<typeof fd.writeFile>) => { await write(...values); const bytes = values[0]; assert(Buffer.isBuffer(bytes)); await fd.write(Buffer.alloc(bytes.length, 88), 0, bytes.length, 0); }); } return fd; });
    await assert.rejects(f.journal.write({ ...row, phase: "APPLIED" }, () => true)); assert.equal((await readFile(f.file)).toString(), canonical(row));
    const stages = (await readdir(f.root)).filter(name => name.endsWith(".tmp")); assert.equal(stages.length, 1); const retained = await readFile(join(f.root, stages[0])); assert(retained.equals(Buffer.alloc(retained.length, 88)));
});
test("F26c private journal single writer refuses overlapping mutation", async () => {
    const f = await fixture(); f.journal.read(); const first = f.journal.write(row, () => true); await assert.rejects(f.journal.write(row, () => true)); await first; assert.deepEqual(f.journal.read(), row);
});
