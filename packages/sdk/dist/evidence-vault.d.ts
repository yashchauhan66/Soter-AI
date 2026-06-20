export type ComplianceEvidenceType = "POLICY" | "GUARD_DECISION" | "REDACTION" | "APPROVAL" | "INCIDENT" | "RAG_SCAN" | "AGENT_PASSPORT" | "TOOL_CHAIN" | "CANARY" | "RED_TEAM" | "DATA_FLOW" | "COST_CONTROL" | "CUSTOM";
export type ComplianceEvidenceStatus = "ACTIVE" | "PASS" | "FAIL" | "WARNING" | "RESOLVED";
export type ComplianceEvidenceReportType = "SECURITY_POSTURE" | "INCIDENT_SUMMARY" | "CUSTOMER_TRUST" | "AUDIT_EXPORT" | "AI_RISK_REVIEW";
export type ComplianceRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export interface EvidenceVaultClientOptions {
    apiKey: string;
    baseUrl?: string;
    timeoutMs?: number;
    fetch?: typeof fetch;
    headers?: Record<string, string>;
}
export interface CollectComplianceEvidenceRequest {
    evidenceType?: ComplianceEvidenceType;
    title?: string;
    summary?: string;
    riskLevel?: ComplianceRiskLevel;
    controlName?: string;
    status?: ComplianceEvidenceStatus;
    evidence?: Record<string, unknown>;
    autoCollect?: boolean;
    include?: ComplianceEvidenceType[];
}
export interface GenerateEvidenceReportRequest {
    reportName: string;
    reportType?: ComplianceEvidenceReportType;
    evidenceIds?: string[];
    includeTypes?: ComplianceEvidenceType[];
}
export declare function collectComplianceEvidence(options: EvidenceVaultClientOptions, input: CollectComplianceEvidenceRequest): Promise<unknown>;
export declare function listComplianceEvidenceItems(options: EvidenceVaultClientOptions): Promise<unknown>;
export declare function generateEvidenceReport(options: EvidenceVaultClientOptions, input: GenerateEvidenceReportRequest): Promise<unknown>;
export declare function listEvidenceReports(options: EvidenceVaultClientOptions): Promise<unknown>;
export declare function getEvidenceReport(options: EvidenceVaultClientOptions, reportId: string): Promise<unknown>;
export declare function exportEvidenceReport(options: EvidenceVaultClientOptions, reportId: string): Promise<unknown>;
//# sourceMappingURL=evidence-vault.d.ts.map