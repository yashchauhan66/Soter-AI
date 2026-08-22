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
 */

import type { RuntimeResponse } from "../lib/types";

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
    void sendWsResponseScan(combined);
  };

  window.addEventListener(BRIDGE_EVENT, onFrame);

  return () => {
    window.removeEventListener(BRIDGE_EVENT, onFrame);
    clearTimeout(scanTimer);
    pendingFrames = [];
    // Note: we cannot un-hook WebSocket.prototype from here without a page reload.
    // This is acceptable: the hook is inert when the content script is gone
    // (no listener for BRIDGE_EVENT), and the extension only injects on declared hosts.
  };
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