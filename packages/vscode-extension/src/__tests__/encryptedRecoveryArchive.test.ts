import "./phase2/register.mjs";
import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { encryptVault, decryptVault } from "@soterai/guard-core";
import * as stub from "./phase2/vscode-stub";
import { EncryptedRecoveryArchive, recoveryArchiveRoot } from "../lifecycle/EncryptedRecoveryArchive";

const sha = (bytes: string | Buffer) => createHash("sha256").update(bytes).digest("hex");
const PRIVATE = "SYNTHETIC_F32_ARCHIVED_PRIVATE_VALUE_8f1c";
const KEY = Buffer.alloc(32, 29).toString("base64");
const GENERATION = "abcd1234-1234-4234-9234-123456789abc";
async function fixture(t: TestContext) {
    const root = fs.mkdtempSync(path.join(tmpdir(), "soterai-f32-archive-"));
    const workspace = path.join(root, "workspace"), source = path.join(root, "User", "globalStorage", "soterai.soterai-ide-guard");
    fs.mkdirSync(workspace); fs.mkdirSync(source, { recursive: true }); stub.resetState(workspace);
    const context = stub.makeExtensionContext(root); context.globalStorageUri = stub.Uri.file(source);
    context._inspect.secretStore.set("soterai.vaultKey", KEY);
    for (const method of ["get", "store", "delete"] as const) t.mock.method(context.secrets, method, (() => { throw Error("Archive must not access keys"); }) as never);
    const envFile = path.join(workspace, ".env"), sourceUri = stub.Uri.file(envFile).toString();
    fs.writeFileSync(envFile, "API_KEY=[SOTERAI_PROTECTED_SYNTHETIC]\n");
    const cipher = await encryptVault(JSON.stringify({ version: 2, entries: [{ rawValue: PRIVATE }] }), KEY);
    const generation = await encryptVault(JSON.stringify({ original: PRIVATE, masked: "[placeholder]" }), KEY);
    const pointerName = "vault-source-" + sha(sourceUri).slice(0, 32) + ".json";
    const files: Record<string, string> = {
        "soterai-vault.enc": cipher,
        ["vault-generation-" + GENERATION + ".enc"]: generation,
        [pointerName]: JSON.stringify({ schemaVersion: 1, id: GENERATION, source: sourceUri, root: stub.Uri.file(workspace).toString(), digest: sha(generation) }),
        ["backups/" + "b".repeat(32) + ".enc"]: await encryptVault(PRIVATE + " legacy", KEY),
    };
    for (const [relative, value] of Object.entries(files)) { const file = path.join(source, relative); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, value); }
    const archive = new EncryptedRecoveryArchive(context as never), archiveRoot = recoveryArchiveRoot(source);
    const snapshots = () => fs.readdirSync(archiveRoot).filter(name => /^[a-f0-9]{64}$/.test(name));
    const deleteSource = () => {
        assert.equal(path.dirname(path.dirname(path.dirname(source))), root);
        assert.equal(fs.realpathSync(source).toLowerCase(), path.resolve(source).toLowerCase());
        fs.rmSync(source, { recursive: true });
    };
    t.after(() => { context.subscriptions.forEach(item => item.dispose()); stub.resetState(); });
    return { root, workspace, source, envFile, context, files, pointerName, archive, archiveRoot, snapshots, deleteSource };
}

test("F32-A01 encrypted current and legacy recovery survives deferred vendor directory deletion and decrypts with the retained same-profile key", async t => {
    const f = await fixture(t), beforeEnv = fs.readFileSync(f.envFile);
    assert.deepEqual(await f.archive.preserve(() => true), { state: "preserved" });
    const ids = f.snapshots(); assert.equal(ids.length, 1);
    const snapshot = path.join(f.archiveRoot, ids[0]), manifestBytes = fs.readFileSync(path.join(snapshot, "manifest.json"));
    assert.equal(sha(manifestBytes), ids[0]);
    const manifest = JSON.parse(manifestBytes.toString());
    assert.equal(manifest.sourceStorage, process.platform === "win32" ? f.source.toLowerCase() : f.source);
    assert.equal(manifest.files.length, Object.keys(f.files).length);
    f.deleteSource();
    for (const row of manifest.files) {
        const bytes = fs.readFileSync(path.join(snapshot, "files", row.relative));
        assert.equal(bytes.length, row.bytes); assert.equal(sha(bytes), row.sha256);
        assert.equal(bytes.toString(), f.files[row.relative]); assert.equal(bytes.includes(Buffer.from(PRIVATE)), false);
    }
    const retainedKey = f.context._inspect.secretStore.get("soterai.vaultKey")!;
    assert.equal((await decryptVault(fs.readFileSync(path.join(snapshot, "files", "soterai-vault.enc"), "utf8"), retainedKey)).includes(PRIVATE), true);
    assert.equal(await decryptVault(fs.readFileSync(path.join(snapshot, "files", "backups", "b".repeat(32) + ".enc"), "utf8"), retainedKey), PRIVATE + " legacy");
    assert.deepEqual(fs.readFileSync(f.envFile), beforeEnv);
});

test("F32-A02 repeated review verifies immutable bytes and retains both earlier and newer snapshots", async t => {
    const f = await fixture(t); await f.archive.preserve(() => true); const first = f.snapshots()[0];
    await f.archive.preserve(() => true); assert.deepEqual(f.snapshots(), [first]);
    fs.writeFileSync(path.join(f.source, "soterai-vault.enc"), await encryptVault(PRIVATE + " new", KEY));
    await f.archive.preserve(() => true); assert.equal(f.snapshots().length, 2);
    assert.equal(fs.readFileSync(path.join(f.archiveRoot, first, "files", "soterai-vault.enc"), "utf8"), f.files["soterai-vault.enc"]);
});

test("F32-A13 configuration backups alone survive removal and retain their exact encrypted bytes", async t => {
    const f = await fixture(t); f.deleteSource(); fs.mkdirSync(f.source);
    const relative = "config-backups/" + "d".repeat(32) + ".enc";
    const ciphertext = await encryptVault(JSON.stringify({ version: 1, originalPath: "synthetic-config", content: PRIVATE }), KEY);
    fs.mkdirSync(path.join(f.source, "config-backups"));
    fs.writeFileSync(path.join(f.source, relative), ciphertext);
    await f.archive.preserve(() => true);
    const ids = f.snapshots(); assert.equal(ids.length, 1);
    f.deleteSource();
    const saved = fs.readFileSync(path.join(f.archiveRoot, ids[0], "files", relative), "utf8");
    assert.equal(saved, ciphertext);
    assert.equal(JSON.parse(await decryptVault(saved, KEY)).content, PRIVATE);
});

test("F32-A14 an encrypted empty legacy backup survives removal", async t => {
    const f = await fixture(t), relative = "backups/" + "b".repeat(32) + ".enc";
    const ciphertext = await encryptVault("", KEY);
    assert.equal(Buffer.from(ciphertext, "base64").length, 28);
    fs.writeFileSync(path.join(f.source, relative), ciphertext);
    await f.archive.preserve(() => true); const id = f.snapshots()[0]; f.deleteSource();
    assert.equal(await decryptVault(fs.readFileSync(path.join(f.archiveRoot, id, "files", relative), "utf8"), KEY), "");
});

for (const kind of ["unknown entry", "hardlinked backup"] as const) test("F32-A15 refuses configuration backup " + kind, async t => {
    const f = await fixture(t), directory = path.join(f.source, "config-backups"); fs.mkdirSync(directory);
    if (kind === "unknown entry") fs.writeFileSync(path.join(directory, "unrecognized.json"), PRIVATE);
    else {
        const outside = path.join(f.root, "config-original.enc"); fs.writeFileSync(outside, f.files["soterai-vault.enc"]);
        fs.linkSync(outside, path.join(directory, "d".repeat(32) + ".enc"));
    }
    await assert.rejects(f.archive.preserve(() => true));
    assert.equal(fs.existsSync(f.archiveRoot), false);
    assert.equal(fs.existsSync(path.join(f.source, "vault-mutation.lock")), false);
});

test("F32-A03 tampered existing archive is refused rather than overwritten", async t => {
    const f = await fixture(t); await f.archive.preserve(() => true);
    const file = path.join(f.archiveRoot, f.snapshots()[0], "files", "soterai-vault.enc");
    fs.writeFileSync(file, "tampered"); await assert.rejects(f.archive.preserve(() => true));
    assert.equal(fs.readFileSync(file, "utf8"), "tampered");
    assert.equal(fs.readFileSync(path.join(f.source, "soterai-vault.enc"), "utf8"), f.files["soterai-vault.enc"]);
});

for (const [label, mutate] of [
    ["pending migration", (f: Awaited<ReturnType<typeof fixture>>) => fs.writeFileSync(path.join(f.source, "vault-pending.json"), "{}")],
    ["partial vault write", (f: Awaited<ReturnType<typeof fixture>>) => fs.writeFileSync(path.join(f.source, "write-incomplete.enc"), "unfinished")],
    ["unknown recovery file", (f: Awaited<ReturnType<typeof fixture>>) => fs.writeFileSync(path.join(f.source, "vault-unknown.json"), "{}")],
    ["malformed ciphertext", (f: Awaited<ReturnType<typeof fixture>>) => fs.writeFileSync(path.join(f.source, "soterai-vault.enc"), PRIVATE)],
    ["mismatched generation digest", (f: Awaited<ReturnType<typeof fixture>>) => fs.writeFileSync(path.join(f.source, "vault-generation-" + GENERATION + ".enc"), Buffer.alloc(48, 1).toString("base64"))],
    ["unknown legacy backup", (f: Awaited<ReturnType<typeof fixture>>) => fs.writeFileSync(path.join(f.source, "backups", "unrelated.json"), PRIVATE)],
] as const) test("F32-A04 refuses " + label + " without publishing a snapshot", async t => {
    const f = await fixture(t); mutate(f); await assert.rejects(f.archive.preserve(() => true));
    assert.equal(fs.existsSync(f.archiveRoot), false); assert.equal(fs.existsSync(path.join(f.source, "vault-mutation.lock")), false);
});

test("F32-A05 absent or emptied active storage after an archive cannot be misreported as empty recovery", async t => {
    const f = await fixture(t); await f.archive.preserve(() => true); f.deleteSource();
    await assert.rejects(f.archive.preserve(() => true)); fs.mkdirSync(f.source);
    await assert.rejects(f.archive.preserve(() => true)); assert.equal(f.snapshots().length, 1);
});

test("F32-A06 a fresh profile with no vault does not create an archive or change workspace files", async t => {
    const f = await fixture(t); f.deleteSource();
    assert.deepEqual(await f.archive.preserve(() => true), { state: "preserved" });
    assert.equal(fs.existsSync(f.source), false); assert.equal(fs.existsSync(f.archiveRoot), false);
});

test("F32-A07 an existing vault mutation lock is neither replaced nor removed", async t => {
    const f = await fixture(t), lock = path.join(f.source, "vault-mutation.lock");
    fs.writeFileSync(lock, "other-owner"); await assert.rejects(f.archive.preserve(() => true));
    assert.equal(fs.readFileSync(lock, "utf8"), "other-owner"); assert.equal(fs.existsSync(f.archiveRoot), false);
});

test("F32-A08 hardlinked ciphertext is refused before any snapshot is published", async t => {
    const f = await fixture(t), file = path.join(f.source, "soterai-vault.enc");
    fs.linkSync(file, path.join(f.root, "unrelated-hardlink.enc"));
    await assert.rejects(f.archive.preserve(() => true)); assert.equal(fs.existsSync(f.archiveRoot), false);
});

test("F32-A09 a recovery directory junction cannot redirect ciphertext to another directory", async t => {
    const f = await fixture(t), outside = path.join(f.root, "unrelated"), link = path.join(path.dirname(f.source), "soterai-recovery");
    fs.mkdirSync(outside); fs.symlinkSync(outside, link, process.platform === "win32" ? "junction" : "dir");
    await assert.rejects(f.archive.preserve(() => true)); assert.deepEqual(fs.readdirSync(outside), []);
});

test("F32-A10 lost owner authority refuses before touching the vault or archiving", async t => {
    const f = await fixture(t); await assert.rejects(f.archive.preserve(() => false));
    assert.equal(fs.existsSync(path.join(f.source, "vault-mutation.lock")), false);
    assert.equal(fs.existsSync(f.archiveRoot), false);
});

test("F32-A11 owner withdrawal during archive publication releases only our own mutation lock", async t => {
    const f = await fixture(t), originalWrite = fs.writeFileSync; let active = true;
    const mocked = t.mock.method(fs, "writeFileSync", ((file: any, data: any, ...rest: any[]) => {
        const result = (originalWrite as any)(file, data, ...rest);
        if (Buffer.isBuffer(data) && data.toString() === f.files["soterai-vault.enc"]) active = false;
        return result;
    }) as typeof fs.writeFileSync);
    await assert.rejects(f.archive.preserve(() => active));
    assert.equal(fs.existsSync(path.join(f.source, "vault-mutation.lock")), false);
    assert.equal(f.snapshots().length, 0); mocked.mock.restore();
    await f.archive.preserve(() => true); assert.equal(f.snapshots().length, 1);
});

for (const method of ["writeFileSync", "fsyncSync"] as const) test("F32-A12 failed lock " + method + " releases the newly created lock without accepting removal", async t => {
    const f = await fixture(t), original = fs[method]; let first = true;
    const mocked = t.mock.method(fs, method, ((...args: any[]) => {
        if (first) { first = false; throw Error("Synthetic lock I/O failure"); }
        return (original as any)(...args);
    }) as never);
    await assert.rejects(f.archive.preserve(() => true));
    assert.equal(fs.existsSync(path.join(f.source, "vault-mutation.lock")), false);
    assert.equal(fs.existsSync(f.archiveRoot), false); mocked.mock.restore();
    await f.archive.preserve(() => true); assert.equal(f.snapshots().length, 1);
});
