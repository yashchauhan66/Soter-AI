export type AgentIntentCategory = "READ" | "SUMMARIZE" | "SEARCH" | "WRITE_DRAFT" | "SEND_MESSAGE" | "DELETE" | "MODIFY" | "PURCHASE" | "PAYMENT" | "LOGIN" | "EXPORT_DATA" | "CALL_EXTERNAL_API" | "RUN_CODE" | "INSTALL_PACKAGE" | "MEMORY_WRITE" | "UNKNOWN";
export type AgentIntentDecision = "ALLOW" | "BLOCK" | "ASK_APPROVAL" | "REVIEW";
export type AgentIntentRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export interface AgentIntentClientOptions {
    apiKey: string;
    baseUrl?: string;
    timeoutMs?: number;
    fetch?: typeof fetch;
    headers?: Record<string, string>;
}
export interface ExtractAgentIntentRequest {
    sessionId: string;
    userPrompt: string;
    allowedIntentCategories?: AgentIntentCategory[];
    forbiddenIntentCategories?: AgentIntentCategory[];
    metadata?: Record<string, unknown>;
}
export interface CheckIntentActionRequest {
    sessionId: string;
    intentRecordId?: string;
    tool: string;
    action: string;
    target?: string;
    actionDescription?: string;
    metadata?: Record<string, unknown>;
}
export interface ExtractedAgentIntent {
    primaryCategory: AgentIntentCategory;
    categories: AgentIntentCategory[];
    confidence: number;
    summary: string;
    signals: string[];
    injectionDetected: boolean;
}
export interface ExtractAgentIntentResponse {
    intentRecordId: string;
    projectId: string;
    sessionId: string;
    userPromptHash: string;
    userPromptRedacted: string;
    extractedIntent: ExtractedAgentIntent;
    allowedIntentCategories: AgentIntentCategory[];
    forbiddenIntentCategories: AgentIntentCategory[];
}
export interface CheckIntentActionResponse {
    actionCheckId: string;
    intentRecordId: string;
    sessionId: string;
    intentMatchScore: number;
    actionCategories: AgentIntentCategory[];
    decision: AgentIntentDecision;
    riskLevel: AgentIntentRiskLevel;
    reason: string;
    policyMatches: Array<{
        id: string;
        label: string;
        severity: AgentIntentRiskLevel;
    }>;
}
export declare function extractAgentIntent(options: AgentIntentClientOptions, input: ExtractAgentIntentRequest): Promise<ExtractAgentIntentResponse>;
export declare function checkIntentAction(options: AgentIntentClientOptions, input: CheckIntentActionRequest): Promise<CheckIntentActionResponse>;
export declare function getIntentSession(options: AgentIntentClientOptions, sessionId: string): Promise<unknown>;
//# sourceMappingURL=agent-intent.d.ts.map