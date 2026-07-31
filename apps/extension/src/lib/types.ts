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
  /** Legacy symmetric policy secret. Retained for existing deployments only. */
  policySigningSecret?: string;
  /** Asymmetric trusted policy keys (base64 SPKI, ECDSA P-256). Preferred. */
  policyTrustedKeys?: PolicyTrustedKeyConfig[];
  /** When true, an unverified policy bundle is refused outright (fail closed). */
  requirePolicySignature?: boolean;
  /** Enterprise enforcement flags pushed via managed config (Intune/GPO/MDM). */
  hardEnforcement?: boolean;
  offlineFailClosed?: boolean;
  /**
   * Origin the extension is pinned to. Once set, `apiBaseUrl` may not change to a
   * different origin — not by user entry and not by a server response.
   */
  pinnedApiOrigin?: string;
}

export interface PolicyTrustedKeyConfig {
  keyId: string;
  algorithm: "ecdsa-p256-sha256" | "hmac-sha256";
  /** Base64 SPKI public key, or the shared secret for the legacy HMAC algorithm. */
  publicKey: string;
}

export type EnrollmentStatus = "enrolled" | "pending" | "expired" | "unenrolled";
export type EnrollmentMode = "managed" | "self_service" | undefined;

/** Persisted anti-rollback / trust-ratchet state for policy bundles. */
export interface PolicyTrustRecord {
  /** Highest `issuedAt` of a bundle that verified. Older bundles are refused. */
  lastAcceptedIssuedAt?: string;
  /** Once true, unsigned bundles are permanently refused for this profile. */
  signedBundleSeen?: boolean;
}

/** Result of the last policy-integrity check. Never contains policy content. */
export interface PolicyIntegrityRecord {
  /** Cryptographically proven, not merely accepted. */
  verified: boolean;
  code:
    | "ok"
    | "unsigned"
    | "malformed"
    | "unsupported_algorithm"
    | "key_missing"
    | "organization_mismatch"
    | "hash_mismatch"
    | "signature_mismatch"
    | "rollback";
  reason?: string;
  checkedAt: string;
  /** Content hash of the body that was verified, for diagnostics only. */
  contentHash?: string;
}

export interface ExtensionState {
  enabled: boolean;
  config: ExtensionConfig;
  policySyncStatus: "never" | "fresh" | "stale" | "offline" | "error";
  lastHeartbeatAt?: string;
  latestScan?: ScanResult;
  policy?: ExtensionOrgPolicy;
  enrollmentStatus?: EnrollmentStatus;
  enrollmentMode?: EnrollmentMode;
  policyTrust?: PolicyTrustRecord;
  policyIntegrity?: PolicyIntegrityRecord;
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
