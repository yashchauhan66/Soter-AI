import "./phase2/register.mjs";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import fsp, { link, mkdir, mkdtemp, readFile, symlink, writeFile } from "node:fs/promises";
import childProcess from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { test, type TestContext } from "node:test";
import * as stub from "./phase2/vscode-stub";
import { initializeBoundaryState, updateRules } from "../ai-boundary/BoundarySnapshot";
import { HygieneExposureLedger, HYGIENE_LEDGER_KEY } from "../hygiene/HygieneExposureLedger";
import type { HygieneInput } from "../hygiene/HygieneAnalysis";

const PRIVATE = "TEST_ONLY_F24_ARTIFACT_CONTROLLER_PRIVATE_2ed4b967", ACTION = "Analyze local artifacts";
const SOURCE = 'const API_KEY = "' + PRIVATE + '";\nexport const PORT = 3000;\n';
const FLAG = "soterai.lite.artifactScanner";
const tick = () => new Promise<void>(done => setImmediate(done));
type Controller = { review(): Promise<any>; status(): { status: string; busy: boolean; scope: string }; current(value: unknown): boolean; withdraw(): void; dispose(): void };
type Constructor = new (context: unknown, options?: { now?: () => number }) => Controller;
const safe = (value: unknown) => {
    const text = JSON.stringify(value) ?? "";
    for (const denied of [PRIVATE, "artifact-private-source.ts", "API_KEY", "dist/private-artifact.js"]) assert(!text.includes(denied));
};
function gate<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => resolve = done); return { promise, resolve }; }
async function bounded<T>(promise: PromiseLike<T>): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try { return await Promise.race([Promise.resolve(promise), new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(Error("Synthetic artifact stage was not reached.")), 3000);
    })]); } finally { clearTimeout(timer); }
}
async function fixture(t: TestContext, options: { now?: () => number } = {}) {
    // Every file, alias and directory is synthetic and retained. No cleanup,
    // process launch, external reference, build or native profile is involved.
    const module = await import("../artifacts/ArtifactController"); assert.equal(typeof module.ArtifactController, "function");
    const base = await mkdtemp(join(tmpdir(), "soter-f24-artifact-controller-")), root = join(base, "project"), profile = join(base, "profile");
    await mkdir(root); await mkdir(profile); stub.resetState(root);
    const context = stub.makeExtensionContext(profile); context.globalStorageUri = stub.Uri.file(profile);
    initializeBoundaryState(context.workspaceState as never);
    const remote = Object.getOwnPropertyDescriptor(stub.env, "remoteName");
    Object.defineProperty(stub.env, "remoteName", { configurable: true, value: undefined });
    const secrets = new stub.EventEmitter<{ key: string }>(), configuration = new stub.EventEmitter<{ affectsConfiguration(name: string): boolean }>(), folders = new stub.EventEmitter<unknown>();
    context.secrets.onDidChange = secrets.event as never;
    t.mock.method(stub.workspace, "onDidChangeConfiguration", configuration.event);
    t.mock.method(stub.workspace, "onDidChangeWorkspaceFolders", folders.event);
    let opens = 0, children = 0, analyzerCalls = 0;
    const reads: string[] = [], privateInputs: HygieneInput[] = [], discovery: unknown[][] = [];
    const find = stub.workspace.findFiles;
    t.mock.method(stub.workspace, "findFiles", async (...args: Parameters<typeof find>) => { discovery.push(args); return Reflect.apply(find, stub.workspace, args); });
    const open = fsp.open;
    t.mock.method(fsp, "open", (...args: any[]) => {
        const file = args[0]; if (typeof file === "string" && !relative(root, file).startsWith("..")) reads.push(file);
        return Reflect.apply(open, fsp, args);
    });
    t.mock.method(stub.workspace, "openTextDocument", async () => { opens++; throw Error(PRIVATE); });
    t.mock.method(childProcess, "spawn", () => { children++; throw Error(PRIVATE); });
    let afterAnalyzer: (() => void | Promise<void>) | undefined, onAnalyze: ((input: HygieneInput) => void) | undefined;
    const create = HygieneExposureLedger.prototype.createAnalyzer;
    t.mock.method(HygieneExposureLedger.prototype, "createAnalyzer", async function (this: HygieneExposureLedger, ...args: Parameters<typeof create>) {
        analyzerCalls++; const analyzer = await Reflect.apply(create, this, args) as Awaited<ReturnType<typeof create>>;
        if (afterAnalyzer) await afterAnalyzer();
        return { ...analyzer,
            analyze(input: HygieneInput) { privateInputs.push(input); const result = analyzer.analyze(input); onAnalyze?.(input); return result; },
            analyzeSource(input: HygieneInput) { privateInputs.push(input); const result = analyzer.analyzeSource(input); onAnalyze?.(input); return result; },
        };
    });
    const controller = new (module.ArtifactController as unknown as Constructor)(context, options);
    const ledger = new HygieneExposureLedger(context.globalState, context.secrets), rootUri = stub.Uri.file(root).toString();
    const put = async (name: string, text: string | Buffer) => { const file = join(root, ...name.split("/")); await mkdir(dirname(file), { recursive: true }); await writeFile(file, text, { flag: "wx" }); return file; };
    const flag = (value: boolean) => { stub.state.configInspect.set(FLAG, { defaultValue: true, globalValue: value, workspaceValue: true }); configuration.fire({ affectsConfiguration: () => true }); };
    t.after(() => {
        controller.dispose(); secrets.dispose(); configuration.dispose(); folders.dispose(); context.subscriptions.forEach(value => value.dispose());
        if (remote) Object.defineProperty(stub.env, "remoteName", remote); else delete (stub.env as any).remoteName;
    });
    return { controller, context, root, rootUri, profile, base, ledger, put, flag, secrets, configuration, folders, reads, privateInputs, discovery,
        opened: () => opens, children: () => children, analyzers: () => analyzerCalls,
        afterAnalyzer(value: typeof afterAnalyzer) { afterAnalyzer = value; }, onAnalyze(value: typeof onAnalyze) { onAnalyze = value; } };
}
function approve(t: TestContext) {
    return t.mock.method(stub.window, "showWarningMessage", async (message: string, options: any, action: string) => {
        assert.equal(options.modal, true); assert.equal(action, ACTION); safe([message, options]); return action;
    });
}
async function emptyLedger(f: Awaited<ReturnType<typeof fixture>>) { const view = await f.ledger.view(f.rootUri); assert.deepEqual(view.rows, []); safe(view); }

test("F24 artifact construction and status do not discover, read content, create a key, open originals or launch a process", async t => {
    const f = await fixture(t);
    const status = f.controller.status(); assert.equal(status.status, "OWNER_REVIEW_REQUIRED"); assert.equal(status.busy, false); assert.equal(typeof status.scope, "string"); safe(status);
    assert.equal(f.discovery.length, 0); assert.equal(f.reads.length, 0); assert.equal(f.analyzers(), 0); assert.equal(f.opened(), 0); assert.equal(f.children(), 0);
    assert.equal(await f.context.secrets.get(HYGIENE_LEDGER_KEY), undefined); assert.equal(f.controller.current({ status: "ANALYZED", findings: [] }), false);
});

test("F24 native artifact cancellation precedes canonical content reads and analyzer-key creation", async t => {
    const f = await fixture(t); await f.put("dist/private-artifact.js", SOURCE); let prompts = 0;
    t.mock.method(stub.window, "showWarningMessage", async () => { prompts++; return undefined; });
    const value = await f.controller.review(); assert.equal(value.status, "CANCELLED"); assert.equal(prompts, 1); assert.equal(f.controller.current(value), false); safe(value);
    assert.equal(f.reads.length, 0); assert.equal(f.analyzers(), 0); assert.equal(await f.context.secrets.get(HYGIENE_LEDGER_KEY), undefined); await emptyLedger(f);
});

test("F24 approved artifact source review publishes exact keyed metadata and canonical possible-exposure rows", async t => {
    const f = await fixture(t), file = await f.put("dist/private-artifact.js", SOURCE); approve(t);
    const value = await f.controller.review(); assert.equal(value.status, "ANALYZED"); assert.equal(value.files, 1); assert.equal(value.skipped, 0); assert.equal(value.findings.length, 1); safe(value);
    assert.equal(f.controller.current(value), true); assert.equal(f.controller.current({ ...value }), false); assert.equal(f.controller.current(JSON.parse(JSON.stringify(value))), false);
    for (const field of ["id", "fileRef", "valueRef"]) assert.match(value.findings[0][field], /^[a-f0-9]{64}$/);
    const view = await f.ledger.view(f.rootUri); assert.equal(view.rows.length, 1); assert.equal(view.rows[0].lastAction, "possible-project-exposure"); safe(view);
    assert.equal(await readFile(file, "utf8"), SOURCE); assert.equal(await f.context.secrets.get("soterai.vaultKey"), undefined); assert.equal(f.opened(), 0); assert.equal(f.children(), 0);
});

test("F24 artifact source findings use a disjoint key domain from current-file and historical analysis", async t => {
    const f = await fixture(t); await f.put("dist/private-artifact.js", SOURCE); approve(t); const value = await f.controller.review(); assert.equal(value.findings.length, 1);
    const current = await f.ledger.createAnalyzer(f.rootUri), history = await f.ledger.createAnalyzer(f.rootUri, "history-v1");
    try {
        const input = { source: "dist/private-artifact.js", text: SOURCE, environment: false };
        for (const analysis of [current.analyzeSource(input), history.analyzeSource(input)]) assert.notEqual(value.findings[0].valueRef, analysis.findings[0].valueRef);
    } finally { current.dispose(); history.dispose(); }
    safe(value);
});

test("F24 discovery admits generated directories and a renamed source copy while excluding Git objects and node_modules", async t => {
    const f = await fixture(t); approve(t);
    for (const file of ["dist/app.js", "build/app.ts", "coverage/app.cjs", ".next/app.mjs", ".cache/app.jsx", "caches/app.tsx", "renamed.snapshot"]) await f.put(file, SOURCE);
    await f.put(".git/objects/private.txt", "PASSWORD=" + PRIVATE + "\n"); await f.put("node_modules/private.js", SOURCE);
    const value = await f.controller.review(); assert.equal(value.status, "ANALYZED"); assert.equal(value.files, 7); assert.equal(value.findings.length, 7); safe(value);
    assert(f.reads.every(file => !file.includes(join(".git", "objects")) && !file.includes("node_modules"))); assert.equal(f.opened(), 0);
});

test("F24 source-map embedded sources are private views and never cause referenced filesystem reads", async t => {
    const f = await fixture(t); approve(t);
    await f.put("dist/app.js.map", JSON.stringify({ version: 3, file: "app.js", sources: ["artifact-private-source.ts"], sourceRoot: "../../private-reference", names: [], mappings: "", sourcesContent: [SOURCE] }));
    const value = await f.controller.review(); assert.equal(value.status, "ANALYZED"); assert.equal(value.files, 1); assert.equal(value.findings.length, 1); safe(value);
    assert(f.privateInputs.some(input => input.text === SOURCE)); assert(f.reads.every(file => !file.includes("private-reference") && !file.endsWith("artifact-private-source.ts")));
    assert.equal(f.opened(), 0);
});

test("F24 malformed maps and binary artifacts remain explicitly incomplete without findings or ledger rows", async t => {
    const f = await fixture(t); approve(t); await f.put("dist/broken.js.map", '{"version":3,"sourcesContent":["' + PRIVATE);
    await f.put("build/binary.bin", Buffer.from([0, 1, 2, 255]));
    const value = await f.controller.review(); assert(["PARTIAL", "UNAVAILABLE"].includes(value.status)); assert.equal(value.findings?.length ?? 0, 0); safe(value); await emptyLedger(f);
});

test("F24 public artifact control remains useful with vault mode disabled and no vault key", async t => {
    const f = await fixture(t); approve(t); stub.state.configInspect.set("soterai.lite.vaultMode", { globalValue: false });
    await f.put("dist/public.js", "export const PORT = 3000;\n"); const value = await f.controller.review();
    assert.equal(value.status, "ANALYZED"); assert.equal(value.files, 1); assert.deepEqual(value.findings, []); assert.equal(await f.context.secrets.get("soterai.vaultKey"), undefined); safe(value);
});

test("F24 owner artifact and hygiene flags fail closed despite repository enables", async t => {
    const f = await fixture(t); approve(t); await f.put("dist/private-artifact.js", SOURCE);
    for (const name of [FLAG, "soterai.lite.hygieneAssistant"]) {
        for (const globalValue of [false, "true", 1]) {
            stub.state.configInspect.set(name, { defaultValue: true, globalValue, workspaceValue: true });
            const value = await f.controller.review(); assert.equal(value.status, "UNAVAILABLE"); assert.equal(f.controller.current(value), false); safe(value);
        }
        stub.state.configInspect.delete(name);
    }
    assert.equal(f.reads.length, 0); assert.equal(await f.context.secrets.get(HYGIENE_LEDGER_KEY), undefined);
});

test("F24 untrusted, remote, absent and multiple workspace roots refuse before key or content", async t => {
    const f = await fixture(t); approve(t); const folder = stub.state.folders[0]; stub.state.isTrusted = false;
    assert.equal((await f.controller.review()).status, "UNAVAILABLE"); stub.state.isTrusted = true;
    Object.defineProperty(stub.env, "remoteName", { configurable: true, value: "synthetic-remote" }); assert.equal((await f.controller.review()).status, "UNAVAILABLE");
    Object.defineProperty(stub.env, "remoteName", { configurable: true, value: undefined });
    for (const folders of [[], [folder, { ...folder, index: 1 }]]) { stub.state.folders = folders; assert.equal((await f.controller.review()).status, "UNAVAILABLE"); }
    assert.equal(f.reads.length, 0); assert.equal(await f.context.secrets.get(HYGIENE_LEDGER_KEY), undefined);
});

test("F24 disable and reenable during native approval stay revoked before content or key", async t => {
    const f = await fixture(t); await f.put("dist/private-artifact.js", SOURCE);
    t.mock.method(stub.window, "showWarningMessage", async () => { f.flag(false); f.flag(true); return ACTION; });
    const value = await f.controller.review(); assert.equal(value.status, "UNAVAILABLE"); assert.equal(f.reads.length, 0); assert.equal(await f.context.secrets.get(HYGIENE_LEDGER_KEY), undefined); safe(value);
});

test("F24 actual owner-policy drift during native approval cannot authorize artifact reads", async t => {
    const f = await fixture(t); await f.put("dist/private-artifact.js", SOURCE);
    t.mock.method(stub.window, "showWarningMessage", async () => { await updateRules(f.rootUri, rules => ({ ...rules, paths: [...rules.paths, { kind: "file", pattern: "synthetic-restricted.txt" }] })); return ACTION; });
    const value = await f.controller.review(); assert.equal(value.status, "UNAVAILABLE"); assert.equal(f.reads.length, 0); assert.equal(await f.context.secrets.get(HYGIENE_LEDGER_KEY), undefined); safe(value);
});

test("F24 withdrawal immediately after analyzer creation prevents subsequent private content reads", async t => {
    const f = await fixture(t); approve(t); await f.put("dist/private-artifact.js", SOURCE); f.afterAnalyzer(() => f.flag(false));
    const value = await f.controller.review(); assert.equal(value.status, "UNAVAILABLE"); assert.equal(f.privateInputs.length, 0); assert.equal(f.controller.current(value), false); safe(value); await emptyLedger(f);
});

test("F24 root replacement during a private await cannot publish artifact metadata", async t => {
    const f = await fixture(t); approve(t); await f.put("dist/private-artifact.js", SOURCE); const other = join(f.base, "other"); await mkdir(other);
    f.afterAnalyzer(() => { stub.setWorkspace(other); f.folders.fire({}); });
    const value = await f.controller.review(); assert.equal(value.status, "UNAVAILABLE"); assert.equal(f.privateInputs.length, 0); assert.equal(f.controller.current(value), false); safe(value);
    stub.setWorkspace(f.root); await emptyLedger(f);
});

test("F24 source changes after private analysis withhold the entire result and pending ledger findings", async t => {
    const f = await fixture(t), file = await f.put("dist/private-artifact.js", SOURCE); approve(t); let changed = false;
    f.onAnalyze(() => { if (!changed) { changed = true; writeFileSync(file, "export const PORT = 4000;\n"); } });
    const value = await f.controller.review(); assert.equal(changed, true); assert.equal(value.status, "UNAVAILABLE"); assert.equal(f.controller.current(value), false); safe(value); await emptyLedger(f);
});

test("F24 trust drift after a private analysis suppresses findings and subsequent publication", async t => {
    const f = await fixture(t); approve(t); await f.put("dist/private-artifact.js", SOURCE); f.onAnalyze(() => { stub.state.isTrusted = false; });
    const value = await f.controller.review(); assert.equal(value.status, "UNAVAILABLE"); assert.equal(f.controller.current(value), false); safe(value);
    stub.state.isTrusted = true; await emptyLedger(f);
});

test("F24 analyzer-key replacement during a private await discards pending candidates", async t => {
    const f = await fixture(t); approve(t); await f.put("dist/private-artifact.js", SOURCE);
    f.afterAnalyzer(async () => { await f.context.secrets.store(HYGIENE_LEDGER_KEY, Buffer.alloc(32, 74).toString("base64")); f.secrets.fire({ key: HYGIENE_LEDGER_KEY }); await tick(); });
    const value = await f.controller.review(); assert.equal(value.status, "UNAVAILABLE"); assert.equal(f.controller.current(value), false); safe(value); await emptyLedger(f);
});

test("F24 native approval expiry and monotonic clock reversal cannot publish artifact findings", async t => {
    let now = 0; const f = await fixture(t, { now: () => now }); await f.put("dist/private-artifact.js", SOURCE);
    t.mock.method(stub.window, "showWarningMessage", async () => { now = 60000; return ACTION; });
    assert.equal((await f.controller.review()).status, "UNAVAILABLE"); assert.equal(f.reads.length, 0); assert.equal(await f.context.secrets.get(HYGIENE_LEDGER_KEY), undefined);
    now = 1000; approve(t); f.onAnalyze(() => { now = 999; }); const value = await f.controller.review(); assert.equal(value.status, "UNAVAILABLE"); safe(value); await emptyLedger(f);
});

test("F24 one pending owner modal retains busy state and permits no second review", async t => {
    const f = await fixture(t), entered = gate<void>(), choice = gate<string>(); await f.put("dist/private-artifact.js", SOURCE);
    t.mock.method(stub.window, "showWarningMessage", async () => { entered.resolve(); return choice.promise; });
    const pending = f.controller.review(); await bounded(entered.promise); assert.equal(f.controller.status().busy, true); assert.equal(f.reads.length, 0); assert.equal(await f.context.secrets.get(HYGIENE_LEDGER_KEY), undefined);
    assert.equal((await f.controller.review()).status, "UNAVAILABLE"); choice.resolve(ACTION); assert.equal((await bounded(pending)).status, "ANALYZED"); assert.equal(f.controller.status().busy, false);
});

test("F24 disposal during an owner modal refuses the late native action before content or key", async t => {
    const f = await fixture(t), entered = gate<void>(), choice = gate<string>();
    t.mock.method(stub.window, "showWarningMessage", async () => { entered.resolve(); return choice.promise; }); const pending = f.controller.review(); await bounded(entered.promise);
    f.controller.dispose(); choice.resolve(ACTION); const value = await bounded(pending); assert.equal(value.status, "UNAVAILABLE"); assert.equal(f.controller.status().status, "UNAVAILABLE");
    assert.equal(f.reads.length, 0); assert.equal(await f.context.secrets.get(HYGIENE_LEDGER_KEY), undefined); assert.equal(f.controller.current(value), false); safe(value);
});

test("F24 failed canonical ledger persistence returns generic unavailable with no current finding authority", async t => {
    const f = await fixture(t); approve(t); await f.put("dist/private-artifact.js", SOURCE);
    t.mock.method(f.context.globalState, "update", async () => { throw Error(PRIVATE); });
    const value = await f.controller.review(); assert.equal(value.status, "UNAVAILABLE"); assert.equal(f.controller.current(value), false); safe(value); await emptyLedger(f);
});

test("F24 file-count sentinel and byte caps remain PARTIAL rather than a clean artifact claim", async t => {
    const f = await fixture(t); approve(t);
    for (let index = 0; index < 129; index++) await f.put("dist/public-" + index + ".txt", "PORT=3000\n");
    const capped = await f.controller.review(); assert.equal(capped.status, "PARTIAL"); assert(capped.files <= 128); assert(capped.skipped >= 1); assert.deepEqual(capped.findings, []); safe(capped);
});

test("F24 oversized regular artifact is skipped explicitly without reading more than the admitted file budget", async t => {
    const f = await fixture(t); approve(t); await f.put("dist/large.txt", "x".repeat(65537));
    const value = await f.controller.review(); assert.equal(value.status, "PARTIAL"); assert.equal(value.files, 0); assert(value.skipped >= 1); assert.deepEqual(value.findings, []); safe(value); await emptyLedger(f);
});

test("F24 aggregate admitted content never exceeds one MiB even when every individual artifact fits", async t => {
    const f = await fixture(t); approve(t); const text = "PORT=3000\n" + " ".repeat(65536 - 10);
    for (let index = 0; index < 17; index++) await f.put("build/public-" + index + ".txt", text);
    const value = await f.controller.review(); assert.equal(value.status, "PARTIAL"); assert(value.files <= 16); assert(value.skipped >= 1);
    const admitted = new Map(f.privateInputs.map(input => [input.source, Buffer.byteLength(input.text)]));
    assert([...admitted.values()].reduce((sum, bytes) => sum + bytes, 0) <= 1048576); safe(value);
});

test("F24 forged discovery outside the captured root and unsupported URI schemes grant no artifact read", async t => {
    const f = await fixture(t); approve(t); const outside = join(f.base, "outside-private.js"); await writeFile(outside, SOURCE, { flag: "wx" });
    for (const uri of [stub.Uri.file(outside), stub.Uri.parse("synthetic://remote/private.js")]) {
        t.mock.method(stub.workspace, "findFiles", async () => [uri]); const value = await f.controller.review(); assert.equal(value.status, "UNAVAILABLE"); assert.equal(value.findings?.length ?? 0, 0); safe(value);
    }
    assert.equal(f.privateInputs.length, 0); await emptyLedger(f);
});

test("F24 multiple hardlinks and a retained synthetic junction cannot provide artifact content authority", async t => {
    const f = await fixture(t); approve(t); const file = await f.put("dist/private-artifact.js", SOURCE); await link(file, join(f.base, "retained-hardlink.js"));
    t.mock.method(stub.workspace, "findFiles", async () => [stub.Uri.file(file)]); const hardlink = await f.controller.review(); assert.notEqual(hardlink.status, "ANALYZED"); assert.equal(hardlink.findings?.length ?? 0, 0); safe(hardlink);
    const target = join(f.base, "outside-junction-target"); await mkdir(target); await writeFile(join(target, "private.js"), SOURCE, { flag: "wx" });
    const junction = join(f.root, "retained-junction"); await symlink(target, junction, "junction");
    t.mock.method(stub.workspace, "findFiles", async () => [stub.Uri.file(join(junction, "private.js"))]); const linked = await f.controller.review(); assert.equal(linked.status, "UNAVAILABLE"); assert.equal(linked.findings?.length ?? 0, 0); safe(linked);
    assert.equal(f.privateInputs.length, 0); await emptyLedger(f);
});

test("F24 invalid ADS and Windows device discovery paths are rejected without analysis or disclosed path errors", async t => {
    const f = await fixture(t); approve(t);
    for (const name of ["dist/public.js:private", "dist/CON.txt", "dist/../private.js"]) {
        t.mock.method(stub.workspace, "findFiles", async () => [stub.Uri.file(join(f.root, name))]);
        const value = await f.controller.review(); assert.equal(value.status, "UNAVAILABLE"); assert.equal(value.findings?.length ?? 0, 0); safe(value);
    }
    assert.equal(f.privateInputs.length, 0);
});

test("F24 published result authority stays withdrawn after disable, source restoration or root reenable", async t => {
    const f = await fixture(t), file = await f.put("dist/private-artifact.js", SOURCE); approve(t); const first = await f.controller.review(); assert.equal(f.controller.current(first), true);
    f.flag(false); assert.equal(f.controller.current(first), false); f.flag(true); assert.equal(f.controller.current(first), false);
    const fresh = await f.controller.review(); assert.equal(f.controller.current(fresh), true); await writeFile(file, "export const PORT = 4000;\n"); assert.equal(f.controller.current(fresh), false);
    await writeFile(file, SOURCE); assert.equal(f.controller.current(fresh), false); assert.equal((await f.ledger.view(f.rootUri)).rows.length, 1);
});

test("F24 observed key change withdraws published authority synchronously before delayed key validation", async t => {
    const f = await fixture(t); approve(t); await f.put("dist/private-artifact.js", SOURCE); const value = await f.controller.review(); assert.equal(f.controller.current(value), true);
    const encoded = await f.context.secrets.get(HYGIENE_LEDGER_KEY), pending = gate<string | undefined>();
    t.mock.method(f.context.secrets, "get", async () => pending.promise); f.secrets.fire({ key: HYGIENE_LEDGER_KEY }); assert.equal(f.controller.current(value), false);
    pending.resolve(encoded); await tick(); await tick(); assert.equal(f.controller.current(value), false);
});

test("F24 ordinary policy and editor files coexist with a supported artifact without blocking private review", async t => {
    const f = await fixture(t); approve(t); await f.put("dist/private-artifact.js", SOURCE);
    const policy = await f.put(".soterai-policy.json", '{"protectedFiles":[],"syntheticOnly":true}\n');
    const editor = await f.put(".vscode/settings.json", '{"editor.tabSize":4,"soterai.lite.artifactScanner":false}\n');
    const value = await f.controller.review(); assert(["ANALYZED", "PARTIAL"].includes(value.status));
    assert.equal(value.files, 1); assert.equal(value.findings.length, 1); assert.equal(f.controller.current(value), true);
    if (value.status === "PARTIAL") assert(value.skipped >= 1);
    assert(!f.reads.includes(policy)); assert(!f.reads.includes(editor)); assert.equal(f.privateInputs.length, 1);
    const ledger = await f.ledger.view(f.rootUri); assert.equal(ledger.rows.length, 1); safe(value); safe(ledger);
    assert.equal(f.opened(), 0); assert.equal(f.children(), 0);
});
