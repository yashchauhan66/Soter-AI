import { shouldPreventSubmit } from "../lib/scanner.js";
import { currentPromptTarget } from "./dom-observer.js";
import { showSoterOverlay } from "./overlay.js";
export function installSubmitInterceptor(adapter) {
    const replayBypass = new WeakSet();
    const handleIntent = async (event, target) => {
        if (!target)
            return;
        const text = target.getText().trim();
        if (!text)
            return;
        event.preventDefault();
        event.stopImmediatePropagation();
        const decision = await evaluateSubmitInterception(text, (value) => sendScan(value, "submit"));
        if (!decision.response.ok)
            return;
        const result = decision.response.result;
        if (!decision.intercept) {
            replay(event, replayBypass);
            return;
        }
        showSoterOverlay({
            result,
            onReplace: () => target.setText(result.rewrittenSafeText || result.redactedText),
            onCopy: () => void navigator.clipboard?.writeText(result.rewrittenSafeText || result.redactedText),
            onApproval: () => void chrome.runtime.sendMessage({ type: "SOTER_REQUEST_APPROVAL", text, url: location.href }),
        });
    };
    document.addEventListener("click", (event) => {
        const element = event.target instanceof Element ? event.target.closest("button, [role='button'], input[type='submit']") : null;
        if (element instanceof HTMLElement && replayBypass.has(element)) {
            replayBypass.delete(element);
            return;
        }
        if (element && adapter.isSubmitControl(element))
            void handleIntent(event, currentPromptTarget(adapter));
    }, true);
    document.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey)
            return;
        const target = currentPromptTarget(adapter);
        if (target?.element.contains(event.target))
            void handleIntent(event, target);
    }, true);
}
export async function evaluateSubmitInterception(text, scan) {
    const response = await scan(text);
    if (!response.ok)
        return { intercept: true, response };
    return {
        intercept: response.result.hasFindings || shouldPreventSubmit(response.result.action),
        response,
    };
}
function sendScan(text, eventType) {
    return new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: "SOTER_SCAN_TEXT", text, url: location.href, eventType }, (response) => {
            resolve(response ?? { ok: false, message: chrome.runtime.lastError?.message ?? "No response." });
        });
    });
}
function replay(event, replayBypass) {
    const target = event.target;
    if (!(target instanceof HTMLElement))
        return;
    replayBypass.add(target);
    setTimeout(() => target.click(), 0);
}
