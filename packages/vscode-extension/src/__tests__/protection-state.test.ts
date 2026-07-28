import assert from "node:assert/strict";
import { test } from "node:test";
import { deriveProtectionState, type ProtectionRuntimeFacts } from "../protection/ProtectionState";

const base: ProtectionRuntimeFacts = {
    enabled: true,
    broker: "healthy",
    workspaceTrusted: true,
    policy: "loaded",
    safeModeEnabled: true,
    protectedWorkspaceEnabled: true,
    sentinelEnabled: true,
    mcpStrictModeEnabled: true,
    liveScanEnabled: true,
    protectedAiTools: 1,
    detectedAiTools: 1,
};

test("does not call protection fully enforced when one required control is missing", () => {
    const result = deriveProtectionState({ ...base, sentinelEnabled: false });
    assert.equal(result.state, "PARTIALLY_ENFORCED");
    assert.notEqual(result.title, "Fully enforced");
});

test("reports bypass when detected AI tools exceed verified routes", () => {
    const result = deriveProtectionState({ ...base, detectedAiTools: 2, protectedAiTools: 1 });
    assert.equal(result.state, "BYPASS_DETECTED");
    assert.match(result.explanation, /outside/i);
});

test("reports monitoring only when the broker is healthy but no enforcement is enabled", () => {
    const result = deriveProtectionState({ ...base, safeModeEnabled: false, protectedWorkspaceEnabled: false, sentinelEnabled: false, mcpStrictModeEnabled: false });
    assert.equal(result.state, "MONITORING_ONLY");
});

test("reports fully enforced only when required controls and all detected tools are verified", () => {
    assert.equal(deriveProtectionState(base).state, "FULLY_ENFORCED");
});

test("lockdown has priority over all other runtime facts", () => {
    assert.equal(deriveProtectionState({ ...base, lockdown: true }).state, "LOCKDOWN");
});