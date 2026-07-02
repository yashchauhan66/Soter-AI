import type { PolicyAction, PolicySeverity } from "@/packages/policy-engine/src/types";

export { type PolicyAction, type PolicySeverity };

export type PolicyMode = "template" | "custom";
export type PolicyScopeType = "all" | "department" | "role" | "selected_users";
export type PolicyLogMode = "metadata_only" | "redacted_prompt" | "full_prompt_only_if_enabled_by_admin";
export type DestinationRiskLevel = "all" | "approved" | "known_public" | "unknown";
export type DetectionMethodType = "keyword" | "regex" | "domain" | "file_name" | "document_fingerprint" | "semantic_classifier";

export interface PolicyScope {
  type: PolicyScopeType;
  departments: string[];
  roles: string[];
  users: string[];
}

export interface PolicyDestinations {
  preset: string;
  domains: string[];
  riskLevel: DestinationRiskLevel;
}

export interface PolicyDetectionConfig {
  detectorKeys: string[];
  keywords: string[];
  regex: string[];
  domains: string[];
  fileNames: string[];
  documentFingerprints: string[];
  semanticCategories: string[];
  scanResponses?: boolean;
}

export interface AdminAiPolicy {
  id: string;
  organizationId: string;
  name: string;
  description: string;
  enabled: boolean;
  mode: PolicyMode;
  severity: PolicySeverity;
  action: PolicyAction;
  scope: PolicyScope;
  destinations: PolicyDestinations;
  detectionConfig: PolicyDetectionConfig;
  logMode: PolicyLogMode;
  version: number;
  createdBy?: string | null;
  updatedBy?: string | null;
  publishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminPolicyTemplate {
  id: string;
  key: string;
  name: string;
  description: string;
  category: string;
  defaultSeverity: PolicySeverity;
  defaultAction: PolicyAction;
  detectorKeys: string[];
  enabledByDefault: boolean;
}

export interface PolicyVersion {
  id: string;
  policyId: string;
  organizationId: string;
  version: number;
  snapshot: AdminAiPolicy;
  publishedBy?: string | null;
  publishedAt: string;
  rollbackFromVersion?: number | null;
}

export interface PolicyAuditLog {
  id: string;
  organizationId: string;
  adminUserId?: string | null;
  action: string;
  policyId?: string | null;
  before?: unknown;
  after?: unknown;
  createdAt: string;
}

export interface PolicyTestInput {
  policy: AdminAiPolicy;
  sampleText: string;
  destinationDomain?: string;
  department?: string;
  role?: string;
  userId?: string;
  fileName?: string;
}

export interface PolicyTestResult {
  matched: boolean;
  matchedRules: string[];
  action: PolicyAction;
  severity: PolicySeverity;
  detectedDataTypes: string[];
  redactedOutput: string;
  rewrittenSafeOutput: string;
  logPreview: string;
}

export interface ExtensionCompiledPolicy {
  id: string;
  name: string;
  enabled: boolean;
  severity: PolicySeverity;
  action: PolicyAction;
  detectors: string[];
  scope: {
    departments: string[];
    roles: string[];
    users: string[];
  };
  destinations: string[];
  logMode: PolicyLogMode;
}

export interface ExtensionCompiledPolicyBundle {
  organizationId: string;
  version: number;
  publishedAt: string | null;
  defaultAction: PolicyAction;
  policies: ExtensionCompiledPolicy[];
  customDetectors: {
    keywords: string[];
    regex: string[];
    documentFingerprints: string[];
  };
}
