import test from "node:test";
import assert from "node:assert/strict";
import { RuntimePolicyEngine } from "../RuntimePolicyEngine";

test("RuntimePolicyEngine denies raw credential exposure before execution", () => {
    const decision = new RuntimePolicyEngine().evaluate({
        actionType: "credential_use",
        protectionMode: "standard",
        coverageLevel: "STRONG_ENFORCEMENT",
        rawCredentialExposure: true,
        riskScore: 20,
    });

    assert.equal(decision.action, "DENY");
    assert.equal(decision.blockingMoment, "pre_execution");
    assert.equal(decision.deterministic, true);
    assert.deepEqual(decision.reasonCodes, ["RAW_CREDENTIAL_EXPOSURE"]);
});

test("RuntimePolicyEngine fails closed in locked modes when policy health is unknown", () => {
    const decision = new RuntimePolicyEngine().evaluate({
        actionType: "terminal_command",
        protectionMode: "enterprise_locked",
        coverageLevel: "STRONG_ENFORCEMENT",
        policyEngineHealthy: false,
    });

    assert.equal(decision.action, "DENY");
    assert.ok(decision.reasonCodes.includes("POLICY_ENGINE_UNHEALTHY"));
});

test("RuntimePolicyEngine denies unknown network egress in strict mode", () => {
    const decision = new RuntimePolicyEngine().evaluate({
        actionType: "network_request",
        protectionMode: "strict",
        coverageLevel: "STRONG_ENFORCEMENT",
        destinationTrust: "unknown",
    });

    assert.equal(decision.action, "DENY");
    assert.ok(decision.reasonCodes.includes("UNKNOWN_NETWORK_STRICT_MODE"));
});

test("RuntimePolicyEngine blocks secret egress and cloud metadata targets", () => {
    const decision = new RuntimePolicyEngine().evaluate({
        actionType: "context_egress",
        protectionMode: "standard",
        coverageLevel: "STRONG_ENFORCEMENT",
        containsSecrets: true,
        destinationTrust: "cloud_metadata",
    });

    assert.equal(decision.action, "DENY");
    assert.ok(decision.reasonCodes.includes("SECRET_EGRESS"));
    assert.ok(decision.reasonCodes.includes("PRIVATE_OR_METADATA_NETWORK"));
});

test("RuntimePolicyEngine asks or denies when suspicious terminal parsing fails", () => {
    const standard = new RuntimePolicyEngine().evaluate({
        actionType: "terminal_command",
        protectionMode: "standard",
        coverageLevel: "PARTIAL_VISIBILITY",
        parserStatus: "failed_suspicious",
    });
    const strict = new RuntimePolicyEngine().evaluate({
        actionType: "terminal_command",
        protectionMode: "strict",
        coverageLevel: "PARTIAL_VISIBILITY",
        parserStatus: "failed_suspicious",
    });

    assert.equal(standard.action, "ASK");
    assert.equal(strict.action, "DENY");
    assert.ok(strict.reasonCodes.includes("TERMINAL_PARSE_FAILED"));
});

test("RuntimePolicyEngine does not claim blocking in observe mode", () => {
    const decision = new RuntimePolicyEngine().evaluate({
        actionType: "network_request",
        protectionMode: "observe",
        coverageLevel: "DETECTION_ONLY",
        destinationTrust: "cloud_metadata",
        containsSecrets: true,
        riskScore: 100,
    });

    assert.equal(decision.action, "ALLOW");
    assert.equal(decision.blockingMoment, "observe_only");
    assert.deepEqual(decision.reasonCodes, ["OBSERVE_MODE_NO_BLOCK"]);
});

test("RuntimePolicyEngine denies high-risk unsupported paths instead of showing protected", () => {
    const decision = new RuntimePolicyEngine().evaluate({
        actionType: "terminal_command",
        protectionMode: "standard",
        coverageLevel: "UNSUPPORTED",
        riskScore: 80,
    });

    assert.equal(decision.action, "DENY");
    assert.ok(decision.reasonCodes.includes("UNSUPPORTED_HIGH_RISK_PATH"));
    assert.equal(decision.coverageLevel, "UNSUPPORTED");
});

test("RuntimePolicyEngine allows low-risk local supported actions with reversible rollback metadata", () => {
    const decision = new RuntimePolicyEngine().evaluate({
        actionType: "file_write",
        protectionMode: "standard",
        coverageLevel: "STRONG_ENFORCEMENT",
        destinationTrust: "local",
        reversible: true,
    });

    assert.equal(decision.action, "ALLOW");
    assert.equal(decision.rollbackAvailable, true);
    assert.deepEqual(decision.reasonCodes, ["LOW_RISK_LOCAL_ACTION"]);
});
