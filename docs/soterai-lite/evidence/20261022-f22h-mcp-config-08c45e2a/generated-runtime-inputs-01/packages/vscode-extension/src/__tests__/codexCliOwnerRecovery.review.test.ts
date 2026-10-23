import "./phase2/register.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import * as stub from "./phase2/vscode-stub";
async function fixture(t: import("node:test").TestContext) {
    const { CodexCliAdapter } = await import("../adapters/CodexCliAdapter");
    const root = await mkdtemp(join(tmpdir(), "soterai-f20a-recovery-")), workspace = join(root, "first"), profile = join(root, "profile");
    await mkdir(workspace); await mkdir(profile); stub.resetState(workspace); const context = stub.makeExtensionContext(profile);
    const adapter = new CodexCliAdapter(context as never, { isEnabled: () => true } as never); t.after(() => adapter.dispose());
    t.mock.method(adapter as any, "artifact", async () => undefined); t.mock.method(adapter as any, "artifactCurrent", async () => true);
    t.mock.method(stub.window, "showWarningMessage", async (_m: string, _o: unknown, action: string) => action);
    return { root, workspace, context, adapter };
}
test("F20A-R02 retained restored receipt cannot block setup for a different project", async t => {
    const f = await fixture(t); assert.equal((await f.adapter.configure() as any).status, "APPLIED"); assert.equal((await f.adapter.undo() as any).status, "RESTORED");
    const second = join(f.root, "second"); await mkdir(second); stub.resetState(second);
    assert.equal((await f.adapter.configure() as any).status, "APPLIED");
});
test("F20A-R03 restart has no implicit live route, keeps receipt and allows reviewed restore", async t => {
    const f = await fixture(t), r = await f.adapter.configure() as any; assert.equal(r.status, "APPLIED"); f.adapter.dispose();
    const { CodexCliAdapter } = await import("../adapters/CodexCliAdapter"), next = new CodexCliAdapter(f.context as never, { isEnabled: () => true } as never);
    t.after(() => next.dispose()); assert.equal((next.status() as any).status, "UNAVAILABLE");
    assert.equal((await next.configure() as any).status, "RESTORE_PREVIOUS_CODEX_PROFILE_FIRST");
    assert.equal((await next.undo() as any).status, "RESTORED");
});
test("F20A-R04 workspace drift during review creates no native config", async t => {
    const f = await fixture(t), second = join(f.root, "second"); await mkdir(second);
    t.mock.method(stub.window, "showWarningMessage", async (_m: string, _o: unknown, action: string) => { stub.resetState(second); return action; });
    assert.notEqual((await f.adapter.configure() as any).status, "APPLIED");
});
test("F20A-R05 storage inside project is refused", async t => {
    const f = await fixture(t); (f.context as any).globalStorageUri = stub.Uri.file(join(f.workspace, "owned-looking-storage"));
    assert.equal((await f.adapter.configure() as any).status, "UNAVAILABLE");
});
test("F20A-R06 forged saved profile path cannot delete another local file", async t => {
    const f = await fixture(t), r = await f.adapter.configure() as any; assert.equal(r.status, "APPLIED");
    const external = join(f.root, "unowned"); await mkdir(external); await writeFile(join(external, "config.toml"), "SYNTHETIC_KEEP");
    const key = "soterai.lite.codexCliAdapter.receipt.v1", saved = f.context.globalState.get<any>(key);
    await f.context.globalState.update(key, { ...saved, profileDirectory: external });
    assert.equal((await f.adapter.undo() as any).status, "UNAVAILABLE"); assert.equal(await readFile(join(external, "config.toml"), "utf8"), "SYNTHETIC_KEEP");
});
