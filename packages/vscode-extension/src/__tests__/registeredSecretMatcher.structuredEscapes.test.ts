import assert from "node:assert/strict";
import { test } from "node:test";
import { RegisteredSecretMatcher } from "../../../core/src/RegisteredSecretMatcher";

const VALUE = "TEST_ONLY_LS17_PRIVATE_VALUE_20261110";
const unicode = (value: string): string => value.split("").map(char => "\\u" + char.charCodeAt(0).toString(16).padStart(4, "0")).join("");
const nativePrefix = 'Native system instructions include "quoted" values.\nRead C:\\public\\project safely.\n';
const matcher = (value = VALUE) => new RegisteredSecretMatcher([value], { decodedCandidateProfile: "structured-json-v1" });

test("LS17 native system quotes and newlines cannot hide a separate Unicode escaped prompt", () => {
    const escaped = unicode(VALUE), parts = [nativePrefix, escaped];
    const result = matcher().inspectRequest(parts);
    assert.equal(result.status, "MATCHED");
    assert(result.matches.some(match => match.kind === "registered" && match.representation === "json"));
    for (const match of result.matches) for (const span of match.parts) {
        assert(span.index >= 0 && span.index < parts.length);
        assert(span.start >= 0 && span.end <= parts[span.index].length && span.end > span.start);
    }
    assert(!JSON.stringify(result).includes(VALUE));
});

test("LS17 mixed raw and escaped content matches at every explicit input split", () => {
    const mixed = VALUE.slice(0, 8) + unicode(VALUE.slice(8, 22)) + VALUE.slice(22);
    for (let split = 0; split <= mixed.length; split++) {
        assert.equal(matcher().inspectRequest([nativePrefix, mixed.slice(0, split), mixed.slice(split)]).status, "MATCHED", "split " + split);
    }
    assert.equal(matcher().inspectRequest([nativePrefix, VALUE]).status, "MATCHED");
});

test("LS17 malformed independent spans do not suppress a later valid escaped value", () => {
    const escaped = unicode(VALUE);
    assert.equal(matcher().inspectRequest(['bad \\uQQQQ and \\xNN\n"bad quote\n', escaped]).status, "MATCHED");
    for (const invalid of [escaped.replace("\\u0054", "\\uQQQQ"), escaped.replace("\\u0054", "\\u054"), escaped.replace("\\u0054", "\\x54")]) {
        assert.equal(matcher().inspectRequest([nativePrefix, invalid]).status, "CLEAN");
    }
});

test("LS17 valid surrogate escapes preserve scalar identity and malformed surrogates never invent it", () => {
    const value = "TEST_ONLY_PRIVATE_\u{1f510}_VALUE", encoded = unicode(value);
    assert.equal(matcher(value).inspectRequest([nativePrefix, encoded]).status, "MATCHED");
    assert.notEqual(matcher(value).inspectRequest([nativePrefix, encoded.replace("\\udd10", "\\ud800")]).status, "MATCHED");
});

test("LS17 invalid surrogate in the same span cannot hide a later escaped registered value", () => {
    assert.equal(matcher().inspectRequest([nativePrefix, "bad \\ud800 then " + unicode(VALUE)]).status, "MATCHED");
    assert.equal(matcher().inspectRequest([nativePrefix, "bad \\ud800 middle \\udfff then " + unicode(VALUE)]).status, "MATCHED");
});

test("LS17 invalid surrogate boundaries never join unrelated decoded runs into a secret", () => {
    assert.equal(matcher().inspectRequest([nativePrefix, unicode(VALUE.slice(0, 10)) + "\\ud800" + unicode(VALUE.slice(10))]).status, "CLEAN");
});

test("LS17 public escaped text and long near matches retain useful requests", () => {
    assert.equal(matcher().inspectRequest([nativePrefix, unicode("ordinary public example")]).status, "CLEAN");
    assert.equal(matcher().inspectRequest([nativePrefix, unicode("ordinary public \u{1f510} example")]).status, "CLEAN");
    assert.equal(matcher().inspectRequest([nativePrefix + "public text ".repeat(1000), unicode(VALUE.slice(0, -1) + "1")]).status, "CLEAN");
});

test("LS17 escaped decoding remains one pass while default profile also blocks the actual canary", () => {
    const twice = unicode(VALUE).replace(/\\/g, "\\\\");
    assert.equal(matcher().inspectRequest([nativePrefix, twice]).status, "CLEAN");
    assert.equal(new RegisteredSecretMatcher([VALUE]).inspectRequest([nativePrefix, unicode(VALUE)]).status, "MATCHED");
});

test("LS17 structured escape candidate budget exhaustion withholds instead of truncating", () => {
    const result = matcher().inspectRequest([('\\u005a\n').repeat(2100)]);
    assert.equal(result.status, "WITHHELD");
    assert.deepEqual(result.matches, []);
});

for (const [name, options, cap] of [
    ["default", {}, 128],
    ["Cline numeric", { maxDecodedCandidates: 1024 }, 1024],
    ["native structured", { decodedCandidateProfile: "structured-json-v1" }, 2048],
] as const) {
    test(`LS17 ${name} profile blocks escaped and mixed values without recursive decoding`, () => {
        const scoped = () => new RegisteredSecretMatcher([VALUE], options);
        for (const secret of [VALUE, unicode(VALUE), VALUE.slice(0, 10) + unicode(VALUE.slice(10))])
            assert.equal(scoped().inspectRequest([nativePrefix, secret]).status, "MATCHED");
        assert.equal(scoped().inspectRequest([nativePrefix, "bad \\ud800 then " + unicode(VALUE)]).status, "MATCHED");
        assert.equal(scoped().inspectRequest([nativePrefix, unicode("public \u{1f510} example")]).status, "CLEAN");
        assert.equal(scoped().inspectRequest([nativePrefix, unicode(VALUE).replace(/\\/g, "\\\\")]).status, "CLEAN");
    });
    test(`LS17 ${name} keeps its ${cap} decoded-candidate boundary without duplicate JSON span charges`, () => {
        const scoped = () => new RegisteredSecretMatcher([VALUE], options);
        const candidates = (count: number) => Array.from({ length: count }, () => '"\\n"').join(" ");
        assert.equal(scoped().inspectRequest([candidates(cap)]).status, "CLEAN");
        assert.equal(scoped().inspectRequest([candidates(cap + 1)]).status, "WITHHELD");
    });
}
