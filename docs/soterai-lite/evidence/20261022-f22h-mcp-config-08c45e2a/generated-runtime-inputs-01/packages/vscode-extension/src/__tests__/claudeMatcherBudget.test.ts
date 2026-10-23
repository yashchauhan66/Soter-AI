import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { RegisteredSecretMatcher, SECRET_MATCH_LIMITS } from "../../../core/src/RegisteredSecretMatcher";
const VALUE = "TEST_ONLY_F19_REGISTERED_MATCHER_VALUE";
const text = JSON.stringify({ tools: JSON.parse(readFileSync(join(__dirname, "fixtures/claude-tools-2.1.301-01.json"), "utf8")) });
const configured = (options: unknown) => Reflect.construct(RegisteredSecretMatcher, [[VALUE], options]) as RegisteredSecretMatcher;
test("F19 structured profile permits captured26-tool public schemas while original F07/F18 candidate bounds remain", () => {
    assert.equal(SECRET_MATCH_LIMITS.maxDecodedCandidates, 128);
    assert.equal(new RegisteredSecretMatcher([VALUE]).inspectRequest([text]).status, "WITHHELD");
    assert.equal(configured({ maxDecodedCandidates: 1024 }).inspectRequest([text]).status, "WITHHELD");
    assert.equal(configured({ decodedCandidateProfile: "structured-json-v1" }).inspectRequest([text]).status, "CLEAN");
});
test("F19 structured candidate profile keeps raw, encoded and semantic split registrations protected", () => {
    for (const value of [VALUE, Buffer.from(VALUE).toString("base64"), Buffer.from(VALUE).toString("hex")])
        assert.equal(configured({ decodedCandidateProfile: "structured-json-v1" }).inspectRequest([text, " ", value]).status, "MATCHED");
    assert.equal(configured({ decodedCandidateProfile: "structured-json-v1" }).inspectRequest([text, " ", VALUE.slice(0, 12), VALUE.slice(12)]).status, "MATCHED");
});
test("F19 unknown, ambiguous and excessive structured inspection withholds instead of disabling registrations", () => {
    for (const options of [{ decodedCandidateProfile: "future" }, { decodedCandidateProfile: null }, { decodedCandidateProfile: true },
        { decodedCandidateProfile: "structured-json-v1", maxDecodedCandidates: 1024 }, { maxDecodedCandidates: 1025 }])
        assert.equal(configured(options).inspectRequest(["Public short control"]).status, "WITHHELD");
    const matcher = configured({ decodedCandidateProfile: "structured-json-v1" });
    assert.equal(matcher.inspectRequest(["P".repeat(131073)]).status, "WITHHELD");
    assert.equal(matcher.inspectRequest([Array.from({ length: 2050 }, () => '"public"').join(" ")]).status, "WITHHELD");
});
