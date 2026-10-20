import "./phase2/register.mjs";
import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, readdir, writeFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as stub from "./phase2/vscode-stub";
const manager = { async start() { return { running: true, state: "healthy", url: "http://127.0.0.1:49155" }; },
    ownedSnapshot() { return { state: "healthy", session: "b9999999-9999-4999-8999-999999999999", port: 49155 }; }, async status() { return { running: true }; },
    async request() { return { version: 1, enabled: true, ready: true, geminiGenerateContent: true }; }, async getClientToken() { return "d".repeat(64); } };
async function fixture(t: TestContext) {
    const { GeminiCliAdapter } = await import("../adapters/GeminiCliAdapter"), root = await mkdtemp(join(tmpdir(), "soterai-f20c-owner-")), workspace = join(root, "project"), profile = join(root, "profile");
    await mkdir(workspace); await mkdir(profile); stub.resetState(workspace); const context = stub.makeExtensionContext(profile); let reads = 0;
    const adapter = new GeminiCliAdapter(context as never, { isEnabled: () => true, readIntegration: async () => { reads++; return { status: "ALLOWED_ONCE", kind: "environment-schema", text: "KEY=[MASKED]" }; } } as never, manager as never);
    t.after(() => adapter.dispose()); t.mock.method(adapter as any, "artifact", async () => undefined); t.mock.method(adapter as any, "artifactCurrent", async () => true);
    return { adapter, root, workspace, profile, context, reads: () => reads };
}
const approve = (t: TestContext) => t.mock.method(stub.window, "showWarningMessage", async (_m: string, _options: unknown, action: string) => action);
const paths = (directory: string) => ({ settings: join(directory, ".gemini/settings.json"), environment: join(directory, ".gemini/.env"), recovery: join(directory, "recovery.json") });
test("F20C constructor/status never reads normal Gemini home or launches native", async t => {
    const { GeminiCliAdapter } = await import("../adapters/GeminiCliAdapter"), adapter = new GeminiCliAdapter({} as never, { isEnabled: () => false } as never, manager as never); t.after(() => adapter.dispose());
    assert.equal((adapter.status() as any).badge, "Uncovered"); assert.match(JSON.stringify(adapter.status()), /buffered/i);
});
test("F20C configure cancellation creates neither native settings nor environment", async t => {
    const f = await fixture(t); t.mock.method(stub.window, "showWarningMessage", async () => undefined);
    assert.equal((await f.adapter.configure() as any).status, "CANCELLED"); assert.equal(f.reads(), 0);
    for (const name of await readdir(join(f.context.globalStorageUri.fsPath, "adapter-sessions"))) {
        const p = paths(join(f.context.globalStorageUri.fsPath, "adapter-sessions", name)); await assert.rejects(readFile(p.settings), { code: "ENOENT" }); await assert.rejects(readFile(p.environment), { code: "ENOENT" });
    }
});
test("F20C reviewed setup creates two owned files, encrypted absence and value-free recovery; restore preserves unrelated state", async t => {
    const f = await fixture(t); approve(t); const result = await f.adapter.configure() as any; assert.equal(result.status, "APPLIED"); const p = paths(result.profileDirectory);
    const settings = JSON.parse(await readFile(p.settings, "utf8")), env = await readFile(p.environment, "utf8"), receipt = await readFile(p.recovery, "utf8");
    assert.deepEqual(settings.tools.core, ["mcp_soterai_safe_read_soterai_read_project_file_safely"]); assert(!receipt.includes(settings.mcpServers.soterai_safe_read.headers.Authorization)); assert(!receipt.includes(env.match(/GEMINI_API_KEY=([a-f0-9]{64})/)![1]));
    assert.equal((await readdir(join(f.context.globalStorageUri.fsPath, "config-backups"))).length, 1); assert.equal(f.reads(), 0);
    await writeFile(join(result.profileDirectory, "PUBLIC_NATIVE_STATE.txt"), "KEEP"); assert.equal((await f.adapter.undo() as any).status, "RESTORED");
    await assert.rejects(readFile(p.settings), { code: "ENOENT" }); await assert.rejects(readFile(p.environment), { code: "ENOENT" }); assert.equal(await readFile(join(result.profileDirectory, "PUBLIC_NATIVE_STATE.txt"), "utf8"), "KEEP");
});
test("F20C prior receipt and project override refuse before duplicate configuration", async t => {
    const f = await fixture(t); approve(t); assert.equal((await f.adapter.configure() as any).status, "APPLIED"); assert.equal((await f.adapter.configure() as any).status, "RESTORE_PREVIOUS_GEMINI_PROFILE_FIRST");
    const g = await fixture(t); await mkdir(join(g.workspace, ".gemini")); assert.equal((await g.adapter.configure() as any).status, "PROJECT_GEMINI_OVERRIDE_REQUIRES_REVIEW");
});
test("F20C recovery write failure never creates native files", async t => {
    const f = await fixture(t); approve(t); const original = (f.adapter as any).write.bind(f.adapter);
    t.mock.method(f.adapter as any, "write", async (file: string, value: string | undefined, expected?: string) => { if (file.endsWith("recovery.json")) throw Error("Synthetic recovery failure"); return original(file, value, expected); });
    assert.equal((await f.adapter.configure() as any).status, "UNAVAILABLE");
    for (const name of await readdir(join(f.context.globalStorageUri.fsPath, "adapter-sessions"))) { const p = paths(join(f.context.globalStorageUri.fsPath, "adapter-sessions", name)); await assert.rejects(readFile(p.settings), { code: "ENOENT" }); await assert.rejects(readFile(p.environment), { code: "ENOENT" }); }
});
test("F20C second-file failure rolls back only settings created by the operation", async t => {
    const f = await fixture(t); approve(t); const original = (f.adapter as any).write.bind(f.adapter);
    t.mock.method(f.adapter as any, "write", async (file: string, value: string | undefined, expected?: string) => { if (file.endsWith(".env")) throw Error("Synthetic second-file failure"); return original(file, value, expected); });
    assert.equal((await f.adapter.configure() as any).status, "ROLLED_BACK"); assert.equal((f.adapter.status() as any).status, "UNAVAILABLE");
    for (const name of await readdir(join(f.context.globalStorageUri.fsPath, "adapter-sessions"))) { const p = paths(join(f.context.globalStorageUri.fsPath, "adapter-sessions", name)); await assert.rejects(readFile(p.settings), { code: "ENOENT" }); await assert.rejects(readFile(p.environment), { code: "ENOENT" }); assert(await readFile(p.recovery)); }
});
test("F20C memento failure leaves durable recovery and revokes both capabilities", async t => {
    const f = await fixture(t); approve(t); t.mock.method(f.context.globalState, "update", async () => { throw Error("Synthetic memento failure"); });
    assert.equal((await f.adapter.configure() as any).status, "INCOMPLETE"); assert.equal((f.adapter.status() as any).status, "UNAVAILABLE");
    const names = await readdir(join(f.context.globalStorageUri.fsPath, "adapter-sessions")); assert.equal(names.length, 1); assert(await readFile(paths(join(f.context.globalStorageUri.fsPath, "adapter-sessions", names[0])).recovery));
});
test("F20C withdrawal preserves stronger profile bytes and refuses old HTTP capabilities", async t => {
    const f = await fixture(t); approve(t); const result = await f.adapter.configure() as any, p = paths(result.profileDirectory), settingsText = await readFile(p.settings, "utf8"), env = await readFile(p.environment, "utf8"), settings = JSON.parse(settingsText);
    f.adapter.withdraw(); assert.equal((f.adapter.status() as any).status, "UNAVAILABLE"); assert.equal(await readFile(p.settings, "utf8"), settingsText); assert.equal(await readFile(p.environment, "utf8"), env);
    const response = await fetch(settings.mcpServers.soterai_safe_read.url, { method: "POST", headers: { authorization: settings.mcpServers.soterai_safe_read.headers.Authorization, "content-type": "application/json", connection: "close" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }) }); await response.text(); assert.equal(response.status, 503); assert.equal(f.reads(), 0);
});
test("F20C restore can resume after one exact owned file is already absent", async t => {
    const f = await fixture(t); approve(t); const result = await f.adapter.configure() as any, p = paths(result.profileDirectory); await unlink(p.settings);
    assert.equal((await f.adapter.undo() as any).status, "RESTORED"); await assert.rejects(readFile(p.environment), { code: "ENOENT" });
});
test("F20C changed foreign environment refuses whole restoration and preserves settings", async t => {
    const f = await fixture(t); approve(t); const result = await f.adapter.configure() as any, p = paths(result.profileDirectory), before = await readFile(p.settings, "utf8"); await writeFile(p.environment, "PUBLIC_FOREIGN_ENVIRONMENT");
    assert.equal((await f.adapter.undo() as any).status, "CHANGED"); assert.equal(await readFile(p.settings, "utf8"), before); assert.equal(await readFile(p.environment, "utf8"), "PUBLIC_FOREIGN_ENVIRONMENT");
});
test("F20C recovery can restore owned files when machine adapter flag is disabled", async t => {
    const f = await fixture(t); approve(t); assert.equal((await f.adapter.configure() as any).status, "APPLIED"); stub.state.configInspect.set("soterai.lite.geminiCliAdapter", { defaultValue: true, globalValue: false });
    assert.equal((await f.adapter.undo() as any).status, "RESTORED");
});
