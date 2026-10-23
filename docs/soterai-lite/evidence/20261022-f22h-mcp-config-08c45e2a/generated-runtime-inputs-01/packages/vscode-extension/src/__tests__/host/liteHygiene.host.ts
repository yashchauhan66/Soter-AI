/** F21 exact packaged registration, native SecretStorage and saved synthetic IO.
 * Only picker/modal decisions are scripted; LOW independence, no human UX claim. */
import * as vscode from "vscode";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile, readdir } from "node:fs/promises";
import { join, dirname, resolve } from "node:path";
const VALUE = "TEST_ONLY_F21_NATIVE_PRIVATE_91e753d4", SOURCE = "API_KEY=" + VALUE + "\nPORT=3000\n", KEY = "soterai.hygiene.hmacKey.v1", STATE = "soterai.lite.hygiene.exposure.v1";
const restores: Array<() => void> = [], listeners: vscode.Disposable[] = [];
let selected: vscode.Uri | undefined, approve = true, cancelFile = false, drift = false, hold = false;
let finish: ((value: string | undefined) => void) | undefined, entered = false, sourceCalls = 0, sourceEvents = 0, stores = 0;
const reviews: Array<{ action: string; safe: boolean }> = [], documents: string[] = [], displayed: vscode.TextDocument[] = [];
const trace: Array<{ event: string; milliseconds: number; status?: string; files?: number; findings?: number }> = [];
const started = performance.now(), note = (event: string) => trace.push({ event, milliseconds: performance.now() - started });
const sha = (v: Uint8Array) => createHash("sha256").update(v).digest("hex");
const noValues = (v: unknown) => { assert(!(JSON.stringify(v) ?? "").includes(VALUE), "Private original entered metadata"); };
const source = () => vscode.Uri.joinPath(vscode.workspace.workspaceFolders![0].uri, ".env.hygiene");
const isSource = (v: unknown) => v instanceof vscode.Uri && v.toString() === source().toString();
function patch(object: object, name: string, value: unknown) { const prior = Object.getOwnPropertyDescriptor(object, name); Object.defineProperty(object, name, { configurable: true, writable: true, value }); restores.push(() => prior ? Object.defineProperty(object, name, prior) : Reflect.deleteProperty(object, name)); }
export function setupDiagnostic() { return { syntheticOnly: true, sourceCalls, sourceEvents, stores, reviews: reviews.length }; }
export function beforeActivate(context: vscode.ExtensionContext): void {
    assert.match(resolve(process.env.USERPROFILE ?? ""), /^D:\\SoterAI-Lite-test-profiles\\/i);
    assert.match(resolve(vscode.workspace.workspaceFolders![0].uri.fsPath), /^D:\\SoterAI-Lite-test-profiles\\/i);
    selected = source();
    listeners.push(vscode.workspace.onDidChangeConfiguration(e => { if (e.affectsConfiguration("soterai")) note("soterai-configuration-event"); }),
        context.secrets.onDidChange(e => { if (e.key === KEY) note("hygiene-key-event"); if (e.key === "soterai.vaultKey") note("vault-key-event"); }));
    const get = context.secrets.get, store = context.secrets.store;
    patch(context.secrets, "get", async (key: string) => { const v = await get.call(context.secrets, key); if ((key === KEY || key === "soterai.vaultKey") && v !== undefined) assert.equal(Buffer.from(v, "base64").length, 32); return v; });
    patch(context.secrets, "store", async (key: string, value: string) => { if (key === KEY || key === "soterai.vaultKey") { stores++; assert.equal(Buffer.from(value, "base64").length, 32); } return store.call(context.secrets, key, value); });
    const open = vscode.workspace.openTextDocument;
    patch(vscode.workspace, "openTextDocument", (...args: unknown[]) => { if (isSource(args[0])) sourceCalls++; const input = args[0] as { content?: string }; if (input?.content) { noValues(input.content); documents.push(input.content); } return Reflect.apply(open, vscode.workspace, args); });
    listeners.push(vscode.workspace.onDidOpenTextDocument(d => { if (isSource(d.uri)) sourceEvents++; }));
    const show = vscode.window.showTextDocument;
    patch(vscode.window, "showTextDocument", async (...args: unknown[]) => { const d = args[0] as vscode.TextDocument; noValues(d.getText()); displayed.push(d); return Reflect.apply(show, vscode.window, args); });
    patch(vscode.window, "showOpenDialog", async () => cancelFile ? undefined : selected ? [selected] : undefined);
    patch(vscode.window, "showQuickPick", async (items: readonly unknown[]) => items[0]);
    patch(vscode.window, "showWarningMessage", async (message: string, options: vscode.MessageOptions, ...items: string[]) => {
        noValues([message, options]); const action = items.find(i => ["Analyze saved project files", "Migrate securely", "Restore raw values", "Write empty example values", "Create metadata export"].includes(i));
        if (!action) return undefined; assert.equal(options.modal, true); reviews.push({ action, safe: true });
        if (drift && action === "Analyze saved project files") { drift = false; await writeFile(source().fsPath, "PORT=4000\n"); }
        if (hold && action === "Analyze saved project files") { entered = true; return new Promise<string | undefined>(r => finish = r); }
        return approve ? action : undefined;
    });
    for (const name of ["showInformationMessage", "showErrorMessage"]) patch(vscode.window, name, async (value: unknown) => { noValues(value); return undefined; });
}
export async function run(context: vscode.ExtensionContext): Promise<void> {
    const phase = process.env.SOTERAI_LITE_F17_PHASE!, output = process.env.SOTERAI_LITE_F17_EVIDENCE!, config = vscode.workspace.getConfiguration("soterai"), oldFlag = config.inspect<boolean>("lite.hygieneAssistant")?.globalValue;
    const runtime = sha(await readFile(join(context.extensionUri.fsPath, "dist/extension.js"))); assert.equal(runtime, process.env.SOTERAI_LITE_F17_BUNDLE_SHA256);
    const root = vscode.workspace.workspaceFolders![0].uri.fsPath, receipt = join(dirname(root), "hygiene-restart.json"), observations: Array<{ id: string; scope: string; status: string; errorName?: string }> = [];
    const check = async (scope: string, work: () => Promise<void>) => { const row = { id: "F21-N" + String(observations.length + 1).padStart(2, "0"), scope, status: "NOT_RUN", errorName: undefined as string | undefined }; observations.push(row); try { await work(); row.status = "PASS"; } catch (e) { row.status = "FAIL"; row.errorName = e instanceof Error ? e.name : "UnknownFailure"; } };
    const call = async (name: string, ...args: unknown[]): Promise<any> => { note("command-start-" + name); const result: any = await vscode.commands.executeCommand("soterai." + name, ...args); noValues(result); trace.push({ event: "command-end-" + name, milliseconds: performance.now() - started, status: typeof result?.status === "string" && /^[A-Z_]{1,80}$/.test(result.status) ? result.status : "UNEXPECTED", files: Number.isSafeInteger(result?.files) ? result.files : undefined, findings: Array.isArray(result?.findings) ? result.findings.length : undefined }); return result; };
    const clean = () => { assert.equal(sourceCalls, 0); assert.equal(sourceEvents, 0); assert(!vscode.workspace.textDocuments.some(d => isSource(d.uri))); noValues(context.globalState.get(STATE)); };
    let driverFailure: string | undefined;
    try {
        if (phase === "primary") {
            await writeFile(source().fsPath, SOURCE, { flag: "wx" }); await writeFile(join(root, "public.txt"), "PORT=3000\n", { flag: "wx" });
            await check("Exact runtime, registration and no startup scan/key", async () => { assert.equal(await context.secrets.get(KEY), undefined); assert.equal((await call("hygieneStatus")).status, "OWNER_REVIEW_REQUIRED"); const commands = await vscode.commands.getCommands(true); for (const name of ["reviewWorkspaceHygiene", "reviewSelectedFileHygiene", "reviewHygieneVault", "generateHygieneEnvExample", "restoreHygieneVault", "openHygieneExposureLedger", "exportHygieneExposureLedger", "openHygieneRotationChecklist", "hygieneStatus"]) assert(commands.includes("soterai." + name)); clean(); });
            await check("File picker cancellation before originals/key", async () => { cancelFile = true; assert.equal((await call("reviewSelectedFileHygiene", { approved: true, path: "foreign.env" })).status, "CANCELLED"); cancelFile = false; assert.equal(await context.secrets.get(KEY), undefined); clean(); });
            await check("Actual selected saved file, safe metadata and real profile key", async () => { const result = await call("reviewSelectedFileHygiene", vscode.Uri.file("C:\\foreign.env"), { approved: true }); assert.equal(result.status, "ANALYZED"); assert.equal(result.findings.length, 1); assert.equal(Buffer.from((await context.secrets.get(KEY))!, "base64").length, 32); clean(); });
            await check("Workspace public control and bounded metadata report", async () => { const result = await call("reviewWorkspaceHygiene"); assert.equal(result.status, "ANALYZED"); assert(result.files >= 2); assert.equal(result.findings.length, 1); clean(); });
            await check("Possible-exposure ledger has keyed refs without source/value/name", async () => { const result = await call("openHygieneExposureLedger"); assert.equal(result.rows.length, 1); assert.match(result.rows[0].fileRef, /^[a-f0-9]{64}$/); assert.equal(result.rows[0].lastAction, "possible-project-exposure"); assert(!JSON.stringify(result).includes(root)); assert(!JSON.stringify(result).includes("API_KEY")); clean(); });
            await check("Canonical empty example keeps original source", async () => { assert.equal((await call("generateHygieneEnvExample")).status, "APPLIED"); assert.equal(await readFile(join(root, ".env.example"), "utf8"), "API_KEY=\nPORT=\n"); assert.equal(await readFile(source().fsPath, "utf8"), SOURCE); });
            await check("Vault cancellation preserves source", async () => { approve = false; assert.equal((await call("reviewHygieneVault", { approved: true })).status, "CANCELLED"); approve = true; assert.equal(await readFile(source().fsPath, "utf8"), SOURCE); });
            await check("Approved canonical migration, placeholders and real SecretStorage", async () => { assert.equal((await call("reviewHygieneVault")).status, "APPLIED"); assert(!(await readFile(source().fsPath, "utf8")).includes(VALUE)); assert.match(await readFile(source().fsPath, "utf8"), /SOTERAI_PROTECTED/); assert(await context.secrets.get("soterai.vaultKey")); clean(); });
            await check("Vault action remains possible-exposure metadata", async () => { assert.equal((await call("openHygieneExposureLedger")).rows[0].lastAction, "vaulted"); });
            await check("Disclosure cancellation withholds originals", async () => { approve = false; assert.equal((await call("restoreHygieneVault")).status, "CANCELLED"); approve = true; assert(!(await readFile(source().fsPath, "utf8")).includes(VALUE)); });
            await check("Explicit disclosure restores source and retains saved deny", async () => { assert.equal((await call("restoreHygieneVault")).status, "RESTORED"); assert.equal(await readFile(source().fsPath, "utf8"), SOURCE); assert(JSON.stringify(context.workspaceState.get("soterai.aiForbidden.v1")).includes('"sensitive":true')); clean(); });
            await check("Source drift during approval withholds current report", async () => { drift = true; assert.equal((await call("reviewSelectedFileHygiene")).status, "CHANGED"); await writeFile(source().fsPath, SOURCE); });
            await check("Export cancellation creates no metadata file", async () => { approve = false; assert.equal((await call("exportHygieneExposureLedger")).status, "CANCELLED"); approve = true; assert.equal((await readdir(join(context.globalStorageUri.fsPath, "hygiene-exports")).catch(() => [])).length, 0); });
            await check("Reviewed exclusive metadata export is value/path free", async () => { assert.equal((await call("exportHygieneExposureLedger")).status, "EXPORTED"); const dir = join(context.globalStorageUri.fsPath, "hygiene-exports"), files = await readdir(dir); assert.equal(files.length, 1); const text = await readFile(join(dir, files[0]), "utf8"); noValues(text); assert(!text.includes(root)); assert(!text.includes("API_KEY")); });
            await check("Native manual checklist ignores caller credentials and performs no rotation", async () => { const result = await call("openHygieneRotationChecklist", { provider: "foreign", approved: true }); assert.equal(result.provider, "openai"); assert.equal(result.status, "NOT_PERFORMED"); assert.equal(result.validity, "UNVERIFIED"); });
            await check("Flag withdrawal invalidates a pending actual content review", async () => { hold = true; entered = false; const pending = call("reviewSelectedFileHygiene"); const end = Date.now() + 5000; while (!entered && Date.now() < end) await new Promise(r => setTimeout(r, 10)); assert(entered); await config.update("lite.hygieneAssistant", false, vscode.ConfigurationTarget.Global); finish?.("Analyze saved project files"); assert.notEqual((await pending).status, "ANALYZED"); hold = false; assert.equal(await readFile(source().fsPath, "utf8"), SOURCE); });
            await check("Disabled route preserves source, ledger and saved denies", async () => { const before = JSON.stringify(context.globalState.get(STATE)); assert.equal((await call("reviewSelectedFileHygiene", { approved: true })).status, "UNAVAILABLE"); assert.equal(JSON.stringify(context.globalState.get(STATE)), before); clean(); });
            await check("Reenable and preserve restart binding; all original documents absent", async () => { await config.update("lite.hygieneAssistant", true, vscode.ConfigurationTarget.Global); assert.equal((await call("hygieneStatus")).status, "OWNER_REVIEW_REQUIRED"); clean(); assert(stores >= 2); await writeFile(receipt, JSON.stringify({ ledger: context.globalState.get(STATE), sourceSha256: sha(Buffer.from(SOURCE)), documents: documents.length }) + "\n", { flag: "wx" }); });
        } else {
            const prior = JSON.parse(await readFile(receipt, "utf8"));
            await check("Restart reads existing ledger/key without startup original documents", async () => { assert.equal(stores, 0); assert.equal((await call("hygieneStatus")).status, "OWNER_REVIEW_REQUIRED"); assert.deepEqual(context.globalState.get(STATE), prior.ledger); clean(); });
            await check("Restart ledger export view matches accepted metadata", async () => { const view = await call("openHygieneExposureLedger"); assert.equal(view.rows.length, 1); assert.equal(view.rows[0].lastAction, "restored-after-owner-disclosure"); assert.equal(sha(await readFile(source().fsPath)), prior.sourceSha256); clean(); });
            await check("No stale finding authority survives restart", async () => { assert.equal((await call("reviewHygieneVault", { approved: true })).status, "REVIEW_FILES_FIRST"); assert.equal(stores, 0); clean(); });
        }
    } catch { driverFailure = "NativeHygieneDriverFailure"; }
    finally {
        try { if (finish) finish(undefined); await config.update("lite.hygieneAssistant", oldFlag, vscode.ConfigurationTarget.Global); clean();
            for (const document of new Set(displayed)) if (!document.isClosed && document.isUntitled) { await vscode.window.showTextDocument(document); await vscode.commands.executeCommand("workbench.action.revertAndCloseActiveEditor"); }
        } catch { driverFailure = "NativeHygieneWithdrawalUnconfirmed"; }
        listeners.forEach(d => d.dispose()); for (const restore of restores.reverse()) restore();
    }
    const result = { schemaVersion: 1, phase, syntheticOnly: true, hostVersion: vscode.version, extensionBundleSha256: runtime, currentDeveloperBundleSha256: sha(await readFile(join(context.extensionUri.fsPath, "dist/extension.js"))), hostProbeSha256: sha(await readFile(__filename)), observations, passed: observations.filter(r => r.status === "PASS").length, failed: observations.filter(r => r.status === "FAIL").length, notRun: observations.filter(r => r.status === "NOT_RUN").length, sourceDocumentCalls: sourceCalls, sourceDocumentEvents: sourceEvents, secretStorageStores: stores, reviews, metadataDocuments: documents.length, trace, driverFailure, independence: "LOW", ownerPresence: "SCRIPTED_NATIVE_API_DECISIONS_NOT_HUMAN_REVIEW", notTested: ["Human accessibility/usability", "Live credential validity or account rotation", "OS credential custody certification", "Same-user native reads or independent uploads"] };
    noValues(result); await writeFile(output, JSON.stringify(result, null, 2) + "\n", { flag: "wx" }); if (result.failed || driverFailure) throw Error("Native hygiene incomplete");
}
