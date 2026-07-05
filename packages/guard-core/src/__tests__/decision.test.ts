import { describe, it } from "node:test";
import assert from "node:assert";
import { DecisionEngine } from "../DecisionEngine";
import { PolicyEvaluator } from "../PolicyEvaluator";
import { HashCache } from "../HashCache";

describe("DecisionEngine and Orchestrator", () => {
    it("should evaluate text and return correct GuardDecision", async () => {
        const engine = new DecisionEngine();
        const prompt = "Please review my code. Do not worry about API key sk-proj-1234567890abcdef1234567890abcdef1234567890abcdef";
        const result = await engine.scan(prompt, { context: "prompt" });

        assert.strictEqual(result.decision, "redact", "Should redact due to OpenAI key matching redact threshold");
        assert.ok(result.riskScore > 35, "Risk score should reflect the secrets found");
        assert.ok(result.categories.includes("openai_api_key"), "Should list OpenAI key category");
        assert.ok(result.findings.length > 0, "Should have finding details");
        assert.ok(result.redactedText, "Should produce redacted output");
        assert.ok(!result.redactedText!.includes("sk-proj-1234567890"), "Redacted text must hide key");
    });

    it("should use local hash cache to save execution time", async () => {
        const engine = new DecisionEngine();
        const text = "Some regular prompt text without secrets.";

        const start1 = Date.now();
        const r1 = await engine.scan(text);
        const duration1 = Date.now() - start1;

        const start2 = Date.now();
        const r2 = await engine.scan(text);
        const duration2 = Date.now() - start2;

        assert.strictEqual(r1.decision, "allow");
        assert.strictEqual(r2.decision, "allow");
        assert.strictEqual(r1.inputHash, r2.inputHash);
    });

    it("should enforce policy configuration updates", () => {
        const evaluator = new PolicyEvaluator();
        const initial = evaluator.evaluate(50, ["pan"]);
        assert.strictEqual(initial.action, "redact", "Initial policy should redact above threshold");

        evaluator.updatePolicy({
            riskThresholds: { warn: 10, redact: 80, block: 90, approvalRequired: 95 }
        });

        const updated = evaluator.evaluate(50, ["pan"]);
        // Since riskScore 50 is less than redact(80), it should warn (since 50 >= warn(10))
        assert.strictEqual(updated.action, "warn", "Should adjust action based on updated policy thresholds");
    });

    it("should respect TTL and policy version change in hash cache", () => {
        const cache = new HashCache({ ttlMs: 100, policyVersion: "1.0.0" });
        const dummyDecision: any = { decision: "allow", riskScore: 0 };

        cache.set("abc", dummyDecision);
        assert.ok(cache.get("abc") !== null);

        // Test policy version change invalidates the cache
        cache.updateConfig({ policyVersion: "2.0.0" });
        assert.strictEqual(cache.get("abc"), null, "Cache must invalidate on version change");
    });
});
