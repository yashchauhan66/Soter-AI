export function installResponseObserver(adapter, enabled) {
    const scanned = new WeakMap();
    let timer;
    const scanResponses = () => {
        if (!enabled)
            return;
        for (const target of adapter.getResponseTargets()) {
            const text = (target.innerText || target.textContent || "").trim();
            if (text.length < 20 || scanned.get(target) === text)
                continue;
            scanned.set(target, text);
            void sendResponseScan(text).then((response) => {
                if (response.ok && response.result.hasFindings) {
                    target.setAttribute("data-soter-response-risk", response.result.policy.severity);
                    target.setAttribute("title", "Soter detected sensitive content in this AI response. Review before using it.");
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
function sendResponseScan(text) {
    return new Promise((resolve) => chrome.runtime.sendMessage({ type: "SOTER_SCAN_TEXT", text, url: location.href, eventType: "response" }, (response) => resolve(response ?? { ok: false, message: chrome.runtime.lastError?.message ?? "No response." })));
}
