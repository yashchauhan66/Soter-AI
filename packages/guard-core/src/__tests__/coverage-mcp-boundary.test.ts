import { describe, it } from "node:test";
import assert from "node:assert";
import {
    ROUTE_COVERAGE,
    plaintextSecretCoverage,
} from "../CoverageMatrix";
import {
    evaluateMcpAuth,
    type McpAuthRequest,
} from "../MCPCredentialBoundary";

describe("Scenario B — honest route coverage matrix", () => {
    it("never claims ENFORCED for an unobservable/unenforceable route", () => {
        for (const route of ROUTE_COVERAGE) {
            if (route.level === "ENFORCED") {
                assert.strictEqual(
                    route.observable && route.transformable && route.enforceable,
                    true,
                    `${route.id} claims ENFORCED but is not observable+transformable+enforceable`,
                );
            }
        }
    });

    it("marks unknown extensions/processes as MONITORED, never enforced", () => {
        const unknown = ROUTE_COVERAGE.find((r) => r.id === "unknown-extension")!;
        assert.ok(unknown);
        assert.strictEqual(unknown.level, "MONITORED");
        assert.strictEqual(unknown.enforceable, false);
        assert.match(unknown.note, /cannot/i);
    });

    it("the broker route is the only ENFORCED one and every non-enforceable route has an honest note", () => {
        const enforced = ROUTE_COVERAGE.filter((r) => r.enforceable);
        assert.deepStrictEqual(enforced.map((r) => r.id), ["soterai-broker"]);
        for (const route of ROUTE_COVERAGE.filter((r) => !r.enforceable)) {
            assert.ok(route.note.length > 0, `${route.id} missing a limitation note`);
        }
    });

    it("Scenario B: a plaintext secret on disk is MONITORED, brokered is ENFORCED", () => {
        assert.strictEqual(plaintextSecretCoverage({ migratedToVault: false, brokered: false }).level, "MONITORED");
        assert.strictEqual(plaintextSecretCoverage({ migratedToVault: true, brokered: false }).level, "REDACTED");
        assert.strictEqual(plaintextSecretCoverage({ migratedToVault: false, brokered: true }).level, "ENFORCED");
        // The un-migrated case must be honest that another process can read it.
        assert.match(plaintextSecretCoverage({ migratedToVault: false, brokered: false }).note, /another extension or process/i);
    });
});

function baseReq(overrides: Partial<McpAuthRequest> = {}): McpAuthRequest {
    return {
        server: "payments-mcp",
        resource: "https://api.example.com",
        tokenAudience: "https://api.example.com",
        authorizationUrl: "https://auth.example.com/oauth/authorize",
        tokenPassthrough: false,
        routesCredentialThroughModel: false,
        ...overrides,
    };
}

describe("Scenario D — MCP credential boundary", () => {
    it("asks (not denies) a well-formed flow and reports the trusted domain for consent", () => {
        const result = evaluateMcpAuth(baseReq());
        assert.notStrictEqual(result.verdict, "deny");
        assert.strictEqual(result.trustedDomain, "auth.example.com");
        assert.strictEqual(result.suspiciousDomain, false);
    });

    it("denies credential-in-model-context and token passthrough", () => {
        const inContext = evaluateMcpAuth(baseReq({ routesCredentialThroughModel: true }));
        assert.strictEqual(inContext.verdict, "deny");
        assert.ok(inContext.reasons.some((r) => /model/i.test(r)));

        const passthrough = evaluateMcpAuth(baseReq({ tokenPassthrough: true }));
        assert.strictEqual(passthrough.verdict, "deny");
        assert.ok(passthrough.reasons.some((r) => /passthrough/i.test(r)));
    });

    it("denies audience/resource mismatch (confused deputy)", () => {
        const mismatch = evaluateMcpAuth(baseReq({ tokenAudience: "https://other.example.net" }));
        assert.strictEqual(mismatch.verdict, "deny");
        assert.ok(mismatch.reasons.some((r) => /audience/i.test(r)));
    });

    it("warns on punycode / non-ASCII authorization domains", () => {
        const puny = evaluateMcpAuth(baseReq({ authorizationUrl: "https://xn--pple-43d.com/oauth/authorize" }));
        assert.strictEqual(puny.suspiciousDomain, true);
        assert.ok(puny.reasons.some((r) => /punycode|homograph|look-alike/i.test(r)));
    });

    it("never surfaces a raw credential value in the decision", () => {
        const result = evaluateMcpAuth(baseReq());
        assert.ok(!JSON.stringify(result).toLowerCase().includes("secret"));
    });
});
