import assert from "node:assert/strict";
import { test } from "node:test";
import { SecretlessOperationBroker, parseFixedJsonGetOperation, parseOperationBinding, SECRETLESS_OPERATION_LIMITS,
    type CredentialLease, type CredentialLeaseRequest, type FixedJsonGetOperation, type OperationBinding } from "../../../core/src/SecretlessOperationBroker";
import type { FixedJsonGetRequest, FixedJsonGetResponse } from "../../../core/src/FixedHttpsJsonGet";

const TOKEN = "synthetic-ephemeral-bearer-only-A1b2c3d4";
const PRIVATE = "synthetic-existing-vault-value-Z8h2k6";
const binding: OperationBinding = Object.freeze({ sessionId: "session-one", imageDigest: "sha256:" + "a".repeat(64), artifactDigest: "b".repeat(64), policyDigest: "c".repeat(64) });
const operation: FixedJsonGetOperation = Object.freeze({ id: "read-widget-status", label: "Read widget status", account: "account-one", resource: "widget-one",
    url: "https://api.operations.example/accounts/account-one/widgets/widget-one", responseFields: Object.freeze(["state", "count"]) });
const response = (body: unknown): FixedJsonGetResponse => ({ statusCode: 200, contentType: "application/json", contentEncoding: "identity", body: Buffer.from(JSON.stringify(body)) });
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
const tick = () => new Promise<void>(done => setImmediate(done));
function fixture(timeout = 1000) {
    const state = { now: 1700000000000, current: true, disposals: 0, calls: [] as FixedJsonGetRequest[], acquisitions: [] as CredentialLeaseRequest[],
        acquireHold: undefined as ReturnType<typeof deferred<CredentialLease>> | undefined,
        responseHold: undefined as ReturnType<typeof deferred<FixedJsonGetResponse>> | undefined,
        response: response({ state: "ready", count: 2, internalDiagnostic: "omit-this" }),
        leaseChange: undefined as ((lease: CredentialLease) => CredentialLease) | undefined,
        transportError: undefined as Error | undefined, acquisitionSignals: [] as AbortSignal[], transportSignals: [] as AbortSignal[] };
    const makeLease = (request: CredentialLeaseRequest): CredentialLease => ({ bearerToken: TOKEN, credentialExpiresAt: state.now + 10000,
        operationDigest: request.operationDigest, account: request.operation.account, resource: request.operation.resource,
        outputSecretValues: [PRIVATE], dispose() { state.disposals++; } });
    const broker = new SecretlessOperationBroker({ operations: [operation], now: () => state.now, requestTimeoutMs: timeout,
        isCurrent: selected => state.current && JSON.stringify(selected) === JSON.stringify(binding),
        credentialProvider: { async acquire(request, signal) {
            state.acquisitions.push(request); state.acquisitionSignals.push(signal);
            if (state.acquireHold) return state.acquireHold.promise;
            const lease = makeLease(request); return state.leaseChange ? state.leaseChange(lease) : lease;
        } },
        transport: async (request, signal) => {
            state.calls.push(request); state.transportSignals.push(signal); if (state.transportError) throw state.transportError;
            return state.responseHold ? state.responseHold.promise : state.response;
        },
    });
    const grant = () => { const review = broker.prepareReview(operation.id, binding); assert.ok(review); const grant = broker.approve(review); assert.ok(grant); return grant; };
    return { broker, state, grant, makeLease };
}
function noSecrets(value: unknown): void { const text = JSON.stringify(value); assert.ok(!text.includes(TOKEN) && !text.includes(PRIVATE)); }

test("one fixed approved GET returns only named scalar fields and disposes its issuer lease", async () => {
    const f = fixture(), grant = f.grant(), result = await f.broker.execute(grant.id, binding);
    assert.deepEqual(result, { status: "COMPLETE", operationId: operation.id, resource: operation.resource, fields: { state: "ready", count: 2 } });
    assert.equal(f.state.calls.length, 1); assert.equal(f.state.calls[0].url, operation.url); assert.equal(f.state.calls[0].bearerToken, TOKEN);
    assert.equal(f.state.acquisitions[0].operationDigest, grant.operationDigest); assert.deepEqual(f.state.acquisitions[0].binding, binding);
    assert.equal(f.state.disposals, 1); noSecrets(grant); noSecrets(result); noSecrets(f.broker);
    assert.deepEqual(await f.broker.execute(grant.id, binding), { status: "WITHHELD" }); assert.equal(f.state.calls.length, 1);
});

test("review handles require exact prepared identity and expire separately from grants", () => {
    const f = fixture(), review = f.broker.prepareReview(operation.id, binding)!;
    assert.equal(f.broker.approve({ ...review }), undefined); assert.ok(f.broker.approve(review)); assert.equal(f.broker.approve(review), undefined);
    const next = f.broker.prepareReview(operation.id, binding)!; f.state.now += SECRETLESS_OPERATION_LIMITS.reviewMs;
    assert.equal(f.broker.approve(next), undefined); assert.equal(f.state.acquisitions.length, 0);
});

for (const field of ["sessionId", "imageDigest", "artifactDigest", "policyDigest"] as const) {
    test(`grant rejects changed ${field} before credential access`, async () => {
        const f = fixture(), grant = f.grant(), value = field === "sessionId" ? "session-two" : field === "imageDigest" ? "sha256:" + "d".repeat(64) : "d".repeat(64);
        assert.deepEqual(await f.broker.execute(grant.id, { ...binding, [field]: value }), { status: "WITHHELD" });
        assert.deepEqual(await f.broker.execute(grant.id, binding), { status: "WITHHELD" }); assert.equal(f.state.acquisitions.length, 0);
    });
}

test("grant expiration and host policy withdrawal prevent upstream access", async () => {
    const f = fixture(), expired = f.grant(); f.state.now += SECRETLESS_OPERATION_LIMITS.grantMs;
    assert.deepEqual(await f.broker.execute(expired.id, binding), { status: "WITHHELD" });
    const withdrawn = f.grant(); f.state.current = false;
    assert.deepEqual(await f.broker.execute(withdrawn.id, binding), { status: "WITHHELD" }); assert.equal(f.state.acquisitions.length, 0);
});

test("upstream credential expiry and scope must be independently attested by the provider", async () => {
    for (const change of ["expired", "static", "too-long", "account", "resource", "operation", "header"] as const) {
        const f = fixture();
        f.state.leaseChange = lease => ({ ...lease, ...(change === "expired" ? { credentialExpiresAt: f.state.now } : change === "static" ? { credentialExpiresAt: Infinity }
            : change === "too-long" ? { credentialExpiresAt: f.state.now + SECRETLESS_OPERATION_LIMITS.credentialMaxMs + 1 }
            : change === "account" ? { account: "different-account" } : change === "resource" ? { resource: "different-resource" }
            : change === "operation" ? { operationDigest: "f".repeat(64) } : { bearerToken: TOKEN + "\r\nInjected: value" }) });
        assert.deepEqual(await f.broker.execute(f.grant().id, binding), { status: "WITHHELD" });
        assert.equal(f.state.calls.length, 0); assert.equal(f.state.disposals, 1);
    }
});

test("credential expiration while transport is pending withholds an otherwise public result", async () => {
    const f = fixture(), held = deferred<FixedJsonGetResponse>(); f.state.responseHold = held;
    const run = f.broker.execute(f.grant().id, binding); await tick(); f.state.now += 10001; held.resolve(response({ state: "ready", count: 2 }));
    assert.deepEqual(await run, { status: "WITHHELD" }); assert.equal(f.state.disposals, 1);
});

for (const representation of [TOKEN, Buffer.from(TOKEN).toString("base64"), Buffer.from(TOKEN).toString("hex"), PRIVATE] as const) {
    test(`credential/registered output is withheld for representation length ${representation.length}`, async () => {
        const f = fixture(); f.state.response = response({ state: "ready", count: 2, excluded: representation });
        const result = await f.broker.execute(f.grant().id, binding); assert.deepEqual(result, { status: "WITHHELD" }); noSecrets(result);
    });
}

test("JSON-escaped credential fragments across fields and short output registrations are withheld", async () => {
    const f = fixture(); f.state.response = response({ state: TOKEN.slice(0, 20), count: 2, remaining: TOKEN.slice(20) });
    assert.deepEqual(await f.broker.execute(f.grant().id, binding), { status: "WITHHELD" });
    f.state.leaseChange = lease => ({ ...lease, outputSecretValues: ["qZ4"] }); f.state.response = response({ state: "ordinary", count: 1 });
    assert.deepEqual(await f.broker.execute(f.grant().id, binding), { status: "WITHHELD" }); assert.equal(f.state.calls.length, 1);
});

test("response bounds, duplicate fields, missing fields, nested permitted values and redirect responses refuse", async () => {
    const invalid = [response({ state: "ready" }), response({ state: { nested: "not-a-scalar" }, count: 2 }),
        { ...response({ state: "ready", count: 2 }), statusCode: 302 }, { ...response({ state: "ready", count: 2 }), contentEncoding: "gzip" },
        { ...response({ state: "ready", count: 2 }), body: Buffer.from('{"state":"one","state":"two","count":2}') },
        { ...response({ state: "ready", count: 2 }), body: Buffer.alloc(65537, 32) }];
    for (const candidate of invalid) { const f = fixture(); f.state.response = candidate; assert.deepEqual(await f.broker.execute(f.grant().id, binding), { status: "WITHHELD" }); }
});

test("session revocation aborts issuer acquisition, disposes a late lease and stays revoked", async () => {
    const f = fixture(), held = deferred<CredentialLease>(); f.state.acquireHold = held;
    const run = f.broker.execute(f.grant().id, binding); await tick(); f.broker.revokeSession(binding.sessionId);
    assert.deepEqual(await run, { status: "WITHHELD" }); assert.equal(f.state.acquisitionSignals[0].aborted, true);
    held.resolve(f.makeLease(f.state.acquisitions[0])); await tick(); assert.equal(f.state.disposals, 1); assert.equal(f.state.calls.length, 0);
    assert.equal(f.broker.prepareReview(operation.id, binding), undefined);
});

test("cancellation or disposal during a pending request cannot release its late response", async () => {
    for (const action of ["cancel", "dispose"] as const) {
        const f = fixture(), held = deferred<FixedJsonGetResponse>(), controller = new AbortController(); f.state.responseHold = held;
        const run = f.broker.execute(f.grant().id, binding, controller.signal); await tick();
        if (action === "cancel") controller.abort(); else f.broker.dispose();
        assert.deepEqual(await run, { status: "WITHHELD" }); assert.equal(f.state.transportSignals[0].aborted, true);
        held.resolve(response({ state: "ready", count: 2 })); await tick(); assert.equal(f.state.disposals, 1);
    }
});

test("concurrent reuse consumes exactly once before awaiting the issuer", async () => {
    const f = fixture(), held = deferred<CredentialLease>(); f.state.acquireHold = held; const grant = f.grant();
    const first = f.broker.execute(grant.id, binding), second = f.broker.execute(grant.id, binding);
    assert.deepEqual(await second, { status: "WITHHELD" }); assert.equal(f.state.acquisitions.length, 1);
    held.resolve(f.makeLease(f.state.acquisitions[0])); assert.equal((await first).status, "COMPLETE");
});

test("stalled issuer calls time out and retain a bounded outstanding-work admission limit", { timeout: 2000 }, async () => {
    const f = fixture(20), held = deferred<CredentialLease>(); f.state.acquireHold = held;
    const alive = setTimeout(() => {}, 500);
    try {
        const runs = Array.from({ length: SECRETLESS_OPERATION_LIMITS.active }, () => f.broker.execute(f.grant().id, binding));
        for (const result of await Promise.all(runs)) assert.deepEqual(result, { status: "WITHHELD" });
        assert.deepEqual(await f.broker.execute(f.grant().id, binding), { status: "WITHHELD" }); assert.equal(f.state.acquisitions.length, 4);
    } finally { clearTimeout(alive); f.broker.dispose(); held.resolve(f.makeLease(f.state.acquisitions[0])); }
});

test("generic exceptions and metadata never reveal credential text", async () => {
    const f = fixture(); f.state.transportError = Error(TOKEN + PRIVATE);
    const result = await f.broker.execute(f.grant().id, binding); assert.deepEqual(result, { status: "WITHHELD" }); noSecrets(result);
    noSecrets(f.broker.operations()); noSecrets(f.broker); assert.equal(f.state.disposals, 1);
});

test("untrusted URL overrides, added request fields and accessor binding properties refuse", () => {
    for (const url of ["http://api.operations.example/x", "https://user:password@api.operations.example/x", "https://api.operations.example/x?token=x",
        "https://localhost/x", "https://127.0.0.1/x", "https://api.operations.example:9443/x", "https://api.operations.example/x#fragment"]) {
        assert.equal(parseFixedJsonGetOperation({ ...operation, url }), undefined);
    }
    assert.equal(parseFixedJsonGetOperation({ ...operation, method: "POST" }), undefined);
    let reads = 0; const hostile = { ...binding }; Object.defineProperty(hostile, "policyDigest", { enumerable: true, get() { reads++; return binding.policyDigest; } });
    assert.equal(parseOperationBinding(hostile), undefined); assert.equal(reads, 0);
});
