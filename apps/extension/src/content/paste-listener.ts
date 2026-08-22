import type { RuntimeResponse } from "../lib/types";
import type { AiSiteAdapter } from "./adapters/generic";
import { currentPromptTarget } from "./dom-observer";
import { showSoterOverlay } from "./overlay";
import { getFreshLineageContext } from "../lib/lineage-context";

export function installPasteListener(adapter: AiSiteAdapter) {
  // v0.2.1 FIX: Register on WINDOW capture to fire before any page paste handler.
  window.addEventListener("paste", (event) => {
    const target = currentPromptTarget(adapter);
    if (!target?.element.contains(event.target as Node)) return;
    const pasted = event.clipboardData?.getData("text/plain") ?? "";
    if (!pasted.trim()) return;

    // v0.2.1 FIX: ALWAYS preventDefault so the raw text never enters the page DOM.
    // The scan runs first; only after the verdict do we insert safe text.
    // This eliminates the ~400ms exposure window where the raw secret was visible.
    event.preventDefault();
    event.stopImmediatePropagation();

    void sendPasteScan(pasted).then((response) => {
      if (!response.ok || !response.result.hasFindings) {
        // Clean paste: insert the original text after the scan confirms it's safe.
        insertTextAtCursor(target.element, pasted);
        return;
      }
      // Sensitive paste: insert the REDACTED text instead of the raw text.
      const safeText = response.result.rewrittenSafeText || response.result.redactedText;
      insertTextAtCursor(target.element, safeText);
      showSoterOverlay({
        result: response.result,
        onReplace: () => target.setText(response.result.rewrittenSafeText || response.result.redactedText),
        onCopy: () => void navigator.clipboard?.writeText(response.result.rewrittenSafeText || response.result.redactedText),
        onApproval: async () => {
          chrome.runtime.sendMessage({ type: "SOTER_REQUEST_APPROVAL", text: pasted, url: location.href });
          return null;
        },
        onTamper: (detail) => {
          chrome.runtime.sendMessage({
            type: "SOTER_AUDIT_BYPASS",
            text: pasted,
            url: location.href,
            action: response.result.action,
            justification: `overlay tamper detected: ${detail}`,
            dismissedOnly: true,
          });
        },
      });
    });
  }, true);
}

/**
 * v0.2.1: Inserts text at the cursor position in the target element.
 * Works with contenteditable, textarea, and input elements.
 * Uses execCommand for contenteditable (preserves undo stack) and
 * setRangeText for textarea/input.
 */
function insertTextAtCursor(element: HTMLElement, text: string) {
  if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
    const start = element.selectionStart ?? element.value.length;
    const end = element.selectionEnd ?? element.value.length;
    element.setRangeText(text, start, end, "end");
    element.dispatchEvent(new Event("input", { bubbles: true }));
    return;
  }
  // contenteditable
  element.focus();
  const selection = window.getSelection();
  if (selection && selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);
    range.deleteContents();
    range.insertNode(document.createTextNode(text));
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  } else {
    element.textContent = (element.textContent ?? "") + text;
  }
  element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
}

function sendPasteScan(text: string) {
  return new Promise<RuntimeResponse>((resolve) => {
    void getFreshLineageContext().then((lineageContext) => {
      chrome.runtime.sendMessage({ type: "SOTER_SCAN_TEXT", text, url: location.href, eventType: "paste", lineageContext }, (response) => {
        resolve((response as RuntimeResponse) ?? { ok: false, message: chrome.runtime.lastError?.message ?? "No response." });
      });
    });
  });
}
