import assert from "node:assert/strict";
import { test } from "node:test";
import { detectSecrets } from "../detectors/SecretDetector";
import { redactForSharing, findUnredactedSecrets } from "../Redactor";
import { scanBrokerRequest } from "../BrokerScanner";

const password = "BlueMango7!"; // Synthetic, below the entropy detector's length floor.
const apiValue = "Abc93zyQ14Rk56Tu";
for (const input of [
    `DB_PASSWORD=${password}`, `redis.passwd : '${password}'`, `service-pwd = "${password}"`,
    JSON.stringify({ nested: { DB_PASSWORD: password } }),
    `First line\nDb_Password = '${password}'\nPublic explanation`,
    `PRIVATE_API_KEY=${apiValue}`,
]) {
    test(`detected credential assignment is redacted without findings (${input.length} chars)`, () => {
        assert.ok(detectSecrets(input).matches.some(match => ["password_assignment", "generic_api_key"].includes(match.type)));
        const output = redactForSharing(input);
        assert.ok(!output.includes(password) && !output.includes(apiValue));
        assert.deepEqual(findUnredactedSecrets(output), []);
        assert.equal(redactForSharing(output), output, "redaction must be idempotent");
    });
}

test("detector spans preserve a prefixed JSON key, quoting and unrelated context", () => {
    const input = { DB_PASSWORD: password, public: "Useful public explanation" };
    const output = JSON.parse(redactForSharing(JSON.stringify(input)));
    assert.equal(output.public, input.public);
    assert.equal(output.DB_PASSWORD, "[REDACTED_SECRET]");
});

test("outbound survivor check includes recognized assignments without changing their detection score", () => {
    assert.ok(findUnredactedSecrets(`DB_PASSWORD=${password}`).includes("password_assignment"));
    assert.ok(findUnredactedSecrets(`PRIVATE_API_KEY=${apiValue}`).includes("generic_api_key"));
    assert.equal(detectSecrets(`DB_PASSWORD=${password}`).matches.find(m => m.type === "password_assignment")?.score, 24);
});

test("public identifiers and private-store references remain useful negative controls", () => {
    for (const input of ["Public arithmetic", "4b8b72a0-512f-4bdb-a2a5-54a756301237", "DB_PASSWORD=process.env.DB_PASSWORD",
        "DB_PASSWORD=[REDACTED_SECRET]", "DB_PASSWORD=changeme", 'DB_PASSWORD="${{ secrets.DB_PASSWORD }}"']) {
        assert.deepEqual(findUnredactedSecrets(input), []);
        assert.equal(redactForSharing(input), input);
    }
});

test("broker scanner's safe copy cannot contain a recognized low-entropy password", async () => {
    for (const level of ["developer", "strict", "enterprise"] as const) {
        const result = await scanBrokerRequest([{ role: "user", content: `DB_PASSWORD=${password}` }], { safeMode: { enabled: true, level } });
        assert.equal(result.redacted, true);
        assert.equal(result.safe, true);
        assert.ok(!JSON.stringify(result.redactedMessages).includes(password));
    }
});

test("overlapping accepted assignment values retain the complete public suffix", () => {
    const input = `DB_PASSWORD=x_apiKey=${apiValue}!Tail Public suffix`;
    const output = redactForSharing(input);
    assert.equal(output, "DB_PASSWORD=[REDACTED_SECRET] Public suffix");
    assert.equal(redactForSharing(output), output);
});

test("a generated marker exemption never covers a value with a private prefix or suffix", () => {
    for (const value of [`[REDACTED_SECRET]${password}`, `${password}[REDACTED_SECRET]`]) {
        assert.ok(findUnredactedSecrets(`DB_PASSWORD=${value}`).includes("password_assignment"));
        assert.ok(!redactForSharing(`DB_PASSWORD=${value}`).includes(password));
    }
});
