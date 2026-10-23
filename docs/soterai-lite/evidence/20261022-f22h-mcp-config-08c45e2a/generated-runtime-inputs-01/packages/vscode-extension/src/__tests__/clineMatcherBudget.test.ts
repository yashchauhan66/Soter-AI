import assert from "node:assert/strict";
import { test } from "node:test";
import { RegisteredSecretMatcher } from "../../../core/src/RegisteredSecretMatcher";
const VALUE = "TEST_ONLY_F18_MATCHER_REGISTERED_VALUE";
const text = JSON.stringify({ tools: Array.from({ length: 10 }, (_, index) => ({ type: "function", function: { name: "public_tool_" + index, description: "Public synthetic tool", parameters: { type: "object", properties: { path: { type: "string", description: "Public relative path" }, text: { type: "string", description: "Public text" } }, required: ["path"], additionalProperties: false } } })) });
const configured = (budget: unknown) => Reflect.construct(RegisteredSecretMatcher, [[VALUE], { maxDecodedCandidates: budget }]) as RegisteredSecretMatcher;
test("F18 metadata candidate budget is explicit; the original F07 default remains bounded", () => {
    assert.equal(new RegisteredSecretMatcher([VALUE]).inspectRequest([text]).status, "WITHHELD");
    assert.equal(configured(1024).inspectRequest([text]).status, "CLEAN");
});
test("F18 expanded bounded candidate inspection still detects protected spellings and ordered fragments", () => {
    for (const value of [VALUE, Buffer.from(VALUE).toString("base64"), Buffer.from(VALUE).toString("hex")]) assert.equal(configured(1024).inspectRequest([text, " ", value]).status, "MATCHED");
    assert.equal(configured(1024).inspectRequest([text, " ", VALUE.slice(0, 13), VALUE.slice(13)]).status, "MATCHED");
});
test("F18 invalid or excessive candidate budgets never silently become an empty registry", () => {
    for (const budget of [0, -1, 1025, 1.5, "1024", null]) assert.equal(configured(budget).inspectRequest(["Public short control"]).status, "WITHHELD");
    assert.equal(configured(1024).inspectRequest(["P".repeat(131073)]).status, "WITHHELD");
});
