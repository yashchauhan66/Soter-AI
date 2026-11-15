import "./phase2/register.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, writeFile, readFile, readdir } from "node:fs/promises";
import { join, basename } from "node:path";
import { tmpdir } from "node:os";
import { ClineAdapter } from "../adapters/ClineAdapter";
test("F18 actual atomic config IO retains the original and removes its exact owned partial plaintext temporary", async t => {
    const root = await mkdtemp(join(tmpdir(), "soterai-f18-atomic-")), file = join(root, "providers.json");
    const before = '{"apiKey":"TEST_ONLY_F18_PREVIOUS_PRIVATE"}', after = '{"apiKey":"TEST_ONLY_F18_NEW_PRIVATE"}'; await writeFile(file, before);
    const adapter = new ClineAdapter({} as never, {} as never, { isEnabled: () => false } as never); t.after(() => adapter.dispose());
    const fsModule = require("node:fs/promises"), originalOpen = fsModule.open, originalStat = fsModule.lstat;
    const observations: unknown[] = [];
    t.mock.method(fsModule, "lstat", async (target: string, ...args: unknown[]) => {
        const stat = await Reflect.apply(originalStat, fsModule, [target, ...args]) as import("node:fs").Stats;
        if (basename(target).startsWith(".soterai-cline-")) observations.push({ stage: "path-stat", dev: stat.dev, ino: stat.ino, nlink: stat.nlink, size: stat.size, file: stat.isFile(), link: stat.isSymbolicLink() });
        return stat;
    });
    t.mock.method(fsModule, "open", async (target: string, ...args: unknown[]) => {
        const handle = await Reflect.apply(originalOpen, fsModule, [target, ...args]) as import("node:fs/promises").FileHandle;
        if (!basename(target).startsWith(".soterai-cline-")) return handle;
        return new Proxy(handle, { get(object, property) {
            if (property === "stat") return async () => { const stat = await object.stat(); observations.push({ stage: "handle-stat", dev: stat.dev, ino: stat.ino, nlink: stat.nlink, size: stat.size }); return stat; };
            if (property === "writeFile") return async () => { await object.writeFile(Buffer.from(after).subarray(0, 21)); throw Error("Synthetic partial write failure"); };
            const value = Reflect.get(object, property); return typeof value === "function" ? value.bind(object) : value;
        } });
    });
    await assert.rejects((adapter as any).write(file, after));
    assert.equal(await readFile(file, "utf8"), before);
    assert.equal((await readdir(root)).filter(name => name.startsWith(".soterai-cline-")).length, 0, "Owned partial cleanup metadata: " + JSON.stringify(observations));
});

test("Cline route metadata growth is detected with a capped handle read", async t => {
    const root = await mkdtemp(join(tmpdir(), "soterai-cline-read-growth-")), file = join(root, "providers.json"), initial = '{"public":true}';
    await writeFile(file, initial);
    const adapter = new ClineAdapter({} as never, {} as never, { isEnabled: () => false } as never); t.after(() => adapter.dispose());
    const fsModule = require("node:fs/promises"), originalOpen = fsModule.open, originalReadFile = fsModule.readFile;
    let unbounded = 0, readBytes = 0;
    t.mock.method(fsModule, "readFile", async (...args: unknown[]) => { unbounded++; return Reflect.apply(originalReadFile, fsModule, args); });
    t.mock.method(fsModule, "open", async (target: string, ...args: unknown[]) => {
        const handle = await Reflect.apply(originalOpen, fsModule, [target, ...args]) as import("node:fs/promises").FileHandle;
        return new Proxy(handle, { get(object, property) {
            if (property === "read") return async (buffer: Buffer, offset: number, length: number, position: number) => {
                assert.ok(buffer.length <= Buffer.byteLength(initial) + 1);
                await writeFile(file, "x".repeat(300000));
                const result = await object.read(buffer, offset, length, position); readBytes += result.bytesRead; return result;
            };
            const value = Reflect.get(object, property); return typeof value === "function" ? value.bind(object) : value;
        } });
    });
    await assert.rejects((adapter as any).read(file));
    assert.equal(unbounded, 0); assert.ok(readBytes > 0 && readBytes <= Buffer.byteLength(initial) + 1);
});
