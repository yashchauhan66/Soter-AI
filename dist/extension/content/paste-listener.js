import { currentPromptTarget } from "./dom-observer.js";
import { showSoterOverlay } from "./overlay.js";
export function installPasteListener(adapter) {
    document.addEventListener("paste", async (event) => {
        const target = currentPromptTarget(adapter);
        if (!target?.element.contains(event.target))
            return;
        const pasted = event.clipboardData?.getData("text/plain") ?? "";
        if (!pasted.trim())
            return;
        const response = await sendPasteScan(pasted);
        if (!response.ok || !response.result.hasFindings)
            return;
        showSoterOverlay({
            result: response.result,
            onReplace: () => target.setText(response.result.rewrittenSafeText || response.result.redactedText),
            onCopy: () => void navigator.clipboard?.writeText(response.result.rewrittenSafeText || response.result.redactedText),
            onApproval: () => void chrome.runtime.sendMessage({ type: "SOTER_REQUEST_APPROVAL", text: pasted, url: location.href }),
        });
    }, true);
}
function sendPasteScan(text) {
    return new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: "SOTER_SCAN_TEXT", text, url: location.href, eventType: "paste" }, (response) => {
            resolve(response ?? { ok: false, message: chrome.runtime.lastError?.message ?? "No response." });
        });
    });
}
