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

test("reports bypass when a routable AI tool is not routed through SoterAI", () => {
    const result = deriveProtectionState({ ...base, detectedAiTools: 2, protectedAiTools: 1 });
    assert.equal(result.state, "BYPASS_DETECTED");
    // The wording must describe a fixable configuration gap, and the
    // recommended action must name the button that fixes it.
    assert.match(result.explanation, /routable AI integration/i);
    assert.match(result.recommendedAction, /set up local checking/i);
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

// ── The permanently-red-banner regressions ───────────────────────────────────
//
// On the machine that reported "0 of 32 detected AI tools", no combination of
// settings could clear the error banner. There were three separate causes; each
// gets a test, because each could regress independently.

test("a tool SoterAI cannot route is a stated limit, not a bypass", () => {
    // Copilot installed, nothing routed for it — because nothing CAN route it.
    const result = deriveProtectionState({ ...base, detectedAiTools: 1, protectedAiTools: 1, unmanagedAiTools: 4 });
    assert.notEqual(result.state, "BYPASS_DETECTED");
    assert.equal(result.severity, "warning", "an unfixable limitation must not be reported as an error");
    assert.match(result.explanation, /cannot be routed by SoterAI/i);
    // The count is still disclosed: the fix must not hide uncovered tools to
    // buy a calmer badge.
    assert.match(result.coverage, /4 other AI tools cannot be routed/i);
});

test("fully enforced is reachable on a real machine", () => {
    // This is the assertion that failed before the fix: MCP governance was in
    // REQUIRED_CONTROLS while ProtectionStateService hardcoded its fact to
    // false, so no user could reach a green state whatever they switched on.
    const result = deriveProtectionState({
        ...base,
        mcpStrictModeEnabled: false, // what the service actually reports
        unmanagedAiTools: 0,
    });
    assert.equal(result.state, "FULLY_ENFORCED");
    assert.equal(result.severity, "info");
});

test("broker offline is an error only when something depends on the broker", () => {
    // Fresh install: nothing routed, Safe Mode off. The truthful headline is
    // "monitoring only", not a red failure for a component never asked for.
    const fresh = deriveProtectionState({
        ...base,
        broker: "offline",
        safeModeEnabled: false,
        protectedWorkspaceEnabled: false,
        sentinelEnabled: false,
        mcpStrictModeEnabled: false,
        detectedAiTools: 0,
        protectedAiTools: 0,
    });
    assert.equal(fresh.state, "MONITORING_ONLY");
    assert.equal(fresh.severity, "warning");

    // Once the user switches on blocking, an offline broker breaks a promise
    // that is now being made, so it must be an error.
    const expecting = deriveProtectionState({
        ...base,
        broker: "offline",
        safeModeEnabled: true,
        detectedAiTools: 0,
        protectedAiTools: 0,
    });
    assert.equal(expecting.state, "BROKER_OFFLINE");
    assert.equal(expecting.severity, "error");
});

test("policy unavailable is not a red banner unless enforcement is actually on", () => {
    // A fresh workspace with no policy file and no enforcement switched on
    // must NOT report POLICY_UNAVAILABLE: the service auto-creates the default
    // policy and the honest headline is monitoring only, not an error.
    const fresh = deriveProtectionState({
        ...base,
        policy: "unavailable",
        broker: "offline",
        safeModeEnabled: false,
        protectedWorkspaceEnabled: false,
        sentinelEnabled: false,
        mcpStrictModeEnabled: false,
        detectedAiTools: 0,
        protectedAiTools: 0,
    });
    assert.equal(fresh.state, "MONITORING_ONLY");
    assert.equal(fresh.severity, "warning");

    // The moment the user turns on Safe Mode, a missing policy blocks the
    // enforcement claim being made, so POLICY_UNAVAILABLE is the truthful
    // headline — but it stays a warning with a working CTA, not an error.
    const blocking = deriveProtectionState({
        ...base,
        policy: "unavailable",
        broker: "healthy",
        safeModeEnabled: true,
        detectedAiTools: 0,
        protectedAiTools: 0,
    });
    assert.equal(blocking.state, "POLICY_UNAVAILABLE");
    assert.equal(blocking.severity, "warning");
    assert.match(blocking.recommendedAction, /create project policy/i);
});

test("MCP governance is disclosed as advisory rather than gating the claim", () => {
    const result = deriveProtectionState({ ...base, mcpStrictModeEnabled: false });
    assert.ok(
        result.inactiveControls.some((control) => /MCP governance \(advisory\)/i.test(control)),
        "MCP governance must stay visible AND be marked advisory, since SoterAI's " +
        "MCP firewall is not a mandatory gateway and cannot be claimed as enforcement",
    );
    assert.equal(result.state, "FULLY_ENFORCED", "an advisory control must not block the claim");
});

test("the coverage line never invents protection it cannot prove", () => {
    const none = deriveProtectionState({ ...base, detectedAiTools: 0, protectedAiTools: 0, unmanagedAiTools: 0 });
    assert.match(none.coverage, /unknown until an integration is detected/i);

    const onlyUnmanaged = deriveProtectionState({ ...base, detectedAiTools: 0, protectedAiTools: 0, unmanagedAiTools: 2 });
    assert.match(onlyUnmanaged.coverage, /No routable AI integration detected/i);
    assert.match(onlyUnmanaged.coverage, /2 other AI tools cannot be routed/i);
});