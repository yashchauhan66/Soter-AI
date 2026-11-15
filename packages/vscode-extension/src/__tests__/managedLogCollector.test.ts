import assert from "node:assert/strict";
import { test } from "node:test";

// PREPARED TESTS ONLY until the F24 transition byte barrier passes. Root may
// then copy these exact bytes into src/__tests__/managedLogCollector.test.ts.
// The final canonical import is intentional. Every fixture is synthetic and
// in memory: no process, source file, environment, key store, clock or network.
const PRIVATE = "TEST_ONLY_F25_PRIVATE_caf\u00e9/\u96ea_value_72ac9b41";
const MASK = "[REDACTED_SECRET_OUTPUT]";
const PUBLIC = "Useful public build output.\n";
type Channel = "stdout" | "stderr";
type OutputResult = Readonly<{ status: "COMPLETE" | "WITHHELD"; stdout: string; stderr: string;
    redacted: boolean; exitCode?: number; reason?: string }>;
interface Collector {
    available(): boolean;
    push(channel: Channel, bytes: Uint8Array): Readonly<{ status: "BUFFERED" | "WITHHELD" }>;
    finish(exitCode: number): OutputResult;
    canRelease(result: OutputResult): boolean;
    cancel(): void;
    dispose(): void;
}
type Constructor = new (values: readonly string[], enabled: () => boolean) => Collector;
type Piece = { channel: Channel; bytes: Uint8Array };
const bytes = (text: string) => Buffer.from(text, "utf8");
const piece = (text: string, channel: Channel = "stdout"): Piece => ({ channel, bytes: bytes(text) });
const percentAll = (text: string) => [...bytes(text)].map(value => "%" + value.toString(16).padStart(2, "0")).join("");
const unicodeAll = (text: string) => [...text].map(value => value.codePointAt(0)! <= 0xffff
    ? "\\u" + value.charCodeAt(0).toString(16).padStart(4, "0") : value).join("");
async function constructor(): Promise<Constructor> {
    const module = await import("../logs/ManagedLogCollector");
    assert.ok(typeof module.ManagedLogCollector === "function", "The managed collector implementation must exist.");
    return module.ManagedLogCollector as unknown as Constructor;
}
function noPrivate(value: unknown): void {
    const serialized = JSON.stringify(value) ?? "";
    assert.ok(!serialized.includes(PRIVATE), "A result or progress record must not contain the synthetic registration.");
    assert.ok(!serialized.includes(Buffer.from(PRIVATE).toString("base64")), "A result must not retain an encoded synthetic registration.");
    assert.ok(!serialized.includes(percentAll(PRIVATE)), "A result must not retain a percent-encoded synthetic registration.");
}
function progress(collector: Collector, input: Piece, expected?: "BUFFERED" | "WITHHELD"): void {
    const result = collector.push(input.channel, input.bytes);
    assert.ok(Object.isFrozen(result), "Progress records must be immutable.");
    assert.deepEqual(Object.keys(result), ["status"], "Collection must not release undecided output, previews or lengths.");
    assert.ok(result.status === "BUFFERED" || result.status === "WITHHELD", "Collection must have a finite progress status.");
    if (expected) assert.ok(result.status === expected, "Unexpected collection progress status.");
    noPrivate(result);
}
function complete(result: OutputResult, stdout: string, stderr = "", exitCode = 0, redacted = false): void {
    assert.ok(Object.isFrozen(result), "A completed result must be immutable.");
    assert.ok(result.status === "COMPLETE", "A useful public operation must complete.");
    assert.ok(result.stdout === stdout, "Completed stdout differs from the declared public treatment.");
    assert.ok(result.stderr === stderr, "Completed stderr differs from the declared public treatment.");
    assert.ok(result.exitCode === exitCode, "The actual finite exit code must be preserved.");
    assert.ok(result.redacted === redacted, "The completion must accurately describe redaction.");
    noPrivate(result);
}
function withheld(collector: Collector, result: OutputResult): void {
    assert.ok(Object.isFrozen(result), "A withheld result must be immutable.");
    assert.ok(result.status === "WITHHELD", "Unavailable protection must withhold atomically.");
    assert.ok(result.stdout === "" && result.stderr === "", "Withholding must not release an earlier public or private prefix.");
    assert.ok(result.redacted === false, "Withheld output is not a successful redaction.");
    assert.ok(typeof result.reason === "string" && result.reason.length > 0, "Withholding must provide a static reason.");
    assert.ok(collector.canRelease(result) === false, "A withheld result must never receive publication authority.");
    noPrivate(result);
}
async function collect(input: readonly Piece[], values: readonly string[] = [PRIVATE], exitCode = 0) {
    const C = await constructor(), collector = new C(values, () => true);
    for (const next of input) progress(collector, next);
    return { collector, result: collector.finish(exitCode) };
}

test("F25-L01 construction and availability create no output or early publication authority", async () => {
    const C = await constructor(), collector = new C([PRIVATE], () => true);
    assert.ok(collector.available() === true, "A fresh enabled collector should be available.");
    const forged: OutputResult = Object.freeze({ status: "COMPLETE", stdout: PUBLIC, stderr: "", redacted: false, exitCode: 0 });
    assert.ok(collector.canRelease(forged) === false, "A caller object cannot invent a completed operation.");
    progress(collector, piece(PUBLIC), "BUFFERED"); assert.ok(collector.canRelease(forged) === false, "A buffered prefix grants no release authority.");
    collector.dispose(); withheld(collector, collector.finish(0));
});

test("F25-L02 public stdout, compiler warnings and an ordinary nonzero error stack remain useful", async () => {
    const stdout = "Compile started.\nCompile stopped with one ordinary diagnostic.\n";
    const stderr = "TypeError: public option must be a number\n    at build (public-task.js:5:2)\n";
    const { collector, result } = await collect([piece(stdout), piece(stderr, "stderr")], [PRIVATE], 17);
    complete(result, stdout, stderr, 17); assert.ok(collector.canRelease(result), "The exact completed error report should remain releasable.");
});

test("F25-L03 public test and TAP output preserves assertions, totals and exit status", async () => {
    const stdout = "TAP version 13\n# public build controls\nok 1 - public asset\nnot ok 2 - ordinary assertion\n1..2\n# tests 2\n# pass 1\n# fail 1\n";
    const { collector, result } = await collect([piece(stdout)], [PRIVATE], 1);
    complete(result, stdout, "", 1); assert.ok(collector.canRelease(result), "A public failing test report must remain useful.");
});

test("F25-L04 an empty completed operation has one exact immutable result capability", async () => {
    const C = await constructor(), collector = new C([], () => true);
    progress(collector, piece(""), "BUFFERED"); const result = collector.finish(0); complete(result, "");
    assert.ok(collector.canRelease(result), "The exact empty completion remains a valid completed result.");
    assert.ok(collector.canRelease(result), "Repeated freshness checks must accept the same current object.");
});

const representations: ReadonlyArray<readonly [string, (text: string) => string]> = [
    ["raw", text => text], ["base64 padded", text => bytes(text).toString("base64")],
    ["base64 unpadded", text => bytes(text).toString("base64").replace(/=+$/, "")],
    ["base64url padded", text => { const encoded = bytes(text).toString("base64url"); return encoded + "=".repeat((4 - encoded.length % 4) % 4); }],
    ["base64url unpadded", text => bytes(text).toString("base64url")],
    ["hex lowercase", text => bytes(text).toString("hex")], ["hex uppercase", text => bytes(text).toString("hex").toUpperCase()],
    ["hex mixed case", text => [...bytes(text).toString("hex")].map((value, index) => index % 2 ? value.toUpperCase() : value).join("")],
    ["percent full", percentAll], ["percent partial", text => text.replace("PRIVATE", "%50RIVATE")],
    ["JSON quoted", text => JSON.stringify(text).replace("PRIVATE", "\\u0050RIVATE")],
    ["JSON string body", text => JSON.stringify(text).slice(1, -1).replace("PRIVATE", "\\u0050RIVATE")],
];
for (const [label, encode] of representations) {
    test("F25-L05 every byte split of " + label + " stays buffered until whole-channel redaction", async () => {
        const C = await constructor(), source = bytes("public prefix " + encode(PRIVATE) + " public suffix\n");
        for (let split = 0; split <= source.length; split++) {
            const collector = new C([PRIVATE], () => true);
            progress(collector, { channel: "stdout", bytes: source.subarray(0, split) }, "BUFFERED");
            progress(collector, { channel: "stdout", bytes: source.subarray(split) }, "BUFFERED");
            const result = collector.finish(0); complete(result, MASK, "", 0, true);
            assert.ok(collector.canRelease(result), "Only the exact sanitized completion may be published.");
        }
    });
}

test("F25-L06 a raw known value in an error stack masks both nonempty channels and retains the actual error exit", async () => {
    const { collector, result } = await collect([piece(PUBLIC), piece("Error: rejected " + PRIVATE + "\n    at task (public-task.js:3:1)\n", "stderr")], [PRIVATE], 23);
    complete(result, MASK, MASK, 23, true); assert.ok(collector.canRelease(result), "The sanitized error completion should remain releasable.");
});

test("F25-L07 interleaved stdout and stderr fragments cannot reconstruct a registration outside the filter", async () => {
    const a = 12, b = 29;
    const { result } = await collect([piece(PRIVATE.slice(0, a)), piece(PRIVATE.slice(a, b), "stderr"), piece(PRIVATE.slice(b))]);
    complete(result, MASK, MASK, 0, true);
    const split = 15, second = await collect([piece(PRIVATE.slice(split), "stderr"), piece(PRIVATE.slice(0, split))]);
    complete(second.result, MASK, MASK, 0, true);
});

test("F25-L08 public Unicode bytes, CRLF, SGR and OSC follow the established F08 normalization", async () => {
    const C = await constructor(), collector = new C([PRIVATE], () => true);
    const decorated = bytes("\u001b[32mPublic caf\u00e9 \u96ea\r\nnext\tline\u001b[0m\u001b]52;c;discarded-payload\u0007\n");
    for (let index = 0; index < decorated.length; index++) progress(collector, { channel: "stdout", bytes: decorated.subarray(index, index + 1) }, "BUFFERED");
    const result = collector.finish(0); complete(result, "Public caf\u00e9 \u96ea\nnext\tline\n");
    assert.ok(!JSON.stringify(result).includes("discarded-payload"), "OSC payloads must not enter the completed report.");
});

test("F25-L09 invalid UTF8, unfinished controls and terminal rewriting withhold every earlier prefix", async () => {
    for (const invalid of [Uint8Array.of(0xff), Uint8Array.of(0xf0, 0x9f), bytes("\r"), bytes("\b"), bytes("\0"), bytes("\u202e"), bytes("\u001b[2J"), bytes("\u001b[31"), bytes("\u001b]unfinished")]) {
        const { collector, result } = await collect([piece(PUBLIC), { channel: "stderr", bytes: invalid }]); withheld(collector, result);
    }
});

test("F25-L10 public structured JSON preserves ordinary string leaves and both channels", async () => {
    const json = JSON.stringify({ stage: "build", notes: ["public asset", "ordinary warning"], passed: 2, detail: null });
    const { collector, result } = await collect([piece(json), piece("ordinary stderr note\n", "stderr")]);
    complete(result, json, "ordinary stderr note\n"); assert.ok(collector.canRelease(result), "Useful public structured reports must remain releasable.");
});

test("F25-L11 registrations split across JSON string leaves are caught after semantic decoding", async () => {
    for (const transform of [(value: string) => value, (value: string) => encodeURIComponent(value), (value: string) => bytes(value).toString("base64")]) {
        const encoded = transform(PRIVATE), split = Math.floor(encoded.length / 2);
        const json = JSON.stringify({ first: encoded.slice(0, split), nested: [encoded.slice(split)] });
        const C = await constructor(), source = bytes(json);
        for (let cut = 0; cut <= source.length; cut++) {
            const collector = new C([PRIVATE], () => true);
            progress(collector, { channel: "stdout", bytes: source.subarray(0, cut) }, "BUFFERED");
            progress(collector, { channel: "stdout", bytes: source.subarray(cut) }, "BUFFERED");
            progress(collector, piece("ordinary warning\n", "stderr"), "BUFFERED");
            complete(collector.finish(7), MASK, MASK, 7, true);
        }
    }
});

test("F25-L12 JSON Unicode escapes may split one registration across several semantic leaves", async () => {
    const a = 13, b = 31;
    const json = '["' + unicodeAll(PRIVATE.slice(0, a)) + '","' + unicodeAll(PRIVATE.slice(a, b)) + '","' + unicodeAll(PRIVATE.slice(b)) + '"]';
    const { collector, result } = await collect([piece(json)]); complete(result, MASK, "", 0, true);
    assert.ok(collector.canRelease(result), "Only the fully sanitized structured result may be published.");
});

test("F25-L13 a short registration that occurs in the canonical mask forces conservative withholding", async () => {
    for (const value of ["A", "E", "_", "SECRET", "OUTPUT", MASK]) {
        const { collector, result } = await collect([piece(value)], [value]); withheld(collector, result);
    }
});

test("F25-L14 a semantic-leaf match cannot release a marker that itself contains a registration", async () => {
    for (const value of ["SECRET", "OUTPUT", MASK]) {
        const split = Math.floor(value.length / 2), json = JSON.stringify([value.slice(0, split), value.slice(split)]);
        const { collector, result } = await collect([piece(json)], [value]); withheld(collector, result);
    }
});

test("F25-L15 malformed or duplicate structured JSON never falls back to public plain-text release", async () => {
    const malformed = ["{", "[", '{"stage":"build",}', '["public",]', '{"stage":1,"stage":2}',
        '{"stage":1,"\\u0073tage":2}', '{"outer":{"stage":"public","stage":"other"}}', '{"stage":"unterminated}',
        '{"stage":1} trailing', '["public"] ["other"]', '["\\ud800"]'];
    for (const input of malformed) { const { collector, result } = await collect([piece(" \t" + input), piece("public error prefix\n", "stderr")]); withheld(collector, result); }
});

test("F25-L16 the inclusive semantic string-part limit admits32 leaves and withholds33", async () => {
    const admitted = JSON.stringify(Array.from({ length: 32 }, (_, index) => "public part " + index));
    const good = await collect([piece(admitted)]); complete(good.result, admitted); assert.ok(good.collector.canRelease(good.result), "The exact32-part public report must remain useful.");
    const refused = JSON.stringify(Array.from({ length: 33 }, (_, index) => "public part " + index));
    const bad = await collect([piece(refused)]); withheld(bad.collector, bad.result);
});

test("F25-L17 the inclusive semantic depth limit admits32 levels and withholds33", async () => {
    const nested = (depth: number): string => { let value: unknown = 0; for (let index = 0; index < depth; index++) value = [value]; return JSON.stringify(value); };
    const exact = nested(32), good = await collect([piece(exact)]); complete(good.result, exact);
    const bad = await collect([piece(nested(33))]); withheld(bad.collector, bad.result);
});

test("F25-L18 the inclusive semantic node budget admits10000 nodes and withholds10001", async () => {
    // One root array plus9999 scalar number leaves is exactly10000 visited nodes.
    const exact = JSON.stringify(Array(9999).fill(0)), good = await collect([piece(exact)]); complete(good.result, exact);
    const bad = await collect([piece(JSON.stringify(Array(10000).fill(0)))]); withheld(bad.collector, bad.result);
});

test("F25-L19 exact128KiB public input remains useful while one extra byte withholds both channels", async () => {
    const text = "public note\n".repeat(10922) + "publicno"; assert.equal(Buffer.byteLength(text), 131072);
    const good = await collect([piece(text)], []); complete(good.result, text);
    const bad = await collect([piece(text), piece("x", "stderr")], []); withheld(bad.collector, bad.result);
});

test("F25-L20 stdout and stderr share the same128KiB operation budget", async () => {
    const first = "P".repeat(65536), second = "Q".repeat(65536);
    const good = await collect([piece(first), piece(second, "stderr")], []); complete(good.result, first, second);
    const bad = await collect([piece(first), piece(second, "stderr"), piece("x")], []); withheld(bad.collector, bad.result);
});

test("F25-L21 exactly4096 chunks are admitted and chunk4097 withdraws atomically", async () => {
    const C = await constructor(), good = new C([], () => true);
    for (let index = 0; index < 4096; index++) progress(good, piece(""), "BUFFERED"); complete(good.finish(0), "");
    const bad = new C([], () => true); for (let index = 0; index < 4096; index++) progress(bad, piece(""), "BUFFERED");
    progress(bad, piece(""), "WITHHELD"); withheld(bad, bad.finish(0));
});

test("F25-L22 input overflow is sticky even if later bytes and the final exit look harmless", async () => {
    const C = await constructor(), collector = new C([PRIVATE], () => true);
    progress(collector, { channel: "stdout", bytes: Buffer.alloc(131073, 0x50) }, "WITHHELD");
    assert.ok(collector.available() === false, "Overflow must permanently withdraw this operation.");
    progress(collector, piece(PUBLIC), "WITHHELD"); withheld(collector, collector.finish(0));
});

test("F25-L23 disabling before any content is sticky when the callback is later reenabled", async () => {
    const C = await constructor(); let enabled = false; const collector = new C([PRIVATE], () => enabled);
    assert.ok(collector.available() === false, "Disabled admission must fail closed."); enabled = true;
    assert.ok(collector.available() === false, "Reenable must not revive a withdrawn collector.");
    progress(collector, piece(PUBLIC), "WITHHELD"); withheld(collector, collector.finish(0));
    const fresh = new C([PRIVATE], () => true); progress(fresh, piece(PUBLIC), "BUFFERED"); complete(fresh.finish(0), PUBLIC);
});

test("F25-L24 an observed flag disable during collection withholds prior content after reenable", async () => {
    const C = await constructor(); let enabled = true; const collector = new C([PRIVATE], () => enabled);
    progress(collector, piece(PUBLIC), "BUFFERED"); enabled = false; progress(collector, piece(PRIVATE), "WITHHELD"); enabled = true;
    assert.ok(collector.available() === false, "Observed disable must irreversibly withdraw the current operation."); withheld(collector, collector.finish(0));
});

test("F25-L25 a completed result held before UI publication loses release authority on disable", async () => {
    const C = await constructor(); let enabled = true; const collector = new C([PRIVATE], () => enabled);
    progress(collector, piece(PUBLIC), "BUFFERED"); const result = collector.finish(0); complete(result, PUBLIC);
    assert.ok(collector.canRelease(result), "The initial exact completion should be current."); enabled = false;
    assert.ok(collector.canRelease(result) === false, "Disable before UI release must revoke a held completion."); enabled = true;
    assert.ok(collector.canRelease(result) === false, "Reenable must not resurrect the stale result object.");
    assert.ok(collector.available() === false, "A revoked completion cannot authorize more collection.");
});

test("F25-L26 cloned, deserialized and other-operation completions have no release authority", async () => {
    const first = await collect([piece(PUBLIC)]), second = await collect([piece(PUBLIC)]);
    assert.ok(first.collector.canRelease(first.result), "The current exact result must be accepted.");
    const cloned = Object.freeze({ ...first.result }), parsed = JSON.parse(JSON.stringify(first.result)) as OutputResult;
    for (const forged of [cloned, parsed, second.result]) assert.ok(first.collector.canRelease(forged) === false, "Equivalent fields are not an operation capability.");
});

test("F25-L27 cancellation before or during collection permanently withholds that operation", async () => {
    const C = await constructor();
    for (const buffered of [false, true]) { const collector = new C([PRIVATE], () => true); if (buffered) progress(collector, piece(PUBLIC), "BUFFERED");
        collector.cancel(); collector.cancel(); assert.ok(collector.available() === false, "Cancellation must withdraw availability."); progress(collector, piece(PRIVATE), "WITHHELD"); withheld(collector, collector.finish(0)); }
});

test("F25-L28 cancellation after completion revokes the exact held report", async () => {
    const { collector, result } = await collect([piece(PUBLIC)]); assert.ok(collector.canRelease(result), "The current result should initially be releasable.");
    collector.cancel(); assert.ok(collector.canRelease(result) === false, "Cancellation must revoke publication after completion."); withheld(collector, collector.finish(0));
});

test("F25-L29 disposal before or during collection permanently withholds that operation", async () => {
    const C = await constructor();
    for (const buffered of [false, true]) { const collector = new C([PRIVATE], () => true); if (buffered) progress(collector, piece(PUBLIC), "BUFFERED");
        collector.dispose(); collector.dispose(); assert.ok(collector.available() === false, "Disposal must withdraw availability."); progress(collector, piece(PRIVATE), "WITHHELD"); withheld(collector, collector.finish(0)); }
});

test("F25-L30 disposal after completion prevents an exact held report from being displayed", async () => {
    const { collector, result } = await collect([piece(PUBLIC)]); assert.ok(collector.canRelease(result), "The exact result should initially be releasable.");
    collector.dispose(); assert.ok(collector.canRelease(result) === false, "Disposed completion authority must not survive."); withheld(collector, collector.finish(0));
});

test("F25-L31 callback exceptions are generic and permanently withdraw collection or held publication", async () => {
    const C = await constructor(); let fail = false;
    const enabled = () => { if (fail) throw Error(PRIVATE); return true; };
    const pending = new C([PRIVATE], enabled); progress(pending, piece(PUBLIC), "BUFFERED"); fail = true;
    assert.ok(pending.available() === false, "A guard exception must withdraw availability."); withheld(pending, pending.finish(0)); fail = false;
    assert.ok(pending.available() === false, "A repaired callback cannot restore a withdrawn operation.");
    const completeFirst = new C([PRIVATE], enabled); progress(completeFirst, piece(PUBLIC), "BUFFERED"); const result = completeFirst.finish(0); fail = true;
    assert.ok(completeFirst.canRelease(result) === false, "A guard exception must revoke held output."); fail = false; assert.ok(completeFirst.canRelease(result) === false, "Stale output must remain revoked.");
});

test("F25-L32 nonboolean enable callbacks cannot authorize collection", async () => {
    const C = await constructor();
    for (const value of [undefined, null, 0, 1, "true", "false", {}]) {
        const collector = new C([PRIVATE], (() => value) as unknown as () => boolean);
        assert.ok(collector.available() === false, "Only boolean true may authorize collection."); progress(collector, piece(PUBLIC), "WITHHELD"); withheld(collector, collector.finish(0));
    }
});

test("F25-L33 invalid runtime channel or byte inputs fail closed without echoing their contents", async () => {
    const C = await constructor();
    for (const [channel, input] of [["other", bytes(PRIVATE)], ["stdout", PRIVATE], ["stderr", null]] as const) {
        const collector = new C([PRIVATE], () => true); progress(collector, piece(PUBLIC), "BUFFERED");
        const result = collector.push(channel as Channel, input as Uint8Array); assert.ok(result.status === "WITHHELD", "Invalid input must withdraw collection.");
        assert.deepEqual(Object.keys(result), ["status"]); noPrivate(result); withheld(collector, collector.finish(0));
    }
});

test("F25-L34 nonfinite, fractional or out-of-int32 exit values withhold instead of inventing success", async () => {
    for (const exitCode of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 1.5, 2147483648, -2147483649]) {
        const { collector, result } = await collect([piece(PUBLIC)], [PRIVATE], exitCode); withheld(collector, result);
    }
});

test("F25-L35 ordinary Windows stack locations retain their literal backslashes", async () => {
    const text = "Error: ordinary public failure\n    at C:\\public\\test\\build.cjs:12:7\n    at D:\\public\\run.cjs:3:1\n";
    const { collector, result } = await collect([piece(text)]); complete(result, text);
    assert.ok(collector.canRelease(result), "Literal public failure locations must remain useful.");
});

test("F25-L36 line-framing cap admits32 JSON-body lines and atomically withholds a33rd", async () => {
    const line = "public prefix " + JSON.stringify(PRIVATE).slice(1, -1).replace("PRIVATE", "\\u0050RIVATE") + " public suffix\n";
    const exact = await collect([piece(line.repeat(32))]); complete(exact.result, MASK, "", 0, true);
    const overflow = await collect([piece(line.repeat(33))]); withheld(overflow.collector, overflow.result);
});
