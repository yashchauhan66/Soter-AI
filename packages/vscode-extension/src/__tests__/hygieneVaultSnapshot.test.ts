import "./phase2/register.mjs";
import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, link } from "node:fs/promises";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import * as stub from "./phase2/vscode-stub";
import { initializeBoundaryState, BoundarySnapshot } from "../ai-boundary/BoundarySnapshot";
import { VaultManager } from "../firewall/VaultManager";
const VALUE = "TEST_ONLY_F21_PRIVATE_SNAPSHOT_VALUE_4d8a73a0";
async function fixture(t: TestContext) {
    const directory = await mkdtemp(join(tmpdir(), "soterai-f21-snapshot-")), root = join(directory, "project"), profile = join(directory, "profile"); await mkdir(root); await mkdir(profile);
    stub.resetState(root); const context = stub.makeExtensionContext(profile); context.globalStorageUri = stub.Uri.file(profile); initializeBoundaryState(context.workspaceState as never); await BoundarySnapshot.load();
    const manager = new VaultManager(context as never), file = join(root, ".env"), uri = stub.Uri.file(file); await writeFile(file, "API_KEY=" + VALUE + "\n"); t.after(() => context.subscriptions.forEach(d => d.dispose())); return { manager: manager as any, file, uri, directory, root, context };
}
test("F21 trusted snapshot reuses vault containment/identity/policy and never opens a source TextDocument or creates a key", async t => {
    const f = await fixture(t); let opens = 0; t.mock.method(stub.workspace, "openTextDocument", async () => { opens++; throw Error("No original document"); });
    const result = await f.manager.withHygieneSnapshot(f.uri, (snapshot: any) => { assert(snapshot.text.includes(VALUE)); assert(snapshot.identity); assert(snapshot.policy); assert.equal(snapshot.source, f.uri.toString()); return { count: 1 }; }, () => true);
    assert.deepEqual(result, { count: 1 }); assert.equal(opens, 0); assert.equal(await f.context.secrets.get("soterai.vaultKey"), undefined); assert.equal(await readFile(f.file, "utf8"), "API_KEY=" + VALUE + "\n");
});
test("F21 disabled snapshot never invokes the private consumer", async t => {
    const f = await fixture(t); let called = 0; await assert.rejects(f.manager.withHygieneSnapshot(f.uri, () => called++, () => false)); assert.equal(called, 0);
});
test("F21 machine disable defeats a workspace enabling override at the private snapshot boundary", async t => {
    const f = await fixture(t); stub.state.configInspect.set("soterai.lite.hygieneAssistant", { defaultValue: true, globalValue: false, workspaceValue: true }); let called = 0;
    await assert.rejects(f.manager.withHygieneSnapshot(f.uri, () => called++, () => true)); assert.equal(called, 0);
});
test("F21 synchronous consumer source drift, callback errors and async callbacks withhold results", async t => {
    for (const variant of ["source", "error", "async"]) { const f = await fixture(t); await assert.rejects(f.manager.withHygieneSnapshot(f.uri, () => {
        if (variant === "source") writeFileSync(f.file, "API_KEY=PUBLIC_CHANGED\n"); if (variant === "error") throw Error(VALUE); return variant === "async" ? Promise.resolve("PUBLIC") : "PUBLIC";
    }, () => true), (e: unknown) => !String(e).includes(VALUE)); }
});
test("F21 snapshot lease drift/instance withdrawal inside consumer cannot release its result", async t => {
    for (const variant of ["flag", "epoch"]) { const f = await fixture(t); let enabled = true; await assert.rejects(f.manager.withHygieneSnapshot(f.uri, () => { if (variant === "flag") enabled = false; else f.manager.withdrawHygiene(); return "PUBLIC_LATE"; }, () => enabled)); }
});
test("F21 hardlinked synthetic source refuses before any raw callback", async t => {
    const f = await fixture(t); await link(f.file, join(f.directory, "retained-public-alias")); let called = 0; await assert.rejects(f.manager.withHygieneSnapshot(f.uri, () => called++, () => true)); assert.equal(called, 0);
});
test("F21 withdrawing its vault instance prevents late migration approval but preserves another instance", async t => {
    const f = await fixture(t), other = new VaultManager(f.context as never); let entered!: () => void, approve!: (v: string) => void; const reached = new Promise<void>(r => entered = r);
    t.mock.method(stub.window, "showWarningMessage", async () => { entered(); return new Promise<string>(r => approve = r); });
    const pending = f.manager.migrate(f.uri); await reached; f.manager.withdrawHygiene(); approve("Migrate securely"); await assert.rejects(pending); assert.equal(await readFile(f.file, "utf8"), "API_KEY=" + VALUE + "\n");
    assert.equal(await (other as any).withHygieneSnapshot(f.uri, () => "PUBLIC_CONTROL", () => true), "PUBLIC_CONTROL");
});
test("F21 a hygiene migration queued behind another owner review rechecks its own admission before reading", async t => {
    const f = await fixture(t), other = new VaultManager(f.context as never); let entered!: () => void, cancel!: () => void, prompts = 0, enabled = true;
    const reached = new Promise<void>(r => entered = r); t.mock.method(stub.window, "showWarningMessage", async () => {
        if (++prompts === 1) { entered(); return new Promise<undefined>(r => cancel = () => r(undefined)); } return "Migrate securely";
    });
    const first = other.migrate(f.uri as never); await reached; const queued = f.manager.migrate(f.uri, () => enabled); enabled = false; cancel(); await first;
    await assert.rejects(queued); assert.equal(prompts, 1); assert.equal(await readFile(f.file, "utf8"), "API_KEY=" + VALUE + "\n");
});
