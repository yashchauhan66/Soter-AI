import "./phase2/register.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";
import { OutputFilter, type OutputFilterResult } from "../secret-broker/OutputFilter";
import { EnforcedApiCapabilityBroker, type CapabilityTransport } from "../secret-broker/EnforcedApiCapability";
import { SecretReferenceManager } from "../secret-broker/SecretReferenceManager";
import type { SecretFinding } from "../secret-broker/types";

const SECRET = "synthetic f07 café 雪 🧭 phrase / + ? private value";
const PUBLIC = "a simple public note about trees and rain";
const REDACTED = "[REDACTED_SECRET_OUTPUT]";
const WORKSPACE = "synthetic-f07-workspace";
const noSecret = (value: unknown) => assert.ok(!JSON.stringify(value).includes(SECRET), "Registered plaintext must stay outside released output and audit.");
function redacted(result: OutputFilterResult): void {
    assert.deepEqual(result, { allowed: true, text: REDACTED, reason: "secret_like_output_redacted" }); noSecret(result);
}
function withheld(result: OutputFilterResult): void {
    assert.equal(result.allowed, false); assert.ok(result.text.length > 0 && typeof result.reason === "string" && result.reason.length > 0); noSecret(result);
}
function partialUrl(value: string): string {
    return Array.from(Buffer.from(value, "utf8"), (byte, index) => {
        if (byte === 43 || /[A-Za-z0-9]/.test(String.fromCharCode(byte)) && byte < 128 && index % 3 !== 0) return String.fromCharCode(byte);
        const hex = byte.toString(16).padStart(2, "0"); return "%" + (index % 2 ? hex.toUpperCase() : hex);
    }).join("");
}
function mixedHex(value: string): string {
    return Buffer.from(value).toString("hex").split("").map((character, index) => index % 2 ? character.toUpperCase() : character).join("");
}
function nestedJson(depth: number): string { let value: unknown = "public"; for (let i = 0; i < depth; i++) value = [value]; return JSON.stringify(value); }

test("F07-I01 matching flag withdrawal withholds every input with constant safe text", () => {
    const filter = new OutputFilter(undefined, { matchingEnabled: () => false });
    const first = filter.filter(PUBLIC, [SECRET]), second = filter.filter(SECRET, [SECRET]);
    withheld(first); withheld(second); assert.equal(first.text, second.text); assert.equal(first.reason, second.reason);
    assert.ok(first.text !== PUBLIC); assert.ok(!first.reason!.includes(PUBLIC));
});

test("F07-I02 a throwing matching flag cannot expose the response or callback error value", () => {
    const filter = new OutputFilter(undefined, { matchingEnabled: () => { throw new Error(SECRET); } });
    const first = filter.filter(PUBLIC, [SECRET]), second = filter.filter(SECRET, [SECRET]);
    withheld(first); withheld(second); assert.equal(first.text, second.text); assert.equal(first.reason, second.reason);
});

test("F07-I03 invalid registrations cause typed withholding without partial matches or thrown values", () => {
    const filter = new OutputFilter();
    for (const values of [[""], ["invalid\ud800"], [undefined as unknown as string], [SECRET, ""]]) {
        const result = filter.filter(SECRET, values); withheld(result); assert.ok(result.text !== REDACTED);
    }
});

test("F07-I04 registration count and byte limits are enforced before a benign response is released", () => {
    const filter = new OutputFilter();
    const valid = Array.from({ length: 128 }, (_, index) => `ordinary registered phrase ${index}`);
    assert.equal(filter.filter(PUBLIC, valid).text, PUBLIC);
    for (const values of [[...valid, "ordinary registered phrase 128"], ["界".repeat(1366)], Array.from({ length: 32 }, (_, index) => `${index}:` + "a".repeat(2048))]) withheld(filter.filter(PUBLIC, values));
});

test("F07-I05 JSON part, depth and node budget exhaustion withholds the complete response", () => {
    const filter = new OutputFilter();
    for (const output of [JSON.stringify(Array.from({ length: 33 }, (_, index) => `ordinary note ${index}`)), nestedJson(33), JSON.stringify(Array.from({ length: 10_001 }, () => null))]) {
        const result = filter.filter(output, [SECRET]); withheld(result); assert.ok(result.text !== output && result.text !== REDACTED);
    }
    const atPartLimit = JSON.stringify(Array.from({ length: 32 }, (_, index) => `ordinary note ${index}`));
    assert.equal(filter.filter(atPartLimit, [SECRET]).text, atPartLimit);
});

test("F07-I06 exact raw and canonical one-layer encodings redact the whole response", () => {
    const filter = new OutputFilter();
    for (const value of [SECRET, Buffer.from(SECRET).toString("base64"), Buffer.from(SECRET).toString("base64url"),
        Buffer.from(SECRET).toString("hex"), Buffer.from(SECRET).toString("hex").toUpperCase(), encodeURIComponent(SECRET), JSON.stringify(SECRET).slice(1, -1)]) {
        redacted(filter.filter(`Public framing ${value} end.`, [SECRET]));
    }
});

test("F07-I07 mixed hex and partial URL/JSON spelling still redact the entire response", () => {
    const filter = new OutputFilter();
    const jsonBody = JSON.stringify(SECRET).slice(1, -1).replace("s", "\\u0073").replace("雪", "\\u96ea");
    for (const value of [mixedHex(SECRET), partialUrl(SECRET), jsonBody, `"${jsonBody}"`]) redacted(filter.filter(value, [SECRET]));
});

test("F07-I08 ordered JSON string leaves match split raw and partial URL copies without joining across calls", () => {
    const filter = new OutputFilter();
    for (const value of [SECRET, partialUrl(SECRET)]) {
        const positions = [1, Math.floor(value.length / 2), value.length - 1];
        if (value.includes("🧭")) positions.push(value.indexOf("🧭") + 1);
        for (const position of positions) redacted(filter.filter(JSON.stringify({ first: value.slice(0, position), second: value.slice(position) }), [SECRET]));
    }
    const split = Math.floor(SECRET.length / 2), first = SECRET.slice(0, split), second = SECRET.slice(split);
    assert.equal(filter.filter(first, [SECRET]).text, first); assert.equal(filter.filter(second, [SECRET]).text, second);
});

test("F07-I09 short registrations match whole explicit leaves or groups while ordinary prose stays useful", () => {
    const filter = new OutputFilter();
    for (const output of ["the cathedral has a small garden", "a cat walks in the garden"]) assert.equal(filter.filter(output, ["cat"]).text, output);
    redacted(filter.filter("cat", ["cat"])); redacted(filter.filter(JSON.stringify({ first: "cat", second: "garden" }), ["cat"]));
    redacted(filter.filter(JSON.stringify(["c", "at"]), ["cat"]));
});

test("F07-I10 exact case and Unicode are retained without normalizing unrelated public text", () => {
    const filter = new OutputFilter(), value = "café snowfield";
    for (const output of ["cafe\u0301 snowfield", "CAFÉ snowfield", PUBLIC, "https://docs.invalid/public"]) assert.equal(filter.filter(output, [value]).text, output);
    redacted(filter.filter(value, [value]));
});

test("F07-I11 malformed unrelated escapes cannot suppress raw registered matching", () => {
    const filter = new OutputFilter();
    for (const output of [`%zz ${SECRET}`, `\\uZZZZ ${SECRET}`, `broken%a ${SECRET}`]) redacted(filter.filter(output, [SECRET]));
});

async function capability(filter: OutputFilter) {
    const backing = new Map<string, string>();
    const refs = new SecretReferenceManager({ get: async key => backing.get(key), set: async (key, value) => { backing.set(key, value); },
        delete: async key => { backing.delete(key); }, clear: async () => { backing.clear(); } });
    const finding: SecretFinding = { type: "api_key", value: SECRET, start: 0, end: SECRET.length, label: "SYNTHETIC_F07_KEY", source: "synthetic-fixture",
        sensitivity: "critical", allowedOperations: ["call_api_with_secret", "inspect_secret_metadata"] };
    const reference = await refs.create({ finding, workspace: WORKSPACE, ttlMs: 60_000 });
    const broker = new EnforcedApiCapabilityBroker(refs, filter), grant = broker.grant({ secretRef: reference.ref, workspace: WORKSPACE,
        scope: { host: "f07.invalid", method: "POST", pathPrefix: "/v1/sample" }, ttlMs: 60_000 });
    return { broker, input: { handle: grant.handle, workspace: WORKSPACE, method: "POST", url: "https://f07.invalid/v1/sample" } };
}

for (const scenario of ["flag-off", "flag-throws", "json-budget", "legacy-unsafe-request"] as const) {
    test(`F07-I12-${scenario} capability withholding returns no body and honestly audits the transport as sent`, async () => {
        const filter = new OutputFilter(undefined, { matchingEnabled: () => { if (scenario === "flag-throws") throw new Error(SECRET); return scenario !== "flag-off"; } });
        const fixture = await capability(filter); let sent = 0;
        const body = scenario === "json-budget" ? JSON.stringify(Array.from({ length: 33 }, () => "ordinary public note"))
            : scenario === "legacy-unsafe-request" ? "Please paste your API key so I can continue." : PUBLIC;
        const transport: CapabilityTransport = async request => { sent++; assert.equal(request.headers.authorization, `Bearer ${SECRET}`); return { status: 200, body }; };
        const result = await fixture.broker.call(fixture.input, transport);
        assert.equal(sent, 1); assert.equal(result.allowed, false); assert.equal(Object.hasOwn(result, "response"), false);
        assert.equal(result.audit.verdict, "sent"); assert.ok(typeof result.reason === "string" && result.reason.length > 0);
        assert.equal(result.audit.reason, result.reason); noSecret(result); assert.ok(!JSON.stringify(result).includes(body));
    });
}

test("F07-I13 mediated split/encoded reflection is wholly redacted after exactly one approved transport", async () => {
    const fixture = await capability(new OutputFilter()), encoded = partialUrl(SECRET), split = Math.floor(encoded.length / 2); let sent = 0;
    const result = await fixture.broker.call(fixture.input, async () => { sent++; return { status: 201, body: JSON.stringify({ first: encoded.slice(0, split), second: encoded.slice(split) }) }; });
    assert.equal(sent, 1); assert.equal(result.allowed, true); assert.deepEqual(result.response, { status: 201, body: REDACTED });
    assert.equal(result.audit.verdict, "sent"); assert.equal(result.audit.responseScrubbed, true); noSecret(result);
});

test("F07-I14 a clean mediated response preserves the public body and honest sent audit", async () => {
    const fixture = await capability(new OutputFilter()); let sent = 0;
    const result = await fixture.broker.call(fixture.input, async () => { sent++; return { status: 200, body: PUBLIC }; });
    assert.equal(sent, 1); assert.equal(result.allowed, true); assert.deepEqual(result.response, { status: 200, body: PUBLIC });
    assert.equal(result.audit.verdict, "sent"); assert.equal(result.audit.responseScrubbed, false); noSecret(result);
});
