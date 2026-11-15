import "./phase2/register.mjs";
import assert from "node:assert/strict";
import { beforeEach, afterEach, test, mock } from "node:test";
import * as fs from "node:fs/promises";
import { join, dirname, basename, resolve } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import * as stub from "./phase2/vscode-stub";
import { initializeBoundaryState, BoundarySnapshot } from "../ai-boundary/BoundarySnapshot";
import { VaultManager } from "../firewall/VaultManager";
import { VaultStorage } from "../firewall/VaultStorage";
import { PORTABLE_IMPORT_JOURNAL, PORTABLE_IMPORT_STAGE } from "../firewall/PortableVaultRecovery";
import { PortableRecoveryFile } from "../firewall/PortableRecoveryFile";
import { registerPortableVaultRecoveryCommands } from "../firewall/portable-recovery-commands";
import { createRecoveryEnvelope, openRecoveryEnvelope } from "../../../core/src/RecoveryEnvelope";

const PASSWORD = "synthetic-owner-recovery-password-739216", PRIVATE = "MintHorizon8!";
const sha = (bytes: string | Uint8Array) => createHash("sha256").update(bytes).digest("hex");
type Context = ReturnType<typeof stub.makeExtensionContext>;
let container: string, root: string, storage: string, context: Context, manager: VaultManager, contexts: Context[];
const originalWindow = Object.getOwnPropertyDescriptors(stub.window);
async function makeContext(directory: string): Promise<Context> {
    await fs.mkdir(directory, { recursive: true });
    const value = stub.makeExtensionContext(root);
    value.globalStorageUri = stub.Uri.file(directory); contexts.push(value); return value;
}
async function target(): Promise<{ context: Context; manager: VaultManager; directory: string }> {
    const directory = join(container, "target-" + contexts.length), value = await makeContext(directory);
    await fs.writeFile(join(directory, "unrelated.txt"), "Unrelated data must survive", { flag: "wx" });
    return { context: value, manager: new VaultManager(value as never), directory };
}
async function exported(): Promise<Uint8Array> {
    assert.equal(await manager.migrate(stub.Uri.file(join(root, ".env")) as never), 1);
    return manager.exportPortableRecovery(PASSWORD);
}
async function snapshot(directory: string): Promise<Record<string, string>> {
    const result: Record<string, string> = {};
    for (const name of await fs.readdir(directory)) result[name] = sha(await fs.readFile(join(directory, name)));
    return result;
}
beforeEach(async () => {
    container = await fs.mkdtemp(join(tmpdir(), "soterai-portable-recovery-")); root = join(container, "project"); storage = join(container, "source-store"); contexts = [];
    await fs.mkdir(root); stub.resetState(root); context = await makeContext(storage);
    initializeBoundaryState(context.workspaceState as never); await BoundarySnapshot.load();
    Object.assign(stub.window, { showWarningMessage: async (_message: string, ...args: unknown[]) => args.find(value => value === "Migrate securely") });
    manager = new VaultManager(context as never);
    await fs.writeFile(join(root, ".env"), "DB_PASSWORD=" + PRIVATE + "\n", { flag: "wx" });
});
afterEach(async () => {
    mock.restoreAll();
    for (const value of contexts) value.subscriptions.forEach(subscription => subscription.dispose());
    for (const key of Object.keys(stub.window)) if (!(key in originalWindow)) delete (stub.window as unknown as Record<string, unknown>)[key];
    Object.defineProperties(stub.window, originalWindow);
    const directory = resolve(container); assert.equal(dirname(directory), resolve(tmpdir())); assert.ok(basename(directory).startsWith("soterai-portable-recovery-"));
    await fs.rm(directory, { recursive: true, force: true });
});

test("portable recovery restores authenticated vault history into an empty store and preserves unrelated files", async () => {
    const envelope = await exported(), destination = await target(), source = await snapshot(storage);
    const beforeProject = await fs.readFile(join(root, ".env"), "utf8");
    const result = await destination.manager.importPortableRecovery(envelope, PASSWORD, sha(envelope));
    assert.equal(result.status, "IMPORTED"); assert.equal(result.recordCount, 3);
    assert.equal((await destination.manager.status()).entryCount, 1);
    assert.equal(await fs.readFile(join(root, ".env"), "utf8"), beforeProject);
    assert.equal(await fs.readFile(join(destination.directory, "unrelated.txt"), "utf8"), "Unrelated data must survive");
    const restored = await snapshot(destination.directory); delete restored["unrelated.txt"]; assert.deepEqual(restored, source);
    for (const name of await fs.readdir(destination.directory)) {
        const text = await fs.readFile(join(destination.directory, name), "utf8");
        assert.ok(!text.includes(PRIVATE) && !text.includes(PASSWORD));
        assert.ok(!text.includes((await context.secrets.get("soterai.vaultKey"))!));
    }
});

test("populated stores, conflicting keys and unauthenticated archive records are refused without replacement", async () => {
    const envelope = await exported(), original = await snapshot(storage);
    await assert.rejects(manager.importPortableRecovery(envelope, PASSWORD, sha(envelope)));
    assert.deepEqual(await snapshot(storage), original);
    const destination = await target(); await destination.context.secrets.store("soterai.vaultKey", Buffer.alloc(32, 1).toString("base64"));
    const before = await snapshot(destination.directory);
    await assert.rejects(destination.manager.importPortableRecovery(envelope, PASSWORD, sha(envelope)));
    assert.deepEqual(await snapshot(destination.directory), before);
    const opened = await openRecoveryEnvelope(envelope, PASSWORD, sha(envelope));
    try {
        const data = JSON.parse(Buffer.from(opened.archive).toString("utf8"));
        data.records.find((record: { name: string }) => record.name === "soterai-vault.enc").text = "not-an-authenticated-vault";
        data.records.forEach((record: { text: string; sha256: string }) => { record.sha256 = sha(record.text); });
        const corrupted = await createRecoveryEnvelope({ vaultKey: opened.vaultKey, archive: Buffer.from(JSON.stringify(data)) }, PASSWORD), empty = await target();
        await assert.rejects(empty.manager.importPortableRecovery(corrupted, PASSWORD, sha(corrupted)));
        assert.deepEqual(await fs.readdir(empty.directory), ["unrelated.txt"]);
        assert.equal(await empty.context.secrets.get("soterai.vaultKey"), undefined);
    } finally { opened.vaultKey.fill(0); opened.archive.fill(0); }
});

test("SecretStorage failure retains encrypted recovery, blocks normal use and resumes only the exact envelope", async () => {
    const envelope = await exported(), destination = await target();
    const originalStore = destination.context.secrets.store.bind(destination.context.secrets);
    const fault = mock.method(destination.context.secrets, "store", async () => { throw new Error("Synthetic key-store failure"); });
    await assert.rejects(destination.manager.importPortableRecovery(envelope, PASSWORD, sha(envelope)));
    fault.mock.restore();
    const retained = await snapshot(destination.directory);
    assert.ok(retained[PORTABLE_IMPORT_JOURNAL] && retained[PORTABLE_IMPORT_STAGE]);
    const restarted = new VaultManager(destination.context as never);
    await assert.rejects(restarted.status()); await assert.rejects(restarted.knownPlaceholders());
    await assert.rejects(restarted.createGatewayRegistry(() => true));
    await assert.rejects(restarted.migrate(stub.Uri.file(join(root, ".env")) as never));
    const anotherEnvelope = await manager.exportPortableRecovery(PASSWORD);
    await assert.rejects(restarted.importPortableRecovery(anotherEnvelope, PASSWORD, sha(anotherEnvelope)));
    assert.deepEqual(await snapshot(destination.directory), retained);
    assert.equal(await destination.context.secrets.get("soterai.vaultKey"), undefined);
    assert.equal(typeof originalStore, "function");
    assert.equal((await restarted.importPortableRecovery(envelope, PASSWORD, sha(envelope))).status, "IMPORTED");
    assert.equal((await restarted.status()).entryCount, 1);
});

for (const failedName of [PORTABLE_IMPORT_JOURNAL, PORTABLE_IMPORT_STAGE, "soterai-vault.enc"]) {
    test(`an interruption after durable ${failedName} installation resumes without overwriting`, async () => {
        const envelope = await exported(), destination = await target();
        const original = VaultStorage.prototype.writePortableAtomic;
        let failed = false;
        const fault = mock.method(VaultStorage.prototype, "writePortableAtomic", async function (this: VaultStorage, name: string, text: string, binding: string, limit?: number) {
            await original.call(this, name, text, binding, limit);
            if (this.directory === destination.directory && name === failedName && !failed) { failed = true; throw new Error("Synthetic interruption"); }
        });
        await assert.rejects(destination.manager.importPortableRecovery(envelope, PASSWORD, sha(envelope))); fault.mock.restore();
        assert.equal(failed, true); await assert.rejects(new VaultManager(destination.context as never).status());
        const restarted = new VaultManager(destination.context as never);
        assert.equal((await restarted.importPortableRecovery(envelope, PASSWORD, sha(envelope))).status, "IMPORTED");
        assert.equal((await restarted.status()).entryCount, 1);
    });
}

test("partial journal staging and a linked-but-not-unlinked journal remain resumable", async () => {
    const envelope = await exported(), destination = await target();
    const original = VaultStorage.prototype.write;
    let interrupted = false;
    const fault = mock.method(VaultStorage.prototype, "write", async function (this: VaultStorage, name: string, text: string, exclusive?: boolean, limit?: number) {
        if (this.directory === destination.directory && name.startsWith("vault-portable-") && name.endsWith(".tmp") && !interrupted) {
            interrupted = true; await original.call(this, name, text.slice(0, Math.floor(text.length / 2)), exclusive, limit); throw new Error("Synthetic partial journal");
        }
        return original.call(this, name, text, exclusive, limit);
    });
    await assert.rejects(destination.manager.importPortableRecovery(envelope, PASSWORD, sha(envelope))); fault.mock.restore();
    await assert.rejects(destination.manager.status());
    assert.equal((await destination.manager.importPortableRecovery(envelope, PASSWORD, sha(envelope))).status, "IMPORTED");
    const nativeFs = require("node:fs/promises") as typeof import("node:fs/promises");
    const linked = await target(), unlink = nativeFs.unlink;
    let linkInterrupted = false;
    const unlinkFault = mock.method(nativeFs, "unlink", async (target: Parameters<typeof fs.unlink>[0]) => {
        if (String(target).startsWith(linked.directory) && String(target).endsWith(".tmp") && !linkInterrupted) { linkInterrupted = true; throw new Error("Synthetic link interruption"); }
        return unlink(target);
    });
    await assert.rejects(linked.manager.importPortableRecovery(envelope, PASSWORD, sha(envelope))); unlinkFault.mock.restore();
    assert.equal(linkInterrupted, true);
    assert.equal((await linked.manager.importPortableRecovery(envelope, PASSWORD, sha(envelope))).status, "IMPORTED");
});

test("external recovery files are create-only and cannot be exported into a workspace", async () => {
    const envelope = await exported();
    await assert.rejects(PortableRecoveryFile.capture(stub.Uri.file(join(root, "leak.soterai-recovery")) as never, storage));
    const uri = stub.Uri.file(join(container, "backup.soterai-recovery")), file = await PortableRecoveryFile.capture(uri as never, storage);
    await file.create(envelope); const before = await fs.readFile(uri.fsPath);
    await assert.rejects(file.create(envelope)); assert.deepEqual(await fs.readFile(uri.fsPath), before);
});

test("native commands reject arguments, require password-mode inputs and explicit owner approval", async () => {
    await exported(); let passwordCalls = 0, saveCalls = 0, approve = false;
    Object.assign(stub.window, {
        showSaveDialog: async () => { saveCalls++; return stub.Uri.file(join(container, "ui.soterai-recovery")); },
        showInputBox: async (options: { password?: boolean }) => { assert.equal(options.password, true); passwordCalls++; return PASSWORD; },
        showWarningMessage: async (_message: string, _options: unknown, action: string) => approve ? action : undefined,
    });
    registerPortableVaultRecoveryCommands(context as never, () => undefined);
    const command = stub.registeredCommands.get("soterai.exportVaultRecovery")!;
    assert.deepEqual(await command({ passphrase: PASSWORD, approved: true }), { status: "WITHHELD" });
    assert.equal(saveCalls, 0); assert.equal(passwordCalls, 0);
    assert.deepEqual(await command(), { status: "CANCELLED" });
    assert.equal(passwordCalls, 2);
    await assert.rejects(fs.stat(join(container, "ui.soterai-recovery")));
    approve = true; assert.deepEqual(await command(), { status: "EXPORTED" });
    const output = await fs.readFile(join(container, "ui.soterai-recovery"), "utf8");
    assert.ok(!output.includes(PRIVATE) && !output.includes(PASSWORD));
});
