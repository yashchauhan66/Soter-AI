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

test("preflight engines remain detection-only and checkpoint rollback is filesystem-partial", () => {
    const preflightEngineIds = [
        "file-operation-firewall",
        "network-egress-policy",
        "process-sandbox-policy",
        "governance-policy",
    ];
    for (const id of preflightEngineIds) {
        const c = CAPABILITY_REGISTRY.find((x) => x.id === id);
        assert.ok(c, `missing capability ${id}`);
        assert.equal(c!.wiredInRuntime, true, `${id} should expose a runtime preflight`);
        assert.equal(c!.level, "DETECTION_ONLY", `${id} must not claim enforcement for advisory preflight`);
        assert.equal(c!.preExecutionBlock, false);
    }
    const checkpoint = CAPABILITY_REGISTRY.find((x) => x.id === "checkpoint-rollback");
    assert.equal(checkpoint?.wiredInRuntime, true);
    assert.equal(checkpoint?.level, "PARTIAL_ENFORCEMENT");
    assert.equal(checkpoint?.rollbackSupported, true);
    assert.match(checkpoint?.enforcementPoint ?? "", /CheckpointStore/);
});

test("inline MCP gateway and its taint engine are wired pre-execution", () => {
    const c = CAPABILITY_REGISTRY.find((x) => x.id === "mcp-gateway");
    assert.ok(c, "missing mcp-gateway");
    assert.equal(c!.wiredInRuntime, true);
    assert.equal(c!.level, "STRONG_ENFORCEMENT");
    assert.equal(c!.preExecutionBlock, true);
    const taint = CAPABILITY_REGISTRY.find((x) => x.id === "taint-engine");
    assert.equal(taint?.wiredInRuntime, true);
    assert.equal(taint?.preExecutionBlock, true);
});

test("a doctored registry that lies about wiring is caught by the invariant", () => {
    // Prove the guard actually fires — take a real unwired engine and pretend
    // it is STRONG_ENFORCEMENT without wiring it.
    const doctored: ProtectionCapability[] = CAPABILITY_REGISTRY.map((c) =>
        c.id === "child-process-control"
            ? { ...c, level: "STRONG_ENFORCEMENT", preExecutionBlock: true }
            : c,
    );
    const violations = findHonestyViolations(doctored);
    assert.ok(
        violations.some((v) => v.id === "child-process-control"),
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
