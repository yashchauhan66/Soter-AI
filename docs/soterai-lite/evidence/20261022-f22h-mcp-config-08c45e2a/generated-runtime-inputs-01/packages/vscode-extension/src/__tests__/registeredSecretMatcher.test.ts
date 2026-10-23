import assert from "node:assert/strict";
import { test } from "node:test";
import { RegisteredSecretMatcher, SECRET_MATCH_LIMITS, SECRET_ENTROPY_POLICY } from "../../../core/src/RegisteredSecretMatcher";

// F07 frozen-contract fixtures: synthetic in-memory values only. No disk,
// environment, credential-store, network, timer or previous-request dependency.
const SECRET = "SoterAI-F07 registered É🔐/qZ9+_value";
const OTHER = "F07-other-registered-value-Z8";
const PROVIDER = "sk-proj-" + "SYNTHETIC_F07_PROVIDER_ONLY_VALUE".repeat(2);
const HIGH = "Aa0Bb1Cc2Dd3Ee4Ff5Gg6Hh7Ii8Jj9Kk";
type Decision = ReturnType<RegisteredSecretMatcher["inspectRequest"]>;
const inspect = (values: readonly string[], parts: readonly string[]) => new RegisteredSecretMatcher(values).inspectRequest(parts);
const registered = (decision: Decision) => decision.matches.filter(match => match.kind === "registered");
function clean(decision: Decision): void { assert.equal(decision.status, "CLEAN"); assert.deepEqual(decision.matches, []); }
function withheld(decision: Decision): void { assert.equal(decision.status, "WITHHELD"); assert.deepEqual(decision.matches, []); }
function matched(decision: Decision, id = "r1"): void {
    assert.equal(decision.status, "MATCHED"); assert.ok(registered(decision).some(match => match.registrationId === id));
    const serialized = JSON.stringify(decision);
    for (const value of [SECRET, OTHER, PROVIDER]) assert.ok(!serialized.includes(value));
    assert.doesNotMatch(serialized, /"(?:value|rawValue|fragment|valueHash|fingerprint|preview)"\s*:/);
}
function coordinates(decision: Decision, parts: readonly string[]): void {
    const offsets: number[] = []; let length = 0;
    for (const part of parts) { offsets.push(length); length += part.length; }
    for (const match of decision.matches) {
        assert.ok(Number.isInteger(match.start) && Number.isInteger(match.end));
        assert.ok(match.start >= 0 && match.end > match.start && match.end <= length);
        let cursor = match.start;
        for (const span of match.parts) {
            assert.ok(Number.isInteger(span.index) && span.index >= 0 && span.index < parts.length);
            assert.ok(span.start >= 0 && span.end > span.start && span.end <= parts[span.index].length);
            assert.equal(offsets[span.index] + span.start, cursor); cursor = offsets[span.index] + span.end;
        }
        assert.equal(cursor, match.end, "Every original contributor must be covered with end-exclusive UTF-16 coordinates.");
    }
}
function percentAll(value: string, lower = false): string {
    return [...Buffer.from(value, "utf8")].map(byte => "%" + byte.toString(16).padStart(2, "0")[lower ? "toLowerCase" : "toUpperCase"]()).join("");
}

test("F07-M01 public exports retain the frozen inclusive budgets and entropy-policy descriptor", () => {
    assert.deepEqual(SECRET_MATCH_LIMITS, { maxRegistrations: 128, maxValueBytes: 4096, maxRegisteredBytes: 65536,
        maxParts: 32, maxInputBytes: 131072, maxVariantBytes: 1048576, maxDecodedCandidates: 128,
        maxDecodedBytes: 262144, maxMatches: 256, maxSearchWork: 67108864 });
    assert.equal(typeof SECRET_ENTROPY_POLICY, "object"); assert.ok(SECRET_ENTROPY_POLICY);
});

test("F07-M02 raw exact registrations match useful surrounding text and return source-safe coordinates", () => {
    const parts = ["Useful prefix: " + SECRET + " useful suffix."];
    const decision = inspect([SECRET], parts); matched(decision); coordinates(decision, parts);
    assert.ok(registered(decision).some(match => match.start === 15 && match.end === 15 + SECRET.length));
    clean(inspect([SECRET], ["Useful public coding documentation with no private value."]));
});

for (const [name, encode, representations] of [
    ["base64 padded", (value: string) => Buffer.from(value).toString("base64"), ["base64", "base64url"]],
    ["base64 unpadded", (value: string) => Buffer.from(value).toString("base64").replace(/=+$/, ""), ["base64", "base64url"]],
    ["base64url padded", (value: string) => { const raw = Buffer.from(value).toString("base64url"); return raw + "=".repeat((4 - raw.length % 4) % 4); }, ["base64", "base64url"]],
    ["base64url unpadded", (value: string) => Buffer.from(value).toString("base64url"), ["base64", "base64url"]],
    ["lowercase hex", (value: string) => Buffer.from(value).toString("hex"), ["hex"]],
    ["uppercase hex", (value: string) => Buffer.from(value).toString("hex").toUpperCase(), ["hex"]],
    ["mixed-case hex", (value: string) => [...Buffer.from(value).toString("hex")].map((char, index) => index % 2 ? char.toUpperCase() : char).join(""), ["hex"]],
] as const) {
    test(`F07-M03 ${name} has a paired registered-secret and public-control outcome`, () => {
        const parts = ["Encoded: " + encode(SECRET) + " end."];
        const decision = inspect([SECRET], parts); matched(decision); coordinates(decision, parts);
        assert.ok(registered(decision).some(match => (representations as readonly string[]).includes(match.representation)));
        clean(inspect([SECRET], [encode("Useful ordinary public control.")]));
    });
}

for (const [name, encoded] of [["canonical", encodeURIComponent(SECRET)], ["full uppercase", percentAll(SECRET)],
    ["full lowercase", percentAll(SECRET, true)], ["partial", SECRET.replace("registered", "%72egistered")]] as const) {
    test(`F07-M04 ${name} URL escaping matches without case-folding raw registered bytes`, () => {
        const parts = ["value=" + encoded]; const decision = inspect([SECRET], parts); matched(decision); coordinates(decision, parts);
        assert.ok(registered(decision).some(match => match.representation === "url"));
        clean(inspect([SECRET], [encodeURIComponent(SECRET.replace("SoterAI", "soterai"))]));
    });
}

test("F07-M05 URL plus is literal plus and is never repaired into a space", () => {
    const value = "F07 registered plus+ space value";
    matched(inspect([value], [percentAll(value)])); clean(inspect([value], ["F07+registered+plus%2B+space+value"]));
});

for (const [name, source] of [["quoted", JSON.stringify('F07 private "quoted" value\\tail\nÉ🔐')],
    ["string-body", JSON.stringify('F07 private "quoted" value\\tail\nÉ🔐').slice(1, -1)],
    ["partial Unicode", '"F07 private \\u0071uoted value"'],
    ["surrogate pair", '"F07 private \\uD83D\\uDD10 value"']] as const) {
    test(`F07-M06 valid JSON ${name} preserves exact semantic registered bytes`, () => {
        const value = name === "partial Unicode" ? "F07 private quoted value" : name === "surrogate pair" ? "F07 private 🔐 value" : 'F07 private "quoted" value\\tail\nÉ🔐';
        const parts = [source], decision = inspect([value], parts); matched(decision); coordinates(decision, parts);
        assert.ok(registered(decision).some(match => match.representation === "json"));
        clean(inspect([value], [source.replace("private", "public")]));
    });
}

test("F07-M07 an unrelated malformed escape cannot suppress a later raw or canonical registered form", () => {
    matched(inspect([SECRET], ["unrelated %ZZ \\uQQQQ \\xGG then " + SECRET]));
    matched(inspect([SECRET], ["unrelated %ZZ then " + Buffer.from(SECRET).toString("base64")]));
});

test("F07-M08 invalid UTF-8 encoded bytes never become replacement-character registered matches", () => {
    const value = "F07-prefix-\uFFFD-suffix";
    const bytes = Buffer.concat([Buffer.from("F07-prefix-"), Buffer.from([0xff]), Buffer.from("-suffix")]);
    for (const source of [bytes.toString("base64"), bytes.toString("hex"), [...bytes].map(byte => "%" + byte.toString(16).padStart(2, "0")).join("")])
        clean(inspect([value], [source]));
});

test("F07-M09 neither case folding, Unicode normalization nor whitespace removal invents a registered match", () => {
    const value = "F07-Café private  value";
    matched(inspect([value], [value]));
    for (const source of [value.toLowerCase(), value.normalize("NFD"), value.replace("  ", " "), value.replace(/ /g, "")])
        clean(inspect([value], [source]));
});

for (const value of ["x", "short7x", "🔐🔐🔐🔐🔐🔐🔐"]) {
    test(`F07-M10 short registration of ${Array.from(value).length} Unicode scalars matches explicit whole groups only`, () => {
        matched(inspect([value], [value])); matched(inspect([value], ["public prefix", value, "public suffix"]));
        clean(inspect([value], ["prefix " + value + " suffix"]));
        matched(inspect([value], [JSON.stringify(value)]));
    });
}

test("F07-M11 eight Unicode scalars can match a substring even when their UTF-16 width is sixteen", () => {
    const value = "🔐".repeat(8); matched(inspect([value], ["prefix" + value + "suffix"]));
});

test("F07-M12 all representative raw/encoded/escaped split positions are local to the explicit request", () => {
    const sources = [SECRET, Buffer.from(SECRET).toString("base64"), percentAll(SECRET), JSON.stringify(SECRET).replace("registered", "\\u0072egistered")];
    for (const source of sources) for (let split = 0; split <= source.length; split++) {
        const parts = [source.slice(0, split), source.slice(split)], decision = inspect([SECRET], parts);
        matched(decision); coordinates(decision, parts);
    }
});

test("F07-M13 a Unicode scalar may straddle explicit parts without making the joined input invalid", () => {
    const parts = ["\uD83D", "\uDD10"], decision = inspect(["🔐"], parts);
    matched(decision); coordinates(decision, parts); assert.equal(decision.matches[0].start, 0); assert.equal(decision.matches[0].end, 2);
});

test("F07-M14 separate calls never accumulate, reorder or remove separators from requests", () => {
    const matcher = new RegisteredSecretMatcher([SECRET]); const split = Math.floor(SECRET.length / 2);
    clean(matcher.inspectRequest([SECRET.slice(0, split)])); clean(matcher.inspectRequest([SECRET.slice(split)]));
    matched(matcher.inspectRequest([SECRET.slice(0, split), SECRET.slice(split)]));
    clean(matcher.inspectRequest([SECRET.slice(split), SECRET.slice(0, split)]));
    clean(matcher.inspectRequest([SECRET.slice(0, split), " ", SECRET.slice(split)])); clean(matcher.inspectRequest(["Useful later public control."]));
});

test("F07-M15 duplicate registrations retain their first opaque ID and overlapping registrations each match", () => {
    const value = "F07-overlapping-private-value-q9", suffix = "private-value-q9";
    const duplicates = inspect([value, value], [value]); matched(duplicates); assert.deepEqual([...new Set(registered(duplicates).map(match => match.registrationId))], ["r1"]);
    const parts = ["before ", value, " after"], decision = inspect([value, suffix], parts);
    matched(decision, "r1"); matched(decision, "r2"); coordinates(decision, parts);
});

test("F07-M16 explicit placeholder and low-entropy registrations override heuristic allowlists", () => {
    for (const value of ["[SOTERAI_PROTECTED_TOKEN]", "AAAAAAAAAAAAAAAA", "YOUR_API_KEY_HERE"]) matched(inspect([value], [value]));
});

test("F07-M17 invalid construction or request input is typed WITHHELD without partial matches or secret-bearing errors", () => {
    for (const values of [[""], ["valid-registration-q9", ""], ["\uD800"], [SECRET, null], null]) {
        const matcher = new RegisteredSecretMatcher(values as unknown as readonly string[]);
        withheld(matcher.inspectRequest([SECRET]));
    }
    const matcher = new RegisteredSecretMatcher([SECRET]);
    for (const parts of [["\uD800"], [SECRET, null], null]) withheld(matcher.inspectRequest(parts as unknown as readonly string[]));
});

test("F07-M18 unique registration count is inclusive and duplicates do not spend unique-registration budget", () => {
    const values = Array.from({ length: 128 }, (_, index) => `F07-registration-${String(index).padStart(3, "0")}-qZ9`);
    clean(inspect(values, ["Useful public control."])); withheld(inspect([...values, OTHER], ["Useful public control."]));
    matched(inspect(Array.from({ length: 129 }, () => SECRET), [SECRET]));
});

test("F07-M19 each registered value's UTF-8 byte bound is inclusive", () => {
    const exact = "🔐".repeat(1024); assert.equal(Buffer.byteLength(exact), 4096);
    matched(inspect([exact], [exact])); withheld(inspect([exact + "x"], ["public"]));
});

test("F07-M20 registered total bytes are inclusive and overflow cannot leave an earlier usable registration", () => {
    const values = Array.from({ length: 16 }, (_, index) => "A".repeat(4092) + String(index).padStart(4, "0"));
    assert.equal(values.reduce((sum, value) => sum + Buffer.byteLength(value), 0), 65536);
    clean(inspect(values, [""])); withheld(inspect([...values, "x"], [values[0]]));
});

test("F07-M21 explicit-part and joined-input limits are inclusive and withhold all partial matches on overflow", () => {
    clean(inspect([], Array.from({ length: 32 }, () => "public ")));
    withheld(inspect([SECRET], [SECRET, ...Array.from({ length: 32 }, () => "")]));
    clean(inspect([], [" ".repeat(131072)])); withheld(inspect([SECRET], [SECRET + " ".repeat(131073)]));
    clean(inspect([], ["é".repeat(65536)])); withheld(inspect([], ["é".repeat(65537)]));
});

test("F07-M22 every raw occurrence fits the returned-match limit exactly; the next occurrence withholds all matches", () => {
    const value = "F07-occurrence-private-value-q9";
    const exact = inspect([value], [Array.from({ length: 256 }, () => value).join(" ")]);
    matched(exact); assert.equal(registered(exact).length, 256);
    withheld(inspect([value], [Array.from({ length: 257 }, () => value).join(" ")]));
});

test("F07-M23 charged search-work exhaustion returns WITHHELD rather than an early partial match", () => {
    const values = Array.from({ length: 128 }, (_, index) => `F07-private-registration-${String(index).padStart(3, "0")}-qZ9`);
    const source = values[0] + " ".repeat(131072 - values[0].length);
    withheld(inspect(values, [source]));
});

test("F07-M24 provider recognition is distinct from registered values and preserves safe source coordinates", () => {
    const parts = ["Useful prefix ", PROVIDER, " useful suffix."];
    const decision = inspect([], parts); assert.equal(decision.status, "MATCHED");
    assert.ok(decision.matches.some(match => match.kind === "provider" && match.registrationId === undefined)); coordinates(decision, parts);
    assert.ok(!JSON.stringify(decision).includes(PROVIDER)); clean(inspect([], ["Useful public documentation and ordinary https://example.invalid/path."]));
});

test("F07-M25 assignment entropy requires the frozen length and character-class gates", () => {
    assert.equal(HIGH.length, 32);
    for (const key of ["secret", "service_token", "password", "api_key", "access-key", "auth"])
        assert.ok(inspect([], [`${key}=${HIGH}`]).matches.some(match => match.kind === "entropy"));
    for (const source of [`secret=${HIGH.slice(0, 31)}`, `secret=${HIGH.repeat(16)}A`, `secret=${"Aa0".repeat(11)}`,
        `secret=${"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef"}`, HIGH, `public_url=https://example.invalid/${HIGH}`,
        "checksum=0123456789abcdef0123456789abcdef", "request_id=22e1b402-cce9-4cf3-a789-5a968302ad8e"])
        clean(inspect([], [source]));
    assert.ok(inspect([], [`credentials=${HIGH.repeat(16)}`]).matches.some(match => match.kind === "entropy"));
});

test("F07-M26 one decoding layer does not recognize a nested encoding of an unformatted registered value", () => {
    const value = "F07 private exact value q9", once = Buffer.from(value).toString("base64"), twice = Buffer.from(once).toString("base64");
    matched(inspect([value], [once])); clean(inspect([value], [twice]));
    clean(inspect([value], [JSON.stringify(once).replace(/./g, char => char === '"' ? char : `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`)]));
});

test("F07-M27 deterministic positive/negative fuzz preserves exact value identity and source spans", () => {
    let seed = 0x706f37;
    const next = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed; };
    for (let index = 0; index < 64; index++) {
        const value = `F07 fixture ${next().toString(36)} É🔐 ${next().toString(36)}!`;
        const forms = [value, Buffer.from(value).toString("base64"), percentAll(value), JSON.stringify(value).replace("fixture", "\\u0066ixture")];
        const source = forms[next() % forms.length], split = next() % (source.length + 1), parts = [source.slice(0, split), source.slice(split)];
        const decision = inspect([value], parts); matched(decision); coordinates(decision, parts);
        clean(inspect([value], ["Useful unrelated public control " + index]));
    }
});

// Additional regressions authored after the retained missing-module baseline.
test("F07-M28 derived-variant exhaustion is independent of registration count, value bytes and registered total", () => {
    // Each value is exactly 4 KiB. Escaped controls expand JSON and URL forms;
    // twelve unique values fit 1 MiB of variants, thirteen exceed it while
    // remaining below all three registration-input limits.
    const values = Array.from({ length: 13 }, (_, index) => "\u0001".repeat(4092) + String(index).padStart(4, "0"));
    assert.ok(values.every(value => Buffer.byteLength(value) === 4096));
    assert.equal(values.reduce((sum, value) => sum + Buffer.byteLength(value), 0), 53248);
    clean(inspect(values.slice(0, 12), [""]));
    withheld(inspect(values, [values[0]]));
});

test("F07-M29 decoded-candidate count is inclusive and overflow discards earlier registered matches", () => {
    const exact = inspect(["!"], [Array.from({ length: 128 }, () => '"!"').join(" ")]);
    matched(exact); assert.equal(registered(exact).length, 128);
    coordinates(exact, [Array.from({ length: 128 }, () => '"!"').join(" ")]);
    withheld(inspect(["!"], ["!", Array.from({ length: 129 }, () => '"!"').join(" ")]));
});

test("F07-M30 overlapping original-source decoded views spend the decoded-byte budget without an input overflow", () => {
    // Valid quoted ASCII base64 plus a percent escape produces independently
    // valid base64, whole-input URL, token URL and JSON views. Their combined
    // decoded size crosses 256 KiB, despite fewer than ten views and <128 KiB
    // input. No registrations, matches or recursive decoding are involved.
    const under = JSON.stringify("QUFB".repeat(16000) + "%41");
    const over = JSON.stringify("QUFB".repeat(20000) + "%41");
    assert.ok(Buffer.byteLength(over) < SECRET_MATCH_LIMITS.maxInputBytes);
    clean(inspect([], [under])); withheld(inspect([], [over]));
});

test("F07-M31 serializing a valid or invalid registry exposes neither values nor their derived spellings", () => {
    const values = [SECRET, OTHER];
    for (const matcher of [new RegisteredSecretMatcher(values), new RegisteredSecretMatcher([...values, ""])]) {
        const serialized = JSON.stringify(matcher);
        assert.equal(typeof serialized, "string");
        for (const value of values) for (const spelling of [value, Buffer.from(value).toString("base64"),
            Buffer.from(value).toString("base64url"), Buffer.from(value).toString("hex"), encodeURIComponent(value),
            JSON.stringify(value).slice(1, -1)]) assert.ok(!serialized.includes(spelling));
        assert.doesNotMatch(serialized, /"(?:value|rawValue|fragment|valueHash|fingerprint|preview)"\s*:/);
    }
});

test("F07-M32 nonzero unused base64 pad bits are rejected in padded and unpadded spellings", () => {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    for (const remainder of [1, 2]) {
        let value = "F07 strict private padding value";
        while (Buffer.byteLength(value) % 3 !== remainder) value += "X";
        const canonical = Buffer.from(value).toString("base64"), plain = canonical.replace(/=+$/, "");
        const at = plain.length - 1, bits = alphabet.indexOf(plain[at]);
        const invalid = plain.slice(0, at) + alphabet[bits + 1];
        assert.notEqual(invalid, plain);
        // Node's permissive decoder yields the original value; the matcher must
        // enforce canonical unused bits rather than accept that repair.
        assert.equal(Buffer.from(invalid, "base64").toString("utf8"), value);
        matched(inspect([value], [canonical])); matched(inspect([value], [plain]));
        clean(inspect([value], [invalid]));
        clean(inspect([value], [invalid + canonical.slice(plain.length)]));
    }
});

test("F07-M33 padding inserted inside encoded secret bytes or given the wrong count is not repaired", () => {
    let value = "F07 strict private padding placement";
    while (Buffer.byteLength(value) % 3 !== 1) value += "X";
    const canonical = Buffer.from(value).toString("base64"), middle = Math.floor(canonical.length / 2);
    assert.ok(canonical.endsWith("==")); matched(inspect([value], [canonical]));
    const misplaced = canonical.slice(0, middle) + "=" + canonical.slice(middle + 1);
    assert.notEqual(Buffer.from(misplaced, "base64").toString("utf8"), value);
    clean(inspect([value], [misplaced])); clean(inspect([value], [canonical.slice(0, -1)]));
});

test("F07-M34 canonical provider detection also applies to one-layer encoded original-source views", () => {
    for (const source of [Buffer.from(PROVIDER).toString("base64"), Buffer.from(PROVIDER).toString("hex"),
        percentAll(PROVIDER), JSON.stringify(PROVIDER).replace("sk-proj", "\\u0073k-proj")]) {
        const decision = inspect([], [source]); assert.equal(decision.status, "MATCHED");
        assert.ok(decision.matches.some(match => match.kind === "provider" && match.representation !== "raw"));
        coordinates(decision, [source]); assert.ok(!JSON.stringify(decision).includes(PROVIDER));
    }
});

test("F07-M35 entropy recognition uses decoded semantic credential keys while public keys remain negative", () => {
    const assignment = `service_token=${HIGH}`;
    for (const source of [Buffer.from(assignment).toString("base64"), Buffer.from(assignment).toString("hex"),
        `service_%74oken=${HIGH}`, JSON.stringify(assignment).replace("token", "\\u0074oken")]) {
        const decision = inspect([], [source]); assert.equal(decision.status, "MATCHED");
        assert.ok(decision.matches.some(match => match.kind === "entropy" && match.representation !== "raw"));
        coordinates(decision, [source]); assert.ok(!JSON.stringify(decision).includes(HIGH));
    }
    for (const source of [Buffer.from(`public_url=${HIGH}`).toString("base64"),
        JSON.stringify(`request_id=${HIGH}`).replace("request", "\\u0072equest")]) clean(inspect([], [source]));
});
