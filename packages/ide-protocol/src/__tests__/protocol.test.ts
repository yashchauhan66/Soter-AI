import { test } from "node:test";
import assert from "node:assert/strict";
import {
    DEFAULT_BROKER_URL,
    BrokerRoutes,
    decisionAllowsForward,
    GuardCommand,
    GuardFeature,
    BROKER_BACKED_FEATURES,
    DEFAULT_POLICY,
    isGuardDecision,
    isSafeModeLevel,
    assertNoRawContent,
    IDE_PROTOCOL_VERSION,
    egressAllowsSend,
} from "../index";

test("broker constants match the broker server", () => {
    assert.equal(DEFAULT_BROKER_URL, "http://127.0.0.1:47321");
    assert.equal(BrokerRoutes.health.auth, false);
    assert.equal(BrokerRoutes.scan.method, "POST");
    assert.equal(BrokerRoutes.scan.path, "/v1/scan");
});

test("decisionAllowsForward enforces block and approval gating", () => {
    assert.equal(decisionAllowsForward("allow", false), true);
    assert.equal(decisionAllowsForward("redact", false), true);
    assert.equal(decisionAllowsForward("block", true), false);
    assert.equal(decisionAllowsForward("approval_required", false), false);
    assert.equal(decisionAllowsForward("approval_required", true), true);
});

test("command and feature registries are stable identifiers", () => {
    assert.equal(GuardCommand.ScanSelection, "soterai.scanSelection");
    assert.equal(GuardFeature.SafeMode, "safeMode");
    assert.ok(BROKER_BACKED_FEATURES.includes(GuardFeature.ScanSelection));
});

test("runtime guards accept valid values and reject others", () => {
    assert.ok(isGuardDecision("block"));
    assert.ok(!isGuardDecision("nope"));
    assert.ok(isSafeModeLevel("strict"));
    assert.ok(!isSafeModeLevel("paranoid"));
});

test("default policy is local-first", () => {
    assert.equal(DEFAULT_POLICY.localOnly, true);
    assert.ok(DEFAULT_POLICY.protectedGlobs.length > 0);
});

test("assertNoRawContent blocks raw-content telemetry", () => {
    assert.doesNotThrow(() => assertNoRawContent({ contentHash: "abc", decision: "allow" }));
    assert.throws(() => assertNoRawContent({ content: "my secret" }), /must not include/);
    assert.throws(() => assertNoRawContent({ prompt: "hi" }), /must not include/);
});

test("protocol version is exported", () => {
    assert.equal(IDE_PROTOCOL_VERSION, "0.1.0");
});

test("egress preflight route matches the broker server path", () => {
    assert.equal(BrokerRoutes.networkEgress.method, "POST");
    assert.equal(BrokerRoutes.networkEgress.path, "/v1/preflight/network-egress");
    assert.equal(BrokerRoutes.networkEgress.auth, true);
});

test("egressAllowsSend never treats an unanswered ASK as clearance", () => {
    // ASK means the user has not decided yet. An adapter that reads it as
    // "allow" converts a confirmation prompt into a silent send — the exact
    // class of bug this helper exists to prevent.
    assert.equal(egressAllowsSend("ASK"), false);
    assert.equal(egressAllowsSend("DENY"), false);
    assert.equal(egressAllowsSend("QUARANTINE"), false);
    assert.equal(egressAllowsSend("ALLOW_IN_SANDBOX"), false);
    assert.equal(egressAllowsSend("ALLOW"), true);
    assert.equal(egressAllowsSend("ALLOW_ONCE"), true);
    assert.equal(egressAllowsSend("ALLOW_WITH_TRANSFORMATION"), true);
});

test("egress is a shared feature every adapter must reach, not VS Code-only", () => {
    assert.equal(GuardFeature.EgressFirewall, "egressFirewall");
    assert.ok(BROKER_BACKED_FEATURES.includes(GuardFeature.EgressFirewall));
    assert.equal(GuardCommand.CheckEgress, "soterai.egress.check");
});
