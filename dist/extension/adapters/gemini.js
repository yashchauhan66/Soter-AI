import { genericEditorAdapter, getElementText, hostMatches, isVisible, setElementText } from "./generic-editor.js";
/**
 * Gemini (gemini.google.com, bard.google.com)-specific adapter with hardened selectors.
 */
export function geminiAdapter() {
    const generic = genericEditorAdapter();
    function matches(urlOrHostname) {
        return hostMatches(urlOrHostname, ["gemini.google.com", "bard.google.com"]);
    }
    function getPromptTargets() {
        const specificSelectors = [
            "textarea[placeholder*='Enter a prompt']",
            "textarea[placeholder*='prompt']",
            "div[contenteditable='true']",
            "textarea:not([disabled])",
            "div[role='textbox']",
        ];
        const seen = new Set();
        const elements = [];
        for (const selector of specificSelectors) {
            const found = document.querySelectorAll(selector);
            found.forEach(el => {
                if (isVisible(el) && !el.closest("[data-soter-overlay]") && !seen.has(el)) {
                    seen.add(el);
                    elements.push(el);
                }
            });
        }
        if (elements.length === 0)
            return generic.getPromptTargets();
        return elements.map(element => ({
            element,
            getText: () => getElementText(element),
            setText: (value) => setElementText(element, value),
        }));
    }
    function getResponseTargets() {
        const selectors = [
            "[data-message-author-role='assistant']",
            ".response-content",
            ".model-response",
            "[class*='response']:not([class*='user'])",
        ];
        const seen = new Set();
        document.querySelectorAll(selectors.join(",")).forEach(el => {
            if (isVisible(el) && !seen.has(el))
                seen.add(el);
        });
        if (seen.size === 0)
            return generic.getResponseTargets();
        return Array.from(seen);
    }
    function isSubmitControl(element) {
        const ariaLabel = element.getAttribute("aria-label")?.toLowerCase() ?? "";
        if (ariaLabel.includes("send"))
            return true;
        if (ariaLabel.includes("submit"))
            return true;
        const testId = element.getAttribute("data-testid")?.toLowerCase() ?? "";
        if (testId.includes("send"))
            return true;
        return generic.isSubmitControl(element);
    }
    return {
        name: "gemini",
        matches,
        getPromptTargets,
        getResponseTargets,
        isSubmitControl,
        debug: () => ({
            adapter: "gemini",
            matched: matches(location.href),
            promptTargets: getPromptTargets().map(t => ({
                tag: t.element.tagName,
                id: t.element.id,
                className: t.element.className?.slice(0, 60),
                visible: isVisible(t.element),
                textLength: t.getText().length,
            })),
            responseTargets: getResponseTargets().map(t => ({
                tag: t.tagName,
                className: t.className?.slice(0, 60),
                textLength: (t.textContent ?? "").length,
            })),
            submitControls: Array.from(document.querySelectorAll("button, [role='button'], input[type='submit']"))
                .filter(el => isSubmitControl(el))
                .map(el => ({
                tag: el.tagName,
                id: el.id,
                text: (el.textContent ?? "").slice(0, 40),
                ariaLabel: el.getAttribute("aria-label"),
                dataTestId: el.getAttribute("data-testid"),
            })),
        }),
    };
}
