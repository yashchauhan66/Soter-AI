import assert from "node:assert/strict";
import { test } from "node:test";
import { redactForSharing, findUnredactedSecrets } from "../Redactor";
import { scanBrokerRequest } from "../BrokerScanner";

test("bare process.env property reads preserve public source context", async () => {
    for (const input of [
        "Review this configuration: const password = process.env.DB_PASSWORD;",
        "const api_key = process.env.PUBLIC_API_KEY;",
        "password=process.env.DB_PASSWORD",
        "password=process.env.DB_PASSWORD ; // public reference",
    ]) {
        assert.equal(redactForSharing(input), input);
        assert.deepEqual(findUnredactedSecrets(input), []);
        const result = await scanBrokerRequest([{ role: "user", content: input }]);
        assert.equal(result.redacted, false);
        assert.equal(result.safe, true);
        assert.equal(result.redactedMessages[0].content, input);
    }
});

test("quoted environment-reference lookalikes remain literal credentials", () => {
    for (const [key, quote, value] of [
        ["password", '"', "process.env.DB_PASSWORD"],
        ["DB_PASSWORD", '"', "process.env.DB_PASSWORD"],
        ["PRIVATE_API_KEY", "'", "process.env.API_KEY"],
        ["DB_PASSWORD", '"', "process.env.DB_PASSWORD.Synthetic8!"],
    ]) {
        const input = `${key}=${quote}${value}${quote}`;
        const output = redactForSharing(input);
        assert.ok(!output.includes(value));
        assert.deepEqual(findUnredactedSecrets(output), []);
        assert.equal(redactForSharing(output), output);
    }
    const json = JSON.stringify({ DB_PASSWORD: "process.env.DB_PASSWORD", public: "Public explanation" });
    assert.ok(findUnredactedSecrets(json).length > 0);
    assert.deepEqual(JSON.parse(redactForSharing(json)), { DB_PASSWORD: "[REDACTED_SECRET]", public: "Public explanation" });
});

test("a reference prefix or neighbouring reference cannot exempt actual values", () => {
    const privateValue = "MintHorizon8!";
    for (const input of [
        `password=process.env.DB_PASSWORD+${privateValue}`,
        `password=process.env.DB_PASSWORD-${privateValue}`,
        `password=process.env.DB_PASSWORD/${privateValue}`,
        `const password = process.env.DB_PASSWORD;\nDB_PASSWORD=${privateValue}`,
        `password=${privateValue}; // process.env.DB_PASSWORD`,
        `password="process.env.DB_PASSWORD${privateValue}"`,
    ]) {
        assert.ok(!redactForSharing(input).includes(privateValue));
    }
    for (const input of ["password=process.env.DB_PASSWORD + fallback", "password=process.env.DB_PASSWORD()",
        "password=process.env.DB_PASSWORD.extra", "password=PROCESS.ENV.DB_PASSWORD"]) {
        assert.notEqual(redactForSharing(input), input, "Only the exact supported property-read syntax may be exempted");
    }
});
