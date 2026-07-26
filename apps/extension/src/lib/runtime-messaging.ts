/**
 * Safe messaging wrapper for chrome.runtime.sendMessage with timeout.
 *
 * Prevents content scripts from hanging indefinitely when the service worker
 * does not respond (e.g. after extension reload, crash, or context invalidation).
 */

/** Default timeout for all runtime sendMessage calls (5 seconds). */
export const RUNTIME_MESSAGE_TIMEOUT_MS = 5_000;

/**
 * Send a message to the extension's service worker with a timeout.
 * If the service worker does not respond within the timeout, resolves
 * with a fallback error response rather than hanging forever.
 */
export function sendMessageWithTimeout<T = unknown>(
  message: unknown,
  timeoutMs = RUNTIME_MESSAGE_TIMEOUT_MS,
): Promise<T> {
  return new Promise<T>((resolve) => {
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve({ ok: false, message: "Extension service worker did not respond in time." } as unknown as T);
    }, timeoutMs);

    try {
      chrome.runtime.sendMessage(message, (response) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(
          (response as T) ?? ({ ok: false, message: chrome.runtime.lastError?.message ?? "No response." } as unknown as T),
        );
      });
    } catch (error) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ ok: false, message: error instanceof Error ? error.message : "Failed to send message." } as unknown as T);
    }
  });
}
