import type { GuardAction, PolicyConfig, PolicyRule, Severity } from "./types";

const DEFAULT_POLICY: PolicyConfig = {
    version: "1.0.0",
    enabled: true,
    mode: "local",
    defaultAction: "allow",
    riskThresholds: { warn: 15, redact: 35, block: 70, approvalRequired: 85 },
    rules: [],
    maxContentLength: 500_000,
    updatedAt: new Date().toISOString(),
};

export class PolicyEvaluator {
    private policy: PolicyConfig;

    constructor(policy?: Partial<PolicyConfig>) {
        this.policy = { ...DEFAULT_POLICY, ...policy };
    }

    evaluate(riskScore: number, categories: string[]): { action: GuardAction; severity: Severity; matchedRules: PolicyRule[] } {
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

    getPolicy(): PolicyConfig { return { ...this.policy }; }

    updatePolicy(updates: Partial<PolicyConfig>): void {
        this.policy = { ...this.policy, ...updates, updatedAt: new Date().toISOString() };
    }

    private ruleMatches(rule: PolicyRule, riskScore: number, categories: string[]): boolean {
        if (rule.minRiskScore !== undefined && riskScore < rule.minRiskScore) return false;
        if (rule.categories?.length && !rule.categories.some((c) => categories.includes(c))) return false;
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
    private thresholdAction(score: number): GuardAction {
        const t = this.policy.riskThresholds;
        const tiers: Array<[number, GuardAction]> = [
            [t.approvalRequired, "approval_required"],
            [t.block, "block"],
            [t.redact, "redact"],
            [t.warn, "warn"],
        ];
        let best: GuardAction = "allow";
        let bestThreshold = -1;
        for (const [threshold, action] of tiers) {
            if (score < threshold) continue;
            if (
                threshold > bestThreshold ||
                (threshold === bestThreshold && ACTION_PRECEDENCE[action] > ACTION_PRECEDENCE[best])
            ) {
                bestThreshold = threshold;
                best = action;
            }
        }
        return best;
    }

    private severityForScore(score: number): Severity {
        if (score >= 85) return "critical";
        if (score >= 60) return "high";
        if (score >= 30) return "medium";
        if (score > 0) return "low";
        return "info";
    }
}

const ACTION_PRECEDENCE: Record<GuardAction, number> = {
    allow: 0, warn: 1, redact: 2, block: 3, approval_required: 4,
};

function maxAction(actions: GuardAction[]): GuardAction {
    return actions.reduce<GuardAction>((winner, action) =>
        ACTION_PRECEDENCE[action] > ACTION_PRECEDENCE[winner] ? action : winner, "allow");
}
