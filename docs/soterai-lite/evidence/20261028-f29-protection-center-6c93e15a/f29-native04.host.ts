/** PREPARED, NOT EXECUTED. F29 installed-owner native API fixture.
 * No product imports and no replacement owners. Bootstrap must call
 * beforeActivate(context) BEFORE actual.activate(context), then run(context).
 * Captured registrations forward to the real VS Code API unchanged. Scripted
 * decisions, injected API states and synthetic reports are LOW independence.
 */
import * as vscode from "vscode";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import nativeFs from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";

const FLAG = "lite.protectionCenter", RULES = "soterai.aiForbidden.v1", ACTIVITY = "soterai.sentinelEvents";
const PROFILE_RECEIPT = "soterai.lite.ps51.profile.v1", PROFILE_NAME = "SoterAI PowerShell 5.1 (checked commands)";
const PRIVATE = "FAKE_ONLY_F29_NATIVE_PRIVATE_4f6392c1";
const VIEW_IDS = ["soterai-protected-items", "soterai-protection-activity", "soterai-protection-coverage"] as const;
const PRIMARY = [
    "Actual shipped activation registers three real native tree views and a real decoration provider",
    "Shipped manifest exposes restricted default-true machine flag, native menus, legacy gates and one existing consolidated MAIN status owner",
    "Native restricted machine flag refuses a repository override",
    "Trusted fresh owner shows honest empty saved restrictions and disabled owned activity",
    "Actual TreeItems expose bounded native accessibility, theme icons and finite keyboard command arguments",
    "Actual Protection Center focus and native list navigation commands complete without a fabricated keyboard claim",
    "Actual action dispatch rejects caller commands, objects and prototype names without reaching an owner",
    "Actual existing restriction owner saves one public synthetic selector through native file selection",
    "Saved explicit row and Explorer decoration appear without presentation opening protected contents",
    "Actual existing sensitive owner adds a masked public selector and preserves the ordinary deny",
    "Actual existing rule review cancellation changes no persistent policy",
    "Cancelling the actual optional workflow chooser dispatches no backend",
    "Actual reviewed PowerShell setup cancellation preserves both project setting and recovery receipt",
    "Actual reviewed setup and restore owners save and recover the synthetic project setting; unowned restore refuses",
    "Actual Sentinel watcher feeds finite private-value-free Activity rows",
    "Actual missing packaged report remains MISSING and live NOT_TESTED",
    "Actual malformed synthetic installed-copy report remains INVALID without a positive claim",
    "Actual mismatched synthetic installed-copy identity remains MISMATCH without a positive claim",
    "Actual stale synthetic matching report remains STALE without a positive claim",
    "Actual fresh matching synthetic metadata remains NOT_TESTED and never becomes accepted coverage evidence",
    "Injected exact installed-bundle read outage renders UNAVAILABLE without changing runtime bytes",
    "Injected native Memento policy read failure renders a fixed unavailable state and recovers",
    "Injected native untrusted workspace facts withhold saved rows and unsafe actions; revoke remains callable",
    "Injected native empty workspace facts show open-workspace guidance without altering the real workspace",
    "Actual machine withdrawal clears presentation and decoration, preserves rules, restores legacy status action, then saves restart custody",
];
const RESTART = [
    "Fresh actual host retains exact policy custody and does not duplicate persistent restriction writes",
    "Fresh actual native views redisplay saved selectors and real Explorer restriction decoration",
    "Fresh actual Activity presentation contains finite metadata without synthetic private values",
    "Actual TreeItem revoke dispatch resolves a pending original managed read; a late scripted answer cannot grant it",
    "Final actual machine withdrawal preserves denies and recovery records and disables the selected Sentinel preference",
];

type Row = { id: string; scope: string; status: "NOT_RUN" | "PASS" | "FAIL"; errorName?: string };
type CenterElement = { label: string; description?: string; icon: string; action?: string };
type CapturedView = { provider: vscode.TreeDataProvider<CenterElement>; view: vscode.TreeView<CenterElement> };
type Call = { command: string; argumentCount: number; status?: string; rejected?: true };
const restores: Array<() => void> = [], nativeDisposables: vscode.Disposable[] = [], panels: vscode.WebviewPanel[] = [];
const views = new Map<string, CapturedView>(), decorationProviders: vscode.FileDecorationProvider[] = [];
const statusItems: vscode.StatusBarItem[] = [], ownerCalls: Call[] = [], apiCommands: string[] = [], notices: string[] = [];
let mainStatusOwner: vscode.StatusBarItem | undefined;
const apiDescriptorObservations: Array<{ name: string; own: boolean; kind: string; configurable: boolean; frozen: boolean }> = [];
const contextKeys = new Map<string, unknown>();
const readObservations = { document: 0, vscodeRead: 0, nodeReadFile: 0, nodeOpen: 0, syncReadFile: 0, syncOpen: 0 };
const settingChanges: Array<{ section: string; key: string; target: unknown }> = [];
const evidenceMutations: Array<{ action: string; archive?: string; bytes?: number; sha256?: string }> = [];
let root = "", extensionRoot = "", bundle = "", phase: "primary" | "restart";
let folder: vscode.WorkspaceFolder, originalFolders: readonly vscode.WorkspaceFolder[] | undefined;
let selectedFile: vscode.Uri | undefined, observedFile = "", policyReadFailure = false, installedReadFailure = false;
let workspaceMode: "normal" | "untrusted" | "empty" = "normal";
let picker: "cancel" | "ps51" | "restorePs51" = "cancel", folderPick: "cancel" | "first" = "cancel";
let terminalApproval: "cancel" | "apply" | "restore" = "cancel", approveSentinelDisable = false;
let heldRead: ((answer: string | undefined) => void) | undefined, holdRead = false, readModalCount = 0;
let policyWrites = 0, reportCounter = 0, reportPath = "", originalReportArchive: string | undefined;
let currentReportPresent = false, evidencePrepared = false;
let rendererGate: { status: string; readySha256: string; observationsPin?: unknown } | undefined;
let rendererObserving = false;
const protectedPaths = new Set<string>();
const sha = (raw: Uint8Array | string) => createHash("sha256").update(raw).digest("hex");
const within = (base: string, value: string) => { const part = relative(resolve(base), resolve(value)); return part === "" || !part.startsWith("..") && !isAbsolute(part); };
const pathKey = (value: unknown): string | undefined => {
    try { return typeof value === "string" ? resolve(value).toLowerCase() : value instanceof URL && value.protocol === "file:" ? resolve(vscode.Uri.parse(value.href).fsPath).toLowerCase() : undefined; }
    catch { return; }
};
const trackedRead = (value: unknown) => { const key = pathKey(value); return key !== undefined && protectedPaths.has(key); };
function valueFree(value: unknown): void { assert(!(typeof value === "string" ? value : JSON.stringify(value) ?? "").includes(PRIVATE), "Private synthetic value entered the native presentation."); }

/** Fixture-only facade. Its Proxy target is a NEW, extensible object, never the
 * frozen native object. All reads/methods use the untouched real owner as the
 * receiver; actual return values, promises and thrown errors are preserved. */
export function createNativeForwardingFacade<T extends object>(source: T, observe?: (name: PropertyKey, args: readonly unknown[]) => void): T {
    const target = Object.create(null) as object;
    const methods = new Map<PropertyKey, { original: Function; forwarded: Function }>();
    const read = (name: PropertyKey): unknown => {
        const value: unknown = Reflect.get(source, name, source);
        if (typeof value !== "function") return value;
        const previous = methods.get(name);
        if (previous?.original === value) return previous.forwarded;
        const forwarded = (...args: unknown[]) => { observe?.(name, args); return Reflect.apply(value, source, args); };
        methods.set(name, { original: value, forwarded }); return forwarded;
    };
    return new Proxy(target, {
        get: (_target, name) => read(name), has: (_target, name) => Reflect.has(source, name),
        ownKeys: () => Reflect.ownKeys(source), getPrototypeOf: () => Reflect.getPrototypeOf(source),
        getOwnPropertyDescriptor: (_target, name) => {
            const original = Reflect.getOwnPropertyDescriptor(source, name); if (!original) return;
            // Descriptors describe the fresh observation facade, not the frozen
            // source. Configurable=true is required by the fresh Proxy target.
            return "value" in original
                ? { configurable: true, enumerable: original.enumerable, writable: false, value: read(name) }
                : { configurable: true, enumerable: original.enumerable, get: () => read(name), set: undefined };
        },
        set: () => false, defineProperty: () => false, deleteProperty: () => false,
        setPrototypeOf: () => false, preventExtensions: () => false,
    }) as T;
}

/** Inspect an actual configurable own getter BEFORE replacement; retain and
 * restore its complete descriptor exactly. No nested frozen API is modified. */
export function replaceNativeOwnGetter(object: object, name: PropertyKey, read: () => unknown): () => void {
    const previous = Object.getOwnPropertyDescriptor(object, name);
    assert(previous && typeof previous.get === "function" && previous.configurable === true,
        "Native getter descriptor is unsupported; refusing mutation.");
    Object.defineProperty(object, name, { configurable: true, enumerable: previous.enumerable, get: read, set: previous.set });
    return () => { Object.defineProperty(object, name, previous); assert.deepEqual(Object.getOwnPropertyDescriptor(object, name), previous); };
}

/** Auxiliary legacy indicators are separate owners. Select the actual main
 * item by its public assigned command, reject missing/ambiguous main owners,
 * then require its accepted public priority. Never use allocation index zero. */
export function selectMainStatusOwner<T extends { readonly command?: unknown; readonly priority?: number }>(items: readonly T[]): T {
    const selected = items.filter(item => item.command === "soterai.openProtectionCenter" || item.command === "soterai.openControlPanel");
    assert.equal(selected.length, 1, "Exactly one actual consolidated MAIN status owner is required.");
    assert.equal(selected[0].priority, 100, "The actual main status owner public priority changed."); return selected[0];
}
function mainStatus(): vscode.StatusBarItem {
    const observed = selectMainStatusOwner(statusItems);
    if (!mainStatusOwner) mainStatusOwner = observed;
    assert.equal(observed, mainStatusOwner, "Consolidated main status owner identity changed."); return observed;
}
function patch(object: object, name: string, value: unknown): void {
    const previous = Object.getOwnPropertyDescriptor(object, name);
    let owner: object | null = object, actual = previous;
    for (let depth = 0; !actual && owner && depth < 32; depth++) { owner = Object.getPrototypeOf(owner); if (owner) actual = Object.getOwnPropertyDescriptor(owner, name); }
    assert(actual, "Native member descriptor unavailable; refusing mutation.");
    assert(previous ? previous.configurable === true : Object.isExtensible(object), "Native member cannot be safely observed.");
    apiDescriptorObservations.push({ name, own: previous !== undefined, kind: "value" in actual ? "data" : "accessor", configurable: actual.configurable === true, frozen: Object.isFrozen(object) });
    Object.defineProperty(object, name, { configurable: true, writable: true, value });
    restores.push(() => {
        if (previous) Object.defineProperty(object, name, previous); else assert(Reflect.deleteProperty(object, name));
        assert.deepEqual(Object.getOwnPropertyDescriptor(object, name), previous);
    });
}
function getter(object: object, name: string, read: () => unknown): void {
    const previous = Object.getOwnPropertyDescriptor(object, name);
    assert(previous && typeof previous.get === "function" && previous.configurable === true, "Actual native getter is unsupported.");
    apiDescriptorObservations.push({ name, own: true, kind: "accessor", configurable: true, frozen: Object.isFrozen(object) });
    restores.push(replaceNativeOwnGetter(object, name, read));
}
async function until(predicate: () => boolean, description: string): Promise<void> {
    const end = Date.now() + 15000;
    while (!predicate() && Date.now() < end) await new Promise<void>(done => setTimeout(done, 20));
    assert(predicate(), description);
}
async function bounded<T>(work: PromiseLike<T>, description: string): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try { return await Promise.race([Promise.resolve(work), new Promise<never>((_done, reject) => { timer = setTimeout(() => reject(Error(description)), 15000); })]); }
    finally { if (timer) clearTimeout(timer); }
}
async function updateFlag(key: string, value: boolean): Promise<void> {
    const config = vscode.workspace.getConfiguration("soterai");
    if (config.inspect<boolean>(key)?.globalValue === value) return;
    let acknowledge!: () => void;
    const acknowledged = new Promise<void>(done => { acknowledge = done; });
    const listener = vscode.workspace.onDidChangeConfiguration(change => {
        if (change.affectsConfiguration("soterai." + key) && config.inspect<boolean>(key)?.globalValue === value) acknowledge();
    });
    try { await config.update(key, value, vscode.ConfigurationTarget.Global); await bounded(acknowledged, "Native machine flag acknowledgement unavailable."); }
    finally { listener.dispose(); }
}
async function children(id: typeof VIEW_IDS[number]): Promise<CenterElement[]> {
    const captured = views.get(id); assert(captured, "Actual shipped native provider was not captured.");
    return [...(await captured.provider.getChildren() ?? [])];
}
async function items(id: typeof VIEW_IDS[number]): Promise<vscode.TreeItem[]> {
    const provider = views.get(id)!.provider;
    return Promise.all((await children(id)).map(row => Promise.resolve(provider.getTreeItem(row))));
}
async function refresh(): Promise<void> { await vscode.commands.executeCommand("soterai.refreshProtectionCenter"); }
const allRows = async () => Object.fromEntries(await Promise.all(VIEW_IDS.map(async id => [id, await children(id)])));
async function noLivePass(): Promise<void> {
    const rows = await children(VIEW_IDS[2]), text = JSON.stringify(rows); valueFree(rows);
    assert(text.includes("Live verification: NOT_TESTED")); assert(text.includes("Uncovered: unmanaged native reads"));
    assert(!text.includes("Reported PASS")); assert(!text.includes("100%"));
}
async function centerAction(action: unknown): Promise<{ status: string }> { return vscode.commands.executeCommand<{ status: string }>("soterai.protectionCenterAction", action); }
function statusOf(value: unknown): string | undefined {
    try { if (!value || typeof value !== "object") return; const d = Object.getOwnPropertyDescriptor(value, "status"); return d && "value" in d && typeof d.value === "string" ? d.value : undefined; }
    catch { return; }
}
function releaseHeldRead(value: string | undefined): void { const release = heldRead; if (typeof release === "function") release(value); }
function assertOwner(command: string, from: number, expectedStatus: string): void {
    const found = ownerCalls.slice(from).filter(call => call.command === command);
    assert.equal(found.length, 1); assert.equal(found[0].argumentCount, 0); assert.equal(found[0].status, expectedStatus);
}
const policy = (context: vscode.ExtensionContext) => context.workspaceState.get<Record<string, unknown>>(RULES, {});
const policyDigest = (context: vscode.ExtensionContext) => sha(JSON.stringify(policy(context)));
function terminalSetting(): unknown { return vscode.workspace.getConfiguration("terminal.integrated", folder.uri).inspect("defaultProfile.windows")?.workspaceValue; }
async function nativeDecoration(uri: vscode.Uri): Promise<vscode.FileDecoration | undefined> {
    const cancellation = new vscode.CancellationTokenSource();
    try {
        const candidates = await Promise.all(decorationProviders.map(provider => Promise.resolve(provider.provideFileDecoration(uri, cancellation.token))));
        return candidates.find((item): item is vscode.FileDecoration => item !== undefined && item !== null && typeof item.tooltip === "string" && item.tooltip.includes("Saved SoterAI restriction"));
    } finally { cancellation.dispose(); }
}

async function rendererObservationGate(runtime: string): Promise<void> {
    const selected = process.env.SOTERAI_F29_RENDERER_GATE_DIRECTORY;
    if (!selected) return; // Actual renderer coverage remains a separate gate.
    assert(isAbsolute(selected)); const directory = resolve(selected);
    assert.match(directory, /^D:\\SoterAI-Lite-test-profiles\\/i); assert(!within(root, directory));
    const stat = await fs.lstat(directory); assert(stat.isDirectory() && !stat.isSymbolicLink());
    const readyFile = join(directory, "f29-renderer-ready.json"), doneFile = join(directory, "f29-renderer-done.json");
    await assert.rejects(fs.lstat(doneFile), (error: NodeJS.ErrnoException) => error.code === "ENOENT");
    const panel = panels.find(item => item.viewType === "soteraiProjectPrivacy"); assert(panel);
    await until(() => panel.webview.html.includes("Project privacy"), "Actual owner privacy HTML was not populated.");
    const html = Buffer.from(panel.webview.html, "utf8"), htmlPath = join(directory, "f29-project-privacy-captured.html");
    await fs.writeFile(htmlPath, html, { flag: "wx" });
    const ready = Buffer.from(JSON.stringify({ schemaVersion: 1, feature: "F29", profile: process.env.USERPROFILE,
        runRoot: directory, workspace: root, loadedBundleSha256: runtime, installedExtensionPath: extensionRoot,
        html: { path: htmlPath, bytes: html.length, sha256: sha(html) }, theme: { kind: vscode.window.activeColorTheme.kind },
        stage: "N06_ACTUAL_PROJECT_PRIVACY_CAPTURE", source: "ACTUAL_SHIPPED_OWNER_WEBVIEW_HTML_UNMODIFIED_UTF8",
        syntheticOnly: true, signals: 0 }) + "\n", "utf8");
    const readySha256 = sha(ready);
    rendererGate = { status: "WAITING_FOR_SEPARATE_ACTUAL_RENDERER_OBSERVER", readySha256 };
    const deadline = Date.now() + 180000;
    // Establish the starting native view before the keyboard-only observer begins.
    await vscode.commands.executeCommand("soterai.openProtectionCenter");
    await until(() => views.get(VIEW_IDS[0])!.view.visible, "Actual native starting view unavailable before renderer readiness.");
    rendererObserving = true;
    try {
    await fs.writeFile(readyFile, ready, { flag: "wx" });
    while (Date.now() < deadline) {
        try {
            const doneStat = await fs.lstat(doneFile); assert(doneStat.isFile() && !doneStat.isSymbolicLink() && doneStat.nlink === 1 && doneStat.size <= 65536);
            const done = JSON.parse(await fs.readFile(doneFile, "utf8"));
            assert.equal(done.schemaVersion, 1); assert.equal(done.status, "OBSERVER_COMPLETED"); assert.equal(done.readySha256, readySha256); assert.equal(done.signals, 0);
            const pin = done.observationsPin; assert(pin && typeof pin.path === "string" && within(directory, pin.path));
            const pinStat = await fs.lstat(pin.path); assert(pinStat.isFile() && !pinStat.isSymbolicLink() && pinStat.nlink === 1 && pinStat.size <= 8 * 1024 * 1024);
            const raw = await fs.readFile(pin.path); assert.equal(raw.length, pin.bytes); assert.equal(sha(raw), pin.sha256);
            rendererGate = { status: "SEPARATE_ACTUAL_RENDERER_OBSERVER_RECEIPT_AVAILABLE_REQUIRES_ROOT_REVIEW", readySha256, observationsPin: pin };
            assert.equal(sha(await fs.readFile(bundle)), runtime); return;
        } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
        await new Promise<void>(done => setTimeout(done, 100));
    }
    rendererGate.status = "OBSERVER_DEADLINE_INCOMPLETE_NO_SIGNALS"; throw Error("Separate native renderer observer did not complete within its prepared bounded gate.");
    } finally { rendererObserving = false; }
}

/** All mutation is restricted to a new installed execution copy under D:. Reports
 * have no passing suites/surfaces. Each previous report is retained by rename;
 * runtime bundle bytes are never written, patched or replaced. */
async function stageReport(raw?: string): Promise<void> {
    assert(evidencePrepared); assert(within(extensionRoot, reportPath)); assert.match(extensionRoot, /^D:\\SoterAI-Lite-test-profiles\\/i);
    if (currentReportPresent) {
        const before = await fs.lstat(reportPath); assert(before.isFile() && !before.isSymbolicLink() && before.nlink === 1);
        const archive = join(dirname(reportPath), `f29-synthetic-report-retained-${String(++reportCounter).padStart(2, "0")}.json`);
        await assert.rejects(fs.lstat(archive), (error: NodeJS.ErrnoException) => error.code === "ENOENT");
        await fs.rename(reportPath, archive); currentReportPresent = false;
        const bytes = await fs.readFile(archive); evidenceMutations.push({ action: "ARCHIVED_SYNTHETIC_INPUT", archive, bytes: bytes.length, sha256: sha(bytes) });
    }
    if (raw !== undefined) {
        assert(Buffer.byteLength(raw) <= 64 * 1024); await fs.writeFile(reportPath, raw, { flag: "wx" }); currentReportPresent = true;
        evidenceMutations.push({ action: "STAGED_SYNTHETIC_INPUT_NOT_SHIPPED_EVIDENCE", bytes: Buffer.byteLength(raw), sha256: sha(raw) });
    }
}
async function prepareReports(): Promise<void> {
    reportPath = join(extensionRoot, "verification", "project-privacy-verification.json");
    assert(within(extensionRoot, reportPath));
    try { const directory = await fs.lstat(dirname(reportPath)); assert(directory.isDirectory() && !directory.isSymbolicLink()); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; await fs.mkdir(dirname(reportPath)); }
    try {
        const before = await fs.lstat(reportPath); assert(before.isFile() && !before.isSymbolicLink() && before.nlink === 1 && before.size <= 65536);
        originalReportArchive = join(dirname(reportPath), "f29-original-report-retained.json");
        await assert.rejects(fs.lstat(originalReportArchive), (error: NodeJS.ErrnoException) => error.code === "ENOENT");
        await fs.rename(reportPath, originalReportArchive);
        const raw = await fs.readFile(originalReportArchive); evidenceMutations.push({ action: "ARCHIVED_ORIGINAL_INSTALLED_COPY_REPORT", archive: originalReportArchive, bytes: raw.length, sha256: sha(raw) });
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    evidencePrepared = true;
}
async function restoreReports(): Promise<void> {
    if (!evidencePrepared) return;
    await stageReport(undefined);
    if (originalReportArchive) {
        const raw = await fs.readFile(originalReportArchive); await fs.rename(originalReportArchive, reportPath);
        assert.equal(sha(await fs.readFile(reportPath)), sha(raw));
        evidenceMutations.push({ action: "RESTORED_ORIGINAL_INSTALLED_COPY_REPORT", bytes: raw.length, sha256: sha(raw) });
    } else {
        await assert.rejects(fs.lstat(reportPath), (error: NodeJS.ErrnoException) => error.code === "ENOENT");
        evidenceMutations.push({ action: "RESTORED_ORIGINAL_REPORT_ABSENCE" });
    }
    evidencePrepared = false;
}

export function setupDiagnostic(): object {
    return { status: "PREPARED_INSTALLED_OWNER_NATIVE_API_FIXTURE", phase, nativeViewIds: [...views.keys()],
        nativeDecorationProviders: decorationProviders.length, statusItemCount: statusItems.length, policyWrites,
        ownerCalls: ownerCalls.length, syntheticReportInputs: evidenceMutations.length, currentWorkspaceMode: workspaceMode,
        syntheticOnly: true, productImports: false, signals: 0 };
}

export async function beforeActivate(context: vscode.ExtensionContext): Promise<void> {
    assert.equal(process.platform, "win32"); assert.equal(vscode.env.remoteName, undefined);
    assert.equal(vscode.workspace.workspaceFolders?.length, 1); assert.equal(vscode.workspace.isTrusted, true);
    folder = vscode.workspace.workspaceFolders![0]; root = folder.uri.fsPath; originalFolders = vscode.workspace.workspaceFolders;
    extensionRoot = context.extensionUri.fsPath; bundle = join(extensionRoot, "dist", "extension.js");
    for (const file of [root, context.globalStorageUri.fsPath, extensionRoot, process.env.USERPROFILE!]) assert.match(resolve(file), /^D:\\SoterAI-Lite-test-profiles\\/i);
    assert(!within(root, context.globalStorageUri.fsPath));
    const selected = process.env.SOTERAI_LITE_F17_PHASE; assert(selected === "primary" || selected === "restart"); phase = selected;
    const trust = vscode.workspace.isTrusted;
    getter(vscode.workspace, "workspaceFolders", () => workspaceMode === "empty" ? [] : originalFolders);
    getter(vscode.workspace, "isTrusted", () => workspaceMode === "untrusted" ? false : trust);
    const createView = vscode.window.createTreeView;
    patch(vscode.window, "createTreeView", (id: string, options: vscode.TreeViewOptions<CenterElement>) => {
        const view = Reflect.apply(createView, vscode.window, [id, options]) as vscode.TreeView<CenterElement>;
        if ((VIEW_IDS as readonly string[]).includes(id)) { assert(!views.has(id)); views.set(id, { provider: options.treeDataProvider, view }); }
        return view;
    });
    const registerDecoration = vscode.window.registerFileDecorationProvider;
    patch(vscode.window, "registerFileDecorationProvider", (provider: vscode.FileDecorationProvider) => {
        const result = Reflect.apply(registerDecoration, vscode.window, [provider]) as vscode.Disposable;
        decorationProviders.push(provider); return result;
    });
    const createStatus = vscode.window.createStatusBarItem;
    patch(vscode.window, "createStatusBarItem", (...args: unknown[]) => {
        const item = Reflect.apply(createStatus, vscode.window, args) as vscode.StatusBarItem; statusItems.push(item); return item;
    });
    const registerCommand = vscode.commands.registerCommand;
    patch(vscode.commands, "registerCommand", (id: string, callback: (...args: unknown[]) => unknown, thisArg?: unknown) => {
        const wrapped = function (...args: unknown[]) {
            const call: Call = { command: id, argumentCount: args.length }; ownerCalls.push(call);
            try {
                const result = Reflect.apply(callback, thisArg, args);
                return Promise.resolve(result).then(value => { call.status = statusOf(value); return value; }, error => { call.rejected = true; throw error; });
            } catch (error) { call.rejected = true; throw error; }
        };
        return Reflect.apply(registerCommand, vscode.commands, [id, wrapped, thisArg]);
    });
    const execute = vscode.commands.executeCommand;
    patch(vscode.commands, "executeCommand", (command: string, ...args: unknown[]) => {
        apiCommands.push(command);
        if (command === "setContext" && typeof args[0] === "string") contextKeys.set(args[0], args[1]);
        return Reflect.apply(execute, vscode.commands, [command, ...args]);
    });
    const stateGet = context.workspaceState.get, stateUpdate = context.workspaceState.update;
    patch(context.workspaceState, "get", (key: string, ...args: unknown[]) => {
        if (key === RULES && policyReadFailure) throw Error(PRIVATE);
        return Reflect.apply(stateGet, context.workspaceState, [key, ...args]);
    });
    patch(context.workspaceState, "update", async (key: string, value: unknown) => {
        await stateUpdate.call(context.workspaceState, key, value); if (key === RULES) policyWrites++;
    });
    const configuration = vscode.workspace.getConfiguration;
    patch(vscode.workspace, "getConfiguration", (section?: string, scope?: vscode.ConfigurationScope | null) => {
        const config = configuration.call(vscode.workspace, section, scope);
        if (section !== "terminal.integrated") return config;
        const actual = Object.getOwnPropertyDescriptor(config, "update");
        assert(actual && "value" in actual && typeof actual.value === "function" && Object.isFrozen(config), "Actual frozen native configuration contract changed.");
        return createNativeForwardingFacade(config, (name, args) => {
            if (name === "update") settingChanges.push({ section, key: String(args[0]), target: args[2] });
        });
    });
    const originalOpen = vscode.workspace.openTextDocument;
    patch(vscode.workspace, "openTextDocument", (...args: unknown[]) => {
        const input = args[0]; if (input instanceof vscode.Uri && protectedPaths.has(input.fsPath.toLowerCase()) || typeof input === "string" && trackedRead(input)) readObservations.document++;
        return Reflect.apply(originalOpen, vscode.workspace, args);
    });
    const actualFsDescriptor = Object.getOwnPropertyDescriptor(vscode.workspace, "fs");
    assert(actualFsDescriptor && typeof actualFsDescriptor.get === "function" && actualFsDescriptor.configurable === true, "Actual native fs getter contract changed.");
    const actualFs = vscode.workspace.fs, readFileDescriptor = Object.getOwnPropertyDescriptor(actualFs, "readFile");
    assert(Object.isFrozen(actualFs) && readFileDescriptor && "value" in readFileDescriptor && typeof readFileDescriptor.value === "function", "Actual frozen native fs contract changed.");
    const observedFs = createNativeForwardingFacade(actualFs, (name, args) => {
        if (name === "readFile") { const uri = args[0]; assert(uri instanceof vscode.Uri); if (trackedRead(uri.fsPath)) readObservations.vscodeRead++; }
    });
    getter(vscode.workspace, "fs", () => observedFs);
    const readFile = fs.readFile, open = fs.open, syncRead = nativeFs.readFileSync, syncOpen = nativeFs.openSync;
    patch(fs, "readFile", (...args: unknown[]) => { if (trackedRead(args[0])) readObservations.nodeReadFile++; return Reflect.apply(readFile, fs, args); });
    patch(fs, "open", (...args: unknown[]) => { if (trackedRead(args[0])) readObservations.nodeOpen++; return Reflect.apply(open, fs, args); });
    patch(nativeFs, "readFileSync", (...args: unknown[]) => { if (trackedRead(args[0])) readObservations.syncReadFile++; return Reflect.apply(syncRead, nativeFs, args); });
    patch(nativeFs, "openSync", (...args: unknown[]) => {
        if (trackedRead(args[0])) readObservations.syncOpen++;
        if (installedReadFailure && pathKey(args[0]) === bundle.toLowerCase()) throw Error(PRIVATE);
        return Reflect.apply(syncOpen, nativeFs, args);
    });
    const quickPick = vscode.window.showQuickPick;
    patch(vscode.window, "showQuickPick", (choices: unknown, options: vscode.QuickPickOptions) => {
        if (options?.title === "Protection Center: optional setup and restore") {
            if (rendererObserving) return Reflect.apply(quickPick, vscode.window, [choices, options]);
            assert(Array.isArray(choices)); valueFree(choices); assert.equal(choices.length, 20);
            return Promise.resolve(picker === "cancel" ? undefined : choices.find(choice => choice.action === picker));
        }
        return Reflect.apply(quickPick, vscode.window, [choices, options]);
    });
    const pickFolder = vscode.window.showWorkspaceFolderPick;
    patch(vscode.window, "showWorkspaceFolderPick", (...args: unknown[]) => {
        if (folderPick === "cancel") return Promise.resolve(undefined);
        if (folderPick === "first") return Promise.resolve(folder);
        return Reflect.apply(pickFolder, vscode.window, args);
    });
    const openDialog = vscode.window.showOpenDialog;
    patch(vscode.window, "showOpenDialog", (options: vscode.OpenDialogOptions) => {
        if (options?.title === "Choose a project file for a safe view") return Promise.resolve(selectedFile ? [selectedFile] : undefined);
        return Reflect.apply(openDialog, vscode.window, [options]);
    });
    const warning = vscode.window.showWarningMessage;
    patch(vscode.window, "showWarningMessage", (message: string, ...args: unknown[]) => {
        if (message === "Apply this terminal profile change to the selected project?") {
            const options = args[0] as vscode.MessageOptions; assert.equal(options.modal, true); valueFree([message, args]);
            return Promise.resolve(terminalApproval === "apply" ? "Use checked PowerShell profile" : terminalApproval === "restore" ? "Restore previous terminal profile" : undefined);
        }
        if (args.includes("Allow safe read once")) {
            const options = args[0] as vscode.MessageOptions; assert.equal(options.modal, true); valueFree(options.detail);
            readModalCount++; if (holdRead) return new Promise<string | undefined>(done => { heldRead = done; });
            return Promise.resolve(undefined);
        }
        if (message.startsWith("Disable AI Activity Sentinel monitoring?")) return Promise.resolve(approveSentinelDisable ? "Confirm this change" : undefined);
        valueFree(message); notices.push(message); return Reflect.apply(warning, vscode.window, [message, ...args]);
    });
    const info = vscode.window.showInformationMessage, errorMessage = vscode.window.showErrorMessage;
    patch(vscode.window, "showInformationMessage", (message: string, ...args: unknown[]) => { valueFree(message); notices.push(message); return Reflect.apply(info, vscode.window, [message, ...args]); });
    patch(vscode.window, "showErrorMessage", (message: string, ...args: unknown[]) => { valueFree(message); notices.push(message); return Reflect.apply(errorMessage, vscode.window, [message, ...args]); });
    const createPanel = vscode.window.createWebviewPanel;
    patch(vscode.window, "createWebviewPanel", (...args: unknown[]) => { const panel = Reflect.apply(createPanel, vscode.window, args) as vscode.WebviewPanel; panels.push(panel); return panel; });
}

export async function run(context: vscode.ExtensionContext): Promise<void> {
    const output = process.env.SOTERAI_LITE_F17_EVIDENCE; assert(output && isAbsolute(output));
    const runtime = sha(await fs.readFile(bundle)); assert.equal(runtime, process.env.SOTERAI_LITE_F17_BUNDLE_SHA256);
    const manifest = JSON.parse(await fs.readFile(join(extensionRoot, "package.json"), "utf8"));
    const scopes = phase === "primary" ? PRIMARY : RESTART;
    const rows: Row[] = scopes.map((scope, index) => ({ id: `F29-${phase === "primary" ? "N" : "R"}${String(index + 1).padStart(2, "0")}`, scope, status: "NOT_RUN" }));
    let cursor = 0, driverFailure: string | undefined, cleanupFailure: string | undefined;
    const check = async (work: () => Promise<void>) => { const row = rows[cursor++]; try { await work(); row.status = "PASS"; }
        catch (error) { row.status = "FAIL"; row.errorName = error instanceof Error ? error.name : "UnknownFailure"; throw error; } };
    const ordinary = vscode.Uri.file(join(root, "f29-public-restricted.txt")), sensitive = vscode.Uri.file(join(root, "f29-public-sensitive.txt"));
    const activityFile = vscode.Uri.file(join(root, "f29-native-activity", ".env"));
    const custody = join(dirname(root), "f29-native-restart-custody.json");
    const report = (identity = runtime, date = new Date().toISOString()) => JSON.stringify({ schemaVersion: 1, generatedAt: date,
        artifact: { extensionSha256: identity }, suites: [], surfaces: [] }) + "\n";
    const evidenceState = async (state: string) => { await refresh(); assert(JSON.stringify(await children(VIEW_IDS[2])).includes(`Packaged evidence: ${state}`)); await noLivePass(); };
    const workflow = async (action: "ps51" | "restorePs51") => { picker = action; try { return await centerAction("workflows"); } finally { picker = "cancel"; } };
    const invokeItem = async (id: typeof VIEW_IDS[number], action: string) => {
        const item = (await items(id)).find(row => row.command?.arguments?.[0] === action); assert(item?.command);
        return vscode.commands.executeCommand<{ status: string }>(item.command.command, ...(item.command.arguments ?? []));
    };
    try {
        if (phase === "primary") {
            await check(async () => {
                assert.deepEqual([...views.keys()], VIEW_IDS); assert(decorationProviders.length > 0);
                for (const { view, provider } of views.values()) { assert.equal(typeof view.reveal, "function"); assert.equal(typeof provider.getChildren, "function"); }
                assert.equal(contextKeys.get("soterai.protectionCenter"), true);
            });
            await check(async () => {
                const contributions = manifest.contributes, setting = contributions.configuration.properties["soterai." + FLAG];
                assert.equal(setting.type, "boolean"); assert.equal(setting.default, true); assert.equal(setting.scope, "machine");
                assert(manifest.capabilities.untrustedWorkspaces.restrictedConfigurations.includes("soterai." + FLAG));
                const registeredViews = contributions.views["soterai-explorer"];
                for (const id of VIEW_IDS) { const view = registeredViews.find((item: { id: string }) => item.id === id); assert(view); assert.equal(view.type, undefined); assert.equal(view.when, "soterai.protectionCenter"); }
                for (const id of ["soterai-control-panel", "soterai-project-risk", "soterai-latest-findings", "soterai-policy-status"]) assert(registeredViews.find((item: { id: string }) => item.id === id)?.when.includes("!soterai.protectionCenter"));
                assert(contributions.menus["explorer/context"].some((item: { command: string }) => item.command === "soterai.openProtectionCenter"));
                assert(contributions.menus["view/title"].some((item: { command: string }) => item.command === "soterai.refreshProtectionCenter"));
                await until(() => statusItems.some(item => item.command === "soterai.openProtectionCenter"), "Actual main status owner did not point to Protection Center.");
                assert.equal(mainStatus().accessibilityInformation?.role, "button");
            });
            await check(async () => {
                const config = vscode.workspace.getConfiguration("soterai"); assert.equal(config.inspect<boolean>(FLAG)?.defaultValue, true);
                await assert.rejects(Promise.resolve(config.update(FLAG, false, vscode.ConfigurationTarget.Workspace)), { name: "CodeExpectedError" });
                assert.equal(config.inspect(FLAG)?.workspaceValue, undefined); await refresh(); assert.equal(contextKeys.get("soterai.protectionCenter"), true);
            });
            await check(async () => {
                assert.equal(vscode.workspace.isTrusted, true); await refresh();
                assert(JSON.stringify(await children(VIEW_IDS[0])).includes("No saved explicit restrictions"));
                assert(JSON.stringify(await children(VIEW_IDS[1])).includes("Owned activity disabled or unavailable")); await noLivePass();
            });
            await check(async () => {
                for (const id of VIEW_IDS) for (const item of await items(id)) {
                    const label = typeof item.label === "string" ? item.label : item.label?.label; assert.equal(typeof label, "string"); assert(label!.length <= 1024);
                    assert.equal(item.collapsibleState, vscode.TreeItemCollapsibleState.None); assert.equal(item.accessibilityInformation?.role, "treeitem");
                    assert.equal(typeof item.accessibilityInformation?.label, "string"); assert(item.iconPath instanceof vscode.ThemeIcon); assert.equal(typeof item.tooltip, "string");
                    valueFree([label, item.description, item.tooltip]); assert(!label!.includes("<button"));
                    if (item.command) { assert.equal(item.command.command, "soterai.protectionCenterAction"); assert.equal(item.command.arguments?.length, 1); assert.equal(typeof item.command.arguments[0], "string"); }
                }
            });
            await check(async () => {
                const commands = new Set(await vscode.commands.getCommands(true));
                for (const command of ["list.focusFirst", "list.focusDown", "list.focusUp"]) assert(commands.has(command), "Installed native list navigation command unavailable.");
                assert.deepEqual(await vscode.commands.executeCommand("soterai.openProtectionCenter"), { status: "OPENED" });
                await until(() => views.get(VIEW_IDS[0])!.view.visible, "Actual native Protected items view never became visible.");
                for (const command of ["list.focusFirst", "list.focusDown", "list.focusUp"]) await vscode.commands.executeCommand(command);
                assert(apiCommands.includes(VIEW_IDS[0] + ".focus"));
                for (const id of VIEW_IDS) await vscode.commands.executeCommand(id + ".focus");
                assert.deepEqual(await invokeItem(VIEW_IDS[0], "privacy"), { status: "OPENED" });
                await rendererObservationGate(runtime);
            });
            await check(async () => {
                const before = ownerCalls.length;
                for (const action of ["workbench.action.terminal.sendSequence", "__proto__", "constructor", { action: "revoke", approved: true, path: PRIVATE }, undefined]) assert.deepEqual(await centerAction(action), { status: "UNAVAILABLE" });
                const actual = ownerCalls.slice(before).filter(call => call.command !== "soterai.protectionCenterAction"); assert.deepEqual(actual, []); valueFree(await allRows());
            });
            await check(async () => {
                await fs.writeFile(ordinary.fsPath, "Public F29 saved restriction fixture.\n", { flag: "wx" }); selectedFile = ordinary;
                const before = ownerCalls.length;
                try { const result = await centerAction("restrict"); assert(["SAVED", "UNAVAILABLE"].includes(result.status), "Persistent-rule events may invalidate the pending presentation generation; no stronger result is allowed."); }
                finally { selectedFile = undefined; }
                const calls = ownerCalls.slice(before); assert(calls.some(call => ["soterai.restrictProjectFile", "soterai.blockFromAI"].includes(call.command) && call.status === "SAVED"));
                assert(calls.some(call => call.command === "soterai.restrictProjectFile" && call.argumentCount === 0), "Presentation must dispatch the existing native file-picker owner with no forwarded path.");
                assert(JSON.stringify(policy(context)).includes("f29-public-restricted.txt"));
            });
            await check(async () => {
                observedFile = ordinary.fsPath; protectedPaths.add(resolve(observedFile).toLowerCase());
                const before = JSON.stringify(readObservations); await refresh();
                assert(JSON.stringify(await children(VIEW_IDS[0])).includes("file: f29-public-restricted.txt"));
                const decoration = await nativeDecoration(ordinary); assert(decoration); assert.equal(decoration.propagate, false); assert(decoration.badge);
                assert.equal(JSON.stringify(readObservations), before, "Presentation opened or read the protected fixture contents.");
            });
            await check(async () => {
                await fs.writeFile(sensitive.fsPath, PRIVATE + "\n", { flag: "wx" });
                assert.deepEqual(await vscode.commands.executeCommand("soterai.restrictSensitiveFile", sensitive), { status: "SAVED" });
                protectedPaths.add(resolve(sensitive.fsPath).toLowerCase()); const before = JSON.stringify(readObservations); await refresh();
                const row = (await children(VIEW_IDS[0])).find(item => item.label.includes("f29-public-sensitive.txt")); assert(row?.description?.includes("Values stay masked"));
                assert(await nativeDecoration(sensitive)); valueFree(await allRows()); assert.equal(JSON.stringify(readObservations), before);
                assert(JSON.stringify(policy(context)).includes("f29-public-restricted.txt"));
            });
            await check(async () => {
                const before = policyDigest(context), calls = ownerCalls.length; folderPick = "cancel";
                assert.deepEqual(await invokeItem(VIEW_IDS[0], "manage"), { status: "CANCELLED" });
                assertOwner("soterai.manageAIRules", calls, "CANCELLED"); assert.equal(policyDigest(context), before);
            });
            await check(async () => {
                const before = ownerCalls.length; picker = "cancel"; assert.deepEqual(await centerAction("workflows"), { status: "CANCELLED" });
                assert.deepEqual(ownerCalls.slice(before).filter(call => call.command !== "soterai.protectionCenterAction"), []);
            });
            await check(async () => {
                const setting = terminalSetting(), receipt = context.workspaceState.get(PROFILE_RECEIPT), changes = settingChanges.length, before = ownerCalls.length;
                terminalApproval = "cancel"; assert.deepEqual(await workflow("ps51"), { status: "CANCELLED" });
                assertOwner("soterai.configureCheckedPowerShell", before, "CANCELLED"); assert.deepEqual(terminalSetting(), setting);
                assert.deepEqual(context.workspaceState.get(PROFILE_RECEIPT), receipt); assert.equal(settingChanges.length, changes);
            });
            await check(async () => {
                const beforeSetting = terminalSetting(); assert.equal(context.workspaceState.get(PROFILE_RECEIPT), undefined);
                let start = ownerCalls.length; const absent = await workflow("restorePs51"); assert.deepEqual(absent, { status: "UNAVAILABLE" }); assertOwner("soterai.restoreCheckedPowerShell", start, "UNAVAILABLE");
                terminalApproval = "apply"; start = ownerCalls.length; const applied = await workflow("ps51");
                assertOwner("soterai.configureCheckedPowerShell", start, "SAVED"); assert(["SAVED", "UNAVAILABLE"].includes(applied.status), "Presentation must not invent a stronger backend result after settings drift.");
                assert.equal(terminalSetting(), PROFILE_NAME); assert.equal(context.workspaceState.get<{ phase: string }>(PROFILE_RECEIPT)?.phase, "APPLIED");
                terminalApproval = "restore"; start = ownerCalls.length; const restored = await workflow("restorePs51");
                assertOwner("soterai.restoreCheckedPowerShell", start, "SAVED"); assert(["SAVED", "UNAVAILABLE"].includes(restored.status));
                assert.deepEqual(terminalSetting(), beforeSetting); assert.equal(context.workspaceState.get(PROFILE_RECEIPT), undefined); terminalApproval = "cancel";
            });
            await check(async () => {
                await updateFlag("lite.selfHygiene", true); await vscode.commands.executeCommand("soterai.enableAISentinel");
                await fs.mkdir(dirname(activityFile.fsPath), { recursive: true });
                let witnessed = false; const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(folder, "f29-native-activity/.env"));
                const created = watcher.onDidCreate(() => { witnessed = true; }), changed = watcher.onDidChange(() => { witnessed = true; });
                try {
                    await fs.writeFile(activityFile.fsPath, "API_KEY=" + PRIVATE + "\nPUBLIC_PORT=8080\n", { flag: "wx" });
                    await until(() => witnessed, "Independent actual native file watcher saw no synthetic event.");
                    await until(() => context.globalState.get<Array<{ type?: string }>>(ACTIVITY, []).some(event => event.type === "protected_access"), "Actual Sentinel owner persisted no native protected-file activity.");
                } finally { created.dispose(); changed.dispose(); watcher.dispose(); }
                await refresh(); const activity = await children(VIEW_IDS[1]); valueFree(activity); assert(activity.some(row => row.label.includes("protected_access:")));
                assert(!JSON.stringify(activity).includes("f29-native-activity")); assert(!JSON.stringify(activity).includes("API_KEY"));
            });
            await check(async () => { await prepareReports(); await evidenceState("MISSING"); });
            await check(async () => { await stageReport("{INVALID_SYNTHETIC_" + PRIVATE); await evidenceState("INVALID"); });
            await check(async () => { await stageReport(report("0".repeat(64))); await evidenceState("MISMATCH"); });
            await check(async () => { await stageReport(report(runtime, "2000-01-01T00:00:00.000Z")); await evidenceState("STALE"); });
            await check(async () => { await stageReport(report()); await evidenceState("MATCHED"); assert.equal(sha(await fs.readFile(bundle)), runtime); });
            await check(async () => {
                installedReadFailure = true; try { await evidenceState("UNAVAILABLE"); }
                finally { installedReadFailure = false; }
                assert.equal(sha(await fs.readFile(bundle)), runtime); await evidenceState("MATCHED"); await restoreReports();
            });
            await check(async () => {
                const before = policyDigest(context); policyReadFailure = true;
                try { await refresh(); const text = JSON.stringify(await children(VIEW_IDS[0])); valueFree(text); assert(text.includes("Saved restrictions unavailable")); }
                finally { policyReadFailure = false; }
                await refresh(); assert.equal(policyDigest(context), before); assert(JSON.stringify(await children(VIEW_IDS[0])).includes("f29-public-restricted.txt"));
            });
            await check(async () => {
                const before = policyDigest(context); workspaceMode = "untrusted";
                try {
                    await refresh(); assert(JSON.stringify(await children(VIEW_IDS[0])).includes("Trust this workspace"));
                    assert(!JSON.stringify(await allRows()).includes("f29-public-restricted.txt")); assert.equal(await nativeDecoration(ordinary), undefined);
                    assert.deepEqual(await centerAction("restrict"), { status: "UNAVAILABLE" }); const calls = ownerCalls.length;
                    assert.deepEqual(await centerAction("revoke"), { status: "REVOKED" }); assertOwner("soterai.revokeProjectReads", calls, "REVOKED");
                } finally { workspaceMode = "normal"; }
                await refresh(); assert.equal(policyDigest(context), before);
            });
            await check(async () => {
                workspaceMode = "empty";
                try { await refresh(); assert(JSON.stringify(await children(VIEW_IDS[0])).includes("Open a local workspace")); assert(!JSON.stringify(await allRows()).includes("f29-public-restricted.txt")); }
                finally { workspaceMode = "normal"; }
                await refresh(); assert.equal(vscode.workspace.workspaceFolders?.[0], folder);
            });
            await check(async () => {
                const before = policyDigest(context), receipt = context.workspaceState.get(PROFILE_RECEIPT); await updateFlag(FLAG, false); await refresh();
                for (const id of VIEW_IDS) { const rows = await children(id); assert.equal(rows.length, 1); assert(rows[0].label.includes("Protection Center disabled")); }
                assert.equal(await nativeDecoration(ordinary), undefined); assert.equal(contextKeys.get("soterai.protectionCenter"), false);
                assert.deepEqual(await vscode.commands.executeCommand("soterai.openProtectionCenter"), { status: "UNAVAILABLE" });
                const calls = ownerCalls.length; assert.deepEqual(await centerAction("revoke"), { status: "UNAVAILABLE" }); assert.equal(ownerCalls.length, calls + 1);
                await until(() => mainStatus().command === "soterai.openControlPanel", "Actual main status owner did not restore the legacy action.");
                assert.equal(policyDigest(context), before); assert.deepEqual(context.workspaceState.get(PROFILE_RECEIPT), receipt);
                await updateFlag(FLAG, true); await refresh(); assert(await nativeDecoration(ordinary));
                await fs.writeFile(custody, JSON.stringify({ policySha256: before, runtimeSha256: runtime, policyWritesAtPrimary: policyWrites,
                    activityCount: context.globalState.get<unknown[]>(ACTIVITY, []).length, terminalReceiptAbsent: receipt === undefined,
                    terminalSetting: terminalSetting() ?? null, flagOn: true, reportRestored: !evidencePrepared, syntheticOnly: true }) + "\n", { flag: "wx" });
            });
        } else {
            const saved = JSON.parse(await fs.readFile(custody, "utf8"));
            await check(async () => { assert.equal(runtime, saved.runtimeSha256); assert.equal(policyDigest(context), saved.policySha256); assert.equal(policyWrites, 0); assert.equal(context.workspaceState.get(PROFILE_RECEIPT), undefined); });
            await check(async () => { assert.deepEqual([...views.keys()], VIEW_IDS); await refresh(); assert(JSON.stringify(await children(VIEW_IDS[0])).includes("f29-public-restricted.txt")); assert(await nativeDecoration(ordinary)); assert(await nativeDecoration(sensitive)); });
            await check(async () => { assert(context.globalState.get<unknown[]>(ACTIVITY, []).length >= saved.activityCount); await refresh(); const activity = await children(VIEW_IDS[1]); valueFree(activity); assert(activity.some(row => row.label.includes("protected_access:"))); await noLivePass(); });
            await check(async () => {
                const before = policyDigest(context), calls = ownerCalls.length; holdRead = true; heldRead = undefined;
                const pending = vscode.commands.executeCommand<{ status: string; text?: string }>("soterai.readProjectFileSafely", activityFile);
                try {
                    await until(() => heldRead !== undefined, "Actual original managed read did not reach native review.");
                    assert.deepEqual(await invokeItem(VIEW_IDS[0], "revoke"), { status: "REVOKED" });
                    const result = await bounded(pending, "Actual original pending managed read did not resolve after revoke."); assert.notEqual(result.status, "ALLOWED_ONCE"); assert.equal(result.text, undefined);
                    releaseHeldRead("Allow safe read once"); assertOwner("soterai.revokeProjectReads", calls, "REVOKED"); assert.equal(policyDigest(context), before);
                } finally { holdRead = false; releaseHeldRead(undefined); await bounded(pending, "Native held read did not drain."); }
            });
            await check(async () => {
                const before = policyDigest(context), receipt = context.workspaceState.get(PROFILE_RECEIPT); await updateFlag(FLAG, false); await refresh();
                assert.equal(contextKeys.get("soterai.protectionCenter"), false); assert.equal(await nativeDecoration(ordinary), undefined);
                for (const id of VIEW_IDS) assert((await children(id)).every(row => row.label.includes("Protection Center disabled")));
                approveSentinelDisable = true; try { await vscode.commands.executeCommand("soterai.disableAISentinel"); } finally { approveSentinelDisable = false; }
                assert.equal(context.globalState.get("soterai.sentinel.enabledState"), false); assert.equal(policyDigest(context), before); assert.deepEqual(context.workspaceState.get(PROFILE_RECEIPT), receipt);
                await until(() => mainStatus().command === "soterai.openControlPanel", "Actual main legacy status action unavailable after final withdrawal."); valueFree(notices);
            });
        }
    } catch (error) { driverFailure = error instanceof Error ? error.name : "UnknownFailure"; }
    finally {
        workspaceMode = "normal"; installedReadFailure = false; policyReadFailure = false; holdRead = false; releaseHeldRead(undefined);
        try { await restoreReports(); assert.equal(sha(await fs.readFile(bundle)), runtime); }
        catch (error) { cleanupFailure = error instanceof Error ? error.name : "UnknownCleanupFailure"; driverFailure ??= "NativeCleanupFailure"; }
        for (const panel of panels) try { panel.dispose(); } catch { /* Native disposal remains observational. */ }
        for (const item of nativeDisposables) item.dispose();
        for (const restore of restores.reverse()) restore();
    }
    await fs.writeFile(output, JSON.stringify({ phase, extensionBundleSha256: runtime, observations: rows,
        passed: rows.filter(row => row.status === "PASS").length, failed: rows.filter(row => row.status === "FAIL").length,
        notRun: rows.filter(row => row.status === "NOT_RUN").length, driverFailure, cleanupFailure,
        diagnostics: setupDiagnostic(), nativeOwnerCalls: ownerCalls, protectedContentReadObservations: readObservations,
        nativeApiDescriptorObservations: apiDescriptorObservations,
        mainStatusOwner: { selected: mainStatusOwner !== undefined, allocationCountIncludesLegacyAuxiliaries: statusItems.length, publicCommand: mainStatusOwner?.command, publicPriority: mainStatusOwner?.priority },
        observedProjectSettingChanges: settingChanges, retainedSyntheticReportInputs: evidenceMutations, readModalCount,
        rendererGate: rendererGate ?? { status: "NOT_RUN_SEPARATE_RENDERER_GATE_UNBOUND" },
        independence: "LOW_SCRIPTED_ACTUAL_INSTALLED_NATIVE_APIS_NOT_HUMAN",
        keyboard: "ACTUAL_VIEW_FOCUS_LIST_NAVIGATION_AND_TREEITEM_COMMAND_APIS; PHYSICAL_KEYS_AND_RENDERER_FOCUS_NOT_OBSERVED",
        workspaceStates: "UNTRUSTED_AND_EMPTY_ARE_EXPLICIT_INJECTED_NATIVE_API_FACTS_NOT_REAL_TRUST_OR_WORKSPACE_TRANSITIONS",
        reports: "SYNTHETIC_INSTALLED_COPY_INPUTS_WITH_ZERO_PASSING_SUITES; NOT_SHIPPED_OR_ACCEPTED_COVERAGE_EVIDENCE",
        exclusions: ["Human screen reader/usability", "Different-vendor independence", "Real agent behavior", "Physical keyboard/renderer automation", "Real workspace trust UI transition", "OS isolation and unmanaged native reads", "Actual vendor setup beyond the isolated project-terminal owner", "F26a/native06 remains explicitly deferred"],
    }, null, 2) + "\n", { flag: "wx" });
}
