import { type EnforcementAction, type ProtectionMode, type RuntimeCoverageLevel } from "./RuntimePolicyEngine";
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
export declare function assessTaint(sources: TaintedSource[]): TaintAssessment;
export declare function evaluateTaintedAction(request: TaintedActionRequest): TaintedActionDecision;
//# sourceMappingURL=TaintEngine.d.ts.map