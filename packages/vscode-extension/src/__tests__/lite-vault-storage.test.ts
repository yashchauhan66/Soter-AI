import "./phase2/register.mjs";
import assert from "node:assert/strict";
import { beforeEach, afterEach, test, type TestContext } from "node:test";
import { mkdtemp, mkdir, writeFile, readFile, readdir, lstat, realpath, rm, symlink, link } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { encryptVault } from "@soterai/guard-core";
import * as stub from "./phase2/vscode-stub";
import { VaultStorage, VAULT_LIMIT, readVaultFile, vaultJson, vaultObject, samePath } from "../firewall/VaultStorage";

// Post-implementation F06 storage regressions, not a claimed failing baseline.
// Every created file/link is owned by one synthetic temporary fixture. The
// workspace stub supplies folder metadata only; all I/O/locks use the real module.
const TEMP_ROOT = process.platform === "win32" ? "D:\\SoterAI-Lite-test-profiles\\f06-storage-tests"
    : join(tmpdir(), "soterai-f06-storage-tests");
const PRIVATE = "SYNTHETIC_F06_STORAGE_PRIVATE_VALUE_20261014";
const SENTINEL = "SYNTHETIC_UNRELATED_DIRECTORY_MUST_REMAIN_UNCHANGED";
const KEY = Buffer.alloc(32, 7).toString("base64");
const NONCE = "a3427b36-46ba-4d84-82e5-c5dfb5ba5dd1";
let container: string, project: string, storageDirectory: string, unrelated: string, storage: VaultStorage, encrypted: string;
const owner = () => JSON.stringify({ schemaVersion: 1, pid: process.pid, nonce: NONCE });
const unavailable = (error: unknown) => error instanceof Error;
function deferred(): { promise: Promise<void>; resolve: () => void } {
    let resolve!: () => void; const promise = new Promise<void>(done => { resolve = done; }); return { promise, resolve };
}
async function optionalLink(t: TestContext, operation: () => Promise<void>): Promise<boolean> {
    try { await operation(); return true; }
    catch (error) {
        if (["EPERM", "EACCES", "ENOTSUP", "EOPNOTSUPP", "EINVAL"].includes((error as { code?: string }).code ?? "")) {
            t.skip("This filesystem/process does not permit the required synthetic link."); return false;
        }
        throw error;
    }
}

beforeEach(async () => {
    await mkdir(TEMP_ROOT, { recursive: true }); container = await mkdtemp(join(TEMP_ROOT, "vault-storage-"));
    project = join(container, "project"); storageDirectory = join(container, "extension-storage"); unrelated = join(container, "unrelated");
    await mkdir(project); await mkdir(unrelated); await writeFile(join(unrelated, "sentinel.txt"), SENTINEL, { flag: "wx" });
    stub.resetState(project); storage = new VaultStorage(storageDirectory);
    encrypted = await encryptVault(PRIVATE, KEY); assert.ok(!encrypted.includes(PRIVATE));
});
afterEach(async () => {
    assert.deepEqual(await readdir(unrelated), ["sentinel.txt"]);
    assert.equal(await readFile(join(unrelated, "sentinel.txt"), "utf8"), SENTINEL);
    const target = resolve(container); assert.equal(dirname(target), resolve(TEMP_ROOT));
    assert.ok(basename(target).startsWith("vault-storage-")); assert.equal(samePath(await realpath(target), target), true);
    await rm(target, { recursive: true, force: true }); stub.resetState();
});

test("F06-S01 exclusive ciphertext creation verifies exact durable bytes and refuses overwriting evidence", async () => {
    await storage.write("generation.enc", encrypted, true);
    assert.equal(await storage.read("generation.enc"), encrypted);
    assert.equal(await readFile(join(storageDirectory, "generation.enc"), "utf8"), encrypted);
    assert.ok(!(await readFile(join(storageDirectory, "generation.enc"), "utf8")).includes(PRIVATE));
    await assert.rejects(storage.write("generation.enc", "replacement", true));
    assert.equal(await storage.read("generation.enc"), encrypted);
});

test("F06-S02 ciphertext replacement preserves other owned files and leaves no completed temporary write", async () => {
    await storage.write("vault.enc", encrypted, true); await storage.write("retained.enc", encrypted, true);
    const next = await encryptVault(PRIVATE + "-next", KEY); await storage.write("vault.enc", next);
    assert.equal(await storage.read("vault.enc"), next); assert.equal(await storage.read("retained.enc"), encrypted);
    assert.deepEqual((await readdir(storageDirectory)).sort(), ["retained.enc", "vault.enc"]);
});

test("F06-S03 missing owned encrypted files read as absent without creating storage or unrelated files", async () => {
    assert.equal(await storage.read("absent.enc"), undefined);
    await assert.rejects(lstat(storageDirectory), (error: unknown) => (error as { code?: string }).code === "ENOENT");
});

test("F06-S04 write and read budgets accept exact bounded bytes and reject overflow without replacing the file", async () => {
    const exact = "A".repeat(VAULT_LIMIT); await storage.write("bounded.enc", exact, true);
    assert.equal((await storage.read("bounded.enc"))?.length, VAULT_LIMIT);
    await assert.rejects(storage.write("bounded.enc", exact + "B")); assert.equal(await storage.read("bounded.enc"), exact);
    await assert.rejects(storage.read("bounded.enc", VAULT_LIMIT - 1));
    await assert.rejects(storage.write("utf8-overflow.enc", "é".repeat(VAULT_LIMIT / 2 + 1), true));
    assert.deepEqual(await readdir(storageDirectory), ["bounded.enc"]);
});

test("F06-S05 removal requires exact issued ciphertext bytes and preserves a changed file", async () => {
    await storage.write("generation.enc", encrypted, true);
    await assert.rejects(storage.remove("generation.enc", "different-issued-ciphertext"));
    assert.equal(await storage.read("generation.enc"), encrypted);
    await storage.remove("generation.enc", encrypted); assert.equal(await storage.read("generation.enc"), undefined);
});

test("F06-S06 a successful owned mutation runs under an exclusive live lock and releases only that lock", async () => {
    const result = await storage.lock(async () => {
        const lock = vaultObject(vaultJson((await storage.read("vault-mutation.lock"))!), ["schemaVersion", "pid", "nonce"]);
        assert.equal(lock.schemaVersion, 1); assert.equal(lock.pid, process.pid); assert.equal(typeof lock.nonce, "string");
        await storage.write("vault.enc", encrypted, true); return "completed";
    });
    assert.equal(result, "completed"); assert.equal(await storage.read("vault-mutation.lock"), undefined);
    assert.equal(await storage.read("vault.enc"), encrypted);
});

test("F06-S07 operation failure releases its own lock and never rolls encrypted content back to plaintext", async () => {
    await storage.write("vault.enc", encrypted, true);
    await assert.rejects(storage.lock(async () => { throw new Error("Synthetic mutation interruption."); }));
    assert.equal(await storage.read("vault-mutation.lock"), undefined); assert.equal(await storage.read("vault.enc"), encrypted);
    assert.ok(!(await readFile(join(storageDirectory, "vault.enc"), "utf8")).includes(PRIVATE));
});

test("F06-S08 a live process-owned lock is withheld without executing or replacing its bytes", async () => {
    await mkdir(storageDirectory); const content = owner(); await writeFile(join(storageDirectory, "vault-mutation.lock"), content, { flag: "wx" });
    let executions = 0; await assert.rejects(storage.lock(async () => { executions++; }), unavailable);
    assert.equal(executions, 0); assert.equal(await storage.read("vault-mutation.lock"), content);
});

test("F06-S09 simultaneous same-process mutation cannot bypass the exclusive storage lock", async () => {
    const entered = deferred(), release = deferred(); let secondRuns = 0;
    const first = storage.lock(async () => { entered.resolve(); await release.promise; return "first"; });
    try {
        await entered.promise;
        await assert.rejects(new VaultStorage(storageDirectory).lock(async () => { secondRuns++; }));
        assert.equal(secondRuns, 0);
    } finally { release.resolve(); await first; }
    assert.equal(await storage.read("vault-mutation.lock"), undefined);
});

for (const [name, content] of [["malformed JSON", "not-json"], ["unknown owner fields", JSON.stringify({ schemaVersion: 1, pid: process.pid, nonce: NONCE, extra: true })],
    ["unsupported owner schema", JSON.stringify({ schemaVersion: 2, pid: process.pid, nonce: NONCE })],
    ["invalid owner identity", JSON.stringify({ schemaVersion: 1, pid: -1, nonce: NONCE })],
    ["invalid nonce", JSON.stringify({ schemaVersion: 1, pid: process.pid, nonce: "not-issued" })]] as const) {
    test(`F06-S10 ${name} keeps uncertain lock ownership withheld and unchanged`, async () => {
        await mkdir(storageDirectory); await writeFile(join(storageDirectory, "vault-mutation.lock"), content, { flag: "wx" });
        let executions = 0; await assert.rejects(storage.lock(async () => { executions++; }));
        assert.equal(executions, 0); assert.equal(await storage.read("vault-mutation.lock"), content);
    });
}

test("F06-S11 strict JSON rejects duplicate decoded keys including escaped and nested names", () => {
    for (const text of ['{"schemaVersion":1,"schemaVersion":1}', '{"schemaVersion":1,"\\u0073chemaVersion":1}',
        '{"outer":{"pid":1,"pid":2}}', '[{"pid":1,"pid":2}]', "", "null trailing"])
        assert.throws(() => vaultJson(text));
    assert.deepEqual(vaultJson('{"outer":[{"pid":1},{"pid":2}],"literal":"pid:3"}'),
        { outer: [{ pid: 1 }, { pid: 2 }], literal: "pid:3" });
});

test("F06-S12 strict record objects reject unknown or missing keys and unsupported prototypes", () => {
    for (const value of [null, [], "record", { allowed: 1, unknown: 2 }, {}, Object.create({ allowed: 1 })])
        assert.throws(() => vaultObject(value, ["allowed"]));
    assert.deepEqual(vaultObject({ required: 1 }, ["required", "optional"], ["required"]), { required: 1 });
    const plain = Object.assign(Object.create(null) as Record<string, unknown>, { allowed: 1 });
    assert.equal(vaultObject(plain, ["allowed"]).allowed, 1);
});

test("F06-S13 workspace-contained storage is rejected before creating a storage tree or writing ciphertext", async () => {
    const inside = join(project, "unexpected-vault-storage");
    await assert.rejects(new VaultStorage(inside).write("vault.enc", encrypted, true));
    await assert.rejects(lstat(inside), (error: unknown) => (error as { code?: string }).code === "ENOENT");
    assert.deepEqual(await readdir(project), []);
});

test("F06-S14 relative directories and traversal/invalid names never write outside owned storage", async () => {
    await assert.rejects(new VaultStorage("relative-unissued-storage").write("vault.enc", encrypted, true));
    for (const name of [".", "..", "../unrelated/sentinel.txt", "nested/vault.enc", "nested\\vault.enc", "bad:name", "a".repeat(161)])
        await assert.rejects(storage.write(name, encrypted, true));
    assert.equal(await readFile(join(unrelated, "sentinel.txt"), "utf8"), SENTINEL);
    assert.deepEqual(await readdir(unrelated), ["sentinel.txt"]);
});

test("F06-S15 a storage-directory junction or symlink is withheld without writing its canonical target", async t => {
    await mkdir(storageDirectory); const alias = join(container, "storage-alias");
    if (!await optionalLink(t, () => symlink(storageDirectory, alias, process.platform === "win32" ? "junction" : "dir"))) return;
    await assert.rejects(new VaultStorage(alias).write("vault.enc", encrypted, true));
    assert.deepEqual(await readdir(storageDirectory), []);
});

test("F06-S16 a storage ancestor alias is rejected before creating a child through that alias", async t => {
    const realParent = join(container, "real-parent"), alias = join(container, "parent-alias"); await mkdir(realParent);
    if (!await optionalLink(t, () => symlink(realParent, alias, process.platform === "win32" ? "junction" : "dir"))) return;
    await assert.rejects(new VaultStorage(join(alias, "child-storage")).write("vault.enc", encrypted, true));
    assert.deepEqual(await readdir(realParent), []);
});

test("F06-S17 a canonical workspace alias cannot make storage appear outside the active project", async t => {
    await mkdir(storageDirectory); const workspaceAlias = join(container, "workspace-alias");
    if (!await optionalLink(t, () => symlink(storageDirectory, workspaceAlias, process.platform === "win32" ? "junction" : "dir"))) return;
    stub.setWorkspace(workspaceAlias);
    await assert.rejects(storage.write("vault.enc", encrypted, true)); assert.deepEqual(await readdir(storageDirectory), []);
});

test("F06-S18 multiply linked encrypted files cannot be read, replaced or removed through storage", async t => {
    await storage.write("vault.enc", encrypted, true); const second = join(container, "second-ciphertext.enc");
    if (!await optionalLink(t, () => link(join(storageDirectory, "vault.enc"), second))) return;
    await assert.rejects(storage.read("vault.enc")); await assert.rejects(storage.write("vault.enc", "replacement"));
    await assert.rejects(storage.remove("vault.enc", encrypted));
    assert.equal(await readFile(second, "utf8"), encrypted); assert.equal(await readFile(join(storageDirectory, "vault.enc"), "utf8"), encrypted);
});

test("F06-S19 bounded source reads preserve BOM/UTF-8 text and reject byte overflow", async () => {
    const source = join(project, "synthetic.txt"), exact = "é".repeat(32_768); await writeFile(source, exact, { flag: "wx" });
    const captured = await readVaultFile(source); assert.equal(captured.text, exact); assert.equal(typeof captured.identity, "string");
    assert.ok(captured.identity.length > 0); await assert.rejects(readVaultFile(source, 65_535));
    await writeFile(source, "\uFEFFPublic UTF-8 control.\r\n"); assert.equal((await readVaultFile(source)).text, "\uFEFFPublic UTF-8 control.\r\n");
    await writeFile(source, "é".repeat(32_769)); await assert.rejects(readVaultFile(source));
});

test("F06-S20 malformed UTF-8 and binary/control source bytes are withheld without rewriting originals", async () => {
    const source = join(project, "synthetic.txt");
    for (const bytes of [Buffer.from([0xff, 0xfe]), Buffer.from("Public\0" + PRIVATE), Buffer.from("Public\x1b" + PRIVATE), Buffer.from([0xc3, 0x28])]) {
        await writeFile(source, bytes); await assert.rejects(readVaultFile(source)); assert.deepEqual(await readFile(source), bytes);
    }
});

test("F06-S21 multiple source hardlinks cannot become an approved source read", async t => {
    const source = join(project, "source.txt"), alias = join(project, "source-hardlink.txt"); await writeFile(source, PRIVATE, { flag: "wx" });
    if (!await optionalLink(t, () => link(source, alias))) return;
    await assert.rejects(readVaultFile(source)); await assert.rejects(readVaultFile(alias));
    assert.equal(await readFile(source, "utf8"), PRIVATE);
});

test("F06-S22 source file symlinks are rejected before their private target can be read", async t => {
    const source = join(project, "source.txt"), alias = join(project, "source-symlink.txt"); await writeFile(source, PRIVATE, { flag: "wx" });
    if (!await optionalLink(t, () => symlink(source, alias, "file"))) return;
    await assert.rejects(readVaultFile(alias)); assert.equal(await readFile(source, "utf8"), PRIVATE);
});
