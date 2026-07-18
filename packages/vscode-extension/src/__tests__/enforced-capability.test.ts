import { describe, it } from "node:test";
import assert from "node:assert";
import { SecretReferenceManager } from "../secret-broker/SecretReferenceManager";
import {
    EnforcedApiCapabilityBroker,
    type CapabilityTransport,
    type TransportRequest,
} from "../secret-broker/EnforcedApiCapability";
import { type SecretFinding } from "../secret-broker/types";

const workspace = "ws-a";
const otherWorkspace = "ws-b";
const API_SECRET = "sk-live-canary-9f2a7c41e8b3d05f6a1c2e3b4d5f6a7b";

function apiFinding(value = API_SECRET): SecretFinding {
    return {
        type: "api_key",
        value,
        start: 0,
        end: value.length,
        label: "PAYMENTS_API_KEY",
        source: ".env",
        sensitivity: "critical",
        allowedOperations: ["call_api_with_secret", "inspect_secret_metadata"],
    };
}

/** Records what actually hit the wire so tests can assert the header + no-leak. */
function recordingTransport(status = 200, body = '{"ok":true}'): {
    transport: CapabilityTransport;
    seen: TransportRequest[];
} {
    const seen: TransportRequest[] = [];
    const transport: CapabilityTransport = async (req) => {
        seen.push(req);
        return { status, body };
    };
    return { transport, seen };
}

async function grantFor(refs: SecretReferenceManager, broker: EnforcedApiCapabilityBroker, opts?: { maxUses?: number; ttlMs?: number }) {
    const meta = await refs.create({ finding: apiFinding(), workspace, ttlMs: 60_000 });
    return broker.grant({
        secretRef: meta.ref,
        workspace,
        scope: { host: "api.example.com", method: "POST", pathPrefix: "/v1/charges" },
        ttlMs: opts?.ttlMs ?? 60_000,
        maxUses: opts?.maxUses ?? 1,
        operation: "call_api_with_secret",
    });
}

describe("Enforced API capability — Scenario A", () => {
    it("injects the credential locally for the approved host/method/path and never exposes it to the caller", async () => {
        const refs = new SecretReferenceManager();
        const broker = new EnforcedApiCapabilityBroker(refs);
        const grant = await grantFor(refs, broker);
        const { transport, seen } = recordingTransport();

        const result = await broker.call(
            { handle: grant.handle, workspace, method: "POST", url: "https://api.example.com/v1/charges", body: "{}" },
            transport,
        );

        assert.strictEqual(result.allowed, true);
        // The credential reached the wire, in the Authorization header only.
        assert.strictEqual(seen.length, 1);
        assert.strictEqual(seen[0].headers["authorization"], `Bearer ${API_SECRET}`);
        // The handle is not the secret, and the secret never appears in the result.
        assert.ok(!grant.handle.includes(API_SECRET));
        assert.ok(!JSON.stringify(result).includes(API_SECRET));
        assert.strictEqual(result.audit.verdict, "sent");
    });

    it("blocks wrong host, wrong method, and out-of-scope path", async () => {
        const refs = new SecretReferenceManager();
        const broker = new EnforcedApiCapabilityBroker(refs);
        const { transport, seen } = recordingTransport();

        const g1 = await grantFor(refs, broker, { maxUses: 5 });
        const wrongHost = await broker.call({ handle: g1.handle, workspace, method: "POST", url: "https://evil.example.net/v1/charges" }, transport);
        assert.strictEqual(wrongHost.allowed, false);
        assert.match(wrongHost.reason!, /host not in/);

        const g2 = await grantFor(refs, broker, { maxUses: 5 });
        const wrongMethod = await broker.call({ handle: g2.handle, workspace, method: "GET", url: "https://api.example.com/v1/charges" }, transport);
        assert.strictEqual(wrongMethod.allowed, false);
        assert.match(wrongMethod.reason!, /method not in/);

        const g3 = await grantFor(refs, broker, { maxUses: 5 });
        const wrongPath = await broker.call({ handle: g3.handle, workspace, method: "POST", url: "https://api.example.com/v1/refunds" }, transport);
        assert.strictEqual(wrongPath.allowed, false);
        assert.match(wrongPath.reason!, /path not in/);

        // Nothing was ever sent for a blocked call → credential never left.
        assert.strictEqual(seen.length, 0);
    });

    it("blocks plaintext http even for the right host", async () => {
        const refs = new SecretReferenceManager();
        const broker = new EnforcedApiCapabilityBroker(refs);
        const grant = await grantFor(refs, broker);
        const { transport } = recordingTransport();
        const res = await broker.call({ handle: grant.handle, workspace, method: "POST", url: "http://api.example.com/v1/charges" }, transport);
        assert.strictEqual(res.allowed, false);
        assert.match(res.reason!, /https/);
    });

    it("enforces use limit (replay past maxUses fails)", async () => {
        const refs = new SecretReferenceManager();
        const broker = new EnforcedApiCapabilityBroker(refs);
        const grant = await grantFor(refs, broker, { maxUses: 1 });
        const { transport } = recordingTransport();
        const first = await broker.call({ handle: grant.handle, workspace, method: "POST", url: "https://api.example.com/v1/charges" }, transport);
        const second = await broker.call({ handle: grant.handle, workspace, method: "POST", url: "https://api.example.com/v1/charges" }, transport);
        assert.strictEqual(first.allowed, true);
        assert.strictEqual(second.allowed, false);
        assert.match(second.reason!, /use limit/);
    });

    it("fails on expiry", async () => {
        const refs = new SecretReferenceManager();
        const broker = new EnforcedApiCapabilityBroker(refs);
        const grant = await grantFor(refs, broker, { ttlMs: 1, maxUses: 5 });
        await new Promise((r) => setTimeout(r, 5));
        const { transport } = recordingTransport();
        const res = await broker.call({ handle: grant.handle, workspace, method: "POST", url: "https://api.example.com/v1/charges" }, transport);
        assert.strictEqual(res.allowed, false);
        assert.match(res.reason!, /expired/);
    });

    it("fails after revocation and on workspace mismatch", async () => {
        const refs = new SecretReferenceManager();
        const broker = new EnforcedApiCapabilityBroker(refs);
        const { transport } = recordingTransport();

        const g1 = await grantFor(refs, broker, { maxUses: 5 });
        assert.strictEqual(broker.revoke(g1.handle), true);
        const revoked = await broker.call({ handle: g1.handle, workspace, method: "POST", url: "https://api.example.com/v1/charges" }, transport);
        assert.strictEqual(revoked.allowed, false);
        assert.match(revoked.reason!, /revoked/);

        const g2 = await grantFor(refs, broker, { maxUses: 5 });
        const crossWs = await broker.call({ handle: g2.handle, workspace: otherWorkspace, method: "POST", url: "https://api.example.com/v1/charges" }, transport);
        assert.strictEqual(crossWs.allowed, false);
        assert.match(crossWs.reason!, /workspace mismatch/);
    });

    it("emergency lockdown revokes every active capability at once", async () => {
        const refs = new SecretReferenceManager();
        const broker = new EnforcedApiCapabilityBroker(refs);
        const { transport } = recordingTransport();
        const g1 = await grantFor(refs, broker, { maxUses: 5 });
        const g2 = await grantFor(refs, broker, { maxUses: 5 });
        assert.strictEqual(broker.activeCount(), 2);

        const revoked = broker.revokeAll();
        assert.strictEqual(revoked, 2);
        assert.strictEqual(broker.activeCount(), 0);

        const r1 = await broker.call({ handle: g1.handle, workspace, method: "POST", url: "https://api.example.com/v1/charges" }, transport);
        const r2 = await broker.call({ handle: g2.handle, workspace, method: "POST", url: "https://api.example.com/v1/charges" }, transport);
        assert.strictEqual(r1.allowed, false);
        assert.strictEqual(r2.allowed, false);
        assert.match(r1.reason!, /revoked/);
    });

    it("scans the response so a service cannot echo the secret back into AI context", async () => {
        const refs = new SecretReferenceManager();
        const broker = new EnforcedApiCapabilityBroker(refs);
        const grant = await grantFor(refs, broker);
        // Malicious/misconfigured service reflects the secret in its response body.
        const echo: CapabilityTransport = async () => ({ status: 200, body: `{"echo":"${API_SECRET}"}` });
        const res = await broker.call({ handle: grant.handle, workspace, method: "POST", url: "https://api.example.com/v1/charges" }, echo);
        assert.strictEqual(res.allowed, true);
        assert.ok(!res.response!.body.includes(API_SECRET), "secret must be scrubbed from the response");
        assert.strictEqual(res.audit.responseScrubbed, true);
    });

    it("metadata never leaks the secretRef mapping to a value", async () => {
        const refs = new SecretReferenceManager();
        const broker = new EnforcedApiCapabilityBroker(refs);
        const grant = await grantFor(refs, broker);
        const meta = broker.metadata(grant.handle)!;
        assert.ok(!("secretRef" in meta));
        assert.ok(!JSON.stringify(meta).includes(API_SECRET));
        assert.strictEqual(meta.scope.host, "api.example.com");
    });

    it("unknown handle fails closed", async () => {
        const refs = new SecretReferenceManager();
        const broker = new EnforcedApiCapabilityBroker(refs);
        const { transport } = recordingTransport();
        const res = await broker.call({ handle: "soter-cap-nope", workspace, method: "POST", url: "https://api.example.com/v1/charges" }, transport);
        assert.strictEqual(res.allowed, false);
        assert.match(res.reason!, /unknown capability handle/);
    });
});
