import { type MCPPermission, type MCPServerAssessment } from "./MCPPolicyAnalyzer";
import { type EnforcementAction, type ProtectionMode } from "./RuntimePolicyEngine";
import { type TaintedSource } from "./TaintEngine";
export interface MCPGatewayRequest {
    mcpConfig?: string | Record<string, unknown>;
    serverName: string;
    toolName: string;
    args: Record<string, unknown>;
    protectionMode?: ProtectionMode;
    allowedPermissions?: MCPPermission[];
    taintedSources?: TaintedSource[];
    /**
     * Honesty declaration by the CALLER: set true only when the caller
     * mechanically gates tool execution on this decision (a DENY makes the
     * invocation impossible). Every current caller (broker preflight, VS Code
     * QuickPick) is advisory, so the default is false → DETECTION_ONLY.
     */
    callerEnforcesPreExecution?: boolean;
}
export interface MCPGatewayDecision {
    action: EnforcementAction;
    riskScore: number;
    coverageLevel: "STRONG_ENFORCEMENT" | "DETECTION_ONLY";
    server?: MCPServerAssessment;
    reasonCodes: string[];
    categories: string[];
    redactedArgsPreview: string;
    explanation: string;
    deterministic: true;
}
export declare function evaluateMCPToolInvocation(request: MCPGatewayRequest): MCPGatewayDecision;
//# sourceMappingURL=MCPGateway.d.ts.map