import { test } from "node:test";
import assert from "node:assert/strict";
const KEY = Buffer.alloc(32, 19), VALUE = "TEST_ONLY_F21_PRIVATE_CONTENT_7c9e13a4", SOURCE = "private-" + VALUE + "/.env";
async function analyze(text: string, source = ".env", environment = true, key = KEY) {
    const module = await import("../hygiene/HygieneAnalysis"); return module.analyzeHygieneText({ text, source, environment }, key);
}
test("F21 analysis has only keyed references/fixed labels and bounded locations, no names/path/value/fragments", async () => {
    const result = await analyze("OPENAI_API_KEY=" + VALUE + "\nPORT=3000\n", SOURCE), text = JSON.stringify(result);
    assert.equal(result.version, 1); assert.equal(result.findings.length, 1); assert.equal(result.findings[0].provider, "openai"); assert.equal(result.findings[0].line, 1);
    for (const raw of [VALUE, "OPENAI_API_KEY", SOURCE, VALUE.slice(-12)]) assert(!text.includes(raw));
    for (const id of [result.fileRef, result.revision, result.findings[0].id, result.findings[0].valueRef]) assert.match(id, /^[a-f0-9]{64}$/);
    assert(result.findings[0].suggestions.includes("review-vault")); assert.match(text, /heuristic/i);
});
test("F21 separate HMAC domains and profile keys prevent plain-value/file hashes and cross-profile correlation", async () => {
    const first = await analyze("API_KEY=" + VALUE), second = await analyze("API_KEY=" + VALUE), other = await analyze("API_KEY=" + VALUE, ".env", true, Buffer.alloc(32, 20));
    assert.deepEqual(first, second); assert.notEqual(first.fileRef, other.fileRef); assert.notEqual(first.findings[0].valueRef, other.findings[0].valueRef);
    assert.notEqual(first.fileRef, first.findings[0].valueRef); assert.notEqual(first.revision, first.findings[0].valueRef);
    assert(!JSON.stringify(first).includes(KEY.toString("base64")));
});
test("F21 public near-matches, empty fields, protected placeholders and explicit templates are not reported as live credentials", async () => {
    const text = "PORT=3000\nMONKEY=banana\nKEYBOARD=arrows\nAPI_KEY=YOUR_API_KEY_HERE\nAUTH_TOKEN=${AUTH_TOKEN}\nPASSWORD=[MASKED]\nSECRET=[SOTERAI_PROTECTED_ABC]\nEMPTY_SECRET=\nSTRIPE_PUBLISHABLE_KEY=pk_test_F21PUBLICSYNTHETICONLY123456\n";
    assert.equal((await analyze(text)).findings.length, 0);
});
test("F21 pinned supported dotenv provider hints stay heuristic and unknown provider stays unknown", async () => {
    for (const [name, provider] of [["ANTHROPIC_API_KEY", "anthropic"], ["GEMINI_API_KEY", "google"], ["AWS_SECRET_ACCESS_KEY", "aws"], ["GITHUB_TOKEN", "github"], ["STRIPE_SECRET_KEY", "stripe"], ["CUSTOM_PASSWORD", "unknown"]]) {
        const result = await analyze(name + "=" + VALUE); assert.equal(result.findings[0].provider, provider); assert.match(result.assessment, /heuristic/i);
    }
});
test("F21 multiline quoted dotenv and supported JSON candidates reuse canonical vault parsing", async () => {
    const env = await analyze('DB_PASSWORD="' + VALUE + '\n' + VALUE + '"\n'); assert.equal(env.findings.length, 1);
    const json = await analyze(JSON.stringify({ api_key: VALUE }), "config.json", false); assert.equal(json.findings.length, 1); assert(!JSON.stringify(json).includes(VALUE));
});
test("F21 repeat values get one value reference while separate file/occurrence identities remain distinct", async () => {
    const result = await analyze("API_KEY=" + VALUE + "\nSECOND_TOKEN=" + VALUE + "\n"), other = await analyze("API_KEY=" + VALUE, "second/.env");
    assert.equal(result.findings.length, 2); assert.equal(result.findings[0].valueRef, result.findings[1].valueRef); assert.notEqual(result.findings[0].id, result.findings[1].id);
    assert.equal(other.findings[0].valueRef, result.findings[0].valueRef); assert.notEqual(other.fileRef, result.fileRef);
});
test("F21 malformed paths, binary/invalid UTF8, oversize work and short/malformed hash keys refuse without value-bearing exceptions", async () => {
    for (const source of ["../outside", "C:/outside", "file://outside", ".env\n" + VALUE]) await assert.rejects(analyze("API_KEY=" + VALUE, source), e => !String(e).includes(VALUE));
    for (const text of ["API_KEY=" + "P".repeat(65537), "API_KEY=\u0000" + VALUE, "API_KEY=\ud800", Array.from({ length: 129 }, (_, i) => "API_KEY_" + i + "=" + VALUE).join("\n")]) await assert.rejects(analyze(text), e => !String(e).includes(VALUE));
    for (const key of [Buffer.alloc(0), Buffer.alloc(31), Buffer.alloc(33)]) await assert.rejects(analyze("API_KEY=" + VALUE, ".env", true, key));
});
test("F21 static metadata/value collision withholds instead of returning an original in a label", async () => {
    await assert.rejects(analyze("API_KEY=unknown"));
    await assert.rejects(analyze("API_KEY=metadata"));
});
test("F21 synthetic bounded corpus never serializes its candidate values", async () => {
    for (let n = 0; n < 50; n++) { const value = "F21_SYNTHETIC_" + n + "_" + "Q".repeat(24), result = await analyze("SERVICE_TOKEN=" + value); assert.equal(result.findings.length, 1); assert(!JSON.stringify(result).includes(value)); }
});
