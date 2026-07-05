// ─── Guard Decision Types ───────────────────────────────────────────────────

export type GuardAction = "allow" | "warn" | "redact" | "block" | "approval_required";
export type Severity = "info" | "low" | "medium" | "high" | "critical";

export interface Finding {
    id: string;
    category: string;
    severity: Severity;
    title: string;
    reason: string;
    redactedEvidence: string;
    start?: number;
    end?: number;
    confidence: number;
}

export interface GuardDecision {
    decision: GuardAction;
    riskScore: number;
    severity: Severity;
    categories: string[];
    findings: Finding[];
    redactedText?: string;
    evidencePreview?: string;
    inputHash: string;
    detectorVersions: Record<string, string>;
    localOnly: boolean;
    createdAt: string;
}

// ─── Detector Infrastructure ────────────────────────────────────────────────

export type DetectorSeverity = "low" | "medium" | "high" | "critical";

export interface DetectorMatch {
    type: string;
    label: string;
    severity: DetectorSeverity;
    score: number;
    start: number;
    end: number;
    match: string;
    message: string;
    confidence: number;
}

export interface RegexDetectorSpec {
    type: string;
    label: string;
    severity: DetectorSeverity;
    score: number;
    pattern: RegExp;
    message: string;
    confidence?: number;
    validator?: (match: string) => boolean;
}

export interface DetectorResult {
    detectorName: string;
    detectorVersion: string;
    matches: DetectorMatch[];
}

// ─── Policy Types ───────────────────────────────────────────────────────────

export interface PolicyRule {
    id: string;
    name: string;
    action: GuardAction;
    severity?: Severity;
    categories?: string[];
    minRiskScore?: number;
    enabled?: boolean;
}

export interface PolicyConfig {
    version: string;
    enabled: boolean;
    mode: "local" | "team" | "enterprise";
    defaultAction: GuardAction;
    riskThresholds: {
        warn: number;
        redact: number;
        block: number;
        approvalRequired: number;
    };
    rules: PolicyRule[];
    maxContentLength: number;
    updatedAt: string;
}

// ─── Hash Cache Types ───────────────────────────────────────────────────────

export interface CachedDecision {
    decision: GuardDecision;
    cachedAt: number;
    policyVersion: string;
    detectorVersions: Record<string, string>;
}

export interface HashCacheConfig {
    ttlMs: number;
    maxEntries: number;
    policyVersion: string;
    detectorVersions: Record<string, string>;
}

// ─── Event Types ────────────────────────────────────────────────────────────

export interface RedactedEvent {
    eventId: string;
    workspacePseudoId: string;
    projectId?: string;
    policyVersion: string;
    detectorVersions: Record<string, string>;
    eventType: string;
    decision: GuardAction;
    categories: string[];
    severity: Severity;
    riskScore: number;
    redactedEvidencePreview?: string;
    contentLength: number;
    localOnly: boolean;
    timestamp: string;
}

// ─── Content Scanner Types ──────────────────────────────────────────────────

export interface ScanOptions {
    maxContentLength?: number;
    enabledDetectors?: string[];
    skipCache?: boolean;
    context?: "file" | "selection" | "prompt" | "terminal" | "git" | "workspace";
}

export interface FileRiskResult {
    filePath: string;
    riskScore: number;
    findings: Finding[];
    categories: string[];
    size: number;
    skipped: boolean;
    skipReason?: string;
}

export interface WorkspaceScanResult {
    totalFiles: number;
    scannedFiles: number;
    skippedFiles: number;
    overallRiskScore: number;
    fileResults: FileRiskResult[];
    categories: string[];
    scanDurationMs: number;
}
