
import type { AiSiteAdapter } from "../adapters/generic-editor";
import type { RuntimeResponse, RuntimeScanResponse } from "../lib/types";


/**
 * Response-side semantic DLP (Tier-1): when the AI's *answer* regurgitates
 * secrets/PII/unsafe content, mark it AND show an inline action banner with a
 * one-click "hide sensitive" redaction so the leak never leaves the page.
 */
export function installResponseObserver(adapter: AiSiteAdapter, enabled: boolean) {
  const scanned = new WeakMap<HTMLElement, string>();
  let timer: ReturnType<typeof setTimeout> | undefined;

  const scanResponses = () => {
    if (!enabled) return;
    for (const target of adapter.getResponseTargets()) {
      const text = (target.innerText || target.textContent || "").trim();
      if (text.length < 20 || scanned.get(target) === text) continue;
      scanned.set(target, text);
      void sendResponseScan(text).then((response) => {
        if (response.ok && response.result.hasFindings) {
          const severity = response.result.policy.severity;
          target.setAttribute("data-soter-response-risk", severity);
          target.setAttribute("title", "Soter detected sensitive content in this AI response. Review before using it.");
          mountResponseGuard(target, response);
        }
      });
    }
  };

  const observer = new MutationObserver(() => {
    document.documentElement.setAttribute("data-soter-active-domain", "true");
    clearTimeout(timer);
    timer = setTimeout(scanResponses, 600);
  });
  observer.observe(document.body, { childList: true, subtree: true });
  return () => observer.disconnect();
}

/** Inline banner with one-click redact for risky AI responses. */
function mountResponseGuard(target: HTMLElement, response: RuntimeScanResponse) {
  if (target.querySelector("[data-soter-response-guard]")) return;
  const redacted = response.result.redactedText ?? "";
  target.style.position = target.style.position || "relative";
  const banner = document.createElement("div");
  banner.setAttribute("data-soter-response-guard", "true");
  banner.style.cssText = [
    "display:flex", "align-items:center", "gap:8px", "padding:6px 10px",
    "margin:6px 0", "border-radius:8px", "font:12px/1.4 system-ui,sans-serif",
    "background:#7c2d12", "color:#fff", "z-index:2147483647",
  ].join(";");
  const label = document.createElement("span");
  label.textContent = `Soter: sensitive content detected in this response (${response.result.policy.severity}).`;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = "Hide sensitive";
  btn.style.cssText = "background:#fff;color:#7c2d12;border:0;border-radius:6px;padding:2px 8px;cursor:pointer";
  btn.addEventListener("click", () => {
    if (redacted) {
      const el = target.querySelector("pre, code, p, div[data-soter-body]") as HTMLElement | null;
      (el ?? target).textContent = redacted;
    }
    banner.remove();
  });
  banner.appendChild(label);
  banner.appendChild(btn);
  target.prepend(banner);
}


function sendResponseScan(text: string) {
  return new Promise<RuntimeResponse>((resolve) => chrome.runtime.sendMessage(
    { type: "SOTER_SCAN_TEXT", text, url: location.href, eventType: "response" },
    (response) => resolve((response as RuntimeResponse) ?? { ok: false, message: chrome.runtime.lastError?.message ?? "No response." }),
  ));
}
