import type { GuardAction, PolicyConfig, PolicyRule, Severity } from "./types";
export declare class PolicyEvaluator {
    private policy;
    constructor(policy?: Partial<PolicyConfig>);
    evaluate(riskScore: number, categories: string[]): {
        action: GuardAction;
        severity: Severity;
        matchedRules: PolicyRule[];
    };
    getPolicy(): PolicyConfig;
    updatePolicy(updates: Partial<PolicyConfig>): void;
    private ruleMatches;
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
    private thresholdAction;
    private severityForScore;
}
//# sourceMappingURL=PolicyEvaluator.d.ts.map