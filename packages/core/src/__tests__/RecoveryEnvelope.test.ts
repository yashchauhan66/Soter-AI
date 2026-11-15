import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { createRecoveryEnvelope, inspectRecoveryEnvelope, openRecoveryEnvelope, RecoveryEnvelopeError,
    RECOVERY_ENVELOPE_LIMITS } from "../RecoveryEnvelope";

// Invented fixture material only; the archive represents encrypted store records.
const PASSPHRASE = "synthetic-test-only-recovery-password-739216";
const key = Buffer.alloc(32, 0x6d);
const archive = Buffer.from('{"vault.enc":"synthetic-encrypted-record-739216"}', "utf8");
const sha = (value: Uint8Array) => createHash("sha256").update(value).digest("hex");
const encode = (value: unknown) => Buffer.from(JSON.stringify(value), "utf8");
const parse = (bytes: Uint8Array) => JSON.parse(Buffer.from(bytes).toString("utf8"));
const rejected = (error: unknown): boolean => {
    assert.ok(error instanceof RecoveryEnvelopeError);
    assert.equal(error.code, "recovery_unavailable");
    assert.equal(error.message, "Recovery envelope unavailable. Check the recovery file and passphrase.");
    assert.ok(!error.message.includes(PASSPHRASE));
    return true;
};

test("authenticated round trip preserves key and exact encrypted archive without exposing either in inspection", async () => {
    const bytes = await createRecoveryEnvelope({ vaultKey: key, archive }, PASSPHRASE);
    const inspection = inspectRecoveryEnvelope(bytes);
    assert.deepEqual(Object.keys(inspection).sort(), ["byteLength", "envelopeSha256", "version"]);
    assert.equal(inspection.envelopeSha256, sha(bytes));
    assert.equal(Object.isFrozen(inspection), true);
    const wire = Buffer.from(bytes).toString("utf8");
    for (const value of [key.toString("base64"), archive.toString("utf8"), archive.toString("base64"), PASSPHRASE]) {
        assert.equal(wire.includes(value), false);
    }
    const opened = await openRecoveryEnvelope(bytes, PASSPHRASE, inspection.envelopeSha256);
    assert.deepEqual(opened.vaultKey, key);
    assert.deepEqual(opened.archive, archive);
    assert.equal(opened.archiveSha256, sha(archive));
    assert.equal(Object.isFrozen(opened), true);
    opened.vaultKey.fill(0); opened.archive.fill(0);
    assert.notEqual(key[0], 0);
    assert.notEqual(archive[0], 0);
});

test("fresh salt and nonce prevent identical exports from reusing a derived key or GCM nonce", async () => {
    const first = parse(await createRecoveryEnvelope({ vaultKey: key, archive }, PASSPHRASE));
    const second = parse(await createRecoveryEnvelope({ vaultKey: key, archive }, PASSPHRASE));
    assert.notEqual(first.kdf.salt, second.kdf.salt);
    assert.notEqual(first.cipher.nonce, second.cipher.nonce);
    assert.notEqual(first.ciphertext, second.ciphertext);
    assert.equal(Buffer.from(first.kdf.salt, "base64").length, 16);
    assert.equal(Buffer.from(first.cipher.nonce, "base64").length, 12);
    assert.equal(Buffer.from(first.tag, "base64").length, 16);
});

test("wrong passphrase, ciphertext, tag and authenticated header tampering all reject generically", async () => {
    const bytes = await createRecoveryEnvelope({ vaultKey: key, archive }, PASSPHRASE);
    await assert.rejects(openRecoveryEnvelope(bytes, PASSPHRASE + "-wrong", sha(bytes)), rejected);
    for (const field of ["ciphertext", "tag", "salt", "nonce"]) {
        const value = parse(bytes);
        const record = field === "salt" ? value.kdf : field === "nonce" ? value.cipher : value;
        const altered = Buffer.from(record[field], "base64"); altered[0] ^= 1;
        record[field] = altered.toString("base64");
        const changed = encode(value);
        // Rebinding the public hash must not bypass GCM authentication.
        assert.doesNotThrow(() => inspectRecoveryEnvelope(changed));
        await assert.rejects(openRecoveryEnvelope(changed, PASSPHRASE, sha(changed)), rejected);
    }
});

test("review digest binds immutable input snapshots across asynchronous key derivation", async () => {
    const localKey = Buffer.from(key), localArchive = Buffer.from(archive);
    const creating = createRecoveryEnvelope({ vaultKey: localKey, archive: localArchive }, PASSPHRASE);
    localKey.fill(0); localArchive.fill(0);
    const bytes = Buffer.from(await creating), expected = sha(bytes);
    await assert.rejects(openRecoveryEnvelope(bytes, PASSPHRASE, "0".repeat(64)), rejected);
    const opening = openRecoveryEnvelope(bytes, PASSPHRASE, expected);
    bytes.fill(0);
    const opened = await opening;
    assert.deepEqual(opened.vaultKey, key);
    assert.deepEqual(opened.archive, archive);
    opened.vaultKey.fill(0); opened.archive.fill(0);
});

test("strict format rejects unknown or duplicate keys, alternate JSON and attacker-selected KDF work", async () => {
    const bytes = await createRecoveryEnvelope({ vaultKey: key, archive }, PASSPHRASE), text = Buffer.from(bytes).toString("utf8");
    const invalid: Uint8Array[] = [
        Buffer.from(text.replace('"schemaVersion":1', '"schemaVersion":1,"schemaVersion":1')),
        Buffer.from(text.replace('"N":32768', '"N":32768,"N":32768')),
        Buffer.from(" " + text), Buffer.from(text + "\n"), Buffer.from([0xc0, 0xaf]),
        Buffer.from('{"kdf":' + '['.repeat(4096) + '0' + ']'.repeat(4096) + '}'),
        Buffer.from('{"kdf":' + '{"nested":'.repeat(4096) + '0' + '}'.repeat(4096) + '}'),
        encode({ ...parse(bytes), owner: "untrusted-extra-field" }),
        encode({ ...parse(bytes), schemaVersion: 2 }),
        encode({ ...parse(bytes), purpose: "another-format" }),
        encode({ ...parse(bytes), tag: parse(bytes).tag.replace(/=$/, "") }),
        encode({ ...parse(bytes), ciphertext: "AAAA" }),
        Buffer.alloc(RECOVERY_ENVELOPE_LIMITS.maxEnvelopeBytes + 1),
    ];
    for (const [field, value] of [["N", 1048576], ["r", 1000], ["p", 1000], ["name", "pbkdf2"], ["maxmem", 1024]] as const) {
        const item = parse(bytes); item.kdf[field] = value; invalid.push(encode(item));
    }
    for (const input of invalid) assert.throws(() => inspectRecoveryEnvelope(input), rejected);
});

test("input bounds and passphrase encoding reject before producing an envelope", async () => {
    for (const input of [
        { vaultKey: Buffer.alloc(31), archive }, { vaultKey: Buffer.alloc(33), archive },
        { vaultKey: key, archive: Buffer.alloc(0) },
        { vaultKey: key, archive: Buffer.alloc(RECOVERY_ENVELOPE_LIMITS.maxArchiveBytes + 1) },
        { vaultKey: new Uint8Array(new SharedArrayBuffer(32)), archive },
    ]) await assert.rejects(createRecoveryEnvelope(input, PASSPHRASE), rejected);
    for (const password of ["short", "a".repeat(1025), "\ud800" + "a".repeat(16), "\u{1f642}".repeat(257)]) {
        await assert.rejects(createRecoveryEnvelope({ vaultKey: key, archive }, password), rejected);
    }
});

test("the declared maximum encrypted archive round-trips within the envelope limit", async () => {
    const large = Buffer.alloc(RECOVERY_ENVELOPE_LIMITS.maxArchiveBytes, 0xa7);
    const bytes = await createRecoveryEnvelope({ vaultKey: key, archive: large }, PASSPHRASE);
    assert.ok(bytes.byteLength <= RECOVERY_ENVELOPE_LIMITS.maxEnvelopeBytes);
    const opened = await openRecoveryEnvelope(bytes, PASSPHRASE, inspectRecoveryEnvelope(bytes).envelopeSha256);
    assert.equal(opened.archiveSha256, sha(large));
    assert.deepEqual(opened.archive, large);
    opened.vaultKey.fill(0); opened.archive.fill(0);
});

test("concurrent KDF work is capped without an unbounded queue", async () => {
    const first = createRecoveryEnvelope({ vaultKey: key, archive }, PASSPHRASE);
    const second = createRecoveryEnvelope({ vaultKey: key, archive }, PASSPHRASE);
    const rejectedThird = assert.rejects(createRecoveryEnvelope({ vaultKey: key, archive }, PASSPHRASE), rejected);
    await Promise.all([first, second, rejectedThird]);
    // Slots are released on completion, so subsequent work remains available.
    const next = await createRecoveryEnvelope({ vaultKey: key, archive }, PASSPHRASE);
    assert.equal(inspectRecoveryEnvelope(next).version, 1);
});
