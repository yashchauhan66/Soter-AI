import assert from "node:assert/strict";
import { test } from "node:test";

// TEST FIRST. Pure synthetic fixed Git size framing, no child/Git/filesystem.
type Row = Readonly<{ oid: string; size: number }>;
type Parse = (raw: Buffer, oids: readonly string[]) => readonly Row[] | undefined;
const oid = (n: number) => n.toString(16).padStart(40, "0");
const frame = (id: string, size: number | string, type = "blob") => id + " " + type + " " + size + "\n";
async function implementation(): Promise<Parse> {
    const module = await import("../history-hooks/PreCommitProtocol");
    assert(typeof module.parseStagedEntries === "function", "Existing staged-entry parser must remain available.");
    assert(typeof module.parsePreCommitSizes === "function", "The additive frozen size parser must exist.");
    return module.parsePreCommitSizes as Parse;
}
function parse(fn: Parse, text: Buffer | string, ids: readonly string[]): readonly Row[] | undefined {
    const raw = typeof text === "string" ? Buffer.from(text) : text, before = Buffer.from(raw), expected = [...ids];
    let value: readonly Row[] | undefined;
    try { value = fn(raw, ids); }
    catch { assert.fail("Malformed private size framing must return unavailable without input-bearing exceptions."); }
    assert(raw.equals(before), "Size parsing must leave caller bytes untouched.");
    assert(ids.length === expected.length && ids.every((id, i) => id === expected[i]), "Size parsing must not mutate expected object identities.");
    return value;
}
function accepted(value: readonly Row[] | undefined, expected: readonly Row[]): void {
    assert(Array.isArray(value), "The exact complete size response must be admitted.");
    assert(Object.isFrozen(value), "The admitted size array must be frozen.");
    assert(value.length === expected.length && value.every((row, i) => row.oid === expected[i].oid && row.size === expected[i].size), "Size rows must preserve exact expected identity/order and bounded values.");
    for (const row of value) assert(Object.isFrozen(row) && Reflect.ownKeys(row).sort().join(",") === "oid,size", "Private size rows may contain only frozen oid/size fields.");
}
const refused = (value: readonly Row[] | undefined) => assert(value === undefined, "Any framing or budget failure must refuse the whole response.");

test("F26a size parser accepts canonical zero and inclusive64KiB sizes", async () => {
    const fn = await implementation();
    accepted(parse(fn, frame(oid(1), 0) + frame(oid(2), 65536), [oid(1), oid(2)]), [{ oid: oid(1), size: 0 }, { oid: oid(2), size: 65536 }]);
});
test("F26a size parser preserves128 unique requested object identities in exact caller order", async () => {
    const fn = await implementation(), ids = Array.from({ length: 128 }, (_, n) => oid(128 - n));
    accepted(parse(fn, ids.map((id, n) => frame(id, n)).join(""), ids), ids.map((id, n) => ({ oid: id, size: n })));
});
test("F26a size parser returns immutable request-local records without retaining caller buffers", async () => {
    const fn = await implementation(), ids = Object.freeze([oid(1)]), raw = Buffer.from(frame(oid(1), 17));
    const first = parse(fn, raw, ids); accepted(first, [{ oid: oid(1), size: 17 }]); raw.fill(0);
    accepted(first, [{ oid: oid(1), size: 17 }]); accepted(parse(fn, frame(oid(2), 3), [oid(2)]), [{ oid: oid(2), size: 3 }]);
});
test("F26a size parser rejects empty and129-object requests without a partial prefix", async () => {
    const fn = await implementation(); refused(parse(fn, "", []));
    const ids = Array.from({ length: 129 }, (_, n) => oid(n + 1)); refused(parse(fn, ids.map(id => frame(id, 0)).join(""), ids));
});
test("F26a size parser rejects missing objects and an incomplete final row", async () => {
    const fn = await implementation(), ids = [oid(1), oid(2)];
    for (const text of ["", frame(oid(1), 0), frame(oid(1), 0) + oid(2) + " blob", (frame(oid(1), 0) + frame(oid(2), 1)).slice(0, -1)]) refused(parse(fn, text, ids));
});
test("F26a size parser rejects trailing objects blank lines and extra bytes", async () => {
    const fn = await implementation();
    for (const suffix of [frame(oid(2), 0), "\n", " ", "\0", "trailing"]) refused(parse(fn, frame(oid(1), 0) + suffix, [oid(1)]));
});
test("F26a size parser rejects reordered complete responses", async () => {
    const fn = await implementation(); refused(parse(fn, frame(oid(2), 0) + frame(oid(1), 0), [oid(1), oid(2)]));
});
test("F26a size parser rejects duplicate expected and duplicate returned identities", async () => {
    const fn = await implementation();
    refused(parse(fn, frame(oid(1), 0) + frame(oid(1), 0), [oid(1), oid(1)]));
    refused(parse(fn, frame(oid(1), 0) + frame(oid(1), 0), [oid(1), oid(2)]));
});
test("F26a size parser rejects unknown truncated uppercase and nonhex identities", async () => {
    const fn = await implementation(), id = "abcdef".repeat(6) + "abcd";
    for (const other of [oid(2), id.toUpperCase(), oid(1).slice(1), "g".repeat(40)]) refused(parse(fn, frame(other, 0), [oid(1)]));
    for (const expected of [id.toUpperCase(), "g".repeat(40), oid(1).slice(1)]) refused(parse(fn, frame(expected, 0), [expected]));
});
test("F26a size parser rejects nonblob missing and ambiguous object type responses", async () => {
    const fn = await implementation();
    for (const type of ["tree", "commit", "tag", "BLOB", "blob blob"]) refused(parse(fn, frame(oid(1), 0, type), [oid(1)]));
    refused(parse(fn, oid(1) + " missing\n", [oid(1)]));
});
test("F26a size parser rejects noncanonical negative fractional exponential and unsafe decimal sizes", async () => {
    const fn = await implementation();
    for (const size of ["", "00", "01", "+1", "-1", "1.0", "1e2", "NaN", "Infinity", "9007199254740992", " 1", "1 "])
        refused(parse(fn, frame(oid(1), size), [oid(1)]));
});
test("F26a size parser rejects any blob larger than64KiB even after an admitted zero row", async () => {
    const fn = await implementation(); refused(parse(fn, frame(oid(1), 0) + frame(oid(2), 65537), [oid(1), oid(2)]));
});
test("F26a size parser admits exactly1MiB unique raw sizes and refuses the next unique blob", async () => {
    const fn = await implementation(), ids = Array.from({ length: 16 }, (_, n) => oid(n + 1));
    accepted(parse(fn, ids.map(id => frame(id, 65536)).join(""), ids), ids.map(id => ({ oid: id, size: 65536 })));
    const extra = [...ids, oid(17)]; refused(parse(fn, extra.map(id => frame(id, 65536)).join(""), extra));
});
test("F26a size parser rejects response bytes beyond12288 independently of object count", async () => {
    const fn = await implementation(); refused(parse(fn, Buffer.concat([Buffer.from(frame(oid(1), 0)), Buffer.alloc(12289, 32)]), [oid(1)]));
});
test("F26a size parser rejects CRLF tabs double spaces BOM NUL and prefixed framing", async () => {
    const fn = await implementation(), good = frame(oid(1), 0);
    for (const text of [good.replace("\n", "\r\n"), good.replace(" blob ", "\tblob "), good.replace(" blob ", "  blob "), "\uFEFF" + good, "\0" + good, "public " + good, good.replace("blob", "blob\0")]) refused(parse(fn, text, [oid(1)]));
});
test("F26a size parser fatally rejects late malformed UTF8 rather than returning earlier size rows", async () => {
    const fn = await implementation();
    for (const bad of [[0xc0, 0xaf], [0xc3], [0xed, 0xa0, 0x80], [0xff]]) refused(parse(fn, Buffer.concat([Buffer.from(frame(oid(1), 0)), Buffer.from(bad)]), [oid(1), oid(2)]));
});
test("F26a size parser rejects invalid runtime raw inputs without coercion or proxy access", async () => {
    const fn = await implementation(); let reads = 0;
    const poison = new Proxy({}, { get() { reads++; throw Error("Synthetic coercion forbidden."); } });
    for (const raw of [null, undefined, "public", new Uint8Array([1]), {}, poison]) {
        let value; try { value = fn(raw as never, [oid(1)]); } catch { assert.fail("Invalid raw input must return unavailable."); } refused(value);
    }
    assert(reads === 0, "Raw admission must not inspect or coerce caller objects.");
});
test("F26a size parser rejects invalid expected arrays sparse fields accessors and caller coercion", async () => {
    const fn = await implementation(); let reads = 0;
    const poison = { toString() { reads++; throw Error("Synthetic coercion forbidden."); } };
    const accessor: string[] = []; Object.defineProperty(accessor, "0", { get() { reads++; throw Error("Synthetic accessor forbidden."); }, enumerable: true });
    const proxied = new Proxy([oid(1)], { get() { reads++; throw Error("Synthetic proxy access forbidden."); } });
    for (const ids of [null, undefined, {}, "public", [poison], new Array(1), accessor, proxied]) {
        let value; try { value = fn(Buffer.from(frame(oid(1), 0)), ids as never); } catch { assert.fail("Invalid expected identities must return unavailable."); } refused(value);
    }
    assert(reads === 0, "Expected identity admission must not invoke getters, proxies or coercion.");
});
