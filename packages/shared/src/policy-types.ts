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

export type DestinationType = "public_ai" | "enterprise_ai" | "internal" | "unknown";

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
  updatedAt: string;
  signature?: string;
}

export interface PolicyEvaluationInput {
  organizationId: string;
  employeeId: string;
  department?: string;
  role?: string;
  destinationDomain: string;
  destinationType: DestinationType;
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
