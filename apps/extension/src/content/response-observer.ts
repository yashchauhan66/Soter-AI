import type { AiSiteAdapter } from "../adapters/generic-editor";
import type { RuntimeResponse, RuntimeScanResponse } from "../lib/types";

/**
 * Response-side semantic DLP (Tier-1): when the AI's *answer* regurgitates
 * secrets/PII/unsafe content, mark it AND show an inline action banner with a
 * one-click "hide sensitive" redaction so the leak never leaves the page.
 *
 * v0.2.1 UX REDESIGN:
 * - Banner ONLY shows for high/critical severity (not low/medium)
 * - Low/medium gets a subtle inline badge that doesn't disrupt reading
 * - Premium glassmorphism design that blends with modern AI chat UIs
 * - Auto-dismiss after 8 seconds for non-critical findings
 * - Smooth fade-in animation, no jarring appearance
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
          const riskScore = response.result.riskScore;
          target.setAttribute("data-soter-response-risk", severity);
          // Only mount visible guard for high/critical or riskScore >= 60
          if (severity === "critical" || severity === "high" || riskScore >= 60) {
            mountResponseGuard(target, response);
          } else {
            // Low/medium: subtle badge only, no disruptive banner
            mountSubtleBadge(target, response);
          }
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

/**
 * v0.2.1: Premium banner for HIGH/CRITICAL findings only.
 * Glassmorphism design, smooth animation, auto-dismiss option.
 */
function mountResponseGuard(target: HTMLElement, response: RuntimeScanResponse) {
  if (target.querySelector("[data-soter-response-guard]")) return;
  const redacted = response.result.redactedText ?? "";
  const severity = response.result.policy.severity;
  const isCritical = severity === "critical";
  target.style.position = target.style.position || "relative";

  const banner = document.createElement("div");
  banner.setAttribute("data-soter-response-guard", "true");
  banner.style.cssText = [
    "display:flex", "align-items:center", "gap:10px",
    "padding:8px 14px", "margin:8px 0 4px",
    "border-radius:10px",
    "font:12px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif",
    isCritical
      ? "background:linear-gradient(135deg,rgba(220,38,38,0.08),rgba(220,38,38,0.04));border:1px solid rgba(220,38,38,0.2);color:#b91c1c"
      : "background:linear-gradient(135deg,rgba(217,119,6,0.08),rgba(217,119,6,0.04));border:1px solid rgba(217,119,6,0.2);color:#92400e",
    "backdrop-filter:blur(8px)",
    "z-index:2147483647",
    "opacity:0", "transform:translateY(-4px)",
    "transition:opacity 0.3s ease,transform 0.3s ease",
    "max-width:100%", "box-sizing:border-box",
  ].join(";");

  // Shield icon
  const icon = document.createElement("span");
  icon.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`;
  icon.style.cssText = "display:flex;align-items:center;opacity:0.8";

  const label = document.createElement("span");
  label.textContent = isCritical
    ? "Sensitive data detected in this response"
    : "Potentially sensitive content in this response";
  label.style.cssText = "flex:1;font-weight:500;letter-spacing:-0.01em";

  const btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = "Hide";
  btn.style.cssText = [
    "background:currentColor", "color:inherit", "border:0", "border-radius:6px",
    "padding:3px 10px", "cursor:pointer", "font-size:11px", "font-weight:600",
    "opacity:0.9", "transition:opacity 0.15s", "flex-shrink:0",
    "background:transparent", "border:1px solid currentColor",
  ].join(";");
  btn.addEventListener("mouseenter", () => { btn.style.opacity = "1"; });
  btn.addEventListener("mouseleave", () => { btn.style.opacity = "0.9"; });
  btn.addEventListener("click", () => {
    if (redacted) {
      const el = target.querySelector("pre, code, p, div[data-soter-body]") as HTMLElement | null;
      (el ?? target).textContent = redacted;
    }
    banner.style.opacity = "0";
    banner.style.transform = "translateY(-4px)";
    setTimeout(() => banner.remove(), 300);
  });

  // Dismiss X button
  const dismiss = document.createElement("button");
  dismiss.type = "button";
  dismiss.innerHTML = "&times;";
  dismiss.style.cssText = "background:none;border:0;cursor:pointer;font-size:16px;opacity:0.5;padding:0 2px;line-height:1;flex-shrink:0";
  dismiss.addEventListener("click", () => {
    banner.style.opacity = "0";
    banner.style.transform = "translateY(-4px)";
    setTimeout(() => banner.remove(), 300);
  });

  banner.appendChild(icon);
  banner.appendChild(label);
  banner.appendChild(btn);
  banner.appendChild(dismiss);
  target.prepend(banner);

  // Animate in
  requestAnimationFrame(() => {
    banner.style.opacity = "1";
    banner.style.transform = "translateY(0)";
  });

  // Auto-dismiss non-critical after 10 seconds
  if (!isCritical) {
    setTimeout(() => {
      if (banner.isConnected) {
        banner.style.opacity = "0";
        banner.style.transform = "translateY(-4px)";
        setTimeout(() => banner.remove(), 300);
      }
    }, 10_000);
  }
}

/**
 * v0.2.1: Subtle inline badge for LOW/MEDIUM findings.
 * A tiny pill that doesn't disrupt the reading experience.
 * Clicking it reveals the option to redact.
 */
function mountSubtleBadge(target: HTMLElement, response: RuntimeScanResponse) {
  if (target.querySelector("[data-soter-response-badge]")) return;
  const redacted = response.result.redactedText ?? "";

  const badge = document.createElement("span");
  badge.setAttribute("data-soter-response-badge", "true");
  badge.style.cssText = [
    "display:inline-flex", "align-items:center", "gap:4px",
    "padding:2px 8px", "margin-left:6px", "border-radius:12px",
    "font:10px/1.4 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif",
    "background:rgba(100,116,139,0.08)", "color:#64748b",
    "border:1px solid rgba(100,116,139,0.15)",
    "cursor:pointer", "vertical-align:middle",
    "transition:background 0.15s,color 0.15s",
    "user-select:none",
  ].join(";");
  badge.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg><span>Soter</span>`;
  badge.title = "Soter detected potentially sensitive content. Click to redact.";

  badge.addEventListener("mouseenter", () => {
    badge.style.background = "rgba(100,116,139,0.15)";
    badge.style.color = "#475569";
  });
  badge.addEventListener("mouseleave", () => {
    badge.style.background = "rgba(100,116,139,0.08)";
    badge.style.color = "#64748b";
  });
  badge.addEventListener("click", () => {
    if (redacted) {
      const el = target.querySelector("pre, code, p, div[data-soter-body]") as HTMLElement | null;
      (el ?? target).textContent = redacted;
    }
    badge.remove();
  });

  // Append at the end of the first line/paragraph
  const firstChild = target.querySelector("p, div, span") as HTMLElement | null;
  if (firstChild) {
    firstChild.appendChild(badge);
  } else {
    target.appendChild(badge);
  }

  // Auto-remove subtle badge after 15 seconds
  setTimeout(() => {
    if (badge.isConnected) {
      badge.style.opacity = "0";
      badge.style.transition = "opacity 0.5s";
      setTimeout(() => badge.remove(), 500);
    }
  }, 15_000);
}

function sendResponseScan(text: string) {
  return new Promise<RuntimeResponse>((resolve) => chrome.runtime.sendMessage(
    { type: "SOTER_SCAN_TEXT", text, url: location.href, eventType: "response" },
    (response) => resolve((response as RuntimeResponse) ?? { ok: false, message: chrome.runtime.lastError?.message ?? "No response." }),
  ));
}