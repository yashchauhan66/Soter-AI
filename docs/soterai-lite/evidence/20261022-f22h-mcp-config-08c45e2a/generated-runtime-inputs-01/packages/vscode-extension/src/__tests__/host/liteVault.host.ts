/** F06: registered packaged vault commands and real SecretStorage APIs in a
 * persistent isolated synthetic developer host. Scripted owner decisions: LOW.
 */
import * as vscode from "vscode";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { chmod, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";

const FLAG = "lite.vaultMode", KEY_ID = "soterai.vaultKey", RULES_KEY = "soterai.aiForbidden.v1";
const MARKER = ".synthetic-lite-f06-host", RECEIPT = ".lite-f06-save-receipt.json";
const URL = "postgresql://fake:synthetic-only@f06-native.invalid/quoted-database";
const CRASH_URL = "postgresql://fake:synthetic-only@f06-crash.invalid/quoted-database";
const API = "sk-proj-" + "SYNTHETIC_F06_NATIVE_FAKE_CREDENTIAL".repeat(3);
const PRIVATE = "SYNTHETIC_F06_NATIVE_MULTILINE_PRIVATE_VALUE_20261014";
const SOURCE = `DATABASE_URL = '${URL}'\r\nAPI_KEY=${API}\r\nTOKEN="first\r\n${PRIVATE}=inside-value\r\nlast"\r\n`;
const CRASH_SOURCE = SOURCE.replace(URL, CRASH_URL);
const SAFE = "DATABASE_URL=[MASKED]\nAPI_KEY=[MASKED]\nTOKEN=[MASKED]";
const sha = (bytes: string | Uint8Array) => createHash("sha256").update(bytes).digest("hex");
type Observation = { id: string; status: "NOT_RUN" | "PASS" | "FAIL"; scope: string; diagnostic?: string };
type ReadResult = { status: string; kind?: string; text?: string };
type Pending = { schemaVersion: number; id: string; source: string; root: string; digest: string };
const restores: Array<() => void> = [], listeners: vscode.Disposable[] = [];
let setupPatch: Record<string, unknown> = { phase: "initial" };
export function setupDiagnostic(): Record<string, unknown> { return { ...setupPatch }; }
const reviews: Array<{ action: string; modal: boolean; detailBytes: number; detailSafe: boolean }> = [];
const messages: Array<{ surface: string; safe: boolean }> = [];
let hookedContext: vscode.ExtensionContext | undefined, installed = false;
let migrationApproval = true, recoveryApproval = true, rawApproval = true;
let secretStores = 0, secretGets = 0, restoredCanonicalKeyObserved = false;
let sourceDocumentCalls = 0, sourceDocumentEvents = 0;

function noValues(text: string): void {
    for (const value of [SOURCE, CRASH_SOURCE, URL, CRASH_URL, API, PRIVATE]) assert.ok(!text.includes(value), "Original synthetic values must remain outside metadata and safe-read sinks.");
}
function within(base: string, target: string): boolean {
    const result = relative(resolve(base), resolve(target)); return result === "" || !result.startsWith("..") && !isAbsolute(result);
}
function folder(): vscode.WorkspaceFolder { const value = vscode.workspace.workspaceFolders?.[0]; assert.ok(value); return value; }
function sourceUri(name: ".env.host" | ".env.crash" = ".env.host"): vscode.Uri { return vscode.Uri.joinPath(folder().uri, name); }
function isSource(value: unknown): boolean {
    return value instanceof vscode.Uri && [sourceUri().toString(), sourceUri(".env.crash").toString()].includes(value.toString());
}
function replace(target: object, name: string, value: unknown): void {
    const own = Object.getOwnPropertyDescriptor(target, name);
    setupPatch = { phase: "replace", name, frozen: Object.isFrozen(target), extensible: Object.isExtensible(target),
        own: !!own, configurable: own?.configurable, writable: own && "writable" in own ? own.writable : undefined };
    Object.defineProperty(target, name, { configurable: true, enumerable: own?.enumerable ?? false, writable: true, value });
    restores.push(() => { if (own) Object.defineProperty(target, name, own); else Reflect.deleteProperty(target, name); });
}
async function files(directory: string, storageRoot: string): Promise<string[]> {
    assert.ok(within(storageRoot, directory)); const result: string[] = [];
    for (const entry of await readdir(directory, { withFileTypes: true }).catch(error => { if (error.code === "ENOENT") return []; throw error; })) {
        const target = join(directory, entry.name);
        if (entry.isDirectory()) result.push(...await files(target, storageRoot)); else if (entry.isFile()) result.push(target);
    }
    return result;
}
async function vaultSnapshot(storage: string): Promise<Record<string, string>> {
    const managed = (await files(storage, storage)).filter(file => /^vault-|^soterai-vault\./.test(basename(file)) && !/lock/i.test(basename(file)));
    return Object.fromEntries(await Promise.all(managed.map(async file => [relative(storage, file), sha(await readFile(file))])));
}
function noSourceDocuments(): void {
    assert.equal(sourceDocumentCalls, 0); assert.equal(sourceDocumentEvents, 0);
    assert.equal(vscode.workspace.textDocuments.filter(document => isSource(document.uri)).length, 0);
}

/** Called before actual.activate(context); delegates every captured API to its
 * native implementation, except explicit scripted review/fault responses.
 */
export function beforeActivate(context: vscode.ExtensionContext): void {
    assert.equal(installed, false); installed = true; hookedContext = context;
    const profile = process.env.SOTERAI_LITE_F06_PROFILE;
    assert.ok(profile && isAbsolute(profile)); assert.equal(resolve(process.env.USERPROFILE ?? ""), resolve(profile));
    assert.equal(vscode.workspace.workspaceFolders?.length, 1); assert.equal(folder().uri.scheme, "file");
    assert.match(resolve(folder().uri.fsPath), /^D:\\/i); assert.match(resolve(profile), /^D:\\/i);
    assert.equal(readFileSync(join(folder().uri.fsPath, MARKER), "utf8"), "synthetic-only-v1");
    assert.ok(!within(folder().uri.fsPath, context.globalStorageUri.fsPath));
    assert.ok(within(profile, context.globalStorageUri.fsPath), "Global extension storage must stay in the launcher-owned isolated profile.");
    const nativeGet = context.secrets.get, nativeStore = context.secrets.store;
    replace(context.secrets, "get", async (key: string) => {
        const value = await nativeGet.call(context.secrets, key);
        if (key === KEY_ID) {
            secretGets++;
            if (value !== undefined) {
                assert.match(value, /^[A-Za-z0-9+/]{43}=$/); assert.equal(Buffer.from(value, "base64").length, 32);
                assert.equal(Buffer.from(value, "base64").toString("base64"), value); restoredCanonicalKeyObserved = true;
            }
        }
        return value;
    });
    replace(context.secrets, "store", async (key: string, value: string) => {
        if (key === KEY_ID) { secretStores++; assert.match(value, /^[A-Za-z0-9+/]{43}=$/); assert.equal(Buffer.from(value, "base64").length, 32); }
        return nativeStore.call(context.secrets, key, value);
    });
    const nativeOpen = vscode.workspace.openTextDocument;
    replace(vscode.workspace, "openTextDocument", (...args: unknown[]) => {
        if (isSource(args[0])) sourceDocumentCalls++;
        return Reflect.apply(nativeOpen as (...args: unknown[]) => unknown, vscode.workspace, args);
    });
    listeners.push(vscode.workspace.onDidOpenTextDocument(document => { if (isSource(document.uri)) sourceDocumentEvents++; }));
    replace(vscode.window, "showWarningMessage", async (message: string, ...items: unknown[]) => {
        noValues(message); const options = items[0] as vscode.MessageOptions;
        if (options?.detail) noValues(options.detail);
        const action = items.find(item => ["Migrate securely", "Complete safe recovery", "Restore raw values", "Allow safe read once"].includes(item as string));
        if (typeof action !== "string") { messages.push({ surface: "warning", safe: true }); return undefined; }
        reviews.push({ action, modal: options?.modal === true, detailBytes: Buffer.byteLength(options?.detail ?? "", "utf8"), detailSafe: true });
        assert.equal(options?.modal, true);
        if (action === "Migrate securely") return migrationApproval ? action : undefined;
        if (action === "Complete safe recovery") return recoveryApproval ? action : undefined;
        if (action === "Restore raw values") return rawApproval ? action : undefined;
        return action;
    });
    for (const name of ["showInformationMessage", "showErrorMessage"]) replace(vscode.window, name, async (message: string) => {
        noValues(message); messages.push({ surface: name, safe: true }); return undefined;
    });
}

export async function run(context: vscode.ExtensionContext): Promise<void> {
    const phase = process.env.SOTERAI_LITE_F06_PHASE, output = process.env.SOTERAI_LITE_F06_EVIDENCE, profile = process.env.SOTERAI_LITE_F06_PROFILE;
    if (!output || !isAbsolute(output)) throw new Error("New absolute F06 evidence output required.");
    const scopes = phase === "reload" ? [
        ["F06-H07", "Native restart retains genuine pending checkpoint and verified SecretStorage key; registered recovery completes the masked crash file."],
        ["F06-H08", "Fresh explicit raw-disclosure approval restores the bound original backup and quoted multiline placeholder content byte for byte."],
        ["F06-H09", "Machine withdrawal withholds every registered vault mutation and preserves source bytes and existing ciphertext."],
        ["F06-H10", "Persistent sensitive restrictions survive restart and raw restoration; managed safe reads still mask every value without original TextDocuments."],
    ] : [
        ["F06-H01", "Native manager-owned cancellation creates no vault data, key or changed source file."],
        ["F06-H02", "Actual registered migration replaces quoted database, API and multiline values on disk after native metadata review."],
        ["F06-H03", "Safe example has blank unique names; actual native encrypted vault and issued generation remain outside the project."],
        ["F06-H04", "Managed safe-reader output remains names-only and masked after optional migration."],
        ["F06-H05", "Raw-restore cancellation retains source placeholders and ciphertext with no disclosure."],
        ["F06-H06", "A real native source-write fault leaves an issued encrypted pending checkpoint and original source intact for native restart."],
    ];
    const observations: Observation[] = scopes.map(([id, scope]) => ({ id, scope, status: "NOT_RUN" }));
    const evidence: Record<string, unknown> = {}, commandStatuses: Array<{ command: string; reportedStatus: unknown; completed: boolean }> = [];
    let runtime = "", bundle = "", root = "", storage = "", driverFailure: string | undefined, stage = "setup";
    let config: vscode.WorkspaceConfiguration | undefined, oldFlag: boolean | undefined;
    const check = async (id: string, action: () => Promise<void>) => {
        const row = observations.find(item => item.id === id)!; stage = id;
        try { await action(); row.status = "PASS"; }
        catch (error) { row.status = "FAIL"; row.diagnostic = `${error instanceof Error ? error.name : "UnknownFailure"} at ${stage}`; }
        console.log(`LITE_VAULT_HOST ${phase} ${id} ${row.status}`);
    };
    try {
        assert.equal(hookedContext, context); assert.ok(installed); assert.ok(phase === "save" || phase === "reload");
        assert.ok(profile && isAbsolute(profile)); assert.equal(resolve(process.env.USERPROFILE ?? ""), resolve(profile));
        assert.equal(process.env.SOTERAI_LITE_F06_DRIVER_KIND, "native-bootstrap");
        assert.equal(context.extensionMode, vscode.ExtensionMode.Development); assert.ok(vscode.workspace.isTrusted);
        root = folder().uri.fsPath; storage = context.globalStorageUri.fsPath;
        assert.equal(await readFile(join(root, MARKER), "utf8"), "synthetic-only-v1");
        const extension = vscode.extensions.getExtension("soterai.soterai-ide-guard"); assert.ok(extension && extension.isActive);
        bundle = join(extension.extensionPath, "dist", "extension.js"); runtime = sha(await readFile(bundle)); assert.equal(runtime, process.env.SOTERAI_LITE_F06_BUNDLE_SHA256);
        config = vscode.workspace.getConfiguration("soterai"); oldFlag = config.inspect<boolean>(FLAG)?.globalValue;
        const command = async (id: string, target = sourceUri()) => {
            const current = vscode.workspace.getConfiguration("soterai"), inspected = current.inspect<boolean>(FLAG);
            evidence.nativeGuardMetadata = { trusted: vscode.workspace.isTrusted, flagGet: current.get<boolean>(FLAG),
                flagDefault: inspected?.defaultValue, flagGlobal: inspected?.globalValue, globalStorageScheme: context.globalStorageUri.scheme,
                storageAuthorityPresent: !!context.globalStorageUri.authority, storageQueryPresent: !!context.globalStorageUri.query,
                storageFragmentPresent: !!context.globalStorageUri.fragment };
            const result = await vscode.commands.executeCommand<{ status?: unknown } | undefined>(id, target);
            commandStatuses.push({ command: id, reportedStatus: result?.status ?? "VOID", completed: true }); return result;
        };
        const readSafely = async (target = sourceUri()) => {
            const result = await vscode.commands.executeCommand<ReadResult>("soterai.readProjectFileSafely", target);
            commandStatuses.push({ command: "soterai.readProjectFileSafely", reportedStatus: result.status, completed: true });
            assert.equal(result.status, "ALLOWED_ONCE"); assert.equal(result.kind, "environment-schema"); assert.equal(result.text, SAFE); noValues(result.text!); noSourceDocuments();
        };
        const blankExample = async () => {
            const text = await readFile(join(root, ".env.example"), "utf8"); noValues(text);
            assert.equal(text, "DATABASE_URL=\nAPI_KEY=\nTOKEN=\n"); return sha(text);
        };
        const encryptedStorage = async () => {
            const managed = await vaultSnapshot(storage); assert.ok(Object.keys(managed).some(name => basename(name) === "soterai-vault.enc"));
            assert.ok(Object.keys(managed).some(name => /^vault-generation-.+\.enc$/.test(basename(name))));
            for (const file of await files(storage, storage)) noValues((await readFile(file)).toString("utf8"));
            return managed;
        };
        const pending = async (): Promise<Pending> => {
            const text = await readFile(join(storage, "vault-pending.json"), "utf8"); noValues(text); const value = JSON.parse(text) as Pending;
            assert.equal(value.schemaVersion, 1); assert.equal(value.source, sourceUri(".env.crash").toString()); assert.equal(value.root, folder().uri.toString());
            assert.match(value.id, /^[a-f0-9-]{36}$/i); assert.match(value.digest, /^[a-f0-9]{64}$/);
            const encrypted = await readFile(join(storage, `vault-generation-${value.id}.enc`)); assert.equal(sha(encrypted), value.digest); noValues(encrypted.toString("utf8")); return value;
        };
        const restrictionMetadata = () => {
            const stored = context.workspaceState.get<Record<string, unknown>>(RULES_KEY, {})[folder().uri.toString()] as { manual?: { paths?: Array<{ pattern: string; sensitive?: boolean }> }; paths?: Array<{ pattern: string; sensitive?: boolean }> };
            assert.ok(stored); const paths = stored.manual?.paths ?? stored.paths ?? [];
            for (const name of [".env.host", ".env.crash"]) assert.ok(paths.some(rule => rule.pattern === name && rule.sensitive === true), "Actual saved sensitive restrictions must remain.");
            noValues(JSON.stringify(stored)); return sha(JSON.stringify(paths));
        };
        if (phase === "save") {
            await config.update(FLAG, true, vscode.ConfigurationTarget.Global);
            await writeFile(sourceUri().fsPath, SOURCE, { flag: "wx" }); await writeFile(sourceUri(".env.crash").fsPath, CRASH_SOURCE, { flag: "wx" });
            await check("F06-H01", async () => {
                const before = await vaultSnapshot(storage), beforeStores = secretStores; migrationApproval = false;
                await command("soterai.migrateSecretsToVault"); migrationApproval = true;
                assert.ok((await readFile(sourceUri().fsPath, "utf8")) === SOURCE); assert.deepEqual(await vaultSnapshot(storage), before); assert.equal(secretStores, beforeStores);
                assert.ok(reviews.some(review => review.action === "Migrate securely")); noSourceDocuments(); evidence.cancelledWithoutWrites = true;
            });
            await check("F06-H02", async () => {
                await command("soterai.migrateSecretsToVault"); const masked = await readFile(sourceUri().fsPath, "utf8"); noValues(masked);
                assert.match(masked, /\[SOTERAI_PROTECTED_[A-Z0-9_]+\]/); assert.ok(secretStores > 0 && secretGets >= 2 && restoredCanonicalKeyObserved);
                evidence.migratedSourceDigest = sha(masked); evidence.actualVerifiedSecretStorageUse = true; noSourceDocuments();
            });
            await check("F06-H03", async () => {
                evidence.exampleDigest = await blankExample(); evidence.encryptedVaultAndGenerationDigests = await encryptedStorage();
                assert.ok(!within(root, storage)); const projectNames = await readdir(root); assert.ok(!projectNames.some(name => /\.bak$|backup|vault-generation|soterai-vault\.enc/i.test(name)));
                noSourceDocuments();
            });
            await check("F06-H04", async () => { await readSafely(); evidence.maskedManagedReaderAfterMigration = true; });
            await check("F06-H05", async () => {
                const sourceBefore = await readFile(sourceUri().fsPath), before = await vaultSnapshot(storage); rawApproval = false;
                await command("soterai.restoreSecretPlaceholders"); await command("soterai.restoreFileFromBackup"); rawApproval = true;
                assert.equal(sha(await readFile(sourceUri().fsPath)), sha(sourceBefore)); assert.deepEqual(await vaultSnapshot(storage), before);
                assert.ok(reviews.filter(review => review.action === "Restore raw values").length >= 2); noSourceDocuments();
            });
            await check("F06-H06", async () => {
                const errorsBefore = messages.filter(message => message.surface === "showErrorMessage").length;
                const crash = sourceUri(".env.crash"); await chmod(crash.fsPath, 0o444);
                try {
                    assert.equal((await stat(crash.fsPath)).mode & 0o200, 0, "Owned synthetic source must actually be read-only.");
                    await command("soterai.migrateSecretsToVault", crash);
                } finally { await chmod(crash.fsPath, 0o600); }
                assert.ok(messages.filter(message => message.surface === "showErrorMessage").length > errorsBefore);
                assert.ok((await readFile(sourceUri(".env.crash").fsPath, "utf8")) === CRASH_SOURCE);
                const issued = await pending(); const policyDigest = restrictionMetadata(); await encryptedStorage(); await blankExample(); noSourceDocuments();
                const receipt = { schemaVersion: 1, runtime, profile: resolve(profile), workspace: root, globalStorage: storage,
                    sourceMaskedDigest: sha(await readFile(sourceUri().fsPath)), crashOriginalDigest: sha(CRASH_SOURCE),
                    pendingDigest: sha(await readFile(join(storage, "vault-pending.json"))), generationId: issued.id, generationCiphertextDigest: issued.digest,
                    restrictionPathDigest: policyDigest, vaultModeGlobalValue: vscode.workspace.getConfiguration("soterai").inspect<boolean>(FLAG)?.globalValue };
                await writeFile(join(root, RECEIPT), JSON.stringify(receipt) + "\n", { flag: "wx" });
                evidence.genuinePendingCheckpointRetained = true; evidence.actualReadOnlySourceFailure = true;
                evidence.pendingGenerationId = issued.id; evidence.pendingCiphertextDigest = issued.digest;
            });
        } else {
            await check("F06-H07", async () => {
                const receipt = JSON.parse(await readFile(join(root, RECEIPT), "utf8")); noValues(JSON.stringify(receipt));
                assert.equal(receipt.runtime, runtime); assert.equal(receipt.profile, resolve(profile)); assert.equal(receipt.workspace, root); assert.equal(receipt.globalStorage, storage);
                assert.equal(vscode.workspace.getConfiguration("soterai").inspect<boolean>(FLAG)?.globalValue, receipt.vaultModeGlobalValue);
                assert.equal(sha(await readFile(join(storage, "vault-pending.json"))), receipt.pendingDigest); const issued = await pending();
                assert.equal(issued.id, receipt.generationId); assert.equal(issued.digest, receipt.generationCiphertextDigest);
                assert.equal(sha(await readFile(sourceUri().fsPath)), receipt.sourceMaskedDigest); assert.equal(sha(await readFile(sourceUri(".env.crash").fsPath)), receipt.crashOriginalDigest);
                assert.equal(restrictionMetadata(), receipt.restrictionPathDigest);
                const key = await context.secrets.get(KEY_ID); assert.ok(key); assert.ok(restoredCanonicalKeyObserved); assert.equal(secretStores, 0);
                await command("soterai.recoverVaultMigration", sourceUri(".env.crash"));
                noValues(await readFile(sourceUri(".env.crash").fsPath, "utf8")); await assert.rejects(readFile(join(storage, "vault-pending.json")));
                await blankExample(); await encryptedStorage(); await readSafely(sourceUri(".env.crash")); noSourceDocuments();
                evidence.realRestartCheckpointCompleted = true; evidence.existingNativeSecretStorageKeyRestored = true;
            });
            await check("F06-H08", async () => {
                rawApproval = true; await command("soterai.restoreFileFromBackup"); await command("soterai.restoreSecretPlaceholders", sourceUri(".env.crash"));
                assert.ok((await readFile(sourceUri().fsPath, "utf8")) === SOURCE, "Bound backup restoration must preserve exact original quoting and multiline bytes.");
                assert.ok((await readFile(sourceUri(".env.crash").fsPath, "utf8")) === CRASH_SOURCE, "Placeholder restoration must preserve exact original quoting and multiline bytes.");
                assert.ok(reviews.filter(review => review.action === "Restore raw values").length >= 2); await encryptedStorage(); noSourceDocuments();
                evidence.explicitBoundBackupOriginalBytesMatched = true; evidence.explicitPlaceholderOriginalBytesMatched = true;
            });
            await check("F06-H09", async () => {
                const before = await vaultSnapshot(storage), hostBefore = sha(await readFile(sourceUri().fsPath)), crashBefore = sha(await readFile(sourceUri(".env.crash").fsPath));
                const beforeReviews = reviews.length; await config!.update(FLAG, false, vscode.ConfigurationTarget.Global);
                for (const id of ["soterai.migrateSecretsToVault", "soterai.recoverVaultMigration", "soterai.restoreSecretPlaceholders", "soterai.restoreFileFromBackup"]) await command(id);
                assert.equal(reviews.length, beforeReviews); assert.deepEqual(await vaultSnapshot(storage), before);
                assert.equal(sha(await readFile(sourceUri().fsPath)), hostBefore); assert.equal(sha(await readFile(sourceUri(".env.crash").fsPath)), crashBefore);
                restrictionMetadata(); noSourceDocuments(); evidence.machineWithdrawalWithheldVaultCommands = true;
            });
            await check("F06-H10", async () => {
                const before = restrictionMetadata(); await readSafely(); await readSafely(sourceUri(".env.crash")); assert.equal(restrictionMetadata(), before);
                assert.ok((await readFile(sourceUri().fsPath, "utf8")) === SOURCE); noSourceDocuments();
                assert.ok(context.storageUri); const database = await stat(join(dirname(context.storageUri.fsPath), "state.vscdb")); assert.ok(database.isFile() && database.size > 0);
                evidence.actualPersistentRestrictionMetadataPresent = true; evidence.rawRestoredSourceStillNamesOnlyForManagedReader = true;
            });
        }
    } catch (error) { driverFailure = `${error instanceof Error ? error.name : "UnknownFailure"} at ${stage}`; }
    finally {
        if (config && (phase === "reload" || driverFailure || observations.some(row => row.status !== "PASS"))) {
            try { await config.update(FLAG, oldFlag, vscode.ConfigurationTarget.Global); } catch { driverFailure ??= "IsolatedFlagRestorationFailure"; }
        }
        for (const listener of listeners.splice(0)) listener.dispose();
        for (const restore of restores.reverse()) { try { restore(); } catch { driverFailure ??= "PatchRestorationFailure"; } }
    }
    let currentRuntime: string | undefined, hostProbeSha256: string | undefined;
    try { if (bundle) currentRuntime = sha(await readFile(bundle)); hostProbeSha256 = sha(await readFile(__filename)); } catch { driverFailure ??= "IdentityReadFailure"; }
    const result = { schemaVersion: 1, observedAt: new Date().toISOString(), phase, syntheticOnly: true, workspace: root,
        declaredProfilePath: profile ? resolve(profile) : undefined, hostVersion: vscode.version, extensionMode: "Development",
        extensionBundleSha256: runtime, currentDeveloperBundleSha256: currentRuntime, hostProbeSha256,
        observations, evidence, driverFailure, commandStatuses, sourceDocumentCalls, sourceDocumentEvents,
        nativeSecretStorageStores: secretStores, nativeSecretStorageGets: secretGets, restoredCanonicalKeyObserved,
        nativeFaultKind: "Owned synthetic Windows read-only source file", scriptedNativeReviews: reviews, safeMessageCounts: messages,
        passed: observations.filter(row => row.status === "PASS").length,
        failed: observations.filter(row => row.status === "FAIL").length + (driverFailure ? 1 : 0), notRun: observations.filter(row => row.status === "NOT_RUN").length,
        genuinePendingCheckpointRetainedForRestart: phase === "save" && observations.every(row => row.status === "PASS"),
        identityScope: "Byte-identical packaged runtime and actual registered commands in an isolated persistent native developer context; not clean-profile installed-VSIX proof.",
        recoveryScope: "Actual native workspace source-write failure followed by native process restart and registered completion of the issued encrypted checkpoint; no reconstructed backup or plaintext fallback.",
        custodyScope: "Real isolated SecretStorage store/get/readback API observations only; no independent OS custody certification.",
        interactionScope: "Native modal API arguments with scripted same-instance decisions; no rendered modal usability or independent human-presence proof.",
        independence: "LOW", ownerPresence: "SCRIPTED_SAME_EXTENSION_API_INSTANCE", externalAgents: "NOT_TESTED" };
    await writeFile(output, JSON.stringify(result, null, 2) + "\n", { flag: "wx" });
    if (result.failed || result.notRun || currentRuntime !== runtime) throw new Error("F06 native host failed or incomplete; inspect retained observation IDs.");
}
