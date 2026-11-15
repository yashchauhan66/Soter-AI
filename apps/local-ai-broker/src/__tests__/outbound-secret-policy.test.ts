import assert from "node:assert/strict";
import { test } from "node:test";
import { performance } from "node:perf_hooks";
import { assertSafeOutboundJson } from "../OutboundSecretPolicy";
import { GatewayPolicyError, GATEWAY_LIMITS } from "../GatewayBoundary";

const password = "BlueMango7!";
const wire = (value: unknown) => JSON.stringify({ messages: [{ role: "user", content: "Public arithmetic" }], metadata: value });

test("outbound gate inspects decoded nested JSON without changing public wire bytes", () => {
    const original = wire({ query: JSON.stringify({ fields: ["id", "name"], limit: 10 }) });
    assert.doesNotThrow(() => assertSafeOutboundJson(original));
    const escaped = [...password].map(char => "\\u" + char.charCodeAt(0).toString(16).padStart(4, "0")).join("");
    for (const value of [{ DB_PASSWORD: password }, { query: '{"DB_PASSWORD":"' + escaped + '"}' },
        { query: JSON.stringify(JSON.stringify({ DB_PASSWORD: password })) }]) {
        assert.throws(() => assertSafeOutboundJson(wire(value)), error => error instanceof Error && !error.message.includes(password));
    }
});

test("outbound gate withholds malformed, duplicate, over-budget and deeply encoded JSON", () => {
    for (const input of ['{"x":1,"x":2}', '{"x":', JSON.stringify({ content: "P".repeat(131073) }),
        '{"x":' + '['.repeat(40) + '0' + ']'.repeat(40) + '}']) {
        assert.throws(() => assertSafeOutboundJson(input));
    }
    let nested = '{"public":true}';
    for (let i = 0; i < 5; i++) nested = JSON.stringify(nested);
    assert.throws(() => assertSafeOutboundJson(wire({ value: nested })));
    assert.throws(() => assertSafeOutboundJson(wire({ value: '{"public":1,"public":2}' })));
});

test("outbound gate allows non-JSON prose and redaction markers", () => {
    for (const value of ["[Public explanation]", "{example pseudocode}", "DB_PASSWORD=[REDACTED_SECRET]", "DB_PASSWORD=process.env.DB_PASSWORD"])
        assert.doesNotThrow(() => assertSafeOutboundJson(wire({ text: value })));
});

test("outbound gate refuses when the last detector call exhausts its time budget", t => {
    let elapsed = 0, finalInspected = false;
    t.mock.method(Date, "now", () => elapsed);
    t.mock.method(performance, "now", () => elapsed);
    const originalTest = RegExp.prototype.test;
    t.mock.method(RegExp.prototype, "test", function (this: RegExp, text: string) {
        if (text === "PUBLIC_FINAL_VALUE") {
            finalInspected = true;
            elapsed = GATEWAY_LIMITS.inspectionMs + 1;
        }
        return originalTest.call(this, text);
    });
    assert.throws(() => assertSafeOutboundJson(JSON.stringify({ text: "PUBLIC_FINAL_VALUE" })),
        error => error instanceof GatewayPolicyError && error.code === "gateway_limit");
    assert.equal(finalInspected, true);
});
