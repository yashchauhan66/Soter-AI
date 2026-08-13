import { test } from "node:test";
import assert from "node:assert/strict";
import { BrokerClient, BrokerHttpError } from "../BrokerClient";
import { brokerBackedProfile, AdapterProfile } from "../featureFlags";
import { CANARY_TOKEN, isCanaryContained, stubScanResponse } from "../fixtures";
import { GuardFeature } from "@soterai/ide-protocol";

function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
    });
}

test("client refuses a non-loopback base URL", () => {
    assert.throws(() => new BrokerClient({ baseUrl: "http://evil.example.com" }), /non-loopback/);
});

test("scan sends bearer token and returns the decision", async () => {
    let seenAuth: string | null = null;
    const fetchImpl = (async (_url, init) => {
        seenAuth = (init?.headers as Record<string, string>).authorization;
        return jsonResponse(stubScanResponse({ decision: "redact", redacted: true, riskScore: 40 }));
    }) as typeof fetch;
    const client = new BrokerClient({ token: "x".repeat(40), fetchImpl });
    const result = await client.scanText("hello");
    assert.equal(seenAuth, `Bearer ${"x".repeat(40)}`);
    assert.equal(result.decision, "redact");
    assert.equal(result.riskScore, 40);
});

test("scan requires content or messages", async () => {
    const client = new BrokerClient({ token: "x".repeat(40), fetchImpl: (async () => jsonResponse({})) as typeof fetch });
    await assert.rejects(async () => client.scan({}), /requires content or/);
});

test("health returns false when the broker is unreachable", async () => {
    const fetchImpl = (async () => {
        throw new Error("ECONNREFUSED");
    }) as typeof fetch;
    const client = new BrokerClient({ fetchImpl });
    assert.equal(await client.isHealthy(), false);
});

test("http errors surface the broker error code", async () => {
    const fetchImpl = (async () =>
        jsonResponse({ error: { code: "unauthorized", message: "bad token" } }, 401)) as typeof fetch;
    const client = new BrokerClient({ token: "x".repeat(40), fetchImpl });
    await assert.rejects(() => client.scanText("hi"), (e: unknown) => e instanceof BrokerHttpError && e.code === "unauthorized");
});

test("auth is required for scan when no token is set", async () => {
    const client = new BrokerClient({ fetchImpl: (async () => jsonResponse({})) as typeof fetch });
    await assert.rejects(() => client.scanText("hi"), /token is not configured/);
});

test("adapter profile reports broker-backed usability", () => {
    const profile = brokerBackedProfile("test");
    assert.ok(profile instanceof AdapterProfile);
    assert.ok(profile.isUsable(GuardFeature.ScanSelection));
    assert.equal(profile.support(GuardFeature.McpScanner), "not-possible");
});

test("canary helper detects a leaked token", () => {
    assert.equal(isCanaryContained("clean report"), true);
    assert.equal(isCanaryContained(`oops ${CANARY_TOKEN}`), false);
});

test("checkEgress posts to the preflight route with auth and returns the action", async () => {
    let seenUrl = "";
    let seenBody: Record<string, unknown> = {};
    const fetchImpl = (async (url, init) => {
        seenUrl = String(url);
        seenBody = JSON.parse(String(init?.body));
        return jsonResponse({
            action: "DENY", riskScore: 90, coverageLevel: "STRONG_ENFORCEMENT",
            destinationTrust: "untrusted", reasonCodes: ["SECRET_IN_PAYLOAD"],
            categories: ["secret_exfiltration"], explanation: "blocked", deterministic: true,
        });
    }) as typeof fetch;
    const client = new BrokerClient({ token: "x".repeat(40), fetchImpl });
    const decision = await client.checkEgress({ url: "https://evil.example.com/collect", payloadPreview: "sk-live-abc" });

    assert.equal(seenUrl, "http://127.0.0.1:47321/v1/preflight/network-egress");
    assert.equal(seenBody.url, "https://evil.example.com/collect");
    assert.equal(decision.action, "DENY");
    assert.equal(decision.destinationTrust, "untrusted");
});

test("checkEgress requires a url rather than sending an empty preflight", async () => {
    const client = new BrokerClient({ token: "x".repeat(40), fetchImpl: (async () => jsonResponse({})) as typeof fetch });
    await assert.rejects(async () => client.checkEgress({ url: "" }), /requires a url/);
});

test("checkEgress surfaces broker unreachability instead of failing open", async () => {
    // A thrown error is correct here: swallowing it would let a caller treat an
    // unreachable broker as a cleared send.
    const fetchImpl = (async () => { throw new Error("ECONNREFUSED"); }) as typeof fetch;
    const client = new BrokerClient({ token: "x".repeat(40), fetchImpl });
    await assert.rejects(async () => client.checkEgress({ url: "https://api.openai.com/v1/chat" }), /not reachable/);
});

test("every broker-backed adapter declares the egress firewall as usable", () => {
    const profile = brokerBackedProfile("neovim");
    assert.equal(profile.isUsable(GuardFeature.EgressFirewall), true);
});
