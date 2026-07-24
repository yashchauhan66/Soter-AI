export type GovernanceRole = "developer" | "security_reviewer" | "org_admin" | "platform_admin";
export type GovernanceDecision = "ALLOW" | "ASK" | "DENY";

export interface EnterprisePolicySnapshot {
    version: string;
    mode: "observe" | "standard" | "strict" | "enterprise_locked" | "air_gapped";
    signed: boolean;
    mandatoryControls: string[];
    disabledControls?: string[];
    exceptions?: Array<{ id: string; control: string; expiresAt?: string; reason?: string }>;
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

export function evaluatePolicyChange(request: PolicyChangeRequest): PolicyChangeDecision {
    const nowMs = Date.parse(request.now ?? new Date().toISOString());
    const reasonCodes: string[] = [];
    const changedControls = diffControls(request.current, request.next);

    if (request.current.mode === "enterprise_locked" && request.actorRole !== "org_admin" && request.actorRole !== "platform_admin") {
        reasonCodes.push("ENTERPRISE_POLICY_REQUIRES_ADMIN");
    }
    if (request.current.signed && !request.next.signed) {
        reasonCodes.push("SIGNED_POLICY_DOWNGRADE");
    }
    const removedMandatory = request.current.mandatoryControls.filter((control) => !request.next.mandatoryControls.includes(control));
    if (removedMandatory.length) {
        reasonCodes.push("MANDATORY_CONTROL_REMOVED");
    }
    const disabledMandatory = request.next.disabledControls?.filter((control) => request.current.mandatoryControls.includes(control)) ?? [];
    if (disabledMandatory.length) {
        reasonCodes.push("MANDATORY_CONTROL_DISABLED");
    }
    const invalidExceptions = (request.next.exceptions ?? []).filter((exception) => !exception.expiresAt || Date.parse(exception.expiresAt) <= nowMs);
    if (invalidExceptions.length) {
        reasonCodes.push("EXCEPTION_REQUIRES_FUTURE_EXPIRY");
    }
    if (modeRank(request.next.mode) < modeRank(request.current.mode)) {
        reasonCodes.push("PROTECTION_MODE_WEAKENED");
    }

    const denyReasons = ["ENTERPRISE_POLICY_REQUIRES_ADMIN", "SIGNED_POLICY_DOWNGRADE", "MANDATORY_CONTROL_REMOVED", "MANDATORY_CONTROL_DISABLED", "EXCEPTION_REQUIRES_FUTURE_EXPIRY"];
    const decision: GovernanceDecision = reasonCodes.some((reason) => denyReasons.includes(reason))
        ? "DENY"
        : reasonCodes.includes("PROTECTION_MODE_WEAKENED") || changedControls.length
          ? "ASK"
          : "ALLOW";

    return {
        decision,
        reasonCodes,
        requiresAudit: changedControls.length > 0 || reasonCodes.length > 0,
        requiresSignature: request.current.signed || request.next.mode === "enterprise_locked",
        changedControls,
        explanation: decision === "ALLOW"
            ? "Policy change does not weaken protected controls."
            : `Policy change ${decision.toLowerCase()} because ${reasonCodes.join(", ")}.`,
        deterministic: true,
    };
}

function diffControls(current: EnterprisePolicySnapshot, next: EnterprisePolicySnapshot): string[] {
    const before = new Set([...current.mandatoryControls, ...(current.disabledControls ?? []).map((control) => `disabled:${control}`)]);
    const after = new Set([...next.mandatoryControls, ...(next.disabledControls ?? []).map((control) => `disabled:${control}`)]);
    return [...new Set([...before, ...after])].filter((control) => before.has(control) !== after.has(control)).sort();
}

function modeRank(mode: EnterprisePolicySnapshot["mode"]): number {
    return mode === "observe" ? 0 : mode === "standard" ? 1 : mode === "strict" ? 2 : mode === "air_gapped" ? 3 : 4;
}
