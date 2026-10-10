import assert from "node:assert/strict";
import test from "node:test";
import { randomBytes } from "node:crypto";
import { EnforcedApiCapabilityBroker, type CapabilityTransport } from "../secret-broker/EnforcedApiCapability";
import { SecretReferenceManager } from "../secret-broker/SecretReferenceManager";

async function fixture() {
    const secret = "private memo " + randomBytes(12).toString("hex").match(/.{4}/g)!.join(" ");
    const refs = new SecretReferenceManager();
    const meta = await refs.create({ workspace: "fixture", ttlMs: 60_000, finding: {
        value: secret, type: "password", start: 0, end: secret.length, label: "Synthetic protected text",
        sensitivity: "critical", allowedOperations: ["call_api_with_secret"],
    } });
    const broker = new EnforcedApiCapabilityBroker(refs);
    const input = { secretRef: meta.ref, workspace: "fixture", ttlMs: 60_000,
        scope: { host: "service.invalid", method: "POST", pathPrefix: "/v1/private" }, maxUses: 10 };
    const grant = broker.grant(input);
    const call = (url: string, transport: CapabilityTransport) => broker.call({ handle: grant.handle, workspace: "fixture", method: "POST", url }, transport);
    return { secret, refs, meta, broker, input, grant, call };
}

test("capabilities reject alternate ports, ambiguous paths and URL credentials before credential injection", async () => {
    const f = await fixture();
    let calls = 0;
    for (const url of ["https://service.invalid:8443/v1/private", "https://service.invalid/v1/private-extra",
        "https://user:password@service.invalid/v1/private", "https://service.invalid/v1/private/%2e%2e/public"]) {
        const result = await f.call(url, async () => { calls++; return { status: 200, body: "Public response." }; });
        assert.equal(result.allowed, false, url);
    }
    assert.equal(calls, 0);
});

test("a returned grant cannot be modified to widen destination or replay limits", async () => {
    const f = await fixture();
    f.grant.scope.host = "attacker.invalid";
    f.grant.maxUses = Infinity;
    const result = await f.call("https://attacker.invalid/v1/private", async () => { throw new Error("must never run"); });
    assert.equal(result.allowed, false);
    assert.equal(f.broker.metadata(f.grant.handle)?.scope.host, "service.invalid");
});

test("arbitrary known secrets are withheld on raw, encoded, escaped or split JSON echoes", async () => {
    for (const encode of [(s: string) => s, (s: string) => Buffer.from(s).toString("base64"),
        (s: string) => Buffer.from(s).toString("hex"), (s: string) => encodeURIComponent(s),
        (s: string) => JSON.stringify({ chunks: [s.slice(0, 15), s.slice(15)] })]) {
        const f = await fixture();
        const echo = encode(f.secret);
        const result = await f.call("https://service.invalid/v1/private", async () => ({ status: 200, body: echo }));
        assert.ok(!result.response?.body.includes(echo), "known-secret echo reached caller");
        assert.equal(result.audit.responseScrubbed, true);
    }
});

test("transport exceptions cannot echo a protected value into reasons or audit", async () => {
    const f = await fixture();
    const result = await f.call("https://service.invalid/v1/private", async () => { throw new Error(f.secret); });
    assert.equal(result.allowed, false);
    assert.ok(!JSON.stringify(result).includes(f.secret));
});

test("invalid grant lifetimes and use counts cannot create immortal or unlimited grants", async () => {
    const f = await fixture();
    for (const ttlMs of [NaN, Infinity, -1, 0]) assert.throws(() => f.broker.grant({ ...f.input, ttlMs }));
    for (const maxUses of [NaN, Infinity, -1, 0, 1.5]) assert.throws(() => f.broker.grant({ ...f.input, maxUses }));
});

test("revoking or clearing authority while storage is pending prevents transport", async () => {
    for (const revoke of ["reference", "grant", "clear"]) {
        let release!: (value: string) => void;
        let entered!: () => void;
        const reading = new Promise<void>(resolve => { entered = resolve; });
        const refs = new SecretReferenceManager({
            set: async () => {}, delete: async () => {},
            get: async () => { entered(); return new Promise<string>(resolve => { release = resolve; }); },
        });
        const meta = await refs.create({ workspace: "fixture", ttlMs: 60_000, finding: {
            value: "synthetic pending value", type: "password", start: 0, end: 23, label: "Synthetic",
            sensitivity: "critical", allowedOperations: ["call_api_with_secret"],
        } });
        const broker = new EnforcedApiCapabilityBroker(refs);
        const grant = broker.grant({ secretRef: meta.ref, workspace: "fixture", ttlMs: 60_000,
            scope: { host: "service.invalid", method: "POST", pathPrefix: "/v1/private" } });
        let transports = 0;
        const pending = broker.call({ handle: grant.handle, workspace: "fixture", method: "POST", url: "https://service.invalid/v1/private" },
            async () => { transports++; return { status: 200, body: "public" }; });
        await reading;
        if (revoke === "reference") await refs.revoke(meta.ref);
        else if (revoke === "clear") await refs.clear("fixture");
        else broker.revoke(grant.handle);
        release("synthetic pending value");
        assert.equal((await pending).allowed, false);
        assert.equal(transports, 0);
    }
});
