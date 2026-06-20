export type SemanticSensitivityLevel = "PUBLIC" | "INTERNAL" | "PRIVATE" | "CONFIDENTIAL" | "SECRET" | "REGULATED" | "SYSTEM_PROMPT";
export type SemanticDestinationType = "FINAL_OUTPUT" | "PUBLIC_OUTPUT" | "EXTERNAL_API" | "EMAIL" | "BROWSER_FORM" | "WEBHOOK" | "TOOL" | "MEMORY" | "FILE" | "CUSTOM";
export type SemanticEgressDecision = "ALLOW" | "BLOCK" | "REDACT" | "ASK_APPROVAL" | "REVIEW";
export type SemanticEgressRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export interface SemanticEgressClientOptions {
    apiKey: string;
    baseUrl?: string;
    timeoutMs?: number;
    fetch?: typeof fetch;
    headers?: Record<string, string>;
}
export interface FingerprintSemanticSourceRequest {
    sourceId: string;
    sourceType: string;
    sensitivityLevel: SemanticSensitivityLevel;
    content: string;
    metadata?: Record<string, unknown>;
}
export interface CheckSemanticEgressRequest {
    sessionId: string;
    sourceIds?: string[];
    destinationType: SemanticDestinationType;
    destinationName?: string;
    content: string;
    metadata?: Record<string, unknown>;
}
export interface CheckSemanticEgressResponse {
    checkId: string;
    sessionId: string;
    decision: SemanticEgressDecision;
    riskLevel: SemanticEgressRiskLevel;
    semanticRiskScore: number;
    reason: string;
    findings: unknown[];
    matchedSources: unknown[];
    contentRedacted: string;
}
export declare function fingerprintSemanticSource(options: SemanticEgressClientOptions, input: FingerprintSemanticSourceRequest): Promise<unknown>;
export declare function checkSemanticEgress(options: SemanticEgressClientOptions, input: CheckSemanticEgressRequest): Promise<CheckSemanticEgressResponse>;
export declare function listSemanticEgressChecks(options: SemanticEgressClientOptions): Promise<unknown>;
//# sourceMappingURL=semantic-egress.d.ts.map