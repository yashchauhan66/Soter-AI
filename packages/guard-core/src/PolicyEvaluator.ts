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

    private thresholdAction(score: number): GuardAction {
        const t = this.policy.riskThresholds;
        if (score >= t.block) return "block";
        if (score >= t.approvalRequired) return "approval_required";
        if (score >= t.redact) return "redact";
        if (score >= t.warn) return "warn";
        return "allow";
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
