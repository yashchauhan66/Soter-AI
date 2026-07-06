import { describe, it } from "node:test";
import assert from "node:assert";
import { PolicyEvaluator } from "../PolicyEvaluator";

describe("PolicyEvaluator threshold ordering", () => {
    it("reaches approval_required above the block threshold (regression for #8)", () => {
        // Defaults: warn 15, redact 35, block 70, approvalRequired 85.
        const evaluator = new PolicyEvaluator();
        assert.strictEqual(evaluator.evaluate(90, []).action, "approval_required",
            "score >= approvalRequired must select approval_required, not block");
        assert.strictEqual(evaluator.evaluate(75, []).action, "block",
            "score between block and approvalRequired must block");
        assert.strictEqual(evaluator.evaluate(50, []).action, "redact");
        assert.strictEqual(evaluator.evaluate(20, []).action, "warn");
        assert.strictEqual(evaluator.evaluate(5, []).action, "allow");
    });

    it("selects the highest satisfied tier regardless of threshold ordering", () => {
        const evaluator = new PolicyEvaluator({
            riskThresholds: { warn: 10, redact: 30, block: 60, approvalRequired: 90 },
        });
        assert.strictEqual(evaluator.evaluate(95, []).action, "approval_required");
        assert.strictEqual(evaluator.evaluate(65, []).action, "block");
        assert.strictEqual(evaluator.evaluate(35, []).action, "redact");
    });

    it("honors a critical policy rule override above thresholds", () => {
        const evaluator = new PolicyEvaluator({
            rules: [{ id: "r1", name: "block private keys", action: "approval_required", categories: ["private_key"] }],
        });
        // Low score, but the matched rule escalates to approval_required.
        const res = evaluator.evaluate(10, ["private_key"]);
        assert.strictEqual(res.action, "approval_required");
        assert.strictEqual(res.matchedRules.length, 1);
    });

    it("disabled policy always allows", () => {
        const evaluator = new PolicyEvaluator({ enabled: false });
        assert.strictEqual(evaluator.evaluate(100, ["aws_access_key"]).action, "allow");
    });
});
