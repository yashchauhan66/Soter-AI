import "./phase2/register.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import * as stub from "./phase2/vscode-stub";
async function fixture(t: import("node:test").TestContext) {
    const { CodexCliAdapter } = await import("../adapters/CodexCliAdapter");
    const root = await mkdtemp(join(tmpdir(), "soterai-f20a-delete-")), project = join(root, "project"), profile = join(root, "profile");
    await mkdir(project); await mkdir(profile); stub.resetState(project); const context = stub.makeExtensionContext(profile);
    const a = new CodexCliAdapter(context as never, { isEnabled: () => true } as never); t.after(() => a.dispose());
    t.mock.method(a as any, "artifact", async () => undefined); t.mock.method(a as any, "artifactCurrent", async () => true);
    t.mock.method(stub.window, "showWarningMessage", async (_m: string, _o: unknown, action: string) => action);
    const r = await a.configure() as any; assert.equal(r.status, "APPLIED"); const file = join(r.profileDirectory, "config.toml");
    return { a, file };
}
test("F20A-R11 config change after policy check but before writer must survive restore", async t => {
    const f = await fixture(t), actual = (f.a as any).write.bind(f.a); let injected = false;
    t.mock.method(f.a as any, "write", async (file: string, text: string | undefined, expected: string | undefined) => {
        if (!injected && file === f.file && text === undefined) { injected = true; await writeFile(file, (await readFile(file, "utf8")) + "\n# SYNTHETIC_UNOWNED_CONCURRENT_EDIT\n"); }
        return actual(file, text, expected);
    });
    assert.notEqual((await f.a.undo() as any).status, "RESTORED"); assert.equal(injected, true);
    assert.match(await readFile(f.file, "utf8"), /SYNTHETIC_UNOWNED_CONCURRENT_EDIT/);
});
test("F20A-R12 owned file removal rejects a mismatched expected current digest", async t => {
    const f = await fixture(t), before = await readFile(f.file, "utf8");
    await assert.rejects((f.a as any).write(f.file, undefined, "0".repeat(64)));
    assert.equal(await readFile(f.file, "utf8"), before);
});
