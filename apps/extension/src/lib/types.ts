import type { DetectorFinding } from "../../../../packages/detectors/src/core";
import type { ExtensionOrgPolicy, PolicyAction, PolicyEvaluationResult } from "../../../../packages/policy-engine/src/types";

export type BrowserName = "chrome" | "edge" | "unknown";
export type ScanEventType = "scan" | "submit" | "paste" | "context_menu" | "heartbeat" | "approval_request" | "file_upload" | "response";

export interface ExtensionConfig {
  apiBaseUrl: string;
  organizationId: string;
  organizationName?: string;
  employeeId: string;
  employeeEmail?: string;
  department?: string;
  role?: string;
  deviceToken?: string;
  policySigningSecret?: string;
}

export type EnrollmentStatus = "enrolled" | "pending" | "expired" | "unenrolled";
export type EnrollmentMode = "managed" | "self_service" | undefined;

export interface ExtensionState {
  enabled: boolean;
  config: ExtensionConfig;
  policySyncStatus: "never" | "fresh" | "stale" | "offline" | "error";
  lastHeartbeatAt?: string;
  latestScan?: ScanResult;
  policy?: ExtensionOrgPolicy;
  enrollmentStatus?: EnrollmentStatus;
  enrollmentMode?: EnrollmentMode;
}

export interface ScanResult {
  textHash?: string;
  length?: number;
  hasFindings: boolean;
  riskScore: number;
  detectedDataTypes: string[];
  findings: DetectorFinding[];
  action: PolicyAction;
  policy: PolicyEvaluationResult;
  redactedText: string;
  rewrittenSafeText: string;
  scannedAt: string;
}

export interface RuntimeLineageContext {
  sourceDomain: string;
  sourceApp: string;
  sourceCategory: string;
  sourceUrlHash: string;
  sourceTitle?: string;
  selectedTextHash: string;
  detectedDataTypes: string[];
  redactedPreview?: string;
  createdAt: string;
  expiresAt: string;
}

export interface RuntimeScanRequest {
  text: string;
  url: string;
  eventType: ScanEventType;
  lineageContext?: RuntimeLineageContext | null;
}

export interface RuntimeScanResponse {
  ok: true;
  result: ScanResult;
}

export interface RuntimeErrorResponse {
  ok: false;
  message: string;
}

export type RuntimeResponse = RuntimeScanResponse | RuntimeErrorResponse;
