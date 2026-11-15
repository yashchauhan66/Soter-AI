import "./phase2/register.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";
import { resetState, state } from "./phase2/vscode-stub";
import { TelemetryManager } from "../telemetry";
import type { GuardDecision } from "@soterai/guard-core";

const CANARY = "F27_SYNTHETIC_TELEMETRY_VALUE_8c16e402";
function fixture() {
    resetState();
    const manager = TelemetryManager.getInstance();
    manager.syncPrivacyBoundary(); // Explicit local/off default purges the previous fixture queue.
    state.config.set("soterai.telemetry.redactedEvents", "batched");
    state.configInspect.set("soterai.telemetry.redactedEvents", { defaultValue: "off", globalValue: "batched" });
    state.config.set("soterai.privacyMode", "cloud");
    state.config.set("soterai.cloud.enabled", true);
    state.configInspect.set("soterai.lite.selfHygiene", { defaultValue: false, globalValue: true });
    manager.syncPrivacyBoundary();
    const decision: GuardDecision = {
        decision: "block", riskScore: 90, severity: "high", categories: [CANARY], findings: [],
        evidencePreview: CANARY, inputHash: CANARY, detectorVersions: { private: CANARY },
        localOnly: true, createdAt: new Date().toISOString(),
    };
    const queue = () => (manager as unknown as { queue: unknown[] }).queue;
    return { manager, decision, queue };
}

test("F27 telemetry keeps useful public decision metadata without caller text in queue", () => {
    const { manager, decision, queue } = fixture();
    try {
        manager.trackDetection(decision, 100, "file");
        assert.equal(queue().length, 1);
        assert.equal(JSON.stringify(queue()).includes("scan_file"), true);
        assert.equal(JSON.stringify(queue()).includes(CANARY), false, "Telemetry queue retained a private value");
    } finally { manager.dispose(); }
});

test("F27 telemetry sanitizes caller context and purges queue on sink withdrawal", () => {
    const { manager, decision, queue } = fixture();
    try {
        manager.trackDetection(decision, 100, CANARY);
        assert.equal(JSON.stringify(queue()).includes(CANARY), false, "Telemetry context reflected private text");
        state.configInspect.set("soterai.lite.selfHygiene", { defaultValue: false, globalValue: false });
        manager.syncPrivacyBoundary();
        assert.equal(queue().length, 0);
        manager.trackDetection(decision, 100, "file");
        assert.equal(queue().length, 0);
    } finally { manager.dispose(); }
});

test("F27 telemetry dispose clears retained metadata without a final send", () => {
    const { manager, decision, queue } = fixture();
    manager.trackDetection(decision, 100, "file");
    assert.equal(queue().length, 1);
    manager.dispose();
    assert.equal(queue().length, 0);
});

test("F27 telemetry repository settings cannot opt into collection", () => {
    const { manager, decision, queue } = fixture();
    try {
        state.configInspect.set("soterai.telemetry.redactedEvents", { defaultValue: "off", workspaceValue: "batched" });
        manager.trackDetection(decision, 100, "file");
        assert.equal(queue().length, 0);
    } finally { manager.dispose(); }
});

test("F27 telemetry logger disposal failure is value-free and leaves no queue", () => {
    const { manager, decision, queue } = fixture();
    manager.trackDetection(decision, 100, "file");
    (manager as unknown as { logger: unknown }).logger = { dispose() { throw new Error(CANARY); } };
    assert.doesNotThrow(() => manager.dispose()); assert.equal(queue().length, 0);
});
