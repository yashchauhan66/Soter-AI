/** F26c exact packaged native owner commands. Scripted API decisions are LOW
 * independence. All profiles/history/keys here are fresh synthetic fixtures. */
import * as vscode from "vscode";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { homedir } from "node:os";
import fs from "node:fs";
import fsp from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";

const PRIMARY_IDS = ["Exact runtime/commands/default-off machine flag; idle profile/history/key activity absent","Disabled install ignores caller authority before selection","Actual native machine setting refuses repository override","Explicit global opt-in does not initiate profile/key activity","Native selection cancellation preserves original and key absence","Modal cancellation uses actual private metadata documents and no raw source document","Executable original refused before diff/key/mutation","Outside-owner synthetic profile refused before content access","Confirmed native owner install preserves inert prefix and installs owned generation","Actual encrypted backup/key/journal contain no raw public metadata or sibling backup","Actual emitted script equals the tested template modulo only public generation","Native status never promotes installed profile to verified coverage","Flag withdrawal preserves installed stronger bytes and refuses new install","Explicit reviewed restore works while disabled and preserves exact original","Profile drift during modal preserves the independent edit without backup","Foreign profile identity cannot adopt an owned journal","Corrupt durable receipt withheld without file/key mutation or green status","Missing own synthetic recovery key withholds restore without replacing it","Native flag withdrawal while a modal is pending invalidates approval","Single held native review rejects a second mutation and cancellation is final","All public results/modal/private documents are value and owner-path free","Native hardlink and junction selected profile routes are refused","Exact installed profile prepared for restart; existing synthetic history unchanged"];
const FLAG = "lite.historyHooks.psReadLine", JOURNAL = "psreadline-history-state-v1.json", KEY = "soterai.configBackupKey";
const PRIVATE = "FAKE_ONLY_F26C_NATIVE_COMMENT_e41a9c72", CALLER = "FAKE_ONLY_F26C_NATIVE_CALLER_1f90d2";
const ORIGINAL = Buffer.from("# " + PRIVATE + "\r\n"), HISTORY = Buffer.from("Write-Output FAKE_ONLY_EXISTING_HISTORY_f26c\n");
const TEMPLATE_HASH = "71a26e94857f99dabbf75219219b295b514627a57c88ad71368d7ff32bbf372a";
const GENERATION = "a1234567-1234-4567-8123-123456789abc";
const nativeRead = fsp.readFile, nativeOpen = fsp.open, nativeReadSync = fs.readFileSync, nativeOpenSync = fs.openSync;
const restores: Array<() => void> = [], listeners: vscode.Disposable[] = [], metadata: string[] = [];
const configuration: Array<{ stage: string; enabled?: boolean; observedAt: string }> = [];
const profiles = new Set<string>();
let root = "", home = "", target = "", alternative = "", executable = "", outside = "", history = "", selected = "";
let pick = true, approve = true, hold = false, entered = false, finish: ((value: string | undefined) => void) | undefined;
let onModal: (() => Promise<void>) | undefined, picks = 0, modals = 0, keyReads = 0, keyStores = 0, profileReads = 0, historyReads = 0, outsideReads = 0;
let originalDocumentCalls = 0, originalDocumentEvents = 0, stage = "initial";
const sha = (raw: Uint8Array | string) => createHash("sha256").update(raw).digest("hex");
const key = (file: string) => resolve(file).toLowerCase();
const within = (base: string, file: string) => { const part = relative(resolve(base), resolve(file)); return part === "" || !part.startsWith("..") && !isAbsolute(part); };
function valueFree(value: unknown): void {
    const text = typeof value === "string" ? value : JSON.stringify(value) ?? "";
    for (const secret of [PRIVATE, CALLER]) assert(!text.includes(secret), "Private fixture content entered metadata.");
    if (home) assert(!text.toLowerCase().includes(home.toLowerCase()), "Owner path entered public metadata.");
}
function patch(object: object, name: string, value: unknown): void {
    const before = Object.getOwnPropertyDescriptor(object, name); Object.defineProperty(object, name, { configurable: true, writable: true, value });
    restores.push(() => before ? Object.defineProperty(object, name, before) : Reflect.deleteProperty(object, name));
}
function observeRead(input: unknown): void {
    if (typeof input !== "string") return; const file = key(input);
    if (profiles.has(file)) profileReads++; if (file === key(history)) historyReads++; if (file === key(outside)) outsideReads++;
}
function sourceDocument(input: unknown): boolean {
    const uri = input instanceof vscode.Uri ? input : (input as { uri?: unknown })?.uri;
    return uri instanceof vscode.Uri && uri.scheme === "file" && (profiles.has(key(uri.fsPath)) || key(uri.fsPath) === key(history));
}
async function until(predicate: () => boolean): Promise<void> {
    const end = Date.now() + 10000; while (!predicate() && Date.now() < end) await new Promise<void>(done => setTimeout(done, 10));
    assert(predicate(), "Expected bounded native review was not reached.");
}
export function setupDiagnostic() { return { syntheticOnly: true, stage, picks, modals, keyReads, keyStores, profileReads, historyReads, outsideReads, originalDocumentCalls, originalDocumentEvents }; }

export async function beforeActivate(context: vscode.ExtensionContext): Promise<void> {
    assert.equal(vscode.workspace.workspaceFolders?.length, 1); root = vscode.workspace.workspaceFolders![0].uri.fsPath; home = homedir();
    for (const file of [root, home, context.globalStorageUri.fsPath]) assert.match(resolve(file), /^D:\\SoterAI-Lite-test-profiles\\/i);
    assert.equal(key(home), key(process.env.USERPROFILE!)); assert(!within(root, home)); assert(!within(root, context.globalStorageUri.fsPath));
    assert.equal(process.platform, "win32"); assert.equal(vscode.env.remoteName, undefined);
    target = join(home, "WindowsPowerShell", "Microsoft.PowerShell_profile.ps1");
    alternative = join(home, "alternative", "WindowsPowerShell", "Microsoft.PowerShell_profile.ps1");
    executable = join(home, "executable", "WindowsPowerShell", "Microsoft.PowerShell_profile.ps1");
    outside = join(dirname(home), "outside-owner", "WindowsPowerShell", "Microsoft.PowerShell_profile.ps1");
    history = join(home, "AppData", "Roaming", "Microsoft", "Windows", "PowerShell", "PSReadLine", "ConsoleHost_history.txt");
    selected = target; for (const file of [target, alternative, executable, outside]) profiles.add(key(file));
    const phase = process.env.SOTERAI_LITE_F17_PHASE; assert(phase === "primary" || phase === "restart");
    stage = "synthetic-fixture-preparation";
    if (phase === "primary") {
        for (const [file, raw] of [[target, ORIGINAL], [alternative, Buffer.from("# alternate public\n")], [executable, Buffer.from("Write-Output public\n")], [outside, Buffer.from("# outside synthetic retained\n")], [history, HISTORY]] as const) {
            assert(within(dirname(root), file)); await fsp.mkdir(dirname(file), { recursive: true }); await fsp.writeFile(file, raw, { flag: "wx" });
        }
    }
    patch(fsp, "readFile", (...args: unknown[]) => { observeRead(args[0]); return Reflect.apply(nativeRead, fsp, args); });
    patch(fsp, "open", (...args: unknown[]) => { observeRead(args[0]); return Reflect.apply(nativeOpen, fsp, args); });
    patch(fs, "readFileSync", (...args: unknown[]) => { observeRead(args[0]); return Reflect.apply(nativeReadSync, fs, args); });
    patch(fs, "openSync", (...args: unknown[]) => { observeRead(args[0]); return Reflect.apply(nativeOpenSync, fs, args); });
    const get = context.secrets.get, store = context.secrets.store;
    patch(context.secrets, "get", async (name: string) => { if (name === KEY) keyReads++; return get.call(context.secrets, name); });
    patch(context.secrets, "store", async (name: string, value: string) => { if (name === KEY) keyStores++; return store.call(context.secrets, name, value); });
    const open = vscode.workspace.openTextDocument;
    patch(vscode.workspace, "openTextDocument", async (...args: unknown[]) => {
        if (sourceDocument(args[0])) originalDocumentCalls++;
        const doc = await Reflect.apply(open, vscode.workspace, args) as vscode.TextDocument;
        if (doc.uri.scheme.startsWith("soterai-history-review-")) { valueFree(doc.getText()); metadata.push(doc.getText()); }
        return doc;
    });
    listeners.push(vscode.workspace.onDidOpenTextDocument(doc => { if (sourceDocument(doc.uri)) originalDocumentEvents++; }));
    patch(vscode.window, "showSaveDialog", async (options: vscode.SaveDialogOptions) => {
        picks++; assert(options.defaultUri && within(home, options.defaultUri.fsPath)); valueFree(options.title);
        return pick ? vscode.Uri.file(selected) : undefined;
    });
    patch(vscode.window, "showWarningMessage", async (message: string, options: vscode.MessageOptions, ...items: string[]) => {
        const action = items.find(item => ["Install history exclusion", "Restore previous profile"].includes(item));
        if (!action) return undefined; valueFree([message, options, items]); assert.equal(options.modal, true); modals++;
        await onModal?.(); if (hold) { entered = true; return new Promise<string | undefined>(done => finish = done); }
        return approve ? action : undefined;
    });
    const execute = vscode.commands.executeCommand;
    patch(vscode.commands, "executeCommand", async (name: string, ...args: unknown[]) => {
        if (name === "vscode.diff") {
            for (const candidate of args.slice(0, 2)) {
                assert(candidate instanceof vscode.Uri && candidate.scheme.startsWith("soterai-history-review-"));
                const doc = await vscode.workspace.openTextDocument(candidate); valueFree(doc.getText()); metadata.push(doc.getText());
            }
        }
        return Reflect.apply(execute, vscode.commands, [name, ...args]);
    });
    stage = "ready-before-product-activation";
}

export async function run(context: vscode.ExtensionContext): Promise<void> {
    const phase = process.env.SOTERAI_LITE_F17_PHASE!, output = process.env.SOTERAI_LITE_F17_EVIDENCE!;
    const config = vscode.workspace.getConfiguration("soterai"), oldFlag = config.inspect<boolean>(FLAG)?.globalValue;
    const runtime = sha(await nativeRead(join(context.extensionUri.fsPath, "dist/extension.js"))); assert.equal(runtime, process.env.SOTERAI_LITE_F17_BUNDLE_SHA256);
    const observations: Array<{ id: string; scope: string; status: string; errorName?: string }> = [];
    const check = async (scope: string, work: () => Promise<void>) => {
        const row = { id: "F26c-" + (phase === "primary" ? "N" : "R") + String(phase === "primary" ? PRIMARY_IDS.indexOf(scope) + 1 : observations.length + 1).padStart(2, "0"), scope, status: "NOT_RUN", errorName: undefined as string | undefined }; observations.push(row);
        try { await work(); row.status = "PASS"; } catch (error) { row.status = "FAIL"; row.errorName = error instanceof Error ? error.name : "UnknownFailure"; }
        if (row.id === "F26c-N19" || row.id === "F26c-N20") await recoverySnapshot("after-" + row.id, originalKey);
    };
    const call = async (name: string, ...args: unknown[]): Promise<any> => { const result = await vscode.commands.executeCommand("soterai." + name, ...args); valueFree(result); return result; };
    const flag = async (value: boolean | undefined) => {
        if (config.inspect<boolean>(FLAG)?.globalValue === value) return;
        configuration.push({ stage: "write-start", enabled: value, observedAt: new Date().toISOString() });
        let complete!: () => void, expired!: () => void;
        const acknowledgement = new Promise<void>(done => { complete = done; });
        const deadline = new Promise<void>((_done, fail) => { expired = () => fail(Error("Native configuration acknowledgement unavailable.")); });
        const listener = vscode.workspace.onDidChangeConfiguration(event => {
            if (event.affectsConfiguration("soterai." + FLAG) && config.inspect<boolean>(FLAG)?.globalValue === value) {
                configuration.push({ stage: "native-event", enabled: value, observedAt: new Date().toISOString() }); complete();
            }
        });
        const timer = setTimeout(() => expired(), 10000);
        try { await config.update(FLAG, value, vscode.ConfigurationTarget.Global); await Promise.race([acknowledgement, deadline]); assert.equal(config.inspect<boolean>(FLAG)?.globalValue, value); }
        finally { clearTimeout(timer); listener.dispose(); }
    };
    const current = () => nativeRead(target);
    const clean = () => { assert.equal(historyReads, 0); assert.equal(originalDocumentCalls, 0); assert.equal(originalDocumentEvents, 0); assert(!vscode.workspace.textDocuments.some(doc => sourceDocument(doc.uri))); valueFree(metadata); valueFree(ownedReceipt()); };
    const journalFile = join(context.globalStorageUri.fsPath, JOURNAL);
    const ownedReceipt = (): any => {
        try { const stat = fs.lstatSync(journalFile); assert(stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1 && stat.size <= 8192);
            return JSON.parse(nativeReadSync(journalFile, "utf8"));
        } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined; throw error; }
    };
    const nativeState = () => JSON.stringify(ownedReceipt());
    const recoveryDiagnostics: Array<object> = [];
    const recoverySnapshot = async (point: string, expectedKey: string | undefined) => {
        try {
            const liveKey = await context.secrets.get(KEY), row = ownedReceipt(), profile = await current();
            let backupBytes: number | undefined;
            if (typeof row?.backupHandle === "string" && /^[a-f0-9]{32}$/.test(row.backupHandle)) {
                const stat = await fsp.lstat(join(context.globalStorageUri.fsPath, "config-backups", row.backupHandle + ".enc"));
                if (stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1 && stat.size <= 131072) backupBytes = stat.size;
            }
            recoveryDiagnostics.push({ point, ownKeyPresent: typeof liveKey === "string" && liveKey.length > 0,
                ownKeyMatchesSaved: typeof expectedKey === "string" && liveKey === expectedKey,
                receiptPhase: ["PREPARED", "APPLIED", "RESTORING"].includes(row?.phase) ? row.phase : "UNKNOWN",
                profileMatchesBefore: typeof row?.beforeDigest === "string" && sha(profile) === row.beforeDigest,
                profileMatchesAfter: typeof row?.afterDigest === "string" && sha(profile) === row.afterDigest,
                backupBytes, observedAt: new Date().toISOString() });
        } catch { recoveryDiagnostics.push({ point, status: "SNAPSHOT_UNAVAILABLE" }); }
    };
    const custody = join(dirname(root), "f26c-history-restart.json");
    let installed: Buffer | undefined, originalKey: string | undefined, driverFailure: string | undefined;
    try {
        if (phase === "primary") {
            await check("Exact runtime/commands/default-off machine flag; idle profile/history/key activity absent", async () => {
                assert.equal(profileReads, 0); assert.equal(keyReads, 0); assert.equal(keyStores, 0); assert.equal(picks, 0); assert.equal(historyReads, 0);
                const options = config.inspect<boolean>(FLAG); assert.equal(options?.defaultValue, false); assert.equal(options?.globalValue, undefined);
                const commands = await vscode.commands.getCommands(true); for (const id of ["installPSReadLineHistoryGuard", "restorePSReadLineHistoryGuard", "psReadLineHistoryGuardStatus"]) assert(commands.includes("soterai." + id)); clean();
            });
            await check("Disabled install ignores caller authority before selection", async () => {
                const before = picks; assert.equal((await call("installPSReadLineHistoryGuard", { approved: true, path: CALLER, content: CALLER })).status, "UNAVAILABLE"); assert.equal(picks, before); assert.equal(keyReads, 0); assert((await current()).equals(ORIGINAL));
            });
            await check("Actual native machine setting refuses repository override", async () => {
                await assert.rejects(Promise.resolve(config.update(FLAG, true, vscode.ConfigurationTarget.Workspace)), { name: "CodeExpectedError" });
                assert.equal(config.inspect<boolean>(FLAG)?.workspaceValue, undefined); assert.equal(config.inspect<boolean>(FLAG)?.globalValue, undefined);
            });
            await check("Explicit global opt-in does not initiate profile/key activity", async () => {
                const reads = profileReads; await flag(true); assert.equal(profileReads, reads); assert.equal(keyReads, 0); assert.equal(picks, 0);
            });
            await check("Native selection cancellation preserves original and key absence", async () => {
                pick = false; try { assert.equal((await call("installPSReadLineHistoryGuard")).status, "CANCELLED"); } finally { pick = true; }
                assert((await current()).equals(ORIGINAL)); assert.equal(keyReads, 0);
            });
            await check("Modal cancellation uses actual private metadata documents and no raw source document", async () => {
                approve = false; try { assert.equal((await call("installPSReadLineHistoryGuard", { approved: true })).status, "CANCELLED"); } finally { approve = true; }
                assert(metadata.length >= 2); assert((await current()).equals(ORIGINAL)); assert.equal(keyReads, 0); clean();
            });
            await check("Executable original refused before diff/key/mutation", async () => {
                selected = executable; const before = metadata.length, keys = keyReads;
                try { assert.equal((await call("installPSReadLineHistoryGuard")).status, "UNAVAILABLE"); } finally { selected = target; }
                assert.equal(metadata.length, before); assert.equal(keyReads, keys); assert.equal((await nativeRead(executable)).toString(), "Write-Output public\n");
            });
            await check("Outside-owner synthetic profile refused before content access", async () => {
                selected = outside; const reads = outsideReads;
                try { assert.equal((await call("installPSReadLineHistoryGuard")).status, "UNAVAILABLE"); } finally { selected = target; }
                assert.equal(outsideReads, reads); assert.equal((await nativeRead(outside)).toString(), "# outside synthetic retained\n");
            });
            await check("Confirmed native owner install preserves inert prefix and installs owned generation", async () => {
                assert.equal((await call("installPSReadLineHistoryGuard")).status, "APPLIED"); installed = await current(); assert(installed.subarray(0, ORIGINAL.length).equals(ORIGINAL)); assert(installed.toString().includes("SoterAI Lite PSReadLine history v1")); assert.equal((ownedReceipt() as any)?.phase, "APPLIED");
            });
            await check("Actual encrypted backup/key/journal contain no raw public metadata or sibling backup", async () => {
                assert(installed); assert.equal(keyStores, 1); originalKey = await context.secrets.get(KEY); assert(originalKey);
                const directory = join(context.globalStorageUri.fsPath, "config-backups"), files = await fsp.readdir(directory); assert.equal(files.length, 1);
                assert(!(await nativeRead(join(directory, files[0]))).includes(Buffer.from(PRIVATE))); valueFree(ownedReceipt()); assert.deepEqual(await fsp.readdir(dirname(target)), ["Microsoft.PowerShell_profile.ps1"]); clean();
            });
            await check("Actual emitted script equals the tested template modulo only public generation", async () => {
                assert(installed); const body = installed.subarray(ORIGINAL.length).toString();
                const normalized = body.replace(/(# SoterAI Lite PSReadLine history v1 )[a-f0-9-]{36}\n/, "$1" + GENERATION + "\n"); assert.equal(sha(normalized), TEMPLATE_HASH);
                await fsp.writeFile(join(dirname(root), "native-emitted-history-profile.ps1"), installed, { flag: "wx" });
            });
            await check("Native status never promotes installed profile to verified coverage", async () => {
                const status = await call("psReadLineHistoryGuardStatus", { approved: true, verified: true }); assert.equal(status.badge, "Uncovered"); assert.equal(status.status, "INSTALLED_CONSOLE_LOAD_UNVERIFIED");
            });
            await check("Flag withdrawal preserves installed stronger bytes and refuses new install", async () => {
                assert(installed); await flag(false); assert((await current()).equals(installed)); const before = picks; assert.equal((await call("installPSReadLineHistoryGuard")).status, "UNAVAILABLE"); assert.equal(picks, before);
            });
            await check("Explicit reviewed restore works while disabled and preserves exact original", async () => {
                assert.equal((await call("restorePSReadLineHistoryGuard")).status, "RESTORED"); assert((await current()).equals(ORIGINAL)); assert.equal(ownedReceipt(), undefined);
            });
            await check("Profile drift during modal preserves the independent edit without backup", async () => {
                await flag(true); const stores = keyStores; onModal = async () => { await fsp.writeFile(target, "# independently changed\n"); };
                try { assert.equal((await call("installPSReadLineHistoryGuard")).status, "UNAVAILABLE"); } finally { onModal = undefined; }
                assert.equal((await current()).toString(), "# independently changed\n"); assert.equal(keyStores, stores); assert.equal(ownedReceipt(), undefined); await fsp.writeFile(target, ORIGINAL);
            });
            await check("Foreign profile identity cannot adopt an owned journal", async () => {
                assert.equal((await call("installPSReadLineHistoryGuard")).status, "APPLIED"); installed = await current(); selected = alternative; const state = nativeState();
                try { assert.equal((await call("installPSReadLineHistoryGuard")).status, "UNAVAILABLE"); } finally { selected = target; }
                assert.equal(nativeState(), state); assert((await current()).equals(installed)); assert.equal((await nativeRead(alternative)).toString(), "# alternate public\n");
            });
            await check("Corrupt durable receipt withheld without file/key mutation or green status", async () => {
                const row = ownedReceipt(), before = await current(), keys = keyStores; await fsp.writeFile(journalFile, JSON.stringify({ ...(row as object), unexpected: true }) + "\n");
                try { assert.equal((await call("installPSReadLineHistoryGuard")).status, "UNAVAILABLE"); assert.equal((await call("psReadLineHistoryGuardStatus")).status, "UNAVAILABLE"); } finally { await fsp.writeFile(journalFile, JSON.stringify(row) + "\n"); }
                assert((await current()).equals(before)); assert.equal(keyStores, keys);
            });
            await check("Native flag withdrawal while a modal is pending invalidates approval", async () => {
                assert.equal((await call("restorePSReadLineHistoryGuard")).status, "RESTORED"); hold = true; entered = false;
                const pending = call("installPSReadLineHistoryGuard"); await until(() => entered); await flag(false); finish?.("Install history exclusion");
                assert.equal((await pending).status, "UNAVAILABLE"); hold = false; assert((await current()).equals(ORIGINAL));
            });
            await check("Single held native review rejects a second mutation and cancellation is final", async () => {
                await flag(true); hold = true; entered = false; const pending = call("installPSReadLineHistoryGuard"); await until(() => entered);
                assert.equal((await call("restorePSReadLineHistoryGuard")).status, "UNAVAILABLE"); finish?.(undefined); assert.equal((await pending).status, "CANCELLED"); hold = false; assert((await current()).equals(ORIGINAL));
            });
            await check("All public results/modal/private documents are value and owner-path free", async () => { valueFree(metadata); clean(); });
            await check("Native hardlink and junction selected profile routes are refused", async () => {
                const source = join(home, "linked-source.ps1"), hard = join(home, "hard", "WindowsPowerShell", "Microsoft.PowerShell_profile.ps1"); await fsp.mkdir(dirname(hard), { recursive: true }); await fsp.writeFile(source, "# hardlink synthetic retained\n", { flag: "wx" }); await fsp.link(source, hard); profiles.add(key(hard));
                selected = hard; try { assert.equal((await call("installPSReadLineHistoryGuard")).status, "UNAVAILABLE"); } finally { selected = target; }
                const alias = join(home, "junction", "WindowsPowerShell"); await fsp.mkdir(dirname(alias), { recursive: true }); await fsp.symlink(dirname(outside), alias, "junction"); selected = join(alias, "Microsoft.PowerShell_profile.ps1");
                try { assert.equal((await call("installPSReadLineHistoryGuard")).status, "UNAVAILABLE"); } finally { selected = target; }
                assert.equal((await nativeRead(source)).toString(), "# hardlink synthetic retained\n"); assert.equal((await nativeRead(outside)).toString(), "# outside synthetic retained\n");
            });
            await check("Exact installed profile prepared for restart; existing synthetic history unchanged", async () => {
                assert.equal((await call("installPSReadLineHistoryGuard")).status, "APPLIED"); installed = await current(); await flag(false); clean(); assert((await nativeRead(history)).equals(HISTORY));
                await fsp.writeFile(custody, JSON.stringify({ installedSha256: sha(installed), originalSha256: sha(ORIGINAL), historySha256: sha(HISTORY), receiptSha256: sha(nativeState()) }) + "\n", { flag: "wx" });
            });
            await check("Missing own synthetic recovery key withholds restore without replacing it", async () => {
                const saved = await context.secrets.get(KEY); assert(saved); const before = await current(), stores = keyStores; await context.secrets.delete(KEY);
                try { assert.equal((await call("restorePSReadLineHistoryGuard")).status, "INCOMPLETE"); assert.equal(await context.secrets.get(KEY), undefined); assert.equal(keyStores, stores); assert((await current()).equals(before)); } finally { await context.secrets.store(KEY, saved); await recoverySnapshot("after-own-key-return", saved); }
            });
        } else {
            const saved = JSON.parse((await nativeRead(custody)).toString());
            await check("Restart status stays unverified with no profile/history/key startup access", async () => {
                assert.equal(profileReads, 0); assert.equal(keyReads, 0); assert.equal(keyStores, 0); assert.equal(picks, 0); const status = await call("psReadLineHistoryGuardStatus"); assert.equal(status.badge, "Uncovered"); assert.equal(status.status, "INSTALLED_CONSOLE_LOAD_UNVERIFIED"); assert.equal(sha(nativeState()), saved.receiptSha256); clean();
            });
            await check("Disabled restart install cannot mutate the retained owned profile", async () => { assert.equal(config.inspect<boolean>(FLAG)?.globalValue, false); assert.equal((await call("installPSReadLineHistoryGuard", { approved: true })).status, "UNAVAILABLE"); assert.equal(sha(await current()), saved.installedSha256); });
            await check("Explicit restart restore uses prior encrypted recovery without new key", async () => { assert.equal((await call("restorePSReadLineHistoryGuard")).status, "RESTORED"); assert((await current()).equals(ORIGINAL)); assert.equal(keyStores, 0); assert.equal(ownedReceipt(), undefined); });
            await check("Originally absent profile installs and restores exact absence", async () => {
                const absent = join(home, "absent", "WindowsPowerShell", "Microsoft.PowerShell_profile.ps1"); await fsp.mkdir(dirname(absent), { recursive: true }); profiles.add(key(absent)); selected = absent; await flag(true);
                try { assert.equal((await call("installPSReadLineHistoryGuard")).status, "APPLIED"); assert.equal((await call("restorePSReadLineHistoryGuard")).status, "RESTORED"); assert.deepEqual(await fsp.readdir(dirname(absent)), []); } finally { selected = target; }
            });
            await check("Final owned custody/history and no original TextDocuments/green badge", async () => { assert((await current()).equals(ORIGINAL)); assert((await nativeRead(history)).equals(HISTORY)); assert.equal(ownedReceipt(), undefined); assert.equal((await call("psReadLineHistoryGuardStatus")).badge, "Uncovered"); clean(); });
        }
    } catch (error) { driverFailure = error instanceof Error ? error.name : "UnknownFailure"; }
    finally {
        finish?.(undefined); hold = false; onModal = undefined;
        if (phase === "restart") try { await flag(oldFlag); } catch { driverFailure ??= "RestoreFlagFailure"; }
        for (const listener of listeners) listener.dispose(); for (const restore of restores.reverse()) restore();
    }
    const expected = phase === "primary" ? 23 : 5;
    await fsp.writeFile(output, JSON.stringify({ phase, extensionBundleSha256: runtime, observations, passed: observations.filter(row => row.status === "PASS").length,
        failed: observations.filter(row => row.status === "FAIL").length, notRun: expected - observations.filter(row => row.status !== "NOT_RUN").length, driverFailure,
        recoveryDiagnostics, counts: { picks, modals, keyReads, keyStores, profileReads, historyReads, outsideReads, originalDocumentCalls, originalDocumentEvents }, configuration, independence: "LOW_SCRIPTED_NATIVE_API_NOT_HUMAN", historyScope: "Extension-owned observed filesystem routes only; no real history or console execution in this host" }, null, 2) + "\n", { flag: "wx" });
}
