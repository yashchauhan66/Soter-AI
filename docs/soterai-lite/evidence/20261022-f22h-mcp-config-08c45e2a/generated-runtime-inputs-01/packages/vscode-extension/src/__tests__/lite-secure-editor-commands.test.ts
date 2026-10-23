import "./phase2/register.mjs";
import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import * as stub from "./phase2/vscode-stub";
import { BoundarySnapshot, initializeBoundaryState, updateRules } from "../ai-boundary/BoundarySnapshot";
import { registerProjectPrivacyCommands } from "../project-privacy/commands";
import { registerPolicyDriftMonitor } from "../ai-boundary/PolicyDrift";
import { withManualRestriction } from "../ai-boundary/RestrictionOperation";

// Actual command registration remains importable before F05 exists. The fixture
// supplies only missing VS Code APIs, never an alternate editor implementation.
const VIEW_TYPE = "soterai.secureEditor", FLAG = "soterai.lite.secureEditor";
const COMMENT = "SYNTHETIC_F05_COMMENT_NEVER_DEFAULT_VISIBLE";
const URL = "postgresql://synthetic:fake-only@f05.invalid/original";
const API = "SYNTHETIC_F05_API_VALUE_NEVER_DEFAULT_VISIBLE";
const NEW_URL = "postgresql://synthetic:fake-only@f05-edit.invalid/new-value";
const SOURCE = `# ${COMMENT}\r\nDATABASE_URL = '${URL}'\r\nAPI_KEY=${API}\r\nDUP=one\r\nDUP=two\r\nMULTI="first\r\nSHADOW_SYNTHETIC=inside-value\r\nlast"\r\n`;
type Token = { isCancellationRequested: boolean; onCancellationRequested: (handler: () => void) => { dispose(): void } };
type Document = { uri: stub.Uri; dispose(): void };
type EditEvent = { document: Document; label?: string; undo(): void | Promise<void>; redo(): void | Promise<void> };
type Backup = { id: string; delete(): void | Promise<void> };
type Provider = {
    openCustomDocument(uri: stub.Uri, context: { backupId?: string }, token: Token): Promise<Document>;
    resolveCustomEditor(document: Document, panel: unknown, token: Token): Promise<void>;
    saveCustomDocument(document: Document, token: Token): Promise<void>;
    saveCustomDocumentAs(document: Document, uri: stub.Uri, token: Token): Promise<void>;
    revertCustomDocument(document: Document, token: Token): Promise<void>;
    backupCustomDocument(document: Document, context: { destination: stub.Uri }, token: Token): Promise<Backup>;
    onDidChangeCustomDocument(listener: (event: EditEvent) => void): { dispose(): void };
};
type Binding = { session: string; revision: number; field: string };
type ViewMessageReceiver = (message: unknown) => void | Promise<void>;
interface View {
    visible: boolean; active: boolean; disposed: boolean;
    updates: Array<{ kind: "html" | "message"; value: unknown }>;
    webview: { options: object; cspSource: string; html: string;
        onDidReceiveMessage(listener: ViewMessageReceiver): stub.Disposable;
        postMessage(value: unknown): Promise<boolean>; asWebviewUri(value: stub.Uri): stub.Uri };
    onDidDispose(listener: () => void): stub.Disposable;
    onDidChangeViewState(listener: (event: unknown) => void): stub.Disposable;
    send(value: unknown): Promise<void>; capturedReceiver(): ViewMessageReceiver;
    hide(): void; reveal(): void; dispose(): void;
}
let container: string, root: string, storage: string, context: ReturnType<typeof stub.makeExtensionContext>;
let provider: Provider | undefined, providerOptions: unknown, providerType: string | undefined;
let ownerApproval: boolean, input: string | undefined, inputOptions: Array<{ password?: boolean; value?: string }>;
let confirmation: ((message: string, actions: unknown[]) => Promise<string | undefined>) | undefined;
let confirmations: string[], infos: string[], editEvents: EditEvent[], originalDocumentCalls: number;
let openWith: unknown[][], nativeDiffs: string[][], views: View[], documents: Document[];
let associations: Record<string, string>, associationUpdates: Array<{ value: unknown; target: unknown }>, associationWriteFault: boolean, associationUpdateNoop: boolean, associationApplyThenThrow: boolean;
let textProviders: Map<string, { provideTextDocumentContent(uri: stub.Uri): string | Promise<string> }>;
let configListeners: Array<(event: { affectsConfiguration(section: string): boolean }) => void>;
let originalOpenListeners: Array<(document: unknown) => void | Promise<void>>;
let watcherChanges: Array<(uri: stub.Uri) => void | Promise<void>>;
const windowOriginals = Object.getOwnPropertyDescriptors(stub.window);
const workspaceOriginals = Object.getOwnPropertyDescriptors(stub.workspace);
const token = (cancelled = false): Token => ({ isCancellationRequested: cancelled, onCancellationRequested: () => new stub.Disposable() });
const uri = (relative: string) => stub.Uri.file(join(root, relative));
const noValues = (text: string) => { for (const value of [COMMENT, URL, API, NEW_URL]) assert.ok(!text.includes(value), "No original/draft values may appear in a masked sink."); };
const instance = (): Provider => { assert.equal(providerType, VIEW_TYPE, "Secure custom-editor registration must exist."); assert.ok(provider); return provider; };
async function write(relative: string, text: string | Uint8Array): Promise<void> {
    await mkdir(dirname(join(root, relative)), { recursive: true }); await writeFile(join(root, relative), text);
}
function makeView(): View {
    let html = "", receiver: ((message: unknown) => void | Promise<void>) | undefined;
    const receiveListeners = new Set<(message: unknown) => void | Promise<void>>();
    const disposeListeners = new Set<() => void>(), visibilityListeners = new Set<(event: unknown) => void>();
    const updates: Array<{ kind: "html" | "message"; value: unknown }> = [];
    const view: View = {
        visible: true, active: true, disposed: false, updates,
        webview: {
            options: {}, cspSource: "vscode-resource:",
            get html() { return html; },
            set html(value: string) { html = value; updates.push({ kind: "html", value }); stub.recordSink("secure-editor.html", "masked-view", value); },
            onDidReceiveMessage(listener: (message: unknown) => void | Promise<void>) {
                receiver = listener; receiveListeners.add(listener); return new stub.Disposable(() => receiveListeners.delete(listener));
            },
            async postMessage(value: unknown) { updates.push({ kind: "message", value: structuredClone(value) }); stub.recordSink("secure-editor.message", "owner-view", JSON.stringify(value)); return true; },
            asWebviewUri(value: stub.Uri) { return value; },
        },
        onDidDispose(listener: () => void) { disposeListeners.add(listener); return new stub.Disposable(() => disposeListeners.delete(listener)); },
        onDidChangeViewState(listener: (event: unknown) => void) { visibilityListeners.add(listener); return new stub.Disposable(() => visibilityListeners.delete(listener)); },
        async send(value: unknown) { for (const listener of [...receiveListeners]) await listener(value); },
        capturedReceiver() { assert.ok(receiver); return receiver; },
        hide() { view.visible = false; for (const listener of [...visibilityListeners]) listener({ webviewPanel: view }); },
        reveal() { view.visible = true; for (const listener of [...visibilityListeners]) listener({ webviewPanel: view }); },
        dispose() { if (view.disposed) return; view.disposed = true; for (const listener of [...disposeListeners]) listener(); },
    };
    views.push(view); return view;
}
function binding(view: View, fieldIndex = 0): Binding {
    const html = view.webview.html;
    const session = /data-session=["']([^"']+)["']/.exec(html)?.[1];
    const rawRevision = /data-revision=["']([^"']+)["']/.exec(html)?.[1];
    const fields = [...new Set([...html.matchAll(/data-field=["']([^"']+)["']/g)].map(match => match[1]))];
    assert.ok(session, "The masked view must bind its own opaque session token.");
    assert.match(session, /^[0-9a-f-]{36}$/i); assert.ok(rawRevision !== undefined);
    const revision = Number(rawRevision); assert.ok(Number.isSafeInteger(revision) && revision >= 0);
    assert.ok(fields[fieldIndex], "Masked field actions must use opaque ids.");
    return { session, revision, field: fields[fieldIndex] };
}
async function open(relative = ".env", backupId?: string): Promise<{ document: Document; view: View }> {
    const actual = instance(), document = await actual.openCustomDocument(uri(relative), { backupId }, token());
    documents.push(document); const view = makeView(); await actual.resolveCustomEditor(document, view, token()); return { document, view };
}
async function edit(view: View, value = NEW_URL): Promise<void> { input = value; await view.send({ type: "edit", ...binding(view) }); }
function assertMasked(view: View): void { noValues(view.webview.html); assert.match(view.webview.html, /MASKED|[Mm]asked|\u2022{3,}/); }
function assertCleared(view: View, before: number): void {
    assert.ok(view.updates.length > before, "An already revealed view must receive a clearing update.");
    noValues(JSON.stringify(view.updates.at(-1))); assertMasked(view);
}
async function ownedFiles(directory = storage): Promise<string[]> {
    assert.ok(resolve(directory).startsWith(resolve(storage)));
    const result: string[] = [];
    for (const entry of await readdir(directory, { withFileTypes: true }).catch(() => [])) {
        const target = join(directory, entry.name);
        if (entry.isDirectory()) result.push(...await ownedFiles(target)); else if (entry.isFile()) result.push(target);
    }
    return result;
}
async function backup(document: Document, name: string): Promise<Backup> {
    return instance().backupCustomDocument(document, { destination: stub.Uri.file(join(storage, name)) }, token());
}
function configChange(): void { for (const listener of [...configListeners]) listener({ affectsConfiguration: section => section === "soterai" || section === FLAG }); }
function setFlag(value: boolean): void {
    stub.state.config.set(FLAG, value); stub.state.configInspect.set(FLAG, { defaultValue: true, globalValue: value }); configChange();
}
async function waitFor(predicate: () => boolean, description: string): Promise<void> {
    const deadline = performance.now() + 2000;
    while (!predicate() && performance.now() < deadline) await new Promise<void>(done => setTimeout(done, 10));
    assert.ok(predicate(), description);
}
async function settle(work: Promise<unknown>): Promise<void> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try { await Promise.race([work.catch(() => undefined), new Promise<void>(done => { timer = setTimeout(done, 2000); })]); }
    finally { if (timer) clearTimeout(timer); }
}

beforeEach(async () => {
    container = await mkdtemp(join(tmpdir(), "soterai-f05-editor-commands-")); root = join(container, "project"); storage = join(container, "storage");
    await mkdir(root); await mkdir(storage);
    stub.resetState(root); context = stub.makeExtensionContext(root);
    context.storageUri = stub.Uri.file(storage); context.globalStorageUri = stub.Uri.file(join(container, "global-storage"));
    initializeBoundaryState(context.workspaceState as never);
    provider = undefined; providerType = undefined; providerOptions = undefined;
    ownerApproval = true; input = NEW_URL; inputOptions = []; confirmation = undefined; confirmations = []; infos = []; editEvents = [];
    originalDocumentCalls = 0; openWith = []; nativeDiffs = []; views = []; documents = []; textProviders = new Map(); configListeners = []; originalOpenListeners = [];
    associations = { "*.md": "default", "**/.env": "default" }; associationUpdates = []; associationWriteFault = false; associationUpdateNoop = false; associationApplyThenThrow = false; watcherChanges = [];
    Object.assign(stub.window, {
        registerCustomEditorProvider: (viewType: string, registered: Provider, options: unknown) => {
            providerType = viewType; provider = registered; providerOptions = options;
            const changed = registered.onDidChangeCustomDocument(event => editEvents.push(event));
            return new stub.Disposable(() => changed.dispose());
        },
        showWarningMessage: async (message: string, ...actions: unknown[]) => {
            confirmations.push(message); stub.recordSink("notification", "secure-editor-review", message);
            if (confirmation) return confirmation(message, actions);
            return ownerApproval ? actions.find(action => typeof action === "string") : undefined;
        },
        showInformationMessage: async (message: string) => { infos.push(message); return undefined; },
        showInputBox: async (options: { password?: boolean; value?: string }) => { inputOptions.push(structuredClone(options)); return input; },
        showWorkspaceFolderPick: async () => stub.state.folders[0],
        showOpenDialog: async () => [uri(".env")],
        showQuickPick: async (items: unknown[]) => ownerApproval ? items[0] : undefined,
        onDidChangeWindowState: () => new stub.Disposable(),
    });
    const getConfiguration = stub.workspace.getConfiguration.bind(stub.workspace);
    Object.assign(stub.workspace, {
        registerTextDocumentContentProvider: (scheme: string, registered: typeof textProviders extends Map<string, infer P> ? P : never) => {
            textProviders.set(scheme, registered); return new stub.Disposable(() => textProviders.delete(scheme));
        },
        openTextDocument: async (argument: stub.Uri | { content?: string }) => {
            if (!(argument instanceof stub.Uri)) return stub.makeDocument(stub.Uri.parse("untitled:/metadata"), argument.content ?? "");
            const registered = textProviders.get(argument.scheme);
            if (registered) return stub.makeDocument(argument, await registered.provideTextDocumentContent(argument));
            originalDocumentCalls++; return stub.makeDocument(argument, await readFile(argument.fsPath, "utf8"));
        },
        onDidChangeConfiguration: (listener: typeof configListeners[number]) => { configListeners.push(listener); return new stub.Disposable(() => { configListeners = configListeners.filter(value => value !== listener); }); },
        onDidOpenTextDocument: (listener: typeof originalOpenListeners[number]) => { originalOpenListeners.push(listener); return new stub.Disposable(() => { originalOpenListeners = originalOpenListeners.filter(value => value !== listener); }); },
        createFileSystemWatcher: () => ({
            onDidChange: (listener: typeof watcherChanges[number]) => { watcherChanges.push(listener); return new stub.Disposable(() => { watcherChanges = watcherChanges.filter(value => value !== listener); }); },
            onDidCreate: () => new stub.Disposable(), onDidDelete: () => new stub.Disposable(), dispose() {},
        }),
        getConfiguration: (section?: string) => section !== "workbench" ? getConfiguration(section) : {
            get: (name: string, fallback?: unknown) => name === "editorAssociations" ? structuredClone(associations) : fallback,
            inspect: (name: string) => name === "editorAssociations" ? { defaultValue: {}, workspaceValue: structuredClone(associations) } : undefined,
            update: async (name: string, value: unknown, target: unknown) => {
                assert.equal(name, "editorAssociations"); associationUpdates.push({ value: structuredClone(value), target });
                if (associationWriteFault) throw new Error("SYNTHETIC_ASSOCIATION_STORAGE_FAILURE");
                if (associationUpdateNoop) return;
                associations = structuredClone(value as Record<string, string>);
                if (associationApplyThenThrow) throw new Error("SYNTHETIC_ASSOCIATION_FAILURE_AFTER_APPLY");
            },
        },
    });
    const execute = stub.commands.executeCommand.bind(stub.commands);
    mock.method(stub.commands, "executeCommand", async (command: string, ...args: unknown[]) => {
        if (command === "vscode.openWith") { openWith.push(args); return undefined; }
        if (command === "vscode.diff") {
            const contents: string[] = [];
            for (const value of args.slice(0, 2)) {
                assert.ok(value instanceof stub.Uri); const registered = textProviders.get(value.scheme); assert.ok(registered, "Association diff must use owned metadata-only providers.");
                contents.push(await registered.provideTextDocumentContent(value));
            }
            nativeDiffs.push(contents); return undefined;
        }
        return execute(command, ...args);
    });
    await write(".env", SOURCE); await write("public.txt", "Useful public control."); await write("marked.txt", COMMENT + URL);
    await BoundarySnapshot.load(); await updateRules(stub.state.folders[0].uri.toString(), rules => ({ ...rules,
        paths: [...rules.paths, { kind: "file", pattern: "marked.txt", sensitive: true }] }));
    await BoundarySnapshot.load(); registerProjectPrivacyCommands(context as never); stub.resetSinks();
});

afterEach(async () => {
    views.forEach(view => view.dispose()); documents.forEach(document => document.dispose()); context.subscriptions.forEach(item => item.dispose()); mock.restoreAll(); mock.timers.reset();
    for (const name of Object.keys(stub.window)) if (!(name in windowOriginals)) delete (stub.window as unknown as Record<string, unknown>)[name];
    for (const name of Object.keys(stub.workspace)) if (!(name in workspaceOriginals)) delete (stub.workspace as unknown as Record<string, unknown>)[name];
    Object.defineProperties(stub.window, windowOriginals); Object.defineProperties(stub.workspace, workspaceOriginals);
    const target = resolve(container); assert.equal(dirname(target), resolve(tmpdir())); assert.ok(basename(target).startsWith("soterai-f05-editor-commands-"));
    await rm(target, { recursive: true, force: true });
});

test("F05-C01 actual native registration and open command select the optional masked editor and ignore supplied grants", async () => {
    instance(); assert.equal((providerOptions as { supportsMultipleEditorsPerDocument?: boolean }).supportsMultipleEditorsPerDocument, true);
    assert.deepEqual(await stub.commands.executeCommand("soterai.openSecureEditor", uri(".env"), { reveal: true, approved: true, value: "SYNTHETIC_ARGUMENT_CANNOT_EDIT" }), { status: "OPENED" });
    assert.equal(openWith.length, 1); assert.ok(openWith[0][0] instanceof stub.Uri); assert.equal(openWith[0][1], VIEW_TYPE);
    assert.equal(confirmations.length, 0); assert.equal(inputOptions.length, 0); assert.equal(originalDocumentCalls, 0); noValues(stub.capturedText());
});

test("F05-C02 custom open starts masked, excludes multiline value data, and a plaintext warning never reads getText", async () => {
    const { view } = await open(); assertMasked(view); noValues(JSON.stringify(view.updates));
    assert.equal(originalDocumentCalls, 0); assert.equal(stub.workspace.textDocuments.length, 0);
    assert.ok(view.webview.html.includes("DATABASE_URL") && view.webview.html.includes("API_KEY"));
    assert.ok(!view.webview.html.includes("SHADOW_SYNTHETIC"));
    for (const listener of originalOpenListeners) await listener({ uri: uri(".env"), getText: () => { throw new Error("Original plaintext buffer must not be read for its warning."); } });
    assert.ok(confirmations.some(message => /masked|sensitive|secret/i.test(message))); noValues(confirmations.join("\n"));
});

test("F05-C03 machine withdrawal, trust loss and unsupported public/outside resources refuse custom opens", async () => {
    const actual = instance();
    for (const target of [uri("public.txt"), stub.Uri.file(join(container, "outside.env")), stub.Uri.parse("untitled:/secret")]) {
        await assert.rejects(actual.openCustomDocument(target, {}, token()));
    }
    stub.state.config.set(FLAG, true); stub.state.configInspect.set(FLAG, { defaultValue: true, globalValue: false, workspaceValue: true });
    await assert.rejects(actual.openCustomDocument(uri(".env"), {}, token()));
    const result = await stub.commands.executeCommand("soterai.openSecureEditor", uri(".env")) as { status?: string };
    assert.ok(result?.status && result.status !== "OPENED"); assert.equal(openWith.length, 0);
    stub.state.configInspect.set(FLAG, { defaultValue: true, workspaceValue: false }); stub.state.config.set(FLAG, false);
    const enabled = await actual.openCustomDocument(uri(".env"), {}, token()); documents.push(enabled);
    stub.state.isTrusted = false; await assert.rejects(actual.openCustomDocument(uri("marked.txt"), {}, token()));
    assert.equal(originalDocumentCalls, 0); noValues(stub.capturedText());
});

test("F05-C04 per-field reveal requires current opaque binding and a native owner confirmation", async () => {
    const { view } = await open(), selected = binding(view);
    const before = confirmations.length;
    for (const message of [{ type: "reveal", ...selected, session: "forged" }, { type: "reveal", ...selected, field: "unknown-field" }, { type: "reveal", ...selected, revision: selected.revision + 1 }]) await view.send(message);
    assert.equal(confirmations.length, before); noValues(JSON.stringify(view.updates));
    ownerApproval = false; await view.send({ type: "reveal", ...selected });
    assert.equal(confirmations.length, before + 1); assert.match(confirmations.at(-1)!, /DATABASE_URL/); noValues(JSON.stringify(view.updates));
});

test("F05-C05 an approved one-field reveal reaches only its view, stays masked in safe reads, and expires at ten seconds", async () => {
    const { document, view } = await open(), sibling = makeView(); await instance().resolveCustomEditor(document, sibling, token());
    mock.timers.enable({ apis: ["setTimeout"] });
    await view.send({ type: "reveal", ...binding(view) });
    assert.ok(JSON.stringify(view.updates.at(-1)).includes(URL)); assert.ok(!JSON.stringify(view.updates.at(-1)).includes(API));
    noValues(JSON.stringify(sibling.updates)); assertMasked(view); assertMasked(sibling);
    const safe = await stub.commands.executeCommand("soterai.readProjectFileSafely", uri(".env")) as { status: string; text: string };
    assert.equal(safe.status, "ALLOWED_ONCE"); assert.match(safe.text, /DATABASE_URL=\[MASKED\]/); noValues(safe.text);
    const before = view.updates.length; mock.timers.tick(9999); assert.equal(view.updates.length, before);
    mock.timers.tick(1); assertCleared(view, before);
});

test("F05-C06 hide, split visibility and disposed/replayed sessions cannot retain or reacquire a reveal", async () => {
    const { view } = await open(); await view.send({ type: "reveal", ...binding(view) });
    let before = view.updates.length; await view.send({ type: "hide", ...binding(view) }); assertCleared(view, before);
    await view.send({ type: "reveal", ...binding(view) }); before = view.updates.length; view.hide(); assertCleared(view, before);
    view.reveal(); const stale = binding(view); await edit(view); const reviews = confirmations.length;
    await view.send({ type: "reveal", ...stale }); assert.equal(confirmations.length, reviews);
    const receiver = view.capturedReceiver(), current = binding(view); view.dispose(); await receiver({ type: "reveal", ...current });
    assert.equal(confirmations.length, reviews); noValues(JSON.stringify(view.updates.at(-1)));
});

test("F05-C07 edits use an empty native password input, reject payload values and retain masking until save", async () => {
    const { document, view } = await open(); const selected = binding(view);
    await view.send({ type: "edit", ...selected, value: "SYNTHETIC_CALLER_FORGED_VALUE" });
    assert.equal(inputOptions.length, 0); assert.equal(editEvents.length, 0);
    await edit(view); assert.equal(inputOptions.length, 1); assert.equal(inputOptions[0].password, true);
    assert.ok(inputOptions[0].value === undefined || inputOptions[0].value === ""); noValues(JSON.stringify(inputOptions));
    assert.equal(editEvents.length, 1); assert.equal(editEvents[0].document, document); noValues(JSON.stringify(editEvents)); assertMasked(view);
    assert.equal(await readFile(uri(".env").fsPath, "utf8"), SOURCE); assert.equal(originalDocumentCalls, 0);
});

test("F05-C08 actual edit event undo/redo and save preserve unrelated source bytes and reopen masked", async () => {
    const { document, view } = await open(); await edit(view); const event = editEvents[0]; assert.ok(event);
    await instance().saveCustomDocument(document, token());
    const changed = await readFile(uri(".env").fsPath, "utf8"); assert.ok(changed.includes(NEW_URL) && !changed.includes(URL));
    assert.ok(changed.includes(`# ${COMMENT}\r\n`) && changed.includes(`API_KEY=${API}\r\nDUP=one\r\nDUP=two\r\n`));
    await event.undo(); await instance().saveCustomDocument(document, token()); assert.equal(await readFile(uri(".env").fsPath, "utf8"), SOURCE);
    await event.redo(); await instance().saveCustomDocument(document, token()); assert.equal(await readFile(uri(".env").fsPath, "utf8"), changed);
    view.dispose(); document.dispose(); const reopened = await open(); assertMasked(reopened.view); noValues(JSON.stringify(reopened.view.updates));
    assert.equal(originalDocumentCalls, 0);
});

test("F05-C09 cancelled edit/save and a dirty external conflict preserve the draft and do not overwrite the source", async () => {
    const { document, view } = await open(); input = undefined; await view.send({ type: "edit", ...binding(view) });
    assert.equal(editEvents.length, 0); assert.equal(await readFile(uri(".env").fsPath, "utf8"), SOURCE);
    await edit(view); await assert.rejects(instance().saveCustomDocument(document, token(true)));
    assert.equal(await readFile(uri(".env").fsPath, "utf8"), SOURCE);
    const external = SOURCE.replace("DUP=one", "DUP=external"); await write(".env", external);
    await assert.rejects(instance().saveCustomDocument(document, token())); assert.equal(await readFile(uri(".env").fsPath, "utf8"), external);
    const retained = await backup(document, "conflict-recovery"); assert.ok(retained.id); assert.ok((await ownedFiles()).length > 0);
    await instance().revertCustomDocument(document, token()); assertMasked(view);
    await instance().saveCustomDocument(document, token()); assert.equal(await readFile(uri(".env").fsPath, "utf8"), external);
});

test("F05-C10 unavailable verified SecretStorage disables edits and backup without a plaintext fallback", async () => {
    mock.method(context.secrets, "store", async () => { throw new Error("SYNTHETIC_SECRET_STORAGE_FAILURE"); });
    const { document, view } = await open(); await edit(view);
    assert.equal(editEvents.length, 0); await assert.rejects(backup(document, "unavailable-key"));
    assert.equal(await readFile(uri(".env").fsPath, "utf8"), SOURCE); assert.equal((await ownedFiles()).length, 0); noValues(stub.capturedText());
});

test("F05-C11 encrypted backup restores a private dirty draft and rejects an issued ciphertext after tampering", async () => {
    const { document, view } = await open(); await edit(view); const recovery = await backup(document, "encrypted-recovery");
    assert.ok(recovery.id); const files = await ownedFiles(); assert.ok(files.length > 0);
    for (const file of files) noValues((await readFile(file)).toString("utf8"));
    assert.ok(context._inspect.secretStore.size > 0); noValues(JSON.stringify([...context._inspect.workspaceStore]));
    view.dispose(); document.dispose(); const restored = await open(".env", recovery.id); assertMasked(restored.view);
    await instance().saveCustomDocument(restored.document, token()); assert.ok((await readFile(uri(".env").fsPath, "utf8")).includes(NEW_URL));
    const priorFiles = new Set(await ownedFiles()); const second = await backup(restored.document, "tamper-recovery");
    const candidates = await ownedFiles(); const direct = isAbsolute(second.id) ? resolve(second.id) : second.id.startsWith("file:") ? stub.Uri.parse(second.id).fsPath : undefined;
    const created = await Promise.all(candidates.filter(file => !priorFiles.has(file)).map(async file => ({ file, size: (await readFile(file)).length })));
    const target = direct ?? created.sort((a, b) => b.size - a.size)[0]?.file; assert.ok(target, "The second issued backup must have owned recovery bytes."); assert.ok(resolve(target).startsWith(resolve(storage)));
    const bytes = await readFile(target); assert.ok(bytes.length > 0); bytes[bytes.length - 1] ^= 1; await writeFile(target, bytes);
    restored.view.dispose(); restored.document.dispose(); await assert.rejects(instance().openCustomDocument(uri(".env"), { backupId: second.id }, token()));
});

test("F05-C12 unrecognized and cross-source backup identifiers release nothing and create no plaintext document", async () => {
    const actual = instance(), { document, view } = await open(); await edit(view); const recovery = await backup(document, "source-bound-recovery");
    await write(".env.other", SOURCE); await assert.rejects(actual.openCustomDocument(uri(".env.other"), { backupId: recovery.id }, token()));
    await assert.rejects(actual.openCustomDocument(uri(".env"), { backupId: join(container, "unissued-backup") }, token()));
    assert.equal(originalDocumentCalls, 0); assert.equal(stub.workspace.textDocuments.length, 0);
    for (const file of await ownedFiles()) noValues((await readFile(file)).toString("utf8"));
});

test("F05-C13 Save As requires reviewed exclusive creation of a new sensitive path in the same project", async () => {
    const actual = instance(), { document, view } = await open(); await edit(view);
    for (const target of [uri("public-copy.txt"), stub.Uri.file(join(container, ".env.outside")), uri(".env")]) await assert.rejects(actual.saveCustomDocumentAs(document, target, token()));
    ownerApproval = false; await assert.rejects(actual.saveCustomDocumentAs(document, uri(".env.copy"), token()));
    await assert.rejects(readFile(uri(".env.copy").fsPath)); ownerApproval = true;
    await actual.saveCustomDocumentAs(document, uri(".env.copy"), token());
    assert.ok((await readFile(uri(".env.copy").fsPath, "utf8")).includes(NEW_URL)); assert.equal(await readFile(uri(".env").fsPath, "utf8"), SOURCE);
    await assert.rejects(actual.saveCustomDocumentAs(document, uri(".env.copy"), token())); noValues(confirmations.join("\n"));
});

test("F05-C14 association setup reviews native metadata diff and undo preserves unrelated workspace mappings", async () => {
    instance(); const before = structuredClone(associations);
    assert.deepEqual(await stub.commands.executeCommand("soterai.configureSecureEditorAssociation", { approved: true, global: true }), { status: "SAVED" });
    assert.equal(nativeDiffs.length, 1); assert.equal(nativeDiffs[0].length, 2);
    noValues(nativeDiffs[0].join("\n")); assert.ok(nativeDiffs[0].join("\n").includes("**/.env"));
    assert.equal(associations["**/.env"], VIEW_TYPE); assert.equal(associations["**/.env.*"], VIEW_TYPE); assert.equal(associations["*.md"], "default");
    assert.ok(associationUpdates.every(update => update.target === stub.ConfigurationTarget.Workspace || update.target === stub.ConfigurationTarget.WorkspaceFolder));
    associations["*.log"] = "default";
    assert.deepEqual(await stub.commands.executeCommand("soterai.undoSecureEditorAssociation", { approved: true }), { status: "SAVED" });
    assert.deepEqual(associations, { ...before, "*.log": "default" }); noValues(JSON.stringify([...context._inspect.workspaceStore]));
});

test("F05-C15 association cancellation, persistence failure and undo conflict never claim or replace unrelated mappings", async () => {
    instance(); const before = structuredClone(associations); ownerApproval = false;
    assert.deepEqual(await stub.commands.executeCommand("soterai.configureSecureEditorAssociation"), { status: "CANCELLED" }); assert.deepEqual(associations, before);
    ownerApproval = true; associationWriteFault = true; const infosBefore = infos.length;
    assert.deepEqual(await stub.commands.executeCommand("soterai.configureSecureEditorAssociation"), { status: "FAILED" }); assert.deepEqual(associations, before);
    assert.ok(!infos.slice(infosBefore).some(message => /installed|saved|restored/i.test(message)));
    associationWriteFault = false; assert.deepEqual(await stub.commands.executeCommand("soterai.configureSecureEditorAssociation"), { status: "SAVED" });
    associations["**/.env"] = "other.owner-editor"; const conflicted = structuredClone(associations);
    assert.deepEqual(await stub.commands.executeCommand("soterai.undoSecureEditorAssociation"), { status: "FAILED" }); assert.deepEqual(associations, conflicted);
});

test("F05-C16 encrypted recovery opens despite invalid partial original bytes; reviewed recovery save excludes concurrent edits", async () => {
    const actual = instance(), { document, view } = await open(); await edit(view); const recovery = await backup(document, "partial-write-recovery");
    view.dispose(); document.dispose(); await write(".env", Buffer.from([0xff, 0xfe, 0x00, 0x61]));
    const restored = await open(".env", recovery.id); assertMasked(restored.view);
    let release!: (value: string | undefined) => void;
    confirmation = (_message, actions) => new Promise(done => { release = value => done(value === "accept" ? actions.find(action => typeof action === "string") as string : undefined); });
    const saving = actual.saveCustomDocument(restored.document, token()); void saving.catch(() => undefined);
    const deadline = performance.now() + 2000;
    while (!release && performance.now() < deadline) await new Promise<void>(done => setTimeout(done, 10));
    try {
        assert.ok(release, "Recovered conflict must require native owner confirmation before overwriting partial original bytes.");
        const inputsBefore = inputOptions.length, editsBefore = editEvents.length;
        await restored.view.send({ type: "edit", ...binding(restored.view) }); assert.equal(inputOptions.length, inputsBefore); assert.equal(editEvents.length, editsBefore);
        await assert.rejects(actual.saveCustomDocument(restored.document, token()));
        release("accept"); await saving;
        const saved = await readFile(uri(".env").fsPath, "utf8"); assert.ok(saved.includes(NEW_URL) && saved.includes(API)); assertMasked(restored.view);
    } finally {
        release?.(undefined); let cleanupTimer: ReturnType<typeof setTimeout> | undefined;
        try { await Promise.race([saving.catch(() => undefined), new Promise<void>(done => { cleanupTimer = setTimeout(done, 2000); })]); }
        finally { if (cleanupTimer) clearTimeout(cleanupTimer); confirmation = undefined; }
    }
    assert.equal(originalDocumentCalls, 0);
});

test("F05-C17 a flag off/on transition burns a reveal confirmation that was already pending", async () => {
    const { view } = await open(); let release!: (value: string | undefined) => void;
    confirmation = (_message, actions) => actions.some(action => typeof action === "string")
        ? new Promise(done => { release = value => done(value === "accept" ? actions.find(action => typeof action === "string") as string : undefined); })
        : Promise.resolve(undefined);
    const revealing = view.send({ type: "reveal", ...binding(view) }); void revealing.catch(() => undefined);
    try {
        await waitFor(() => !!release, "The actual reveal confirmation must be held before the flag transition.");
        setFlag(false); setFlag(true); release("accept"); await revealing;
        noValues(JSON.stringify(view.updates)); assertMasked(view); assert.equal(originalDocumentCalls, 0);
    } finally { release?.(undefined); await settle(revealing); confirmation = undefined; }
});

test("F05-C18 a flag off/on transition burns a password edit input that was already pending", async () => {
    const { document, view } = await open(); let release!: (value: string | undefined) => void;
    mock.method(stub.window, "showInputBox", async (options: { password?: boolean; value?: string }) => {
        inputOptions.push(structuredClone(options)); return new Promise<string | undefined>(done => { release = done; });
    });
    const editing = view.send({ type: "edit", ...binding(view) }); void editing.catch(() => undefined);
    try {
        await waitFor(() => !!release, "The actual native password input must be held before the flag transition.");
        setFlag(false); setFlag(true); release(NEW_URL); await editing;
        assert.equal(editEvents.length, 0); assertMasked(view); noValues(JSON.stringify(view.updates));
        await instance().saveCustomDocument(document, token());
        assert.ok((await readFile(uri(".env").fsPath, "utf8")) === SOURCE, "An invalidated edit must not change the private draft later saved to disk.");
    } finally { release?.(undefined); await settle(editing); }
});

test("F05-C19 an owner-value delivery is bound to the initiating view's current session, revision and field", async () => {
    const { view } = await open(); const selected = binding(view);
    await view.send({ type: "reveal", ...selected });
    const delivery = [...view.updates].reverse().find(update => update.kind === "message" && JSON.stringify(update.value).includes(URL))?.value as Record<string, unknown> | undefined;
    assert.ok(delivery, "Explicitly approved reveal must deliver the one chosen value.");
    const current = binding(view); assert.equal(delivery.session, current.session); assert.equal(delivery.revision, current.revision);
    assert.equal(delivery.field, selected.field); assert.ok(!JSON.stringify(delivery).includes(API));
});

test("F05-C20 the actual masked-page script ignores delayed owner values from stale sessions and revisions", async () => {
    const { view } = await open(); const current = binding(view), rendered = { textContent: "[MASKED]" };
    const field = { dataset: { field: current.field }, querySelector: () => rendered };
    const document = { body: { dataset: { session: current.session, revision: String(current.revision) } },
        addEventListener() {}, querySelectorAll: () => [field] };
    const listeners = new Map<string, (event: { data: unknown }) => void>();
    const window = { addEventListener: (name: string, listener: (event: { data: unknown }) => void) => { listeners.set(name, listener); } };
    const script = /<script[^>]*>([\s\S]*?)<\/script>/.exec(view.webview.html)?.[1]; assert.ok(script);
    new Function("acquireVsCodeApi", "document", "window", script)(() => ({ postMessage() {} }), document, window);
    const receiver = listeners.get("message"); assert.ok(receiver);
    for (const stale of [{ session: "00000000-0000-4000-8000-000000000000", revision: current.revision },
        { session: current.session, revision: current.revision + 1 }, { session: current.session, revision: String(current.revision) }]) {
        receiver({ data: { type: "owner-value", field: current.field, value: URL, ...stale } });
        assert.ok(rendered.textContent === "[MASKED]", "A delayed value with a stale or mistyped binding must never enter the masked DOM.");
    }
    receiver({ data: { type: "owner-value", ...current, value: URL } });
    assert.ok(rendered.textContent === URL, "The positive control must render a current explicitly approved delivery.");
});

test("F05-C21 association updates require observed persistence and a no-op undo retains its restoration receipt", async () => {
    instance(); const before = structuredClone(associations); associationUpdateNoop = true;
    assert.deepEqual(await stub.commands.executeCommand("soterai.configureSecureEditorAssociation"), { status: "FAILED" });
    assert.deepEqual(associations, before);
    associationUpdateNoop = false;
    assert.deepEqual(await stub.commands.executeCommand("soterai.configureSecureEditorAssociation"), { status: "SAVED" });
    const installed = structuredClone(associations); associationUpdateNoop = true;
    assert.deepEqual(await stub.commands.executeCommand("soterai.undoSecureEditorAssociation"), { status: "FAILED" });
    assert.deepEqual(associations, installed);
    associationUpdateNoop = false;
    assert.deepEqual(await stub.commands.executeCommand("soterai.undoSecureEditorAssociation"), { status: "SAVED" });
    assert.deepEqual(associations, before);
});

test("F05-C22 a source change during native Save As confirmation cannot export the private draft", async () => {
    const actual = instance(), { document, view } = await open(); await edit(view);
    let release!: (value: string | undefined) => void;
    confirmation = (_message, actions) => actions.some(action => typeof action === "string")
        ? new Promise(done => { release = value => done(value === "accept" ? actions.find(action => typeof action === "string") as string : undefined); })
        : Promise.resolve(undefined);
    const copying = actual.saveCustomDocumentAs(document, uri(".env.changed-copy"), token()); void copying.catch(() => undefined);
    try {
        await waitFor(() => !!release, "The native Save As confirmation must be held before source drift.");
        const external = SOURCE.replace("DUP=one", "DUP=external-owner-change"); await write(".env", external);
        release("accept"); await assert.rejects(copying); await assert.rejects(readFile(uri(".env.changed-copy").fsPath));
        assert.ok((await readFile(uri(".env").fsPath, "utf8")) === external); assertMasked(view);
    } finally { release?.(undefined); await settle(copying); confirmation = undefined; }
});

test("F05-C23 the actual source watcher immediately clears a revealed owner value when the original changes", async () => {
    const { view } = await open(); await view.send({ type: "reveal", ...binding(view) });
    assert.ok(JSON.stringify(view.updates.at(-1)).includes(URL)); assert.ok(watcherChanges.length > 0, "A source watcher must be registered for active owner views.");
    await write(".env", SOURCE.replace("DUP=one", "DUP=source-drift")); const before = view.updates.length;
    const pending: Array<void | Promise<void>> = [];
    for (const listener of [...watcherChanges]) pending.push(listener(uri(".env")));
    assertCleared(view, before);
    await Promise.allSettled(pending.map(work => Promise.resolve(work))); noValues(JSON.stringify(view.updates.at(-1)));
});

test("F05-C24 reopening a partial original discovers issued implicit edit recovery only after native metadata consent", async () => {
    const actual = instance(), { document, view } = await open(); await edit(view); assert.ok((await ownedFiles()).length > 0);
    view.dispose(); document.dispose(); const partial = Buffer.from([0xff, 0xfe, 0x00, 0x61]); await write(".env", partial);
    const before = confirmations.length; ownerApproval = false;
    await assert.rejects(actual.openCustomDocument(uri(".env"), {}, token())); assert.ok(confirmations.length > before);
    ownerApproval = true; const recovered = await open(); assertMasked(recovered.view); noValues(JSON.stringify(recovered.view.updates));
    assert.ok((await readFile(uri(".env").fsPath)).equals(partial), "Selecting private recovery must never automatically rewrite the original.");
    noValues(confirmations.join("\n")); assert.equal(originalDocumentCalls, 0);
});

test("F05-C25 an association write applied before throwing preserves the receipt needed for owner undo", async () => {
    instance(); const before = structuredClone(associations); associationApplyThenThrow = true;
    assert.deepEqual(await stub.commands.executeCommand("soterai.configureSecureEditorAssociation"), { status: "FAILED" });
    assert.equal(associations["**/.env"], VIEW_TYPE); assert.equal(associations["**/.env.*"], VIEW_TYPE);
    associationApplyThenThrow = false;
    assert.deepEqual(await stub.commands.executeCommand("soterai.undoSecureEditorAssociation"), { status: "SAVED" });
    assert.deepEqual(associations, before);
});

test("F05-C26 resolving a new split view immediately masks an already revealed sibling", async () => {
    const { document, view } = await open(); await view.send({ type: "reveal", ...binding(view) });
    assert.ok(JSON.stringify(view.updates.at(-1)).includes(URL)); const before = view.updates.length;
    const sibling = makeView(); await instance().resolveCustomEditor(document, sibling, token());
    assertCleared(view, before); assertMasked(sibling); noValues(JSON.stringify(sibling.updates));
});

test("F05-C27 a held recovered save cannot run undo or redo against its captured revision", async () => {
    const actual = instance(), original = await open(); await edit(original.view); const recovery = await backup(original.document, "history-lock-recovery");
    original.view.dispose(); original.document.dispose(); await write(".env", SOURCE.replace("DUP=one", "DUP=external"));
    const restored = await open(".env", recovery.id), newest = "SYNTHETIC_OWNER_SAVE_LOCK_NEWEST_VALUE";
    await edit(restored.view, newest); const event = editEvents.at(-1)!; assert.equal(event.document, restored.document);
    let release!: (value: string | undefined) => void;
    confirmation = (_message, actions) => actions.some(action => typeof action === "string")
        ? new Promise(done => { release = value => done(value === "accept" ? actions.find(action => typeof action === "string") as string : undefined); })
        : Promise.resolve(undefined);
    const saving = actual.saveCustomDocument(restored.document, token()); void saving.catch(() => undefined);
    const outcomes: { undo: "pending" | "fulfilled" | "rejected"; redo: "pending" | "fulfilled" | "rejected" } = { undo: "pending", redo: "pending" };
    const historyStatus = (action: "undo" | "redo"): "pending" | "fulfilled" | "rejected" => outcomes[action];
    let undo: Promise<void> | undefined, redo: Promise<void> | undefined;
    try {
        await waitFor(() => !!release, "Recovered save must be held in native conflict review.");
        undo = Promise.resolve().then(() => event.undo()).then(() => { outcomes.undo = "fulfilled"; }, () => { outcomes.undo = "rejected"; });
        redo = Promise.resolve().then(() => event.redo()).then(() => { outcomes.redo = "fulfilled"; }, () => { outcomes.redo = "rejected"; });
        await new Promise<void>(done => setImmediate(done));
        assert.ok(historyStatus("undo") !== "fulfilled" && historyStatus("redo") !== "fulfilled", "History must reject or wait while save owns the captured revision.");
        release("accept"); await saving;
        assert.ok((await readFile(uri(".env").fsPath, "utf8")).includes(newest), "The completed save must contain exactly the revision it captured before history could run.");
        await settle(undo); await settle(redo); confirmation = undefined;
        await restored.view.send({ type: "reveal", ...binding(restored.view) });
        const delivery = [...restored.view.updates].reverse().find(update => update.kind === "message" && JSON.stringify(update.value).includes("value"))?.value as { value?: unknown } | undefined;
        assert.ok(delivery && typeof delivery.value === "string" && [NEW_URL, newest].includes(delivery.value));
        await actual.saveCustomDocument(restored.document, token());
        assert.ok((await readFile(uri(".env").fsPath, "utf8")).includes(delivery.value as string), "A subsequent save must persist the current private draft after any queued history completes.");
    } finally {
        release?.(undefined); await settle(saving); if (undo) await settle(undo); if (redo) await settle(redo); confirmation = undefined;
    }
});

test("F05-C28 a source change while encrypted key storage is held cannot publish or apply the candidate edit", async () => {
    const { view } = await open(), revision = binding(view).revision;
    const originalStore = context.secrets.store.bind(context.secrets); let release!: () => void;
    const held = new Promise<void>(done => { release = done; }); let entered = false;
    mock.method(context.secrets, "store", async (key: string, value: string) => { entered = true; await held; return originalStore(key, value); });
    const editing = edit(view); void editing.catch(() => undefined);
    try {
        await waitFor(() => entered, "Encrypted recovery key storage must be held before source drift.");
        const external = SOURCE.replace("DUP=one", "DUP=external-without-watcher"); await write(".env", external);
        // Deliberately no synthetic watcher delivery: final validation itself is required.
        release(); await editing;
        assert.equal(editEvents.length, 0); assert.equal(binding(view).revision, revision);
        assert.ok((await readFile(uri(".env").fsPath, "utf8")) === external); assertMasked(view);
        assert.ok(!context.workspaceState.keys().some(key => key.startsWith("soterai.lite.secureEditor.backup.") && context.workspaceState.get(key) !== undefined), "A rejected candidate must not become a discoverable recovery record.");
    } finally { release(); await settle(editing); }
});

test("F05-C29 a revoked candidate cannot displace the previous successful draft in implicit recovery", async () => {
    const { document, view } = await open(); await edit(view); const beforeEvents = editEvents.length, revision = binding(view).revision;
    const originalStore = context.secrets.store.bind(context.secrets); let release!: () => void;
    const held = new Promise<void>(done => { release = done; }); let entered = false;
    mock.method(context.secrets, "store", async (key: string, value: string) => { entered = true; await held; return originalStore(key, value); });
    const candidate = "SYNTHETIC_REVOKED_CANDIDATE_B_NEVER_RECOVERY", editing = edit(view, candidate); void editing.catch(() => undefined);
    try {
        await waitFor(() => entered, "Candidate B must be held at encrypted key storage after successful draft A.");
        setFlag(false); setFlag(true); release(); await editing;
        assert.equal(editEvents.length, beforeEvents); assert.equal(binding(view).revision, revision);
        view.dispose(); document.dispose(); const beforeReviews = confirmations.length, restored = await open();
        assert.ok(confirmations.length > beforeReviews, "Selecting the retained implicit draft must require native owner consent."); assertMasked(restored.view);
        await restored.view.send({ type: "reveal", ...binding(restored.view) });
        const delivery = [...restored.view.updates].reverse().find(update => update.kind === "message" && JSON.stringify(update.value).includes("value"))?.value as { value?: unknown } | undefined;
        assert.ok(delivery?.value === NEW_URL, "Implicit recovery must contain successful draft A, never the revoked candidate B.");
        assert.ok(!JSON.stringify(restored.view.updates).includes(candidate));
        assert.ok((await readFile(uri(".env").fsPath, "utf8")) === SOURCE, "Recovery and reveal cannot automatically rewrite originals.");
    } finally { release(); await settle(editing); }
});

test("F05-C30 cancellation during final destination validation prevents Save As creation", async () => {
    const actual = instance(), { document, view } = await open(); await edit(view);
    const destination = uri(".env.cancelled-at-validation"), cancellation = token(); let reviewed = false, cancelledDuringValidation = false;
    confirmation = (_message, actions) => { reviewed = true; return Promise.resolve(actions.find(action => typeof action === "string") as string | undefined); };
    const originalFolder = stub.workspace.getWorkspaceFolder.bind(stub.workspace);
    mock.method(stub.workspace, "getWorkspaceFolder", (candidate: stub.Uri) => {
        // assertWorkspaceOutputUri resolves this destination after native review;
        // source rechecks use the original URI and cannot trigger this hook.
        if (reviewed && candidate.toString() === destination.toString()) {
            cancelledDuringValidation = true; cancellation.isCancellationRequested = true;
        }
        return originalFolder(candidate);
    });
    try {
        await assert.rejects(actual.saveCustomDocumentAs(document, destination, cancellation));
        assert.ok(cancelledDuringValidation, "Cancellation must occur inside a real final destination validation.");
        await assert.rejects(readFile(destination.fsPath)); assert.ok((await readFile(uri(".env").fsPath, "utf8")) === SOURCE);
        assertMasked(view);
    } finally { confirmation = undefined; }
});

test("F05-C33 unrelated public-file watcher activity leaves a valid owner reveal active until hide", async () => {
    const { view } = await open(); await view.send({ type: "reveal", ...binding(view) });
    assert.ok(JSON.stringify(view.updates.at(-1)).includes(URL)); assert.ok(watcherChanges.length > 0);
    const before = view.updates.length, current = binding(view), pending: Array<void | Promise<void>> = [];
    await write("public.txt", "Unrelated scanner report or public control update.");
    for (const listener of [...watcherChanges]) pending.push(listener(uri("public.txt")));
    await Promise.allSettled(pending.map(work => Promise.resolve(work)));
    assert.equal(view.updates.length, before, "Unrelated project file activity must not clear the actual source's valid owner reveal.");
    assert.deepEqual(binding(view), current); assert.ok(JSON.stringify(view.updates.at(-1)).includes(URL));
    await view.send({ type: "hide", ...current }); assertCleared(view, before);
});

test("F05-C31 actual drift monitor generic pending revocation does not cancel this editor's own guarded save", async () => {
    registerPolicyDriftMonitor(context as never);
    const actual = instance(), { document, view } = await open(); await edit(view);
    await actual.saveCustomDocument(document, token());
    const saved = await readFile(uri(".env").fsPath, "utf8"); assert.ok(saved.includes(NEW_URL) && saved.includes(API));
    assertMasked(view); assert.equal(originalDocumentCalls, 0);
});

test("F05-C32 explicit manual restriction intent still burns a held recovery-save approval with the actual drift monitor", async () => {
    registerPolicyDriftMonitor(context as never);
    const actual = instance(), { document, view } = await open(); await edit(view);
    const recovery = await backup(document, "integrated-manual-intent"); view.dispose(); document.dispose();
    const external = SOURCE.replace("DUP=one", "DUP=external-integrated"); await write(".env", external);
    const restored = await open(".env", recovery.id); let release!: (value: string | undefined) => void;
    confirmation = (_message, actions) => actions.some(action => typeof action === "string")
        ? new Promise(done => { release = value => done(value === "accept" ? actions.find(action => typeof action === "string") as string : undefined); })
        : Promise.resolve(undefined);
    const saving = actual.saveCustomDocument(restored.document, token()); void saving.catch(() => undefined);
    try {
        await waitFor(() => !!release, "A recovery-save approval must be held before explicit manual intent.");
        await withManualRestriction(stub.state.folders[0].uri.toString(), async () => undefined, { kind: "file", pattern: ".env" });
        release("accept"); await assert.rejects(saving);
        assert.equal(await readFile(uri(".env").fsPath, "utf8"), external); assertMasked(restored.view);
    } finally { release?.(undefined); await settle(saving); confirmation = undefined; }
});
