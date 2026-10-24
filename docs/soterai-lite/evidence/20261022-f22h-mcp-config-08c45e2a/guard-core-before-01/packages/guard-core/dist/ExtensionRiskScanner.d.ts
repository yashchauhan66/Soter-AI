export declare const EXTENSION_RISK_SCANNER_VERSION = "1.0.0";
/** Minimal, provider-agnostic view of an installed extension's metadata. */
export interface ExtensionMetadata {
    /** Fully-qualified id, e.g. "anthropic.claude-code". */
    id: string;
    displayName?: string;
    publisher?: string;
    /** Whether VS Code ships this extension (built-in). Built-ins are trusted. */
    isBuiltin?: boolean;
    version?: string;
    /** Relevant fields pulled from the extension's package.json manifest. */
    packageJSON?: {
        displayName?: string;
        description?: string;
        publisher?: string;
        categories?: string[];
        activationEvents?: string[];
        main?: string;
        browser?: string;
        extensionDependencies?: string[];
        extensionPack?: string[];
        contributes?: Record<string, unknown>;
        repository?: unknown;
        __metadata?: {
            isVerified?: boolean;
            publisherDisplayName?: string;
        };
    };
}
export type ExtensionRiskLevel = "info" | "low" | "medium" | "high";
export interface ExtensionRiskSignal {
    code: string;
    label: string;
    weight: number;
}
export interface ExtensionRiskAssessment {
    id: string;
    displayName: string;
    publisher: string;
    isAI: boolean;
    isBuiltin: boolean;
    riskScore: number;
    level: ExtensionRiskLevel;
    signals: ExtensionRiskSignal[];
    /** Practical, non-accusatory recommendation for the user. */
    recommendation: string;
}
export interface ExtensionScanReport {
    scannerVersion: string;
    total: number;
    aiExtensions: number;
    highRisk: number;
    assessments: ExtensionRiskAssessment[];
}
/** Assess a single extension. Built-ins short-circuit to info-level. */
export declare function assessExtension(meta: ExtensionMetadata): ExtensionRiskAssessment;
/** Assess every installed extension and roll up totals. */
export declare function scanExtensions(metas: ExtensionMetadata[]): ExtensionScanReport;
//# sourceMappingURL=ExtensionRiskScanner.d.ts.map