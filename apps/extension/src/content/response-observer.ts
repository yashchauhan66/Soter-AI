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
 * - Smooth fade-in animation, no jarring appearance
 *
 * v0.2.2 — nothing here disappears on a timer any more, and every notice says *why*.
 *
 * The banner used to remove itself after 10 seconds (the comment claimed 8) and the badge
 * after 15. Both timers destroyed the only affordance the user had to redact the leak: look
 * away while a long answer streams in, and the warning — and the "Hide" button with it — was
 * gone by the time you looked back, with the sensitive text still on screen. A warning that
 * expires on its own trains the user to ignore warnings. These stay until the user acts on
 * them, which is also what makes them a control rather than decoration.
 */
export function installResponseObserver(adapter: AiSiteAdapter, enabled: boolean) {
  if (!enabled) return () => {};
  const scanned = new WeakMap<HTMLElement, string>();
  let timer: ReturnType<typeof setTimeout> | undefined;

  const scanResponses = () => {
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
  return () => {
    clearTimeout(timer);
    observer.disconnect();
  };
}

/**
 * What was found, in the user's words — the matched policy rule when there is one, otherwise
 * the detected data types.
 *
 * "Sensitive data detected in this response" told the user nothing they could act on: not
 * which rule fired, not what kind of data, not whether it was their own secret coming back or
 * the model inventing an email address. The scan result already carries both, and showing them
 * is the difference between a warning a user believes and one they dismiss reflexively.
 */
export function responseFindingReason(response: RuntimeScanResponse): string {
  const ruleNames = Array.from(
    new Set(
      response.result.policy.matchedRules
        .map((rule) => rule.name)
        .filter((name): name is string => typeof name === "string" && name.length > 0),
    ),
  );
  if (ruleNames.length) return ruleNames.join(" · ");
  const types = response.result.detectedDataTypes.filter(Boolean);
  if (types.length) return types.join(", ").replace(/_/g, " ");
  return "";
}

/** Fades an element out, then removes it. Shared by both dismiss paths. */
function fadeOutAndRemove(element: HTMLElement) {
  element.style.opacity = "0";
  element.style.transform = "translateY(-4px)";
  setTimeout(() => element.remove(), 300);
}

/** Replaces the response body with its redacted form, so the leak leaves the page. */
function applyRedaction(target: HTMLElement, redacted: string) {
  if (!redacted) return;
  const body = target.querySelector("pre, code, p, div[data-soter-body]") as HTMLElement | null;
  (body ?? target).textContent = redacted;
}

/**
 * v0.2.1: Premium banner for HIGH/CRITICAL findings only.
 * Glassmorphism design, smooth animation. Persists until the user acts on it.
 *
 * Exported so the WebSocket observer can reuse exactly this UI — a verdict on a streamed
 * response used to be computed and then thrown away because the banner was module-private.
 */
export function mountResponseGuard(target: HTMLElement, response: RuntimeScanResponse) {
  if (target.querySelector("[data-soter-response-guard]")) return;
  const redacted = response.result.redactedText ?? "";
  const severity = response.result.policy.severity;
  const isCritical = severity === "critical";
  const reason = responseFindingReason(response);
  target.style.position = target.style.position || "relative";

  const banner = document.createElement("div");
  banner.setAttribute("data-soter-response-guard", "true");
  banner.setAttribute("role", "status");
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
  label.style.cssText = "flex:1;font-weight:500;letter-spacing:-0.01em";
  const headline = document.createElement("span");
  headline.textContent = isCritical
    ? "Sensitive data detected in this response"
    : "Potentially sensitive content in this response";
  label.appendChild(headline);
  if (reason) {
    const detail = document.createElement("span");
    // textContent, never innerHTML: `reason` derives from policy rule names and detector
    // labels, and this banner is injected into a page the extension does not control.
    detail.textContent = ` — ${reason}`;
    detail.style.cssText = "font-weight:400;opacity:0.85";
    label.appendChild(detail);
  }

  const btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = "Hide sensitive text";
  btn.style.cssText = [
    "background:transparent", "color:inherit",
    "border:1px solid currentColor", "border-radius:6px",
    "padding:3px 10px", "cursor:pointer", "font-size:11px", "font-weight:600",
    "opacity:0.9", "transition:opacity 0.15s", "flex-shrink:0",
  ].join(";");
  btn.addEventListener("mouseenter", () => { btn.style.opacity = "1"; });
  btn.addEventListener("mouseleave", () => { btn.style.opacity = "0.9"; });
  btn.addEventListener("click", () => {
    applyRedaction(target, redacted);
    fadeOutAndRemove(banner);
  });

  // Dismiss X button
  const dismiss = document.createElement("button");
  dismiss.type = "button";
  dismiss.innerHTML = "&times;";
  dismiss.title = "Dismiss this warning and leave the response as it is";
  dismiss.setAttribute("aria-label", "Dismiss warning");
  dismiss.style.cssText = "background:none;border:0;cursor:pointer;font-size:16px;opacity:0.5;padding:0 2px;line-height:1;flex-shrink:0;color:inherit";
  dismiss.addEventListener("click", () => fadeOutAndRemove(banner));

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
}

/**
 * v0.2.1: Subtle inline badge for LOW/MEDIUM findings.
 * A tiny pill that doesn't disrupt the reading experience.
 * Clicking it redacts. Stays put until clicked — see the note on timers above.
 */
export function mountSubtleBadge(target: HTMLElement, response: RuntimeScanResponse) {
  if (target.querySelector("[data-soter-response-badge]")) return;
  const redacted = response.result.redactedText ?? "";
  const reason = responseFindingReason(response);

  const badge = document.createElement("span");
  badge.setAttribute("data-soter-response-badge", "true");
  badge.setAttribute("role", "button");
  badge.tabIndex = 0;
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
  // The tooltip carries the reason too, so the badge is not a mystery pill.
  badge.title = reason
    ? `Soter detected potentially sensitive content (${reason}). Click to redact it.`
    : "Soter detected potentially sensitive content. Click to redact it.";

  badge.addEventListener("mouseenter", () => {
    badge.style.background = "rgba(100,116,139,0.15)";
    badge.style.color = "#475569";
  });
  badge.addEventListener("mouseleave", () => {
    badge.style.background = "rgba(100,116,139,0.08)";
    badge.style.color = "#64748b";
  });
  const redact = () => {
    applyRedaction(target, redacted);
    badge.remove();
  };
  badge.addEventListener("click", redact);
  badge.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    redact();
  });

  // Append at the end of the first line/paragraph
  const firstChild = target.querySelector("p, div, span") as HTMLElement | null;
  if (firstChild) {
    firstChild.appendChild(badge);
  } else {
    target.appendChild(badge);
  }
}

function sendResponseScan(text: string) {
  return new Promise<RuntimeResponse>((resolve) => chrome.runtime.sendMessage(
    { type: "SOTER_SCAN_TEXT", text, url: location.href, eventType: "response" },
    (response) => resolve((response as RuntimeResponse) ?? { ok: false, message: chrome.runtime.lastError?.message ?? "No response." }),
  ));
}
