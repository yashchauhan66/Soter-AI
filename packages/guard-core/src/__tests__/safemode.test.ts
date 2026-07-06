import { describe, it } from "node:test";
import assert from "node:assert";
import {
    generateSafeModePolicy,
    applySafeMode,
    strictest,
    SAFE_MODE_LEVELS,
    type SafeModeLevel,
} from "../SafeMode";

describe("SafeMode — policy generation", () => {
    it("generates a policy + settings for all three levels", () => {
        for (const level of SAFE_MODE_LEVELS) {
            const p = generateSafeModePolicy(level);
            assert.strictEqual(p.level, level);
            assert.ok(p.projectPolicy.protectedFiles.includes(".env"));
            assert.ok(p.projectPolicy.protectedFiles.some((g) => g.includes("customer-")));
            assert.ok(p.rules.length > 5);
            // Raw cloud telemetry is off in every level.
            assert.strictEqual(p.settings.rawCloudTelemetry, false);
            assert.strictEqual(p.settings.localOnlyMode, true);
            assert.strictEqual(p.settings.canaryLeakDetection, true);
            assert.strictEqual(p.projectPolicy.cloud.sendRawContent, false);
        }
    });

    it("developer warns on sensitive paths; strict/enterprise require approval", () => {
        assert.strictEqual(generateSafeModePolicy("developer").projectPolicy.aiContext.sensitivePathAction, "warn");
        assert.strictEqual(generateSafeModePolicy("strict").projectPolicy.aiContext.sensitivePathAction, "approval_required");
        assert.strictEqual(generateSafeModePolicy("enterprise").projectPolicy.aiContext.sensitivePathAction, "approval_required");
    });

    it("enterprise fails closed (default approval_required + failClosed)", () => {
        const e = generateSafeModePolicy("enterprise");
        assert.strictEqual(e.settings.failClosed, true);
        assert.strictEqual(e.projectPolicy.aiContext.defaultAction, "approval_required");
    });

    it("protected files are always blocked", () => {
        for (const level of SAFE_MODE_LEVELS) {
            assert.strictEqual(generateSafeModePolicy(level).projectPolicy.aiContext.protectedFileAction, "block");
        }
    });
});

describe("SafeMode — decision escalation", () => {
    it("strictest picks the more restrictive action", () => {
        assert.strictEqual(strictest("allow", "block"), "block");
        assert.strictEqual(strictest("redact", "warn"), "redact");
        assert.strictEqual(strictest("approval_required", "redact"), "approval_required");
    });

    it("a canary is always blocked at every level", () => {
        for (const level of SAFE_MODE_LEVELS) {
            const a = applySafeMode(level, { baseAction: "allow", categories: [], riskScore: 100, canaryPresent: true });
            assert.strictEqual(a, "block", `canary must block at ${level}`);
        }
    });

    it("private keys block even at developer level", () => {
        const a = applySafeMode("developer", { baseAction: "warn", categories: ["private_key"], riskScore: 80 });
        assert.strictEqual(a, "block");
    });

    it("provider tokens redact at developer, block at strict/enterprise", () => {
        assert.strictEqual(applySafeMode("developer", { baseAction: "allow", categories: ["openai_api_key"], riskScore: 50 }), "redact");
        assert.strictEqual(applySafeMode("strict", { baseAction: "allow", categories: ["openai_api_key"], riskScore: 50 }), "block");
        assert.strictEqual(applySafeMode("enterprise", { baseAction: "allow", categories: ["aws_access_key"], riskScore: 50 }), "block");
    });

    it("PII is at least redacted", () => {
        const a = applySafeMode("developer", { baseAction: "allow", categories: ["email", "phone_number"], riskScore: 20 });
        assert.ok(["redact", "block", "approval_required"].includes(a));
    });

    it("dangerous terminal commands are blocked", () => {
        const a = applySafeMode("developer", { baseAction: "allow", categories: ["reverse_shell"], riskScore: 90 });
        assert.strictEqual(a, "block");
    });

    it("protected path classification forces block", () => {
        const a = applySafeMode("developer", { baseAction: "allow", categories: [], riskScore: 0, pathClassification: "protected" });
        assert.strictEqual(a, "block");
    });

    it("enterprise fails closed on any risk", () => {
        const a = applySafeMode("enterprise", { baseAction: "warn", categories: ["ip_address"], riskScore: 10 });
        assert.ok(["approval_required", "redact", "block"].includes(a));
        // Scanner error → block at fail-closed level.
        assert.strictEqual(applySafeMode("enterprise", { baseAction: "allow", categories: [], riskScore: 0, scannerError: true }), "block");
    });

    it("never loosens a stricter base action", () => {
        const a = applySafeMode("developer", { baseAction: "block", categories: ["email"], riskScore: 5 });
        assert.strictEqual(a, "block");
    });
});
