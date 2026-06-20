export type ToolChainSourceType = "PUBLIC_DATA" | "PRIVATE_DATA" | "RAG_DOCUMENT" | "RAG_CONFIDENTIAL" | "MEMORY" | "FILE" | "TERMINAL" | "BROWSER_PAGE" | "BROWSER_PAGE_UNTRUSTED" | "MCP_TOOL" | "MCP_TOOL_CHANGED" | "SYSTEM_PROMPT" | "SECRET" | "UNKNOWN";
export type ToolChainDestinationType = "INTERNAL" | "FINAL_OUTPUT" | "EXTERNAL_EMAIL" | "EMAIL_SEND" | "EXTERNAL_API" | "EXTERNAL_POST" | "UNKNOWN_TOOL" | "TOOL_CALL" | "NETWORK_POST" | "MEMORY" | "FILE" | "DATABASE" | "NONE" | "UNKNOWN";
export type ToolChainDataSensitivity = "PUBLIC" | "INTERNAL" | "PRIVATE" | "CONFIDENTIAL" | "SECRET" | "SYSTEM_PROMPT" | "REGULATED" | "UNKNOWN";
export type ToolChainDecision = "ALLOW" | "BLOCK" | "ASK_APPROVAL" | "REVIEW";
export type ToolChainRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export interface ToolChainClientOptions {
    apiKey: string;
    baseUrl?: string;
    timeoutMs?: number;
    fetch?: typeof fetch;
    headers?: Record<string, string>;
}
export interface StartToolChainSessionRequest {
    sessionId?: string;
    agentIdentityId?: string;
    metadata?: Record<string, unknown>;
}
export interface CheckToolChainStepRequest {
    sessionId: string;
    tool: string;
    action: string;
    sourceType?: ToolChainSourceType;
    destinationType?: ToolChainDestinationType;
    dataSensitivity?: ToolChainDataSensitivity;
    metadata?: Record<string, unknown>;
}
export interface ToolChainFinding {
    findingType: string;
    riskLevel: ToolChainRiskLevel;
    summary: string;
    involvedSteps: number[];
    recommendation: string;
}
export interface CheckToolChainStepResponse {
    stepId: string;
    sessionId: string;
    decision: ToolChainDecision;
    riskLevel: ToolChainRiskLevel;
    reason: string;
    findings: ToolChainFinding[];
    findingIds: string[];
}
export declare function startToolChainSession(options: ToolChainClientOptions, input?: StartToolChainSessionRequest): Promise<unknown>;
export declare function checkToolChainStep(options: ToolChainClientOptions, input: CheckToolChainStepRequest): Promise<CheckToolChainStepResponse>;
export declare function getToolChainSession(options: ToolChainClientOptions, sessionId: string): Promise<unknown>;
export declare function getToolChainFindings(options: ToolChainClientOptions, sessionId?: string): Promise<unknown>;
//# sourceMappingURL=tool-chain.d.ts.map