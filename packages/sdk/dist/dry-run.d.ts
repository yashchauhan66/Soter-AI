export type AgentDryRunType = "EMAIL" | "FORM_SUBMIT" | "TERMINAL" | "FILE_WRITE" | "FILE_DELETE" | "API_CALL" | "PAYMENT" | "PACKAGE_INSTALL" | "DATABASE_WRITE" | "CUSTOM";
export type AgentDryRunDecision = "SAFE_TO_EXECUTE" | "REQUIRE_APPROVAL" | "BLOCK" | "REVIEW";
export type AgentDryRunRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export interface DryRunClientOptions {
    apiKey: string;
    baseUrl?: string;
    timeoutMs?: number;
    fetch?: typeof fetch;
    headers?: Record<string, string>;
}
export interface SimulateAgentActionRequest {
    sessionId: string;
    agentIdentityId?: string;
    dryRunType: AgentDryRunType;
    tool: string;
    action: string;
    target?: string;
    simulatedPayload?: string;
    metadata?: Record<string, unknown>;
}
export interface SimulateAgentActionResponse {
    dryRunId: string;
    sessionId: string;
    decision: AgentDryRunDecision;
    riskLevel: AgentDryRunRiskLevel;
    reason: string;
    findings: string[];
    simulatedPayloadRedacted: string | null;
    simulatedEffects: Record<string, unknown>;
}
export declare function simulateAgentAction(options: DryRunClientOptions, input: SimulateAgentActionRequest): Promise<SimulateAgentActionResponse>;
export declare function getDryRun(options: DryRunClientOptions, dryRunId: string): Promise<unknown>;
export declare function getDryRunSession(options: DryRunClientOptions, sessionId: string): Promise<unknown>;
//# sourceMappingURL=dry-run.d.ts.map