import "./phase2/register.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, writeFile, readFile, readdir } from "node:fs/promises";
import { join, basename } from "node:path";
import { tmpdir } from "node:os";
const adapterModule = () => import("../adapters/ClaudeAdapter");
test("F19-C07 actual atomic IO preserves old config and cleans only its owned partial temporary", async t => {
    const { ClaudeAdapter } = await adapterModule(), root = await mkdtemp(join(tmpdir(), "soterai-f19-atomic-")), file = join(root, "settings.json");
    const before = '{"env":{"ANTHROPIC_AUTH_TOKEN":"TEST_ONLY_OLD"}}', after = '{"env":{"ANTHROPIC_AUTH_TOKEN":"TEST_ONLY_NEW"}}'; await writeFile(file, before);
    const adapter = new ClaudeAdapter({} as never, {} as never, { isEnabled: () => false } as never); t.after(() => adapter.dispose());
    const fs = require("node:fs/promises"), original = fs.open;
    t.mock.method(fs, "open", async (target: string, ...args: unknown[]) => {
        const handle = await Reflect.apply(original, fs, [target, ...args]) as import("node:fs/promises").FileHandle;
        if (!basename(target).startsWith(".soterai-claude-")) return handle;
        return new Proxy(handle, { get(object, property) {
            if (property === "writeFile") return async () => { await object.writeFile(Buffer.from(after).subarray(0, 21)); throw Error("Synthetic partial write"); };
            const value = Reflect.get(object, property); return typeof value === "function" ? value.bind(object) : value;
        } });
    });
    await assert.rejects((adapter as any).write(file, after)); assert.equal(await readFile(file, "utf8"), before);
    assert.equal((await readdir(root)).filter(name => name.startsWith(".soterai-claude-")).length, 0);
});
