export type AgentIdentityType = "CHATBOT" | "RAG_AGENT" | "COMPUTER_USE" | "BROWSER_AGENT" | "MCP_AGENT" | "CODING_AGENT" | "CUSTOM";
export type AgentIdentityStatus = "ACTIVE" | "DISABLED" | "QUARANTINED";
export type AgentPassportDecision = "ALLOW" | "BLOCK" | "ASK_APPROVAL";
export type AgentPassportRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export interface AgentPassportClientOptions {
    apiKey: string;
    baseUrl?: string;
    timeoutMs?: number;
    fetch?: typeof fetch;
    headers?: Record<string, string>;
}
export interface AgentPassportPolicyInput {
    allowedTools?: string[];
    blockedTools?: string[];
    approvalRequiredTools?: string[];
    allowedDomains?: string[];
    blockedDomains?: string[];
    dataScopes?: string[];
    memoryScopes?: string[];
}
export interface CreateAgentIdentityRequest {
    name: string;
    agentType?: AgentIdentityType;
    description?: string;
    status?: AgentIdentityStatus;
    defaultPolicy?: AgentPassportPolicyInput;
}
export interface IssueAgentPassportRequest extends AgentPassportPolicyInput {
    agentIdentityId: string;
    sessionId?: string;
    ttlSeconds?: number;
    expiresAt?: string;
    metadata?: Record<string, unknown>;
}
export interface ValidateAgentPassportRequest {
    sessionId: string;
    passportToken?: string;
    tool?: string;
    action?: string;
    target?: string;
    domain?: string;
    metadata?: Record<string, unknown>;
}
export interface RevokeAgentPassportRequest {
    sessionId?: string;
    passportId?: string;
    reason?: string;
    metadata?: Record<string, unknown>;
}
export interface AgentPassportValidationResponse {
    decision: AgentPassportDecision;
    riskLevel: AgentPassportRiskLevel;
    reason: string;
    policyMatches: Array<{
        id: string;
        label: string;
        severity: AgentPassportRiskLevel;
    }>;
    passportId?: string;
    agentIdentityId?: string;
    sessionId?: string;
    expiresAt?: string;
}
export declare function createAgentIdentity(options: AgentPassportClientOptions, input: CreateAgentIdentityRequest): Promise<unknown>;
export declare function issueAgentPassport(options: AgentPassportClientOptions, input: IssueAgentPassportRequest): Promise<unknown>;
export declare function validateAgentPassport(options: AgentPassportClientOptions, input: ValidateAgentPassportRequest): Promise<AgentPassportValidationResponse>;
export declare function revokeAgentPassport(options: AgentPassportClientOptions, input: RevokeAgentPassportRequest): Promise<unknown>;
export declare function getAgentPassport(options: AgentPassportClientOptions, sessionId: string): Promise<unknown>;
//# sourceMappingURL=agent-passport.d.ts.map