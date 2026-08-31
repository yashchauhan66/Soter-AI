/**
 * v0.2.0 — WebSocket response coverage.
 *
 * The network-layer block (SS-9) honestly documents that it cannot see frames on an
 * already-open WebSocket. This module closes part of that gap on the *response* side:
 * it observes WebSocket messages arriving at the page and, when response scanning is
 * enabled, routes them through the same scan pipeline as DOM-rendered responses.
 *
 * Design constraints:
 *  - Runs in the content-script isolated world. We hook the page's WebSocket via an
 *    injected page-world script so we can see frames before the page's own handlers.
 *  - We NEVER modify or block frames here — this is detection/scan only. Blocking
 *    WebSocket traffic requires a different mechanism (service worker DNR cannot
 *    inspect frames). We report findings so the response-observer UI can act.
 *  - Privacy: only text frames are scanned; binary frames are skipped. Raw text is
 *    sent to the service worker for local scanning, same as DOM responses.
 *
 * v0.2.2 — the verdict now reaches the user.
 *
 * `void sendWsResponseScan(combined)` discarded the result. Every frame of every streamed
 * answer was scanned, the finding was computed, and then dropped on the floor: no banner, no
 * badge, no attribute, nothing. The comment above says "we report findings so the
 * response-observer UI can act" — that reporting did not exist. On a site whose DOM adapter
 * selectors miss the answer container, this was the only tier that saw the leak, and it stayed
 * silent. It now raises a persistent notice that states plainly what it can and cannot do.
 */

import type { RuntimeResponse, RuntimeScanResponse } from "../lib/types";
import { responseFindingReason } from "./response-observer";
import { clearCornerNotices, showCornerNotice } from "./corner-notice";

const NOTICE_KEY = "ws-response";

/**
 * Listen for WebSocket text frames forwarded by the MAIN-world hook
 * (`ws-page-hook.ts`, declared with `"world": "MAIN"` in manifest.json).
 * The MAIN-world hook is CSP-safe; this isolated-world listener only scans.
 */
export function installWebSocketObserver(enabled: boolean): () => void {
  if (!enabled) return () => {};

  const BRIDGE_EVENT = "soter-ws-frame";

  // Content-script listener: receives forwarded frames and scans them
  let scanTimer: ReturnType<typeof setTimeout> | undefined;
  let pendingFrames: string[] = [];
  // Streaming answers arrive as many overlapping batches, so the same secret is re-detected
  // every 300 ms. Without this the user would get one notice per batch.
  const announced = new Set<string>();

  const onFrame = (event: Event) => {
    const detail = (event as CustomEvent).detail;
    if (!detail || typeof detail.text !== "string") return;
    pendingFrames.push(detail.text);
    // Debounce: batch frames within 300ms and scan together
    clearTimeout(scanTimer);
    scanTimer = setTimeout(flushAndScan, 300);
  };

  const flushAndScan = () => {
    if (!pendingFrames.length) return;
    // Join frames; AI streaming responses arrive as chunks. Scan the combined text.
    const combined = pendingFrames.join("\n");
    pendingFrames = [];
    if (combined.trim().length < 20) return; // Skip trivial frames
    void sendWsResponseScan(combined).then((response) => {
      if (!response.ok || !response.result.hasFindings) return;
      reportWsFinding(response, announced);
    });
  };

  window.addEventListener(BRIDGE_EVENT, onFrame);
  // Tell the MAIN-world hook a listener exists now, so it can replay the frames that arrived
  // between `document_start` (when it installed) and `document_idle` (when this ran). Without
  // this handshake every frame of a stream that began during page load was dropped.
  try {
    window.dispatchEvent(new CustomEvent("soter-ws-ready"));
  } catch {
    /* nothing to replay if the page broke CustomEvent; live frames still arrive */
  }

  return () => {
    window.removeEventListener(BRIDGE_EVENT, onFrame);
    clearTimeout(scanTimer);
    pendingFrames = [];
    announced.clear();
    clearCornerNotices();
    // Note: we cannot un-hook WebSocket.prototype from here without a page reload.
    // This is acceptable: the hook is inert when the content script is gone
    // (no listener for BRIDGE_EVENT), and the extension only injects on declared hosts.
  };
}

/**
 * Surfaces one WebSocket finding.
 *
 * Deliberately quieter than the DOM path, for two reasons that are worth stating:
 *  1. It cannot redact. The text lives in a frame the page has already consumed; there is no
 *     element we own to rewrite. Offering a "Hide sensitive text" button here would be a
 *     button that does nothing — exactly the kind of claim this codebase refuses to make. The
 *     notice says what happened and that it was recorded, and stops there.
 *  2. The DOM observer usually sees the same answer once it renders, and it *can* redact. When
 *     its banner is already on the page we stay out of the way rather than stacking two
 *     warnings about one leak.
 */
function reportWsFinding(response: RuntimeScanResponse, announced: Set<string>) {
  const severity = response.result.policy.severity;
  const riskScore = response.result.riskScore;
  const reason = responseFindingReason(response);
  document.documentElement.setAttribute("data-soter-ws-response-risk", severity);

  const loud = severity === "critical" || severity === "high" || riskScore >= 60;
  if (!loud) return; // low/medium: the attribute above is the whole report, no UI noise
  // The DOM banner can actually redact, so it wins.
  if (document.querySelector("[data-soter-response-guard]")) return;

  const fingerprint = `${severity}|${reason}`;
  if (announced.has(fingerprint)) return;
  announced.add(fingerprint);
  showCornerNotice({
    key: NOTICE_KEY,
    tone: severity === "critical" ? "critical" : "warning",
    title:
      severity === "critical"
        ? "Sensitive data in a streamed response"
        : "Possible sensitive data in a streamed response",
    lines: [
      reason,
      "This arrived over a live connection, so Soter recorded it but cannot remove it from the page. Review the answer before you copy or forward it.",
    ],
  });
}

function sendWsResponseScan(text: string) {
  return new Promise<RuntimeResponse>((resolve) =>
    chrome.runtime.sendMessage(
      { type: "SOTER_SCAN_TEXT", text, url: location.href, eventType: "response" },
      (response) =>
        resolve(
          (response as RuntimeResponse) ?? {
            ok: false,
            message: chrome.runtime.lastError?.message ?? "No response.",
          },
        ),
    ),
  );
}
