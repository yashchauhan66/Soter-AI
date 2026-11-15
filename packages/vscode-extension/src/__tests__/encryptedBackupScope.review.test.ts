import "./phase2/register.mjs";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join, relative, isAbsolute, sep } from "node:path";
import { test, type TestContext } from "node:test";
import { generateVaultKey, encryptVault, decryptVault } from "@soterai/guard-core";
import * as stub from "./phase2/vscode-stub";

// ADDITIVE TEST FIRST: actual canonical AES-GCM, in-memory SecretStorage and
// workspace.fs maps through the established Lite vscode shim. No real files,
// profiles, SecretStorage provider, credentials, child, network or deletion.
const LEGACY = "soterai.configBackupKey", PREFIX = "soterai.configBackupKey.v1.";
const SCOPE_A = "aa111111-1111-4111-8111-111111111111", SCOPE_B = "bb222222-2222-4222-9222-222222222222";
const PRIVATE = "TEST_ONLY_F26A_ENCRYPTED_BACKUP_PRIVATE_f0b6a421";
interface Sink { store(originalPath: string, content: string): Promise<string>; retrieve(handle: string): Promise<string | null> }
type Factory = new (context: unknown, options?: unknown) => Sink;
interface Write { uri: stub.Uri; bytes: Buffer }
async function fixture(t: TestContext) {
    const base = join(tmpdir(), "soter-f26a-encrypted-scope-" + randomUUID()), workspace = join(base, "workspace"), profile = join(base, "profile");
    stub.resetState(workspace); const context = stub.makeExtensionContext(profile);
    const files = new Map<string, Buffer>(), keys = context._inspect.secretStore;
    const gets: string[] = [], stores: { key: string; value: string }[] = [], deletes: string[] = [], reads: stub.Uri[] = [], writes: Write[] = [], directories: stub.Uri[] = [], other: string[] = [];
    const errors = { read: false, get: false };
    t.mock.method(context.secrets, "get", async (key: string) => { gets.push(key); if (errors.get) throw Error(PRIVATE); return keys.get(key); });
    t.mock.method(context.secrets, "store", async (key: string, value: string) => { stores.push({ key, value }); keys.set(key, value); });
    t.mock.method(context.secrets, "delete", async (key: string) => { deletes.push(key); keys.delete(key); });
    t.mock.method(stub.workspace.fs, "createDirectory", async (uri: stub.Uri) => { directories.push(uri); });
    t.mock.method(stub.workspace.fs, "writeFile", async (uri: stub.Uri, content: Uint8Array) => {
        const bytes = Buffer.from(content); writes.push({ uri, bytes }); files.set(uri.toString(), Buffer.from(bytes));
    });
    t.mock.method(stub.workspace.fs, "readFile", async (uri: stub.Uri) => {
        reads.push(uri); if (errors.read) throw Error(PRIVATE); const bytes = files.get(uri.toString());
        if (!bytes) throw Error("Synthetic in-memory backup does not exist."); return new Uint8Array(Buffer.from(bytes));
    });
    // Intercept every remaining filesystem entry so this suite cannot fall
    // through to the shim's real filesystem bridge, even on a product error.
    for (const name of ["stat", "delete", "rename", "readDirectory"] as const)
        t.mock.method(stub.workspace.fs, name, async (..._args: unknown[]) => { other.push(name); throw Error("Synthetic backup filesystem operation unavailable."); });
    const module = await import("../broker/EncryptedBackupSink");
    assert(typeof module.EncryptedBackupSink === "function", "Canonical backup sink must be available.");
    const Constructor = module.EncryptedBackupSink as unknown as Factory, original = join(workspace, ".git", "hooks", PRIVATE + "-pre-commit");
    return { Constructor, context, workspace, profile, original, files, keys, gets, stores, deletes, reads, writes, directories, other, errors,
        sink(options?: unknown) { return new Constructor(context, options); },
        reset() { gets.length = stores.length = deletes.length = reads.length = writes.length = directories.length = other.length = 0; },
        assertNoIO() { assert(gets.length === 0 && stores.length === 0 && deletes.length === 0 && reads.length === 0 && writes.length === 0 && directories.length === 0 && other.length === 0,
            "Invalid scope must refuse before every key or filesystem operation."); },
        assertNoWrites() { assert(stores.length === 0 && deletes.length === 0 && writes.length === 0 && directories.length === 0 && other.length === 0,
            "Retrieval refusal cannot create/replace a key, backup, directory or other filesystem state."); } };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
function onlyCiphertext(f: Fixture, handle: string): void {
    assert(/^[a-f0-9]{32}$/.test(handle), "Backup handle must remain an opaque finite hex basename.");
    assert(f.writes.length === 1, "One store must emit one encrypted backup.");
    const write = f.writes[0], rel = relative(f.workspace, write.uri.fsPath);
    assert((rel === ".." || rel.startsWith(".." + sep) || isAbsolute(rel))
        && write.uri.fsPath.startsWith(f.context.globalStorageUri.fsPath + sep), "Ciphertext belongs to private global storage outside the workspace.");
    assert(write.uri.fsPath.endsWith(handle + ".enc") && !write.uri.toString().includes(PRIVATE), "Public restore metadata cannot reveal the original private path.");
    assert(!write.bytes.includes(Buffer.from(PRIVATE)) && !write.bytes.includes(Buffer.from(f.original)), "Only encrypted path/content may reach backup filesystem bytes.");
}
async function seedLegacy(f: Fixture, content: string, keepKey: boolean): Promise<string> {
    const key = generateVaultKey(), handle = "c".repeat(32), encrypted = await encryptVault(JSON.stringify({ version: 1, originalPath: f.original, content }), key);
    const uri = stub.Uri.joinPath(f.context.globalStorageUri, "config-backups", handle + ".enc");
    f.files.set(uri.toString(), Buffer.from(encrypted)); if (keepKey) f.keys.set(LEGACY, key); return handle;
}

test("F26a scoped backup uses exact scoped SecretStorage key and keeps path content inside ciphertext", async t => {
    const f = await fixture(t), sink = f.sink({ scope: SCOPE_A }), handle = await sink.store(f.original, PRIVATE);
    assert(f.stores.length === 1 && f.stores[0].key === PREFIX + SCOPE_A && f.keys.size === 1 && !f.keys.has(LEGACY), "Scoped storage cannot create or borrow the legacy key namespace.");
    assert(f.gets.length > 0 && f.gets.every(key => key === PREFIX + SCOPE_A), "Only the selected scope may supply backup key material."); onlyCiphertext(f, handle);
    const key = f.keys.get(PREFIX + SCOPE_A); assert(key && Buffer.from(key, "base64").length === 32, "Canonical AES-256 key belongs only to synthetic SecretStorage.");
    const payload = JSON.parse(await decryptVault(f.writes[0].bytes.toString("utf8"), key));
    assert(payload.version === 1 && payload.originalPath === f.original && payload.content === PRIVATE, "The actual encrypted envelope must retain exact path/content for reviewed recovery.");
    assert(await sink.retrieve(handle) === PRIVATE, "Scoped encrypted backup must read back exactly.");
});
test("F26a independent backup scopes generate and load separate keys within one extension context", async t => {
    const f = await fixture(t), a = f.sink({ scope: SCOPE_A }), b = f.sink({ scope: SCOPE_B });
    await a.store(f.original, "A:" + PRIVATE); await b.store(f.original, "B:" + PRIVATE);
    assert(f.keys.size === 2 && f.keys.has(PREFIX + SCOPE_A) && f.keys.has(PREFIX + SCOPE_B) && !f.keys.has(LEGACY), "Each installation scope must have its own key record.");
    assert(f.keys.get(PREFIX + SCOPE_A) !== f.keys.get(PREFIX + SCOPE_B), "Independent scopes cannot share generated encryption keys.");
    assert(f.stores.length === 2 && new Set(f.stores.map(value => value.key)).size === 2, "Exactly the two scoped key records may be created.");
});
test("F26a crossscope identical first backups have distinct handles no overwrite and no crossscope restore", async t => {
    const f = await fixture(t), a = f.sink({ scope: SCOPE_A }), b = f.sink({ scope: SCOPE_B });
    const first = await a.store(f.original, PRIVATE), firstFile = f.writes[0], retained = Buffer.from(firstFile.bytes), second = await b.store(f.original, PRIVATE);
    assert(first !== second && f.files.size === 2 && f.writes[0].uri.toString() !== f.writes[1].uri.toString(), "Independent scopes with identical source/content and first use must not overwrite another encrypted backup.");
    assert(f.files.get(firstFile.uri.toString())?.equals(retained), "Second scope must preserve first scope ciphertext bytes.");
    assert(await a.retrieve(first) === PRIVATE && await b.retrieve(second) === PRIVATE, "Both independent recovery records must remain readable.");
    f.reset(); assert(await b.retrieve(first) === null && await a.retrieve(second) === null, "A backup handle cannot borrow another scope's encryption authority."); f.assertNoWrites();
});
test("F26a reconstructed scoped sink loads its existing key and exact retained backup without key creation", async t => {
    const f = await fixture(t), first = f.sink({ scope: SCOPE_A }), handle = await first.store(f.original, PRIVATE), key = f.keys.get(PREFIX + SCOPE_A);
    f.reset(); const restarted = f.sink({ scope: SCOPE_A });
    assert(await restarted.retrieve(handle) === PRIVATE && f.keys.get(PREFIX + SCOPE_A) === key, "New sink instance must retain the same scoped encrypted recovery authority.");
    assert(f.gets.length > 0 && f.gets.every(name => name === PREFIX + SCOPE_A), "Recovery must load only its existing scoped key."); f.assertNoWrites();
});
test("F26a backup preserves opaque absence hook bytes and mode encoded payload without adding a mode API", async t => {
    const f = await fixture(t), sink = f.sink({ scope: SCOPE_A });
    const bytes = Buffer.concat([Buffer.from("#!/bin/sh\r\n#" + PRIVATE + "\r\nexit 7\r\n"), Buffer.from([0, 255, 128])]);
    const records = [{ version: 1, present: false, mode: null, bytes: null }, { version: 1, present: true, mode: 0o100755, bytes: bytes.toString("base64") }];
    for (const record of records) {
        const text = JSON.stringify(record), handle = await sink.store(f.original, text), returned = await sink.retrieve(handle);
        assert(returned === text, "Encrypted backup must preserve the caller's complete opaque serialized recovery record byte for byte.");
        const decoded = JSON.parse(returned); assert(decoded.present === record.present && decoded.mode === record.mode && decoded.bytes === record.bytes, "Absence and applicable encoded mode/body must survive exact readback.");
        if (decoded.present) assert(Buffer.from(decoded.bytes, "base64").equals(bytes), "Binary and CRLF hook payload bytes must remain exact inside the opaque encrypted record.");
    }
});
test("F26a missing scoped recovery key never creates a replacement or falls back to legacy authority", async t => {
    const f = await fixture(t), sink = f.sink({ scope: SCOPE_A }), handle = await sink.store(f.original, PRIVATE), old = f.keys.get(PREFIX + SCOPE_A);
    assert(old, "Positive scoped key must exist before the missing-key control."); f.keys.delete(PREFIX + SCOPE_A); f.keys.set(LEGACY, old); f.reset();
    assert(await sink.retrieve(handle) === null, "Missing scoped key must fail even if the legacy namespace contains matching material.");
    assert(f.gets.length > 0 && f.gets.every(key => key === PREFIX + SCOPE_A), "Missing scoped recovery cannot query legacy key authority."); f.assertNoWrites();
    assert(!f.keys.has(PREFIX + SCOPE_A), "Failed restore must leave the missing scoped key missing.");
});
test("F26a corrupt scoped keys and authenticated ciphertext refuse without key or backup writes", async t => {
    for (const kind of ["malformed-key", "wrong-key", "ciphertext"] as const) {
        const f = await fixture(t), sink = f.sink({ scope: SCOPE_A }), handle = await sink.store(f.original, PRIVATE);
        if (kind === "malformed-key") f.keys.set(PREFIX + SCOPE_A, "corrupt-synthetic-key");
        else if (kind === "wrong-key") f.keys.set(PREFIX + SCOPE_A, generateVaultKey());
        else {
            const file = f.writes[0].uri.toString(), bytes = Buffer.from(f.files.get(file)!.toString("utf8"), "base64"); bytes[bytes.length - 1] ^= 1;
            f.files.set(file, Buffer.from(bytes.toString("base64")));
        }
        f.reset(); assert(await sink.retrieve(handle) === null, "Corrupt key/authenticated payload must not produce plaintext or create replacement state."); f.assertNoWrites();
    }
});
test("F26a recovery missing file filesystem and SecretStorage read failures return null without mutation", async t => {
    for (const kind of ["missing-file", "read", "get"] as const) {
        const f = await fixture(t), sink = f.sink({ scope: SCOPE_A }), handle = await sink.store(f.original, PRIVATE);
        if (kind === "missing-file") f.files.delete(f.writes[0].uri.toString());
        else f.errors[kind] = true;
        f.reset(); assert(await sink.retrieve(handle) === null, "Missing files and read-side recovery errors must remain fixed refusal."); f.assertNoWrites();
    }
});
test("F26a default and explicitundefined sink retain legacy key namespace and existing encrypted backup readability", async t => {
    const f = await fixture(t), handle = await seedLegacy(f, PRIVATE, true), existing = f.keys.get(LEGACY);
    const omitted = new f.Constructor(f.context), explicit = f.sink(undefined);
    assert(await omitted.retrieve(handle) === PRIVATE && await explicit.retrieve(handle) === PRIVATE, "Already encrypted legacy backups must remain readable through both default constructor routes.");
    assert(f.gets.length > 0 && f.gets.every(key => key === LEGACY) && f.keys.get(LEGACY) === existing, "Default constructor cannot silently migrate or replace the legacy key."); f.assertNoWrites();
    const newHandle = await omitted.store(f.original, "new:" + PRIVATE);
    assert(await omitted.retrieve(newHandle) === "new:" + PRIVATE && f.keys.size === 1 && f.stores.length === 0, "New default backups must reuse the existing legacy key with the unchanged API.");
});
test("F26a missing legacy recovery key returns null without creating a new SecretStorage key", async t => {
    const f = await fixture(t), handle = await seedLegacy(f, PRIVATE, false), sink = new f.Constructor(f.context);
    assert(await sink.retrieve(handle) === null && f.keys.size === 0, "Missing legacy key must remain absent during failed retrieval."); f.assertNoWrites();
});
test("F26a invalid explicit scope options proxies and accessors stay inert without coercion or key file I/O", async t => {
    const f = await fixture(t); let traps = 0, message: string | undefined;
    const poison = Object.create(null);
    for (const key of ["toString", "valueOf", Symbol.toPrimitive]) Object.defineProperty(poison, key, { get() { traps++; throw Error(PRIVATE); } });
    const accessor = Object.defineProperty({}, "scope", { enumerable: true, get() { traps++; throw Error(PRIVATE); } });
    const proxy = new Proxy({ scope: SCOPE_A }, { get() { traps++; throw Error(PRIVATE); }, ownKeys() { traps++; throw Error(PRIVATE); },
        getPrototypeOf() { traps++; throw Error(PRIVATE); }, getOwnPropertyDescriptor() { traps++; throw Error(PRIVATE); } });
    const invalid: unknown[] = [null, false, 1, SCOPE_A, [], {}, { scope: "" }, { scope: SCOPE_A.toUpperCase() },
        { scope: "aa111111-1111-1111-8111-111111111111" }, { scope: SCOPE_A + PRIVATE }, { scope: SCOPE_A, extra: true },
        Object.create({ scope: SCOPE_A }), { scope: poison }, accessor, proxy];
    for (const value of invalid) {
        let sink!: Sink; assert.doesNotThrow(() => { sink = f.sink(value); }, "Invalid scope construction must remain inert so recovery can report fixed unavailable state.");
        await assert.rejects(sink.store(f.original, PRIVATE), error => {
            if (!(error instanceof Error) || !error.message || error.message.length > 256 || error.message.includes(PRIVATE)) return false;
            message ??= error.message; return error.message === message;
        }, "Every invalid scope must reject store with the same fixed sanitized error.");
        assert(await sink.retrieve("d".repeat(32)) === null, "Invalid scope retrieval cannot fall through to default authority."); f.assertNoIO();
    }
    assert(traps === 0, "Scope admission must not invoke proxy traps, option accessors or coercion hooks.");
});
test("F26a scoped and legacy invalid handle strings refuse before key or filesystem access", async t => {
    const f = await fixture(t), sinks = [f.sink({ scope: SCOPE_A }), new f.Constructor(f.context)];
    for (const sink of sinks) for (const handle of ["", "..", "../" + "a".repeat(32), "A".repeat(32), "a".repeat(31), "a".repeat(33), "a".repeat(32) + ".enc", "a".repeat(32) + "\n"])
        assert(await sink.retrieve(handle) === null, "Invalid handle text cannot select a backup path.");
    f.assertNoIO();
});
