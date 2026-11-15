import "./phase2/register.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";
import { ownedSinkMetadata } from "../../../core/src/OwnedSinkMetadata";
import { selfHygieneEnabled } from "../self-hygiene/SelfHygieneFlags";
import { resetState, state } from "./phase2/vscode-stub";

test("F27 central metadata preserves public code/decision/bounded count only", () => {
    assert.deepEqual(ownedSinkMetadata("egress.precheck", "BLOCK", 90), { code: "egress.precheck", decision: "BLOCK", riskScore: 90 });
});
test("F27 central metadata withholds arbitrary private text without hashing it", () => {
    const value = "F27_SYNTHETIC_PRIVATE_8c16e402";
    assert.deepEqual(ownedSinkMetadata(value, value, value), { code: "event", decision: "unknown" });
});
test("F27 central metadata never coerces caller objects or invokes accessors", () => {
    let calls = 0;
    const value = Object.defineProperty({}, "toString", { get() { calls++; throw new Error("Unexpected accessor"); } });
    assert.deepEqual(ownedSinkMetadata(value, value, value), { code: "event", decision: "unknown" });
    assert.equal(calls, 0);
});
test("F27 central metadata refuses nonfinite, fractional, negative and excessive counters", () => {
    for (const value of [NaN, Infinity, -1, 101, 1.5, "90", null]) {
        assert.equal("riskScore" in ownedSinkMetadata("scan", "allow", value), false);
    }
    assert(Object.isFrozen(ownedSinkMetadata("scan", "allow", 10)));
});
test("F27 owned sink is default-off and ignores repository-only opt-in", () => {
    resetState(); assert.equal(selfHygieneEnabled(), false);
    state.config.set("soterai.lite.selfHygiene", true);
    state.configInspect.set("soterai.lite.selfHygiene", { defaultValue: false, workspaceValue: true, workspaceFolderValue: true });
    assert.equal(selfHygieneEnabled(), false);
});
test("F27 owned sink requires literal global true and honors global withdrawal", () => {
    for (const globalValue of ["true", 1, {}, null, false]) {
        state.configInspect.set("soterai.lite.selfHygiene", { defaultValue: false, globalValue, workspaceValue: true });
        assert.equal(selfHygieneEnabled(), false);
    }
    state.configInspect.set("soterai.lite.selfHygiene", { defaultValue: false, globalValue: true, workspaceValue: false });
    assert.equal(selfHygieneEnabled(), true);
});
