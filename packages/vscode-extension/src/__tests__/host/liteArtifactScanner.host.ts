/** F24 exact packaged commands against retained synthetic artifacts only.
 * Native UI decisions are scripted (LOW independence). No Git, build, import,
 * source document, remote reference, cleanup or process signal is exercised. */
import * as vscode from "vscode";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";

const KEY = "soterai.hygiene.hmacKey.v1", STATE = "soterai.lite.hygiene.exposure.v1", FLAG = "lite.artifactScanner";
const ACTION = "Analyze local artifacts", CALLER = "TEST_ONLY_F24_CALLER_NOT_AUTHORITY_308c47e1";
const MAP_VALUE = "TEST_ONLY_F24_MAP_PRIVATE_1dc684ea", SOURCE_VALUE = "TEST_ONLY_F24_SOURCE_PRIVATE_d3247b19";
const COPY_VALUE = "TEST_ONLY_F24_COPY_PRIVATE_52b937a0", RENAMED_VALUE = "TEST_ONLY_F24_RENAMED_PRIVATE_c17e084b";
const OUTSIDE_VALUE = "TEST_ONLY_F24_OUTSIDE_NEVER_READ_b18df640";
const MAP = "dist/assets/decoded-output.js.map", JS = "dist/reviewable.js", PUBLIC = "dist/assets/public.js";
const RENAMED = "build/renamed-output.snapshot", COPY = "coverage/generated-copy.txt", WITH_URL = "dist/assets/with-map.js";
const UNSUPPORTED = "coverage/indexed-output.map", REFERENCE = "f24-reference-private.ts";
const PUBLIC_TEXT = "export const PORT = 3000;\n";
const JS_TEXT = 'const apiKey = "' + SOURCE_VALUE + '"; export const PORT = 3000;\n';
const unicode = (value: string) => [...value].map(character => "\\u" + character.charCodeAt(0).toString(16).padStart(4, "0")).join("");
const MAP_TEXT = JSON.stringify({ version: 3, file: "../" + REFERENCE, sourceRoot: "https://artifact-source.invalid/",
    sources: ["../../" + REFERENCE], sourcesContent: ['const apiKey = "' + unicode(MAP_VALUE) + '";\n'], names: [], mappings: "" }) + "\n";
const INPUTS = new Map<string, string>([
    [MAP, MAP_TEXT], [JS, JS_TEXT], [PUBLIC, PUBLIC_TEXT],
    [RENAMED, 'const apiKey = "' + RENAMED_VALUE + '";\n'], [COPY, "PASSWORD=" + COPY_VALUE + "\n"],
    [WITH_URL, "export const MODE = 'public';\n//# sourceMappingURL=decoded-output.js.map\n"],
    [".next/static/runtime.mjs", "export const MODE = 'public';\n"], [".cache/public.txt", "PORT=3000\n"], ["caches/public.txt", "MODE=public\n"],
]);
const nativeRead = fsp.readFile, nativeOpen = fsp.open, nativeReadSync = fs.readFileSync, nativeOpenSync = fs.openSync;
const restores: Array<() => void> = [], listeners: vscode.Disposable[] = [], opened: vscode.TextDocument[] = [], displayed: vscode.TextDocument[] = [];
const metadata: string[] = [], reviews: Array<{ action: string; safe: boolean }> = [];
const started = performance.now(), trace: Array<{ event: string; milliseconds: number; status?: string; files?: number; findings?: number }> = [];
let root = "", outside = "", publicParent = "", sourceCalls = 0, sourceEvents = 0, contentReads = 0, referenceReads = 0;
let observedFileCalls = 0, caseVariantContentMatches = 0;
let stores = 0, vaultStores = 0, keyEvents = 0, approve = true, holdPrompt = false, promptEntered = false;
let finishPrompt: ((choice: string | undefined) => void) | undefined;
let holdDocument = false, documentEntered = false, finishDocument: (() => void) | undefined;
let holdPublication = false, publicationEntered = false, finishPublication: ((choice: string | undefined) => void) | undefined;
let selected: string[] = [], lastReview: any, setupStage = "initial";

const sha = (value: Uint8Array | string) => createHash("sha256").update(value).digest("hex");
const note = (event: string) => trace.push({ event, milliseconds: performance.now() - started });
const within = (base: string, file: string) => { const part = relative(resolve(base), resolve(file)); return part === "" || !part.startsWith("..") && !isAbsolute(part); };
function valueFree(value: unknown): void {
    const text = typeof value === "string" ? value : JSON.stringify(value) ?? "";
    for (const privateValue of [MAP_VALUE, SOURCE_VALUE, COPY_VALUE, RENAMED_VALUE, OUTSIDE_VALUE, CALLER]) assert(!text.includes(privateValue), "Private artifact entered a result or UI.");
}
function metadataOnly(value: unknown): void {
    valueFree(value); const text = typeof value === "string" ? value : JSON.stringify(value) ?? "";
    for (const name of [MAP, JS, PUBLIC, RENAMED, COPY, WITH_URL, UNSUPPORTED, REFERENCE]) assert(!text.includes(name), "Artifact filename entered keyed metadata.");
    if (root) assert(!text.includes(root), "Original root entered keyed metadata.");
}
function patch(object: object, name: string, value: unknown): void {
    const prior = Object.getOwnPropertyDescriptor(object, name);
    Object.defineProperty(object, name, { configurable: true, writable: true, value });
    restores.push(() => prior ? Object.defineProperty(object, name, prior) : Reflect.deleteProperty(object, name));
}
async function until(predicate: () => boolean): Promise<void> {
    const end = Date.now() + 5000;
    while (!predicate() && Date.now() < end) await new Promise<void>(done => setTimeout(done, 10));
    assert(predicate(), "Expected synthetic native UI stage was not reached.");
}
function filePath(value: unknown): string | undefined {
    return typeof value === "string" ? value : value instanceof URL && value.protocol === "file:" ? vscode.Uri.parse(value.href).fsPath
        : value instanceof vscode.Uri && value.scheme === "file" ? value.fsPath : undefined;
}
function sourceDocument(value: unknown): boolean {
    const file = filePath(value); return !!file && (within(root, file) || observedFileKey(file) === observedFileKey(outside));
}
function observedFileKey(file: string): string {
    const absolute = resolve(file); return process.platform === "win32" ? absolute.toLowerCase() : absolute;
}
function readObserved(value: unknown): void {
    const file = filePath(value); if (!file) return;
    observedFileCalls++;
    const key = observedFileKey(file), suffix = process.platform === "win32" ? REFERENCE.toLowerCase() : REFERENCE;
    if (key === observedFileKey(outside) || key.endsWith(suffix)) referenceReads++;
    if ([...INPUTS.keys(), UNSUPPORTED].some(name => key === observedFileKey(join(root, name)))) {
        contentReads++;
        if (![...INPUTS.keys(), UNSUPPORTED].some(name => resolve(file) === resolve(join(root, name)))) caseVariantContentMatches++;
    }
}
async function originals(): Promise<Array<{ bytes: number; sha256: string }>> {
    const result: Array<{ bytes: number; sha256: string }> = [];
    for (const name of INPUTS.keys()) { const bytes = await nativeRead(join(root, name)); result.push({ bytes: bytes.length, sha256: sha(bytes) }); }
    const bytes = await nativeRead(outside); result.push({ bytes: bytes.length, sha256: sha(bytes) }); return result;
}
async function outputNames(): Promise<string[]> { return (await fsp.readdir(publicParent)).sort(); }

export function setupDiagnostic() {
    return { syntheticOnly: true, stage: setupStage, sourceCalls, sourceEvents, contentReads, referenceReads, stores, vaultStores, keyEvents };
}
export async function beforeActivate(context: vscode.ExtensionContext): Promise<void> {
    assert.equal(vscode.workspace.workspaceFolders?.length, 1); root = vscode.workspace.workspaceFolders![0].uri.fsPath;
    assert.match(resolve(process.env.USERPROFILE ?? ""), /^D:\\SoterAI-Lite-test-profiles\\/i);
    assert.match(resolve(root), /^D:\\SoterAI-Lite-test-profiles\\/i); assert(!within(root, context.globalStorageUri.fsPath));
    assert.equal(process.platform, "win32"); const phase = process.env.SOTERAI_LITE_F17_PHASE; assert(phase === "primary" || phase === "restart");
    outside = join(dirname(root), REFERENCE); publicParent = join(dirname(root), "artifact-public-outputs");
    assert(within(dirname(root), outside) && !within(root, outside)); assert(!within(root, publicParent));
    setupStage = "retained-synthetic-artifact-preparation";
    if (phase === "primary") {
        for (const [name, text] of INPUTS) { await fsp.mkdir(dirname(join(root, name)), { recursive: true }); await fsp.writeFile(join(root, name), text, { flag: "wx" }); }
        await fsp.writeFile(outside, 'const apiKey = "' + OUTSIDE_VALUE + '";\n', { flag: "wx" });
        await fsp.mkdir(publicParent);
    }
    patch(fsp, "readFile", (...args: unknown[]) => { readObserved(args[0]); return Reflect.apply(nativeRead, fsp, args); });
    patch(fs, "readFileSync", (...args: unknown[]) => { readObserved(args[0]); return Reflect.apply(nativeReadSync, fs, args); });
    patch(fsp, "open", (...args: unknown[]) => { readObserved(args[0]); return Reflect.apply(nativeOpen, fsp, args); });
    patch(fs, "openSync", (...args: unknown[]) => { readObserved(args[0]); return Reflect.apply(nativeOpenSync, fs, args); });
    const store = context.secrets.store;
    patch(context.secrets, "store", async (key: string, value: string) => {
        if (key === KEY) { stores++; assert.equal(Buffer.from(value, "base64").length, 32); }
        if (key === "soterai.vaultKey") vaultStores++; return store.call(context.secrets, key, value);
    });
    listeners.push(vscode.workspace.onDidChangeConfiguration(event => { if (event.affectsConfiguration("soterai")) note("soterai-configuration-event"); }),
        context.secrets.onDidChange(event => { if (event.key === KEY) { keyEvents++; note("artifact-key-event"); } }));
    const open = vscode.workspace.openTextDocument;
    patch(vscode.workspace, "openTextDocument", async (...args: unknown[]) => {
        if (sourceDocument(args[0])) sourceCalls++;
        const input = args[0] as { content?: string; language?: string };
        if (typeof input?.content === "string") { valueFree(input.content); if (input.language === "json") { metadataOnly(input.content); metadata.push(input.content); } }
        const document = await Reflect.apply(open, vscode.workspace, args) as vscode.TextDocument;
        if (typeof input?.content === "string") opened.push(document);
        if (holdDocument && input?.language === "json") { documentEntered = true; await new Promise<void>(done => finishDocument = done); }
        return document;
    });
    listeners.push(vscode.workspace.onDidOpenTextDocument(document => { if (sourceDocument(document.uri)) sourceEvents++; }));
    const show = vscode.window.showTextDocument;
    patch(vscode.window, "showTextDocument", async (...args: unknown[]) => {
        const document = args[0] as vscode.TextDocument; valueFree(document.getText()); displayed.push(document); return Reflect.apply(show, vscode.window, args);
    });
    patch(vscode.window, "showOpenDialog", async (options: vscode.OpenDialogOptions) => options.canSelectFolders
        ? [vscode.Uri.file(publicParent)] : selected.map(name => vscode.Uri.file(join(root, name))));
    patch(vscode.window, "showQuickPick", async (items: readonly unknown[]) => items[0]);
    patch(vscode.window, "showWarningMessage", async (message: string, options: vscode.MessageOptions, ...items: string[]) => {
        valueFree([message, options, items]); const action = items.find(item => [ACTION, "Create metadata export", "Publish reviewed snapshot"].includes(item));
        if (!action) return undefined; assert.equal(options.modal, true); reviews.push({ action, safe: true });
        if (action === ACTION) { metadataOnly([message, options, items]); if (holdPrompt) { promptEntered = true; return new Promise<string | undefined>(done => finishPrompt = done); } }
        if (action === "Publish reviewed snapshot" && holdPublication) { publicationEntered = true; return new Promise<string | undefined>(done => finishPublication = done); }
        return approve ? action : undefined;
    });
    for (const name of ["showInformationMessage", "showErrorMessage"]) patch(vscode.window, name, async (message: unknown) => { valueFree(message); return undefined; });
    setupStage = "instrumented-before-production-activation";
}

export async function run(context: vscode.ExtensionContext): Promise<void> {
    const phase = process.env.SOTERAI_LITE_F17_PHASE!, output = process.env.SOTERAI_LITE_F17_EVIDENCE!;
    const config = vscode.workspace.getConfiguration("soterai"), oldFlag = config.inspect<boolean>(FLAG)?.globalValue;
    const oldPublication = config.inspect<boolean>("projectPrivacy.safePublication")?.globalValue;
    const runtime = sha(await nativeRead(join(context.extensionUri.fsPath, "dist/extension.js"))); assert.equal(runtime, process.env.SOTERAI_LITE_F17_BUNDLE_SHA256);
    const receipt = join(dirname(root), "artifact-restart.json"), observations: Array<{ id: string; scope: string; status: string; errorName?: string }> = [];
    const check = async (scope: string, work: () => Promise<void>) => {
        const row = { id: "F24-N" + String(observations.length + 1).padStart(2, "0"), scope, status: "NOT_RUN", errorName: undefined as string | undefined }; observations.push(row);
        try { await work(); row.status = "PASS"; } catch (error) { row.status = "FAIL"; row.errorName = error instanceof Error ? error.name : "UnknownFailure"; }
    };
    const call = async (name: string, ...args: unknown[]): Promise<any> => {
        note("command-start-" + name); const result: any = await vscode.commands.executeCommand("soterai." + name, ...args);
        if (["reviewArtifacts", "artifactScannerStatus", "openHygieneExposureLedger"].includes(name)) metadataOnly(result); else valueFree(result);
        trace.push({ event: "command-end-" + name, milliseconds: performance.now() - started,
            status: typeof result?.status === "string" && /^[A-Z_]{1,80}$/.test(result.status) ? result.status : "METADATA",
            files: Number.isSafeInteger(result?.files) ? result.files : undefined, findings: Array.isArray(result?.findings) ? result.findings.length : undefined }); return result;
    };
    const clean = () => { assert.equal(sourceCalls, 0); assert.equal(sourceEvents, 0); assert.equal(referenceReads, 0); assert.equal(vaultStores, 0);
        assert(!vscode.workspace.textDocuments.some(document => sourceDocument(document.uri))); metadataOnly(context.globalState.get(STATE)); metadataOnly(metadata); };
    const scan = async (...args: unknown[]) => { const before = await originals(), result = await call("reviewArtifacts", ...args); assert.deepEqual(await originals(), before); clean(); return result; };
    const fourFindings = (result: any) => { assert(["ANALYZED", "PARTIAL"].includes(result.status)); assert.equal(result.findings.length, 4);
        for (const finding of result.findings) for (const field of ["id", "fileRef", "valueRef"]) assert.match(finding[field], /^[a-f0-9]{64}$/); };
    const publish = async (...names: string[]) => { selected = names; const before = await originals(), result = await call("preparePublicWorkspace", { approved: true, root: CALLER }); assert.deepEqual(await originals(), before); clean(); return result; };
    const verifiedPublication = async (result: any) => {
        assert.equal(result.status, "PREPARED"); assert(typeof result.destination === "string" && within(publicParent, result.destination));
        const manifest = JSON.parse(await nativeRead(join(result.destination, "soterai-publication-manifest.json"), "utf8"));
        assert.equal(manifest.isolation, "NO ISOLATION"); valueFree(manifest);
        const { manifestSha256, ...body } = manifest; assert.equal(manifestSha256, sha(JSON.stringify(body))); assert.equal(result.manifestSha256, manifestSha256);
        for (const entry of manifest.entries) { const bytes = await nativeRead(join(result.destination, entry.path)); valueFree(bytes.toString("utf8")); assert.equal(sha(bytes), entry.sha256); assert.equal(bytes.length, entry.bytes); }
        assert.equal(await nativeRead(join(result.destination, PUBLIC), "utf8"), PUBLIC_TEXT);
        const redacted = await nativeRead(join(result.destination, JS), "utf8"); valueFree(redacted); assert.match(redacted, /SOTERAI_PROTECTED_|MASKED/); assert.match(redacted, /PORT = 3000/);
        assert(!manifest.entries.some((entry: { path: string }) => entry.path.endsWith(".map") || entry.path === WITH_URL));
    };
    let driverFailure: string | undefined;
    try {
        if (phase === "primary") {
            await check("Exact runtime and two native artifact commands have no startup content, key or original document", async () => {
                assert.equal(contentReads, 0); assert.equal(stores, 0); assert.equal(await context.secrets.get(KEY), undefined); assert.equal(metadata.length, 0);
                const status = await call("artifactScannerStatus", { approved: true, root: CALLER }); assert.equal(status.status, "OWNER_REVIEW_REQUIRED"); assert.equal(status.busy, false);
                const commands = await vscode.commands.getCommands(true); for (const name of ["reviewArtifacts", "artifactScannerStatus"]) assert(commands.includes("soterai." + name)); clean();
            });
            await check("Owner cancellation ignores caller authority before content or analyzer key", async () => {
                approve = false; const value = await scan({ root: CALLER, approved: true, content: CALLER }); approve = true;
                assert.equal(value.status, "CANCELLED"); assert.equal(contentReads, 0); assert.equal(stores, 0); assert.equal(metadata.length, 0);
            });
            await check("One pending native owner modal stays busy and refuses a second review without reading", async () => {
                holdPrompt = true; promptEntered = false; const pending = call("reviewArtifacts"); await until(() => promptEntered);
                assert.equal((await call("artifactScannerStatus")).busy, true); assert.equal((await call("reviewArtifacts", { approved: true })).status, "UNAVAILABLE");
                assert.equal(contentReads, 0); assert.equal(stores, 0); finishPrompt?.(undefined); assert.equal((await pending).status, "CANCELLED"); holdPrompt = false;
                assert.equal((await call("artifactScannerStatus")).busy, false); clean();
            });
            await check("Saved maps decode escaped embedded source, JS and renamed copies while public generated assets remain useful", async () => {
                assert(!MAP_TEXT.includes(MAP_VALUE)); lastReview = await scan(); assert.equal(lastReview.status, "ANALYZED"); fourFindings(lastReview); assert(lastReview.files >= 4);
                assert.equal(Buffer.from((await context.secrets.get(KEY))!, "base64").length, 32); assert(contentReads > 0); clean();
            });
            await check("Artifact report and canonical exposure ledger contain only keyed metadata, no values or filenames", async () => {
                assert(metadata.length >= 1); assert.deepEqual(JSON.parse(metadata.at(-1)!), lastReview); assert(displayed.length >= 1);
                const view = await call("openHygieneExposureLedger"); assert.equal(view.rows.length, 4);
                for (const row of view.rows) { assert.equal(row.lastAction, "possible-project-exposure"); for (const field of ["id", "rootRef", "fileRef", "valueRef"]) assert.match(row[field], /^[a-f0-9]{64}$/); } clean();
            });
            await check("Caller path, ref, content and approvals cannot redirect a fresh artifact review", async () => {
                const result = await scan(vscode.Uri.file("C:\\foreign-f24-artifact"), { root: CALLER, path: CALLER, content: CALLER, approved: true }); fourFindings(result);
                assert.deepEqual(result.findings.map((finding: { id: string }) => finding.id).sort(), lastReview.findings.map((finding: { id: string }) => finding.id).sort());
            });
            await check("Repeated artifact review preserves keyed ledger identity and increments observations", async () => {
                const before = await call("openHygieneExposureLedger"); fourFindings(await scan()); const after = await call("openHygieneExposureLedger"); assert.equal(after.rows.length, 4);
                for (const row of before.rows) assert(after.rows.find((next: { id: string; observations: number }) => next.id === row.id).observations > row.observations); clean();
            });
            await check("Indexed source map remains visibly partial without following references or discarding supported findings", async () => {
                await fsp.writeFile(join(root, UNSUPPORTED), JSON.stringify({ version: 3, sections: [{ offset: { line: 0, column: 0 }, url: "https://artifact-source.invalid/ignored.map" }] }) + "\n", { flag: "wx" });
                const result = await scan(); assert.equal(result.status, "PARTIAL"); fourFindings(result); assert(result.skipped >= 1); clean();
            });
            await check("Native ledger export cancellation writes nothing; approved export contains only keyed artifact rows", async () => {
                approve = false; assert.equal((await call("exportHygieneExposureLedger")).status, "CANCELLED"); approve = true;
                const directory = join(context.globalStorageUri.fsPath, "hygiene-exports"); assert.equal((await fsp.readdir(directory).catch(() => [])).length, 0);
                assert.equal((await call("exportHygieneExposureLedger")).status, "EXPORTED"); const names = await fsp.readdir(directory); assert.equal(names.length, 1);
                const exported = await nativeRead(join(directory, names[0]), "utf8"); metadataOnly(exported); assert.equal(JSON.parse(exported).rows.length, 4); clean();
            });
            await check("A key change and restoration during pending report creation cannot revive stale display or command output", async () => {
                const key = await context.secrets.get(KEY); assert(key); holdDocument = true; documentEntered = false; const beforeShown = displayed.length;
                const pending = call("reviewArtifacts"); await until(() => documentEntered); const events = keyEvents;
                await context.secrets.store(KEY, Buffer.alloc(32, 64).toString("base64")); await until(() => keyEvents > events);
                await context.secrets.store(KEY, key); finishDocument?.(); assert.equal((await pending).status, "UNAVAILABLE"); holdDocument = false; assert.equal(displayed.length, beforeShown); clean();
            });
            await check("Disable and reenable during the native owner modal irreversibly withdraws pending review", async () => {
                holdPrompt = true; promptEntered = false; const beforeReads = contentReads, beforeStores = stores, pending = call("reviewArtifacts"); await until(() => promptEntered);
                await config.update(FLAG, false, vscode.ConfigurationTarget.Global); await config.update(FLAG, true, vscode.ConfigurationTarget.Global);
                finishPrompt?.(ACTION); assert.equal((await pending).status, "UNAVAILABLE"); holdPrompt = false; assert.equal(contentReads, beforeReads); assert.equal(stores, beforeStores); clean();
            });
            await check("Owner disable blocks review and native machine scope rejects a repository override", async () => {
                await config.update(FLAG, false, vscode.ConfigurationTarget.Global); const beforeReads = contentReads, beforeStores = stores, prior = JSON.stringify(context.globalState.get(STATE));
                assert.equal((await call("reviewArtifacts", { approved: true, enabled: true })).status, "UNAVAILABLE"); assert.equal((await call("artifactScannerStatus")).status, "UNAVAILABLE");
                await assert.rejects(async () => config.update(FLAG, true, vscode.ConfigurationTarget.Workspace), { name: "CodeExpectedError" });
                assert.equal((await call("artifactScannerStatus")).status, "UNAVAILABLE"); assert.equal(contentReads, beforeReads); assert.equal(stores, beforeStores); assert.equal(JSON.stringify(context.globalState.get(STATE)), prior);
                await config.update(FLAG, true, vscode.ConfigurationTarget.Global); clean();
            });
            await check("Withdrawal while a native metadata document awaits prevents stale display and return", async () => {
                holdDocument = true; documentEntered = false; const beforeShown = displayed.length, pending = call("reviewArtifacts"); await until(() => documentEntered);
                await config.update(FLAG, false, vscode.ConfigurationTarget.Global); await config.update(FLAG, true, vscode.ConfigurationTarget.Global);
                finishDocument?.(); assert.equal((await pending).status, "UNAVAILABLE"); holdDocument = false; assert.equal(displayed.length, beforeShown); clean();
            });
            await check("Actual reviewed public snapshot preserves public JS and releases only redacted generated JS with matching manifest hashes", async () => {
                await config.update("projectPrivacy.safePublication", true, vscode.ConfigurationTarget.Global); await verifiedPublication(await publish(PUBLIC, JS)); clean();
            });
            await check("Source-map release is withheld before any public output folder is created", async () => {
                const before = await outputNames(); assert.notEqual((await publish(MAP)).status, "PREPARED"); assert.deepEqual(await outputNames(), before); clean();
            });
            await check("SourceMappingURL-bearing generated JS remains withheld from publication", async () => {
                const before = await outputNames(); assert.notEqual((await publish(WITH_URL)).status, "PREPARED"); assert.deepEqual(await outputNames(), before); clean();
            });
            await check("The artifact machine flag withdraws publication at admission without a new public output", async () => {
                await config.update(FLAG, false, vscode.ConfigurationTarget.Global); const before = await outputNames(); assert.notEqual((await publish(PUBLIC, JS)).status, "PREPARED");
                assert.deepEqual(await outputNames(), before); await config.update(FLAG, true, vscode.ConfigurationTarget.Global); clean();
            });
            await check("Artifact disable and reenable during actual publication approval revokes the one-shot public plan", async () => {
                holdPublication = true; publicationEntered = false; selected = [PUBLIC, JS]; const before = await outputNames(), sourceBefore = await originals();
                const pending = call("preparePublicWorkspace"); await until(() => publicationEntered);
                await config.update(FLAG, false, vscode.ConfigurationTarget.Global); await config.update(FLAG, true, vscode.ConfigurationTarget.Global);
                finishPublication?.("Publish reviewed snapshot"); assert.notEqual((await pending).status, "PREPARED"); holdPublication = false;
                assert.deepEqual(await outputNames(), before); assert.deepEqual(await originals(), sourceBefore); clean();
            });
            await check("Cancelling actual publication leaves every output and saved original unchanged", async () => {
                const before = await outputNames(); approve = false; assert.equal((await publish(PUBLIC, JS)).status, "CANCELLED"); approve = true; assert.deepEqual(await outputNames(), before); clean();
            });
            await check("Artifact findings confer no current-file vault authority or automatic original cleanup", async () => {
                const before = await originals(); assert.equal((await call("reviewHygieneVault", lastReview.findings[0], { approved: true })).status, "REVIEW_FILES_FIRST");
                assert.deepEqual(await originals(), before); assert.equal(await context.secrets.get("soterai.vaultKey"), undefined); clean();
            });
            await check("An outside hardlink is withheld and retained, and exact original hashes plus keyed rows form the restart basis", async () => {
                const alias = join(root, "dist/assets/linked-output.txt"), retained = join(root, "node_modules/f24-retained-linked-output.txt");
                await fsp.link(outside, alias);
                try { const beforeReads = referenceReads; assert.equal((await call("reviewArtifacts")).status, "UNAVAILABLE"); assert.equal(referenceReads, beforeReads); }
                finally { await fsp.mkdir(dirname(retained), { recursive: true }); await fsp.rename(alias, retained); }
                assert.equal((await fsp.lstat(outside)).nlink, 2); assert.equal((await fsp.lstat(retained)).nlink, 2); clean();
                const fresh = await scan(); fourFindings(fresh); assert.equal(fresh.status, "PARTIAL");
                const ledger = await call("openHygieneExposureLedger"); assert.equal(ledger.rows.length, 4);
                await fsp.writeFile(receipt, JSON.stringify({ ledger: context.globalState.get(STATE), originals: await originals(), findingIds: fresh.findings.map((finding: { id: string }) => finding.id).sort(), ledgerIds: ledger.rows.map((row: { id: string }) => row.id).sort() }) + "\n", { flag: "wx" });
            });
        } else {
            const prior = JSON.parse(await nativeRead(receipt, "utf8"));
            await check("Restart reuses persisted key and keyed ledger without startup content, documents or new key stores", async () => {
                assert.equal(stores, 0); assert.equal(contentReads, 0); assert.equal(metadata.length, 0); assert.equal((await call("artifactScannerStatus")).status, "OWNER_REVIEW_REQUIRED");
                assert.deepEqual(context.globalState.get(STATE), prior.ledger); assert.deepEqual(await originals(), prior.originals); clean();
            });
            await check("Restart cancellation still requires native owner consent before artifact content or fresh authority", async () => {
                approve = false; assert.equal((await scan({ approved: true, findingIds: prior.findingIds })).status, "CANCELLED"); approve = true;
                assert.equal(contentReads, 0); assert.equal(stores, 0); assert.equal(metadata.length, 0); assert.deepEqual(context.globalState.get(STATE), prior.ledger); clean();
            });
            await check("Fresh restart review reestablishes stable keyed artifact findings and preserves unsupported-map partial scope", async () => {
                const result = await scan(); fourFindings(result); assert.equal(result.status, "PARTIAL");
                assert.deepEqual(result.findings.map((finding: { id: string }) => finding.id).sort(), prior.findingIds);
                const ledger = await call("openHygieneExposureLedger"); assert.deepEqual(ledger.rows.map((row: { id: string }) => row.id).sort(), prior.ledgerIds); assert.equal(stores, 0); clean();
            });
            await check("Restart publication requires a fresh owner decision and still produces verified canary-free output", async () => {
                await config.update("projectPrivacy.safePublication", true, vscode.ConfigurationTarget.Global); const before = await outputNames();
                approve = false; assert.equal((await publish(PUBLIC, JS)).status, "CANCELLED"); approve = true; assert.deepEqual(await outputNames(), before);
                await verifiedPublication(await publish(PUBLIC, JS)); assert.equal(stores, 0); assert.deepEqual(await originals(), prior.originals); clean();
            });
        }
    } catch { driverFailure = "NativeArtifactDriverFailure"; }
    finally {
        try {
            finishPrompt?.(undefined); finishDocument?.(); finishPublication?.(undefined); holdPrompt = false; holdDocument = false; holdPublication = false;
            await config.update(FLAG, oldFlag, vscode.ConfigurationTarget.Global); await config.update("projectPrivacy.safePublication", oldPublication, vscode.ConfigurationTarget.Global); clean();
            for (const document of new Set([...opened, ...displayed])) if (!document.isClosed && document.isUntitled) {
                await vscode.window.showTextDocument(document); await vscode.commands.executeCommand("workbench.action.revertAndCloseActiveEditor");
            }
        } catch { driverFailure = "NativeArtifactWithdrawalUnconfirmed"; }
        listeners.forEach(listener => listener.dispose()); for (const restore of restores.reverse()) restore();
    }
    const result = { schemaVersion: 1, phase, syntheticOnly: true, hostVersion: vscode.version, extensionBundleSha256: runtime,
        currentDeveloperBundleSha256: sha(await nativeRead(join(context.extensionUri.fsPath, "dist/extension.js"))), hostProbeSha256: sha(await nativeRead(__filename)),
        observations, passed: observations.filter(row => row.status === "PASS").length, failed: observations.filter(row => row.status === "FAIL").length,
        notRun: observations.filter(row => row.status === "NOT_RUN").length, expectedChecks: phase === "primary" ? 21 : 4,
        sourceDocumentCalls: sourceCalls, sourceDocumentEvents: sourceEvents, artifactContentReads: contentReads, referencedContentReads: referenceReads,
        observedFileCalls, caseVariantContentMatches,
        secretStorageStores: stores, vaultKeyStores: vaultStores, reviews, metadataDocuments: metadata.length, trace, driverFailure,
        independence: "LOW", ownerPresence: "SCRIPTED_NATIVE_API_DECISIONS_NOT_HUMAN_REVIEW",
        notTested: ["Human usability/accessibility", "Map validity, original-path sanitization or releasing source maps", "Other platforms, transformed/prose/binary/unknown credentials",
            "Credential validity, provider rotation, actual AI access or prior copies", "Same-user unmanaged reads and independent uploads"] };
    metadataOnly(result); await fsp.writeFile(output, JSON.stringify(result, null, 2) + "\n", { flag: "wx" });
    if (result.failed || driverFailure || result.observations.length !== result.expectedChecks) throw Error("Native artifact scanner incomplete");
}
