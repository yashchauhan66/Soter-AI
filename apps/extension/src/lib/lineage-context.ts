import { scanText } from "../../../../packages/detectors/src/index";
import { createPrivacySafePreview } from "./privacy-preview";
import { domainFromUrl } from "./scanner";
import type { SourceAppConfig } from "./source-apps";

const LINEAGE_CONTEXT_KEY = "soter.lineageContext.v1";
export const LINEAGE_CONTEXT_TTL_MS = 15 * 60 * 1000;

export interface LineageContext {
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

export async function createLineageContext(app: SourceAppConfig, text: string, url: string, title: string, now = Date.now()): Promise<LineageContext> {
  const scanned = scanText(text.slice(0, 20_000));
  const sourceUrlHash = await sha256Browser(redactUrl(url));
  const selectedTextHash = await sha256Browser(text);
  return {
    sourceDomain: domainFromUrl(url),
    sourceApp: app.name,
    sourceCategory: app.category,
    sourceUrlHash,
    sourceTitle: safeTitle(title),
    selectedTextHash,
    detectedDataTypes: scanned.detectedDataTypes,
    redactedPreview: createPrivacySafePreview({ rawText: text, dataTypes: scanned.detectedDataTypes, contextType: "lineage", logMode: "redacted_prompt", maxLength: 240 }),
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + LINEAGE_CONTEXT_TTL_MS).toISOString(),
  };
}

export async function saveLineageContext(context: LineageContext) {
  await chrome.storage.local.set({ [LINEAGE_CONTEXT_KEY]: context });
}

export async function getFreshLineageContext(now = Date.now()) {
  const stored = await chrome.storage.local.get<Record<string, LineageContext>>([LINEAGE_CONTEXT_KEY]);
  const context = stored[LINEAGE_CONTEXT_KEY];
  if (!context) return null;
  if (new Date(context.expiresAt).getTime() <= now) {
    await clearLineageContext();
    return null;
  }
  return context;
}

export async function clearLineageContext() {
  await chrome.storage.local.set({ [LINEAGE_CONTEXT_KEY]: undefined });
}

export function redactUrl(url: string) {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return "unknown";
  }
}

function safeTitle(title: string) {
  const trimmed = title.trim().replace(/\s+/g, " ");
  if (!trimmed) return undefined;
  return trimmed.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[REDACTED_EMAIL]").slice(0, 160);
}

async function sha256Browser(value: string) {
  const data = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
