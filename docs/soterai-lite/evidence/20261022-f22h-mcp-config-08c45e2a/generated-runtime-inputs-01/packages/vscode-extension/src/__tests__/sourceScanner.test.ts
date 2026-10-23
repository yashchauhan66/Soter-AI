import "./phase2/register.mjs";
import type * as vscode from "vscode";
import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import * as stub from "./phase2/vscode-stub";
import { initializeBoundaryState, updateRules } from "../ai-boundary/BoundarySnapshot";
import { HygieneController } from "../hygiene/HygieneController";
import { HYGIENE_LEDGER_KEY } from "../hygiene/HygieneExposureLedger";
import { VaultManager } from "../firewall/VaultManager";
const VALUE = "TEST_ONLY_F22A_CONTROLLER_7c36f09e", TEXT = 'const apiKey: string = "first\\n' + VALUE + '\\u0021"; const PORT=3000;\n';
const safe = (v: unknown) => { const text = JSON.stringify(v); for (const privateText of [VALUE, "apiKey", "first\\n", "first\n"]) assert(!text.includes(privateText)); };
async function fixture(t: TestContext, options: object = {}) {
    const base = await mkdtemp(join(tmpdir(), "soterai-f22a-source-")), root = join(base, "project"), profile = join(base, "profile"); await mkdir(root); await mkdir(profile);
    stub.resetState(root); const context = stub.makeExtensionContext(profile); context.globalStorageUri = stub.Uri.file(profile); initializeBoundaryState(context.workspaceState as never);
    const file = join(root, "config.ts"), uri = stub.Uri.file(file) as unknown as vscode.Uri; await writeFile(file, TEXT); let opens = 0;
    t.mock.method(stub.workspace, "openTextDocument", async () => { opens++; throw Error(VALUE); });
    const events = new stub.EventEmitter<{ key: string }>(); context.secrets.onDidChange = events.event as never;
    const controller = new HygieneController(context as never, { ...options, family: "source" } as never);
    t.after(() => { controller.dispose(); events.dispose(); context.subscriptions.forEach(d => d.dispose()); }); return { controller, context, file, uri, root, profile, events, opens: () => opens };
}
function approve(t: TestContext) { return t.mock.method(stub.window, "showWarningMessage", async (m: string, options: unknown, action: string) => { safe([m, options]); return action; }); }

test("F22a canonical source planner is explicit and legacy callers do not silently change syntax", async () => {
    const { createVaultMigrationPlan } = await import("../firewall/VaultMigrationPlan");
    const legacy = createVaultMigrationPlan(TEXT, false, "22000000-0000-4000-8000-000000000001"); assert.equal(legacy.candidates.length, 0);
    const source = (createVaultMigrationPlan as any)(TEXT, false, "22000000-0000-4000-8000-000000000001", "ts"); assert.equal(source.candidates.length, 1); assert(!source.maskedText.includes(VALUE)); assert.equal(source.exampleText, "");
    assert.throws(() => (createVaultMigrationPlan as any)(TEXT, true, "22000000-0000-4000-8000-000000000001", "ts"));
});
test("F22a source analysis uses only HMAC metadata and rejects unsupported formats or environment mode", async () => {
    const { analyzeSourceText } = await import("../hygiene/HygieneAnalysis"); assert.equal(typeof analyzeSourceText, "function");
    const input = { source: "src/config.ts", text: TEXT, environment: false }, key = Buffer.alloc(32, 23), result = analyzeSourceText(input, key);
    assert.equal(result.findings.length, 1); assert.deepEqual(result, analyzeSourceText(input, key)); assert.notEqual(result.fileRef, analyzeSourceText(input, Buffer.alloc(32, 24)).fileRef); safe(result);
    for (const bad of [{ ...input, source: "a.py" }, { ...input, environment: true }, { ...input, approved: true }]) assert.throws(() => analyzeSourceText(bad, key), e => !String(e).includes(VALUE));
});
test("F22a source registration/controller has no startup read or key and cancellation precedes private capture", async t => {
    const f = await fixture(t); assert.equal(await f.context.secrets.get(HYGIENE_LEDGER_KEY), undefined); safe(f.controller.status()); let reads = 0;
    t.mock.method(VaultManager.prototype, "withHygieneSnapshot", async () => { reads++; throw Error(VALUE); }); t.mock.method(stub.window, "showWarningMessage", async () => undefined);
    assert.equal((await f.controller.reviewFile(f.uri)).status, "CANCELLED"); assert.equal(reads, 0); assert.equal(f.opens(), 0); assert.equal(await f.context.secrets.get(HYGIENE_LEDGER_KEY), undefined);
});
test("F22a source scan, reviewed vault and exact escaped disclosure restore preserve saved deny without env output", async t => {
    const f = await fixture(t); approve(t); const scan = await f.controller.reviewFile(f.uri); assert.equal(scan.status, "ANALYZED"); assert.equal(scan.findings.length, 1); safe(scan); safe(f.controller.selections());
    const id = scan.findings[0].id, fixed = await f.controller.vaultFinding(id); assert.equal(fixed.status, "APPLIED"); safe(fixed); assert(!(await readFile(f.file, "utf8")).includes(VALUE)); assert.match(await readFile(f.file, "utf8"), /SOTERAI_PROTECTED/);
    await assert.rejects(readFile(join(f.root, ".env.example")), { code: "ENOENT" }); assert.equal((await f.controller.writeExample(id)).status, "UNAVAILABLE");
    const restored = await f.controller.restoreFinding(id); assert.equal(restored.status, "RESTORED"); safe(restored); assert.equal(await readFile(f.file, "utf8"), TEXT); assert.equal(f.opens(), 0); assert(JSON.stringify([...f.context._inspect.workspaceStore]).includes('"sensitive":true')); safe(await f.controller.exposures());
});
test("F22a source flag obeys strict machine authority and dependencies, ignoring workspace enable", async t => {
    const f = await fixture(t); approve(t);
    for (const flag of ["source", "sourceBadType"]) { stub.state.configInspect.set("soterai.lite.configScanner.source", { defaultValue: true, globalValue: flag === "source" ? false : "true", workspaceValue: true }); assert.equal((await f.controller.reviewFile(f.uri)).status, "UNAVAILABLE"); }
    stub.state.configInspect.delete("soterai.lite.configScanner.source"); stub.state.configInspect.set("soterai.lite.hygieneAssistant", { globalValue: false }); assert.equal((await f.controller.reviewFile(f.uri)).status, "UNAVAILABLE"); assert.equal(await f.context.secrets.get(HYGIENE_LEDGER_KEY), undefined);
});
test("F22a unsupported selected format, malformed and dynamic source do not produce a clean result", async t => {
    const f = await fixture(t); approve(t); const other = join(f.root, "a.py"); await writeFile(other, 'apiKey="' + VALUE + '"');
    assert.equal((await f.controller.reviewFile(stub.Uri.file(other) as unknown as vscode.Uri)).status, "UNSUPPORTED_SOURCE");
    for (const text of ['const apiKey = "' + VALUE + '"; const =', 'const apiKey = `' + VALUE + '${suffix}`;']) { await writeFile(f.file, text); const result = await f.controller.reviewFile(f.uri); assert.equal(result.status, "UNAVAILABLE"); safe(result); }
    assert.equal((await f.controller.exposures()).rows.length, 0);
});
test("F22a workspace discovery is source-specific and public source is useful without evaluation", async t => {
    const f = await fixture(t); approve(t); const publicFile = join(f.root, "public.JSX"), other = join(f.root, "not-source.json"); await writeFile(publicFile, 'globalThis.__f22eval=true; const View=()=> <div title="public" />;'); await writeFile(other, "PUBLIC_CONTROL");
    t.mock.method(stub.workspace, "findFiles", async (include: any, exclude: unknown, max: number) => { assert.match(include.pattern, /\[jJ\]/); assert.equal(max, 129); return [f.uri, stub.Uri.file(publicFile), stub.Uri.file(other)] as never; });
    const result = await f.controller.reviewWorkspace(); assert.equal(result.status, "ANALYZED"); assert.equal(result.files, 2); assert.equal(result.findings.length, 1); assert.equal((globalThis as any).__f22eval, undefined); safe(result);
});
test("F22a source or owner policy drift while consent is pending refuses without records", async t => {
    const f = await fixture(t); t.mock.method(stub.window, "showWarningMessage", async (_m: string, _o: unknown, action: string) => { await updateRules(stub.Uri.file(f.root).toString(), r => ({ ...r, paths: [...r.paths, { kind: "file", pattern: "public.txt" }] })); return action; });
    assert.equal((await f.controller.reviewFile(f.uri)).status, "CHANGED"); assert.equal((await f.controller.exposures()).rows.length, 0);
});
test("F22a source flag withdrawal and operation expiry during vault review prevent late writes", async t => {
    let now = 0; const f = await fixture(t, { now: () => now }); approve(t); const scan = await f.controller.reviewFile(f.uri); assert.equal(scan.findings.length, 1);
    t.mock.method(stub.window, "showWarningMessage", async (_m: string, _o: unknown, action: string) => { now = 61000; return action; }); assert.notEqual((await f.controller.vaultFinding(scan.findings[0].id)).status, "APPLIED"); assert.equal(await readFile(f.file, "utf8"), TEXT);
    now = 0; stub.state.configInspect.set("soterai.lite.configScanner.source", { globalValue: false, workspaceValue: true }); assert.equal((await f.controller.vaultFinding(scan.findings[0].id)).status, "UNAVAILABLE"); assert.equal(await readFile(f.file, "utf8"), TEXT);
});
test("F22a safe source exposure export and metadata failure retain no originals in results", async t => {
    const f = await fixture(t); approve(t); const scan = await f.controller.reviewFile(f.uri); assert.equal(scan.findings.length, 1); assert.equal((await f.controller.exportLedger()).status, "EXPORTED");
    for (const entry of await readdir(join(f.profile, "hygiene-exports"))) safe(JSON.parse(await readFile(join(f.profile, "hygiene-exports", entry), "utf8")));
    t.mock.method(f.context.globalState, "update", async () => { throw Error(VALUE); }); const result = await f.controller.vaultFinding(scan.findings[0].id); assert.equal(result.status, "INCOMPLETE"); safe(result); assert(!(await readFile(f.file, "utf8")).includes(VALUE));
});

test("F22a source syntax remains bound for source filenames beginning with dotenv-like prefixes", async t => {
    const f = await fixture(t); approve(t); const file = join(f.root, ".env.production.ts"); await writeFile(file, TEXT);
    const result = await f.controller.reviewFile(stub.Uri.file(file) as unknown as vscode.Uri); assert.equal(result.status, "ANALYZED"); assert.equal(result.findings.length, 1); safe(result);
});
