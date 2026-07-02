import type { ExtensionAuditEvent, ExtensionHeartbeat } from "./audit-types";
import type { ExtensionOrgPolicy, PolicyEvaluationResult } from "./policy-types";

export interface DetectorFinding {
  type: string;
  label: string;
  severity: "low" | "medium" | "high" | "critical";
  score: number;
  start: number;
  end: number;
  match: string;
  message: string;
}

export interface ScanResult {
  hasFindings: boolean;
  riskScore: number;
  detectedDataTypes: string[];
  findings: DetectorFinding[];
  redactedText: string;
  rewrittenSafeText: string;
  policy: PolicyEvaluationResult;
  scannedAt: string;
}

export interface ExtensionState {
  enabled: boolean;
  organizationId: string;
  employeeId?: string;
  department?: string;
  role?: string;
  policySyncStatus: "never" | "fresh" | "stale" | "offline" | "error";
  lastHeartbeatAt?: string;
  latestScan?: ScanResult;
  policy?: ExtensionOrgPolicy;
}

export type ExtensionMessage =
  | { type: "SOTER_SCAN_TEXT"; text: string; url: string; eventType: ExtensionAuditEvent["eventType"] }
  | { type: "SOTER_GET_STATE" }
  | { type: "SOTER_SET_STATE"; state: Partial<ExtensionState> }
  | { type: "SOTER_REQUEST_APPROVAL"; text: string; url: string; justification?: string }
  | { type: "SOTER_HEARTBEAT"; heartbeat?: Partial<ExtensionHeartbeat> };
