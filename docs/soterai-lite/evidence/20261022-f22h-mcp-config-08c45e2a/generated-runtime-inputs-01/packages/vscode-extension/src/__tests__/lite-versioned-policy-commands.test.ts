import "./phase2/register.mjs";
import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import * as stub from "./phase2/vscode-stub";
import { BoundarySnapshot, exportRootPolicy, RULES_KEY, updateRules, updateVersionedPolicy } from "../ai-boundary/BoundarySnapshot";
import { registerAIBoundaryCommands } from "../ai-boundary/commands";
import { registerProjectPrivacyCommands } from "../project-privacy/commands";
import { documentDigest, OMITTED } from "../ai-boundary/policy";
import { parseVersionedPolicyText } from "../ai-boundary/VersionedPolicy";
const FLAG = "soterai.lite.versionedPolicy", marker = "SYNTHETIC_F02_PRIVATE_FILE_CONTENT";
let root: string, context: ReturnType<typeof stub.makeExtensionContext>;
let picked: stub.Uri | undefined, destination: stub.Uri | undefined, consent: string | undefined;
let providers: Map<string, { createUri(uri: stub.Uri): stub.Uri; provideTextDocumentContent(uri: stub.Uri): Promise<string>; onDidChange(listener: (uri: stub.Uri) => void): stub.Disposable }>;
const originals = Object.getOwnPropertyDescriptors(stub.window), wsOriginal = Object.getOwnPropertyDescriptor(stub.workspace, "registerTextDocumentContentProvider");
const uri = (relative: string) => stub.Uri.file(join(root, relative));
const key = () => stub.state.folders[0].uri.toString();
const incoming = (sensitiveGlobs = ["memo.txt"]) => ({ schemaVersion: 1, presets: [], rules: { paths: [{ kind: "file", pattern: "imported.txt" }], regions: [] }, sensitiveGlobs });
const expectStatus = (result: unknown, status: string) => assert.deepEqual(result, { status });
beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "soterai-f02-commands-")); stub.resetState(root); context = stub.makeExtensionContext(root);
    await mkdir(join(root, ".soterai")); await writeFile(join(root, "memo.txt"), marker); await writeFile(join(root, "public.txt"), "Useful public control.");
    await writeFile(join(root, ".soterai/incoming.json"), JSON.stringify(incoming()));
    picked = uri(".soterai/incoming.json"); destination = uri("policy.export.json"); consent = "Add protection";
    Object.assign(stub.window, { showWorkspaceFolderPick: async () => stub.state.folders[0], showOpenDialog: async () => picked ? [picked] : undefined, showSaveDialog: async () => destination,
        showQuickPick: async (items: { id: string }[]) => items.find(item => item.id === "ci"), showWarningMessage: async () => consent });
    providers = new Map();
    Object.assign(stub.workspace, { registerTextDocumentContentProvider: (scheme: string, provider: never) => { providers.set(scheme, provider); return new stub.Disposable(); } });
    registerAIBoundaryCommands(context as never); registerProjectPrivacyCommands(context as never);
    await BoundarySnapshot.load(); stub.resetSinks();
});
afterEach(async () => {
    mock.restoreAll(); context.subscriptions.forEach(item => item.dispose());
    for (const name of Object.keys(stub.window)) if (!(name in originals)) delete (stub.window as unknown as Record<string, unknown>)[name];
    Object.defineProperties(stub.window, originals);
    if (wsOriginal) Object.defineProperty(stub.workspace, "registerTextDocumentContentProvider", wsOriginal); else delete (stub.workspace as unknown as Record<string, unknown>).registerTextDocumentContentProvider;
    const target = resolve(root); assert.equal(dirname(target), resolve(tmpdir())); assert.ok(basename(target).startsWith("soterai-f02-commands-")); await rm(target, { recursive: true, force: true });
});
test("F02-C01 UI import adds denied paths and sensitivity with useful public control", async () => {
    expectStatus(await stub.commands.executeCommand("soterai.importLitePolicy"), "SAVED");
    const snapshot = await BoundarySnapshot.load();
    assert.equal(snapshot.blocks(uri("imported.txt") as never), true); assert.equal(snapshot.isSensitive(uri("memo.txt") as never), true);
    assert.equal(await snapshot.read(uri("memo.txt") as never), OMITTED); assert.equal(await snapshot.read(uri("public.txt") as never), "Useful public control.");
    assert.ok(!stub.capturedText().includes(marker));
});
test("F02-C02 cancelled choice/review and supplied arguments never bypass owner UI", async () => {
    picked = undefined; expectStatus(await stub.commands.executeCommand("soterai.importLitePolicy", incoming(), true), "CANCELLED");
    picked = uri(".soterai/incoming.json"); consent = undefined; const before = exportRootPolicy(key());
    expectStatus(await stub.commands.executeCommand("soterai.importLitePolicy", incoming(), "Add protection"), "CANCELLED");
    assert.deepEqual(exportRootPolicy(key()), before);
});
test("F02-C03 malformed/future import and persistence failure report no saved confirmation", async () => {
    await writeFile(picked!.fsPath, JSON.stringify({ ...incoming(), schemaVersion: 99 }));
    expectStatus(await stub.commands.executeCommand("soterai.importLitePolicy"), "FAILED");
    await writeFile(picked!.fsPath, JSON.stringify(incoming()));
    const before = structuredClone(context.workspaceState.get(RULES_KEY));
    mock.method(context.workspaceState, "update", async () => { throw new Error(marker); });
    expectStatus(await stub.commands.executeCommand("soterai.importLitePolicy"), "FAILED");
    assert.deepEqual(context.workspaceState.get(RULES_KEY), before);
    assert.doesNotMatch(stub.capturedText(), /policy protection saved/); assert.ok(!stub.capturedText().includes(marker));
});
test("F02-C04 reviewed file change and root drift fail without importing different policy", async () => {
    mock.method(stub.window, "showWarningMessage", async () => { await writeFile(picked!.fsPath, JSON.stringify(incoming(["other.txt"]))); return "Add protection"; });
    expectStatus(await stub.commands.executeCommand("soterai.importLitePolicy"), "FAILED");
    assert.equal(exportRootPolicy(key()).sensitiveGlobs.includes("other.txt"), false);
    mock.method(stub.window, "showWarningMessage", async () => { stub.state.folders = []; return "Add protection"; });
    expectStatus(await stub.commands.executeCommand("soterai.importLitePolicy"), "FAILED");
});
test("F02-C05 export round-trip contains legacy sensitive files and regions plus accepted imported rules", async () => {
    await updateRules(key(), current => ({ ...current, paths: [{ kind: "file", pattern: "custom.txt", sensitive: true }], regions: [{ path: "region.txt", digest: documentDigest("synthetic region"), start: 0, end: 4 }] }));
    expectStatus(await stub.commands.executeCommand("soterai.importLitePolicy"), "SAVED");
    expectStatus(await stub.commands.executeCommand("soterai.exportLitePolicy"), "EXPORTED");
    const text = await readFile(destination!.fsPath, "utf8"), exported = parseVersionedPolicyText(text);
    assert.deepEqual(exported, exportRootPolicy(key())); assert.ok(exported.rules.paths.some(rule => rule.pattern === "custom.txt" && rule.sensitive === true));
    assert.equal(exported.rules.regions.length, 1); assert.ok(exported.sensitiveGlobs.includes("memo.txt")); assert.ok(!text.includes(marker));
    const second = join(root, "second-root"); await mkdir(second); const secondUri = stub.Uri.file(second);
    stub.state.folders.push({ uri: secondUri, name: "second", index: 1 }); await updateVersionedPolicy(secondUri.toString(), exported);
    // VS Code chooses the most specific workspace root; the generic stub uses
    // first-match and would misattribute this deliberately nested second root.
    mock.method(stub.workspace, "getWorkspaceFolder", (target: stub.Uri) => stub.state.folders
        .filter(folder => target.fsPath === folder.uri.fsPath || target.fsPath.startsWith(folder.uri.fsPath + "/") || target.fsPath.startsWith(folder.uri.fsPath + "\\"))
        .sort((a, b) => b.uri.fsPath.length - a.uri.fsPath.length)[0]);
    const snapshot = await BoundarySnapshot.load(); assert.equal(snapshot.isSensitive(stub.Uri.file(join(second, "custom.txt")) as never), true);
    assert.equal(snapshot.blocks(stub.Uri.file(join(second, "imported.txt")) as never), true);
});
test("F02-C06 export refuses existing and outside-root destinations without changing files", async () => {
    await writeFile(destination!.fsPath, "Synthetic existing export.");
    expectStatus(await stub.commands.executeCommand("soterai.exportLitePolicy"), "FAILED");
    assert.equal(await readFile(destination!.fsPath, "utf8"), "Synthetic existing export.");
    destination = stub.Uri.file(join(dirname(root), "outside-f02.json"));
    expectStatus(await stub.commands.executeCommand("soterai.exportLitePolicy"), "FAILED");
});
test("F02-C07 stack selection expands sensitive patterns and flag withdrawal preserves them", async () => {
    expectStatus(await stub.commands.executeCommand("soterai.applyLitePolicyPreset"), "SAVED");
    assert.equal((await BoundarySnapshot.load()).isSensitive(uri(".vscode/settings.json") as never), true);
    stub.state.config.set(FLAG, false);
    for (const command of ["soterai.importLitePolicy", "soterai.exportLitePolicy", "soterai.applyLitePolicyPreset"]) expectStatus(await stub.commands.executeCommand(command), "UNAVAILABLE");
    const snapshot = await BoundarySnapshot.load(); assert.equal(snapshot.isSensitive(uri(".vscode/settings.json") as never), true);
    assert.equal(await snapshot.read(uri("public.txt") as never), "Useful public control.");
});
test("F02-C08 policy-only sensitivity change expires an in-flight safe-read approval", async () => {
    await updateRules(key(), current => ({ ...current, paths: [{ kind: "file", pattern: "memo.txt" }] }));
    let finish!: (answer: string) => void, started!: () => void;
    const reviewing = new Promise<void>(done => { started = done; });
    mock.method(stub.window, "showWarningMessage", () => new Promise<string>(done => { finish = done; started(); }));
    const read = stub.commands.executeCommand("soterai.readProjectFileSafely", uri("memo.txt")); await reviewing;
    await updateVersionedPolicy(key(), incoming() as never);
    finish("Allow safe read once"); expectStatus(await read, "EXPIRED"); assert.ok(!stub.capturedText().includes(marker));
});
test("F02-C09 protection changed during metadata review invalidates the import without removing the stronger deny", async () => {
    mock.method(stub.window, "showWarningMessage", async () => { await updateRules(key(), current => ({ ...current, paths: [{ kind: "file", pattern: "concurrent.txt" }] })); return "Add protection"; });
    expectStatus(await stub.commands.executeCommand("soterai.importLitePolicy"), "FAILED");
    const snapshot = await BoundarySnapshot.load(); assert.equal(snapshot.blocks(uri("concurrent.txt") as never), true);
    assert.equal(exportRootPolicy(key()).rules.paths.some(rule => rule.pattern === "imported.txt"), false);
    assert.equal(await snapshot.read(uri("public.txt") as never), "Useful public control.");
});
test("F02-C10 accepted imports refresh previously open managed previews", async () => {
    const provider = providers.get("soterai-redacted")!; const view = provider.createUri(uri("memo.txt"));
    assert.ok((await provider.provideTextDocumentContent(view)).includes(marker));
    const changed: string[] = []; context.subscriptions.push(provider.onDidChange(target => changed.push(target.toString())));
    await updateVersionedPolicy(key(), incoming() as never);
    assert.ok(changed.includes(view.toString()), "Existing managed preview must be invalidated after policy-only changes.");
    assert.equal(await provider.provideTextDocumentContent(view), OMITTED);
});
