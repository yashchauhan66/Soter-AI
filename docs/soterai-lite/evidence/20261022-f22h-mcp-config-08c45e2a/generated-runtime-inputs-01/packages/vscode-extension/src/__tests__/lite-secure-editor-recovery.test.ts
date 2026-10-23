import assert from "node:assert/strict";
import { test } from "node:test";
import { encryptEditorRecovery, decryptEditorRecovery } from "../project-privacy/SecureEditorRecovery";

// Cipher tests use generated-looking fixed synthetic keys and in-memory strings.
// No credential store, actual user file, temporary plaintext or external service.
const SOURCE = "file:///C:/synthetic-f05-project/.env";
const ROOT = "file:///C:/synthetic-f05-project";
const PRIVATE = "SYNTHETIC_F05_RECOVERY_PRIVATE_VALUE_20261014";
const KEY = Buffer.from("0123456789abcdef".repeat(4), "hex");
const binding = { source: SOURCE, root: ROOT };
function payload() {
    return { schemaVersion: 1 as const, source: SOURCE, root: ROOT,
        savedText: `DATABASE_URL=${PRIVATE}\n`, draftText: `DATABASE_URL=${PRIVATE}-edited\n`,
        fileIdentity: "synthetic-device-inode-size-time" };
}
function decoded(envelope: string): Record<string, unknown> {
    return JSON.parse(envelope) as Record<string, unknown>;
}
function changed(envelope: string, field: string, value: unknown): string {
    return JSON.stringify({ ...decoded(envelope), [field]: value });
}
function flipBase64(envelope: string, field: string): string {
    const bytes = Buffer.from(decoded(envelope)[field] as string, "base64");
    assert.ok(bytes.length > 0); bytes[0] ^= 1;
    return changed(envelope, field, bytes.toString("base64"));
}

test("F05-R01 encrypted recovery round-trips its strict private payload without serialized plaintext or key", () => {
    const original = payload(); const envelope = encryptEditorRecovery(original, KEY);
    assert.equal(typeof envelope, "string"); assert.deepEqual(decryptEditorRecovery(envelope, KEY, binding), original);
    assert.ok(!envelope.includes(PRIVATE)); assert.ok(!envelope.includes(original.savedText));
    assert.ok(!envelope.includes(original.draftText)); assert.ok(!envelope.includes(KEY.toString("hex")));
    assert.ok(!envelope.includes(KEY.toString("base64")));
    assert.ok(Buffer.byteLength(envelope, "utf8") <= 512 * 1024);
    const header = decoded(envelope);
    assert.equal(header.schemaVersion, 1); assert.equal(header.source, SOURCE); assert.equal(header.root, ROOT);
});

test("F05-R02 repeated payloads use fresh 12-byte nonces and 16-byte authenticated tags", () => {
    const first = encryptEditorRecovery(payload(), KEY), second = encryptEditorRecovery(payload(), KEY);
    assert.notEqual(first, second); assert.notEqual(decoded(first).nonce, decoded(second).nonce);
    for (const envelope of [first, second]) {
        const header = decoded(envelope);
        assert.equal(Buffer.from(header.nonce as string, "base64").length, 12);
        assert.equal(Buffer.from(header.tag as string, "base64").length, 16);
        for (const field of ["nonce", "tag", "ciphertext"])
            assert.equal(Buffer.from(header[field] as string, "base64").toString("base64"), header[field]);
        assert.deepEqual(decryptEditorRecovery(envelope, KEY, binding), payload());
    }
});

test("F05-R03 encryption rejects malformed or unknown payload fields instead of retaining unsupported state", () => {
    for (const invalid of [null, [], { ...payload(), schemaVersion: 2 }, { ...payload(), extra: PRIVATE },
        { ...payload(), savedText: 7 }, { ...payload(), draftText: null }, { ...payload(), fileIdentity: undefined },
        { ...payload(), source: "https://synthetic.invalid/.env" }, { ...payload(), root: "untitled:synthetic" }])
        assert.throws(() => encryptEditorRecovery(invalid as ReturnType<typeof payload>, KEY));
});

test("F05-R04 encryption and decryption require exactly 32 key bytes", () => {
    const envelope = encryptEditorRecovery(payload(), KEY);
    for (const size of [0, 1, 16, 31, 33, 64]) {
        const key = Buffer.alloc(size, 7);
        assert.throws(() => encryptEditorRecovery(payload(), key));
        assert.throws(() => decryptEditorRecovery(envelope, key, binding));
    }
});

test("F05-R05 a different valid-length key cannot recover the draft", () => {
    const other = Buffer.from(KEY); other[0] ^= 1;
    assert.throws(() => decryptEditorRecovery(encryptEditorRecovery(payload(), KEY), other, binding));
});

for (const field of ["ciphertext", "tag", "nonce"] as const) {
    test(`F05-R06 ${field} tampering fails authenticated recovery`, () => {
        const envelope = encryptEditorRecovery(payload(), KEY);
        assert.throws(() => decryptEditorRecovery(flipBase64(envelope, field), KEY, binding));
    });
}

test("F05-R07 source and root header changes fail even when supplied binding matches the altered header", () => {
    const envelope = encryptEditorRecovery(payload(), KEY);
    for (const [field, value] of [["source", "file:///C:/synthetic-f05-project/other.env"],
        ["root", "file:///C:/other-synthetic-project"]] as const) {
        const alteredBinding = { ...binding, [field]: value };
        assert.throws(() => decryptEditorRecovery(changed(envelope, field, value), KEY, alteredBinding));
    }
});

test("F05-R08 a valid envelope cannot be opened under another source or project root", () => {
    const envelope = encryptEditorRecovery(payload(), KEY);
    assert.throws(() => decryptEditorRecovery(envelope, KEY, { ...binding, source: "file:///C:/synthetic-f05-project/other.env" }));
    assert.throws(() => decryptEditorRecovery(envelope, KEY, { ...binding, root: "file:///C:/other-synthetic-project" }));
});

test("F05-R09 malformed JSON, arrays and duplicated header keys fail closed", () => {
    const envelope = encryptEditorRecovery(payload(), KEY);
    const duplicate = envelope.replace(/^\{/, '{"schemaVersion":1,');
    for (const input of ["", "not json", "null", "[]", "{}", envelope.slice(0, -1), duplicate])
        assert.throws(() => decryptEditorRecovery(input, KEY, binding));
});

test("F05-R10 nonce, tag and ciphertext use strict canonical base64 and exact nonce/tag sizes", () => {
    const envelope = encryptEditorRecovery(payload(), KEY); const header = decoded(envelope);
    for (const [field, values] of [["nonce", ["", "!not-base64!", `${header.nonce}\n`, Buffer.alloc(11).toString("base64"), Buffer.alloc(13).toString("base64")]],
        ["tag", ["", "!not-base64!", (header.tag as string).replace(/=+$/, ""), Buffer.alloc(15).toString("base64"), Buffer.alloc(17).toString("base64")]],
        ["ciphertext", ["", "!not-base64!", ` ${header.ciphertext}`, `${header.ciphertext}\n`]]] as const)
        for (const value of values) assert.throws(() => decryptEditorRecovery(changed(envelope, field, value), KEY, binding));
});

test("F05-R11 unknown, missing or incorrectly typed envelope fields cannot be recovered", () => {
    const envelope = encryptEditorRecovery(payload(), KEY); const header = decoded(envelope);
    for (const invalid of [{ ...header, extra: PRIVATE }, { ...header, schemaVersion: 2 }, { ...header, source: null },
        { ...header, root: 7 }, { ...header, nonce: 7 }, { ...header, tag: [] }, { ...header, ciphertext: {} }])
        assert.throws(() => decryptEditorRecovery(JSON.stringify(invalid), KEY, binding));
    for (const field of ["schemaVersion", "source", "root", "nonce", "tag", "ciphertext"]) {
        const missing = { ...header }; delete missing[field];
        assert.throws(() => decryptEditorRecovery(JSON.stringify(missing), KEY, binding));
    }
});

test("F05-R12 recovery rejects an envelope exceeding 512 KiB before accepting any draft", () => {
    const envelope = encryptEditorRecovery(payload(), KEY);
    assert.throws(() => decryptEditorRecovery(envelope + " ".repeat(512 * 1024), KEY, binding));
    assert.throws(() => decryptEditorRecovery(changed(envelope, "ciphertext", "A".repeat(512 * 1024)), KEY, binding));
});

test("F05-R13 saved and draft text have independent 64 KiB UTF-8 bounds", () => {
    for (const field of ["savedText", "draftText"] as const) {
        const exact = { ...payload(), [field]: "é".repeat(32_768) };
        assert.deepEqual(decryptEditorRecovery(encryptEditorRecovery(exact, KEY), KEY, binding), exact);
        assert.throws(() => encryptEditorRecovery({ ...payload(), [field]: "é".repeat(32_769) }, KEY));
    }
    const empty = { ...payload(), savedText: "", draftText: "" };
    assert.deepEqual(decryptEditorRecovery(encryptEditorRecovery(empty, KEY), KEY, binding), empty);
});

test("F05-R14 encrypting and decrypting do not mutate caller payload or key buffers", () => {
    const original = Object.freeze(payload()); const key = Buffer.from(KEY); const previous = Buffer.from(key);
    const envelope = encryptEditorRecovery(original, key);
    assert.deepEqual(decryptEditorRecovery(envelope, key, binding), original);
    assert.deepEqual(key, previous); assert.deepEqual(original, payload());
});
