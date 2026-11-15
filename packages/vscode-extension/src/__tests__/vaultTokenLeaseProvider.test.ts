import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { SecretlessOperationBroker, type CredentialLeaseRequest, type OperationBinding } from "../../../core/src/SecretlessOperationBroker";
import { VaultTokenLeaseProvider, parseVaultOperationConfiguration, type VaultHttpRequest, type VaultHttpResponse, type VaultOperationConfiguration } from "../secretless-operations/VaultTokenLeaseProvider";

const BOOTSTRAP = "hvs.synthetic-bootstrap-host-only-17ab9";
const CHILD = "hvs.synthetic-issued-once-lease-5f71c";
const binding: OperationBinding = { sessionId: "session-vault", imageDigest: "a".repeat(64), artifactDigest: "b".repeat(64), policyDigest: "c".repeat(64) };
const config: VaultOperationConfiguration = { schemaVersion: 1, origin: "https://vault.example.com", role: "soterai-read", ttlSeconds: 60,
    expectedPolicies: ["default", "soterai-status-read"], operation: { id: "vault-status", label: "Read Vault health", account: "vault.example.com",
        resource: "/v1/sys/health", url: "https://vault.example.com/v1/sys/health", responseFields: ["initialized", "sealed"] } };
const json = (value: unknown, status = 200): VaultHttpResponse => ({ status, contentType: "application/json", body: Buffer.from(JSON.stringify(value)) });
const issued = () => ({ auth: { client_token: CHILD, lease_duration: 60, renewable: false, num_uses: 1, token_type: "service", policies: ["default", "soterai-status-read"] } });
const request = (): CredentialLeaseRequest => ({ operation: config.operation, binding, operationDigest: createHash("sha256").update(JSON.stringify(config.operation)).digest("hex") });
function fixture() {
    const state = { calls: [] as VaultHttpRequest[], enabled: true, bootstrap: BOOTSTRAP as string | undefined,
        now: 1700000000000, response: json(issued()), revokeRejects: false };
    const provider = new VaultTokenLeaseProvider({ configuration: config, enabled: () => state.enabled, now: () => state.now,
        getBootstrapToken: async () => state.bootstrap, transport: async (input, signal) => {
            state.calls.push(input); assert.equal(signal.aborted, false);
            if (input.url.endsWith("/revoke-self")) { if (state.revokeRejects) throw Error(CHILD); return json(null, 204); }
            if (input.method === "GET") return json({ initialized: true, sealed: false, omitted: "internal-public-field" });
            return state.response;
        } });
    return { provider, state };
}

test("Vault issues an exact role-bound one-use <=120s token and checked GET never uses bootstrap", async () => {
    const f = fixture();
    const broker = new SecretlessOperationBroker({ operations: [config.operation], credentialProvider: f.provider,
        transport: f.provider.readTransport(), isCurrent: () => f.state.enabled, now: () => f.state.now });
    const review = broker.prepareReview(config.operation.id, binding)!; const grant = broker.approve(review)!;
    const result = await broker.execute(grant.id, binding); await new Promise<void>(done => setImmediate(done));
    assert.deepEqual(result, { status: "COMPLETE", operationId: config.operation.id, resource: config.operation.resource, fields: { initialized: true, sealed: false } });
    assert.equal(f.state.calls.length, 3);
    const [issue, read, revoke] = f.state.calls;
    assert.equal(issue.url, config.origin + "/v1/auth/token/create/soterai-read"); assert.equal(issue.method, "POST"); assert.equal(issue.token, BOOTSTRAP);
    assert.deepEqual(JSON.parse(issue.body!), { ttl: "60s", explicit_max_ttl: "60s", num_uses: 1, renewable: false, policies: config.expectedPolicies });
    assert.equal(read.url, config.operation.url); assert.equal(read.method, "GET"); assert.equal(read.body, undefined); assert.equal(read.token, CHILD);
    assert.equal(revoke.url, config.origin + "/v1/auth/token/revoke-self"); assert.equal(revoke.token, CHILD);
    assert.ok(!JSON.stringify(result).includes(BOOTSTRAP) && !JSON.stringify(result).includes(CHILD));
});

test("missing bootstrap, disabled integration and changed operation refuse before issuance", async () => {
    const f = fixture(); f.state.bootstrap = undefined; await assert.rejects(f.provider.acquire(request(), new AbortController().signal));
    f.state.bootstrap = BOOTSTRAP; f.state.enabled = false; await assert.rejects(f.provider.acquire(request(), new AbortController().signal));
    f.state.enabled = true; await assert.rejects(f.provider.acquire({ ...request(), operation: { ...config.operation, resource: "/v1/another" } }, new AbortController().signal));
    assert.equal(f.state.calls.length, 0);
});

for (const kind of ["lifetime", "renewable", "uses", "policies", "token-type", "bootstrap-returned"] as const) {
    test(`issuer ${kind} mismatch never authorizes a read`, async () => {
        const f = fixture(), body = issued();
        if (kind === "lifetime") body.auth.lease_duration = 121;
        if (kind === "renewable") body.auth.renewable = true;
        if (kind === "uses") body.auth.num_uses = 0;
        if (kind === "policies") body.auth.policies = ["default", "root"];
        if (kind === "token-type") body.auth.token_type = "batch";
        if (kind === "bootstrap-returned") body.auth.client_token = BOOTSTRAP;
        f.state.response = json(body); await assert.rejects(f.provider.acquire(request(), new AbortController().signal));
        await new Promise<void>(done => setImmediate(done)); assert.equal(f.state.calls.filter(call => call.method === "GET").length, 0);
        if (kind !== "bootstrap-returned") assert.equal(f.state.calls[1].url, config.origin + "/v1/auth/token/revoke-self");
    });
}

test("issuer lifetime is measured conservatively from issuance start and disposal is idempotent", async () => {
    const f = fixture(), start = f.state.now, lease = await f.provider.acquire(request(), new AbortController().signal);
    assert.equal(lease.credentialExpiresAt, start + 60000); f.state.revokeRejects = true;
    await lease.dispose(); await lease.dispose(); assert.equal(f.state.calls.length, 2);
});

test("Vault read transport refuses a different same-origin path before sending the issued token", async () => {
    const f = fixture(); await assert.rejects(f.provider.readTransport()({ url: config.origin + "/v1/auth/token/lookup-self", bearerToken: CHILD, timeoutMs: 1000, maxResponseBytes: 65536 }, new AbortController().signal));
    assert.equal(f.state.calls.length, 0);
});

test("configuration rejects cross-origin reads, queries, ambiguous paths, roles and excessive TTL", () => {
    assert.ok(parseVaultOperationConfiguration(config));
    for (const changed of [{ ...config, ttlSeconds: 121 }, { ...config, role: "../other" }, { ...config, expectedPolicies: ["root", "root"] },
        { ...config, operation: { ...config.operation, url: "https://other.example.com/v1/sys/health" } },
        { ...config, operation: { ...config.operation, url: config.operation.url + "?standbyok=true" } },
        { ...config, operation: { ...config.operation, resource: "/v1/a/../sys/health", url: config.origin + "/v1/a/../sys/health" } }]) {
        assert.equal(parseVaultOperationConfiguration(changed), undefined);
    }
});
