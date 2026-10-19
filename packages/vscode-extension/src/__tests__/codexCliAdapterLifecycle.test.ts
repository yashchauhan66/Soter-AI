import "./phase2/register.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import * as stub from "./phase2/vscode-stub";
const load = () => import("../adapters/CodexCliAdapter");
async function fixture(t: import("node:test").TestContext) {
    const { CodexCliAdapter } = await load(); const root = await mkdtemp(join(tmpdir(), "soterai-f20a-owner-")), workspace = join(root, "project"), profile = join(root, "profile");
    await mkdir(workspace); await mkdir(profile); stub.resetState(workspace); const context = stub.makeExtensionContext(profile); let reads = 0;
    const adapter = new CodexCliAdapter(context as never, { isEnabled: () => true, readIntegration: async () => { reads++; return { status: "ALLOWED_ONCE", kind: "environment-schema", text: "KEY=[MASKED]" }; } } as never);
    t.after(() => adapter.dispose()); t.mock.method(adapter as any, "artifact", async () => undefined); t.mock.method(adapter as any, "artifactCurrent", async () => true);
    return { root, workspace, profile, context, adapter, reads: () => reads };
}
test("F20A-C01 constructor/status never read native config or launch a process", async t => {
    const { CodexCliAdapter } = await load(); const a = new CodexCliAdapter({} as never, { isEnabled: () => false } as never); t.after(() => a.dispose());
    assert.equal((a.status() as any).badge, "Uncovered"); assert.match(JSON.stringify(a.status()), /unmediated/i);
});
test("F20A-C02 cancel leaves native configuration absent and grants no read", async t => {
    const f = await fixture(t); t.mock.method(stub.window, "showWarningMessage", async () => undefined);
    assert.equal((await f.adapter.configure() as any).status, "CANCELLED"); assert.equal(f.reads(), 0);
    const names = await readdir(join(f.context.globalStorageUri.fsPath, "adapter-sessions")); assert.ok(names.length <= 1);
});
test("F20A-C03 reviewed setup/restore own one dedicated config with encrypted recovery", async t => {
    const f = await fixture(t); t.mock.method(stub.window, "showWarningMessage", async (_m: string, _o: unknown, action: string) => action);
    const r = await f.adapter.configure() as any; assert.equal(r.status, "APPLIED"); assert.equal(r.badge, "Uncovered"); assert.equal(f.reads(), 0);
    const config = await readFile(join(r.profileDirectory, "config.toml"), "utf8"); assert.match(config, /shell_tool = false/);
    const recovery = await readFile(join(r.profileDirectory, "recovery.json"), "utf8"); const token = config.match(/Bearer ([a-f0-9]{64})/)![1]; assert.equal(recovery.includes(token), false);
    const backups = await readdir(join(f.context.globalStorageUri.fsPath, "config-backups")); assert.equal(backups.length, 1);
    await writeFile(join(r.profileDirectory, "public-native-state.txt"), "keep");
    assert.equal((await f.adapter.undo() as any).status, "RESTORED"); await assert.rejects(readFile(join(r.profileDirectory, "config.toml")), { code: "ENOENT" });
    assert.equal(await readFile(join(r.profileDirectory, "public-native-state.txt"), "utf8"), "keep");
});
test("F20A-C04 prior receipt blocks duplicate setup", async t => {
    const f = await fixture(t); t.mock.method(stub.window, "showWarningMessage", async (_m: string, _o: unknown, action: string) => action);
    assert.equal((await f.adapter.configure() as any).status, "APPLIED"); assert.equal((await f.adapter.configure() as any).status, "RESTORE_PREVIOUS_CODEX_PROFILE_FIRST");
});
test("F20A-C05 project override refuses before creating profile", async t => {
    const f = await fixture(t); await mkdir(join(f.workspace, ".codex"));
    assert.equal((await f.adapter.configure() as any).status, "PROJECT_CODEX_OVERRIDE_REQUIRES_REVIEW"); assert.equal(f.reads(), 0);
});
test("F20A-C06 durable recovery write failure creates no vendor config", async t => {
    const f = await fixture(t); t.mock.method(stub.window, "showWarningMessage", async (_m: string, _o: unknown, action: string) => action);
    const write = (f.adapter as any).write.bind(f.adapter);
    t.mock.method(f.adapter as any, "write", async (file: string, text: string | undefined) => { if (file.endsWith("recovery.json")) throw Error("synthetic"); return write(file, text); });
    assert.equal((await f.adapter.configure() as any).status, "UNAVAILABLE");
    for (const name of await readdir(join(f.context.globalStorageUri.fsPath, "adapter-sessions"))) if (name.startsWith("codex-cli-")) await assert.rejects(readFile(join(f.context.globalStorageUri.fsPath, "adapter-sessions", name, "config.toml")), { code: "ENOENT" });
});
test("F20A-C07 memento failure retains durable recovery and withdraws session", async t => {
    const f = await fixture(t); t.mock.method(stub.window, "showWarningMessage", async (_m: string, _o: unknown, action: string) => action);
    t.mock.method(f.context.globalState, "update", async () => { throw Error("synthetic"); }); assert.equal((await f.adapter.configure() as any).status, "INCOMPLETE");
    assert.equal((f.adapter.status() as any).status, "UNAVAILABLE");
    const names = (await readdir(join(f.context.globalStorageUri.fsPath, "adapter-sessions"))).filter(n => n.startsWith("codex-cli-")); assert.equal(names.length, 1);
    assert.ok(await readFile(join(f.context.globalStorageUri.fsPath, "adapter-sessions", names[0], "recovery.json"), "utf8"));
});
test("F20A-C08 withdrawal preserves restrictive profile bytes and ends capability", async t => {
    const f = await fixture(t); t.mock.method(stub.window, "showWarningMessage", async (_m: string, _o: unknown, action: string) => action);
    const r = await f.adapter.configure() as any, before = await readFile(join(r.profileDirectory, "config.toml"), "utf8");
    f.adapter.withdraw(); assert.equal((f.adapter.status() as any).status, "UNAVAILABLE"); assert.equal(await readFile(join(r.profileDirectory, "config.toml"), "utf8"), before);
});
