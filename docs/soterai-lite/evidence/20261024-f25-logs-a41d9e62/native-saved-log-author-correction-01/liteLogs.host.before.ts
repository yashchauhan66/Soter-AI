/** F25 exact packaged saved-log commands; synthetic retained files only.
 * Native owner decisions are scripted (LOW independence). Boundary groups use
 * actual native discovery restricted to their own synthetic directory. */
import * as vscode from "vscode";
import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";

const KEY = "soterai.hygiene.hmacKey.v1", STATE = "soterai.lite.hygiene.exposure.v1", FLAG = "lite.logProtection";
const ACTION = "Analyze saved logs", CALLER = "TEST_ONLY_F25_CALLER_NOT_AUTHORITY_b840d219";
const PLAIN_VALUE = "TEST_ONLY_F25_SAVED_LOG_PRIVATE_4832b1c7", TAP_VALUE = "TEST_ONLY_F25_TAP_PRIVATE_159dfcb0";
const PROPERTY_VALUE = "violet meadow tea TEST_ONLY_F25_PROPERTY_47c96a31", DECODED_VALUE = "TEST_ONLY_F25_DECODED_PRIVATE_689ad342";
const OUTSIDE_VALUE = "TEST_ONLY_F25_OUTSIDE_NEVER_READ_4a5f2793", REFERENCE = "f25-reference-private.ts";
const SAVED = "logs/saved.log", TAP = "coverage/failure.tap", STRUCTURED = "test-results/nested.json";
const JSONL = "test-results/decoded.jsonl", PUBLIC = "logs/public.tap", TEMPLATES = "logs/templates.json";
const PUBLIC_TEXT = "TAP version 13\nnot ok 1 - public arithmetic\n  ---\n  expected: 3000\n  actual: 4000\n  at: public-test.cjs:8:2\n  ...\n1..1\n";
const unicode = (text: string) => [...text].map(character => "\\u" + character.charCodeAt(0).toString(16).padStart(4, "0")).join("");
const INPUTS = new Map<string, string>([
    [SAVED, "Expected synthetic setup failure\nAPI_KEY=" + PLAIN_VALUE + "\n    at public-test.cjs:7:3\n"],
    [TAP, "TAP version 13\nnot ok 1 - synthetic failure\nTOKEN=" + TAP_VALUE + "\n1..1\n"],
    [STRUCTURED, '{"failure":{"pass\\u0077ord":' + JSON.stringify(PROPERTY_VALUE) + ',"actual":3000,"expected":4000},"file":"../' + REFERENCE + '","url":"https://saved-log-reference.invalid/never"}\n'],
    [JSONL, '{"failure":{"message":"' + unicode("API_KEY=" + DECODED_VALUE) + '"},"file":"../' + REFERENCE + '"}\n{"message":"public assertion failed","stack":"public-test.cjs:8:2"}\n'],
    [PUBLIC, PUBLIC_TEXT],
    [TEMPLATES, JSON.stringify({ password: "${OWNER_PASSWORD}", token: "<owner-token>", stripePublishableKey: "pk_test_syntheticPublic123", message: "public assertion failed" }) + "\n"],
]);
const PRIVATE_VALUES = [PLAIN_VALUE, TAP_VALUE, PROPERTY_VALUE, DECODED_VALUE, OUTSIDE_VALUE, CALLER];
const LIMITS = { files: 128, fileBytes: 65536, totalBytes: 1048576, milliseconds: 60000, parts: 32, depth: 32, valueContainerNodes: 10000, records: 128 };
const nativeRead = fsp.readFile, nativeOpen = fsp.open, nativeReadSync = fs.readFileSync, nativeOpenSync = fs.openSync;
const restores: Array<() => void> = [], listeners: vscode.Disposable[] = [], opened: vscode.TextDocument[] = [], displayed: vscode.TextDocument[] = [];
const metadata: string[] = [], reviews: Array<{ action: string; modal: boolean }> = [];
const started = performance.now(), trace: Array<{ event: string; milliseconds: number; status?: string; files?: number; findings?: number }> = [];
const discoveries: Array<{ maximum: number | undefined; isolatedSyntheticDirectory: boolean }> = [];
const registeredFiles = new Map<string, string>(), readEvents: string[] = [];
let root = "", outside = "", setupStage = "initial", caseNumber = 0, activeCase: string | undefined;
let sourceCalls = 0, sourceEvents = 0, contentReads = 0, referenceReads = 0, observedFileCalls = 0, caseVariantContentMatches = 0;
let stores = 0, vaultStores = 0, keyEvents = 0, approve = true, holdPrompt = false, promptEntered = false;
let finishPrompt: ((choice: string | undefined) => void) | undefined;
let holdDocument = false, documentEntered = false, finishDocument: (() => void) | undefined, lastReview: any;

const sha = (value: Uint8Array | string) => createHash("sha256").update(value).digest("hex");
const note = (event: string) => trace.push({ event, milliseconds: performance.now() - started });
const within = (base: string, file: string) => { const part = relative(resolve(base), resolve(file)); return part === "" || !part.startsWith("..") && !isAbsolute(part); };
const fileKey = (file: string) => process.platform === "win32" ? resolve(file).toLowerCase() : resolve(file);
function valueFree(value: unknown): void {
    const text = typeof value === "string" ? value : JSON.stringify(value) ?? "";
    for (const privateValue of PRIVATE_VALUES) assert(!text.includes(privateValue), "Private log content entered a public result or UI.");
}
function metadataOnly(value: unknown): void {
    valueFree(value); const text = typeof value === "string" ? value : JSON.stringify(value) ?? "";
    for (const name of [...INPUTS.keys(), REFERENCE, "API_KEY", "pass\\u0077ord"]) assert(!text.includes(name), "Saved-log names or labels entered keyed metadata.");
    if (root) assert(!text.includes(root), "Original root entered keyed metadata.");
    if (outside) assert(!text.includes(outside), "Reference path entered keyed metadata.");
}
function patch(object: object, name: string, value: unknown): void {
    const prior = Object.getOwnPropertyDescriptor(object, name);
    Object.defineProperty(object, name, { configurable: true, writable: true, value });
    restores.push(() => prior ? Object.defineProperty(object, name, prior) : Reflect.deleteProperty(object, name));
}
async function until(predicate: () => boolean, milliseconds = 5000): Promise<void> {
    const end = Date.now() + milliseconds;
    while (!predicate() && Date.now() < end) await new Promise<void>(done => setTimeout(done, 10));
    assert(predicate(), "Expected synthetic native stage was not reached.");
}
function filePath(value: unknown): string | undefined {
    return typeof value === "string" ? value : value instanceof URL && value.protocol === "file:" ? vscode.Uri.parse(value.href).fsPath
        : value instanceof vscode.Uri && value.scheme === "file" ? value.fsPath : undefined;
}
function sourceDocument(value: unknown): boolean {
    const file = filePath(value); return !!file && (within(root, file) || fileKey(file) === fileKey(outside));
}
function readObserved(value: unknown): void {
    const file = filePath(value); if (!file) return; observedFileCalls++;
    const key = fileKey(file), suffix = process.platform === "win32" ? REFERENCE.toLowerCase() : REFERENCE;
    if (key === fileKey(outside) || key.endsWith(suffix)) referenceReads++;
    const spelling = registeredFiles.get(key);
    if (spelling) { contentReads++; readEvents.push(key); if (resolve(file) !== spelling) caseVariantContentMatches++; }
}
async function originals(): Promise<Array<{ bytes: number; sha256: string }>> {
    const result: Array<{ bytes: number; sha256: string }> = [];
    for (const name of INPUTS.keys()) { const bytes = await nativeRead(join(root, name)); result.push({ bytes: bytes.length, sha256: sha(bytes) }); }
    const bytes = await nativeRead(outside); result.push({ bytes: bytes.length, sha256: sha(bytes) }); return result;
}
async function put(name: string, text: string | Buffer): Promise<void> {
    const file = join(root, name); await fsp.mkdir(dirname(file), { recursive: true });
    await fsp.writeFile(file, text, { flag: "wx" }); registeredFiles.set(fileKey(file), resolve(file));
}
/** Restrict only the native discovery query; all returned URIs and every
 * canonical read, parser, command, ledger and display remain production code.
 * Deterministic ordering isolates raw admission from filesystem enumeration. */
async function withCase(files: ReadonlyMap<string, string | Buffer>, work: (prefix: string) => Promise<void>): Promise<void> {
    assert.equal(activeCase, undefined); const prefix = "f25-native-cases/case-" + String(++caseNumber).padStart(3, "0");
    for (const [name, text] of files) await put(prefix + "/" + name, text);
    activeCase = prefix;
    try { await work(prefix); }
    finally {
        activeCase = undefined;
        const retained = join(root, "node_modules/f25-retained-cases"); await fsp.mkdir(retained, { recursive: true });
        await fsp.rename(join(root, prefix), join(retained, "case-" + String(caseNumber).padStart(3, "0")));
    }
}

export function setupDiagnostic() {
    return { syntheticOnly: true, stage: setupStage, sourceCalls, sourceEvents, contentReads, referenceReads, discoveryCalls: discoveries.length, stores, vaultStores, keyEvents };
}
export async function beforeActivate(context: vscode.ExtensionContext): Promise<void> {
    assert.equal(vscode.workspace.workspaceFolders?.length, 1); root = vscode.workspace.workspaceFolders![0].uri.fsPath;
    assert.match(resolve(process.env.USERPROFILE ?? ""), /^D:\\SoterAI-Lite-test-profiles\\/i);
    assert.match(resolve(root), /^D:\\SoterAI-Lite-test-profiles\\/i); assert(!within(root, context.globalStorageUri.fsPath));
    assert.equal(process.platform, "win32"); const phase = process.env.SOTERAI_LITE_F17_PHASE; assert(phase === "primary" || phase === "restart");
    outside = join(dirname(root), REFERENCE); assert(within(dirname(root), outside) && !within(root, outside));
    setupStage = "retained-synthetic-saved-log-preparation";
    if (phase === "primary") {
        for (const [name, text] of INPUTS) await put(name, text);
        await fsp.writeFile(outside, 'const apiKey = "' + OUTSIDE_VALUE + '";\n', { flag: "wx" });
    } else for (const name of INPUTS.keys()) registeredFiles.set(fileKey(join(root, name)), resolve(join(root, name)));
    patch(fsp, "readFile", (...args: unknown[]) => { readObserved(args[0]); return Reflect.apply(nativeRead, fsp, args); });
    patch(fs, "readFileSync", (...args: unknown[]) => { readObserved(args[0]); return Reflect.apply(nativeReadSync, fs, args); });
    patch(fsp, "open", (...args: unknown[]) => { readObserved(args[0]); return Reflect.apply(nativeOpen, fsp, args); });
    patch(fs, "openSync", (...args: unknown[]) => { readObserved(args[0]); return Reflect.apply(nativeOpenSync, fs, args); });
    const find = vscode.workspace.findFiles;
    patch(vscode.workspace, "findFiles", async (...args: Parameters<typeof find>) => {
        discoveries.push({ maximum: args[2], isolatedSyntheticDirectory: activeCase !== undefined });
        if (activeCase !== undefined) {
            assert.equal(args[2], 129); assert.equal(args[1], "**/{.git,node_modules}/**");
            const found = await find.call(vscode.workspace, new vscode.RelativePattern(root, activeCase + "/**/*"), args[1], args[2], args[3]);
            assert(found.every(uri => within(join(root, activeCase!), uri.fsPath)));
            return found.sort((left, right) => fileKey(left.fsPath).localeCompare(fileKey(right.fsPath)));
        }
        return Reflect.apply(find, vscode.workspace, args);
    });
    const store = context.secrets.store;
    patch(context.secrets, "store", async (key: string, value: string) => {
        if (key === KEY) { stores++; assert.equal(Buffer.from(value, "base64").length, 32); }
        if (key === "soterai.vaultKey") vaultStores++; return store.call(context.secrets, key, value);
    });
    listeners.push(vscode.workspace.onDidChangeConfiguration(event => { if (event.affectsConfiguration("soterai")) note("soterai-configuration-event"); }),
        context.secrets.onDidChange(event => { if (event.key === KEY) { keyEvents++; note("log-key-event"); } }));
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
    patch(vscode.window, "showWarningMessage", async (message: string, options: vscode.MessageOptions, ...items: string[]) => {
        valueFree([message, options, items]); const action = items.find(item => [ACTION, "Create metadata export"].includes(item));
        if (!action) return undefined; assert.equal(options.modal, true); reviews.push({ action, modal: true });
        if (action === ACTION) {
            metadataOnly([message, options, items]);
            assert.match(options.detail ?? "", /128/); assert.match(options.detail ?? "", /64KiB/); assert.match(options.detail ?? "", /1MiB/); assert.match(options.detail ?? "", /60seconds/);
            if (holdPrompt) { promptEntered = true; return new Promise<string | undefined>(done => finishPrompt = done); }
        }
        return approve ? action : undefined;
    });
    for (const name of ["showInformationMessage", "showErrorMessage"]) patch(vscode.window, name, async (message: unknown) => { valueFree(message); return undefined; });
    setupStage = "instrumented-before-production-activation";
}

export async function run(context: vscode.ExtensionContext): Promise<void> {
    const phase = process.env.SOTERAI_LITE_F17_PHASE!, output = process.env.SOTERAI_LITE_F17_EVIDENCE!;
    const config = vscode.workspace.getConfiguration("soterai"), oldFlag = config.inspect<boolean>(FLAG)?.globalValue;
    const oldVault = config.inspect<boolean>("lite.vaultMode")?.globalValue;
    const runtime = sha(await nativeRead(join(context.extensionUri.fsPath, "dist/extension.js"))); assert.equal(runtime, process.env.SOTERAI_LITE_F17_BUNDLE_SHA256);
    const receipt = join(dirname(root), "logs-restart.json"), observations: Array<{ id: string; scope: string; status: string; errorName?: string }> = [];
    const check = async (scope: string, work: () => Promise<void>) => {
        const row = { id: "F25-N" + String(observations.length + 1).padStart(2, "0"), scope, status: "NOT_RUN", errorName: undefined as string | undefined }; observations.push(row);
        try { await work(); row.status = "PASS"; } catch (error) { row.status = "FAIL"; row.errorName = error instanceof Error ? error.name : "UnknownFailure"; }
    };
    const call = async (name: string, ...args: unknown[]): Promise<any> => {
        note("command-start-" + name); const result: any = await vscode.commands.executeCommand("soterai." + name, ...args);
        metadataOnly(result); trace.push({ event: "command-end-" + name, milliseconds: performance.now() - started,
            status: typeof result?.status === "string" && /^[A-Z_]{1,80}$/.test(result.status) ? result.status : "METADATA",
            files: Number.isSafeInteger(result?.files) ? result.files : undefined, findings: Array.isArray(result?.findings) ? result.findings.length : undefined }); return result;
    };
    const clean = () => { assert.equal(sourceCalls, 0); assert.equal(sourceEvents, 0); assert.equal(referenceReads, 0); assert.equal(vaultStores, 0);
        assert(!vscode.workspace.textDocuments.some(document => sourceDocument(document.uri))); metadataOnly(context.globalState.get(STATE)); metadataOnly(metadata); };
    const scan = async (...args: unknown[]) => { const before = await originals(), result = await call("reviewLogs", ...args); assert.deepEqual(await originals(), before); clean(); return result; };
    const fourFindings = (result: any) => { assert.equal(result.status, "ANALYZED"); assert.equal(result.files, INPUTS.size); assert.equal(result.skipped, 0); assert.equal(result.findings.length, 4);
        for (const finding of result.findings) for (const field of ["id", "fileRef", "valueRef"]) assert.match(finding[field], /^[a-f0-9]{64}$/); };
    const isolated = async (files: ReadonlyMap<string, string | Buffer>, verify: (result: any, prefix: string, reads: string[]) => Promise<void>) =>
        withCase(files, async prefix => { const beforeReads = readEvents.length; const result = await scan(); await verify(result, prefix, readEvents.slice(beforeReads)); });
    const noFindings = (result: any, status: "ANALYZED" | "PARTIAL", files: number, skipped: number) => {
        assert.equal(result.status, status); assert.equal(result.files, files); assert.equal(result.skipped, skipped); assert.deepEqual(result.findings, []);
    };
    let driverFailure: string | undefined;
    try {
        if (phase === "primary") {
            await check("Exact packaged commands have no startup discovery, content, key or original document", async () => {
                assert.equal(discoveries.length, 0); assert.equal(contentReads, 0); assert.equal(stores, 0); assert.equal(await context.secrets.get(KEY), undefined); assert.equal(metadata.length, 0);
                const status = await call("logProtectionStatus", { approved: true, root: CALLER }); assert.equal(status.status, "OWNER_REVIEW_REQUIRED"); assert.equal(status.busy, false);
                const commands = await vscode.commands.getCommands(true); for (const name of ["reviewLogs", "logProtectionStatus"]) assert(commands.includes("soterai." + name)); clean();
            });
            await check("Native owner cancellation ignores caller authority before discovery, key and content", async () => {
                approve = false; try { assert.equal((await scan({ approved: true, root: CALLER, content: CALLER })).status, "CANCELLED"); } finally { approve = true; }
                assert.equal(discoveries.length, 0); assert.equal(contentReads, 0); assert.equal(stores, 0); assert.equal(metadata.length, 0);
            });
            await check("One pending owner modal stays busy and refuses a second command without discovery", async () => {
                holdPrompt = true; promptEntered = false; const pending = call("reviewLogs");
                try { await until(() => promptEntered); assert.equal((await call("logProtectionStatus")).busy, true); assert.equal((await call("reviewLogs", { approved: true })).status, "UNAVAILABLE");
                    assert.equal(discoveries.length, 0); assert.equal(contentReads, 0); assert.equal(stores, 0); }
                finally { finishPrompt?.(undefined); holdPrompt = false; }
                assert.equal((await pending).status, "CANCELLED"); assert.equal((await call("logProtectionStatus")).busy, false); clean();
            });
            await check("Actual saved log, TAP, nested sensitive JSON property and decoded JSONL each produce one finding", async () => {
                assert(!INPUTS.get(JSONL)!.includes(DECODED_VALUE)); lastReview = await scan(); fourFindings(lastReview);
                assert.equal(Buffer.from((await context.secrets.get(KEY))!, "base64").length, 32); assert(contentReads > 0); assert(discoveries.some(item => item.maximum === 129 && !item.isolatedSyntheticDirectory)); clean();
            });
            await check("logs-v1 exact value references and canonical ledger rows are metadata only with distinct finding IDs", async () => {
                fourFindings(lastReview); assert.deepEqual(JSON.parse(metadata.at(-1)!), lastReview); assert(displayed.length >= 1);
                const rawKey = Buffer.from((await context.secrets.get(KEY))!, "base64"), scoped = createHmac("sha256", rawKey).update("analysis-root\0" + vscode.workspace.workspaceFolders![0].uri.toString()).digest();
                const logKey = createHmac("sha256", scoped).update("analysis-domain\0logs-v1").digest();
                const ref = (key: Buffer, value: string) => createHmac("sha256", key).update("value\0").update(value, "utf8").digest("hex");
                assert.deepEqual(lastReview.findings.map((finding: { valueRef: string }) => finding.valueRef).sort(), [PLAIN_VALUE, TAP_VALUE, PROPERTY_VALUE, DECODED_VALUE].map(value => ref(logKey, value)).sort());
                for (const domain of [undefined, "history-v1", "artifact-v1"]) {
                    const key = domain ? createHmac("sha256", scoped).update("analysis-domain\0" + domain).digest() : scoped;
                    assert(!lastReview.findings.some((finding: { valueRef: string }) => finding.valueRef === ref(key, PLAIN_VALUE)));
                }
                rawKey.fill(0); logKey.fill(0); scoped.fill(0);
                const ledger = await call("openHygieneExposureLedger"); assert.equal(ledger.rows.length, 4);
                for (const row of ledger.rows) { assert.equal(row.lastAction, "possible-project-exposure"); for (const field of ["id", "rootRef", "fileRef", "valueRef"]) assert.match(row[field], /^[a-f0-9]{64}$/);
                    assert(!lastReview.findings.some((finding: { id: string }) => finding.id === row.id)); assert(lastReview.findings.some((finding: { fileRef: string; valueRef: string }) => finding.fileRef === row.fileRef && finding.valueRef === row.valueRef)); } clean();
            });
            await check("Caller paths and approvals cannot redirect repeated scans or change keyed ledger identity", async () => {
                const before = await call("openHygieneExposureLedger"), result = await scan(vscode.Uri.file("C:\\foreign-f25-log"), { root: CALLER, path: CALLER, content: CALLER, approved: true }); fourFindings(result);
                assert.deepEqual(result.findings.map((finding: { id: string }) => finding.id).sort(), lastReview.findings.map((finding: { id: string }) => finding.id).sort());
                const after = await call("openHygieneExposureLedger"); assert.equal(after.rows.length, 4);
                for (const row of before.rows) assert(after.rows.find((next: { id: string; observations: number }) => next.id === row.id).observations > row.observations); clean();
            });
            await check("Public TAP, Windows stack and credential templates remain useful without vault mode or a vault key", async () => {
                await config.update("lite.vaultMode", false, vscode.ConfigurationTarget.Global);
                try { await isolated(new Map([["public.tap", PUBLIC_TEXT], ["stack.log", "Error: public assertion\n    at C:\\public-tests\\example.cjs:7:3\n"], ["templates.json", INPUTS.get(TEMPLATES)!]]), async result => noFindings(result, "ANALYZED", 3, 0)); }
                finally { await config.update("lite.vaultMode", oldVault, vscode.ConfigurationTarget.Global); }
                assert.equal(INPUTS.get(PUBLIC), PUBLIC_TEXT); assert.equal(await context.secrets.get("soterai.vaultKey"), undefined); clean();
            });
            await check("Malformed late JSONL, duplicate keys, strict syntax, decoded controls and invalid UTF8 withhold atomically", async () => {
                const valid = JSON.stringify({ password: PROPERTY_VALUE });
                await isolated(new Map<string, string | Buffer>([["late.jsonl", valid + '\n{"message":"unterminated'], ["duplicate.json", '{"password":' + JSON.stringify(PROPERTY_VALUE) + ',"pass\\u0077ord":"public"}'],
                    ["strict.json", valid.slice(0, -1) + ",}"], ["control.json", JSON.stringify({ password: PROPERTY_VALUE, message: "public\u202e" })], ["invalid.log", Buffer.from([255, 254, 255])]]), async result => noFindings(result, "PARTIAL", 0, 5)); clean();
            });
            await check("Exactly32 semantic strings are admitted and a33rd withholds the complete structured file", async () => {
                const parts = Array.from({ length: 32 }, (_, index) => "public part " + index);
                await isolated(new Map([["exact.json", JSON.stringify(parts)], ["over.json", JSON.stringify([...parts, "extra public part"])]]), async result => noFindings(result, "PARTIAL", 1, 1));
            });
            await check("Exact depth32,10000 value-container nodes and128 JSONL records remain useful; each next unit withholds", async () => {
                const nested = (depth: number) => "[".repeat(depth) + '"public"' + "]".repeat(depth);
                const nodes = (count: number) => "[" + Array.from({ length: count - 1 }, () => "0").join(",") + "]";
                const records = (count: number) => Array.from({ length: count }, (_, index) => JSON.stringify({ index })).join("\n") + "\n";
                await isolated(new Map([["depth-exact.json", nested(32)], ["depth-over.json", nested(33)], ["nodes-exact.json", nodes(10000)], ["nodes-over.json", nodes(10001)],
                    ["records-exact.jsonl", records(128)], ["records-over.jsonl", records(129)]]), async result => noFindings(result, "PARTIAL", 3, 3));
            });
            await check("Inclusive64KiB saved-file admission preserves a public log and skips the next byte before reading", async () => {
                const exact = "PORT=3000\n" + " ".repeat(65536 - 10); assert.equal(Buffer.byteLength(exact), LIMITS.fileBytes);
                await isolated(new Map([["exact.log", exact], ["over.log", exact + "x"]]), async (result, prefix, reads) => {
                    noFindings(result, "PARTIAL", 1, 1); assert(reads.includes(fileKey(join(root, prefix, "exact.log")))); assert(!reads.includes(fileKey(join(root, prefix, "over.log"))));
                });
            });
            await check("Seventeen64KiB public files admit at most1MiB unique raw content and report the rest partial", async () => {
                const exact = "PORT=3000\n" + " ".repeat(65536 - 10), files = new Map(Array.from({ length: 17 }, (_, index) => ["public-" + String(index).padStart(2, "0") + ".log", exact]));
                await isolated(files, async (result, _prefix, reads) => { noFindings(result, "PARTIAL", 16, 1); assert.equal(new Set(reads).size, 16); assert.equal(new Set(reads).size * 65536, LIMITS.totalBytes); });
            });
            await check("Failed UTF8 decoding consumes the1MiB raw admission budget and prevents a later valid read", async () => {
                const files = new Map<string, string | Buffer>(Array.from({ length: 16 }, (_, index) => ["a-invalid-" + String(index).padStart(2, "0") + ".log", Buffer.alloc(65536, 255)]));
                files.set("z-after-budget.log", "Public TAP failure\n");
                await isolated(files, async (result, prefix, reads) => { noFindings(result, "PARTIAL", 0, 17); assert.equal(new Set(reads).size, 16);
                    assert(!reads.includes(fileKey(join(root, prefix, "z-after-budget.log")))); });
            });
            await check("Native discovery uses129 as the sentinel and scans no more than128 regular files", async () => {
                const files = new Map(Array.from({ length: 129 }, (_, index) => ["public-" + String(index).padStart(3, "0") + ".log", "PORT=3000\n"]));
                await isolated(files, async (result, _prefix, reads) => { noFindings(result, "PARTIAL", 128, 1); assert.equal(new Set(reads).size, 128); assert.equal(discoveries.at(-1)?.maximum, 129); });
            });
            await check("Owner disable blocks discovery and a repository enable is rejected by native machine scope", async () => {
                await config.update(FLAG, false, vscode.ConfigurationTarget.Global); const beforeReads = contentReads, beforeFind = discoveries.length, beforeStores = stores, prior = JSON.stringify(context.globalState.get(STATE));
                try { assert.equal((await call("reviewLogs", { enabled: true, approved: true })).status, "UNAVAILABLE"); assert.equal((await call("logProtectionStatus")).status, "UNAVAILABLE");
                    await assert.rejects(async () => config.update(FLAG, true, vscode.ConfigurationTarget.Workspace), { name: "CodeExpectedError" });
                    assert.equal(contentReads, beforeReads); assert.equal(discoveries.length, beforeFind); assert.equal(stores, beforeStores); assert.equal(JSON.stringify(context.globalState.get(STATE)), prior); }
                finally { await config.update(FLAG, true, vscode.ConfigurationTarget.Global); } clean();
            });
            await check("Disable and reenable while owner approval waits irreversibly withdraws before discovery", async () => {
                holdPrompt = true; promptEntered = false; const beforeReads = contentReads, beforeFind = discoveries.length, beforeStores = stores, pending = call("reviewLogs");
                try { await until(() => promptEntered); await config.update(FLAG, false, vscode.ConfigurationTarget.Global); await config.update(FLAG, true, vscode.ConfigurationTarget.Global); }
                finally { finishPrompt?.(ACTION); holdPrompt = false; }
                assert.equal((await pending).status, "UNAVAILABLE"); assert.equal(contentReads, beforeReads); assert.equal(discoveries.length, beforeFind); assert.equal(stores, beforeStores); clean();
            });
            await check("Key change and restoration while metadata creation waits cannot revive stale display or command output", async () => {
                const key = await context.secrets.get(KEY); assert(key); holdDocument = true; documentEntered = false; const beforeShown = displayed.length, pending = call("reviewLogs");
                try { await until(() => documentEntered); const events = keyEvents; await context.secrets.store(KEY, Buffer.alloc(32, 65).toString("base64")); await until(() => keyEvents > events); await context.secrets.store(KEY, key); }
                finally { await context.secrets.store(KEY, key); finishDocument?.(); holdDocument = false; }
                assert.equal((await pending).status, "UNAVAILABLE"); assert.equal(displayed.length, beforeShown); clean();
            });
            await check("Canonical source replacement while a metadata document waits suppresses stale display and preserves restored originals", async () => {
                holdDocument = true; documentEntered = false; const beforeShown = displayed.length, original = INPUTS.get(SAVED)!, pending = call("reviewLogs");
                try { await until(() => documentEntered); await fsp.writeFile(join(root, SAVED), "PORT=4000\n"); finishDocument?.(); assert.equal((await pending).status, "UNAVAILABLE"); assert.equal(displayed.length, beforeShown); }
                finally { await fsp.writeFile(join(root, SAVED), original); finishDocument?.(); holdDocument = false; } clean();
            });
            await check("Owned flag withdrawal after analysis and before display suppresses the completed saved-log result", async () => {
                holdDocument = true; documentEntered = false; const beforeShown = displayed.length, pending = call("reviewLogs");
                try { await until(() => documentEntered); await config.update(FLAG, false, vscode.ConfigurationTarget.Global); await config.update(FLAG, true, vscode.ConfigurationTarget.Global); }
                finally { finishDocument?.(); holdDocument = false; }
                assert.equal((await pending).status, "UNAVAILABLE"); assert.equal(displayed.length, beforeShown); clean();
            });
            await check("The real60-second native approval deadline withdraws output while busy remains until the late modal closes", async () => {
                holdPrompt = true; promptEntered = false; const beforeReads = contentReads, beforeFind = discoveries.length, begin = performance.now(), pending = call("reviewLogs");
                try { await until(() => promptEntered); const result = await pending; assert(performance.now() - begin >= 60000); assert.equal(result.status, "UNAVAILABLE");
                    assert.equal((await call("logProtectionStatus")).busy, true); assert.equal((await call("reviewLogs")).status, "UNAVAILABLE"); assert.equal(contentReads, beforeReads); assert.equal(discoveries.length, beforeFind); }
                finally { finishPrompt?.(ACTION); holdPrompt = false; }
                let busy = true; for (let index = 0; index < 100 && busy; index++) { busy = (await call("logProtectionStatus")).busy; if (busy) await new Promise<void>(done => setTimeout(done, 10)); }
                assert.equal(busy, false); clean();
            });
            await check("Outside hardlinks are withheld without reference reads; findings grant no vault authority and form the restart basis", async () => {
                const prefix = "f25-native-cases/alias-case", alias = join(root, prefix, "linked.log"), retained = join(root, "node_modules/f25-retained-alias.log");
                await fsp.mkdir(dirname(alias), { recursive: true }); await fsp.link(outside, alias); registeredFiles.set(fileKey(alias), resolve(alias)); activeCase = prefix;
                try { const beforeReads = contentReads; assert.equal((await call("reviewLogs")).status, "UNAVAILABLE"); assert.equal(contentReads, beforeReads); }
                finally { activeCase = undefined; await fsp.mkdir(dirname(retained), { recursive: true }); await fsp.rename(alias, retained); }
                assert.equal((await fsp.lstat(outside)).nlink, 2); assert.equal((await fsp.lstat(retained)).nlink, 2); clean();
                const fresh = await scan(); fourFindings(fresh); assert.equal((await call("reviewHygieneVault", fresh.findings[0], { approved: true })).status, "REVIEW_FILES_FIRST");
                const ledger = await call("openHygieneExposureLedger"); assert.equal(ledger.rows.length, 4); assert.equal(await context.secrets.get("soterai.vaultKey"), undefined);
                await fsp.writeFile(receipt, JSON.stringify({ ledger: context.globalState.get(STATE), originals: await originals(), findingIds: fresh.findings.map((finding: { id: string }) => finding.id).sort(), ledgerIds: ledger.rows.map((row: { id: string }) => row.id).sort() }) + "\n", { flag: "wx" }); clean();
            });
        } else {
            const prior = JSON.parse(await nativeRead(receipt, "utf8"));
            await check("Restart reuses persisted keyed metadata without startup discovery, content, documents or key stores", async () => {
                assert.equal(stores, 0); assert.equal(discoveries.length, 0); assert.equal(contentReads, 0); assert.equal(metadata.length, 0); assert.equal((await call("logProtectionStatus")).status, "OWNER_REVIEW_REQUIRED");
                assert.deepEqual(context.globalState.get(STATE), prior.ledger); assert.deepEqual(await originals(), prior.originals); clean();
            });
            await check("Restart caller approvals cannot replace a fresh native owner decision", async () => {
                approve = false; try { assert.equal((await scan({ approved: true, findingIds: prior.findingIds })).status, "CANCELLED"); } finally { approve = true; }
                assert.equal(discoveries.length, 0); assert.equal(contentReads, 0); assert.equal(stores, 0); assert.equal(metadata.length, 0); assert.deepEqual(context.globalState.get(STATE), prior.ledger); clean();
            });
            await check("Fresh restart review preserves exact saved-log finding IDs and independently keyed ledger row IDs", async () => {
                const result = await scan(); fourFindings(result); assert.deepEqual(result.findings.map((finding: { id: string }) => finding.id).sort(), prior.findingIds);
                const ledger = await call("openHygieneExposureLedger"); assert.deepEqual(ledger.rows.map((row: { id: string }) => row.id).sort(), prior.ledgerIds);
                for (const row of ledger.rows) { assert(!prior.findingIds.includes(row.id)); assert(row.observations > prior.ledger.rows.find((old: { id: string }) => old.id === row.id).observations); }
                assert.equal(stores, 0); clean();
            });
            await check("Restart owner disable still withdraws the native route and fresh reenable preserves originals and public controls", async () => {
                await config.update(FLAG, false, vscode.ConfigurationTarget.Global); const beforeReads = contentReads, beforeFind = discoveries.length;
                try { assert.equal((await call("reviewLogs", { approved: true })).status, "UNAVAILABLE"); assert.equal(contentReads, beforeReads); assert.equal(discoveries.length, beforeFind); }
                finally { await config.update(FLAG, true, vscode.ConfigurationTarget.Global); }
                fourFindings(await scan()); assert.deepEqual(await originals(), prior.originals); assert.equal(stores, 0); assert.equal(await nativeRead(join(root, PUBLIC), "utf8"), PUBLIC_TEXT); clean();
            });
        }
    } catch { driverFailure = "NativeSavedLogsDriverFailure"; }
    finally {
        try {
            finishPrompt?.(undefined); finishDocument?.(); holdPrompt = false; holdDocument = false;
            await config.update(FLAG, oldFlag, vscode.ConfigurationTarget.Global); await config.update("lite.vaultMode", oldVault, vscode.ConfigurationTarget.Global); clean();
            for (const document of new Set([...opened, ...displayed])) if (!document.isClosed && document.isUntitled) {
                await vscode.window.showTextDocument(document); await vscode.commands.executeCommand("workbench.action.revertAndCloseActiveEditor");
            }
        } catch { driverFailure = "NativeSavedLogsWithdrawalUnconfirmed"; }
        listeners.forEach(listener => listener.dispose()); for (const restore of restores.reverse()) restore();
    }
    const result = { schemaVersion: 1, phase, syntheticOnly: true, hostVersion: vscode.version, extensionBundleSha256: runtime,
        currentDeveloperBundleSha256: sha(await nativeRead(join(context.extensionUri.fsPath, "dist/extension.js"))), hostProbeSha256: sha(await nativeRead(__filename)),
        observations, passed: observations.filter(row => row.status === "PASS").length, failed: observations.filter(row => row.status === "FAIL").length,
        notRun: observations.filter(row => row.status === "NOT_RUN").length, expectedChecks: phase === "primary" ? 21 : 4,
        sourceDocumentCalls: sourceCalls, sourceDocumentEvents: sourceEvents, logContentReads: contentReads, referencedContentReads: referenceReads,
        observedFileCalls, caseVariantContentMatches, discoveries, limits: LIMITS, secretStorageStores: stores, vaultKeyStores: vaultStores,
        reviews, metadataDocuments: metadata.length, trace, driverFailure, independence: "LOW", ownerPresence: "SCRIPTED_NATIVE_API_DECISIONS_NOT_HUMAN_REVIEW",
        boundaryDiscovery: "NATIVE_DISCOVERY_RESTRICTED_TO_RETAINED_SYNTHETIC_DIRECTORY_WITH_DETERMINISTIC_ADMISSION_ORDER",
        notTested: ["Human usability/accessibility", "Other extensions, normal debug consoles, arbitrary processes and transformed/prose/binary credentials",
            "Credential validity, provider rotation, AI access or prior disclosures", "Same-user unmanaged reads, process memory and independent uploads", "Other platforms and remote workspaces"] };
    metadataOnly(result); await fsp.writeFile(output, JSON.stringify(result, null, 2) + "\n", { flag: "wx" });
    if (result.failed || driverFailure || result.observations.length !== result.expectedChecks) throw Error("Native saved logs incomplete");
}
