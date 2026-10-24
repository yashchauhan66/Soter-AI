import "./phase2/register.mjs";
import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import type { Uri as NativeUri } from "vscode";
import { buildVaultMetadata, encryptVault, extractVaultCandidates, generateVaultKey } from "@soterai/guard-core";
import * as stub from "./phase2/vscode-stub";
import { BoundarySnapshot, initializeBoundaryState } from "../ai-boundary/BoundarySnapshot";
import { MASKED } from "../project-privacy/SafeFileView";
import { VaultManager } from "../firewall/VaultManager";
import { VaultStorage } from "../firewall/VaultStorage";

// Only synthetic project files, independent extension storage, and in-memory
// SecretStorage are used. Actual VaultManager methods own every native approval.
const FLAG = "soterai.lite.vaultMode", KEY_ID = "soterai.vaultKey";
const COMMENT = "SYNTHETIC_F06_PRIVATE_COMMENT_NOT_AN_EXAMPLE";
const URL = "postgresql://fake:synthetic-only@f06.invalid/private-db";
const URL2 = "postgresql://fake:synthetic-only@f06-second.invalid/duplicate-db";
const API = "sk-proj-" + "SYNTHETIC_F06_FAKE_CREDENTIAL".repeat(3);
const MULTI = "SYNTHETIC_F06_MULTILINE_PRIVATE_VALUE";
const SIMPLE = `DATABASE_URL=${URL}\nAPI_KEY=${API}\n`;
const SOURCE = `# ${COMMENT}\r\nDATABASE_URL='${URL}'\r\nAPI_KEY=${API}\r\nDATABASE_URL=${URL2}\r\nMULTI="first\r\n${MULTI}=inside-value\r\nlast"\r\nPORT=8080\r\nEMPTY=\r\n`;
type ManagerWithRecovery = VaultManager & { recoverMigration(uri: stub.Uri): Promise<boolean> };
type FixtureUri = stub.Uri & NativeUri;
let container: string, root: string, storage: string, context: ReturnType<typeof stub.makeExtensionContext>, manager: VaultManager;
let ownerApproval: boolean, prompts: Array<{ message: string; options: unknown; actions: unknown[] }>;
let confirmation: ((message: string, actions: unknown[]) => Promise<string | undefined>) | undefined;
let sourceWrites: string[], textDocumentCalls: number;
const windowOriginals = Object.getOwnPropertyDescriptors(stub.window);
const workspaceOriginals = Object.getOwnPropertyDescriptors(stub.workspace);
const uri = (relative = ".env"): FixtureUri => stub.Uri.file(join(root, relative)) as FixtureUri;
const sha = (bytes: string | Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const noValues = (text: string) => { for (const value of [COMMENT, URL, URL2, API, MULTI]) assert.ok(!text.includes(value), "Raw synthetic values must not appear in this safe sink."); };
const noUiValues = () => { for (const sink of stub.sinks) if (sink.sink !== "fs.writeFile" && sink.sink !== "secretStorage") noValues(sink.text); };
async function write(relative: string, text: string | Uint8Array): Promise<void> { await mkdir(dirname(join(root, relative)), { recursive: true }); await writeFile(join(root, relative), text); }
async function files(directory: string): Promise<string[]> {
    assert.ok(resolve(directory).startsWith(resolve(container)));
    const result: string[] = [];
    for (const entry of await readdir(directory, { withFileTypes: true }).catch(() => [])) {
        const target = join(directory, entry.name);
        if (entry.isDirectory()) result.push(...await files(target)); else if (entry.isFile()) result.push(target);
    }
    return result;
}
async function snapshot(directory: string): Promise<Record<string, string>> {
    return Object.fromEntries(await Promise.all((await files(directory)).map(async file => [file.slice(directory.length), sha(await readFile(file))])));
}
async function withheld<T>(operation: () => Promise<T>): Promise<void> {
    let value: T | undefined, failed = false;
    try { value = await operation(); } catch (error) {
        if (error instanceof assert.AssertionError) throw error;
        failed = true;
    }
    assert.ok(failed || value === false || value === 0, "Unavailable mutation must throw or return an explicit no-change result.");
}
async function recover(actual = manager, target = uri()): Promise<boolean> {
    const method = (actual as ManagerWithRecovery).recoverMigration;
    assert.equal(typeof method, "function", "VaultManager must expose safe checkpoint completion."); return method.call(actual, target);
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
async function assertEncryptedStorage(): Promise<void> {
    const stored = await files(storage); assert.ok(stored.length > 0);
    for (const file of stored) noValues((await readFile(file)).toString("utf8"));
    noValues(JSON.stringify([...context._inspect.workspaceStore])); noValues(JSON.stringify([...context._inspect.globalStore]));
}
function assertBlankExample(text: string): void {
    noValues(text); const lines = text.trimEnd().split(/\r?\n/);
    assert.ok(lines.length > 0 && lines.every(line => /^[A-Za-z_][A-Za-z0-9_]*=$/.test(line)), "Examples contain unique names and empty values only.");
    assert.equal(new Set(lines).size, lines.length); assert.ok(!text.includes(MULTI));
}
async function failSourceWrite(): Promise<void> {
    const original = stub.workspace.fs.writeFile.bind(stub.workspace.fs);
    mock.method(stub.workspace.fs, "writeFile", async (target: stub.Uri, bytes: Uint8Array) => {
        if (target.toString() === uri().toString()) throw new Error("SYNTHETIC_F06_SOURCE_WRITE_FAILURE");
        return original(target, bytes);
    });
    await assert.rejects(manager.migrate(uri()));
}

beforeEach(async () => {
    container = await mkdtemp(join(tmpdir(), "soterai-f06-vault-manager-")); root = join(container, "project"); storage = join(container, "global-storage");
    await mkdir(root); await mkdir(storage); stub.resetState(root); context = stub.makeExtensionContext(root);
    context.globalStorageUri = stub.Uri.file(storage); context.storageUri = stub.Uri.file(join(container, "workspace-storage"));
    initializeBoundaryState(context.workspaceState as never); await BoundarySnapshot.load();
    manager = new VaultManager(context as never); ownerApproval = true; prompts = []; confirmation = undefined; sourceWrites = []; textDocumentCalls = 0;
    Object.assign(stub.window, {
        showWarningMessage: async (message: string, ...args: unknown[]) => {
            prompts.push({ message, options: args[0], actions: args.slice(1) }); stub.recordSink("native-vault-review", "metadata", JSON.stringify({ message, options: args[0] }));
            if (confirmation) return confirmation(message, args);
            return ownerApproval ? args.find(action => ["Migrate securely", "Complete safe recovery", "Restore raw values"].includes(action as string)) : undefined;
        },
    });
    const originalWrite = stub.workspace.fs.writeFile.bind(stub.workspace.fs);
    mock.method(stub.workspace.fs, "writeFile", async (target: stub.Uri, bytes: Uint8Array) => {
        sourceWrites.push(target.toString()); return originalWrite(target, bytes);
    });
    Object.assign(stub.workspace, { openTextDocument: async () => { textDocumentCalls++; throw new Error("Vault mutation must not create an original TextDocument."); } });
    await write(".env", SIMPLE); stub.resetSinks();
});

afterEach(async () => {
    context.subscriptions.forEach(item => item.dispose()); mock.restoreAll();
    for (const name of Object.keys(stub.window)) if (!(name in windowOriginals)) delete (stub.window as unknown as Record<string, unknown>)[name];
    for (const name of Object.keys(stub.workspace)) if (!(name in workspaceOriginals)) delete (stub.workspace as unknown as Record<string, unknown>)[name];
    Object.defineProperties(stub.window, windowOriginals); Object.defineProperties(stub.workspace, workspaceOriginals);
    const target = resolve(container); assert.equal(dirname(target), resolve(tmpdir())); assert.ok(basename(target).startsWith("soterai-f06-vault-manager-"));
    await rm(target, { recursive: true, force: true });
});

test("F06-V01 preview uses a constant mask with no value fragments, lengths or hashes", async () => {
    const preview = await manager.preview(uri()); assert.ok(preview.candidates.length >= 2);
    for (const candidate of preview.candidates) {
        assert.equal(candidate.redactedPreview, MASKED); assert.deepEqual(Object.keys(candidate).sort(), ["key", "placeholder", "redactedPreview", "type"]);
    }
    noValues(JSON.stringify(preview)); assert.deepEqual(await snapshot(storage), {}); assert.equal(textDocumentCalls, 0);
});

test("F06-V02 reviewed migration handles duplicate/multiline fields, writes blank examples and keeps recovery encrypted outside the project", async () => {
    await write(".env", SOURCE); const preview = await manager.preview(uri()), migrated = await manager.migrate(uri());
    assert.ok(migrated >= 4); assert.equal(migrated, preview.candidates.length);
    assert.ok(prompts.some(prompt => (prompt.options as { modal?: boolean })?.modal === true && prompt.actions.includes("Migrate securely")));
    const masked = await readFile(uri().fsPath, "utf8"); for (const value of [URL, URL2, API, MULTI]) assert.ok(!masked.includes(value));
    const placeholders = await manager.knownPlaceholders(); assert.equal(new Set(placeholders).size, migrated); assert.ok(placeholders.every(value => masked.includes(value)));
    assertBlankExample(await readFile(uri(".env.example").fsPath, "utf8"));
    assert.equal((await files(root)).length, 2); assert.ok((await files(storage)).length >= 2); await assertEncryptedStorage();
    const status = await manager.status(); assert.equal(status.entryCount, migrated); noValues(JSON.stringify(status));
    assert.equal(textDocumentCalls, 0); noUiValues();
});

test("F06-V03 declining manager-owned native migration writes nothing", async () => {
    ownerApproval = false; const before = await snapshot(root); assert.equal(await manager.migrate(uri()), 0);
    assert.deepEqual(await snapshot(root), before); assert.deepEqual(await snapshot(storage), {}); assert.equal(context._inspect.secretStore.size, 0);
    assert.equal(sourceWrites.length, 0); assert.equal(prompts.length, 1); noValues(stub.capturedText());
});

test("F06-V04 SecretStorage store failure or failed readback never removes original values", async () => {
    for (const fault of ["store", "readback"] as const) {
        context._inspect.secretStore.clear();
        const originalStore = context.secrets.store.bind(context.secrets), originalGet = context.secrets.get.bind(context.secrets);
        const store = mock.method(context.secrets, "store", async (key: string, value: string) => {
            if (fault === "store") throw new Error("SYNTHETIC_F06_SECRET_STORAGE_UNAVAILABLE"); return originalStore(key, value);
        });
        let stored = false;
        const get = mock.method(context.secrets, "get", async (key: string) => {
            const value = await originalGet(key); if (fault === "readback" && value) { stored = true; return "A".repeat(43) + "="; } return value;
        });
        try {
            await withheld(() => manager.migrate(uri())); assert.ok((await readFile(uri().fsPath, "utf8")) === SIMPLE);
            assert.equal(sourceWrites.length, 0); assert.deepEqual(await snapshot(storage), {});
            if (fault === "readback") assert.ok(stored, "The stored key must be read back and verified.");
        } finally { store.mock.restore(); get.mock.restore(); }
    }
});

test("F06-V05 source drift while native migration review is held cannot overwrite the newer file", async () => {
    let release!: (value: string | undefined) => void;
    confirmation = () => new Promise(done => { release = done; });
    const migrating = manager.migrate(uri()); void migrating.catch(() => undefined);
    try {
        await waitFor(() => !!release, "Manager must obtain native approval before migration.");
        const external = SIMPLE + "OWNER_NOTE=newer\n"; await write(".env", external); release("Migrate securely"); await withheld(() => migrating);
        assert.ok((await readFile(uri().fsPath, "utf8")) === external); assert.equal(sourceWrites.length, 0); assert.deepEqual(await snapshot(storage), {});
    } finally { release?.(undefined); await settle(migrating); confirmation = undefined; }
});

test("F06-V06 source drift while verified key storage is held cannot remove newer source data", async () => {
    const originalStore = context.secrets.store.bind(context.secrets); let release!: () => void, entered = false;
    const held = new Promise<void>(done => { release = done; });
    mock.method(context.secrets, "store", async (key: string, value: string) => { entered = true; await held; return originalStore(key, value); });
    const migrating = manager.migrate(uri()); void migrating.catch(() => undefined);
    try {
        await waitFor(() => entered, "Key storage must be held before destructive migration.");
        const external = SIMPLE + "OWNER_NOTE=changed-during-key-store\n"; await write(".env", external); release(); await withheld(() => migrating);
        assert.ok((await readFile(uri().fsPath, "utf8")) === external); assert.equal(sourceWrites.length, 0);
        for (const file of await files(storage)) noValues((await readFile(file)).toString("utf8"));
    } finally { release(); await settle(migrating); }
});

test("F06-V07 machine withdrawal, untrusted or nonlocal resources withhold all mutation entry points", async () => {
    stub.state.config.set(FLAG, true); stub.state.configInspect.set(FLAG, { defaultValue: true, globalValue: false, workspaceValue: true });
    await withheld(() => manager.migrate(uri())); await withheld(() => manager.restore(uri())); assert.equal(await manager.restoreFromBackup(uri()), false);
    await assert.rejects(manager.writeEnvExample(uri())); await withheld(() => recover());
    stub.state.configInspect.set(FLAG, { defaultValue: true }); stub.state.isTrusted = false; await withheld(() => manager.migrate(uri()));
    stub.state.isTrusted = true;
    const queried = uri(); Object.defineProperty(queried, "query", { value: "raw=1" });
    for (const target of [stub.Uri.file(join(container, "outside.env")), stub.Uri.parse("vscode-remote://synthetic/.env"), queried]) await withheld(() => manager.migrate(target as FixtureUri));
    assert.ok((await readFile(uri().fsPath, "utf8")) === SIMPLE); assert.equal(sourceWrites.length, 0); assert.deepEqual(await snapshot(storage), {});
});

test("F06-V08 flag withdrawal while native confirmation is pending leaves source and vault untouched", async () => {
    let release!: (value: string | undefined) => void; confirmation = () => new Promise(done => { release = done; });
    const migrating = manager.migrate(uri()); void migrating.catch(() => undefined);
    try {
        await waitFor(() => !!release, "Native review must precede migration writes.");
        stub.state.config.set(FLAG, false); stub.state.configInspect.set(FLAG, { defaultValue: true, globalValue: false });
        release("Migrate securely"); await withheld(() => migrating);
        assert.ok((await readFile(uri().fsPath, "utf8")) === SIMPLE); assert.equal(sourceWrites.length, 0); assert.deepEqual(await snapshot(storage), {});
    } finally { release?.(undefined); await settle(migrating); confirmation = undefined; }
});

test("F06-V09 dirty and stale existing source buffers are rejected before writes and no original TextDocument is created", async () => {
    const original = stub.makeDocument(uri(), SIMPLE);
    for (const document of [{ ...original, isDirty: true }, { ...original, getText: () => SIMPLE + "stale\n" }]) {
        stub.workspace.textDocuments = [document]; await withheld(() => manager.migrate(uri()));
        assert.ok((await readFile(uri().fsPath, "utf8")) === SIMPLE); assert.deepEqual(await snapshot(storage), {});
    }
    assert.equal(sourceWrites.length, 0); assert.equal(textDocumentCalls, 0);
});

test("F06-V10 an existing corrupt encrypted vault is preserved and never reinterpreted as empty", async () => {
    const vaultPath = join(storage, "soterai-vault.enc"), corrupt = "SYNTHETIC_INVALID_ENCRYPTED_VAULT_FORMAT";
    await writeFile(vaultPath, corrupt); context._inspect.secretStore.set(KEY_ID, generateVaultKey());
    await withheld(() => manager.migrate(uri())); assert.ok((await readFile(vaultPath, "utf8")) === corrupt);
    assert.ok((await readFile(uri().fsPath, "utf8")) === SIMPLE); assert.equal(sourceWrites.length, 0);
});

test("F06-V11 an existing encrypted vault whose key disappeared cannot be replaced by a newly created vault", async () => {
    assert.ok(await manager.migrate(uri()) > 0); const before = await snapshot(storage), masked = await readFile(uri().fsPath, "utf8");
    context._inspect.secretStore.delete(KEY_ID); await write("other/.env", SIMPLE); const writesBefore = sourceWrites.length;
    await withheld(() => manager.migrate(uri("other/.env"))); assert.deepEqual(await snapshot(storage), before);
    assert.ok((await readFile(uri("other/.env").fsPath, "utf8")) === SIMPLE); assert.ok((await readFile(uri().fsPath, "utf8")) === masked);
    assert.equal(sourceWrites.length, writesBefore); assert.equal(context._inspect.secretStore.has(KEY_ID), false);
});

test("F06-V12 conflicting example files are not overwritten and migration removes no original values", async () => {
    await write(".env.example", "OWNER_CREATED=public-control\n"); const before = await snapshot(root);
    await withheld(() => manager.migrate(uri())); assert.deepEqual(await snapshot(root), before); assert.deepEqual(await snapshot(storage), {}); assert.equal(sourceWrites.length, 0);
});

test("F06-V13 explicit example generation contains blank unique names only and refuses a conflicting existing example", async () => {
    await write(".env", SOURCE); const example = await manager.writeEnvExample(uri()); assertBlankExample(await readFile(example.fsPath, "utf8"));
    assert.ok((await readFile(uri().fsPath, "utf8")) === SOURCE); await write(".env.example", "OWNER_CREATED=public-control\n");
    await assert.rejects(manager.writeEnvExample(uri())); assert.ok((await readFile(uri(".env.example").fsPath, "utf8")) === "OWNER_CREATED=public-control\n");
    assert.equal(textDocumentCalls, 0);
});

test("F06-V14 failed source write preserves encrypted recovery; a new manager completes the masked outcome idempotently", async () => {
    await failSourceWrite(); assert.ok((await readFile(uri().fsPath, "utf8")) === SIMPLE); await assertEncryptedStorage();
    mock.restoreAll(); manager = new VaultManager(context as never); ownerApproval = false;
    assert.equal(await recover(), false); assert.ok((await readFile(uri().fsPath, "utf8")) === SIMPLE);
    ownerApproval = true; assert.equal(await recover(), true); const masked = await readFile(uri().fsPath, "utf8"); noValues(masked);
    assertBlankExample(await readFile(uri(".env.example").fsPath, "utf8")); assert.ok(prompts.some(prompt => prompt.actions.includes("Complete safe recovery")));
    const sourceBefore = await snapshot(root), storageBefore = await snapshot(storage); const repeated = await recover(); assert.equal(typeof repeated, "boolean");
    assert.deepEqual(await snapshot(root), sourceBefore); assert.deepEqual(await snapshot(storage), storageBefore);
    assert.equal(await manager.migrate(uri()), 0); assert.deepEqual(await snapshot(root), sourceBefore); await assertEncryptedStorage();
});

test("F06-V15 tampered issued checkpoint recovery is withheld without silently restoring or rewriting originals", async () => {
    await failSourceWrite(); mock.restoreAll();
    const candidates = await Promise.all((await files(storage)).filter(file => basename(file) !== "soterai-vault.enc" && !/lock/i.test(basename(file))).map(async file => ({ file, bytes: await readFile(file) })));
    const issued = candidates.sort((a, b) => b.bytes.length - a.bytes.length)[0]; assert.ok(issued && issued.bytes.length > 0, "A durable encrypted generation must survive the failed source write.");
    issued.bytes[issued.bytes.length - 1] ^= 1; await writeFile(issued.file, issued.bytes); const before = await snapshot(root);
    await withheld(() => recover()); assert.deepEqual(await snapshot(root), before); assert.ok((await readFile(uri().fsPath, "utf8")) === SIMPLE);
});

test("F06-V16 raw restoration requires its own disclosure approval and retained placeholders remain until accepted", async () => {
    assert.ok(await manager.migrate(uri()) > 0); const masked = await readFile(uri().fsPath, "utf8"); ownerApproval = false;
    assert.equal(await manager.restore(uri()), 0); assert.ok((await readFile(uri().fsPath, "utf8")) === masked);
    assert.equal(await manager.restoreFromBackup(uri()), false); assert.ok((await readFile(uri().fsPath, "utf8")) === masked);
    ownerApproval = true; assert.ok(await manager.restore(uri()) > 0); const restored = await readFile(uri().fsPath, "utf8");
    assert.ok(restored.includes(URL) && restored.includes(API)); assert.ok(prompts.some(prompt => prompt.actions.includes("Restore raw values")));
    await assertEncryptedStorage(); assert.equal(textDocumentCalls, 0); noUiValues();
});

test("F06-V17 equal relative paths in different projects cannot restore another root's vault entries or swapped backup", async () => {
    assert.ok(await manager.migrate(uri()) > 0); const originalUri = uri(), masked = await readFile(originalUri.fsPath, "utf8");
    const otherRoot = join(container, "other-project"); await mkdir(otherRoot); const otherUri = stub.Uri.file(join(otherRoot, ".env")) as FixtureUri; await writeFile(otherUri.fsPath, masked);
    stub.setWorkspace(otherRoot); const other = new VaultManager(context as never); await withheld(() => other.restore(otherUri));
    assert.ok((await readFile(otherUri.fsPath, "utf8")) === masked);
    const key = context._inspect.secretStore.get(KEY_ID); assert.ok(key); const backupDir = join(storage, "backups"); await mkdir(backupDir, { recursive: true });
    const forgedDestination = join(backupDir, sha(otherUri.toString()).slice(0, 32) + ".enc");
    await writeFile(forgedDestination, await encryptVault(JSON.stringify({ file: originalUri.toString(), savedAt: new Date().toISOString(), content: SIMPLE }), key));
    assert.equal(await other.restoreFromBackup(otherUri), false); assert.ok((await readFile(otherUri.fsPath, "utf8")) === masked);
});

test("F06-V18 static mutation serialization preserves both files' distinct encrypted entries", async () => {
    await write("other/.env", `DATABASE_URL=${URL2}\nAPI_KEY=${API}\n`); const other = new VaultManager(context as never);
    let release!: (value: string | undefined) => void, firstHeld = false;
    confirmation = (_message, actions) => {
        if (!firstHeld) { firstHeld = true; return new Promise(done => { release = done; }); }
        return Promise.resolve(actions.includes("Migrate securely") ? "Migrate securely" : undefined);
    };
    const first = manager.migrate(uri()); void first.catch(() => undefined); let second: Promise<number> | undefined;
    try {
        await waitFor(() => !!release, "The first manager mutation must hold its own native review.");
        const before = prompts.length; second = other.migrate(uri("other/.env")); void second.catch(() => undefined);
        await new Promise<void>(done => setImmediate(done)); assert.equal(prompts.length, before, "A second manager must not race the active vault mutation.");
        release("Migrate securely"); const counts = await Promise.all([first, second]); assert.ok(counts.every(count => count > 0));
        assert.equal((await manager.status()).entryCount, counts[0] + counts[1]);
        assert.equal(new Set(await manager.knownPlaceholders()).size, counts[0] + counts[1]); await assertEncryptedStorage();
    } finally { release?.(undefined); await settle(first); if (second) await settle(second); confirmation = undefined; }
});

test("F06-V19 compatible encrypted legacy entries survive a new migration while legacy relative restoration stays withheld", async () => {
    const candidates = extractVaultCandidates(`API_KEY=${API}`); assert.ok(candidates.length > 0);
    const legacy = { ...await buildVaultMetadata(candidates[0], "legacy.env"), rawValue: candidates[0].rawValue };
    const key = generateVaultKey(); context._inspect.secretStore.set(KEY_ID, key);
    await writeFile(join(storage, "soterai-vault.enc"), await encryptVault(JSON.stringify({ version: 1, entries: [legacy] }), key));
    const count = await manager.migrate(uri()); assert.ok(count > 0); const status = await manager.status();
    assert.equal(status.entryCount, count + 1); assert.ok(status.entries.some(entry => entry.placeholder === legacy.placeholder));
    await write("legacy.env", legacy.placeholder); await withheld(() => manager.restore(uri("legacy.env")));
    assert.ok((await readFile(uri("legacy.env").fsPath, "utf8")) === legacy.placeholder); await assertEncryptedStorage();
});

test("F06-V20 a pending whole-vault checkpoint withholds another file until safe recovery completes", async () => {
    await failSourceWrite(); assert.ok((await readFile(uri().fsPath, "utf8")) === SIMPLE); mock.restoreAll();
    await write("other/.env", `DATABASE_URL=${URL2}\n`); const other = new VaultManager(context as never);
    const pendingVault = await snapshot(storage), otherBefore = await readFile(uri("other/.env").fsPath, "utf8");
    await withheld(() => other.migrate(uri("other/.env")));
    assert.ok((await readFile(uri("other/.env").fsPath, "utf8")) === otherBefore); assert.deepEqual(await snapshot(storage), pendingVault);
    manager = new VaultManager(context as never); assert.equal(await recover(), true);
    const recoveredCount = (await manager.status()).entryCount; const count = await other.migrate(uri("other/.env")); assert.ok(count > 0);
    assert.equal((await manager.status()).entryCount, recoveredCount + count); await assertEncryptedStorage();
});

test("F06-V21 explicit restore preserves exact quoted escapes, multiline and duplicate source bytes", async () => {
    const original = SOURCE + 'TOKEN="first\\nlast\\rline"\r\n'; await write(".env", original);
    assert.ok(await manager.migrate(uri()) > 0); assert.ok(await manager.restore(uri()) > 0);
    assert.equal(await readFile(uri().fsPath, "utf8"), original); noUiValues(); await assertEncryptedStorage();
});

test("F06-V22 damaged partial bytes withhold safe completion but authenticated separately approved original recovery remains reachable", async () => {
    const originalWrite = stub.workspace.fs.writeFile.bind(stub.workspace.fs);
    const fault = mock.method(stub.workspace.fs, "writeFile", async (target: stub.Uri, bytes: Uint8Array) => {
        if (target.toString() === uri().toString()) { await writeFile(target.fsPath, Buffer.from([0xef, 0xbb, 0, 0xc3])); throw new Error("Synthetic partial write"); }
        return originalWrite(target, bytes);
    });
    await assert.rejects(manager.migrate(uri())); fault.mock.restore();
    const damaged = await readFile(uri().fsPath); await withheld(() => recover()); assert.deepEqual(await readFile(uri().fsPath), damaged);
    ownerApproval = false; assert.equal(await manager.restoreFromBackup(uri()), false); assert.deepEqual(await readFile(uri().fsPath), damaged);
    ownerApproval = true; assert.equal(await manager.restoreFromBackup(uri()), true); assert.equal(await readFile(uri().fsPath, "utf8"), SIMPLE);
    noUiValues(); await assertEncryptedStorage();
});

test("F06-V23 status metadata withholds hash-bearing legacy identifiers and direct value fingerprints", async () => {
    assert.ok(await manager.migrate(uri()) > 0); const status = await manager.status(), safe = JSON.stringify(status);
    for (const value of [URL, API]) assert.ok(!safe.includes(sha(value).slice(0, 12)));
    for (const entry of status.entries) assert.ok(!Object.hasOwn(entry, "hash") && !Object.hasOwn(entry, "id"));
});

test("F06-V24 existing pristine owner TextDocument saves placeholders without creating a new original document", async () => {
    let current = SIMPLE, version = 1, replacement = "";
    const document = { ...stub.makeDocument(uri(), SIMPLE), isDirty: false, get version() { return version; }, getText: () => current,
        save: async () => { await writeFile(uri().fsPath, current); document.isDirty = false; return true; } };
    stub.workspace.textDocuments = [document];
    mock.method(stub.WorkspaceEdit.prototype, "replace", (_uri: unknown, _range: unknown, text: string) => { replacement = text; });
    Object.assign(stub.workspace, { applyEdit: async () => { current = replacement; version++; document.isDirty = true; return true; } });
    assert.ok(await manager.migrate(uri()) > 0); assert.equal(current, await readFile(uri().fsPath, "utf8"));
    assert.ok(!current.includes(URL) && !current.includes(API)); assert.equal(document.isDirty, false); assert.equal(textDocumentCalls, 0); noUiValues();
});

test("F06-V25 policy drift inside an approved raw write prevents a stale success acknowledgement", async () => {
    assert.ok(await manager.migrate(uri()) > 0);
    const originalWrite = stub.workspace.fs.writeFile.bind(stub.workspace.fs);
    mock.method(stub.workspace.fs, "writeFile", async (target: stub.Uri, bytes: Uint8Array) => {
        await originalWrite(target, bytes);
        if (target.toString() === uri().toString()) await write(".soterai/team-policy.json", JSON.stringify({ schemaVersion: 1, presets: [],
            rules: { paths: [{ kind: "file", pattern: "extra-private.txt", sensitive: true }], regions: [] }, sensitiveGlobs: [] }));
    });
    await assert.rejects(manager.restore(uri())); await assertEncryptedStorage(); noUiValues();
});

test("F06-V26 missing or replaced key during backup disclosure withholds originals before disk mutation", async () => {
    assert.ok(await manager.migrate(uri()) > 0); const masked = await readFile(uri().fsPath, "utf8"), originalKey = context._inspect.secretStore.get(KEY_ID)!;
    for (const nextKey of [undefined, generateVaultKey()]) {
        context._inspect.secretStore.set(KEY_ID, originalKey);
        confirmation = async () => { if (nextKey === undefined) context._inspect.secretStore.delete(KEY_ID); else context._inspect.secretStore.set(KEY_ID, nextKey); return "Restore raw values"; };
        assert.equal(await manager.restoreFromBackup(uri()), false); assert.equal(await readFile(uri().fsPath, "utf8"), masked);
    }
    confirmation = undefined; context._inspect.secretStore.set(KEY_ID, originalKey);
});

test("F06-V27 key loss immediately after encrypted vault commit preserves originals and checkpoint for later reviewed recovery", async () => {
    const originalWrite = VaultStorage.prototype.write; let originalKey: string | undefined;
    const fault = mock.method(VaultStorage.prototype, "write", async function(this: VaultStorage, name: string, text: string, exclusive?: boolean) {
        await originalWrite.call(this, name, text, exclusive);
        if (name === "soterai-vault.enc") { originalKey = context._inspect.secretStore.get(KEY_ID); context._inspect.secretStore.delete(KEY_ID); }
    });
    await assert.rejects(manager.migrate(uri())); assert.equal(await readFile(uri().fsPath, "utf8"), SIMPLE);
    assert.equal(sourceWrites.length, 0); fault.mock.restore(); assert.ok(originalKey); context._inspect.secretStore.set(KEY_ID, originalKey);
    assert.equal(await recover(), true); assert.ok(!(await readFile(uri().fsPath, "utf8")).includes(URL)); await assertEncryptedStorage();
});

test("F06-V28 native local vscode-userdata global storage maps to its canonical physical path without changing namespace", async () => {
    context.globalStorageUri = stub.Uri.file(storage).with({ scheme: "vscode-userdata" }); manager = new VaultManager(context as never);
    assert.ok(await manager.migrate(uri()) > 0); assert.ok(!(await readFile(uri().fsPath, "utf8")).includes(URL));
    await assertEncryptedStorage(); assert.ok((await files(storage)).some(file => basename(file) === "soterai-vault.enc"));
    assert.ok(await manager.restore(uri()) > 0); assert.equal(await readFile(uri().fsPath, "utf8"), SIMPLE);
});

test("F06-V29 unknown global-storage providers cannot write a vault or change source bytes", async () => {
    for (const scheme of ["vscode-remote", "https", "untitled"]) {
        context.globalStorageUri = stub.Uri.file(storage).with({ scheme }); manager = new VaultManager(context as never);
        await withheld(() => manager.migrate(uri())); assert.deepEqual(await snapshot(storage), {});
        assert.equal(await readFile(uri().fsPath, "utf8"), SIMPLE); assert.equal(context._inspect.secretStore.size, 0);
    }
});
