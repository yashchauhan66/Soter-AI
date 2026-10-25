import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import fsp from "node:fs/promises";
import http from "node:http";
import https from "node:https";
import childProcess from "node:child_process";
import { RegisteredSecretMatcher } from "../../../core/src/RegisteredSecretMatcher";
import { analyzeHygieneText } from "../hygiene/HygieneAnalysis";

// PREPARED ONLY while F24 is active. Imports deliberately target the final
// packages/vscode-extension/src/__tests__/ location. Do not execute this copy.
// All inputs are synthetic in-memory strings. Raw private views are tested
// with boolean assertions and fixed messages so failures do not print values.
const PRIVATE = "TEST_ONLY_F25_LOG_CONTENT_PRIVATE_f38971b2";
const PROVIDER = "sk-proj-" + "TESTONLYF25RecognizedCanaryA7b9".repeat(3);
const OTHER = "sk-proj-" + "TESTONLYF25RecognizedCanaryC4d6".repeat(3);
const KEY = Buffer.alloc(32, 25);
const LIMIT = 65536;
type View = Readonly<{ relativePath: string; text: string; language: string }>;
type Result = Readonly<{ status: "ANALYZED" | "WITHHELD"; kind: "TEXT" | "JSON" | "JSONL"; reason?: string; views: readonly View[] }>;
type Build = (relativePath: string, text: string) => Result;
async function implementation(): Promise<Build> {
    const module = await import("../logs/LogContent");
    assert(typeof module.logContentViews === "function", "The frozen private log content entry point must exist.");
    return module.logContentViews as Build;
}
function safe(value: unknown): void {
    const encoded = JSON.stringify(value) ?? "";
    for (const secret of [PRIVATE, PROVIDER, OTHER]) {
        assert(!encoded.includes(secret), "Private input must not enter public metadata or failure diagnostics.");
        assert(!encoded.includes(Buffer.from(secret).toString("base64")), "Encoded input must not enter public metadata or failure diagnostics.");
    }
}
function build(fn: Build, relative: string, text: string): Result {
    let value: Result;
    try { value = fn(relative, text); }
    catch { assert.fail("Content classification must return a generic withheld result rather than throw input-bearing errors."); }
    assert(!!value && typeof value === "object", "Content classification must return a record.");
    assert(value.status === "ANALYZED" || value.status === "WITHHELD", "Content status must use the frozen enum.");
    assert(value.kind === "TEXT" || value.kind === "JSON" || value.kind === "JSONL", "Content kind must use the frozen enum.");
    assert(Array.isArray(value.views), "Content views must be an array.");
    assert(value.views.length <= 32, "The complete operation must respect the semantic string-part limit.");
    if (value.reason !== undefined) {
        assert(typeof value.reason === "string" && value.reason.length <= 160, "Withholding reasons must be bounded plain metadata.");
        assert(!/[\x00-\x1f\x7f-\x9f]/.test(value.reason), "Withholding reasons must contain no controls.");
    }
    safe({ status: value.status, kind: value.kind, reason: value.reason });
    for (const view of value.views) {
        assert(!!view && typeof view === "object", "Every private view must be a record.");
        assert(view.language === "text", "Private log views use the fixed canonical text analyzer language.");
        assert(typeof view.relativePath === "string" && view.relativePath.length > 0 && view.relativePath.length <= 2048,
            "Private source identifiers must be bounded relative paths.");
        assert(!/[\\:\x00-\x1f\x7f-\x9f]/.test(view.relativePath) && !view.relativePath.startsWith("/")
            && view.relativePath.split("/").every(part => !!part && part !== "." && part !== ".."), "Private source identifiers must be canonical relative ordinals.");
        assert(typeof view.text === "string", "Every private view must contain a string.");
        safe({ relativePath: view.relativePath, language: view.language });
    }
    assert(new Set(value.views.map(view => view.relativePath)).size === value.views.length, "Private view identifiers must be unique within an operation.");
    assert(value.views.reduce((sum, view) => sum + Buffer.byteLength(view.text), 0) <= LIMIT,
        "Decoded private views must respect the aggregate byte limit.");
    return value;
}
function withheld(value: Result): void {
    assert(value.status === "WITHHELD", "Unsupported or incomplete content must withhold atomically.");
    assert(value.views.length === 0, "A withheld result must contain no partial raw views."); safe(value);
}
function analyzed(value: Result, kind: Result["kind"]): void {
    assert(value.status === "ANALYZED", "Supported bounded log content must remain useful.");
    assert(value.kind === kind, "Supported content must retain its declared parser family.");
}
function findings(value: Result) {
    const found = value.views.flatMap(view => {
        try { return [...analyzeHygieneText({ source: view.relativePath, text: view.text, environment: false }, KEY).findings]; }
        catch { assert.fail("Private log views must compose with the canonical hygiene analyzer."); }
    });
    safe(found); return found;
}
function semanticMatch(value: Result, secret: string): void {
    const decision = new RegisteredSecretMatcher([secret]).inspectRequest(value.views.map(view => view.text));
    assert(decision.status === "MATCHED", "The canonical matcher must recognize the complete registered value across semantic views.");
    assert(decision.matches.some(match => match.kind === "registered"), "Semantic composition must prove a registered-value match."); safe(decision);
}

test("F25 public stack traces preserve useful failure text, numeric locations and exact saved text", async () => {
    const fn = await implementation(), text = "Error: public assertion failed\r\n    at publicCheck (public-test.cjs:12:7)\r\nExpected 3000, received 4000\r\n";
    const value = build(fn, "logs/public-stack.log", text); analyzed(value, "TEXT");
    assert(value.views.length === 1 && value.views[0].text === text, "Public stack text must survive without source execution or loss.");
    assert(findings(value).length === 0, "Public stack and failure controls must not become secret findings.");
});

test("F25 public TAP failures and diagnostics remain useful without evaluating test syntax", async () => {
    const fn = await implementation(), text = "TAP version 13\nnot ok 1 - public arithmetic\n  ---\n  expected: 3000\n  actual: 4000\n  at: public-test.cjs:8:2\n  ...\n1..1\n";
    const value = build(fn, "test-results/public.tap", text); analyzed(value, "TEXT");
    assert(value.views.length === 1 && value.views[0].text === text, "Public TAP diagnostics must remain unchanged private analysis input.");
    assert(findings(value).length === 0, "Public numeric actual/expected controls must remain harmless.");
});

test("F25 ordinary non-JSON log lines containing braces are supported text", async () => {
    const fn = await implementation();
    for (const text of ["INFO public state { ready: true }\n", "Expected { port: 3000 }, received { port: 4000 }\n", "plain public failure\n"]) {
        const value = build(fn, "logs/public.log", text); analyzed(value, "TEXT");
        assert(value.views.length === 1 && value.views[0].text === text, "Non-JSON log prose must not be parsed as executable or structured configuration.");
    }
});

test("F25 empty saved log and renamed plain output are explicit useful text controls", async () => {
    const fn = await implementation();
    for (const [relative, text] of [["logs/empty.log", ""], ["test-results/retained.copy", "ordinary public note\n"], ["logs/public.err", "Expected public failure\n"]]) {
        const value = build(fn, relative, text); analyzed(value, "TEXT");
        assert(value.views.length === 1 && value.views[0].text === text, "Supported plain logs must retain their exact bounded private text.");
    }
});

test("F25 static credential assignments in old fixture logs reach canonical keyed findings", async () => {
    const fn = await implementation(), text = "Expected test setup failure\nTOKEN=" + PRIVATE + "\n    at public-fixture.cjs:5:3\n";
    const value = build(fn, "logs/old-fixture.log", text); analyzed(value, "TEXT");
    assert(value.views.some(view => view.text.includes(PRIVATE)), "Raw values remain private analysis input until canonical metadata is produced.");
    const detected = findings(value); assert(detected.length >= 1, "A supported static assignment must produce canonical secret metadata.");
    for (const finding of detected) for (const field of ["id", "fileRef", "valueRef"] as const) assert(/^[a-f0-9]{64}$/.test(finding[field]), "Findings must expose keyed opaque references only.");
});

test("F25 nested actual and expected JSON fields expose decoded private semantic strings to the canonical analyzer", async () => {
    const fn = await implementation(), text = JSON.stringify({ failure: { actual: PROVIDER, expected: OTHER }, code: 1 });
    const value = build(fn, "test-results/nested.json", text); analyzed(value, "JSON");
    assert(value.views.some(view => view.text === PROVIDER) && value.views.some(view => view.text === OTHER), "Nested supported values must be decoded into private semantic views.");
    assert(findings(value).length >= 2, "Recognized credentials in nested actual/expected values must both remain detectable.");
});

test("F25 JSON Unicode escapes are decoded before canonical credential recognition", async () => {
    const fn = await implementation(), escaped = [...PROVIDER].map(character => "\\u" + character.charCodeAt(0).toString(16).padStart(4, "0")).join("");
    const text = '{"failure":{"actual":"' + escaped + '"}}';
    assert(!text.includes(PROVIDER), "The fixture must exercise encoded semantic content.");
    const value = build(fn, "test-results/escaped.json", text); analyzed(value, "JSON");
    assert(value.views.some(view => view.text === PROVIDER), "Supported JSON escapes must decode losslessly into private values.");
    assert(findings(value).length >= 1, "Decoded credentials must produce canonical metadata.");
});

test("F25 a registered value split across nested JSON leaves is caught by canonical semantic composition", async () => {
    const fn = await implementation(), middle = Math.floor(PRIVATE.length / 2);
    const value = build(fn, "test-results/split.json", JSON.stringify({ actual: PRIVATE.slice(0, middle), nested: { expected: PRIVATE.slice(middle) } }));
    analyzed(value, "JSON"); assert(value.views.length === 2, "Each decoded string contributes one ordered semantic view.");
    assert(!value.views.some(view => view.text.includes(PRIVATE)), "No individual fixture leaf may contain the complete registration.");
    semanticMatch(value, PRIVATE);
});

test("F25 raw and one-layer encoded registrations remain detectable when split between JSON leaves", async () => {
    const fn = await implementation();
    for (const encoded of [PROVIDER, Buffer.from(PROVIDER).toString("base64"), encodeURIComponent(PROVIDER), Buffer.from(PROVIDER).toString("hex")]) {
        const middle = Math.floor(encoded.length / 2), value = build(fn, "logs/encoded.json", JSON.stringify({ first: encoded.slice(0, middle), second: encoded.slice(middle) }));
        analyzed(value, "JSON"); assert(value.views.length === 2, "Encoded semantic fixtures must remain ordered individual parts."); semanticMatch(value, PROVIDER);
    }
});

test("F25 public structured failures retain strings in document order while ignoring numeric and boolean scalars", async () => {
    const fn = await implementation(), text = JSON.stringify({ message: "public assertion failed", code: 7, fatal: false, extra: null, nested: ["public-test.cjs:9:2", "retry locally"] });
    const value = build(fn, "logs/public-structured.json", text); analyzed(value, "JSON");
    assert(value.views.map(view => view.text).join("|") === "public assertion failed|public-test.cjs:9:2|retry locally", "Semantic string order and public failure locations must survive.");
    assert(findings(value).length === 0, "Public structured controls must remain harmless.");
});

test("F25 JSON arrays of public strings are supported without coercing nonstring nodes", async () => {
    const fn = await implementation(), value = build(fn, "logs/public-array.json", JSON.stringify(["first public", 3, false, null, { message: "second public" }]));
    analyzed(value, "JSON"); assert(value.views.map(view => view.text).join("|") === "first public|second public", "Only ordered semantic strings become analysis views.");
    assert(findings(value).length === 0, "Public JSON array values must not create synthetic credentials.");
});

test("F25 JSONL supports bounded complete records and preserves nested failure strings", async () => {
    const fn = await implementation(), text = JSON.stringify({ message: "public first" }) + "\n\n" + JSON.stringify({ failure: { actual: PROVIDER } }) + "\r\n";
    const value = build(fn, "logs/test-run.jsonl", text); analyzed(value, "JSONL");
    assert(value.views.map(view => view.text).join("|") === "public first|" + PROVIDER, "Complete JSONL records must preserve ordered decoded values.");
    assert(findings(value).length >= 1, "Supported JSONL credential values must reach canonical analysis.");
});

test("F25 semantic matching spans JSONL record boundaries within one reviewed operation", async () => {
    const fn = await implementation(), middle = Math.floor(PRIVATE.length / 2);
    const text = JSON.stringify({ actual: PRIVATE.slice(0, middle) }) + "\n" + JSON.stringify({ expected: PRIVATE.slice(middle) }) + "\n";
    const value = build(fn, "logs/one-operation.jsonl", text); analyzed(value, "JSONL");
    assert(value.views.length === 2, "Each string in the finite operation contributes one ordered view."); semanticMatch(value, PRIVATE);
});

test("F25 a malformed late JSONL record withholds earlier private views atomically", async () => {
    const fn = await implementation(), text = JSON.stringify({ actual: PROVIDER }) + '\n{"expected":"unterminated';
    const value = build(fn, "logs/truncated.jsonl", text); assert(value.kind === "JSONL", "Malformed line records retain their structured family."); withheld(value);
});

test("F25 declared and structured-looking malformed JSON cannot silently become plain text", async () => {
    const fn = await implementation();
    withheld(build(fn, "logs/declared.json", "ordinary non-JSON failure text"));
    for (const relative of ["logs/broken.json", "logs/broken.log"]) {
        for (const text of ['{"actual":' + JSON.stringify(PROVIDER), "[1, 2,", '{"public":true} trailing']) withheld(build(fn, relative, text));
    }
});

test("F25 strict JSON rejects comments trailing commas nonfinite numbers and concatenated roots", async () => {
    const fn = await implementation();
    for (const text of ['/* public comment */{"message":"public"}', '{"message":"public",}', '{"n":NaN}', '{"n":Infinity}', '{"n":1e999}', '{}{}'])
        withheld(build(fn, "logs/strict.json", text));
});

test("F25 duplicate decoded JSON keys at any depth cannot hide a competing private value", async () => {
    const fn = await implementation();
    for (const text of ['{"actual":' + JSON.stringify(PROVIDER) + ',"actual":"public"}',
        '{"nested":{"actual":' + JSON.stringify(PROVIDER) + ',"act\\u0075al":"public"}}',
        '{"outer":[{"expected":"public","expected":' + JSON.stringify(OTHER) + '}]}']) withheld(build(fn, "logs/duplicate.json", text));
});

test("F25 duplicate keys in a later JSONL record withhold the whole reviewed operation", async () => {
    const fn = await implementation(), text = '{"message":"public"}\n{"actual":' + JSON.stringify(PROVIDER) + ',"actual":"public"}\n';
    withheld(build(fn, "logs/duplicate.jsonl", text));
});

test("F25 the complete structured operation admits32 semantic strings and withholds a33rd", async () => {
    const fn = await implementation(), exact = Array.from({ length: 32 }, (_, index) => "public part " + index);
    const value = build(fn, "logs/exact-parts.json", JSON.stringify(exact)); analyzed(value, "JSON"); assert(value.views.length === 32, "The inclusive semantic part limit must remain useful.");
    withheld(build(fn, "logs/over-parts.json", JSON.stringify([...exact, "extra public part"])));
    const lines = exact.map(message => JSON.stringify({ message })).join("\n"); analyzed(build(fn, "logs/exact-parts.jsonl", lines), "JSONL");
    withheld(build(fn, "logs/over-parts.jsonl", lines + '\n{"message":"extra public part"}'));
});

test("F25 JSONL admits128 nonempty records but withholds a129th even when there are no strings", async () => {
    const fn = await implementation(), exact = Array.from({ length: 128 }, (_, index) => JSON.stringify({ index })).join("\n");
    analyzed(build(fn, "logs/exact-records.jsonl", exact + "\n"), "JSONL");
    withheld(build(fn, "logs/over-records.jsonl", exact + '\n{"index":128}\n'));
});

test("F25 JSON container nesting is bounded at32 before recursive parsing can exhaust the stack", async () => {
    const fn = await implementation(), nested = (depth: number) => "[".repeat(depth) + '"public"' + "]".repeat(depth);
    const value = build(fn, "logs/exact-depth.json", nested(32)); analyzed(value, "JSON"); assert(value.views.length === 1, "The inclusive depth control must remain useful.");
    withheld(build(fn, "logs/deep.json", nested(33))); withheld(build(fn, "logs/deep.jsonl", nested(33) + "\n"));
});

test("F25 JSON node work is independently bounded at10000 even when no semantic strings exist", async () => {
    const fn = await implementation(), numbers = (count: number) => "[" + Array.from({ length: count }, () => "0").join(",") + "]";
    analyzed(build(fn, "logs/exact-work.json", numbers(9999)), "JSON");
    withheld(build(fn, "logs/over-work.json", numbers(10000)));
    const records = Array.from({ length: 100 }, () => numbers(100)).join("\n");
    withheld(build(fn, "logs/aggregate-work.jsonl", records));
});

test("F25 raw input admission measures exact UTF8 bytes with an inclusive64KiB limit", async () => {
    const fn = await implementation();
    for (const exact of ["x".repeat(LIMIT), "\u00e9".repeat(LIMIT / 2), "\u{1f9ed}".repeat(LIMIT / 4)]) {
        assert(Buffer.byteLength(exact) === LIMIT, "The public fixture must hit the exact byte boundary.");
        const value = build(fn, "logs/exact.log", exact); analyzed(value, "TEXT");
        assert(value.views.length === 1 && value.views[0].text === exact, "Exact-budget public text must remain lossless private input.");
        withheld(build(fn, "logs/over.log", exact + "x"));
    }
});

test("F25 raw JSON and JSONL size caps apply before decoding or returning earlier values", async () => {
    const fn = await implementation();
    withheld(build(fn, "logs/large.json", JSON.stringify({ actual: PROVIDER, padding: "x".repeat(LIMIT) })));
    withheld(build(fn, "logs/large.jsonl", JSON.stringify({ actual: PROVIDER }) + "\n" + JSON.stringify({ padding: "x".repeat(LIMIT) })));
});

test("F25 raw and JSON-decoded unsupported controls never become private analysis views", async () => {
    const fn = await implementation();
    for (const control of ["\0", "\x01", "\x1b", "\x7f", "\u0085", "\u202e"]) {
        withheld(build(fn, "logs/control.log", "public " + control + PRIVATE));
        withheld(build(fn, "logs/control.json", JSON.stringify({ actual: "public " + control + PRIVATE })));
        withheld(build(fn, "logs/control.jsonl", JSON.stringify({ message: "public" }) + "\n" + JSON.stringify({ actual: control + PROVIDER })));
    }
});

test("F25 malformed JavaScript Unicode and escaped lone surrogates withhold instead of replacement repair", async () => {
    const fn = await implementation();
    for (const text of ["public\ud800", "public\udc00"]) withheld(build(fn, "logs/unicode.log", text));
    for (const text of ['{"actual":"\\ud800"}', '{"actual":"\\udc00"}']) withheld(build(fn, "logs/unicode.json", text));
});

test("F25 source identifiers reject traversal aliases Windows streams devices absolute paths and control spellings", async () => {
    const fn = await implementation();
    for (const relative of ["", "/logs/public.log", "C:/logs/public.log", "../public.log", "logs/../public.log", "./public.log", "logs//public.log",
        "logs\\public.log", "logs/public.log:stream", "logs/NUL.log", "logs/CON.txt", "logs/public.log.", "logs/public.log ", "logs/public\n.log"])
        withheld(build(fn, relative, "ordinary public failure\n"));
});

test("F25 recognized secret-bearing filenames are withheld without returning their path or value", async () => {
    const fn = await implementation();
    for (const relative of ["logs/" + PROVIDER + ".log", "logs/" + OTHER + "/public.log"]) withheld(build(fn, relative, "public content\n"));
});

test("F25 reference-looking fields remain inert private strings and never become source paths", async t => {
    const fn = await implementation(); let reads = 0, requests = 0, spawns = 0;
    const noRead = () => { reads++; throw Error("Reference reads are forbidden in the pure log content fixture."); };
    const noRequest = () => { requests++; throw Error("Reference requests are forbidden in the pure log content fixture."); };
    t.mock.method(fs, "readFileSync", noRead); t.mock.method(fs, "openSync", noRead);
    t.mock.method(fsp, "readFile", async () => noRead()); t.mock.method(fsp, "open", async () => noRead());
    t.mock.method(http, "request", noRequest); t.mock.method(http, "get", noRequest);
    t.mock.method(https, "request", noRequest); t.mock.method(https, "get", noRequest);
    t.mock.method(childProcess, "spawn", () => { spawns++; throw Error("Pure log views cannot launch a process."); });
    const references = ["file:///C:/TEST_ONLY_F25_NO_READ/never.log", "https://example.invalid/never.log", "../../TEST_ONLY_F25_NO_READ/source.ts"];
    const value = build(fn, "logs/references.json", JSON.stringify({ file: references[0], url: references[1], sourceRoot: references[2], message: "public failure" }));
    analyzed(value, "JSON"); assert(reads === 0 && requests === 0 && spawns === 0, "Private view construction must not follow references or execute anything.");
    assert(value.views.every(view => references.every(reference => !view.relativePath.includes(reference))), "Source identifiers must use fixed ordinals rather than referenced locations.");
    assert(value.views.some(view => view.text === "public failure"), "Public messages must remain useful when inert reference fields coexist.");
});

test("F25 JSON keys and referenced labels cannot inject private or unsafe source identifiers", async () => {
    const fn = await implementation(), key = "../../" + PRIVATE + "\n";
    const value = build(fn, "logs/key-labels.json", JSON.stringify({ [key]: "public actual", stack: "public-test.cjs:3:1" }));
    assert(value.status === "ANALYZED" || value.status === "WITHHELD", "Unsafe structured labels must be safely ignored or explicitly withheld.");
    if (value.status === "WITHHELD") withheld(value);
    else { analyzed(value, "JSON"); assert(value.views.every(view => !view.relativePath.includes(PRIVATE) && !view.relativePath.includes("..")), "Private identifiers must not derive from JSON keys."); }
});

test("F25 deterministic view IDs retain no state from a prior private operation", async () => {
    const fn = await implementation(), text = JSON.stringify({ message: "public failure", nested: { stack: "public-test.cjs:8:2" } });
    const first = build(fn, "logs/stable.json", text); analyzed(first, "JSON");
    const secret = build(fn, "logs/private.json", JSON.stringify({ actual: PROVIDER })); analyzed(secret, "JSON");
    const last = build(fn, "logs/stable.json", text); analyzed(last, "JSON");
    assert(JSON.stringify(first) === JSON.stringify(last), "View construction must be deterministic and request-local.");
    assert(!last.views.some(view => view.text.includes(PROVIDER)), "A later public operation must retain no earlier private text.");
});

test("F25 unknown input types with coercion hooks fail closed without invoking caller code", async () => {
    const fn = await implementation(); let coercions = 0;
    const supplied = { toString() { coercions++; return PRIVATE; }, valueOf() { coercions++; return PRIVATE; } };
    withheld(build(fn, supplied as never, "public text")); withheld(build(fn, "logs/public.log", supplied as never));
    assert(coercions === 0, "Content admission must validate primitive strings before any coercion.");
});
