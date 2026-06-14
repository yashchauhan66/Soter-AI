export const securityEventTypes = ["guard.blocked", "guard.redacted", "guard.human_review", "rag.document_quarantined", "rag.no_source_fallback", "webhook.failed", "billing.failed", "policy.changed", "admin.action", "auth.suspicious"] as const;
export type SecurityEventType = typeof securityEventTypes[number];
export type SecurityEventSeverity = "INFO" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface SecurityEventInput {
  organizationId: string;
  projectId?: string;
  eventType: SecurityEventType;
  severity: SecurityEventSeverity;
  riskTypes?: string[];
  action: string;
  source: string;
  timestamp?: string;
  metadata?: Record<string, unknown>;
}

export interface SecurityEvent extends SecurityEventInput { id: string; timestamp: string }
