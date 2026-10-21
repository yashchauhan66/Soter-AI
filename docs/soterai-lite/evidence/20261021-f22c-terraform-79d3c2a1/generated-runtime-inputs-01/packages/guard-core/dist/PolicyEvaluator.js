"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PolicyEvaluator = void 0;
const DEFAULT_POLICY = {
    version: "1.0.0",
    enabled: true,
    mode: "local",
    defaultAction: "allow",
    riskThresholds: { warn: 15, redact: 35, block: 70, approvalRequired: 85 },
    rules: [],
    maxContentLength: 500_000,
    updatedAt: new Date().toISOString(),
};
class PolicyEvaluator {
    policy;
    constructor(policy) {
        this.policy = { ...DEFAULT_POLICY, ...policy };
    }
    evaluate(riskScore, categories) {
        if (!this.policy.enabled) {
            return { action: "allow", severity: "info", matchedRules: [] };
        }
        const matchedRules = this.policy.rules
            .filter((r) => r.enabled !== false)
            .filter((r) => this.ruleMatches(r, riskScore, categories));
        const thresholdAction = this.thresholdAction(riskScore);
        const ruleActions = matchedRules.map((r) => r.action);
        const action = maxAction([this.policy.defaultAction, thresholdAction, ...ruleActions]);
        const severity = this.severityForScore(riskScore);
        return { action, severity, matchedRules };
    }
    getPolicy() { return { ...this.policy }; }
    updatePolicy(updates) {
        this.policy = { ...this.policy, ...updates, updatedAt: new Date().toISOString() };
    }
    ruleMatches(rule, riskScore, categories) {
        if (rule.minRiskScore !== undefined && riskScore < rule.minRiskScore)
            return false;
        if (rule.categories?.length && !rule.categories.some((c) => categories.includes(c)))
            return false;
        return true;
    }
    /**
     * Map a risk score to a threshold action.
     *
     * Actions are keyed to configurable thresholds, so the correct action is the
     * one whose threshold is the HIGHEST among those the score satisfies — not
     * the first in a hard-coded list. The previous implementation checked
     * `block` before `approval_required`, which made `approval_required`
     * unreachable whenever its threshold sat above `block` (the default:
     * block=70, approvalRequired=85). Selecting by highest satisfied threshold
     * makes every tier reachable regardless of how the thresholds are ordered.
     *
     * Ties (two tiers sharing a threshold) are broken by action precedence so
     * the more restrictive action wins.
     */
    thresholdAction(score) {
        const t = this.policy.riskThresholds;
        const tiers = [
            [t.approvalRequired, "approval_required"],
            [t.block, "block"],
            [t.redact, "redact"],
            [t.warn, "warn"],
        ];
        let best = "allow";
        let bestThreshold = -1;
        for (const [threshold, action] of tiers) {
            if (score < threshold)
                continue;
            if (threshold > bestThreshold ||
                (threshold === bestThreshold && ACTION_PRECEDENCE[action] > ACTION_PRECEDENCE[best])) {
                bestThreshold = threshold;
                best = action;
            }
        }
        return best;
    }
    severityForScore(score) {
        if (score >= 85)
            return "critical";
        if (score >= 60)
            return "high";
        if (score >= 30)
            return "medium";
        if (score > 0)
            return "low";
        return "info";
    }
}
exports.PolicyEvaluator = PolicyEvaluator;
const ACTION_PRECEDENCE = {
    allow: 0, warn: 1, redact: 2, block: 3, approval_required: 4,
};
function maxAction(actions) {
    return actions.reduce((winner, action) => ACTION_PRECEDENCE[action] > ACTION_PRECEDENCE[winner] ? action : winner, "allow");
}
//# sourceMappingURL=PolicyEvaluator.js.map