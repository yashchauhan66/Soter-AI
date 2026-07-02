import { SOTER_EXTENSION_VERSION } from "../../../../packages/shared/src/constants";
import type { ExtensionAuditEvent } from "../../../../packages/shared/src/audit-types";
import { SCAN_CONTEXT_MENU_ID, registerContextMenu } from "./context-menu";
import { browserName, sendHeartbeat } from "./heartbeat";
import { configurePolicySyncAlarm, syncPolicy } from "./policy-sync";
import { SoterExtensionApiClient } from "../lib/api-client";
import { destinationTypeForUrl, domainFromUrl, scanPrompt } from "../lib/scanner";
import { getState, setState } from "../lib/storage";
import type { RuntimeScanRequest, RuntimeResponse } from "../lib/types";
import { matchAIDestination } from "../../../../packages/shared/src/ai-destinations";
import { enrollFromManagedConfig, enrollWithCode } from "../lib/enrollment";
import { matchLocalFingerprints } from "../lib/fingerprint-matcher";
import { ACTION_PRECEDENCE } from "../../../../packages/policy-engine/src/actions";
import { createStorageSafeScanResult, previewForScan } from "../lib/privacy-preview";

void initializeEnrollment();

chrome.runtime.onInstalled.addListener(() => {
  registerContextMenu();
  configurePolicySyncAlarm(15 * 60);
  chrome.alarms?.create("soter-heartbeat", { periodInMinutes: 5, delayInMinutes: 1 });
  void syncPolicy();
});

chrome.alarms?.onAlarm.addListener((alarm) => {
  if (alarm.name === "soter-policy-sync") void syncPolicy();
  if (alarm.name === "soter-heartbeat") void sendHeartbeat();
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== SCAN_CONTEXT_MENU_ID || !info.selectionText) return;
  void handleScan({ text: info.selectionText, url: info.pageUrl ?? tab?.url ?? "", eventType: "context_menu" }).then(async () => {
    if (tab?.id && chrome.sidePanel) await chrome.sidePanel.open({ tabId: tab.id });
  });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!isObject(message)) return;
  if (message.type === "SOTER_SCAN_TEXT") {
    void handleScan(message as RuntimeScanRequest).then(sendResponse);
    return true;
  }
  if (message.type === "SOTER_GET_STATE") {
    void getState().then((state) => sendResponse({ ok: true, state }));
    return true;
  }
  if (message.type === "SOTER_SET_STATE") {
    void setState(message.state ?? {}).then((state) => sendResponse({ ok: true, state }));
    return true;
  }
  if (message.type === "SOTER_REQUEST_APPROVAL") {
    void handleApproval(message.text ?? "", message.url ?? "", message.justification).then(sendResponse);
    return true;
  }
  if (message.type === "SOTER_HEARTBEAT") {
    void sendHeartbeat().then(() => sendResponse({ ok: true }));
    return true;
  }
  if (message.type === "SOTER_ENROLL") {
    void enrollWithCode(message.apiBaseUrl ?? "http://localhost:3000", message.enrollmentCode ?? "").then(async (result) => {
      if (result.ok) {
        await syncPolicy();
        await sendHeartbeat();
      }
      sendResponse({ ...result, state: await getState() });
    });
    return true;
  }
  if (message.type === "SOTER_SYNC_POLICY") {
    void syncPolicy().then(async () => sendResponse({ ok: true, state: await getState() }));
    return true;
  }
  if (message.type === "SOTER_GET_DESTINATION_CONTEXT") {
    void destinationContext(message.url ?? "").then(sendResponse);
    return true;
  }
  if (message.type === "SOTER_GET_SOURCE_APPS") {
    void getSourceApps().then(sendResponse);
    return true;
  }
  if (message.type === "SOTER_DISCOVER_SHADOW_AI") {
    void handleShadowAIDiscovery(message).then(sendResponse);
    return true;
  }
  if (message.type === "SOTER_FILE_SCAN_EVENT") {
    void handleFileScanEvent(message.event).then(sendResponse);
    return true;
  }
});

async function handleScan(request: RuntimeScanRequest): Promise<RuntimeResponse> {
  try {
    const state = await getState();
    if (!state.enabled) return { ok: false, message: "Soter extension is disabled." };
    const result = scanPrompt(request.text, request.url, state, request.eventType);
    const api = new SoterExtensionApiClient(state.config);
    const destination = matchAIDestination(request.url, state.policy?.destinations ?? [], state.config.department, state.config.role);
    const allowFullText = destination?.loggingMode === "full_prompt_explicit_admin_enabled";
    const fingerprintMatches = await localFingerprintMatches(api, request.text);
    if (fingerprintMatches.length) {
      result.detectedDataTypes = Array.from(new Set([...result.detectedDataTypes, "company_fingerprint_match"])).sort();
      result.hasFindings = true;
      result.riskScore = Math.max(result.riskScore, fingerprintMatches[0].sensitivity === "critical" ? 95 : 75);
      const strictest = fingerprintMatches.map((match) => match.recommendedAction).sort((left, right) => ACTION_PRECEDENCE[right] - ACTION_PRECEDENCE[left])[0];
      if (strictest && ACTION_PRECEDENCE[strictest] > ACTION_PRECEDENCE[result.action]) {
        result.action = strictest;
        result.policy = {
          ...result.policy,
          action: strictest,
          severity: fingerprintMatches[0].sensitivity,
          matchedRules: [
            ...result.policy.matchedRules,
            { id: "company-fingerprint-local", name: "Company fingerprint match", action: strictest, severity: fingerprintMatches[0].sensitivity },
          ],
          userMessage: "Soter detected content similar to registered confidential company data.",
          adminMessage: "Company Data Fingerprint Vault match enforced locally by extension.",
          auditMetadata: { ...result.policy.auditMetadata, fingerprintMatches },
        };
      }
      void api.fingerprintMatch({
        destinationDomain: domainFromUrl(request.url),
        sourceApp: request.lineageContext?.sourceApp,
        sourceUrlHash: request.lineageContext?.sourceUrlHash,
        localMatches: fingerprintMatches,
        textHash: await hashText(request.text),
        redactedPreview: previewForScan(result, "fingerprint", 500, allowFullText),
        actionTaken: result.action,
      }).catch(() => undefined);
    }
    await setState({ latestScan: await createStorageSafeScanResult(result, request.text, request.eventType === "response" ? "response" : "prompt") });
    const isResponseScan = request.eventType === "response";
    const event: ExtensionAuditEvent = {
      organizationId: state.config.organizationId,
      employeeId: state.config.employeeId,
      extensionVersion: SOTER_EXTENSION_VERSION,
      browser: browserName(),
      domain: domainFromUrl(request.url),
      url: request.url,
      policyVersion: state.policy?.version ?? "unknown",
      action: result.action,
      severity: result.policy.severity,
      riskScore: result.riskScore,
      detectedDataTypes: result.detectedDataTypes,
      matchedRules: result.policy.matchedRules.map((rule) => rule.id),
      redactedPreview: previewForScan(result, request.eventType === "response" ? "response" : "prompt", 500, allowFullText),
      eventType: request.eventType,
      occurredAt: new Date().toISOString(),
      metadata: {
        findings: result.findings.map(({ type, label, severity }) => ({ type, label, severity })),
        lineageContext: request.lineageContext ? {
          sourceDomain: request.lineageContext.sourceDomain,
          sourceApp: request.lineageContext.sourceApp,
          sourceCategory: request.lineageContext.sourceCategory,
          sourceUrlHash: request.lineageContext.sourceUrlHash,
          selectedTextHash: request.lineageContext.selectedTextHash,
        } : undefined,
      },
    };
    if (!isResponseScan || result.hasFindings) void api.audit(event).catch(() => undefined);
    // P0-3 FIX: Do NOT send raw text to backend - only send metadata
    if (!isResponseScan || result.hasFindings) void api.scan({ url: request.url, result }).catch(() => undefined);
    if (request.lineageContext) {
      void api.lineageEvent({
        organizationId: state.config.organizationId,
        employeeId: state.config.employeeId,
        sourceDomain: request.lineageContext.sourceDomain,
        sourceApp: request.lineageContext.sourceApp,
        sourceCategory: request.lineageContext.sourceCategory,
        sourceUrlHash: request.lineageContext.sourceUrlHash,
        sourceTitle: request.lineageContext.sourceTitle,
        destinationDomain: domainFromUrl(request.url),
        destinationApp: domainFromUrl(request.url),
        destinationCategory: destinationTypeForLineage(request.url),
        dataTypes: Array.from(new Set([...request.lineageContext.detectedDataTypes, ...result.detectedDataTypes])),
        riskScore: result.riskScore,
        severity: result.policy.severity,
        actionTaken: result.action,
        redactedPreview: previewForScan(result, "lineage", 500, allowFullText),
        eventType: request.eventType === "paste" ? "paste_to_ai" : request.eventType === "submit" ? "submit_to_ai" : request.eventType === "file_upload" ? "upload_to_ai" : "paste_to_ai",
      }).catch(() => undefined);
    }
    return { ok: true, result };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Scan failed." };
  }
}

async function localFingerprintMatches(api: SoterExtensionApiClient, text: string) {
  try {
    const bundle = await api.fetchFingerprintBundle();
    if (!bundle.length) return [];
    return await matchLocalFingerprints(text, bundle);
  } catch {
    return [];
  }
}

async function initializeEnrollment() {
  const managed = await enrollFromManagedConfig();
  if (managed.status === "enrolled") {
    await syncPolicy();
    await sendHeartbeat();
  }
}

async function destinationContext(url: string) {
  const state = await getState();
  const destination = matchAIDestination(url, state.policy?.destinations ?? [], state.config.department, state.config.role);
  if (destination) return { active: state.enabled, destination, employeeId: state.config.employeeId, legacyMatch: true };
  const hostname = domainFromUrl(url);
  const legacyMatch = state.policy?.monitoredDomains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
  return { active: Boolean(state.enabled && legacyMatch), destination: undefined, employeeId: state.config.employeeId, legacyMatch };
}

async function getSourceApps() {
  try {
    const state = await getState();
    if (!state.enabled || !state.config.organizationId) return { ok: false, sourceApps: [] };
    const sourceApps = await new SoterExtensionApiClient(state.config).fetchSourceApps();
    return { ok: true, sourceApps };
  } catch {
    return { ok: false, sourceApps: [] };
  }
}

function destinationTypeForLineage(url: string) {
  return destinationTypeForUrl(url, undefined);
}

async function handleShadowAIDiscovery(message: Record<string, unknown>) {
  try {
    const state = await getState();
    if (!state.enabled || !state.config.organizationId) return { ok: false, message: "Not enrolled." };
    const result = await fetch(`${state.config.apiBaseUrl}/api/extension/shadow-ai-discovered`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-soter-extension-token": state.config.deviceToken ?? "",
      },
      body: JSON.stringify({
        organizationId: state.config.organizationId,
        employeeId: String(message.employeeId ?? state.config.employeeId),
        domain: String(message.domain ?? ""),
        destination: String(message.destination ?? ""),
        riskLevel: String(message.riskLevel ?? "medium"),
        url: safeOrigin(String(message.url ?? "")),
      }),
    });
    return { ok: result.ok };
  } catch {
    return { ok: false, message: "Shadow AI discovery failed." };
  }
}

async function handleApproval(text: string, url: string, justification?: string) {
  const state = await getState();
  const result = scanPrompt(text, url, state);
  const response = await new SoterExtensionApiClient(state.config).requestApproval({ text, url, justification, result });
  await setState({ latestScan: await createStorageSafeScanResult(result, text, "approval") });
  return { ok: true, ...response };
}

async function handleFileScanEvent(event: unknown) {
  try {
    const state = await getState();
    if (!state.enabled) return { ok: false, message: "Soter extension is disabled." };
    const api = new SoterExtensionApiClient(state.config);
    const fileEvent = event as Parameters<SoterExtensionApiClient["fileScanEvent"]>[0] & { lineageContext?: RuntimeScanRequest["lineageContext"] };
    await api.fileScanEvent(fileEvent);
    if (fileEvent.lineageContext) {
      await api.lineageEvent({
        organizationId: state.config.organizationId,
        employeeId: state.config.employeeId,
        sourceDomain: fileEvent.lineageContext.sourceDomain,
        sourceApp: fileEvent.lineageContext.sourceApp,
        sourceCategory: fileEvent.lineageContext.sourceCategory,
        sourceUrlHash: fileEvent.lineageContext.sourceUrlHash,
        sourceTitle: fileEvent.lineageContext.sourceTitle,
        destinationDomain: fileEvent.destinationDomain,
        destinationApp: fileEvent.destinationDomain,
        destinationCategory: "public_ai",
        dataTypes: Array.from(new Set([...fileEvent.lineageContext.detectedDataTypes, ...fileEvent.detectedDataTypes])),
        riskScore: fileEvent.riskScore,
        severity: fileEvent.severity,
        actionTaken: fileEvent.actionTaken,
        redactedPreview: fileEvent.redactedPreview,
        eventType: "upload_to_ai",
      });
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "File scan event failed." };
  }
}

function isObject(value: unknown): value is { type?: string; text?: string; url?: string; justification?: string; state?: Record<string, unknown>; apiBaseUrl?: string; enrollmentCode?: string; event?: unknown; lineageContext?: RuntimeScanRequest["lineageContext"] } {
  return Boolean(value && typeof value === "object");
}

async function hashText(text: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function safeOrigin(url: string) {
  try {
    return new URL(url).origin;
  } catch {
    return "https://unknown.invalid";
  }
}
