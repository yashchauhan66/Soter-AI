import type { EnforcementAction, ProtectionMode } from "./RuntimePolicyEngine";
export interface ExtensionDescriptor {
    id: string;
    publisher?: string;
    displayName?: string;
    verifiedPublisher?: boolean;
    activationEvents?: string[];
    capabilities?: string[];
    aiLike?: boolean;
}
export interface ExtensionIsolationRequest {
    extensions: ExtensionDescriptor[];
    allowlist?: string[];
    blocklist?: string[];
    trustedPublishers?: string[];
    workspaceTrusted?: boolean;
    protectionMode?: ProtectionMode;
}
export interface ExtensionIsolationFinding {
    id: string;
    action: "ALLOW" | "ISOLATE" | "BLOCK";
    riskScore: number;
    categories: string[];
    reasonCodes: string[];
    recommendation: string;
}
export interface ExtensionIsolationDecision {
    action: EnforcementAction;
    deterministic: true;
    coverageLevel: "PARTIAL_VISIBILITY";
    riskScore: number;
    findings: ExtensionIsolationFinding[];
    allowlist: string[];
    blocklist: string[];
    workspaceRecommendations: string[];
    explanation: string;
}
export declare function evaluateExtensionIsolation(request: ExtensionIsolationRequest): ExtensionIsolationDecision;
//# sourceMappingURL=ExtensionIsolationPolicy.d.ts.map