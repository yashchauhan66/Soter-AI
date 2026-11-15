import "./phase2/register.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdir, mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { makeExtensionContext } from "./phase2/vscode-stub";
import { EncryptedBackupSink } from "../broker/EncryptedBackupSink";
import { CheckedHistoryProfileFile } from "../history-hooks/CheckedHistoryProfileFile";
import { installHistoryProfile, restoreHistoryProfile, type HistoryProfileTransactionIO } from "../history-hooks/HistoryProfileTransaction";

// Real filesystem/AES-GCM, in-memory VS Code state/SecretStorage. Not native UI.
const generation = "d1234567-1234-4567-8123-123456789abc", keyId = "soterai.configBackupKey", stateId = "synthetic.history.receipt";
const canary = "FAKE_ONLY_F26C_COMMENT_BACKUP_VALUE_b71a90";
async function fixture(before?: Buffer) {
    const root = await mkdtemp(join(tmpdir(), "soterai-f26c-backup-")), parent = join(root, "WindowsPowerShell"); await mkdir(parent);
    const target = join(parent, "Microsoft.PowerShell_profile.ps1"); if (before !== undefined) await writeFile(target, before);
    const context = makeExtensionContext(join(root, "synthetic-storage")), file = new CheckedHistoryProfileFile(root, target, () => true);
    const io: HistoryProfileTransactionIO = {
        authorized: () => true, snapshot: () => file.snapshot(), replace: (prior, next) => file.replace(prior, next),
        readReceipt: () => context.globalState.get(stateId), writeReceipt: value => context.globalState.update(stateId, value), backup: new EncryptedBackupSink(context as never),
    };
    return { root, parent, target, context, file, io, backupDir: join(context.globalStorageUri.fsPath, "config-backups") };
}

test("F26c actual filesystem and canonical AES backup preserve BOM CRLF through explicit restore", async () => {
    const before = Buffer.from("\ufeff# " + canary + "\r\n"), f = await fixture(before);
    assert.equal((await installHistoryProfile(f.io, generation)).status, "APPLIED");
    const files = await readdir(f.backupDir); assert.equal(files.length, 1); assert.match(files[0], /^[a-f0-9]{32}\.enc$/);
    const ciphertext = await readFile(join(f.backupDir, files[0])); assert(!ciphertext.toString().includes(canary));
    const receipt = JSON.stringify(f.context._inspect.globalStore.get(stateId)); assert(!receipt.includes(canary)); assert(!receipt.includes(f.target));
    assert.equal(f.context._inspect.secretStore.size, 1); assert(f.context._inspect.secretStore.has(keyId));
    assert.equal((await restoreHistoryProfile(f.io, generation)).status, "RESTORED"); assert((await readFile(f.target)).equals(before));
    assert((await readFile(join(f.backupDir, files[0]))).equals(ciphertext)); assert.deepEqual(await readdir(f.parent), ["Microsoft.PowerShell_profile.ps1"]);
});

test("F26c missing canonical backup key withholds restore and does not replace the key", async () => {
    const f = await fixture(Buffer.from("# " + canary + "\n")); assert.equal((await installHistoryProfile(f.io, generation)).status, "APPLIED");
    const installed = await readFile(f.target); await f.context.secrets.delete(keyId);
    assert.equal((await restoreHistoryProfile(f.io, generation)).status, "INCOMPLETE"); assert((await readFile(f.target)).equals(installed)); assert.equal(f.context._inspect.secretStore.size, 0); assert(f.io.readReceipt());
});

test("F26c tampered canonical ciphertext withholds restore and preserves the installed exclusion", async () => {
    const f = await fixture(Buffer.from("# " + canary + "\n")); assert.equal((await installHistoryProfile(f.io, generation)).status, "APPLIED");
    const installed = await readFile(f.target), files = await readdir(f.backupDir), backup = join(f.backupDir, files[0]); await writeFile(backup, "FAKE_ONLY_CORRUPTED_CIPHERTEXT");
    assert.equal((await restoreHistoryProfile(f.io, generation)).status, "INCOMPLETE"); assert((await readFile(f.target)).equals(installed)); assert(f.io.readReceipt());
});

test("F26c originally absent actual profile needs no backup key and restores absence exactly", async () => {
    const f = await fixture(); assert.equal((await installHistoryProfile(f.io, generation)).status, "APPLIED"); assert.equal(f.context._inspect.secretStore.size, 0);
    assert.equal((await restoreHistoryProfile(f.io, generation)).status, "RESTORED"); assert.deepEqual(await readdir(f.parent), []); assert.equal(f.io.readReceipt(), undefined);
});
