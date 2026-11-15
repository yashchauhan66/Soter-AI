import "./phase2/register.mjs";
import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import * as fs from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import Module from "node:module";
import * as stub from "./phase2/vscode-stub";
import { ExtensionState } from "../state";
import { setOutputRedactorGuard, setSecretMatchingGuard } from "../secret-broker/runtime";

class NativeRange extends stub.Range {
    constructor(...args: any[]) { super(...(args.length === 4 ? [new stub.Position(args[0], args[1]), new stub.Position(args[2], args[3])] : args) as [stub.Position, stub.Position]); }
}
const closeDocument = new stub.EventEmitter();
const nativeWindow = new Proxy(stub.window, { get: (target, key) => key === "createTextEditorDecorationType" ? () => ({ dispose() {} }) : Reflect.get(target, key) });
const nativeWorkspace = new Proxy(stub.workspace, { get: (target, key) => key === "onDidCloseTextDocument" ? closeDocument.event : Reflect.get(target, key) });
const nativeVscode = { ...stub, __esModule: true, Range: NativeRange, OverviewRulerLane: { Right: 4 }, window: nativeWindow, workspace: nativeWorkspace };
const originalLoad = (Module as any)._load;
(Module as any)._load = function(request: string, ...args: unknown[]) { return request === "vscode" ? nativeVscode : originalLoad.call(this, request, ...args); };
const { LiveScanner } = require("../diagnostics/LiveScanner") as typeof import("../diagnostics/LiveScanner");

const raw = 'const cfg = { DB_PASSWORD: "BlueMango7!", API_PASSWORD: "OrangeRiver9!" };';
async function fixture(t: TestContext) {
    const root = await fs.mkdtemp(path.join(tmpdir(), "soterai-live-actions-")), file = path.join(root, "app.txt");
    await fs.writeFile(file, raw); stub.resetState(root);
    const diagnostics = new Map<string, any[]>();
    t.mock.method(stub.languages, "createDiagnosticCollection", () => ({ name: "soterai", set: (uri: any, values: any[]) => diagnostics.set(uri.toString(), values), delete: (uri: any) => diagnostics.delete(uri.toString()), clear: () => diagnostics.clear(), dispose() {} }));
    const document = Object.assign(stub.makeDocument(stub.Uri.file(file), raw), { version: 1, isClosed: false });
    const editor = { document, selection: new stub.Selection(new stub.Position(0, 0), new stub.Position(0, 0)), setDecorations() {} };
    stub.state.activeEditor = editor; stub.workspace.textDocuments = [document];
    const context = stub.makeExtensionContext(path.join(root, "storage"));
    const { initializeBoundaryState, BoundarySnapshot } = require("../ai-boundary/BoundarySnapshot");
    initializeBoundaryState(context.workspaceState); await BoundarySnapshot.load();
    const scanner = new LiveScanner(context as never);
    setSecretMatchingGuard(() => true); setOutputRedactorGuard(() => true);
    t.after(() => { scanner.dispose(); setSecretMatchingGuard(() => false); setOutputRedactorGuard(() => false); });
    await (scanner as any).scan(document);
    const issued = diagnostics.get(document.uri.toString()) ?? [];
    assert.ok(issued.length > 0, "Public fixture must produce actual secret findings");
    const actions = scanner.provideCodeActions(document as never, issued[0].range, { diagnostics: [issued[0]] } as never);
    const copy = actions.find(action => /safe version|sanitized/i.test(action.title)); assert.ok(copy?.command);
    return { scanner, document, diagnostics, copy: copy.command, context };
}
test("live quick-fix copies a reviewed useful line with every recognized secret removed", async t => {
    const f = await fixture(t);
    t.mock.method(stub.window as any, "showInformationMessage", async (_message: string, ...items: string[]) => items.includes("Copy reviewed text") ? "Copy reviewed text" : undefined);
    const { BoundarySnapshot } = require("../ai-boundary/BoundarySnapshot");
    const boundary = await BoundarySnapshot.load();
    assert.equal(boundary.blocks(f.document.uri), false, "Fixture must admit the public source file");
    await assert.doesNotReject(() => boundary.read(f.document.uri));
    await stub.commands.executeCommand(f.copy.command, ...(f.copy.arguments ?? []));
    assert.ok(!stub.state.clipboard.includes("BlueMango7!"));
    assert.ok(!stub.state.clipboard.includes("OrangeRiver9!"), "The second credential on the same line must not reach the clipboard");
    assert.match(stub.state.clipboard, /const cfg/, JSON.stringify(stub.sinks.filter(item => item.sink === "notification")));
});
test("closing the review without approval leaves clipboard and source unchanged", async t => {
    const f = await fixture(t); let previews = 0;
    t.mock.method(stub.window, "showTextDocument", async (document: unknown) => { previews++; return { document }; });
    stub.state.clipboard = "previous-public-clipboard";
    await stub.commands.executeCommand(f.copy.command, ...(f.copy.arguments ?? []));
    assert.equal(previews, 1); assert.equal(stub.state.clipboard, "previous-public-clipboard"); assert.equal(f.document.getText(), raw);
});
test("source edits during preview approval prevent a late copy", async t => {
    const f = await fixture(t);
    t.mock.method(stub.window as any, "showInformationMessage", async (_message: string, ...items: string[]) => {
        if (items.includes("Copy reviewed text")) { f.document.version++; return "Copy reviewed text"; }
    });
    stub.state.clipboard = "previous-public-clipboard";
    await stub.commands.executeCommand(f.copy.command, ...(f.copy.arguments ?? []));
    assert.equal(stub.state.clipboard, "previous-public-clipboard");
});
test("secret findings offer an owner vault review instead of deleting the credential", async t => {
    const f = await fixture(t), issued = f.diagnostics.get(f.document.uri.toString())!;
    const actions = f.scanner.provideCodeActions(f.document as never, issued[0].range, { diagnostics: [issued[0]] } as never);
    assert.ok(!actions.some(action => /replacing|redact this/i.test(action.title)));
    const vault = actions.find(action => /vault protection/i.test(action.title)); assert.ok(vault?.command);
    let calls = 0;
    stub.registeredCommands.set("soterai.migrateSecretsToVault", uri => { assert.equal(uri, f.document.uri); calls++; });
    assert.deepEqual(Object.keys(vault.command.arguments![0]), ["id"]);
    await stub.commands.executeCommand(vault.command.command, ...vault.command.arguments!);
    assert.equal(calls, 1);
    await stub.commands.executeCommand(vault.command.command, ...vault.command.arguments!);
    assert.equal(calls, 1, "A consumed action must not replay");
});
test("forged diagnostics and disabled filtering cannot produce copied content", async t => {
    const f = await fixture(t), issued = f.diagnostics.get(f.document.uri.toString())!;
    const fake = { ...issued[0], message: "forged" };
    assert.equal(f.scanner.provideCodeActions(f.document as never, fake.range, { diagnostics: [fake] } as never).length, 0);
    setOutputRedactorGuard(() => false);
    await stub.commands.executeCommand(f.copy.command, ...(f.copy.arguments ?? []));
    assert.equal(stub.state.clipboard, "");
});
test("a stale finding cannot copy newly changed content", async t => {
    const f = await fixture(t); f.document.version++;
    t.mock.method(f.document, "getText", () => 'const changed = "PRIVATE_NEW_CONTENT";');
    stub.state.clipboard = "previous-public-clipboard";
    await stub.commands.executeCommand(f.copy.command, ...(f.copy.arguments ?? []));
    assert.equal(stub.state.clipboard, "previous-public-clipboard");
});
test("a forwarded URI and range cannot make the quick-fix command open a caller-selected file", async t => {
    await fixture(t); let opens = 0;
    t.mock.method(stub.workspace, "openTextDocument", async () => { opens++; throw Error("CALLER_PRIVATE_PATH"); });
    await Promise.resolve(stub.commands.executeCommand(LiveScanner.fixableCommand, { kind: "copySafeLine", uri: "file:///C:/unrelated.env", range: { sl: 0, sc: 0, el: 0, ec: 1 }, category: "secret" })).catch(() => {});
    assert.equal(opens, 0);
});
test("closing a document during an asynchronous scan prevents late diagnostics", async t => {
    const f = await fixture(t), engine = ExtensionState.getInstance().engine;
    let release!: (value: any) => void;
    const waiting = new Promise<any>(resolve => { release = resolve; });
    t.mock.method(engine, "scan", async () => waiting);
    f.diagnostics.clear();
    const pending = (f.scanner as any).scan(f.document);
    f.document.isClosed = true;
    release({ findings: [{ id: "synthetic", category: "secret", severity: "high", title: "Possible secret", reason: "Review required", redactedEvidence: "[REDACTED]", start: 0, end: 5, confidence: 1 }], riskScore: 30 });
    await pending;
    assert.equal(f.diagnostics.size, 0);
});
test("an older scan cannot replace the result of a newer document version", async t => {
    const f = await fixture(t), engine = ExtensionState.getInstance().engine;
    let release!: (value: any) => void, first = true;
    const waiting = new Promise<any>(resolve => { release = resolve; });
    t.mock.method(engine, "scan", async () => { if (first) { first = false; return waiting; } return { findings: [], riskScore: 0 } as any; });
    const old = (f.scanner as any).scan(f.document);
    f.document.version++; t.mock.method(f.document, "getText", () => "public replacement");
    await (f.scanner as any).scan(f.document);
    release({ findings: [{ id: "old", category: "secret", severity: "high", title: "Old secret", reason: "Old result", redactedEvidence: "[REDACTED]", start: 0, end: 3, confidence: 1 }], riskScore: 30 });
    await old;
    assert.deepEqual(f.diagnostics.get(f.document.uri.toString()), []);
});
test("a failed primary scan reports incomplete status and issues no fix authority", async t => {
    const f = await fixture(t), engine = ExtensionState.getInstance().engine;
    t.mock.method(engine, "scan", async () => { throw Error("PRIVATE_ENGINE_ERROR"); });
    await (f.scanner as any).scan(f.document);
    const diagnostics = f.diagnostics.get(f.document.uri.toString())!;
    assert.equal(diagnostics.length, 1); assert.equal(diagnostics[0].code, "scan-incomplete");
    assert.ok(!JSON.stringify(diagnostics).includes("PRIVATE_ENGINE_ERROR"));
    assert.equal(f.scanner.provideCodeActions(f.document as never, diagnostics[0].range, { diagnostics } as never).length, 0);
});
