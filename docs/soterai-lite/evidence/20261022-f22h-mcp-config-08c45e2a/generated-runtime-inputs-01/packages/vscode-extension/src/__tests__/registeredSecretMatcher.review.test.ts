import assert from "node:assert/strict";
import { test } from "node:test";
import { RegisteredSecretMatcher, SECRET_MATCH_LIMITS, type MatchDecision } from "../../../core/src/RegisteredSecretMatcher";

// Synthetic in-memory inputs only. These independent review fixtures do not
// read environment/project secrets or exercise a network/streaming adapter.
const VALUE = "sensitive";
const UNICODE = "Sensitive😀!";
type Representation = MatchDecision["matches"][number]["representation"];
function expectCovered(value: string, parts: string[], spelling: string, representation: Representation): void {
    const source = parts.join(""), start = source.indexOf(spelling); assert.ok(start >= 0);
    const result = new RegisteredSecretMatcher([value]).inspectRequest(parts);
    assert.equal(result.status, "MATCHED", "A supported encoded value in an ordinary URL/string must be recognized.");
    const finding = result.matches.find(item => item.kind === "registered" && item.representation === representation
        && item.start <= start && item.end >= start + spelling.length);
    assert.ok(finding, "Reported source range must cover the original encoded contributor.");
    assert.ok(!JSON.stringify(result).includes(value));
    const reconstructed = finding.parts.map(span => {
        assert.ok(span.index >= 0 && span.index < parts.length);
        assert.ok(span.start >= 0 && span.end > span.start && span.end <= parts[span.index].length);
        return parts[span.index].slice(span.start, span.end);
    }).join("");
    assert.equal(reconstructed, source.slice(finding.start, finding.end));
}

test("F07-R01 registered hex inside a public URL path retains source coordinates", () => {
    const hex = Buffer.from(VALUE).toString("hex");
    expectCovered(VALUE, [`https://public.invalid/${hex}/result`], hex, "hex");
});

test("F07-R02 mixed-case hex in a URL query remains recognized", () => {
    const hex = Buffer.from(VALUE).toString("hex").split("").map((char, index) => index % 2 ? char.toUpperCase() : char).join("");
    expectCovered(VALUE, [`https://public.invalid/query?value=${hex}&mode=public`], hex, "hex");
});

test("F07-R03 hex in a URL path split across explicit request parts maps every original part", () => {
    const hex = Buffer.from(VALUE).toString("hex"), prefix = "https://public.invalid/";
    const source = `${prefix}${hex}/result`, split = prefix.length + 7;
    expectCovered(VALUE, [source.slice(0, split), source.slice(split)], hex, "hex");
});

for (const encoding of ["base64", "base64url"] as const) {
    test(`F07-R04 ${encoding} value in a URL path is recognized without network parsing`, () => {
        const spelling = Buffer.from(UNICODE).toString(encoding);
        expectCovered(UNICODE, [`https://public.invalid/${spelling}/result`], spelling, encoding);
    });
    test(`F07-R05 ${encoding} query value remains a strict canonical positive control`, () => {
        const spelling = Buffer.from(UNICODE).toString(encoding);
        expectCovered(UNICODE, [`https://public.invalid/query?value=${spelling}&mode=public`], spelling, encoding);
    });
}

test("F07-R06 hex embedded inside a JSON URL string remains one-layer recognition", () => {
    const hex = Buffer.from(VALUE).toString("hex");
    expectCovered(VALUE, [JSON.stringify({ link: `https://public.invalid/${hex}/result` })], hex, "hex");
});

test("F07-R07 partial JSON Unicode escaping is recognized at original string coordinates", () => {
    const source = String.raw`{"value":"\u0073ensitive"}`;
    expectCovered(VALUE, [source], String.raw`\u0073ensitive`, "json");
});

test("F07-R08 JSON decoding never recursively interprets a decoded literal escape", () => {
    const source = JSON.stringify({ value: String.raw`\u0073ensitive` });
    const result = new RegisteredSecretMatcher([VALUE]).inspectRequest([source]);
    assert.equal(result.status, "CLEAN"); assert.deepEqual(result.matches, []);
});

for (const encoding of ["hex", "base64", "base64url"] as const) {
    test(`F07-R09 malformed UTF-8 ${encoding} cannot invent a registered replacement character`, () => {
        const value = "rivulet\uFFFDcobalt", damaged = Buffer.concat([Buffer.from("rivulet"), Buffer.from([0xff]), Buffer.from("cobalt")]);
        const source = `https://public.invalid/${damaged.toString(encoding)}/result`;
        const result = new RegisteredSecretMatcher([value]).inspectRequest([source]);
        assert.equal(result.status, "CLEAN"); assert.deepEqual(result.matches, []);
    });
}

test("F07-R10 extra base64 padding is not repaired into a canonical registered value", () => {
    const value = "abcdefgh", invalid = Buffer.from(value).toString("base64") + "=";
    assert.equal(new RegisteredSecretMatcher([value]).inspectRequest([invalid]).status, "CLEAN");
});

test("F07-R11 duplicate registration input at the frozen total-byte bound remains usable", () => {
    const values = Array<string>(SECRET_MATCH_LIMITS.maxRegisteredBytes).fill("x");
    const result = new RegisteredSecretMatcher(values).inspectRequest(["Useful public response."]);
    assert.equal(result.status, "CLEAN"); assert.deepEqual(result.matches, []);
});

test("F07-R12 duplicate registration input above the total-byte bound withholds rather than looping unbounded", () => {
    const values = Array<string>(SECRET_MATCH_LIMITS.maxRegisteredBytes + 1).fill("x");
    const result = new RegisteredSecretMatcher(values).inspectRequest(["Useful public response."]);
    assert.equal(result.status, "WITHHELD"); assert.deepEqual(result.matches, []);
});

test("F07-R13 a short encoded value occupying one explicit part stays recognizable beside unrelated alphabetic parts", () => {
    for (const spelling of ["YQ", "61"]) {
        const result = new RegisteredSecretMatcher(["a"]).inspectRequest([spelling, "face"]);
        assert.equal(result.status, "MATCHED");
        assert.ok(result.matches.some(match => match.kind === "registered" && match.start === 0 && match.end === spelling.length));
        assert.equal(new RegisteredSecretMatcher(["a"]).inspectRequest([spelling + "face"]).status, "CLEAN");
    }
});
