import { type EnforcementAction, type ProtectionMode, type RuntimeCoverageLevel } from "./RuntimePolicyEngine";
export interface NetworkEgressRequest {
    url: string;
    method?: string;
    payloadPreview?: string;
    allowedHosts?: string[];
    protectionMode?: ProtectionMode;
    coverageLevel?: RuntimeCoverageLevel;
    redirectChain?: string[];
    sourceClassifications?: string[];
}
export interface NetworkEgressDecision {
    action: EnforcementAction;
    riskScore: number;
    coverageLevel: RuntimeCoverageLevel;
    destinationTrust: "approved" | "unknown" | "untrusted" | "private_network" | "cloud_metadata";
    normalizedUrl?: string;
    host?: string;
    reasonCodes: string[];
    categories: string[];
    redactedPayloadPreview?: string;
    explanation: string;
    deterministic: true;
}
export declare function evaluateNetworkEgress(request: NetworkEgressRequest): NetworkEgressDecision;
//# sourceMappingURL=NetworkEgressPolicy.d.ts.map