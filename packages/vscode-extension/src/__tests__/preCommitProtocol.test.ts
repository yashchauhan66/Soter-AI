import assert from "node:assert/strict";
import { test } from "node:test";

// F26a TEST-ONLY, PREPARED_NOT_EXECUTED. Adopt byte-for-byte into src/__tests__
// only after the current feature's byte barriers. No Git/process/fs/network work.
type Entry = Readonly<{ path: string; oid: string; mode: "100644" | "100755" }>;
type Parse = (raw: Buffer) => readonly Entry[] | undefined;
const PRIVATE = "TEST_ONLY_F26A_PROTOCOL_PRIVATE_2c870e41";
const oid = (index = 1): string => index.toString(16).padStart(40, "0");
const record = (path: string, object = oid(), mode = "100644", stage = "0"): Buffer =>
    Buffer.from(mode + " " + object + " " + stage + "\t" + path + "\0", "utf8");
const expectUnavailable = (parse: Parse, value: unknown): void => {
    let result: unknown, threw = false;
    try { result = parse(value as Buffer); } catch { threw = true; }
    assert.equal(threw, false, "invalid private input must return unavailable without throwing");
    assert.equal(result, undefined, "invalid listing must not release an accepted prefix");
};
async function implementation(): Promise<Parse> {
    const value = await import("../history-hooks/PreCommitProtocol");
    assert.equal(typeof value.parseStagedEntries, "function");
    return value.parseStagedEntries;
}
function sizedPath(bytes: number, index: number): string {
    const prefix = "r" + String(index).padStart(3, "0") + "/";
    let remaining = bytes - prefix.length;
    const parts: string[] = [];
    while (remaining > 200) { parts.push("a".repeat(200)); remaining -= 201; }
    parts.push("a".repeat(remaining));
    return prefix + parts.join("/");
}

test("F26a staged protocol admits an empty proposed tree", async () => {
    const parse = await implementation();
    assert.deepEqual(parse(Buffer.alloc(0)), []);
});

test("F26a staged protocol preserves exact rows and regular executable modes", async () => {
    const parse = await implementation();
    const input = Buffer.concat([record("src/public.ts"), record("scripts/public.sh", oid(2), "100755")]);
    assert.deepEqual(parse(input), [
        { path: "src/public.ts", oid: oid(), mode: "100644" },
        { path: "scripts/public.sh", oid: oid(2), mode: "100755" },
    ]);
});

test("F26a staged protocol keeps spaces Unicode and leading-dash names literal", async () => {
    const parse = await implementation();
    const paths = ["public space/read me.txt", "unicode/हिन्दी-é-日本語.txt", "-option.txt", "nested/--literal", "a..b.txt"];
    assert.deepEqual(parse(Buffer.concat(paths.map(path => record(path))))?.map(row => row.path), paths);
});

test("F26a staged protocol permits repeated blob OIDs under separate path contexts", async () => {
    const parse = await implementation();
    const paths = ["config/public.json", "src/public.ts"];
    assert.deepEqual(parse(Buffer.concat(paths.map(path => record(path))))?.map(row => row.path), paths);
});

test("F26a staged protocol accepts exactly128 entries", async () => {
    const parse = await implementation();
    const paths = Array.from({ length: 128 }, (_, index) => "public/entry-" + index + ".txt");
    assert.deepEqual(parse(Buffer.concat(paths.map(path => record(path))))?.map(row => row.path), paths);
});

test("F26a staged protocol withholds the entire129-entry sentinel listing", async () => {
    const parse = await implementation();
    expectUnavailable(parse, Buffer.concat(Array.from({ length: 129 }, (_, index) => record("public/entry-" + index + ".txt"))));
});

test("F26a staged protocol accepts a valid listing of exactly256KiB", async () => {
    const parse = await implementation();
    const paths = Array.from({ length: 128 }, (_, index) => sizedPath(1997, index));
    const input = Buffer.concat(paths.map(path => record(path)));
    assert.equal(input.length, 262144, "fixture must isolate the exact listing-byte boundary");
    assert.deepEqual(parse(input)?.map(row => row.path), paths);
});

test("F26a staged protocol rejects an otherwise valid listing one byte over256KiB", async () => {
    const parse = await implementation();
    const input = Buffer.concat(Array.from({ length: 128 }, (_, index) => record(sizedPath(index === 0 ? 1998 : 1997, index))));
    assert.equal(input.length, 262145, "fixture must isolate the listing-byte overflow");
    expectUnavailable(parse, input);
});

test("F26a staged protocol requires each final NUL and exact final EOF", async () => {
    const parse = await implementation(), valid = record("public.txt");
    for (const input of [valid.subarray(0, -1), Buffer.concat([valid, Buffer.from(PRIVATE)]),
        Buffer.concat([valid, Buffer.from([0])]), Buffer.from([0]), Buffer.concat([Buffer.from([0]), valid])])
        expectUnavailable(parse, input);
});

test("F26a staged protocol requires exact ASCII header separators", async () => {
    const parse = await implementation();
    const object = oid();
    for (const header of [" 100644 " + object + " 0", "100644  " + object + " 0", "100644\t" + object + " 0",
        "100644 " + object + "  0", "100644 " + object + "\t0", "100644 " + object + " 0 ",
        "100644 " + object + " 0\r", "100644 " + object + " 0\n", "100644 " + object,
        "100644 " + object + " 0 extra"])
        expectUnavailable(parse, Buffer.from(header + "\tpublic.txt\0"));
    expectUnavailable(parse, Buffer.from("100644 " + object + " 0 public.txt\0"));
});

test("F26a staged protocol rejects nonzero and noncanonical stages", async () => {
    const parse = await implementation();
    for (const stage of ["1", "2", "3", "00", "+0", "-0", "-1", "4", "", "0.0"])
        expectUnavailable(parse, record("public.txt", oid(), "100644", stage));
});

test("F26a staged protocol rejects symlinks submodules and other nonregular modes", async () => {
    const parse = await implementation();
    for (const mode of ["120000", "160000", "040000", "100600", "100664", "1006440", "0100644", "", "10064a"])
        expectUnavailable(parse, record("public.txt", oid(), mode));
});

test("F26a staged protocol requires exactly40 lowercase hexadecimal object characters", async () => {
    const parse = await implementation();
    for (const object of ["a".repeat(39), "a".repeat(41), "a".repeat(64), "A".repeat(40),
        "g".repeat(40), "a".repeat(39) + "G", "-" + "a".repeat(39), "HEAD", "", PRIVATE])
        expectUnavailable(parse, record("public.txt", object));
    assert.equal(parse(record("public.txt", "0".repeat(40)))?.[0].oid, "0".repeat(40),
        "parser validates framing; object existence and identity are checked by the later object reader");
});

test("F26a staged protocol rejects empty absolute drive UNC and backslash paths", async () => {
    const parse = await implementation();
    for (const path of ["", "/public.txt", "//server/share/public.txt", "C:/public.txt", "C:public.txt",
        "\\public.txt", "\\\\server\\share\\public.txt", "nested\\public.txt", "\\?\\C:\\public.txt"])
        expectUnavailable(parse, record(path));
});

test("F26a staged protocol rejects dot parent empty and trailing slash components", async () => {
    const parse = await implementation();
    for (const path of [".", "..", "./public.txt", "../public.txt", "a/./public.txt", "a/../public.txt",
        "a//public.txt", "a/", "/a", "a///b"])
        expectUnavailable(parse, record(path));
});

test("F26a staged protocol rejects ADS and Windows-invalid punctuation", async () => {
    const parse = await implementation();
    for (const path of ["public.txt:stream", "a::$DATA", "a/b:c", 'a/quote".txt', "a/less<.txt",
        "a/greater>.txt", "a/pipe|.txt", "a/question?.txt", "a/star*.txt"])
        expectUnavailable(parse, record(path));
});

test("F26a staged protocol rejects control format and line-separator characters in names", async () => {
    const parse = await implementation();
    for (const control of ["\0", "\x01", "\t", "\n", "\r", "\x1f", "\x7f", "\x85", "\u200b", "\u202e", "\u2028", "\u2029", "\ufeff"])
        expectUnavailable(parse, record("public/" + control + PRIVATE + ".txt"));
});

test("F26a staged protocol rejects trailing dots or spaces in every component", async () => {
    const parse = await implementation();
    for (const path of ["public.", "public ", "nested./public.txt", "nested /public.txt", "nested/public.txt. ",
        "a/.../b", "a/ /b", "a/. /b"])
        expectUnavailable(parse, record(path));
});

test("F26a staged protocol rejects Windows device names including extensions and superscript aliases", async () => {
    const parse = await implementation();
    for (const name of ["CON", "con.txt", "PRN", "AUX.json", "NUL", "nul.any.more", "COM1", "com9.log", "LPT1", "lpt9.txt",
        "COM¹", "com².txt", "COM³", "LPT¹.log", "lpt²", "LPT³.json", "CONIN$", "CONOUT$", "CLOCK$"])
        expectUnavailable(parse, record("nested/" + name));
});

test("F26a staged protocol rejects short-name aliases instead of resolving them", async () => {
    const parse = await implementation();
    for (const path of ["GIT~1/config", "public/SAFE~1.TXT", "public/longna~12.log", "a/x~1/b"])
        expectUnavailable(parse, record(path));
});

test("F26a staged protocol rejects reserved Git metadata components at every depth", async () => {
    const parse = await implementation();
    for (const path of [".git", ".git/config", "a/.git/config", "a/.GIT/HEAD", ".GiT/index", "a/.git./config", "a/.git /config"])
        expectUnavailable(parse, record(path));
    assert.equal(parse(record(".gitignore"))?.[0].path, ".gitignore", "ordinary Git text configuration is not a metadata-directory alias");
});

test("F26a staged protocol rejects exact and Windows-case-insensitive duplicate paths", async () => {
    const parse = await implementation();
    for (const second of ["src/Public.ts", "SRC/public.TS"])
        expectUnavailable(parse, Buffer.concat([record("src/Public.ts"), record(second, oid(2), "100755")]));
});

test("F26a staged protocol refuses Unicode-normalization path aliases without rewriting spelling", async () => {
    const parse = await implementation();
    expectUnavailable(parse, Buffer.concat([record("unicode/caf\u00e9.txt"), record("unicode/cafe\u0301.txt", oid(2))]));
    const literal = "unicode/cafe\u0301.txt";
    assert.equal(parse(record(literal))?.[0].path, literal, "accepted input spelling must remain exact");
});

test("F26a staged protocol rejects a file path that is also another entry's directory ancestor", async () => {
    const parse = await implementation();
    for (const pair of [["public", "public/readme.txt"], ["Public/readme.txt", "PUBLIC"], ["a/b", "A/B/c.txt"]])
        expectUnavailable(parse, Buffer.concat(pair.map(path => record(path))));
});

test("F26a staged protocol enforces2048 UTF8 path bytes and255 UTF16 component units", async () => {
    const parse = await implementation();
    const exact = sizedPath(2048, 1);
    assert.equal(Buffer.byteLength(exact, "utf8"), 2048);
    assert.equal(parse(record(exact))?.[0].path, exact);
    expectUnavailable(parse, record(sizedPath(2049, 1)));
    const component = "p".repeat(255);
    assert.equal(parse(record(component))?.[0].path, component);
    expectUnavailable(parse, record("p".repeat(256)));
    const multibyte = "é".repeat(255);
    assert.equal(parse(record(multibyte))?.[0].path, multibyte, "component limit is not an ASCII-only byte limit");
});

test("F26a staged protocol decodes UTF8 fatally and does not strip a path BOM", async () => {
    const parse = await implementation();
    const header = Buffer.from("100644 " + oid() + " 0\t", "ascii");
    for (const bytes of [[0xc3, 0x28], [0xc0, 0xaf], [0xe0, 0x80, 0xaf], [0xed, 0xa0, 0x80], [0xf4, 0x90, 0x80, 0x80],
        [0xff], [0xe2, 0x82], [0xef, 0xbb, 0xbf, 0x70]])
        expectUnavailable(parse, Buffer.concat([header, Buffer.from(bytes), Buffer.from([0])]));
});

test("F26a staged protocol withholds a valid prefix when a late record is malformed", async () => {
    const parse = await implementation();
    const prefix = Buffer.concat(Array.from({ length: 20 }, (_, index) => record("public/entry-" + index + ".txt")));
    expectUnavailable(parse, Buffer.concat([prefix, record("private/" + PRIVATE + ".txt", oid(), "100644", "2")]));
});

test("F26a staged protocol does not mutate caller buffer bytes on success or refusal", async () => {
    const parse = await implementation();
    for (const input of [record("public.txt"), Buffer.concat([record("public.txt"), record("../" + PRIVATE)])]) {
        const before = Buffer.from(input);
        parse(input);
        assert.equal(Buffer.compare(input, before), 0, "the parser must not rewrite or zero caller-owned input");
    }
});

test("F26a staged protocol accepts Buffer views without reading unrelated backing-array bytes", async () => {
    const parse = await implementation();
    const valid = record("public.txt"), prefix = Buffer.from(PRIVATE), suffix = Buffer.from(PRIVATE);
    const backing = Buffer.concat([prefix, valid, suffix]);
    assert.deepEqual(parse(backing.subarray(prefix.length, prefix.length + valid.length)), [{ path: "public.txt", oid: oid(), mode: "100644" }]);
});

test("F26a staged protocol rejects non-Buffers without invoking accessors or coercion", async () => {
    const parse = await implementation();
    let reads = 0;
    const poison = Object.create(null);
    for (const key of ["length", "byteLength", "buffer", "toString", "valueOf", Symbol.toPrimitive])
        Object.defineProperty(poison, key, { get() { reads++; throw Error(PRIVATE); } });
    for (const value of [undefined, null, true, 1, 1n, Symbol("public"), "", [], {}, new Uint8Array(record("public.txt")),
        new ArrayBuffer(0), poison]) expectUnavailable(parse, value);
    assert.equal(reads, 0, "Buffer admission must precede untrusted property reads");
});

test("F26a staged protocol rejects forged Buffer prototypes and proxies without property traps", async () => {
    const parse = await implementation();
    let reads = 0;
    const forged = Object.create(Buffer.prototype);
    for (const key of ["length", "byteLength", "buffer", "toString"])
        Object.defineProperty(forged, key, { get() { reads++; throw Error(PRIVATE); } });
    const proxied = new Proxy(record("public.txt"), { get() { reads++; throw Error(PRIVATE); } });
    expectUnavailable(parse, forged);
    expectUnavailable(parse, proxied);
    assert.equal(reads, 0, "native byte-view admission must reject a forged object before touching its properties");
});

test("F26a staged protocol writes no raw input diagnostics to console or output streams", async () => {
    const parse = await implementation();
    const consoleMethods = ["log", "info", "warn", "error", "debug"] as const;
    const before = consoleMethods.map(name => console[name]);
    const stdout = process.stdout.write, stderr = process.stderr.write;
    let writes = 0, threw = false;
    try {
        for (const name of consoleMethods) console[name] = () => { writes++; };
        process.stdout.write = (() => { writes++; return true; }) as typeof process.stdout.write;
        process.stderr.write = (() => { writes++; return true; }) as typeof process.stderr.write;
        try {
            parse(record("private/" + PRIVATE + ".txt"));
            parse(Buffer.concat([record("private/" + PRIVATE + ".txt"), record("../" + PRIVATE)]));
            parse(Buffer.from(PRIVATE));
        } catch { threw = true; }
    } finally {
        consoleMethods.forEach((name, index) => { console[name] = before[index]; });
        process.stdout.write = stdout; process.stderr.write = stderr;
    }
    assert.equal(threw, false, "the parser must return unavailable rather than expose caught input-bearing errors");
    assert.equal(writes, 0, "pure parser must not emit input-bearing diagnostics");
});
