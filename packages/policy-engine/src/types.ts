export type PolicyAction =
  | "allow"
  | "log_only"
  | "warn"
  | "redact"
  | "rewrite"
  | "block"
  | "require_justification"
  | "require_approval";

export type PolicySeverity = "info" | "low" | "medium" | "high" | "critical";
export type DestinationType = "public_ai" | "browser_coding" | "local_ai" | "ide" | "cli_api" | "enterprise_ai" | "internal" | "custom" | "unknown";

export interface ExtensionPolicyRule {
  id: string;
  name: string;
  action: PolicyAction;
  severity?: PolicySeverity;
  destinations?: string[];
  destinationTypes?: DestinationType[];
  departments?: string[];
  roles?: string[];
  detectedDataTypes?: string[];
  minRiskScore?: number;
  sourceApps?: string[];
  sourceCategories?: string[];
  destinationCategories?: string[];
  fileExtensions?: string[];
  minFileRiskScore?: number;
  minFingerprintSimilarity?: number;
  intent?: string[];
  userMessage?: string;
  adminMessage?: string;
  enabled?: boolean;
}

export interface ExtensionOrgPolicy {
  organizationId: string;
  version: string;
  enabled: boolean;
  allowedDomains: string[];
  monitoredDomains: string[];
  defaultAction: PolicyAction;
  maxPromptChars: number;
  riskThresholds: {
    warn: number;
    redact: number;
    block: number;
    requireApproval: number;
  };
  rules: ExtensionPolicyRule[];
  destinations?: import("../../shared/src/ai-destinations").AIDestinationPolicy[];
  updatedAt: string;
  signature?: string;
  policyHash?: string;
  emergencyLockdown?: EmergencyLockdownPolicy;
}

export interface EmergencyLockdownPolicy {
  enabled: boolean;
  policyVersion: number;
  reason?: string | null;
  enabledAt?: string | null;
  blockUnknownDestinations: true;
  blockAllFileUploads: true;
  blockedDataTypes: string[];
  requireApprovalDataTypes: string[];
  allowOnlyEnterpriseDestinations: true;
}

export interface PolicyEvaluationInput {
  organizationId: string;
  employeeId: string;
  department?: string;
  role?: string;
  destinationDomain: string;
  destinationType: DestinationType;
  sourceApp?: string;
  sourceCategory?: string;
  destinationApp?: string;
  destinationCategory?: string;
  fileMetadata?: {
    fileNameHash?: string;
    originalExtension?: string;
    mimeType?: string;
    sizeBytes?: number;
    supported?: boolean;
  };
  fileScanResult?: {
    riskScore: number;
    detectedDataTypes: string[];
    supported: boolean;
    encryptedOrBinary?: boolean;
  };
  fingerprintMatches?: Array<{
    matchedFingerprintSetId: string;
    similarityScore: number;
    sensitivity: string;
    recommendedAction: PolicyAction;
  }>;
  lineageContext?: {
    sourceApp?: string;
    sourceCategory?: string;
    sourceUrlHash?: string;
  };
  text: string;
  detectedDataTypes: string[];
  riskScore: number;
  intent?: string;
  customRules?: ExtensionPolicyRule[];
  defaultOrgPolicy: ExtensionOrgPolicy;
}

export interface PolicyEvaluationResult {
  action: PolicyAction;
  severity: PolicySeverity;
  matchedRules: Array<{ id: string; name: string; action: PolicyAction; severity: PolicySeverity }>;
  userMessage: string;
  adminMessage: string;
  redactedText: string;
  rewrittenSafeText: string;
  auditMetadata: Record<string, unknown>;
}
