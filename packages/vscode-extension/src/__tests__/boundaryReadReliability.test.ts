import { afterEach, beforeEach, mock, test } from "node:test";
import assert from "node:assert/strict";
import * as path from "node:path";
import * as os from "node:os";
import { readBoundaryFile } from "../ai-boundary/readFile";
import { installReadReliabilityOwner, ReadReliability } from "../security/ReadReliability";
const fs: typeof import("node:fs/promises") = require("node:fs/promises");
const originalOpen = fs.open;
let base: string, root: string, file: string;
const read = readBoundaryFile as (root: string, file: string, limit?: number, options?: { signal?: AbortSignal }) => Promise<string>;
beforeEach(async () => {
    base = await fs.mkdtemp(path.join(os.tmpdir(), "soterai-f28-read-"));
    root = path.join(base, "workspace"); file = path.join(root, "parent", "public.txt");
    await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, "public");
});
afterEach(async () => {
    mock.restoreAll();
    assert.equal(path.dirname(path.resolve(base)), path.resolve(os.tmpdir()));
    assert(path.basename(base).startsWith("soterai-f28-read-"));
    await fs.rm(base, { recursive: true, force: true });
});
test("F28-R01: ordinary exact-limit public file remains readable", async () => {
    assert.equal(await read(root, file, 6), "public");
});
test("F28-R02: replacement file between validated path and open is withheld", async () => {
    let changed = false;
    mock.method(fs, "open", async (...args: Parameters<typeof fs.open>) => {
        if (!changed && path.resolve(String(args[0])) === file) {
            changed = true; await fs.rename(file, file + ".old"); await fs.writeFile(file, "public");
        }
        return originalOpen(...args);
    });
    await assert.rejects(read(root, file)); assert(changed);
});
test("F28-R03: parent replacement between validation and open is withheld", async () => {
    let changed = false;
    mock.method(fs, "open", async (...args: Parameters<typeof fs.open>) => {
        if (!changed && path.resolve(String(args[0])) === file) {
            changed = true; const parent = path.dirname(file);
            await fs.rename(parent, parent + ".old"); await fs.mkdir(parent); await fs.writeFile(file, "public");
        }
        return originalOpen(...args);
    });
    await assert.rejects(read(root, file)); assert(changed);
});
test("F28-R04: same-length in-place content drift during read is withheld", async () => {
    let changed = false, closed = false;
    mock.method(fs, "open", async (...args: Parameters<typeof fs.open>) => {
        const handle = await originalOpen(...args), originalRead = handle.read.bind(handle), originalClose = handle.close.bind(handle);
        mock.method(handle, "read", async (...parameters: any[]) => {
            const result = await (originalRead as any)(...parameters);
            if (!changed && result.bytesRead) { changed = true; await fs.writeFile(file, "secret"); }
            return result;
        });
        mock.method(handle, "close", async () => { await originalClose(); closed = true; });
        return handle;
    });
    await assert.rejects(read(root, file)); assert(changed); assert(closed);
});
test("F28-R05: cancellation before I/O refuses without opening a handle", async () => {
    const controller = new AbortController(); controller.abort();
    const opened = mock.method(fs, "open", originalOpen);
    await assert.rejects(read(root, file, 64, { signal: controller.signal })); assert.equal(opened.mock.calls.length, 0);
});
test("F28-R06: cancellation while a handle is open withholds and observes its later close", { timeout: 2000 }, async () => {
    const controller = new AbortController(); let closed = false;
    let observedClose!: () => void;
    const closeObserved = new Promise<void>(resolve => { observedClose = resolve; });
    mock.method(fs, "open", async (...args: Parameters<typeof fs.open>) => {
        const handle = await originalOpen(...args), close = handle.close.bind(handle); controller.abort();
        mock.method(handle, "close", async () => { await close(); closed = true; observedClose(); }); return handle;
    });
    await assert.rejects(read(root, file, 64, { signal: controller.signal })); await closeObserved; assert(closed);
});
test("F28-R07: fractional byte limit is refused before open", async () => {
    await fs.writeFile(file, "a"); await assert.rejects(read(root, file, 2.5));
});
test("F28-R08: oversized allocation request cannot expand the fixed reader budget", async () => {
    await assert.rejects(read(root, file, 1024 * 1024 + 1));
});
test("F28-R09: another workspace root cannot borrow this root's path", async () => {
    const other = path.join(base, "workspace-copy"); await fs.mkdir(other); await fs.writeFile(path.join(other, "public.txt"), "public");
    await assert.rejects(read(root, path.join(other, "public.txt")));
    assert.equal(await read(other, path.join(other, "public.txt")), "public");
});
test("F28-R10: a multiple-hardlink input is withheld", async () => {
    await fs.link(file, file + ".hardlink"); await assert.rejects(read(root, file));
});
test("F28-R11: an internal directory junction is withheld", { skip: process.platform !== "win32" }, async () => {
    const junction = path.join(root, "linked"); await fs.symlink(path.dirname(file), junction, "junction");
    await assert.rejects(read(root, path.join(junction, "public.txt")));
});
test("F28-R12: malformed UTF-8 and binary inputs never produce a partial string", async () => {
    for (const bytes of [Buffer.from([0x61, 0xc0, 0xaf]), Buffer.from("a\0b")]) {
        await fs.writeFile(file, bytes); await assert.rejects(read(root, file));
    }
});
test("F28-R13: cancellation storm cannot refund slots while eight real opens are unfinished", { timeout: 5000 }, async () => {
    const owner = new ReadReliability({ enabled: () => true }); installReadReliabilityOwner(owner);
    let release!: () => void, openedAll!: () => void, closedAll!: () => void, opened = 0, closed = 0;
    const hold = new Promise<void>(resolve => { release = resolve; });
    const entered = new Promise<void>(resolve => { openedAll = resolve; });
    const exited = new Promise<void>(resolve => { closedAll = resolve; });
    mock.method(fs, "open", async (...args: Parameters<typeof fs.open>) => {
        const handle = await originalOpen(...args), close = handle.close.bind(handle); if (++opened === 8) openedAll();
        mock.method(handle, "close", async () => { await close(); if (++closed === 8) closedAll(); });
        await hold; return handle;
    });
    const controllers = Array.from({ length: 8 }, () => new AbortController());
    const requests = controllers.map(controller => read(root, file, 64, { signal: controller.signal }));
    const rejected = requests.map(promise => assert.rejects(promise));
    try {
        await entered; controllers.forEach(controller => controller.abort()); await Promise.all(rejected);
        assert.equal(owner.status().activeReads, 8); await assert.rejects(read(root, file)); assert.equal(opened, 8);
    } finally {
        release(); await exited; await new Promise<void>(done => setImmediate(done));
        assert.equal(closed, 8); assert.equal(owner.status().activeReads, 0); owner.dispose();
        installReadReliabilityOwner(new ReadReliability({ enabled: () => true }));
    }
});
test("F28-R14: a junction used as the workspace root is withheld", { skip: process.platform !== "win32" }, async () => {
    const alias = path.join(base, "workspace-alias"); await fs.symlink(root, alias, "junction");
    await assert.rejects(read(alias, path.join(alias, "parent", "public.txt")));
});
test("F28-R15: owner flag withdrawal during I/O withholds the buffered public bytes", async () => {
    let enabled = true;
    const owner = new ReadReliability({ enabled: () => enabled }); installReadReliabilityOwner(owner);
    mock.method(fs, "open", async (...args: Parameters<typeof fs.open>) => {
        const handle = await originalOpen(...args), originalRead = handle.read.bind(handle);
        mock.method(handle, "read", async (...parameters: any[]) => {
            const result = await (originalRead as any)(...parameters); enabled = false; return result;
        }); return handle;
    });
    try { await assert.rejects(read(root, file)); }
    finally { owner.dispose(); installReadReliabilityOwner(new ReadReliability({ enabled: () => true })); }
});
