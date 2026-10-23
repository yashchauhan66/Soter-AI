import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";

// Test-first F23 protocol fixtures are entirely in memory. No repository,
// process, workspace file, network route or existing Git history is read.
const PRIVATE = "TEST_ONLY_F23_PROTOCOL_PRIVATE_8b4e71c2";
const oid = (ordinal: number) => ordinal.toString(16).padStart(40, "0");
const blobOid = (bytes: Buffer) => createHash("sha1").update("blob " + bytes.length + "\0").update(bytes).digest("hex");
const tree = (source: string, size = 12, object = oid(1), mode = "100644", type = "blob") =>
    Buffer.from(mode + " " + type + " " + object + " " + size + "\t" + source + "\0", "utf8");
const frame = (bytes: Buffer, object = blobOid(bytes), declaredSize = bytes.length, type = "blob") =>
    Buffer.concat([Buffer.from(object + " " + type + " " + declaredSize + "\n", "ascii"), bytes, Buffer.from("\n")]);
const safeError = (error: unknown) => error instanceof Error && !String(error).includes(PRIVATE);

async function implementation() {
    const value = await import("../history/GitHistoryProtocol");
    for (const name of ["parseHistoryCommitList", "parseHistoryTree", "parseHistoryBatch", "decodeHistoryBlob"] as const)
        assert.equal(typeof value[name], "function");
    return value;
}

test("F23 protocol freezes separate commit, blob, stream and time budgets", async () => {
    const { HISTORY_LIMITS } = await implementation();
    assert.deepEqual(HISTORY_LIMITS, { commits: 32, blobs: 128, blobBytes: 65536, totalBytes: 1048576,
        treeBytes: 262144, listBytes: 4096, stderrBytes: 8192, milliseconds: 60000 });
});

test("F23 commit list accepts empty history and exact LF or CRLF object IDs", async () => {
    const { parseHistoryCommitList } = await implementation();
    assert.deepEqual(parseHistoryCommitList(Buffer.alloc(0)), { commits: [], capped: false });
    for (const newline of ["\n", "\r\n"])
        assert.deepEqual(parseHistoryCommitList(Buffer.from(oid(1) + newline + oid(2) + newline)), { commits: [oid(1), oid(2)], capped: false });
});

test("F23 commit sentinel returns first32 and marks a33rd commit as capped", async () => {
    const { parseHistoryCommitList } = await implementation();
    const objects = Array.from({ length: 33 }, (_, index) => oid(index + 1));
    assert.deepEqual(parseHistoryCommitList(Buffer.from(objects.slice(0, 32).join("\n") + "\n")), { commits: objects.slice(0, 32), capped: false });
    assert.deepEqual(parseHistoryCommitList(Buffer.from(objects.join("\n") + "\n")), { commits: objects.slice(0, 32), capped: true });
    assert.throws(() => parseHistoryCommitList(Buffer.from([...objects, oid(34)].join("\n") + "\n")), safeError);
});

test("F23 commit list rejects repeated IDs, option-looking revisions and noncanonical object shapes", async () => {
    const { parseHistoryCommitList } = await implementation();
    for (const value of [oid(1) + "\n" + oid(1) + "\n", "A".repeat(40) + "\n", "a".repeat(39) + "\n", "a".repeat(64) + "\n",
        "--all\n", "HEAD:.env\n", PRIVATE + "\n", " " + oid(1) + "\n", oid(1) + " extra\n", oid(1) + "\0\n"])
        assert.throws(() => parseHistoryCommitList(Buffer.from(value)), safeError);
});

test("F23 commit list rejects missing terminators, blank records, bareCR and oversized streams", async () => {
    const { parseHistoryCommitList } = await implementation();
    for (const value of [oid(1), oid(1) + "\r", oid(1) + "\n\n", "\n", oid(1) + "\r" + oid(2) + "\n"])
        assert.throws(() => parseHistoryCommitList(Buffer.from(value)), safeError);
    assert.throws(() => parseHistoryCommitList(Buffer.alloc(4097, 0x61)), safeError);
});

test("F23 tree protocol retains private relative paths and accepts ordinary executable blobs", async () => {
    const { parseHistoryTree } = await implementation();
    assert.deepEqual(parseHistoryTree(Buffer.alloc(0)), { blobs: [], skipped: 0 });
    const bytes = Buffer.concat([tree("nested/past.env", 19), tree("scripts/public.sh", 7, oid(2), "100755")]);
    assert.deepEqual(parseHistoryTree(bytes), { blobs: [{ oid: oid(1), size: 19, source: "nested/past.env" },
        { oid: oid(2), size: 7, source: "scripts/public.sh" }], skipped: 0 });
});

test("F23 tree protocol accepts canonical size padding, empty blobs and UTF8 file names", async () => {
    const { parseHistoryTree } = await implementation();
    const bytes = Buffer.from("100644 blob " + oid(1) + "       0\tpublic space/हिन्दी.txt\0");
    assert.deepEqual(parseHistoryTree(bytes), { blobs: [{ oid: oid(1), size: 0, source: "public space/हिन्दी.txt" }], skipped: 0 });
});

test("F23 tree protocol skips symlinks and gitlinks without admitting external contents", async () => {
    const { parseHistoryTree } = await implementation();
    const bytes = Buffer.concat([tree("public.txt"), tree("shortcut", 17, oid(2), "120000"),
        Buffer.from("160000 commit " + oid(3) + "       -\tvendor/submodule\0")]);
    assert.deepEqual(parseHistoryTree(bytes), { blobs: [{ oid: oid(1), size: 12, source: "public.txt" }], skipped: 2 });
});

test("F23 tree protocol leaves large object sizes for the scanner's explicit skip accounting", async () => {
    const { parseHistoryTree } = await implementation();
    assert.deepEqual(parseHistoryTree(tree("large.bin", 65537)), { blobs: [{ oid: oid(1), size: 65537, source: "large.bin" }], skipped: 0 });
});

test("F23 tree protocol rejects unsafe absolute, drive, parent, empty and separator path forms", async () => {
    const { parseHistoryTree } = await implementation();
    for (const source of ["", "/" + PRIVATE, "C:/" + PRIVATE, "//server/" + PRIVATE, "a\\" + PRIVATE, "a:" + PRIVATE,
        ".", "..", "./" + PRIVATE, "a/../" + PRIVATE, "a/./" + PRIVATE, "a//" + PRIVATE, "a/", "../" + PRIVATE])
        assert.throws(() => parseHistoryTree(tree(source)), safeError);
});

test("F23 tree protocol rejects TAB, newline and other path controls rather than treating them as new frames", async () => {
    const { parseHistoryTree } = await implementation();
    for (const control of ["\t", "\n", "\r", "\x01", "\x7f"])
        assert.throws(() => parseHistoryTree(tree("a" + control + PRIVATE)), safeError);
});

test("F23 tree protocol enforces2048 UTF8 path bytes and refuses invalid encodings", async () => {
    const { parseHistoryTree } = await implementation();
    const admitted = "é".repeat(1024);
    assert.equal(parseHistoryTree(tree(admitted)).blobs[0].source, admitted);
    assert.throws(() => parseHistoryTree(tree("é".repeat(1025))), safeError);
    const header = Buffer.from("100644 blob " + oid(1) + " 12\t");
    assert.throws(() => parseHistoryTree(Buffer.concat([header, Buffer.from([0xc3, 0x28, 0])])), safeError);
});

test("F23 tree protocol requires complete NUL framing and rejects stray or duplicate frame separators", async () => {
    const { parseHistoryTree } = await implementation();
    const canonical = tree("public.txt");
    for (const bytes of [canonical.subarray(0, -1), Buffer.concat([canonical, Buffer.from("trailing")]),
        Buffer.concat([canonical, Buffer.from([0])]), Buffer.from([0]), Buffer.from("100644 blob " + oid(1) + " 12 public.txt\0")])
        assert.throws(() => parseHistoryTree(bytes), safeError);
});

test("F23 tree protocol rejects forged modes, object types, malformed IDs and unsafe numeric sizes", async () => {
    const { parseHistoryTree } = await implementation();
    const records = ["100600 blob " + oid(1) + " 1", "100644 tree " + oid(1) + " 1", "160000 blob " + oid(1) + " 1",
        "100644 blob " + "A".repeat(40) + " 1", "100644 blob " + "a".repeat(39) + " 1", "100644 blob " + oid(1) + " -1",
        "100644 blob " + oid(1) + " 1.5", "100644 blob " + oid(1) + " +1", "100644 blob " + oid(1) + " 1e3",
        "100644 blob " + oid(1) + " 9007199254740992", "100644 blob " + PRIVATE + " 1"];
    for (const record of records) assert.throws(() => parseHistoryTree(Buffer.from(record + "\tpublic.txt\0")), safeError);
});

test("F23 tree stream budget rejects262145 bytes before unbounded path enumeration", async () => {
    const { parseHistoryTree } = await implementation();
    assert.throws(() => parseHistoryTree(Buffer.alloc(262145, 0x61)), safeError);
});

test("F23 batch protocol verifies real Git blob hashes and exact requested order", async () => {
    const { parseHistoryBatch } = await implementation();
    const first = Buffer.from("TOKEN=" + PRIVATE + "\n"), second = Buffer.from("public fixture\n");
    const wanted = [first, second].map(bytes => ({ oid: blobOid(bytes), size: bytes.length }));
    const result = parseHistoryBatch(Buffer.concat([frame(first), frame(second)]), wanted);
    assert.deepEqual(result.map(row => ({ oid: row.oid, bytes: row.bytes })), [{ oid: wanted[0].oid, bytes: first }, { oid: wanted[1].oid, bytes: second }]);
    assert.throws(() => parseHistoryBatch(Buffer.concat([frame(second), frame(first)]), wanted), safeError);
});

test("F23 batch framing handles empty bodies and embedded newline/NUL/binary bytes without line splitting bodies", async () => {
    const { parseHistoryBatch } = await implementation();
    const values = [Buffer.alloc(0), Buffer.from([0, 10, 13, 255, 0xc3, 0x28, 10])];
    const wanted = values.map(bytes => ({ oid: blobOid(bytes), size: bytes.length }));
    const result = parseHistoryBatch(Buffer.concat(values.map(bytes => frame(bytes))), wanted);
    assert.deepEqual(result.map(row => row.bytes), values);
    assert.deepEqual(parseHistoryBatch(Buffer.alloc(0), []), []);
});

test("F23 batch rejects content whose actual Git blob hash differs despite matching ID and size headers", async () => {
    const { parseHistoryBatch } = await implementation();
    const original = Buffer.from("TOKEN=" + PRIVATE), changed = Buffer.from(original); changed[changed.length - 1] ^= 1;
    const wanted = [{ oid: blobOid(original), size: original.length }];
    assert.throws(() => parseHistoryBatch(frame(changed, wanted[0].oid), wanted), safeError);
});

test("F23 batch rejects wrong declared sizes, object kinds, malformed IDs and missing-object messages", async () => {
    const { parseHistoryBatch } = await implementation();
    const bytes = Buffer.from(PRIVATE), object = blobOid(bytes), wanted = [{ oid: object, size: bytes.length }];
    for (const raw of [frame(bytes, object, bytes.length + 1), frame(bytes, object, bytes.length, "tree"),
        frame(bytes, "A".repeat(40)), Buffer.from(object + " missing\n"), Buffer.from(PRIVATE + " missing\n"),
        Buffer.concat([Buffer.from(object + " blob -1\n"), bytes, Buffer.from("\n")])])
        assert.throws(() => parseHistoryBatch(raw, wanted), safeError);
});

test("F23 batch requires full header/body/final separator and exactEOF with no appended bytes", async () => {
    const { parseHistoryBatch } = await implementation();
    const bytes = Buffer.from(PRIVATE), raw = frame(bytes), wanted = [{ oid: blobOid(bytes), size: bytes.length }];
    for (const value of [Buffer.alloc(0), raw.subarray(0, 20), raw.subarray(0, -2), raw.subarray(0, -1),
        Buffer.concat([raw, Buffer.from("\n")]), Buffer.concat([raw, Buffer.from(PRIVATE)]), Buffer.concat([raw, raw])])
        assert.throws(() => parseHistoryBatch(value, wanted), safeError);
    assert.throws(() => parseHistoryBatch(raw, []), safeError);
});

test("F23 batch rejects repeated requested objects and invalid requested size or identity metadata", async () => {
    const { parseHistoryBatch } = await implementation();
    const bytes = Buffer.from(PRIVATE), object = blobOid(bytes), wanted = { oid: object, size: bytes.length };
    assert.throws(() => parseHistoryBatch(Buffer.concat([frame(bytes), frame(bytes)]), [wanted, wanted]), safeError);
    for (const request of [{ oid: "--batch", size: bytes.length }, { oid: PRIVATE, size: bytes.length },
        { oid: object.toUpperCase(), size: bytes.length }, { oid: object, size: -1 }, { oid: object, size: 1.5 },
        { oid: object, size: Number.NaN }, { oid: object, size: Number.POSITIVE_INFINITY }])
        assert.throws(() => parseHistoryBatch(frame(bytes), [request]), safeError);
});

test("F23 batch admits exact64KiB object bodies but rejects a65537-byte object", async () => {
    const { parseHistoryBatch } = await implementation();
    const exact = Buffer.alloc(65536, 0x61), over = Buffer.alloc(65537, 0x62);
    assert.equal(parseHistoryBatch(frame(exact), [{ oid: blobOid(exact), size: exact.length }])[0].bytes.length, 65536);
    assert.throws(() => parseHistoryBatch(frame(over), [{ oid: blobOid(over), size: over.length }]), safeError);
});

test("F23 batch body aggregate allows exact1MiB and refuses one further byte independent of framing overhead", async () => {
    const { parseHistoryBatch } = await implementation();
    const values = Array.from({ length: 16 }, (_, index) => Buffer.alloc(65536, 0x41 + index));
    const wanted = values.map(bytes => ({ oid: blobOid(bytes), size: bytes.length }));
    const exact = Buffer.concat(values.map(bytes => frame(bytes)));
    assert.equal(parseHistoryBatch(exact, wanted).reduce((sum, row) => sum + row.bytes.length, 0), 1048576);
    const extra = Buffer.from("x");
    assert.throws(() => parseHistoryBatch(Buffer.concat([exact, frame(extra)]), [...wanted, { oid: blobOid(extra), size: 1 }]), safeError);
});

test("F23 batch accepts128 distinct requested blobs and refuses129 even below the byte budget", async () => {
    const { parseHistoryBatch } = await implementation();
    const values = Array.from({ length: 129 }, (_, index) => Buffer.from("public-" + index));
    const wanted = values.map(bytes => ({ oid: blobOid(bytes), size: bytes.length }));
    assert.equal(parseHistoryBatch(Buffer.concat(values.slice(0, 128).map(bytes => frame(bytes))), wanted.slice(0, 128)).length, 128);
    assert.throws(() => parseHistoryBatch(Buffer.concat(values.map(bytes => frame(bytes))), wanted), safeError);
});

test("F23 blob decode accepts strictUTF8 with LF CR TAB and rejects malformed encodings", async () => {
    const { decodeHistoryBlob } = await implementation();
    for (const text of ["", "public\ntext\r\n\tvalue", "हिन्दी é 😀", "TOKEN=" + PRIVATE])
        assert.equal(decodeHistoryBlob(Buffer.from(text)), text);
    for (const bytes of [Buffer.from([0xc3, 0x28]), Buffer.from([0xc0, 0xaf]), Buffer.from([0xe2, 0x82]), Buffer.from([0xed, 0xa0, 0x80])])
        assert.equal(decodeHistoryBlob(bytes), undefined);
});

test("F23 blob decode refuses NUL and unsupportedC0 controls while preserving exact byte-size limits", async () => {
    const { decodeHistoryBlob } = await implementation();
    for (const control of [0, 1, 8, 11, 12, 14, 31])
        assert.equal(decodeHistoryBlob(Buffer.concat([Buffer.from(PRIVATE), Buffer.from([control])])), undefined);
    assert.equal(decodeHistoryBlob(Buffer.alloc(65536, 0x61))?.length, 65536);
    assert.throws(() => decodeHistoryBlob(Buffer.alloc(65537, 0x61)), safeError);
});
