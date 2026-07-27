import assert from "node:assert/strict";
import test from "node:test";
import {
    CAPABILITY_REGISTRY,
    ENFORCING_LEVELS,
    assertHonestLevels,
    capabilitiesSnapshot,
    findHonestyViolations,
    type ProtectionCapability,
} from "../index";

// ─── The honesty invariant, enforced as behaviour ───────────────────────────
// Section 3/5: a capability may only claim FULL/STRONG_ENFORCEMENT or
// pre-execution blocking if a real caller in the packaged runtime routes
// through it. These tests fail the build the instant the registry lies —
// e.g. if someone marks the (currently unwired) MCP gateway as STRONG.

test("registry is internally honest: no capability claims enforcement it cannot back", () => {
    const violations = findHonestyViolations();
    assert.deepEqual(violations, [], `honesty violations: ${JSON.stringify(violations)}`);
    assert.doesNotThrow(() => assertHonestLevels());
});

test("every ENFORCING capability is wired into the runtime and names an enforcement point", () => {
    for (const c of CAPABILITY_REGISTRY) {
        if (ENFORCING_LEVELS.has(c.level)) {
            assert.equal(c.wiredInRuntime, true, `${c.id} claims ${c.level} but is not wired`);
            assert.ok(c.enforcementPoint, `${c.id} claims ${c.level} but has no enforcementPoint`);
            assert.ok(c.evidenceTestIds.length > 0, `${c.id} claims ${c.level} with no evidence tests`);
        }
    }
});

test("the six implemented-but-unwired engines are honestly marked, not claimed as enforcement", () => {
    // mcp-gateway is now wired as DETECTION_ONLY via broker preflight (Phase 8).
    const unwiredEngineIds = [
        "taint-engine",
        "file-operation-firewall",
        "network-egress-policy",
        "process-sandbox-policy",
        "governance-policy",
        "checkpoint-rollback",
    ];
    for (const id of unwiredEngineIds) {
        const c = CAPABILITY_REGISTRY.find((x) => x.id === id);
        assert.ok(c, `missing capability ${id}`);
        assert.equal(c!.wiredInRuntime, false, `${id} should be unwired`);
        assert.equal(c!.level, "UNKNOWN_NOT_TESTED", `${id} must not claim enforcement while unwired`);
        assert.equal(c!.preExecutionBlock, false, `${id} cannot block pre-execution while unwired`);
    }
});

test("mcp-gateway is wired as DETECTION_ONLY (preflight path), not FULL/STRONG", () => {
    const c = CAPABILITY_REGISTRY.find((x) => x.id === "mcp-gateway");
    assert.ok(c, "missing mcp-gateway");
    assert.equal(c!.wiredInRuntime, true);
    assert.equal(c!.level, "DETECTION_ONLY");
    assert.equal(c!.preExecutionBlock, false);
    assert.ok(c!.enforcementPoint?.includes("preflight") || c!.enforcementPoint?.includes("MCPGateway"));
});

test("a doctored registry that lies about wiring is caught by the invariant", () => {
    // Prove the guard actually fires — take a real unwired engine and pretend
    // it is STRONG_ENFORCEMENT without wiring it.
    const doctored: ProtectionCapability[] = CAPABILITY_REGISTRY.map((c) =>
        c.id === "taint-engine"
            ? { ...c, level: "STRONG_ENFORCEMENT", preExecutionBlock: true }
            : c,
    );
    const violations = findHonestyViolations(doctored);
    assert.ok(
        violations.some((v) => v.id === "taint-engine"),
        "invariant failed to catch a dishonest STRONG claim on an unwired engine",
    );
    assert.throws(() => assertHonestLevels(doctored));
});


test("capabilitiesSnapshot is serializable, honest, and self-describing", () => {
    const snap = capabilitiesSnapshot();
    assert.equal(snap.honest, true);
    assert.ok(snap.capabilities.length >= 15);
    // Round-trips through JSON without loss (it is what the artifact writes).
    const round = JSON.parse(JSON.stringify(snap));
    assert.equal(round.capabilities.length, snap.capabilities.length);
    // Counts add up to the capability total.
    const total = Object.values(snap.counts).reduce((a, b) => a + (b as number), 0);
    assert.equal(total, snap.capabilities.length);
});

test("every capability id is unique and stable", () => {
    const ids = CAPABILITY_REGISTRY.map((c) => c.id);
    assert.equal(new Set(ids).size, ids.length, "duplicate capability id");
});
