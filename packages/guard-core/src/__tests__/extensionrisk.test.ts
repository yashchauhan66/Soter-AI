import { describe, it } from "node:test";
import assert from "node:assert";
import { assessExtension, scanExtensions, type ExtensionMetadata } from "../ExtensionRiskScanner";

const builtin: ExtensionMetadata = {
    id: "vscode.git",
    displayName: "Git",
    publisher: "vscode",
    isBuiltin: true,
    packageJSON: { categories: ["SCM Providers"] },
};

const copilot: ExtensionMetadata = {
    id: "github.copilot",
    displayName: "GitHub Copilot",
    publisher: "github",
    packageJSON: {
        description: "Your AI pair programmer",
        categories: ["AI", "Programming Languages"],
        activationEvents: ["onStartupFinished"],
        repository: { url: "https://github.com/github/copilot" },
        __metadata: { isVerified: true },
    },
};

const impersonator: ExtensionMetadata = {
    id: "shadypub.copilot-pro-free",
    displayName: "Copilot Pro (Free)",
    publisher: "shadypub",
    packageJSON: {
        description: "Free AI assistant",
        categories: ["AI"],
        activationEvents: ["*"],
        // no repository, not verified
    },
};

describe("ExtensionRiskScanner", () => {
    it("treats built-in extensions as trusted/info", () => {
        const a = assessExtension(builtin);
        assert.strictEqual(a.isBuiltin, true);
        assert.strictEqual(a.level, "info");
        assert.strictEqual(a.riskScore, 0);
    });

    it("flags a known AI assistant as AI but keeps verified/publisher-matched ones lower", () => {
        const a = assessExtension(copilot);
        assert.strictEqual(a.isAI, true);
        assert.ok(a.signals.some((s) => s.code === "ai_assistant"));
        assert.ok(!a.signals.some((s) => s.code === "possible_impersonation"), "verified publisher should not impersonate");
    });

    it("raises high risk for an unverified impersonator with wildcard activation", () => {
        const a = assessExtension(impersonator);
        assert.strictEqual(a.isAI, true);
        assert.strictEqual(a.level, "high");
        assert.ok(a.signals.some((s) => s.code === "possible_impersonation"));
        assert.ok(a.signals.some((s) => s.code === "wildcard_activation"));
        assert.ok(a.signals.some((s) => s.code === "unverified_publisher"));
    });

    it("rolls up scan totals and sorts by risk desc", () => {
        const report = scanExtensions([builtin, copilot, impersonator]);
        assert.strictEqual(report.total, 3);
        assert.strictEqual(report.aiExtensions, 2);
        assert.ok(report.highRisk >= 1);
        assert.strictEqual(report.assessments[0].id, impersonator.id, "highest risk first");
    });

    it("never emits raw secret-like values (metadata only)", () => {
        const json = JSON.stringify(scanExtensions([copilot, impersonator]));
        assert.ok(!/sk-[a-z0-9]/i.test(json));
    });
});
