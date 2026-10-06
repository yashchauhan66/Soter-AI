import { test } from "node:test";
import assert from "node:assert/strict";
import { redactAIContext } from "../ContextRedactor";
import { buildSafeContext } from "../SafeContextBuilder";
import { DEFAULT_PROJECT_POLICY } from "../ProjectPolicy";

const key = "sk-" + "FAKE73921canaryForContextOnly".repeat(2);
const cases: Array<[string, string]> = [
    ["base64", Buffer.from(key).toString("base64")],
    ["hex", Buffer.from(key).toString("hex")],
    ["percent encoding", [...key].map(c => `%${c.charCodeAt(0).toString(16)}`).join("")],
    ["zero width", [...key].join("\u200b")],
    ["line splitting", (key.match(/.{1,8}/g) ?? []).join("\n")],
    ["array concatenation", `const k = ${JSON.stringify(key.match(/.{1,6}/g))}.join("");`],
    ["JS escapes", [...key].map(c => `\\x${c.charCodeAt(0).toString(16)}`).join("")],
];
for (const [name, encoded] of cases) {
    test(`recognised secret in ${name} is withheld from context and decisions`, () => {
        const safe = buildSafeContext([{ path: "notes.txt", kind: "other", content: encoded }], DEFAULT_PROJECT_POLICY);
        assert.match(safe.safeText, /withheld/);
        assert.ok(!JSON.stringify(safe).includes(encoded));
    });
}
test("literal redaction retains surrounding useful text", () => {
    const result = redactAIContext(`public example\n${key}`);
    assert.ok(result.includes("public example"));
    assert.ok(!result.includes(key));
});
test("ordinary code and encoded public text are not blanket blocked", () => {
    for (const text of ["const answer = 42;", Buffer.from("public example with no credential").toString("base64")]) assert.equal(redactAIContext(text), text);
});
test("oversized context fails closed", () => {
    assert.match(redactAIContext("x".repeat(1024 * 1024 + 1)), /withheld/);
});
