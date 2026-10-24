import "./phase2/register.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";
import { OutputFilter } from "../secret-broker/OutputFilter";
import { EnforcedApiCapabilityBroker } from "../secret-broker/EnforcedApiCapability";
import { SecretReferenceManager } from "../secret-broker/SecretReferenceManager";
import type { SecretFinding } from "../secret-broker/types";

// Completion-buffered output only. These fixtures do not execute shell commands,
// intercept native terminals, or claim live interactive passthrough protection.
const SECRET = "synthetic f08 private café 雪 🧭 value";
const PUBLIC = "a simple public note about trees and rain";
const REDACTED = "[REDACTED_SECRET_OUTPUT]";
type Chunk = { channel: "stdout" | "stderr"; bytes: Uint8Array };
type CoreOutputResult = { status: "COMPLETE" | "WITHHELD"; stdout: string; stderr: string; redacted: boolean; exitCode?: number; reason?: string };
type BufferedFilter = OutputFilter & { filterChunks(chunks: readonly Chunk[], knownSecrets?: readonly string[], exitCode?: number): CoreOutputResult };
const bytes = (text: string) => Buffer.from(text, "utf8");
const chunk = (text: string, channel: Chunk["channel"] = "stdout"): Chunk => ({ channel, bytes: bytes(text) });
const noSecret = (value: unknown) => assert.ok(!JSON.stringify(value).includes(SECRET), "Undecided or withheld output must not expose the synthetic registration.");
function chunks(filter: OutputFilter, input: readonly Chunk[], known: readonly string[] = [SECRET], exitCode = 0): CoreOutputResult {
    const actual = filter as BufferedFilter;
    assert.equal(typeof actual.filterChunks, "function", "The existing OutputFilter must expose the completion-buffered pipeline.");
    return actual.filterChunks(input, known, exitCode);
}
function withheld(result: CoreOutputResult): void {
    assert.equal(result.status, "WITHHELD"); assert.equal(result.stdout, ""); assert.equal(result.stderr, ""); assert.equal(result.redacted, false);
    assert.ok(typeof result.reason === "string" && result.reason.length > 0); assert.ok(Object.isFrozen(result)); noSecret(result);
}
function wholeMask(result: CoreOutputResult, stderr = ""): void {
    assert.equal(result.status, "COMPLETE"); assert.equal(result.stdout, REDACTED); assert.equal(result.stderr, stderr);
    assert.equal(result.redacted, true); assert.ok(Object.isFrozen(result)); noSecret(result);
}

test("F08-I01 the existing string filter removes SGR obfuscation before whole-response secret matching", () => {
    const filter = new OutputFilter(), split = Math.floor(SECRET.length / 2);
    const result = filter.filter(SECRET.slice(0, split) + "\x1b[31m" + SECRET.slice(split) + "\x1b[0m", [SECRET]);
    assert.deepEqual(result, { allowed: true, text: REDACTED, reason: "secret_like_output_redacted" }); noSecret(result);
});

test("F08-I02 completed public stdout/stderr preserve Unicode, BOM and normalized line endings while removing SGR and OSC", () => {
    const text = "\ufeffcafé 雪 🧭\r\npublic\tline\n", decorated = "\x1b[32m" + text + "\x1b[0m\x1b]52;c;discarded-payload\x07";
    const input: Chunk[] = [...bytes(decorated)].map(byte => ({ channel: "stdout", bytes: Uint8Array.of(byte) }));
    input.push(chunk("ordinary warning\r\n", "stderr"));
    const result = chunks(new OutputFilter(), input);
    assert.deepEqual(result, { status: "COMPLETE", stdout: text.replace(/\r\n/g, "\n"), stderr: "ordinary warning\n", redacted: false, exitCode: 0 });
    assert.ok(Object.isFrozen(result)); assert.ok(!JSON.stringify(result).includes("discarded-payload"));
    assert.deepEqual(new OutputFilter().filter(decorated), { allowed: true, text: text.replace(/\r\n/g, "\n") });
});

test("F08-I03 all raw and encoded byte split positions remain private until a sanitized completed result", () => {
    const filter = new OutputFilter();
    for (const representation of [SECRET, Buffer.from(SECRET).toString("base64"), encodeURIComponent(SECRET)]) {
        const encoded = bytes(representation);
        for (let split = 0; split <= encoded.length; split++) wholeMask(chunks(filter, [
            { channel: "stdout", bytes: encoded.subarray(0, split) }, { channel: "stdout", bytes: encoded.subarray(split) },
        ]));
    }
});

test("F08-I04 a match across explicit stdout/stderr grouping masks both channels and preserves a nonzero exit code", () => {
    const split = Math.floor(SECRET.length / 2), result = chunks(new OutputFilter(), [chunk(SECRET.slice(0, split)), chunk(SECRET.slice(split), "stderr")], [SECRET], 23);
    wholeMask(result, REDACTED); assert.equal(result.exitCode, 23);
});

test("F08-I05 decoder-emission arrival order is inspected without inventing an arbitrary channel permutation", () => {
    const a = 10, b = 23, filter = new OutputFilter();
    wholeMask(chunks(filter, [chunk(SECRET.slice(0, a)), chunk(SECRET.slice(a, b), "stderr"), chunk(SECRET.slice(b))]), REDACTED);
    const publicResult = chunks(filter, [chunk("public one "), chunk("ordinary warning ", "stderr"), chunk("public two")]);
    assert.equal(publicResult.status, "COMPLETE"); assert.equal(publicResult.stdout, "public one public two"); assert.equal(publicResult.stderr, "ordinary warning ");
});

test("F08-I06 string filtering retains request-local F07 JSON semantic-leaf matching after normalization", () => {
    const filter = new OutputFilter(), encoded = encodeURIComponent(SECRET), split = Math.floor(encoded.length / 2);
    const response = JSON.stringify({ first: encoded.slice(0, split), second: encoded.slice(split) });
    assert.deepEqual(filter.filter("\x1b[34m" + response + "\x1b[0m", [SECRET]), { allowed: true, text: REDACTED, reason: "secret_like_output_redacted" });
    const publicJson = JSON.stringify({ first: "ordinary public text", second: "more useful notes" });
    assert.deepEqual(filter.filter(publicJson, [SECRET]), { allowed: true, text: publicJson });
});

test("F08-I07 legacy sensitive-request checks still apply to normalized public-channel output", () => {
    const result = new OutputFilter().filter("Please pa\x1b[31mste your API key so I can continue.\x1b[0m", [SECRET]);
    assert.equal(result.allowed, false); assert.equal(result.reason, "asks_for_secret"); assert.ok(!result.text.includes("\x1b")); noSecret(result);
});

for (const mode of ["output-off", "output-throws", "matching-off", "matching-throws"] as const) {
    test(`F08-I08-${mode} both real filter entry points withhold without a raw fallback`, () => {
        const filter = new OutputFilter(undefined, {
            matchingEnabled: () => { if (mode === "matching-throws") throw new Error(SECRET); return mode !== "matching-off"; },
            outputRedactorEnabled: () => { if (mode === "output-throws") throw new Error(SECRET); return mode !== "output-off"; },
        });
        const first = chunks(filter, [chunk(PUBLIC)]), second = chunks(filter, [chunk(SECRET)]);
        withheld(first); withheld(second); assert.equal(first.reason, second.reason);
        for (const text of [PUBLIC, SECRET]) { const result = filter.filter(text, [SECRET]); assert.equal(result.allowed, false); assert.ok(result.text !== text); noSecret(result); }
    });
}

test("F08-I09 withdrawal during chunk collection withholds that operation and a fresh operation can resume", () => {
    let checks = 0, withdrawn = false;
    const filter = new OutputFilter(undefined, { matchingEnabled: () => true, outputRedactorEnabled: () => {
        checks++; if (checks >= 4) withdrawn = true; return !withdrawn;
    } });
    const result = chunks(filter, Array.from({ length: 12 }, () => chunk("public note\n"))); withheld(result);
    const fresh = new OutputFilter(undefined, { outputRedactorEnabled: () => true });
    const resumed = chunks(fresh, [chunk(PUBLIC)]); assert.equal(resumed.status, "COMPLETE"); assert.equal(resumed.stdout, PUBLIC);
    assert.equal(result.stdout, "");
});

test("F08-I10 malformed UTF-8 or terminal rewriting withholds the entire result instead of a public prefix", () => {
    const filter = new OutputFilter();
    for (const invalid of [Uint8Array.of(0xf0, 0x9f), Uint8Array.of(0xff), bytes("\r"), bytes("\b"), bytes("\x7f"), bytes("\x1b[2J"),
        bytes("\x1b[31"), bytes("\x1b]0;unfinished"), bytes("\0"), bytes("\u202e")]) {
        withheld(chunks(filter, [chunk(PUBLIC), { channel: "stdout", bytes: invalid }]));
    }
    withheld(chunks(filter, [{ channel: "stdout", bytes: Uint8Array.of(0xc3) }, { channel: "stderr", bytes: Uint8Array.of(0xa9) }]));
});

test("F08-I11 inclusive byte/chunk limits retain long public output while overflow withholds atomically", () => {
    const filter = new OutputFilter(), publicText = "public note\n".repeat(10922) + "publicno";
    assert.equal(Buffer.byteLength(publicText), 131072);
    const complete = chunks(filter, [chunk(publicText)], []); assert.equal(complete.status, "COMPLETE"); assert.equal(complete.stdout, publicText);
    withheld(chunks(filter, [chunk(publicText), chunk("x")], []));
    const empty = Array.from({ length: 4096 }, () => chunk("")); assert.equal(chunks(filter, empty, []).status, "COMPLETE");
    withheld(chunks(filter, [...empty, chunk("")], []));
});

test("F08-I12 string input is validated losslessly rather than repaired from invalid JavaScript surrogates", () => {
    const filter = new OutputFilter();
    for (const text of ["public\ud800tail", "\udc00public"]) { const result = filter.filter(text, [SECRET]); assert.equal(result.allowed, false); assert.ok(!result.text.includes("\ufffd")); noSecret(result); }
    const original = "\ufeffpublic café 雪 🧭"; assert.deepEqual(filter.filter(original, [SECRET]), { allowed: true, text: original });
});

async function capability(filter: OutputFilter) {
    const values = new Map<string, string>(), refs = new SecretReferenceManager({ get: async key => values.get(key),
        set: async (key, value) => { values.set(key, value); }, delete: async key => { values.delete(key); }, clear: async () => { values.clear(); } });
    const finding: SecretFinding = { type: "api_key", value: SECRET, start: 0, end: SECRET.length, label: "SYNTHETIC_F08_KEY", source: "synthetic-fixture",
        sensitivity: "critical", allowedOperations: ["call_api_with_secret", "inspect_secret_metadata"] };
    const meta = await refs.create({ finding, workspace: "synthetic-f08", ttlMs: 60_000 });
    const broker = new EnforcedApiCapabilityBroker(refs, filter), grant = broker.grant({ secretRef: meta.ref, workspace: "synthetic-f08",
        scope: { host: "f08.invalid", method: "POST", pathPrefix: "/v1/sample" }, ttlMs: 60_000 });
    return { broker, input: { handle: grant.handle, workspace: "synthetic-f08", method: "POST", url: "https://f08.invalid/v1/sample" } };
}

for (const mode of ["withdrawn", "invalid-control"] as const) {
    test(`F08-I13-${mode} an actual mediated transport completion is audited sent but releases no response`, async () => {
        const fixture = await capability(new OutputFilter(undefined, { outputRedactorEnabled: () => mode !== "withdrawn" })); let sent = 0;
        const body = mode === "withdrawn" ? PUBLIC : PUBLIC + "\x1b[2J";
        const result = await fixture.broker.call(fixture.input, async request => { sent++; assert.equal(request.headers.authorization, `Bearer ${SECRET}`); return { status: 200, body }; });
        assert.equal(sent, 1); assert.equal(result.allowed, false); assert.equal(Object.hasOwn(result, "response"), false);
        assert.equal(result.audit.verdict, "sent"); assert.ok(result.reason && result.audit.reason === result.reason); noSecret(result);
    });
}

test("F08-I14 mediated ANSI-obfuscated reflection is wholly redacted through the actual response filter", async () => {
    const fixture = await capability(new OutputFilter()), split = Math.floor(SECRET.length / 2); let sent = 0;
    const result = await fixture.broker.call(fixture.input, async () => { sent++; return { status: 202, body: SECRET.slice(0, split) + "\x1b[31m" + SECRET.slice(split) + "\x1b[0m" }; });
    assert.equal(sent, 1); assert.equal(result.allowed, true); assert.deepEqual(result.response, { status: 202, body: REDACTED });
    assert.equal(result.audit.verdict, "sent"); assert.equal(result.audit.responseScrubbed, true); noSecret(result);
});
