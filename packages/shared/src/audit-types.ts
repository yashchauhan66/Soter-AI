import type { PolicyAction, PolicySeverity } from "./policy-types";

export interface ExtensionAuditEvent {
  organizationId: string;
  employeeId?: string;
  extensionVersion: string;
  browser: "chrome" | "edge" | "unknown";
  domain: string;
  url?: string;
  policyVersion: string;
  action: PolicyAction;
  severity: PolicySeverity;
  riskScore: number;
  detectedDataTypes: string[];
  matchedRules: string[];
  redactedPreview?: string;
  eventType: "scan" | "submit" | "paste" | "context_menu" | "heartbeat" | "approval_request" | "file_upload" | "response";
  occurredAt: string;
  metadata?: Record<string, unknown>;
}

export interface ExtensionHeartbeat {
  organizationId: string;
  employeeId?: string;
  extensionVersion: string;
  browser: "chrome" | "edge" | "unknown";
  policyVersion: string;
  domain?: string;
  lastActiveAt: string;
  lockdownEnabled?: boolean;
}
