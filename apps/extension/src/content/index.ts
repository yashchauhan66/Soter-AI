import { destinationAdapters, type AiSiteAdapter } from "../adapters";
import { currentPromptTarget, observePromptDom } from "./dom-observer";
import { installPasteListener } from "./paste-listener";
import { installResponseObserver } from "./response-observer";
import { installSubmitInterceptor } from "./submit-interceptor";
import { installFileContentScanner } from "./file-content-scanner";
import type { AIDestinationPolicy } from "../../../../packages/shared/src/ai-destinations";

const SHADOW_AI_KNOWN_PLATFORMS = [
  "chatgpt.com", "chat.openai.com", "claude.ai", "gemini.google.com", "bard.google.com",
  "perplexity.ai", "poe.com", "replit.com", "stackblitz.com", "codesandbox.io",
  "bolt.new", "v0.dev", "lovable.dev", "openrouter.ai", "openwebui.com",
];

/** Heuristically guess if the hostname belongs to an AI-like tool. */
function isAiLikelyHostname(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^www\./, "");
  if (SHADOW_AI_KNOWN_PLATFORMS.some((p) => h === p || h.endsWith("." + p))) return true;
  // Generic AI keyword heuristics
  if (/\b(ai|llm|chatbot|assistant|copilot|genai)\./i.test(h)) return true;
  return false;
}

/** Compute a risk level from the hostname + path heuristics. */
function inferShadowRiskLevel(hostname: string): "low" | "medium" | "high" {
  const h = hostname.toLowerCase();
  if (SHADOW_AI_KNOWN_PLATFORMS.some((p) => h.includes(p))) return "high";
  if (/\b(ai|llm)\./i.test(h)) return "medium";
  return "low";
}

let adapter: AiSiteAdapter | undefined;
void getDestinationContext().then((context) => {
  // Shadow AI discovery — detect unknown AI-like domains even when not explicitly monitored
  if (!context.destination && context.legacyMatch !== true) {
    const hostname = location.hostname.replace(/^www\./, "");
    if (isAiLikelyHostname(hostname)) {
      chrome.runtime.sendMessage({
        type: "SOTER_DISCOVER_SHADOW_AI",
        domain: hostname,
        destination: hostname,
        employeeId: context.employeeId,
        riskLevel: inferShadowRiskLevel(hostname),
        url: location.href,
      });
    }
  }

  if (!context.active) return;
  const adapters = destinationAdapters();
  adapter = adapters.find((candidate) => candidate.matches(location.href)) ?? adapters[adapters.length - 1];
  if (!adapter) return;
  installSubmitInterceptor(adapter);
  installPasteListener(adapter);
  installFileContentScanner();
  installResponseObserver(adapter, context.destination?.responseScanningEnabled !== false);
  observePromptDom(() => currentPromptTarget(adapter!));
  document.documentElement.setAttribute("data-soter-active-domain", "true");
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!isObject(message)) return;
  if (message.type === "SOTER_GET_ACTIVE_PROMPT") {
    const target = adapter ? currentPromptTarget(adapter) : null;
    sendResponse({ text: target?.getText() ?? "", adapter: adapter?.name ?? "inactive" });
  }
});

function isObject(value: unknown): value is { type?: string } {
  return Boolean(value && typeof value === "object");
}

function getDestinationContext() {
  return new Promise<{ active: boolean; destination?: AIDestinationPolicy; employeeId?: string; legacyMatch?: boolean }>((resolve) => chrome.runtime.sendMessage(
    { type: "SOTER_GET_DESTINATION_CONTEXT", url: location.href },
    (response) => resolve((response as { active: boolean; destination?: AIDestinationPolicy; employeeId?: string; legacyMatch?: boolean }) ?? { active: false }),
  ));
}
