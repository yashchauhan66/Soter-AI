import { destinationAdapters, type AiSiteAdapter } from "../adapters";
import { currentPromptTarget, observePromptDom } from "./dom-observer";
import { installPasteListener } from "./paste-listener";
import { installResponseObserver } from "./response-observer";
import { installSubmitInterceptor } from "./submit-interceptor";
import { installFileContentScanner } from "./file-content-scanner";
import { installWebSocketObserver } from "./websocket-observer";
import { BUILT_IN_AI_DESTINATIONS, type AIDestinationPolicy } from "../../../../packages/shared/src/ai-destinations";

/** Known AI platforms, derived from the one destination table the policy is also built from.
 *  v0.2.2: this was a third hand-maintained hostname list and it had drifted out of step with both
 *  the manifest and the destination presets, so shadow-AI discovery rated newly guarded sites by the
 *  generic "does the hostname contain 'ai'" heuristic instead of knowing them.
 */
const SHADOW_AI_KNOWN_PLATFORMS = Array.from(new Set([
  ...BUILT_IN_AI_DESTINATIONS.flatMap((destination) => destination.domains),
  // Self-hosted front ends whose presets are localhost URL patterns, so they contribute no
  // hostname above but are still worth recognising by name when discovered.
  "openwebui.com", "anythingllm.com", "lmstudio.ai",
]));

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
  installSubmitInterceptor(adapter, context.failClosedOnScanError === true);
  installPasteListener(adapter);
  installFileContentScanner();
  installResponseObserver(adapter, context.destination?.responseScanningEnabled !== false);
  // v0.2.0: scan WebSocket-streamed AI responses (frames forwarded by the
  // MAIN-world ws-page-hook). Enabled alongside DOM response scanning.
  installWebSocketObserver(context.destination?.responseScanningEnabled !== false);
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

/**
 * SoterAI's own platform (soterai.in) should always be actively guarded
 * regardless of backend policy state — it is a first-party destination.
 * For all other domains, defer to the background policy engine.
 */
interface DestinationContext {
  active: boolean;
  destination?: AIDestinationPolicy;
  employeeId?: string;
  legacyMatch?: boolean;
  /** "If Soter cannot check it, do not send it." Answered by the worker; see submit-interceptor. */
  failClosedOnScanError?: boolean;
  /** v0.2.2: the worker answered but could not determine the context, or did not answer at all. */
  unavailable?: boolean;
}

function getDestinationContext() {
  return new Promise<DestinationContext>((resolve) => chrome.runtime.sendMessage(
    { type: "SOTER_GET_DESTINATION_CONTEXT", url: location.href },
    (response) => {
      // v0.2.2: a missing reply used to resolve to `{ active: false }`, i.e. "not a guarded site" —
      // and the content script then installed nothing at all, silently, on a site the manifest
      // injected it into precisely *because* it is a guarded AI destination. A worker that is
      // asleep, restarting or throwing is not evidence that this page is unmonitored. The manifest
      // match is the evidence, so a transport failure activates the guard instead of disabling it;
      // scans then fail open per-gesture with a visible notice rather than protecting nothing in
      // silence.
      const ctx = (response as DestinationContext | undefined) ?? { active: true, unavailable: true, legacyMatch: true };
      const hostname = location.hostname.replace(/^www\./, "").toLowerCase();
      // First-party: soterai.in always activates the guard, even if the backend
      // policy hasn't been synced yet or the extension hasn't enrolled.
      if (hostname === "soterai.in" || hostname.endsWith(".soterai.in")) {
        return resolve({ ...ctx, active: true, legacyMatch: true });
      }
      if (ctx.unavailable) return resolve({ ...ctx, active: true, legacyMatch: true });
      resolve(ctx);
    },
  ));
}


