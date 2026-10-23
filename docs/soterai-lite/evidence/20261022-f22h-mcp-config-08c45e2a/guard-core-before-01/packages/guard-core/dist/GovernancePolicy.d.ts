export type GovernanceRole = "developer" | "security_reviewer" | "org_admin" | "platform_admin";
export type GovernanceDecision = "ALLOW" | "ASK" | "DENY";
export interface EnterprisePolicySnapshot {
    version: string;
    mode: "observe" | "standard" | "strict" | "enterprise_locked" | "air_gapped";
    signed: boolean;
    mandatoryControls: string[];
    disabledControls?: string[];
    exceptions?: Array<{
        id: string;
        control: string;
        expiresAt?: string;
        reason?: string;
    }>;
}
export interface PolicyChangeRequest {
    actorRole: GovernanceRole;
    current: EnterprisePolicySnapshot;
    next: EnterprisePolicySnapshot;
    now?: string;
}
export interface PolicyChangeDecision {
    decision: GovernanceDecision;
    reasonCodes: string[];
    requiresAudit: boolean;
    requiresSignature: boolean;
    changedControls: string[];
    explanation: string;
    deterministic: true;
}
export declare function evaluatePolicyChange(request: PolicyChangeRequest): PolicyChangeDecision;
//# sourceMappingURL=GovernancePolicy.d.ts.map