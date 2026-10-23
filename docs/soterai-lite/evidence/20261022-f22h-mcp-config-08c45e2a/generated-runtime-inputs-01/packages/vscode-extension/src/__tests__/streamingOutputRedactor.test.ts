import assert from "node:assert/strict";
import { test } from "node:test";
import { StreamingOutputRedactor, STREAM_OUTPUT_LIMITS } from "../../../core/src/StreamingOutputRedactor";

// Frozen F08 contract fixtures. All data is synthetic and in memory; no files,
// environment, credential store, clocks, network or previous operation state.
const SECRET = "F08 private É🔐/value qZ9";
const MASK = "[REDACTED_SECRET_OUTPUT]";
type Channel = "stdout" | "stderr";
type Chunk = { channel: Channel; bytes: Uint8Array };
type Result = ReturnType<StreamingOutputRedactor["finish"]>;
const chunk = (text: string, channel: Channel = "stdout"): Chunk => ({ channel, bytes: Buffer.from(text, "utf8") });
const percentAll = (value: string): string => [...Buffer.from(value)].map(byte => "%" + byte.toString(16).padStart(2, "0")).join("");
function progress(redactor: StreamingOutputRedactor, next: Chunk, expected?: "BUFFERED" | "WITHHELD"): void {
    const result = redactor.push(next.channel, next.bytes);
    assert.ok(Object.isFrozen(result));
    assert.ok(result.status === "BUFFERED" || result.status === "WITHHELD");
    assert.deepEqual(Object.keys(result), ["status"], "A push never releases an undecided prefix or any input metadata.");
    if (expected) assert.equal(result.status, expected);
}
function collect(values: readonly string[], chunks: readonly Chunk[], exitCode = 0): Result {
    const redactor = new StreamingOutputRedactor(values);
    for (const next of chunks) progress(redactor, next);
    return redactor.finish(exitCode);
}
function complete(result: Result, stdout: string, stderr = "", exitCode = 0, redacted = false): void {
    assert.ok(Object.isFrozen(result)); assert.equal(result.status, "COMPLETE");
    assert.equal(result.stdout, stdout); assert.equal(result.stderr, stderr);
    assert.equal(result.exitCode, exitCode); assert.equal(result.redacted, redacted);
}
function withheld(result: Result): void {
    assert.ok(Object.isFrozen(result)); assert.equal(result.status, "WITHHELD");
    assert.equal(result.stdout, ""); assert.equal(result.stderr, ""); assert.equal(result.redacted, false);
    assert.equal(typeof result.reason, "string"); assert.ok(result.reason!.length > 0);
    assert.ok(!JSON.stringify(result).includes(SECRET));
    assert.doesNotMatch(JSON.stringify(result), /"(?:value|rawValue|fragment|valueHash|fingerprint|preview)"\s*:/);
}
function allSplits(source: string, values: readonly string[], expected: string, redacted = false): void {
    const bytes = Buffer.from(source);
    for (let split = 0; split <= bytes.length; split++) {
        const redactor = new StreamingOutputRedactor(values);
        progress(redactor, { channel: "stdout", bytes: bytes.subarray(0, split) }, "BUFFERED");
        progress(redactor, { channel: "stdout", bytes: bytes.subarray(split) }, "BUFFERED");
        complete(redactor.finish(0), expected, "", 0, redacted);
    }
}

test("F08-R01 public exports preserve all frozen inclusive stream limits", () => {
    assert.ok(Object.isFrozen(STREAM_OUTPUT_LIMITS));
    assert.deepEqual(STREAM_OUTPUT_LIMITS, { maxInputBytes: 131072, maxOutputBytes: 131072,
        maxChunks: 4096, maxSgrLength: 128, maxControlLength: 4096, maxExpansion: 32 });
});

test("F08-R02 public text stays buffered until finish and retains both useful output channels", () => {
    const redactor = new StreamingOutputRedactor([SECRET]);
    progress(redactor, chunk("Useful build output\n"), "BUFFERED");
    progress(redactor, chunk("One ordinary warning\n", "stderr"), "BUFFERED");
    progress(redactor, chunk("Build complete.\n"), "BUFFERED");
    complete(redactor.finish(0), "Useful build output\nBuild complete.\n", "One ordinary warning\n");
});

test("F08-R03 an empty operation and empty chunks release empty completed output", () => {
    complete(new StreamingOutputRedactor([]).finish(0), "");
    const redactor = new StreamingOutputRedactor([]);
    progress(redactor, chunk(""), "BUFFERED"); progress(redactor, chunk("", "stderr"), "BUFFERED");
    complete(redactor.finish(0), "");
});

for (const [name, encode] of [
    ["raw", (value: string) => value],
    ["base64 padded", (value: string) => Buffer.from(value).toString("base64")],
    ["base64 unpadded", (value: string) => Buffer.from(value).toString("base64").replace(/=+$/, "")],
    ["base64url padded", (value: string) => { const raw = Buffer.from(value).toString("base64url"); return raw + "=".repeat((4 - raw.length % 4) % 4); }],
    ["base64url unpadded", (value: string) => Buffer.from(value).toString("base64url")],
    ["hex lowercase", (value: string) => Buffer.from(value).toString("hex")],
    ["hex uppercase", (value: string) => Buffer.from(value).toString("hex").toUpperCase()],
    ["hex mixed case", (value: string) => [...Buffer.from(value).toString("hex")].map((char, index) => index % 2 ? char.toUpperCase() : char).join("")],
    ["URL full", percentAll],
    ["URL partial", (value: string) => value.replace("private", "%70rivate")],
    ["JSON quoted", (value: string) => JSON.stringify(value).replace("private", "\\u0070rivate")],
    ["JSON string body", (value: string) => JSON.stringify(value).slice(1, -1).replace("private", "\\u0070rivate")],
] as const) {
    test(`F08-R04 every byte split of ${name} masks the complete nonempty channel without a prefix leak`, () => {
        allSplits("before " + encode(SECRET) + " after", [SECRET], MASK, true);
        allSplits(encode("Useful public É🔐 control"), [SECRET], encode("Useful public É🔐 control"));
    });
}

test("F08-R05 every byte split preserves public Unicode, a leading BOM and exact normalization distinctions", () => {
    allSplits("\uFEFFUseful É🔐 cafe\u0301\tline\n", [SECRET], "\uFEFFUseful É🔐 cafe\u0301\tline\n");
    const privateValue = "F08 Café  private";
    complete(collect([privateValue], [chunk(privateValue.normalize("NFD"))]), privateValue.normalize("NFD"));
    complete(collect([privateValue], [chunk(privateValue.toLowerCase())]), privateValue.toLowerCase());
    complete(collect([privateValue], [chunk(privateValue.replace("  ", " "))]), privateValue.replace("  ", " "));
});

test("F08-R06 one-byte pushes may split every scalar while separate decoders preserve interleaved channels", () => {
    const stdout = Buffer.from("Start É🔐 done\n"), stderr = Buffer.from("Public Ω notice\n");
    const redactor = new StreamingOutputRedactor([SECRET]);
    for (let index = 0; index < Math.max(stdout.length, stderr.length); index++) {
        if (index < stdout.length) progress(redactor, { channel: "stdout", bytes: stdout.subarray(index, index + 1) }, "BUFFERED");
        if (index < stderr.length) progress(redactor, { channel: "stderr", bytes: stderr.subarray(index, index + 1) }, "BUFFERED");
    }
    complete(redactor.finish(0), "Start É🔐 done\n", "Public Ω notice\n");
});

test("F08-R07 channels cannot complete each other's pending UTF-8 scalar", () => {
    const scalar = Buffer.from("🔐");
    withheld(collect([], [{ channel: "stdout", bytes: scalar.subarray(0, 2) },
        { channel: "stderr", bytes: scalar.subarray(2) }]));
});

test("F08-R08 ANSI SGR insertion between every scalar is removed before registered-value recognition", () => {
    const decorated = Array.from(SECRET).join("\u001b[31m\u001b[0m");
    allSplits(decorated, [SECRET], MASK, true);
    allSplits("plain \u001b[1;38:2:1:2:3museful\u001b[m output", [], "plain useful output");
    allSplits("plain \u009b32museful\u009b0m output", [], "plain useful output");
});

test("F08-R09 complete OSC title, clipboard and hyperlink payloads never reach completed output", () => {
    for (const [intro, end] of [["\u001b]", "\u0007"], ["\u001b]", "\u001b\\"], ["\u009d", "\u009c"]]) {
        const source = "before" + intro + "52;c;" + SECRET + end + "after";
        allSplits(source, [SECRET], "beforeafter");
    }
    allSplits("\u001b]8;;https://example.invalid/hidden\u001b\\Public link\u001b]8;;\u001b\\", [], "Public link");
});

test("F08-R10 CRLF normalization preserves LF and tab across every byte split", () => {
    allSplits("first\r\nsecond\tcolumn\r\nthird\n", [], "first\nsecond\tcolumn\nthird\n");
    complete(collect([], [chunk("out\r"), chunk("warning\r", "stderr"), chunk("\n"), chunk("\n", "stderr")]), "out\n", "warning\n");
});

test("F08-R11 per-channel ANSI parser states survive interleaving without consuming the other channel", () => {
    complete(collect([], [chunk("before\u001b[3"), chunk("warning\u001b]title", "stderr"),
        chunk("1mafter"), chunk("\u0007after", "stderr")]), "beforeafter", "warningafter");
    withheld(collect([], [chunk("\u001b[3"), chunk("1m", "stderr")]));
    withheld(collect([], [chunk("\u001b]unfinished"), chunk("\u0007", "stderr")]));
});

test("F08-R12 insertion inside a UTF-8 scalar is invalid rather than repaired after stripping ANSI", () => {
    const scalar = Buffer.from("🔐");
    const bytes = Buffer.concat([scalar.subarray(0, 2), Buffer.from("\u001b[0m"), scalar.subarray(2)]);
    withheld(collect([], [{ channel: "stdout", bytes }]));
});

test("F08-R13 emission-arrival grouping recognizes secrets absent from either normalized channel alone", () => {
    const first = SECRET.slice(0, 7), middle = SECRET.slice(7, 15), last = SECRET.slice(15);
    complete(collect([SECRET], [chunk(first), chunk(middle, "stderr"), chunk(last)]), MASK, MASK, 0, true);
});

test("F08-R14 the consumer's stdout-then-stderr group is checked even when arrival order differs", () => {
    const split = Math.floor(SECRET.length / 2);
    complete(collect([SECRET], [chunk(SECRET.slice(split), "stderr"), chunk(SECRET.slice(0, split))]), MASK, MASK, 0, true);
});

test("F08-R15 matching one channel masks every nonempty channel while preserving an empty channel", () => {
    complete(collect([SECRET], [chunk("Useful public output"), chunk(SECRET, "stderr")]), MASK, MASK, 0, true);
    complete(collect([SECRET], [chunk(SECRET, "stderr")]), "", MASK, 0, true);
    complete(collect([SECRET], [chunk(SECRET)]), MASK, "", 0, true);
});

test("F08-R16 grouping does not permute fragments, remove separators or combine independent operations", () => {
    const split = 8, left = SECRET.slice(0, split), right = SECRET.slice(split);
    complete(collect([SECRET], [chunk(right), chunk(left, "stderr")]), right, left);
    complete(collect([SECRET], [chunk(left), chunk(" "), chunk(right)]), left + " " + right);
    const a = new StreamingOutputRedactor([SECRET]), b = new StreamingOutputRedactor([SECRET]);
    progress(a, chunk(left), "BUFFERED"); progress(b, chunk(right), "BUFFERED");
    complete(a.finish(0), left); complete(b.finish(0), right);
});

test("F08-R17 public output reaches the exact input and output byte limits across both channels", () => {
    const stdout = " ".repeat(65536), stderr = "\n".repeat(65536);
    complete(collect([], [chunk(stdout), chunk(stderr, "stderr")]), stdout, stderr);
    const scalarOutput = "é".repeat(65536);
    complete(collect([], [chunk(scalarOutput)]), scalarOutput);
});

test("F08-R18 raw bytes count before removed controls and overflow atomically withholds earlier output", () => {
    withheld(collect([SECRET], [chunk(SECRET), chunk(" ".repeat(131073))]));
    const redactor = new StreamingOutputRedactor([]);
    const removed = Buffer.from("\u001b[0m".repeat(32768));
    assert.equal(removed.byteLength, 131072);
    progress(redactor, { channel: "stdout", bytes: removed }, "BUFFERED");
    progress(redactor, chunk("x"), "WITHHELD"); withheld(redactor.finish(0));
});

test("F08-R19 every push including empty chunks spends the inclusive chunk budget", () => {
    const exact = new StreamingOutputRedactor([]);
    for (let index = 0; index < 4095; index++) progress(exact, chunk(""), "BUFFERED");
    progress(exact, chunk("Useful output"), "BUFFERED"); complete(exact.finish(0), "Useful output");
    const over = new StreamingOutputRedactor([]);
    for (let index = 0; index < 4096; index++) progress(over, chunk(""), "BUFFERED");
    progress(over, chunk("", "stderr"), "WITHHELD"); withheld(over.finish(0));
});

test("F08-R20 SGR sequence length includes its introducer and terminator at the exact limit", () => {
    for (const intro of ["\u001b[", "\u009b"]) {
        const valid = intro + "0".repeat(128 - intro.length - 1) + "m";
        assert.equal(valid.length, 128); complete(collect([], [chunk("before" + valid + "after")]), "beforeafter");
        withheld(collect([], [chunk(valid.slice(0, -1) + "0m")]));
    }
});

test("F08-R21 OSC sequence length includes every supported introducer and terminator at the exact limit", () => {
    for (const intro of ["\u001b]", "\u009d"]) for (const end of ["\u0007", "\u001b\\", "\u009c"]) {
        const body = "A".repeat(4096 - intro.length - end.length), valid = intro + body + end;
        assert.equal(valid.length, 4096); complete(collect([], [chunk("before" + valid + "after")]), "beforeafter");
        withheld(collect([], [chunk(intro + body + "A" + end)]));
    }
});

test("F08-R22 masking a one-byte secret stays within the minimum output expansion allowance", () => {
    complete(collect(["x"], [chunk("x"), chunk("x", "stderr")]), MASK, MASK, 0, true);
    assert.ok(Buffer.byteLength(MASK + MASK) <= 64);
});

test("F08-R23 signed 32-bit nonzero exit codes retain useful sanitized output", () => {
    for (const exitCode of [-2147483648, -1, 1, 17, 2147483647])
        complete(collect([], [chunk("Useful result"), chunk("Expected warning", "stderr")], exitCode), "Useful result", "Expected warning", exitCode);
});

test("F08-R24 invalid exit metadata withholds the whole operation rather than returning its buffered text", () => {
    for (const exitCode of [NaN, Infinity, -Infinity, 0.5, 2147483648, -2147483649, "0", null, undefined]) {
        const redactor = new StreamingOutputRedactor([]);
        progress(redactor, chunk("Useful but undecided result"), "BUFFERED");
        withheld(redactor.finish(exitCode as number));
    }
});

test("F08-R25 cancel and dispose immediately terminate buffered operations and cannot be reversed", () => {
    for (const method of ["cancel", "dispose"] as const) {
        const redactor = new StreamingOutputRedactor([SECRET]); progress(redactor, chunk(SECRET), "BUFFERED");
        redactor[method](); redactor[method](); progress(redactor, chunk("later public"), "WITHHELD");
        withheld(redactor.finish(0)); withheld(redactor.finish(0));
    }
});

test("F08-R26 completion is single-use and later calls cannot replay the completed result", () => {
    const redactor = new StreamingOutputRedactor([]); progress(redactor, chunk("Useful completed output"), "BUFFERED");
    complete(redactor.finish(0), "Useful completed output");
    progress(redactor, chunk("late output"), "WITHHELD"); withheld(redactor.finish(0));
    redactor.cancel(); redactor.dispose(); withheld(redactor.finish(0));
});

test("F08-R27 an initially withdrawn flag permanently withholds while a fresh re-enabled operation succeeds", () => {
    let enabled = false; const redactor = new StreamingOutputRedactor([SECRET], { enabled: () => enabled });
    progress(redactor, chunk("Useful result"), "WITHHELD"); enabled = true;
    progress(redactor, chunk("later"), "WITHHELD"); withheld(redactor.finish(0));
    const fresh = new StreamingOutputRedactor([], { enabled: () => enabled }); progress(fresh, chunk("Fresh public result"), "BUFFERED");
    complete(fresh.finish(0), "Fresh public result");
});

test("F08-R28 flag withdrawal during collection or final flush never falls back to retained plaintext", () => {
    for (const withdrawOnPush of [false, true]) {
        let enabled = true; const redactor = new StreamingOutputRedactor([SECRET], { enabled: () => enabled });
        progress(redactor, chunk("Useful prefix " + SECRET), "BUFFERED"); enabled = false;
        if (withdrawOnPush) progress(redactor, chunk(""), "WITHHELD");
        withheld(redactor.finish(0)); enabled = true; withheld(redactor.finish(0));
    }
});

test("F08-R29 throwing flag callbacks produce constant safe withholding without exposing exception messages", () => {
    let fail = false; const redactor = new StreamingOutputRedactor([], { enabled: () => { if (fail) throw new Error(SECRET); return true; } });
    progress(redactor, chunk("Useful prefix"), "BUFFERED"); fail = true; withheld(redactor.finish(0));
    const initial = new StreamingOutputRedactor([], { enabled: () => { throw new Error(SECRET); } });
    progress(initial, chunk(SECRET), "WITHHELD"); withheld(initial.finish(0));
});

test("F08-R30 invalid UTF-8 sequences and unfinished final scalars withhold the complete operation", () => {
    for (const invalid of [[0x80], [0xc0, 0xaf], [0xed, 0xa0, 0x80], [0xf4, 0x90, 0x80, 0x80], [0xf0, 0x9f, 0x94]])
        withheld(collect([SECRET], [chunk("Useful prefix " + SECRET), { channel: "stderr", bytes: Uint8Array.from(invalid) }]));
});

test("F08-R31 unsupported editing, C0, C1 and bidi controls cannot reach any completed output", () => {
    for (const control of ["\u0000", "\u0001", "\b", "\u000b", "\u000c", "\u001a", "\u007f", "\u0080", "\u0085", "\u0090", "\u009c",
        "\u202e", "\u2066", "\u001b[2J", "\u001b[1A", "\u001b7", "\u001bc"])
        withheld(collect([], [chunk("Useful prefix" + control + "suffix")]));
});

test("F08-R32 bare carriage returns and unfinished ESC, CSI or OSC states withhold at final flush", () => {
    for (const ending of ["\r", "\rnext", "\r\r\n", "\u001b", "\u001b[", "\u001b[31", "\u009b31", "\u001b]title", "\u009dtitle", "\u001b]title\u001b"])
        withheld(collect([], [chunk("Useful prefix" + ending)]));
});

test("F08-R33 the processor copies only a supplied byte view and caller mutation cannot change its decision", () => {
    const source = Buffer.from("Useful public output"), redactor = new StreamingOutputRedactor([SECRET]);
    progress(redactor, { channel: "stdout", bytes: source }, "BUFFERED"); source.fill(0);
    complete(redactor.finish(0), "Useful public output");
    const privateBytes = Buffer.from(SECRET), masked = new StreamingOutputRedactor([SECRET]);
    progress(masked, { channel: "stdout", bytes: privateBytes }, "BUFFERED"); privateBytes.fill(0x20);
    complete(masked.finish(0), MASK, "", 0, true);
    const backing = Buffer.from(SECRET + "Useful public slice" + SECRET), offset = Buffer.byteLength(SECRET);
    const view = new Uint8Array(backing.buffer, backing.byteOffset + offset, Buffer.byteLength("Useful public slice"));
    complete(collect([SECRET], [{ channel: "stdout", bytes: view }]), "Useful public slice");
});

test("F08-R34 stream state serialization exposes no registered values, retained chunks or derived spellings", () => {
    const redactor = new StreamingOutputRedactor([SECRET]); progress(redactor, chunk(SECRET), "BUFFERED");
    for (const serialized of [JSON.stringify(redactor), JSON.stringify(redactor.push("stderr", Buffer.alloc(0)))]) {
        assert.equal(typeof serialized, "string");
        for (const spelling of [SECRET, Buffer.from(SECRET).toString("base64"), Buffer.from(SECRET).toString("hex"), encodeURIComponent(SECRET)])
            assert.ok(!serialized.includes(spelling));
        assert.doesNotMatch(serialized, /"(?:value|rawValue|fragment|valueHash|fingerprint|preview|stdout|stderr|bytes)"\s*:/);
    }
    complete(redactor.finish(0), MASK, "", 0, true);
});

test("F08-R35 F07 invalid-registration, match-count and work budgets remain atomic in the byte pipeline", () => {
    withheld(collect([SECRET, ""], [chunk(SECRET)]));
    const value = "F08 repeated private value qZ9";
    withheld(collect([value], [chunk(Array.from({ length: 257 }, () => value).join(" "))]));
    const values = Array.from({ length: 128 }, (_, index) => `F08 private value ${String(index).padStart(3, "0")} qZ9`);
    withheld(collect(values, [chunk(values[0] + " ".repeat(131072 - values[0].length))]));
});

test("F08-R36 deterministic byte partitions preserve public normalization and mask encoded secret operations", () => {
    let seed = 0xf08015;
    const next = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed; };
    for (let index = 0; index < 48; index++) {
        const value = `F08 synthetic ${next().toString(36)} É🔐 qZ9`;
        const source = index % 2 ? Buffer.from(value).toString("base64") : Array.from(value).join("\u001b[0m");
        const redactor = new StreamingOutputRedactor([value]), bytes = Buffer.from(source);
        for (let at = 0; at < bytes.length;) {
            const end = Math.min(bytes.length, at + 1 + next() % 7);
            progress(redactor, { channel: "stdout", bytes: bytes.subarray(at, end) }, "BUFFERED"); at = end;
            if (next() % 5 === 0) progress(redactor, chunk("", "stderr"), "BUFFERED");
        }
        complete(redactor.finish(0), MASK, "", 0, true);
        const publicText = `Public É🔐 control ${index}\r\n\tCafe\u0301\n`;
        const decorated = Array.from(publicText.replace(/\r\n/g, "\n")).join("\u001b[0m"), publicBytes = Buffer.from(decorated);
        const publicRedactor = new StreamingOutputRedactor([value]);
        for (let at = 0; at < publicBytes.length;) {
            const end = Math.min(publicBytes.length, at + 1 + next() % 9);
            progress(publicRedactor, { channel: "stdout", bytes: publicBytes.subarray(at, end) }, "BUFFERED"); at = end;
        }
        complete(publicRedactor.finish(0), publicText.replace(/\r\n/g, "\n"));
    }
});
