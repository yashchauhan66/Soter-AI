import type { ExtensionAuditEvent, ExtensionHeartbeat } from "../../../../packages/shared/src/audit-types";
import type { ExtensionOrgPolicy } from "../../../../packages/policy-engine/src/types";
import type { ExtensionConfig, ScanResult } from "./types";
import type { SourceAppConfig } from "./source-apps";
import type { FingerprintRecord, LocalFingerprintMatch } from "./fingerprint-matcher";
import type { AIDestinationPolicy } from "../../../../packages/shared/src/ai-destinations";
import { assertNoRawSensitiveData, createPrivacySafePreview, redactSensitiveText, sanitizePrivacyPayload } from "../../../../packages/shared/src/privacy";
import { assertTrustedEndpoint, buildTrustedUrl } from "./trusted-endpoint";
import { previewForScan } from "./privacy-preview";

export class SoterExtensionApiClient {
  constructor(private readonly config: ExtensionConfig) {}

  async fetchPolicy(): Promise<ExtensionOrgPolicy> {
    const url = new URL("/api/extension/policy", this.config.apiBaseUrl);
    url.searchParams.set("organizationId", this.config.organizationId);
    const response = await this.request(url, { method: "GET" });
    return response.json() as Promise<ExtensionOrgPolicy>;
  }

  async fetchDestinations(): Promise<AIDestinationPolicy[]> {
    const url = new URL("/api/extension/destinations", this.config.apiBaseUrl);
    url.searchParams.set("organizationId", this.config.organizationId);
    const response = await this.request(url, { method: "GET" });
    const body = await response.json() as { destinations: AIDestinationPolicy[] };
    return body.destinations;
  }

  async fetchSourceApps(): Promise<SourceAppConfig[]> {
    const url = new URL("/api/extension/source-apps", this.config.apiBaseUrl);
    url.searchParams.set("organizationId", this.config.organizationId);
    const response = await this.request(url, { method: "GET" });
    const body = await response.json() as { sourceApps: SourceAppConfig[] };
    return body.sourceApps;
  }

  async fetchFingerprintBundle(): Promise<FingerprintRecord[]> {
    const url = new URL("/api/extension/fingerprint-bundle", this.config.apiBaseUrl);
    url.searchParams.set("organizationId", this.config.organizationId);
    const response = await this.request(url, { method: "GET" });
    const body = await response.json() as { fingerprintBundle: FingerprintRecord[] };
    return body.fingerprintBundle;
  }

  async fingerprintMatch(payload: { destinationDomain: string; sourceApp?: string; sourceUrlHash?: string; localMatches: LocalFingerprintMatch[]; textHash: string; redactedPreview?: string; actionTaken?: string }) {
    const safePayload = {
      organizationId: this.config.organizationId,
      employeeId: this.config.employeeId,
      ...payload,
      redactedPreview: createPrivacySafePreview({ rawText: payload.redactedPreview ?? "", dataTypes: ["company_fingerprint_match"], contextType: "fingerprint", logMode: "redacted_prompt", maxLength: 500 }),
    };
    assertNoRawSensitiveData(safePayload);
    const response = await this.request(new URL("/api/extension/fingerprint-match", this.config.apiBaseUrl), {
      method: "POST",
      body: JSON.stringify(safePayload),
    });
    return response.json() as Promise<{ matches: LocalFingerprintMatch[] }>;
  }

  async heartbeat(heartbeat: ExtensionHeartbeat) {
    const response = await this.request(new URL("/api/extension/heartbeat", this.config.apiBaseUrl), {
      method: "POST",
      body: JSON.stringify(heartbeat),
    });
    return response.json() as Promise<{ ok: boolean; lockdownChanged?: boolean; emergencyPolicyVersion?: number; shortPollingSeconds?: number }>;
  }

  async scan(payload: { url: string; result: ScanResult }) {
    const safePayload = {
      organizationId: this.config.organizationId,
      employeeId: this.config.employeeId,
      url: safeOrigin(payload.url),
      riskScore: payload.result.riskScore,
      detectedDataTypes: payload.result.detectedDataTypes,
      action: payload.result.action,
      redactedPreview: previewForScan(payload.result, "prompt", 500),
    };
    assertNoRawSensitiveData(safePayload);
    await this.request(new URL("/api/extension/scan", this.config.apiBaseUrl), {
      method: "POST",
      body: JSON.stringify(safePayload),
    });
  }

  async audit(event: ExtensionAuditEvent) {
    const { url: _url, ...withoutUrl } = event;
    const safeEvent = sanitizePrivacyPayload(withoutUrl);
    assertNoRawSensitiveData(safeEvent);
    await this.request(new URL("/api/extension/audit-log", this.config.apiBaseUrl), {
      method: "POST",
      body: JSON.stringify(safeEvent),
    });
  }

  async fileScanEvent(event: {
    organizationId: string;
    employeeId?: string;
    destinationDomain: string;
    sourceApp?: string;
    fileNameHash: string;
    originalExtension: string;
    mimeType?: string;
    sizeBytes: number;
    scannedBytes: number;
    supported: boolean;
    encryptedOrBinary: boolean;
    detectedDataTypes: string[];
    fingerprintSetId?: string;
    riskScore: number;
    severity: string;
    actionTaken: string;
    redactedPreview?: string;
  }) {
    const safeEvent = sanitizePrivacyPayload({ ...event, redactedPreview: createPrivacySafePreview({ rawText: event.redactedPreview ?? "", dataTypes: event.detectedDataTypes, contextType: "file", logMode: "redacted_prompt", maxLength: 500 }) });
    assertNoRawSensitiveData(safeEvent);
    await this.request(new URL("/api/extension/file-scan-event", this.config.apiBaseUrl), {
      method: "POST",
      body: JSON.stringify(safeEvent),
    });
  }

  async lineageEvent(event: {
    organizationId: string;
    employeeId?: string;
    sourceDomain?: string;
    sourceApp: string;
    sourceCategory: string;
    sourceUrlHash?: string;
    sourceTitle?: string;
    destinationDomain: string;
    destinationApp: string;
    destinationCategory: string;
    dataTypes: string[];
    riskScore: number;
    severity: string;
    actionTaken: string;
    fingerprintSetId?: string;
    approvalRequestId?: string;
    redactedPreview?: string;
    eventType: "copy" | "paste_to_ai" | "upload_to_ai" | "submit_to_ai" | "response_scan" | "approval_request";
  }) {
    const safeEvent = sanitizePrivacyPayload({ ...event, redactedPreview: createPrivacySafePreview({ rawText: event.redactedPreview ?? "", dataTypes: event.dataTypes, contextType: "lineage", logMode: "redacted_prompt", maxLength: 500 }) });
    assertNoRawSensitiveData(safeEvent);
    await this.request(new URL("/api/extension/lineage-event", this.config.apiBaseUrl), {
      method: "POST",
      body: JSON.stringify(safeEvent),
    });
  }

  async requestApproval(payload: { text: string; url: string; justification?: string; result: ScanResult }) {
    const safePayload = {
      organizationId: this.config.organizationId,
      employeeId: this.config.employeeId,
      url: safeOrigin(payload.url),
      justification: payload.justification ? redactSensitiveText(payload.justification).slice(0, 1000) : undefined,
      riskScore: payload.result.riskScore,
      detectedDataTypes: payload.result.detectedDataTypes,
      redactedPreview: previewForScan(payload.result, "approval", 1000),
    };
    assertNoRawSensitiveData(safePayload);
    const response = await this.request(new URL("/api/extension/approval-request", this.config.apiBaseUrl), {
      method: "POST",
      body: JSON.stringify(safePayload),
    });
    return response.json() as Promise<{ approvalId: string; status: string }>;
  }

  /**
   * Shadow-AI discovery report. Identity is taken from enrolled config, never from the
   * caller, so a page-injected content script cannot attribute a discovery to another
   * employee or tenant. Only the destination origin is sent, never the full URL.
   */
  async shadowAiDiscovered(payload: { domain: string; destination: string; riskLevel: string; url: string }) {
    const safePayload = {
      organizationId: this.config.organizationId,
      employeeId: this.config.employeeId,
      domain: payload.domain,
      destination: payload.destination,
      riskLevel: payload.riskLevel,
      url: safeOrigin(payload.url),
    };
    assertNoRawSensitiveData(safePayload);
    await this.request(new URL("/api/extension/shadow-ai-discovered", this.config.apiBaseUrl), {
      method: "POST",
      body: JSON.stringify(safePayload),
    });
  }

  async approvalStatus(approvalId: string) {
    const response = await this.request(new URL("/api/extension/approval-status", this.config.apiBaseUrl), {
      method: "POST",
      body: JSON.stringify({
        organizationId: this.config.organizationId,
        employeeId: this.config.employeeId,
        approvalId,
      }),
    });
    return response.json() as Promise<{ status: string }>;
  }

  async claimApproval(payload: { requestId: string; destination: string }) {
    const response = await this.request(new URL("/api/extension/approval-claim", this.config.apiBaseUrl), {
      method: "POST",
      body: JSON.stringify({
        requestId: payload.requestId,
        organizationId: this.config.organizationId,
        employeeId: this.config.employeeId,
        destination: payload.destination,
      }),
    });
    return response.json() as Promise<{ allowed: boolean; expiresAt?: string; approvalId?: string }>;
  }

  /**
   * Every control-plane request funnels through here, and every request is re-anchored
   * onto the trusted (optionally pinned) origin before it leaves the extension (SS-2).
   *
   * This is the single enforcement point that makes endpoint rebinding non-exploitable:
   * even if `config.apiBaseUrl` has been poisoned in storage, an https-only, no-IP,
   * no-credentials, pin-matching origin is the only thing `fetch` can be called with —
   * and the device token in `x-soter-extension-token` therefore cannot be redirected to
   * an attacker-controlled host.
   */
  private request(url: URL, init: RequestInit) {
    const trusted = assertTrustedEndpoint(this.config.apiBaseUrl, this.config.pinnedApiOrigin);
    const target = buildTrustedUrl(trusted, `${url.pathname}${url.search}`, this.config.pinnedApiOrigin);
    return fetch(target, {
      ...init,
      // No cookies or other ambient credentials: the device token is the only authority.
      credentials: "omit",
      redirect: "error",
      headers: {
        "content-type": "application/json",
        "x-soter-extension-token": this.config.deviceToken ?? "",
        ...(init.headers ?? {}),
      },
    }).then((response) => {
      if (!response.ok) throw new Error(`Soter API request failed: ${response.status}`);
      return response;
    });
  }
}

function safeOrigin(url: string) {
  try {
    return new URL(url).origin;
  } catch {
    return "https://unknown.invalid";
  }
}
