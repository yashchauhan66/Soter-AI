/**
 * Runtime message boundary for the SoterAI extension service worker (SS-3).
 *
 * Before this module the worker accepted any object that reached `onMessage`
 * (`if (!isObject(message)) return;`) and routed it to 14 handlers with no sender
 * check, no schema, no size bound and no fail-safe for unknown types. One of those
 * handlers, `SOTER_SET_STATE`, was an unrestricted privileged write over the whole
 * extension state — it has been deleted rather than validated, because nothing in the
 * codebase ever sent it.
 *
 * Honest scope: MV3 already denies web pages access to `chrome.runtime.sendMessage`
 * unless the manifest declares `externally_connectable`, which this extension does not.
 * So this guard is defence in depth plus type-confusion and resource-exhaustion
 * hardening today, and it is what makes a future `externally_connectable` addition or a
 * compromised extension page non-exploitable. It is not claimed to close a currently
 * remotely reachable hole. See docs/SOTERAI-BROWSER-GUARD-SUPREMACY-REPORT.md SS-3.
 */

/** Where a message is allowed to originate. */
export type MessageScope =
  /** Injected content script in a top-level tab frame on a declared host. */
  | "content_script"
  /** The extension's own popup, side panel or options page. */
  | "extension_page"
  /** Either of the above, but still nothing outside this extension. */
  | "any_internal";

export interface MessageSenderLike {
  id?: string;
  origin?: string;
  url?: string;
  frameId?: number;
  tab?: { id?: number };
}

export interface MessageContract {
  scope: MessageScope;
  /** Upper bound on the serialised message, in characters. */
  maxChars: number;
  /** Returns the validated payload, or `null` to reject the message. */
  parse: (message: Record<string, unknown>) => Record<string, unknown> | null;
}

export type MessageRejectionCode =
  | "not_an_object"
  | "unknown_type"
  | "foreign_sender"
  | "wrong_scope"
  | "subframe_sender"
  | "too_large"
  | "invalid_payload";

export type MessageValidation =
  | { ok: true; type: string; payload: Record<string, unknown> }
  | { ok: false; code: MessageRejectionCode; reason: string };

/** Hard ceiling regardless of per-type limits, so one message cannot exhaust memory. */
export const MAX_MESSAGE_CHARS = 512_000;

const EVENT_TYPES = new Set([
  "scan",
  "submit",
  "paste",
  "context_menu",
  "heartbeat",
  "approval_request",
  "file_upload",
  "response",
]);

const ACTION_VALUES = new Set([
  "block",
  "require_approval",
  "require_justification",
  "warn",
  "redact",
  "rewrite",
  "allow",
  "log_only",
]);

const RISK_LEVELS = new Set(["low", "medium", "high", "critical"]);

function str(value: unknown, maxChars: number): string | null {
  if (typeof value !== "string") return null;
  if (value.length > maxChars) return null;
  return value;
}

function optionalStr(value: unknown, maxChars: number): string | null | undefined {
  if (value === undefined || value === null) return undefined;
  return str(value, maxChars);
}

/** Accepts an http(s) URL string only. Rejects `javascript:`, `data:` and friends. */
function webUrl(value: unknown): string | null {
  const raw = str(value, 4096);
  if (raw === null) return null;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    return raw;
  } catch {
    return null;
  }
}

/**
 * A page URL as reported by a content script. Absent or empty is accepted and
 * normalised to `""` (unknown destination) because refusing would silently drop a
 * scan — the fail-safe direction here is to scan with less context, never to skip.
 * A non-http(s) scheme is still refused.
 */
function pageUrl(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return "";
  return webUrl(value);
}

function plainObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function num(value: unknown, min: number, max: number): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (value < min || value > max) return null;
  return value;
}

function bool(value: unknown): boolean {
  return value === true;
}

function strArray(value: unknown, maxItems: number, maxChars: number): string[] | null {
  if (!Array.isArray(value)) return null;
  if (value.length > maxItems) return null;
  const out: string[] = [];
  for (const item of value) {
    const parsed = str(item, maxChars);
    if (parsed === null) return null;
    out.push(parsed);
  }
  return out;
}

function enumValue(value: unknown, allowed: Set<string>): string | null {
  const raw = str(value, 64);
  if (raw === null || !allowed.has(raw)) return null;
  return raw;
}

/**
 * Lineage context is attacker-shaped data (it originates in a page's content script),
 * so every field is bounded and hashes are length-checked. Rejecting is safe: the
 * caller treats a missing lineage context as "unknown source".
 */
function lineageContext(value: unknown): Record<string, unknown> | null | undefined {
  if (value === undefined || value === null) return undefined;
  const raw = plainObject(value);
  if (!raw) return null;
  const sourceDomain = str(raw.sourceDomain, 253);
  const sourceApp = str(raw.sourceApp, 200);
  const sourceCategory = str(raw.sourceCategory, 64);
  const sourceUrlHash = str(raw.sourceUrlHash, 128);
  const selectedTextHash = str(raw.selectedTextHash, 128);
  const detectedDataTypes = strArray(raw.detectedDataTypes, 64, 128);
  const createdAt = str(raw.createdAt, 40);
  const expiresAt = str(raw.expiresAt, 40);
  if (
    sourceDomain === null || sourceApp === null || sourceCategory === null ||
    sourceUrlHash === null || selectedTextHash === null || detectedDataTypes === null ||
    createdAt === null || expiresAt === null
  ) return null;
  const sourceTitle = optionalStr(raw.sourceTitle, 300);
  const redactedPreview = optionalStr(raw.redactedPreview, 2000);
  if (sourceTitle === null || redactedPreview === null) return null;
  return {
    sourceDomain, sourceApp, sourceCategory, sourceUrlHash, selectedTextHash,
    detectedDataTypes, createdAt, expiresAt,
    ...(sourceTitle === undefined ? {} : { sourceTitle }),
    ...(redactedPreview === undefined ? {} : { redactedPreview }),
  };
}

/**
 * File-scan telemetry from a content script. `organizationId` / `employeeId` are
 * deliberately NOT accepted here: the service worker fills them from enrolled state so a
 * page-injected script cannot attribute an event to another tenant or employee.
 */
function fileScanEvent(value: unknown): Record<string, unknown> | null {
  const raw = plainObject(value);
  if (!raw) return null;
  const destinationDomain = str(raw.destinationDomain, 253);
  const fileNameHash = str(raw.fileNameHash, 128);
  const originalExtension = str(raw.originalExtension, 32);
  const detectedDataTypes = strArray(raw.detectedDataTypes, 128, 128);
  const severity = str(raw.severity, 32);
  const actionTaken = str(raw.actionTaken, 32);
  const sizeBytes = num(raw.sizeBytes, 0, Number.MAX_SAFE_INTEGER);
  const scannedBytes = num(raw.scannedBytes, 0, Number.MAX_SAFE_INTEGER);
  const riskScore = num(raw.riskScore, 0, 100);
  if (
    destinationDomain === null || fileNameHash === null || originalExtension === null ||
    detectedDataTypes === null || severity === null || actionTaken === null ||
    sizeBytes === null || scannedBytes === null || riskScore === null
  ) return null;
  const sourceApp = optionalStr(raw.sourceApp, 200);
  const mimeType = optionalStr(raw.mimeType, 255);
  const fingerprintSetId = optionalStr(raw.fingerprintSetId, 128);
  const redactedPreview = optionalStr(raw.redactedPreview, 2000);
  if (sourceApp === null || mimeType === null || fingerprintSetId === null || redactedPreview === null) return null;
  const lineage = lineageContext(raw.lineageContext);
  if (lineage === null) return null;
  return {
    destinationDomain, fileNameHash, originalExtension, detectedDataTypes, severity,
    actionTaken, sizeBytes, scannedBytes, riskScore,
    supported: bool(raw.supported),
    encryptedOrBinary: bool(raw.encryptedOrBinary),
    ...(sourceApp === undefined ? {} : { sourceApp }),
    ...(mimeType === undefined ? {} : { mimeType }),
    ...(fingerprintSetId === undefined ? {} : { fingerprintSetId }),
    ...(redactedPreview === undefined ? {} : { redactedPreview }),
    ...(lineage === undefined ? {} : { lineageContext: lineage }),
  };
}

/* ------------------------------------------------------------------ *
 * Per-type contracts. Anything not listed here is refused.
 * ------------------------------------------------------------------ */

const MAX_TEXT_CHARS = 400_000;

export const MESSAGE_CONTRACTS: Record<string, MessageContract> = {
  SOTER_SCAN_TEXT: {
    scope: "any_internal",
    maxChars: MAX_MESSAGE_CHARS,
    parse: (message) => {
      const text = str(message.text, MAX_TEXT_CHARS);
      const url = pageUrl(message.url);
      if (text === null || url === null) return null;
      const eventType = message.eventType === undefined ? "scan" : enumValue(message.eventType, EVENT_TYPES);
      if (eventType === null) return null;
      const lineage = lineageContext(message.lineageContext);
      if (lineage === null) return null;
      return { text, url, eventType, ...(lineage === undefined ? {} : { lineageContext: lineage }) };
    },
  },
  SOTER_GET_STATE: { scope: "extension_page", maxChars: 2048, parse: () => ({}) },
  SOTER_SYNC_POLICY: { scope: "extension_page", maxChars: 2048, parse: () => ({}) },
  SOTER_HEARTBEAT: { scope: "extension_page", maxChars: 2048, parse: () => ({}) },
  // v0.2.0: self-service trial mode. Extension-page only — a web page can never start a trial.
  SOTER_START_TRIAL: { scope: "extension_page", maxChars: 2048, parse: () => ({}) },
  SOTER_GET_SOURCE_APPS: { scope: "any_internal", maxChars: 2048, parse: () => ({}) },
  SOTER_REQUEST_APPROVAL: {
    scope: "any_internal",
    maxChars: MAX_MESSAGE_CHARS,
    parse: (message) => {
      const text = str(message.text, MAX_TEXT_CHARS);
      const url = pageUrl(message.url);
      const justification = optionalStr(message.justification, 2000);
      if (text === null || url === null || justification === null) return null;
      return { text, url, ...(justification === undefined ? {} : { justification }) };
    },
  },
  SOTER_ENROLL: {
    scope: "extension_page",
    maxChars: 16_384,
    parse: (message) => {
      // The endpoint string is only bounded here; `trusted-endpoint` decides trust.
      const apiBaseUrl = optionalStr(message.apiBaseUrl, 2048);
      const enrollmentCode = str(message.enrollmentCode, 512);
      if (apiBaseUrl === null || enrollmentCode === null) return null;
      return { enrollmentCode, ...(apiBaseUrl === undefined ? {} : { apiBaseUrl }) };
    },
  },
  SOTER_GET_DESTINATION_CONTEXT: {
    scope: "any_internal",
    maxChars: 8192,
    parse: (message) => {
      const url = pageUrl(message.url);
      if (url === null) return null;
      return { url };
    },
  },
  SOTER_DISCOVER_SHADOW_AI: {
    scope: "content_script",
    maxChars: 8192,
    parse: (message) => {
      // `employeeId` is intentionally not accepted: the worker uses enrolled identity.
      const domain = str(message.domain, 253);
      const destination = str(message.destination, 200);
      const riskLevel = message.riskLevel === undefined ? "medium" : enumValue(message.riskLevel, RISK_LEVELS);
      const url = pageUrl(message.url);
      if (domain === null || destination === null || riskLevel === null || url === null) return null;
      return { domain, destination, riskLevel, url };
    },
  },
  SOTER_FILE_SCAN_EVENT: {
    scope: "content_script",
    maxChars: 131_072,
    parse: (message) => {
      const event = fileScanEvent(message.event);
      if (event === null) return null;
      return { event };
    },
  },
  SOTER_CHECK_APPROVAL_STATUS: {
    scope: "any_internal",
    maxChars: 4096,
    parse: (message) => {
      const approvalId = str(message.approvalId, 200);
      if (approvalId === null || approvalId.length === 0) return null;
      return { approvalId };
    },
  },
  SOTER_CLAIM_APPROVAL: {
    scope: "any_internal",
    maxChars: 4096,
    parse: (message) => {
      const requestId = str(message.requestId, 200);
      const destination = str(message.destination, 253);
      if (requestId === null || requestId.length === 0 || destination === null) return null;
      return { requestId, destination };
    },
  },
  SOTER_AUDIT_BYPASS: {
    scope: "any_internal",
    maxChars: MAX_MESSAGE_CHARS,
    parse: (message) => {
      const text = str(message.text, MAX_TEXT_CHARS);
      const url = pageUrl(message.url);
      const action = enumValue(message.action, ACTION_VALUES);
      const justification = optionalStr(message.justification, 2000);
      if (text === null || url === null || action === null || justification === null) return null;
      return {
        text, url, action, dismissedOnly: bool(message.dismissedOnly),
        ...(justification === undefined ? {} : { justification }),
      };
    },
  },
};

export const ALLOWED_MESSAGE_TYPES = Object.freeze(Object.keys(MESSAGE_CONTRACTS));

/** `chrome-extension://<id>` for this extension, used for extension-page scope checks. */
function ownExtensionOrigin(runtimeId: string | undefined) {
  return runtimeId ? `chrome-extension://${runtimeId}` : undefined;
}

function isExtensionPageSender(sender: MessageSenderLike, runtimeId: string | undefined) {
  const own = ownExtensionOrigin(runtimeId);
  if (sender.origin && own && sender.origin === own) return true;
  if (sender.url && own && sender.url.startsWith(`${own}/`)) return true;
  // Without a known runtime id, accept only an unambiguous extension URL with no tab.
  if (!own && !sender.tab && typeof sender.url === "string" && sender.url.startsWith("chrome-extension://")) return true;
  return false;
}

function isContentScriptSender(sender: MessageSenderLike) {
  if (!sender.tab || typeof sender.tab.id !== "number") return false;
  if (typeof sender.url !== "string") return false;
  return sender.url.startsWith("https://") || sender.url.startsWith("http://");
}

/**
 * The single entry point the service worker calls before touching a message.
 *
 * Fail-safe by construction: every path that is not an explicit `ok: true` is a
 * rejection, so a message type added to the router without a contract is refused
 * rather than silently trusted.
 *
 * @param runtimeId `chrome.runtime.id`. When supplied, `sender.id` must equal it.
 */
export function validateRuntimeMessage(
  message: unknown,
  sender: MessageSenderLike | undefined,
  runtimeId?: string,
): MessageValidation {
  const raw = plainObject(message);
  if (!raw) return { ok: false, code: "not_an_object", reason: "Message is not a plain object." };

  const type = typeof raw.type === "string" ? raw.type : "";
  const contract = Object.prototype.hasOwnProperty.call(MESSAGE_CONTRACTS, type)
    ? MESSAGE_CONTRACTS[type]
    : undefined;
  if (!contract) return { ok: false, code: "unknown_type", reason: `Unsupported message type: ${type || "(missing)"}` };

  if (!sender || typeof sender.id !== "string" || sender.id.length === 0) {
    return { ok: false, code: "foreign_sender", reason: "Message has no identifiable extension sender." };
  }
  if (runtimeId && sender.id !== runtimeId) {
    return { ok: false, code: "foreign_sender", reason: "Message did not originate from this extension." };
  }

  const fromContentScript = isContentScriptSender(sender);
  const fromExtensionPage = isExtensionPageSender(sender, runtimeId);
  if (contract.scope === "content_script" && !fromContentScript) {
    if (sender.tab && sender.frameId !== undefined && sender.frameId !== 0) {
      return { ok: false, code: "subframe_sender", reason: "Message came from a subframe." };
    }
    return { ok: false, code: "wrong_scope", reason: `${type} is only accepted from a content script.` };
  }
  if (contract.scope === "extension_page" && !fromExtensionPage) {
    return { ok: false, code: "wrong_scope", reason: `${type} is only accepted from an extension page.` };
  }
  if (contract.scope === "any_internal" && !fromContentScript && !fromExtensionPage) {
    return { ok: false, code: "wrong_scope", reason: `${type} came from neither a content script nor an extension page.` };
  }
  // Content scripts are declared without `all_frames`, so only the top frame is real.
  if (fromContentScript && sender.frameId !== undefined && sender.frameId !== 0) {
    return { ok: false, code: "subframe_sender", reason: "Message came from a subframe; only top-level frames are accepted." };
  }

  let serialised: string;
  try {
    serialised = JSON.stringify(raw) ?? "";
  } catch {
    return { ok: false, code: "invalid_payload", reason: "Message is not serialisable." };
  }
  const limit = Math.min(contract.maxChars, MAX_MESSAGE_CHARS);
  if (serialised.length > limit) {
    return { ok: false, code: "too_large", reason: `Message exceeds the ${limit}-character limit for ${type}.` };
  }

  let payload: Record<string, unknown> | null;
  try {
    payload = contract.parse(raw);
  } catch {
    payload = null;
  }
  if (!payload) return { ok: false, code: "invalid_payload", reason: `${type} payload failed schema validation.` };

  return { ok: true, type, payload };
}

