import type { RuntimeResponse } from "../lib/types";
import type { AiSiteAdapter } from "./adapters/generic";
import { currentPromptTarget } from "./dom-observer";
import { showSoterOverlay } from "./overlay";
import { getFreshLineageContext } from "../lib/lineage-context";

export function installPasteListener(adapter: AiSiteAdapter) {
  document.addEventListener("paste", async (event) => {
    const target = currentPromptTarget(adapter);
    if (!target?.element.contains(event.target as Node)) return;
    const pasted = event.clipboardData?.getData("text/plain") ?? "";
    if (!pasted.trim()) return;
    const response = await sendPasteScan(pasted);
    if (!response.ok || !response.result.hasFindings) return;
    showSoterOverlay({
      result: response.result,
      onReplace: () => target.setText(response.result.rewrittenSafeText || response.result.redactedText),
      onCopy: () => void navigator.clipboard?.writeText(response.result.rewrittenSafeText || response.result.redactedText),
      onApproval: () => void chrome.runtime.sendMessage({ type: "SOTER_REQUEST_APPROVAL", text: pasted, url: location.href }),
    });
  }, true);
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
