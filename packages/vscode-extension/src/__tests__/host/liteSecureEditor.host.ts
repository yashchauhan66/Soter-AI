/** F05 real native custom-editor integration in an isolated synthetic window.
 * The bootstrap must call beforeActivate(context), actual.activate(context),
 * then run(context). Scripted owner decisions share its API instance: LOW.
 */
import * as vscode from "vscode";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, stat, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";

const VIEW_TYPE = "soterai.secureEditor", FLAG = "lite.secureEditor";
const MARKER = ".synthetic-lite-f05-host", RECEIPT = ".lite-f05-save-receipt.json";
const COMMENT = "SYNTHETIC_F05_HOST_COMMENT_NEVER_DEFAULT_VISIBLE_20261014";
const URL = "postgresql://synthetic:fake-only@f05-host.invalid/original";
const API = "SYNTHETIC_F05_HOST_API_VALUE_NEVER_DEFAULT_VISIBLE_20261014";
const NEW_URL = "postgresql://synthetic:fake-only@f05-native-edit.invalid/saved";
const DRAFT_URL = "postgresql://synthetic:fake-only@f05-native-recovery.invalid/draft";
const SOURCE = `# ${COMMENT}\r\nDATABASE_URL = '${URL}'\r\nAPI_KEY=${API}\r\nPORT=5432\r\nDUP=one\r\nDUP=two\r\nMULTI="first\r\nSHADOW_SYNTHETIC=inside-value\r\nlast"\r\n`;
const SAVED = SOURCE.replace(`'${URL}'`, NEW_URL), DRAFT = SOURCE.replace(`'${URL}'`, DRAFT_URL);
const SAFE = "DATABASE_URL=[MASKED]\nAPI_KEY=[MASKED]\nPORT=[MASKED]\nDUP=[MASKED]\nMULTI=[MASKED]";
const KEY_PREFIX = "soterai.lite.secureEditor.recovery.", RECORD_PREFIX = "soterai.lite.secureEditor.backup.";
const sha = (bytes: string | Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const wait = (ms: number) => new Promise<void>(done => setTimeout(done, ms));
type Observation = { id: string; status: "NOT_RUN" | "PASS" | "FAIL"; scope: string; diagnostic?: string };
type ReadResult = { status: string; text?: string; kind?: string };
type Binding = { session: string; revision: number; field: string };
type NativeView = { document: vscode.CustomDocument; panel: vscode.WebviewPanel; disposed: boolean;
    listener?: (message: unknown) => unknown; messages: Array<{ value: unknown; delivered: boolean }> };
type NativeOpen = { document: vscode.CustomDocument; uri: string; backupId?: string };
type NativeBackup = { document: vscode.CustomDocument; source: string; revision: number | undefined; id?: string; failed: boolean };
type BackupRecord = { schemaVersion: number; id: string; source: string; root: string; digest: string; keyId: string };
const views: NativeView[] = [], opens: NativeOpen[] = [], backups: NativeBackup[] = [];
const restorePatches: Array<() => void> = [], listeners: vscode.Disposable[] = [];
let installed = false, hookedContext: vscode.ExtensionContext | undefined;
let registeredProvider: vscode.CustomEditorProvider<vscode.CustomDocument> | undefined;
let multipleEditors = false, sourceDocumentCalls = 0, sourceDocumentEvents = 0;
let nativeWindowFocusEvents = 0, lastNativeWindowFocused = vscode.window.state.focused, nativeSourceFileEvents = 0;
let editEvents = 0, saveCalls = 0, saveFailures = 0, secretStores = 0, secretGets = 0;
let revealApproval = true, recoveryApproval = true, input = NEW_URL, inputCalls = 0, nativeModalCalls = 0;

function noValues(text: string): void {
    for (const value of [COMMENT, URL, API, NEW_URL, DRAFT_URL])
        assert.ok(!text.includes(value), "A default or metadata sink contained a synthetic private value.");
}
function replace(target: object, name: string, value: unknown): void {
    const own = Object.getOwnPropertyDescriptor(target, name);
    Object.defineProperty(target, name, { configurable: true, enumerable: own?.enumerable ?? false, writable: true, value });
    restorePatches.push(() => { if (own) Object.defineProperty(target, name, own); else Reflect.deleteProperty(target, name); });
}
function invoke(method: unknown, target: object, args: unknown[]): unknown {
    assert.equal(typeof method, "function"); return Reflect.apply(method as (...args: unknown[]) => unknown, target, args);
}
function sourceUri(): vscode.Uri {
    const folder = vscode.workspace.workspaceFolders?.[0]; assert.ok(folder);
    return vscode.Uri.joinPath(folder.uri, ".env.host");
}
function isSource(uri: unknown): boolean { return uri instanceof vscode.Uri && uri.toString() === sourceUri().toString(); }
function currentViews(): NativeView[] { return views.filter(view => !view.disposed && isSource(view.document.uri)); }
function binding(view: NativeView): Binding {
    const html = view.panel.webview.html; noValues(html);
    const session = /data-session=["']([^"']+)["']/.exec(html)?.[1];
    const rawRevision = /data-revision=["']([^"']+)["']/.exec(html)?.[1];
    const field = /data-field=["']([^"']+)["']/.exec(html)?.[1];
    assert.ok(session && field && rawRevision !== undefined);
    const revision = Number(rawRevision); assert.ok(Number.isSafeInteger(revision) && revision >= 0);
    return { session, revision, field };
}
function masked(view: NativeView): void {
    noValues(view.panel.webview.html); assert.match(view.panel.webview.html, /MASKED|[Mm]asked/);
    assert.ok(!view.panel.webview.html.includes("SHADOW_SYNTHETIC"), "Multiline value text cannot become a field name.");
}
function noSourceDocuments(): void {
    assert.equal(sourceDocumentCalls, 0); assert.equal(sourceDocumentEvents, 0);
    assert.equal(vscode.workspace.textDocuments.filter(document => isSource(document.uri)).length, 0);
}
function tabs(): vscode.Tab[] {
    return vscode.window.tabGroups.all.flatMap(group => [...group.tabs]).filter(tab =>
        tab.input instanceof vscode.TabInputCustom && tab.input.viewType === VIEW_TYPE && isSource(tab.input.uri));
}
async function until(predicate: () => boolean, timeout = 10_000): Promise<void> {
    const deadline = performance.now() + timeout;
    while (!predicate() && performance.now() < deadline) await wait(25);
    assert.ok(predicate(), "The expected native custom-editor lifecycle state was not observed.");
}
async function bounded<T>(work: PromiseLike<T>, timeout = 15_000): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try { return await Promise.race([Promise.resolve(work), new Promise<T>((_done, reject) => {
        timer = setTimeout(() => reject(new Error("Native custom-editor operation did not resolve.")), timeout);
    })]); } finally { if (timer) clearTimeout(timer); }
}
async function send(view: NativeView, type: "reveal" | "edit" | "hide"): Promise<void> {
    assert.ok(view.listener); await bounded(Promise.resolve(view.listener({ type, ...binding(view) })));
}
async function settledBinding(view: NativeView,
    report: (counts: { pendingBackupCountStart: number; pendingBackupCountEnd: number }) => void = () => undefined): Promise<void> {
    const deadline = performance.now() + 10_000;
    let previous: Binding | undefined, stableSince = performance.now();
    const pendingBackups = () => backups.filter(row => row.document === view.document && !row.id && !row.failed).length;
    const pendingBackupCountStart = pendingBackups();
    while (performance.now() < deadline) {
        const current = binding(view);
        const pendingBackupCountEnd = pendingBackups(); report({ pendingBackupCountStart, pendingBackupCountEnd });
        if (pendingBackupCountEnd > 0 || !view.panel.visible || view.disposed || !previous || current.session !== previous.session
            || current.revision !== previous.revision || current.field !== previous.field) stableSince = performance.now();
        previous = current;
        if (pendingBackupCountEnd === 0 && view.panel.visible && !view.disposed && performance.now() - stableSince >= 2_000) return;
        await wait(25);
    }
    throw new Error("Native startup did not provide a stable visible binding within the fixture deadline.");
}

/** Test-only interception delegates every registration/operation to native APIs. */
export function beforeActivate(context: vscode.ExtensionContext): void {
    assert.equal(installed, false, "Install this owned hook once before the actual runtime activates.");
    installed = true; hookedContext = context;
    const register = vscode.window.registerCustomEditorProvider;
    replace(vscode.window, "registerCustomEditorProvider", (viewType: string, supplied: unknown, options?: unknown) => {
        if (viewType === VIEW_TYPE) {
            assert.equal(registeredProvider, undefined);
            const provider = supplied as vscode.CustomEditorProvider<vscode.CustomDocument>;
            registeredProvider = provider;
            multipleEditors = (options as { supportsMultipleEditorsPerDocument?: boolean } | undefined)?.supportsMultipleEditorsPerDocument === true;
            const originalOpen = provider.openCustomDocument;
            replace(provider, "openCustomDocument", async (...args: unknown[]) => {
                const document = await invoke(originalOpen, provider, args) as vscode.CustomDocument;
                const openContext = args[1] as vscode.CustomDocumentOpenContext;
                opens.push({ document, uri: document.uri.toString(), ...(openContext.backupId ? { backupId: openContext.backupId } : {}) });
                return document;
            });
            const originalResolve = provider.resolveCustomEditor;
            replace(provider, "resolveCustomEditor", async (...args: unknown[]) => {
                const document = args[0] as vscode.CustomDocument, panel = args[1] as vscode.WebviewPanel;
                const view: NativeView = { document, panel, disposed: false, messages: [] }; views.push(view);
                const receive = panel.webview.onDidReceiveMessage, post = panel.webview.postMessage;
                replace(panel.webview, "onDidReceiveMessage", (listener: (message: unknown) => unknown, thisArg?: unknown, disposables?: vscode.Disposable[]) => {
                    view.listener = message => listener.call(thisArg, message);
                    return receive.call(panel.webview, listener, thisArg, disposables);
                });
                replace(panel.webview, "postMessage", async (message: unknown) => {
                    const delivered = await post.call(panel.webview, message);
                    view.messages.push({ value: structuredClone(message), delivered }); return delivered;
                });
                listeners.push(panel.onDidDispose(() => { view.disposed = true; }));
                return await invoke(originalResolve, provider, args);
            });
            const originalSave = provider.saveCustomDocument;
            replace(provider, "saveCustomDocument", async (...args: unknown[]) => {
                saveCalls++;
                try { return await invoke(originalSave, provider, args); }
                catch (error) { saveFailures++; throw error; }
            });
            const originalBackup = provider.backupCustomDocument;
            replace(provider, "backupCustomDocument", async (...args: unknown[]) => {
                const document = args[0] as vscode.CustomDocument, visible = currentViews().find(view => view.document === document);
                const row: NativeBackup = { document, source: document.uri.toString(), revision: visible ? binding(visible).revision : undefined, failed: false };
                backups.push(row);
                try { const result = await invoke(originalBackup, provider, args) as vscode.CustomDocumentBackup; row.id = result.id; return result; }
                catch (error) { row.failed = true; throw error; }
            });
            listeners.push(provider.onDidChangeCustomDocument((event: vscode.CustomDocumentEditEvent<vscode.CustomDocument> | vscode.CustomDocumentContentChangeEvent<vscode.CustomDocument>) => {
                if (isSource(event.document.uri)) { editEvents++; noValues("label" in event ? event.label ?? "" : ""); }
            }));
        }
        return invoke(register, vscode.window, [viewType, supplied, options]);
    });
    const open = vscode.workspace.openTextDocument;
    replace(vscode.workspace, "openTextDocument", (...args: unknown[]) => {
        if (isSource(args[0])) sourceDocumentCalls++;
        return invoke(open, vscode.workspace, args);
    });
    listeners.push(vscode.workspace.onDidOpenTextDocument(document => { if (isSource(document.uri)) sourceDocumentEvents++; }));
    listeners.push(vscode.window.onDidChangeWindowState(event => {
        nativeWindowFocusEvents++; lastNativeWindowFocused = event.focused;
    }));
    const folder = vscode.workspace.workspaceFolders?.[0]; assert.ok(folder);
    const sourceWatcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(folder, ".env.host"));
    const sourceEvent = (uri: vscode.Uri) => { if (isSource(uri)) nativeSourceFileEvents++; };
    listeners.push(sourceWatcher, sourceWatcher.onDidCreate(sourceEvent), sourceWatcher.onDidChange(sourceEvent), sourceWatcher.onDidDelete(sourceEvent));
    const nativeStore = context.secrets.store, nativeGet = context.secrets.get;
    replace(context.secrets, "store", async (key: string, value: string) => {
        if (key.startsWith(KEY_PREFIX)) {
            secretStores++; assert.match(value, /^[A-Za-z0-9+/]{43}=$/);
            assert.equal(Buffer.from(value, "base64").length, 32);
        }
        return await nativeStore.call(context.secrets, key, value);
    });
    replace(context.secrets, "get", async (key: string) => {
        if (key.startsWith(KEY_PREFIX)) secretGets++;
        return await nativeGet.call(context.secrets, key);
    });
    replace(vscode.window, "showWarningMessage", async (message: string, ...items: unknown[]) => {
        noValues(message);
        const options = items[0] as vscode.MessageOptions;
        if (options?.detail) noValues(options.detail);
        if (options?.modal) nativeModalCalls++;
        if (items.includes("Reveal value")) return revealApproval ? "Reveal value" : undefined;
        if (items.includes("Save recovered draft")) return recoveryApproval ? "Save recovered draft" : undefined;
        if (items.includes("Allow safe read once")) return "Allow safe read once";
        return undefined;
    });
    replace(vscode.window, "showInputBox", async (options: vscode.InputBoxOptions) => {
        inputCalls++; assert.equal(options.password, true);
        assert.equal(Object.hasOwn(options, "value"), false); noValues(JSON.stringify(options)); return input;
    });
    for (const method of ["showInformationMessage", "showErrorMessage"])
        replace(vscode.window, method, async (message: string) => { noValues(message); return undefined; });
}

export async function run(context: vscode.ExtensionContext): Promise<void> {
    const phase = process.env.SOTERAI_LITE_F05_PHASE, output = process.env.SOTERAI_LITE_F05_EVIDENCE;
    const profile = process.env.SOTERAI_LITE_F05_PROFILE;
    assert.ok(output && isAbsolute(output), "A unique absolute evidence path is required.");
    const declarations = phase === "reload" ? [
        ["F05-H08", "Actual workbench supplies an issued backupId after native hot-exit/restart; restored custom tab starts masked with no original TextDocument."],
        ["F05-H09", "Native Save writes the privately recovered dirty draft and ordinary safe-reader output remains entirely value-masked."],
        ["F05-H10", "Machine withdrawal clears reveals and blocks edit/open/save; saved protection persists and cleanup uses a re-enabled actual native save."],
    ] : [
        ["F05-H01", "Byte-identical packaged runtime registers the native CustomDocument provider with multiple-view support in the isolated developer profile."],
        ["F05-H02", "Actual open command produces TabInputCustom and masked native HTML without opening any original TextDocument."],
        ["F05-H03", "Scripted native confirmation gates one-field payload; real ten-second hiding and all-value safe-reader masking hold."],
        ["F05-H04", "Native split creates two custom tabs sharing one CustomDocument, and only the initiating real panel receives a revealed value."],
        ["F05-H05", "Private password edit emits a real custom edit event; native Undo/Redo/Save preserve unrelated bytes and clean the saved custom tab."],
        ["F05-H06", "Native close/reopen retains the saved private value while default panels and original TextDocument count remain masked/zero."],
        ["F05-H07", "Actual workbench backup for the final dirty revision produces issued authenticated ciphertext, with native SecretStorage calls and hot-exit enabled."],
    ];
    const observations: Observation[] = declarations.map(([id, scope]) => ({ id, scope, status: "NOT_RUN" }));
    let runtime = "", bundle = "", root = "", driverFailure: string | undefined;
    let config: vscode.WorkspaceConfiguration | undefined, oldFlag: boolean | undefined;
    let oldHotExit: unknown, oldAutoSave: unknown, restoredIdObservedBeforeClose: boolean | undefined;
    const evidence: Record<string, unknown> = {};
    const check = async (id: string, action: () => Promise<void>) => {
        const row = observations.find(item => item.id === id)!;
        try { await action(); row.status = "PASS"; }
        catch (error) { row.status = "FAIL"; row.diagnostic = error instanceof Error ? error.name : "UnknownFailure"; }
        console.log(`LITE_SECURE_EDITOR_HOST ${phase} ${id} ${row.status}`);
    };
    try {
        assert.ok(installed && hookedContext === context, "Pre-activation and runtime must share the actual extension context.");
        assert.ok(phase === "save" || phase === "reload"); assert.ok(profile && isAbsolute(profile));
        assert.equal(resolve(process.env.USERPROFILE ?? ""), resolve(profile));
        assert.equal(context.extensionMode, vscode.ExtensionMode.Development);
        assert.equal(vscode.workspace.workspaceFolders?.length, 1); assert.ok(vscode.workspace.isTrusted);
        const folder = vscode.workspace.workspaceFolders![0]; root = folder.uri.fsPath;
        assert.equal(folder.uri.scheme, "file"); assert.equal(await readFile(join(root, MARKER), "utf8"), "synthetic-only-v1");
        const extension = vscode.extensions.getExtension("soterai.soterai-ide-guard"); assert.ok(extension?.isActive);
        bundle = join(extension.extensionPath, "dist", "extension.js"); runtime = sha(await readFile(bundle));
        assert.equal(runtime, process.env.SOTERAI_LITE_F05_BUNDLE_SHA256);
        assert.ok(registeredProvider); config = vscode.workspace.getConfiguration("soterai"); oldFlag = config.inspect<boolean>(FLAG)?.globalValue;
        const files = vscode.workspace.getConfiguration("files");
        oldHotExit = files.inspect("hotExit")?.globalValue; oldAutoSave = files.inspect("autoSave")?.globalValue;
        const readSafely = async () => {
            const result = await vscode.commands.executeCommand<ReadResult>("soterai.readProjectFileSafely", sourceUri());
            assert.equal(result.status, "ALLOWED_ONCE"); assert.equal(result.text, SAFE); noValues(result.text!);
        };
        const nativeOpen = async () => {
            const result = await vscode.commands.executeCommand("soterai.openSecureEditor", sourceUri(), { reveal: true, approved: true, value: "ignored" });
            assert.deepEqual(result, { status: "OPENED" });
            await until(() => tabs().length > 0 && currentViews().length > 0 && !!currentViews().at(-1)?.listener);
            noSourceDocuments(); const view = currentViews().at(-1)!; masked(view); return view;
        };
        const reveal = async (view: NativeView, expected: string) => {
            const before = view.messages.length, modalBefore = nativeModalCalls, requested = binding(view);
            const focusBefore = nativeWindowFocusEvents, sourceEventsBefore = nativeSourceFileEvents;
            let stage = "send-request";
            try {
                await send(view, "reveal"); stage = "wait-for-owner-message";
                await until(() => view.messages.length > before);
                const sent = view.messages.at(-1)!; stage = "native-delivery";
                assert.equal(sent.delivered, true); stage = "exact-current-binding-and-value";
                assert.deepEqual(sent.value, { type: "owner-value", ...binding(view), value: expected });
                stage = "one-field-only";
                assert.ok(!JSON.stringify(sent.value).includes(API)); assert.ok(!JSON.stringify(sent.value).includes(COMMENT));
                stage = "masked-default-and-no-source-document"; masked(view); noSourceDocuments();
            } catch (error) {
                let current: Binding | undefined;
                try { current = binding(view); } catch { /* Only lifecycle validity is recorded. */ }
                const sent = view.messages.length > before ? view.messages.at(-1) : undefined;
                const value = sent?.value && typeof sent.value === "object" ? sent.value as Record<string, unknown> : undefined;
                const failures = Array.isArray(evidence.revealFailures) ? evidence.revealFailures as Array<Record<string, unknown>> : [];
                failures.push({ stage, bindingReadable: current !== undefined, requestedRevision: requested.revision,
                    currentRevision: current?.revision, sameSession: current?.session === requested.session,
                    sameField: current?.field === requested.field, visible: view.panel.visible, disposed: view.disposed,
                    modalCallsBefore: modalBefore, modalCallsAfter: nativeModalCalls, receivedBefore: before,
                    receivedAfter: view.messages.length, delivered: sent?.delivered ?? false,
                    nativeFocusEventsBefore: focusBefore, nativeFocusEventsAfter: nativeWindowFocusEvents,
                    lastNativeWindowFocused, nativeSourceEventsBefore: sourceEventsBefore, nativeSourceEventsAfter: nativeSourceFileEvents,
                    postedSessionMatchesCurrent: !!current && value?.session === current.session,
                    postedRevisionMatchesCurrent: !!current && value?.revision === current.revision,
                    expectedValueDigest: sha(expected), postedValueDigest: typeof value?.value === "string" ? sha(value.value) : undefined });
                evidence.revealFailures = failures; throw error;
            }
        };
        const nativeSave = async () => {
            const count = saveCalls;
            await bounded(vscode.commands.executeCommand("workbench.action.files.save"));
            await until(() => saveCalls > count && tabs().every(tab => !tab.isDirty));
            noSourceDocuments();
        };
        const inspectBackup = async (id: string): Promise<BackupRecord> => {
            assert.ok(context.storageUri && dirname(resolve(id)) === resolve(context.storageUri.fsPath));
            const issued = context.workspaceState.keys().filter(key => key.startsWith(RECORD_PREFIX))
                .map(key => context.workspaceState.get<BackupRecord>(key)).find(record => record?.id === id);
            assert.ok(issued && issued.schemaVersion === 1); assert.equal(issued.source, sourceUri().toString());
            assert.equal(issued.root, folder.uri.toString()); assert.match(issued.keyId, /^soterai\.lite\.secureEditor\.recovery\.[0-9a-f-]{36}$/);
            const bytes = await readFile(id); assert.ok(bytes.length <= 512 * 1024); assert.equal(sha(bytes), issued.digest);
            const text = bytes.toString("utf8"); noValues(text); const envelope = JSON.parse(text);
            assert.equal(envelope.source, issued.source); assert.equal(envelope.root, issued.root); assert.equal(envelope.keyId, issued.keyId);
            assert.equal(Buffer.from(envelope.nonce, "base64").length, 12); assert.equal(Buffer.from(envelope.tag, "base64").length, 16);
            assert.equal(Object.hasOwn(envelope, "key"), false); assert.equal(Object.hasOwn(envelope, "savedText"), false);
            assert.equal(Object.hasOwn(envelope, "draftText"), false); return issued;
        };
        if (phase === "save") {
            let primary: NativeView | undefined;
            await check("F05-H01", async () => {
                assert.equal(multipleEditors, true); assert.ok(registeredProvider);
                assert.equal(sourceDocumentCalls, 0); assert.equal(sourceDocumentEvents, 0);
                await config!.update(FLAG, true, vscode.ConfigurationTarget.Global);
                await files.update("hotExit", "onExitAndWindowClose", vscode.ConfigurationTarget.Global);
                await files.update("autoSave", "off", vscode.ConfigurationTarget.Global);
                await writeFile(sourceUri().fsPath, SOURCE, { flag: "wx" });
                evidence.sourceInitialDigest = sha(SOURCE); evidence.nativeCustomProviderRegistered = true;
            });
            await check("F05-H02", async () => {
                primary = await nativeOpen(); assert.equal(tabs().length, 1);
                const tab = tabs()[0]; assert.ok(tab.input instanceof vscode.TabInputCustom);
                assert.equal(tab.input.viewType, VIEW_TYPE); assert.equal(originalSourceOpenCount(), 0);
                assert.ok(primary.panel.webview.html.includes("DATABASE_URL"));
                evidence.defaultHtmlDigest = sha(primary.panel.webview.html); evidence.originalTextDocumentsZero = true;
            });
            await check("F05-H03", async () => {
                assert.ok(primary); await settledBinding(primary, counts => { evidence.initialRevealSettling = counts; });
                evidence.preRevealStableBindingObserved = true;
                const before = primary.messages.length, prompts = nativeModalCalls;
                revealApproval = false; await send(primary, "reveal");
                assert.equal(primary.messages.length, before); assert.ok(nativeModalCalls > prompts);
                revealApproval = true; const started = performance.now(); await reveal(primary, URL);
                const html = primary.panel.webview.html; await readSafely();
                await until(() => primary!.panel.webview.html !== html, 12_000);
                assert.ok(performance.now() - started >= 10_000, "A real ten-second hide timer must run.");
                masked(primary); evidence.realRevealHideTimerObserved = true;
            });
            await check("F05-H04", async () => {
                assert.ok(primary); primary.panel.reveal(vscode.ViewColumn.One, false);
                await bounded(vscode.commands.executeCommand("workbench.action.splitEditorRight"));
                await until(() => tabs().length === 2 && currentViews().length === 2);
                const sibling = currentViews().find(view => view !== primary)!;
                assert.equal(sibling.document, primary.document); assert.notEqual(binding(sibling).session, binding(primary).session);
                masked(primary); masked(sibling); const otherCount = primary.messages.length;
                await reveal(sibling, URL); assert.equal(primary.messages.length, otherCount);
                await send(sibling, "hide"); masked(sibling); noSourceDocuments(); primary = sibling;
                evidence.nativeSplitSharedDocument = true; evidence.revealRecipientPanelOnly = true;
            });
            await check("F05-H05", async () => {
                assert.ok(primary); primary.panel.reveal(primary.panel.viewColumn, false); input = NEW_URL;
                const changed = editEvents, initialRevision = binding(primary).revision;
                await send(primary, "edit"); await until(() => editEvents > changed && tabs().some(tab => tab.isDirty));
                assert.ok(inputCalls > 0); assert.ok(binding(primary).revision > initialRevision);
                for (const view of currentViews()) masked(view);
                assert.equal(sha(await readFile(sourceUri().fsPath)), sha(SOURCE));
                const beforeUndo = binding(primary).revision;
                await bounded(vscode.commands.executeCommand("undo"));
                await until(() => binding(primary!).revision > beforeUndo && tabs().every(tab => !tab.isDirty));
                const beforeRedo = binding(primary).revision;
                await bounded(vscode.commands.executeCommand("redo"));
                await until(() => binding(primary!).revision > beforeRedo && tabs().some(tab => tab.isDirty));
                await nativeSave(); assert.equal(sha(await readFile(sourceUri().fsPath)), sha(SAVED));
                for (const view of currentViews()) masked(view); evidence.nativeUndoRedoSaveObserved = true;
                evidence.savedSourceDigest = sha(SAVED);
            });
            await check("F05-H06", async () => {
                const oldDocument = primary?.document, before = opens.length;
                assert.ok(await vscode.window.tabGroups.close(tabs(), true)); await until(() => currentViews().length === 0 && tabs().length === 0);
                primary = await nativeOpen(); assert.ok(opens.length > before); assert.notEqual(primary.document, oldDocument);
                await reveal(primary, NEW_URL); await send(primary, "hide"); await readSafely();
                masked(primary); noSourceDocuments(); evidence.nativeCloseReopenObserved = true;
            });
            await check("F05-H07", async () => {
                assert.ok(primary); input = DRAFT_URL; const before = editEvents;
                await send(primary, "edit"); await until(() => editEvents > before && tabs().some(tab => tab.isDirty));
                const revision = binding(primary).revision;
                await until(() => {
                    const currentDocumentRows = backups.filter(row => row.document === primary!.document && row.source === sourceUri().toString());
                    const currentRevisionRows = currentDocumentRows.filter(row => row.revision === revision);
                    const completedRows = currentRevisionRows.filter(row => !!row.id && !row.failed);
                    evidence.finalDirtyNativeBackupMatch = { revision, observedBackupRows: backups.length,
                        currentDocumentRows: currentDocumentRows.length, currentRevisionRows: currentRevisionRows.length,
                        completedMatchingRows: completedRows.length };
                    return completedRows.length > 0;
                }, 20_000);
                const observed = backups.filter(row => row.document === primary!.document && row.source === sourceUri().toString() && row.revision === revision && row.id && !row.failed);
                evidence.nativeBackupInspectionStage = "inspect-issued-backup";
                const issued = await inspectBackup(observed.at(-1)!.id!);
                evidence.nativeBackupInspectionStage = "verified-key-api-counts";
                assert.ok(secretStores > 0 && secretGets >= secretStores);
                evidence.nativeBackupInspectionStage = "saved-source-digest";
                assert.equal(sha(await readFile(sourceUri().fsPath)), sha(SAVED));
                evidence.nativeBackupInspectionStage = "fresh-hot-exit-settings";
                const currentFiles = vscode.workspace.getConfiguration("files");
                evidence.hotExitMatchesExpected = currentFiles.get("hotExit") === "onExitAndWindowClose";
                evidence.autoSaveMatchesExpected = currentFiles.get("autoSave") === "off";
                assert.equal(currentFiles.get("hotExit"), "onExitAndWindowClose"); assert.equal(currentFiles.get("autoSave"), "off");
                evidence.nativeBackupInspectionStage = "masked-panels-and-zero-source-documents";
                noSourceDocuments(); for (const view of currentViews()) masked(view);
                const receipt = { schemaVersion: 1, runtime, profile: resolve(profile!), workspace: root,
                    sourceSavedDigest: sha(SAVED), expectedDraftDigest: sha(DRAFT), nativeBackupIdDigests: observed.map(row => sha(row.id!)),
                    observedBackupCiphertextDigest: issued.digest, privateDraftKeptDirtyForHotExit: true };
                evidence.nativeBackupInspectionStage = "write-hot-exit-receipt";
                await writeFile(join(root, RECEIPT), JSON.stringify(receipt) + "\n", { flag: "wx" });
                evidence.nativeBackupInspectionStage = "complete";
                evidence.nativeBackupForFinalDirtyRevision = true; evidence.backupCiphertextDigest = issued.digest;
                evidence.actualNativeHotExitPending = true;
            });
        } else {
            const receipt = JSON.parse(await readFile(join(root, RECEIPT), "utf8"));
            let primary: NativeView | undefined;
            await check("F05-H08", async () => {
                assert.equal(receipt.runtime, runtime); assert.equal(receipt.profile, resolve(profile!)); assert.equal(receipt.workspace, root);
                assert.equal(receipt.sourceSavedDigest, sha(SAVED)); assert.equal(receipt.expectedDraftDigest, sha(DRAFT));
                // Do not call provider.openCustomDocument manually. The restored tab must
                // arrive from the real workbench with its actual recovery backupId.
                await until(() => opens.some(row => isSource(row.document.uri) && !!row.backupId) && currentViews().length > 0 && tabs().some(tab => tab.isDirty), 20_000);
                const restored = opens.find(row => isSource(row.document.uri) && row.backupId)!;
                const issued = await inspectBackup(restored.backupId!);
                restoredIdObservedBeforeClose = (receipt.nativeBackupIdDigests as string[]).includes(sha(restored.backupId!));
                primary = currentViews().find(view => view.document === restored.document)!; assert.ok(primary);
                masked(primary); noSourceDocuments();
                await settledBinding(primary, counts => { evidence.recoveredRevealSettling = counts; });
                await reveal(primary, DRAFT_URL); await send(primary, "hide");
                evidence.workbenchSuppliedNativeRecoveryId = true; evidence.restoredCiphertextDigest = issued.digest;
                evidence.recoveredDraftOwnerValueMatched = true;
            });
            await check("F05-H09", async () => {
                assert.ok(primary); recoveryApproval = true;
                primary.panel.reveal(primary.panel.viewColumn, false); await nativeSave();
                assert.equal(sha(await readFile(sourceUri().fsPath)), sha(DRAFT));
                await readSafely(); masked(primary); noSourceDocuments(); evidence.recoveredSavedDigest = sha(DRAFT);
            });
            await check("F05-H10", async () => {
                assert.ok(primary); input = NEW_URL; await send(primary, "edit"); await until(() => tabs().some(tab => tab.isDirty));
                await reveal(primary, NEW_URL); const before = primary.messages.length, beforeInput = inputCalls;
                await config!.update(FLAG, false, vscode.ConfigurationTarget.Global); await wait(100);
                for (const view of currentViews()) masked(view);
                await send(primary, "reveal"); await send(primary, "edit");
                assert.equal(primary.messages.length, before); assert.equal(inputCalls, beforeInput);
                assert.deepEqual(await vscode.commands.executeCommand("soterai.openSecureEditor", sourceUri()), { status: "UNAVAILABLE" });
                const failed = saveFailures;
                await bounded(vscode.commands.executeCommand("workbench.action.files.save")).catch(() => undefined);
                await until(() => saveFailures > failed); assert.equal(sha(await readFile(sourceUri().fsPath)), sha(DRAFT));
                assert.ok(tabs().some(tab => tab.isDirty)); await readSafely(); noSourceDocuments();
                await config!.update(FLAG, true, vscode.ConfigurationTarget.Global); await nativeSave();
                assert.equal(sha(await readFile(sourceUri().fsPath)), sha(SAVED));
                evidence.machineWithdrawalWithheldNativeSave = true; evidence.safeReaderRetainedAllValueMasking = true;
            });
        }
    } catch (error) { driverFailure = error instanceof Error ? error.name : "UnknownFailure"; }
    finally {
        if (config && phase === "reload") {
            try {
                await config.update(FLAG, oldFlag, vscode.ConfigurationTarget.Global);
                const files = vscode.workspace.getConfiguration("files");
                await files.update("hotExit", oldHotExit, vscode.ConfigurationTarget.Global);
                await files.update("autoSave", oldAutoSave, vscode.ConfigurationTarget.Global);
            } catch (error) { driverFailure ??= error instanceof Error ? error.name : "UnknownFailure"; }
        }
        for (const listener of listeners.splice(0)) listener.dispose();
        for (const restore of restorePatches.reverse()) { try { restore(); } catch { driverFailure ??= "PatchRestorationFailure"; } }
    }
    let currentRuntime: string | undefined, hostProbeSha256: string | undefined;
    try { currentRuntime = bundle ? sha(await readFile(bundle)) : undefined; hostProbeSha256 = sha(await readFile(__filename)); }
    catch (error) { driverFailure ??= error instanceof Error ? error.name : "UnknownFailure"; }
    const result = { schemaVersion: 1, observedAt: new Date().toISOString(), phase, syntheticOnly: true,
        workspace: root, declaredProfilePath: profile ? resolve(profile) : undefined, hostVersion: vscode.version,
        extensionBundleSha256: runtime, currentDeveloperBundleSha256: currentRuntime, hostProbeSha256,
        observations, evidence, driverFailure, sourceDocumentCalls, sourceDocumentEvents,
        nativeWindowFocusEvents, lastNativeWindowFocused, nativeSourceFileEvents,
        nativeOpenCalls: opens.length, nativeResolvedPanels: views.length, nativeEditEvents: editEvents,
        nativeSaveCalls: saveCalls, nativeSaveFailures: saveFailures, nativeBackupCalls: backups.length,
        nativeBackupFailures: backups.filter(row => row.failed).length, nativeSecretStorageStores: secretStores, nativeSecretStorageGets: secretGets,
        scriptedNativeModalCalls: nativeModalCalls, scriptedPasswordInputCalls: inputCalls, restoredIdObservedBeforeClose,
        passed: observations.filter(row => row.status === "PASS").length,
        failed: observations.filter(row => row.status === "FAIL").length + (driverFailure ? 1 : 0),
        notRun: observations.filter(row => row.status === "NOT_RUN").length,
        actualNativeHotExitPending: phase === "save" && observations.every(row => row.status === "PASS"),
        identityScope: "Byte-identical packaged runtime, actual persistent developer context, native CustomDocument/WebviewPanel/TabInputCustom/workbench operations. Not clean-profile install proof.",
        interactionScope: "Actual registered native-panel listener and native modal/password API arguments with scripted same-instance owner decisions; no browser DOM automation or human owner-presence proof.",
        recoveryScope: "Save phase observes actual workbench backup; reload independently requires workbench-supplied issued backupId. Final closing backup may be generated after the save-phase probe. No manual-provider backup/restoration fallback is counted as native recovery.",
        custodyScope: "Synthetic isolated native SecretStorage store/get use; not independent OS custody certification.",
        independence: "LOW", ownerPresence: "SCRIPTED_SAME_EXTENSION_API_INSTANCE", externalAgents: "NOT_TESTED" };
    await writeFile(output, JSON.stringify(result, null, 2) + "\n", { flag: "wx" });
    if (result.failed || result.notRun || currentRuntime !== runtime) throw new Error("F05 native host failed or incomplete; inspect retained observation IDs.");
}

function originalSourceOpenCount(): number { return sourceDocumentCalls + sourceDocumentEvents; }
