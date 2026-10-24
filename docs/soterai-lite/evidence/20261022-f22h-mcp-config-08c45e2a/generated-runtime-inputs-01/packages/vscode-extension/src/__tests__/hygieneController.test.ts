import "./phase2/register.mjs";
import type * as vscode from "vscode";
import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import * as stub from "./phase2/vscode-stub";
import { initializeBoundaryState, BoundarySnapshot, updateRules } from "../ai-boundary/BoundarySnapshot";
import { HYGIENE_LEDGER_KEY } from "../hygiene/HygieneExposureLedger";
import { VaultManager } from "../firewall/VaultManager";
const VALUE = "TEST_ONLY_F21_PRIVATE_CONTROLLER_VALUE_73ef83c1", TEXT = "API_KEY=" + VALUE + "\nPORT=3000\n";
async function fixture(t: TestContext, options: any = {}) {
    const { skipEnrollment = false, ...controllerOptions } = options;
    const { HygieneController } = await import("../hygiene/HygieneController"), base = await mkdtemp(join(tmpdir(), "soterai-f21-controller-")), root = join(base, "project"), profile = join(base, "profile");
    await mkdir(root); await mkdir(profile); stub.resetState(root); const context = stub.makeExtensionContext(profile); context.globalStorageUri = stub.Uri.file(profile); initializeBoundaryState(context.workspaceState as never); if (!skipEnrollment) await BoundarySnapshot.load();
    const file = join(root, ".env"), uri = stub.Uri.file(file) as unknown as vscode.Uri; await writeFile(file, TEXT); let originalOpens = 0;
    t.mock.method(stub.workspace, "openTextDocument", async (value: any) => { if (value?.fsPath === file) originalOpens++; return { uri: value, getText: () => "PUBLIC_METADATA_ONLY" }; });
    const events = new stub.EventEmitter<{ key: string }>(); context.secrets.onDidChange = events.event as never;
    const controller = new HygieneController(context as never, controllerOptions); t.after(() => { controller.dispose(); context.subscriptions.forEach(d => d.dispose()); events.dispose(); });
    return { controller, context, root, profile, file, uri, events, originalOpens: () => originalOpens };
}
const approve = (t: TestContext) => t.mock.method(stub.window, "showWarningMessage", async (_message: string, _options: unknown, action: string) => action);
const safe = (value: unknown) => assert(!JSON.stringify(value).includes(VALUE));
test("F21 controller constructor/status never scans or creates a key", async t => {
    const f = await fixture(t); safe(f.controller.status()); assert.equal(await f.context.secrets.get(HYGIENE_LEDGER_KEY), undefined); assert.equal(f.originalOpens(), 0);
});
test("F21 owner cancellation precedes original reads/ledger key creation", async t => {
    const f = await fixture(t); t.mock.method(stub.window, "showWarningMessage", async () => undefined); const result = await f.controller.reviewFile(f.uri); assert.equal(result.status, "CANCELLED"); assert.equal(await f.context.secrets.get(HYGIENE_LEDGER_KEY), undefined); assert.equal(await readFile(f.file, "utf8"), TEXT); assert.equal(f.originalOpens(), 0);
});
test("F21 reviewed local file analysis returns only safe findings and possible-exposure metadata", async t => {
    const f = await fixture(t); approve(t); const result = await f.controller.reviewFile(f.uri); assert.equal(result.status, "ANALYZED"); assert.equal(result.findings.length, 1); safe(result); safe(await f.controller.exposures()); safe([...f.context._inspect.globalStore]); assert.equal(f.originalOpens(), 0); assert.equal(await readFile(f.file, "utf8"), TEXT);
});
test("F21 bounded workspace discovery has public control and excludes source originals from command results", async t => {
    const f = await fixture(t); approve(t); const publicFile = join(f.root, "public.txt"); await writeFile(publicFile, "PORT=3000\n"); t.mock.method(stub.workspace, "findFiles", async () => [f.uri, stub.Uri.file(publicFile)]);
    const result = await f.controller.reviewWorkspace(); assert.equal(result.status, "ANALYZED"); assert.equal(result.files, 2); assert.equal(result.findings.length, 1); safe(result); assert.equal(f.originalOpens(), 0);
});
test("F21 source changed while owner consent is pending is withheld before findings persist", async t => {
    const f = await fixture(t); t.mock.method(stub.window, "showWarningMessage", async (_m: string, _o: unknown, action: string) => { await writeFile(f.file, "PORT=4000\n"); return action; });
    const result = await f.controller.reviewFile(f.uri); assert.equal(result.status, "CHANGED"); assert.equal((await f.controller.exposures()).rows.length, 0); safe(result);
});
test("F21 machine disabled ignores repository enabling and releases no findings", async t => {
    const f = await fixture(t); approve(t); stub.state.configInspect.set("soterai.lite.hygieneAssistant", { defaultValue: true, globalValue: false, workspaceValue: true }); assert.equal((await f.controller.reviewFile(f.uri)).status, "UNAVAILABLE"); assert.equal(await f.context.secrets.get(HYGIENE_LEDGER_KEY), undefined);
});
test("F21 vault fix and explicit disclosure undo use canonical recovery while saved denies remain", async t => {
    const f = await fixture(t); approve(t); const scan = await f.controller.reviewFile(f.uri), id = scan.findings[0].id;
    const fixed = await f.controller.vaultFinding(id); assert.equal(fixed.status, "APPLIED"); assert(!(await readFile(f.file, "utf8")).includes(VALUE)); assert.match(await readFile(f.file, "utf8"), /SOTERAI_PROTECTED/); assert.equal(await readFile(join(f.root, ".env.example"), "utf8"), "API_KEY=\nPORT=\n");
    const restored = await f.controller.restoreFinding(id); assert.equal(restored.status, "RESTORED"); assert.equal(await readFile(f.file, "utf8"), TEXT); safe(fixed); safe(restored); safe(await f.controller.exposures()); assert.equal(f.originalOpens(), 0);
    assert(JSON.stringify([...f.context._inspect.workspaceStore]).includes('"sensitive":true'));
});
test("F21 cancelled vault review and conflicting example preserve source and existing files", async t => {
    const f = await fixture(t); approve(t); const scan = await f.controller.reviewFile(f.uri); t.mock.method(stub.window, "showWarningMessage", async () => undefined);
    assert.equal((await f.controller.vaultFinding(scan.findings[0].id)).status, "CANCELLED"); assert.equal(await readFile(f.file, "utf8"), TEXT);
    approve(t); await writeFile(join(f.root, ".env.example"), "PUBLIC_FOREIGN_EXAMPLE\n"); assert.equal((await f.controller.writeExample(scan.findings[0].id)).status, "UNAVAILABLE"); assert.equal(await readFile(join(f.root, ".env.example"), "utf8"), "PUBLIC_FOREIGN_EXAMPLE\n");
});
test("F21 withdrawal prevents late vault confirmation from changing source", async t => {
    const f = await fixture(t); approve(t); const scan = await f.controller.reviewFile(f.uri); let entered!: () => void, finish!: (value: string) => void; const reached = new Promise<void>(r => entered = r);
    t.mock.method(stub.window, "showWarningMessage", async () => { entered(); return new Promise<string>(r => finish = r); }); const pending = f.controller.vaultFinding(scan.findings[0].id); await reached; f.controller.withdraw(); finish("Migrate securely");
    assert.notEqual((await pending).status, "APPLIED"); assert.equal(await readFile(f.file, "utf8"), TEXT); safe(await f.controller.exposures());
});
test("F21 expiry before approval, changed key and failed persistence never report success", async t => {
    let now = 0; const f = await fixture(t, { now: () => now }); t.mock.method(stub.window, "showWarningMessage", async (_m: string, _o: unknown, action: string) => { now = 61000; return action; }); assert.equal((await f.controller.reviewFile(f.uri)).status, "UNAVAILABLE"); assert.equal(await f.context.secrets.get(HYGIENE_LEDGER_KEY), undefined);
    const g = await fixture(t); approve(t); const scan = await g.controller.reviewFile(g.uri); await g.context.secrets.store(HYGIENE_LEDGER_KEY, Buffer.alloc(32, 41).toString("base64")); assert.notEqual((await g.controller.vaultFinding(scan.findings[0].id)).status, "APPLIED"); assert.equal(await readFile(g.file, "utf8"), TEXT);
    const h = await fixture(t); approve(t); t.mock.method(h.context.globalState, "update", async () => { throw Error(VALUE); }); const result = await h.controller.reviewFile(h.uri); assert.equal(result.status, "UNAVAILABLE"); safe(result); assert.equal(await readFile(h.file, "utf8"), TEXT);
});
test("F21 reviewed metadata export is a new file and contains neither source paths nor values", async t => {
    const f = await fixture(t); approve(t); await f.controller.reviewFile(f.uri); const exported = await f.controller.exportLedger(); assert.equal(exported.status, "EXPORTED"); safe(exported);
    const directory = join(f.profile, "hygiene-exports"), names = await readdir(directory); assert.equal(names.length, 1); const text = await readFile(join(directory, names[0]), "utf8"); assert(!text.includes(VALUE)); assert(!text.includes(f.file)); assert(!text.includes("API_KEY"));
});
test("F21 candidate embedded in filename can be analyzed privately but cannot enter vault review labels", async t => {
    const f = await fixture(t); approve(t); const file = join(f.root, VALUE + ".env"); await writeFile(file, TEXT); const result = await f.controller.reviewFile(stub.Uri.file(file) as unknown as vscode.Uri); assert.equal(result.findings.length, 1); safe(result);
    const action = await f.controller.vaultFinding(result.findings[0].id); assert.equal(action.status, "UNAVAILABLE"); assert.equal(await readFile(file, "utf8"), TEXT); safe(action);
});
test("F21 delayed notification for the same current key does not revoke a valid local scan", async t => {
    const f = await fixture(t); approve(t); const original = VaultManager.prototype.withHygieneSnapshot; let fired = false;
    t.mock.method(VaultManager.prototype, "withHygieneSnapshot", async function (this: VaultManager, ...args: any[]) {
        const result = await Reflect.apply(original, this, args); if (!fired) { fired = true; f.events.fire({ key: HYGIENE_LEDGER_KEY }); await new Promise(r => setImmediate(r)); } return result;
    });
    assert.equal((await f.controller.reviewFile(f.uri)).status, "ANALYZED");
});
test("F21 key replacement during export review refuses stale metadata before creating a file", async t => {
    const f = await fixture(t); approve(t); await f.controller.reviewFile(f.uri);
    t.mock.method(stub.window, "showWarningMessage", async (_m: string, _o: unknown, action: string) => { await f.context.secrets.store(HYGIENE_LEDGER_KEY, Buffer.alloc(32, 47).toString("base64")); return action; });
    assert.equal((await f.controller.exportLedger()).status, "UNAVAILABLE"); await assert.rejects(readdir(join(f.profile, "hygiene-exports")), { code: "ENOENT" });
});

test("F21 workspace analysis caps discovery at128 and admits at most1MiB of saved text", async t => {
    const f = await fixture(t); approve(t); const files: vscode.Uri[] = [], text = "#" + "P".repeat(65534) + "\n";
    for (let n = 0; n < 17; n++) { const file = join(f.root, "public-" + n + ".txt"); await writeFile(file, text); files.push(stub.Uri.file(file) as unknown as vscode.Uri); }
    t.mock.method(stub.workspace, "findFiles", async (_include: unknown, _exclude: unknown, max: number) => { assert.equal(max, 129); return files as never; });
    const result = await f.controller.reviewWorkspace(); assert.equal(result.status, "PARTIAL"); assert.equal(result.files, 16); assert.equal(result.skipped, 1); assert.equal(result.findings.length, 0); safe(result);
});

test("F21 binary/oversized saved-file outcomes never release partial secret findings", async t => {
    const f = await fixture(t); approve(t); await writeFile(f.file, TEXT + "\0"); assert.equal((await f.controller.reviewFile(f.uri)).status, "UNAVAILABLE"); assert.equal((await f.controller.exposures()).rows.length, 0);
    await writeFile(f.file, "P".repeat(65537)); const result = await f.controller.reviewFile(f.uri); assert.equal(result.status, "PARTIAL"); assert.equal(result.files, 0); assert.equal(result.skipped, 1); safe(result);
});

test("F21 cancel never enters the original-content snapshot even with multiple discovered files", async t => {
    const f = await fixture(t); t.mock.method(stub.workspace, "findFiles", async () => [f.uri] as never); let snapshots = 0;
    t.mock.method(VaultManager.prototype, "withHygieneSnapshot", async () => { snapshots++; throw Error(VALUE); }); t.mock.method(stub.window, "showWarningMessage", async () => undefined);
    assert.equal((await f.controller.reviewWorkspace()).status, "CANCELLED"); assert.equal(snapshots, 0); assert.equal(await f.context.secrets.get(HYGIENE_LEDGER_KEY), undefined);
});

test("F21 post-migration metadata failure is INCOMPLETE and retains placeholders/recovery rather than restoring originals", async t => {
    const f = await fixture(t); approve(t); const scan = await f.controller.reviewFile(f.uri); t.mock.method(f.context.globalState, "update", async () => { throw Error(VALUE); });
    const result = await f.controller.vaultFinding(scan.findings[0].id); assert.equal(result.status, "INCOMPLETE"); assert(!(await readFile(f.file, "utf8")).includes(VALUE)); assert.match(await readFile(f.file, "utf8"), /SOTERAI_PROTECTED/); safe(result);
});

test("F21 lease expiry during canonical vault review prevents source mutation without waiting for a timer callback", async t => {
    let now = 0; const f = await fixture(t, { now: () => now }); approve(t); const scan = await f.controller.reviewFile(f.uri);
    t.mock.method(stub.window, "showWarningMessage", async (_m: string, _o: unknown, action: string) => { now = 61000; return action; });
    assert.notEqual((await f.controller.vaultFinding(scan.findings[0].id)).status, "APPLIED"); assert.equal(await readFile(f.file, "utf8"), TEXT);
});

test("F21 first owner analysis enrolls canonical additive policy before capturing its review basis", async t => {
    const f = await fixture(t, { skipEnrollment: true }); approve(t); assert.equal(f.context.workspaceState.get("soterai.aiForbidden.v1"), undefined);
    const result = await f.controller.reviewFile(f.uri); assert.equal(result.status, "ANALYZED"); assert.equal(result.findings.length, 1); assert.equal(await readFile(f.file, "utf8"), TEXT); safe(result);
});

test("F21 actual owner-policy change during review still invalidates approval after initial enrollment", async t => {
    const f = await fixture(t, { skipEnrollment: true }); t.mock.method(stub.window, "showWarningMessage", async (_m: string, _o: unknown, action: string) => {
        await updateRules(stub.Uri.file(f.root).toString(), rules => ({ ...rules, paths: [...rules.paths, { kind: "file", pattern: "public.txt" }] })); return action;
    });
    const result = await f.controller.reviewFile(f.uri); assert.equal(result.status, "CHANGED"); assert.equal((await f.controller.exposures()).rows.length, 0); safe(result);
});
