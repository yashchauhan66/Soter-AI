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
