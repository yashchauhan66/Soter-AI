import { RuntimePolicyEngine, type EnforcementAction, type ProtectionMode, type RuntimeCoverageLevel } from "./RuntimePolicyEngine";

export type TaintSourceTrust = "trusted" | "workspace" | "generated" | "external" | "mcp_output" | "terminal_output" | "untrusted";
export type TaintLabel = "prompt_injection" | "untrusted_instruction" | "secret_source" | "production_source" | "tool_output" | "encoded_content";

export interface TaintedSource {
    id: string;
    trust: TaintSourceTrust;
    labels: TaintLabel[];
    description?: string;
}

export interface TaintAssessment {
    tainted: boolean;
    riskScore: number;
    labels: TaintLabel[];
    sources: string[];
    explanation: string;
}

export interface TaintedActionRequest {
    actionType: "terminal_command" | "file_write" | "network_request" | "mcp_tool_call" | "context_egress";
    sources: TaintedSource[];
    protectionMode?: ProtectionMode;
    coverageLevel?: RuntimeCoverageLevel;
    riskScore?: number;
}

export interface TaintedActionDecision {
    action: EnforcementAction;
    riskScore: number;
    reasonCodes: string[];
    coverageLevel: RuntimeCoverageLevel;
    assessment: TaintAssessment;
    deterministic: true;
}

export function assessTaint(sources: TaintedSource[]): TaintAssessment {
    const labels = [...new Set(sources.flatMap((source) => source.labels))];
    const sourceIds = sources.filter((source) => source.trust !== "trusted").map((source) => source.id);
    let riskScore = 0;
    for (const source of sources) {
        if (source.trust === "untrusted" || source.trust === "external" || source.trust === "mcp_output" || source.trust === "terminal_output") riskScore += 25;
        if (source.labels.includes("prompt_injection")) riskScore += 45;
        if (source.labels.includes("secret_source")) riskScore += 35;
        if (source.labels.includes("production_source")) riskScore += 30;
        if (source.labels.includes("encoded_content")) riskScore += 20;
    }
    riskScore = Math.min(100, riskScore);
    return {
        tainted: riskScore >= 25,
        riskScore,
        labels,
        sources: sourceIds,
        explanation: labels.length ? `Action influenced by ${labels.join(", ")} from ${sourceIds.join(", ") || "trusted sources"}.` : "No tainted source influence detected.",
    };
}

export function evaluateTaintedAction(request: TaintedActionRequest): TaintedActionDecision {
    const assessment = assessTaint(request.sources);
    const highRiskAction = request.actionType === "terminal_command" || request.actionType === "network_request" || request.actionType === "mcp_tool_call";
    const riskScore = Math.max(request.riskScore ?? 0, highRiskAction && assessment.tainted ? Math.max(assessment.riskScore, 65) : assessment.riskScore);
    const policy = new RuntimePolicyEngine().evaluate({
        actionType: request.actionType,
        protectionMode: request.protectionMode ?? "standard",
        coverageLevel: request.coverageLevel ?? "STRONG_ENFORCEMENT",
        riskScore,
        categories: assessment.labels,
        parserStatus: "parsed",
        reversible: false,
        taintedByPromptInjection: assessment.labels.includes("prompt_injection") || assessment.labels.includes("untrusted_instruction"),
        productionContext: assessment.labels.includes("production_source"),
    });

    const reasonCodes: string[] = [...policy.reasonCodes];
    if (assessment.tainted) reasonCodes.unshift("TAINTED_SOURCE_INFLUENCE");
    return {
        action: policy.action,
        riskScore,
        reasonCodes: [...new Set(reasonCodes)],
        coverageLevel: request.coverageLevel ?? "STRONG_ENFORCEMENT",
        assessment,
        deterministic: true,
    };
}
