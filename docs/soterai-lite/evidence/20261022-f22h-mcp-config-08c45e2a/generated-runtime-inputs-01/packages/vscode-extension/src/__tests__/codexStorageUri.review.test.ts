import "./phase2/register.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import * as stub from "./phase2/vscode-stub";
async function fixture(t: import("node:test").TestContext, changes: Record<string, unknown>) {
    const { CodexCliAdapter } = await import("../adapters/CodexCliAdapter");
    const root = await mkdtemp(join(tmpdir(), "soterai-f20a-storage-")), workspace = join(root, "project"), profile = join(root, "profile");
    await mkdir(workspace); await mkdir(profile); stub.resetState(workspace); const context = stub.makeExtensionContext(profile);
    const uri = Object.create(context.globalStorageUri);
    const effective = changes.physicalMismatch ? { path: context.globalStorageUri.path + "/alternate", fsPath: context.globalStorageUri.fsPath } : changes;
    for (const [key, value] of Object.entries(effective)) Object.defineProperty(uri, key, { configurable: true, value });
    (context as any).globalStorageUri = uri;
    const adapter = new CodexCliAdapter(context as never, { isEnabled: () => true } as never); t.after(() => adapter.dispose());
    t.mock.method(adapter as any, "artifact", async () => undefined); t.mock.method(adapter as any, "artifactCurrent", async () => true);
    t.mock.method(stub.window, "showWarningMessage", async (_m: string, _o: unknown, action: string) => action);
    return adapter;
}
test("F20A-R09 actual local vscode-userdata storage scheme accepts reviewed dedicated profile", async t => {
    const adapter = await fixture(t, { scheme: "vscode-userdata" }); assert.equal((await adapter.configure() as any).status, "APPLIED");
    assert.equal((await adapter.undo() as any).status, "RESTORED");
});
for (const [name, changes] of [
    ["unsupported scheme", { scheme: "https" }], ["authority", { authority: "synthetic.invalid" }], ["query", { query: "alternate=1" }],
    ["fragment", { fragment: "alternate" }], ["mismatched physical path", { physicalMismatch: true }],
] as const) test("F20A-R10 storage refuses " + name, async t => {
    const adapter = await fixture(t, changes); assert.equal((await adapter.configure() as any).status, "UNAVAILABLE");
});
