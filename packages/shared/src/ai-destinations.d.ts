import type { PolicyAction } from "../../policy-engine/src/types";
export type AIDestinationCategory = "public_ai" | "browser_coding" | "local_ai" | "ide" | "cli_api" | "custom";
export type DestinationRiskLevel = "low" | "medium" | "high" | "critical";
export type DestinationLoggingMode = "metadata_only" | "redacted_prompt" | "disabled" | "full_prompt_explicit_admin_enabled";
export interface AIDestinationPolicy {
    id: string;
    destinationId: string;
    organizationId?: string;
    name: string;
    category: AIDestinationCategory;
    domains: string[];
    urlPatterns: string[];
    defaultRiskLevel: DestinationRiskLevel;
    riskLevel?: DestinationRiskLevel;
    enabled: boolean;
    allowedDepartments: string[];
    allowedRoles: string[];
    policyOverrides: Record<string, PolicyAction>;
    responseScanningEnabled: boolean;
    loggingMode: DestinationLoggingMode;
    createdAt?: string;
    updatedAt?: string;
}
export declare const BUILT_IN_AI_DESTINATIONS: Omit<AIDestinationPolicy, "organizationId">[];
export declare function matchAIDestination(urlValue: string, destinations: AIDestinationPolicy[], department?: string, role?: string): AIDestinationPolicy | undefined;
export declare function isLocalAIUrl(urlValue: string): boolean;
export declare function urlPatternMatches(url: URL, pattern: string): boolean;
//# sourceMappingURL=ai-destinations.d.ts.map