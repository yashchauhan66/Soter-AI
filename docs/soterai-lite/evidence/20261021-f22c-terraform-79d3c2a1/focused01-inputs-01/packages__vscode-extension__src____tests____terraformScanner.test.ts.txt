import "./phase2/register.mjs";
import type * as vscode from "vscode";
import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createTerraformSecretPlan } from "../config-scanners/TerraformSecretPlan";
import { decryptVault, encryptVault } from "@soterai/guard-core";
import * as stub from "./phase2/vscode-stub";
import { initializeBoundaryState } from "../ai-boundary/BoundarySnapshot";
import { HygieneController } from "../hygiene/HygieneController";
import { VaultManager } from "../firewall/VaultManager";
import { HYGIENE_LEDGER_KEY } from "../hygiene/HygieneExposureLedger";
const VALUE = "TEST_ONLY_F22C_CONTROLLER_5f0d781a", TEXT = "API_KEY = \"TEST_ONLY_F22C_CONTROLLER_5f0d781a-key\"\nPASSWORD = <<-EOT\n  first\n  TEST_ONLY_F22C_CONTROLLER_5f0d781a-multiline\n  EOT\nPORT = 3000\n";
const safe = (v: unknown) => { const text = JSON.stringify(v) ?? ""; for (const value of [VALUE, "API_KEY", "PASSWORD"]) assert(!text.includes(value)); };
async function fixture(t: TestContext, options: object = {}) {
    const base = await mkdtemp(join(tmpdir(), "soterai-f22c-terraform-")), root = join(base, "project"), profile = join(base, "profile"); await mkdir(root); await mkdir(profile); stub.resetState(root);
    const context = stub.makeExtensionContext(profile); context.globalStorageUri = stub.Uri.file(profile); initializeBoundaryState(context.workspaceState as never); const file = join(root, "main.tfvars"), uri = stub.Uri.file(file) as unknown as vscode.Uri; await writeFile(file, TEXT); let opens = 0;
    t.mock.method(stub.workspace, "openTextDocument", async () => { opens++; throw Error(VALUE); }); const events = new stub.EventEmitter<{ key: string }>(); context.secrets.onDidChange = events.event as never;
    const controller = new HygieneController(context as never, { ...options, family: "terraform" } as never), manager = new VaultManager(context as never);
    t.after(() => { controller.dispose(); events.dispose(); context.subscriptions.forEach(d => d.dispose()); }); return { controller, manager, context, root, profile, file, uri, opens: () => opens, events };
}
function approve(t: TestContext) { return t.mock.method(stub.window, "showWarningMessage", async (message: string, options: unknown, action: string) => { safe([message, options]); return action; }); }

test("F22c canonical Terraform planner is explicitly selected and Terraform records require checkpoint restoration", async () => {
    const { createVaultMigrationPlan } = await import("../firewall/VaultMigrationPlan");
    const result = (createVaultMigrationPlan as any)(TEXT, false, "22000000-0000-4000-8000-000000000002", "tfvars"); assert.equal(result.candidates.length, 2); assert.equal(result.restoreMode, "checkpoint"); assert(!result.maskedText.includes(VALUE)); assert.equal(result.exampleText, "");
    assert.throws(() => (createVaultMigrationPlan as any)(TEXT, true, "22000000-0000-4000-8000-000000000002", "tfvars"));
});

test("F22c Terraform analysis exposes only keyed metadata and rejects other declared families", async () => {
    const m = await import("../hygiene/HygieneAnalysis"), analyze = (m as any).analyzeTerraformText; assert.equal(typeof analyze, "function"); const key = Buffer.alloc(32, 29), input = { source: "main.tfvars", text: TEXT, environment: false }, result = analyze(input, key);
    assert.equal(result.findings.length, 2); safe(result); assert.deepEqual(result, analyze(input, key)); assert.notEqual(result.fileRef, analyze(input, Buffer.alloc(32, 30)).fileRef);
    for (const bad of [{ ...input, source: "a.ts" }, { ...input, environment: true }, { ...input, approved: true }]) assert.throws(() => analyze(bad, key), e => !String(e).includes(VALUE));
});

test("F22c cancellation precedes canonical source capture/key creation and no original document is opened", async t => {
    const f = await fixture(t); let captures = 0; t.mock.method(VaultManager.prototype, "withHygieneSnapshot", async () => { captures++; throw Error(VALUE); }); t.mock.method(stub.window, "showWarningMessage", async () => undefined);
    assert.equal((await f.controller.reviewFile(f.uri)).status, "CANCELLED"); assert.equal(captures, 0); assert.equal(await f.context.secrets.get(HYGIENE_LEDGER_KEY), undefined); assert.equal(f.opens(), 0);
});

test("F22c reviewed Terraform migration and checkpoint disclosure restore exact bytes without invalid per-entry fallback", async t => {
    const f = await fixture(t); approve(t); const scan = await f.controller.reviewFile(f.uri); assert.equal(scan.status, "ANALYZED"); assert.equal(scan.findings.length, 2); safe(scan); const id = scan.findings[0].id;
    const fixed = await f.controller.vaultFinding(id); assert.equal(fixed.status, "APPLIED"); safe(fixed); const masked = await readFile(f.file, "utf8"); assert(!masked.includes(VALUE)); assert.equal(createTerraformSecretPlan(masked, "tfvars", "23000000-0000-4000-8000-000000000003").candidates.length, 0); await assert.rejects(readFile(join(f.root, ".env.example")), { code: "ENOENT" });
    await assert.rejects(f.manager.restore(f.uri), e => !String(e).includes(VALUE)); assert.equal(await readFile(f.file, "utf8"), masked);
    const restored = await f.controller.restoreFinding(id); assert.equal(restored.status, "RESTORED"); safe(restored); assert.equal(await readFile(f.file, "utf8"), TEXT); assert.equal(f.opens(), 0); assert(JSON.stringify([...f.context._inspect.workspaceStore]).includes('"sensitive":true')); safe(await f.controller.exposures());
});

test("F22c strict family machine flag/dependencies withdraw while repository enable grants no authority", async t => {
    const f = await fixture(t); approve(t); for (const globalValue of [false, "true"]) { stub.state.configInspect.set("soterai.lite.configScanner.terraform", { defaultValue: true, globalValue, workspaceValue: true }); assert.equal((await f.controller.reviewFile(f.uri)).status, "UNAVAILABLE"); }
    stub.state.configInspect.delete("soterai.lite.configScanner.terraform"); stub.state.configInspect.set("soterai.lite.hygieneAssistant", { globalValue: false }); assert.equal((await f.controller.reviewFile(f.uri)).status, "UNAVAILABLE"); assert.equal(await f.context.secrets.get(HYGIENE_LEDGER_KEY), undefined);
});

test("F22c family discovery admits public Terraform controls and does not evaluate config commands", async t => {
    const f = await fixture(t); approve(t); const publicFile = join(f.root, "public.tfvars"), text = "PORT = 3000\nMONKEY = \"banana\"\n"; await writeFile(publicFile, text);
    t.mock.method(stub.workspace, "findFiles", async (include: any, _exclude: unknown, max: number) => { assert.notEqual(include.pattern, "**/*"); assert.equal(max, 129); return [f.uri, stub.Uri.file(publicFile)] as never; });
    const result = await f.controller.reviewWorkspace(); assert.equal(result.status, "ANALYZED"); assert.equal(result.files, 2); assert.equal(result.findings.length, 2); safe(result); assert.equal(f.opens(), 0);
});

test("F22c unsupported/malformed input withholds complete findings and metadata export stays value-free", async t => {
    const f = await fixture(t); approve(t); const bad = join(f.root, "foreign.ts"); await writeFile(bad, "const PORT=3000;"); assert.equal((await f.controller.reviewFile(stub.Uri.file(bad) as unknown as vscode.Uri)).status, "UNSUPPORTED_TERRAFORM_CONFIG");
    await writeFile(f.file, 'API_KEY = "unterminated'); assert.equal((await f.controller.reviewFile(f.uri)).status, "UNAVAILABLE"); assert.equal((await f.controller.exposures()).rows.length, 0);
    await writeFile(f.file, TEXT); assert.equal((await f.controller.reviewFile(f.uri)).findings.length, 2); assert.equal((await f.controller.exportLedger()).status, "EXPORTED"); for (const name of await readdir(join(f.profile, "hygiene-exports"))) safe(JSON.parse(await readFile(join(f.profile, "hygiene-exports", name), "utf8")));
});

test("F22c guarded Terraform migration API refuses disabled family before creating a vault key", async t => {
    const f = await fixture(t), migrate = (f.manager as any).migrateTerraform; assert.equal(typeof migrate, "function"); approve(t); stub.state.configInspect.set("soterai.lite.configScanner.terraform", { globalValue: false, workspaceValue: true });
    await assert.rejects(migrate.call(f.manager, f.uri, () => true), e => !String(e).includes(VALUE)); assert.equal(await f.context.secrets.get("soterai.vaultKey"), undefined); assert.equal(await readFile(f.file, "utf8"), TEXT);
});

test("F22c late flag withdrawal/lease expiry prevents migration and checkpoint disclosure writes", async t => {
    let now = 0; const f = await fixture(t, { now: () => now }); approve(t); const scan = await f.controller.reviewFile(f.uri); assert.equal(scan.findings.length, 2); const id = scan.findings[0].id;
    t.mock.method(stub.window, "showWarningMessage", async (_m: string, _o: unknown, action: string) => { now = 61000; return action; }); assert.notEqual((await f.controller.vaultFinding(id)).status, "APPLIED"); assert.equal(await readFile(f.file, "utf8"), TEXT);
    now = 0; approve(t); assert.equal((await f.controller.vaultFinding(id)).status, "APPLIED"); const masked = await readFile(f.file, "utf8");
    t.mock.method(stub.window, "showWarningMessage", async (_m: string, _o: unknown, action: string) => { stub.state.configInspect.set("soterai.lite.configScanner.terraform", { globalValue: false }); return action; }); assert.notEqual((await f.controller.restoreFinding(id)).status, "RESTORED"); assert.equal(await readFile(f.file, "utf8"), masked);
});

test("F22c post-migration metadata failure retains valid masked Terraform and encrypted recovery without plaintext rollback", async t => {
    const f = await fixture(t); approve(t); const scan = await f.controller.reviewFile(f.uri); assert.equal(scan.findings.length, 2); t.mock.method(f.context.globalState, "update", async () => { throw Error(VALUE); });
    const result = await f.controller.vaultFinding(scan.findings[0].id); assert.equal(result.status, "INCOMPLETE"); safe(result); const masked = await readFile(f.file, "utf8"); assert(!masked.includes(VALUE)); assert.equal(createTerraformSecretPlan(masked, "tfvars", "23000000-0000-4000-8000-000000000003").candidates.length, 0);
    for (const name of await readdir(f.profile)) if (name.endsWith(".enc")) assert(!(await readFile(join(f.profile, name), "utf8")).includes(VALUE));
    assert.equal(await f.manager.restoreFromBackup(f.uri, () => true), true); assert.equal(await readFile(f.file, "utf8"), TEXT);
});

test("F22c interrupted Terraform write remains incomplete and canonical safe recovery finishes quoted placeholders", async t => {
    const f = await fixture(t); approve(t); const scan = await f.controller.reviewFile(f.uri); const write = stub.workspace.fs.writeFile; let fail = true;
    t.mock.method(stub.workspace.fs, "writeFile", async (uri: any, bytes: Uint8Array) => { if (uri.toString() === f.uri.toString() && fail) throw Error(VALUE); return write.call(stub.workspace.fs, uri, bytes); });
    const result = await f.controller.vaultFinding(scan.findings[0].id); assert.notEqual(result.status, "APPLIED"); safe(result); assert.equal(await readFile(f.file, "utf8"), TEXT); assert(JSON.stringify([...f.context._inspect.workspaceStore]).includes('"sensitive":true'));
    fail = false; assert.equal(await f.manager.recoverMigration(f.uri), true); const masked = await readFile(f.file, "utf8"); assert(!masked.includes(VALUE)); assert.equal(createTerraformSecretPlan(masked, "tfvars", "23000000-0000-4000-8000-000000000003").candidates.length, 0); assert.equal(await f.manager.restoreFromBackup(f.uri, () => true), true); assert.equal(await readFile(f.file, "utf8"), TEXT);
});

test("F22c unknown encrypted entry restore modes fail closed before any per-entry mutation", async t => {
    const f = await fixture(t); approve(t); const scan = await f.controller.reviewFile(f.uri); assert.equal((await f.controller.vaultFinding(scan.findings[0].id)).status, "APPLIED"); const masked = await readFile(f.file, "utf8"), file = join(f.profile, "soterai-vault.enc"), key = await f.context.secrets.get("soterai.vaultKey"); assert(key);
    const raw = JSON.parse(await decryptVault(await readFile(file, "utf8"), key)); assert(raw.entries.some((e: any) => e.restoreMode === "checkpoint")); raw.entries[0].restoreMode = "unknown-mode"; await writeFile(file, await encryptVault(JSON.stringify(raw), key));
    await assert.rejects(f.manager.restore(f.uri), e => !String(e).includes(VALUE)); assert.equal(await readFile(f.file, "utf8"), masked); assert.equal(f.opens(), 0);
});

test("F22c metadata failure after approved Terraform disclosure reports INCOMPLETE without claiming plaintext stayed masked", async t => {
    const f = await fixture(t); approve(t); const scan = await f.controller.reviewFile(f.uri); assert.equal((await f.controller.vaultFinding(scan.findings[0].id)).status, "APPLIED"); t.mock.method(f.context.globalState, "update", async () => { throw Error(VALUE); });
    const result = await f.controller.restoreFinding(scan.findings[0].id); assert.equal(result.status, "INCOMPLETE"); safe(result); assert.equal(await readFile(f.file, "utf8"), TEXT); assert(JSON.stringify([...f.context._inspect.workspaceStore]).includes('"sensitive":true')); assert.equal(f.opens(), 0);
});

test("F22c bounded discovery combines separate family query results and deduplicates repeated matches", async t => {
    const f = await fixture(t); approve(t); const file = join(f.root, "public.tfvars"); await writeFile(file, "PORT = 3000\nMONKEY = \"banana\"\n"); const other = stub.Uri.file(file); let queries = 0;
    t.mock.method(stub.workspace, "findFiles", async (_include: unknown, _exclude: unknown, max: number) => { assert.equal(max, 129); queries++; assert(queries <= 2, "Discovery metadata query budget"); return (queries === 1 ? [f.uri] : [f.uri, other]) as never; });
    const result = await f.controller.reviewWorkspace(); assert(queries >= 2); assert.equal(result.status, "ANALYZED"); assert.equal(result.files, 2); assert.equal(result.findings.length, 2); assert.equal(result.capped, false); safe(result); assert.equal(f.opens(), 0);
});

test("F22c raw discovery cap remains partial with at most128 public files analyzed", async t => {
 const f=await fixture(t); approve(t); const files=Array.from({length:129},(_,i)=>stub.Uri.file(join(f.root,"public"+i+".tfvars"))); await Promise.all(files.map(uri=>writeFile(uri.fsPath,"PORT = 3000\n"))); let queries=0; t.mock.method(stub.workspace,"findFiles",async (_i:unknown,_e:unknown,max:number)=>{assert.equal(max,129);queries++;return files as never}); const result=await f.controller.reviewWorkspace();assert.equal(result.status,"PARTIAL");assert.equal(result.capped,true);assert.equal(result.files,128);assert.equal(result.findings.length,0);assert.equal(queries,1);safe(result);assert.equal(f.opens(),0);
});
