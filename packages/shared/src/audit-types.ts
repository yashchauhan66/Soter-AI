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
  integrity?: ExtensionIntegrityReport;
}

/**
 * Runtime self-integrity/tamper signal the extension reports on each heartbeat.
 * This is best-effort tamper VISIBILITY (not prevention): it lets admins see when
 * a managed extension is running degraded — required host permissions revoked,
 * the signed policy failing verification, or the extension unable to reach policy.
 */
export interface ExtensionIntegrityReport {
  /** All host_permissions the extension declares are still granted. */
  hostPermissionsGranted: boolean;
  /** Count of declared origins the browser is NOT granting (revoked/removed). */
  missingHostPermissions: number;
  /** Last signed-policy signature verification result (false if verification failed). */
  policySignatureValid: boolean;
  /** Extension could reach the policy service on last sync attempt. */
  policyReachable: boolean;
  /** Overall verdict the extension computed for itself. */
  healthy: boolean;
}
