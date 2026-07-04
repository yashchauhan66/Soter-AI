export function genericEditorAdapter() {
    return {
        name: "generic-editor",
        matches: () => true,
        getPromptTargets: getGenericPromptTargets,
        getResponseTargets: getGenericResponseTargets,
        isSubmitControl: genericSubmitControl,
    };
}
export const genericAdapter = genericEditorAdapter;
export function getGenericPromptTargets() {
    const selector = [
        "textarea",
        "[contenteditable='true']",
        "div[role='textbox']",
        ".monaco-editor textarea.inputarea",
        ".cm-editor .cm-content[contenteditable='true']",
        ".CodeMirror textarea",
    ].join(",");
    const elements = Array.from(document.querySelectorAll(selector));
    return dedupe(elements)
        .filter((element) => isVisible(element) && !element.closest("[data-soter-overlay]"))
        .map((element) => ({
        element,
        getText: () => getEditorText(element),
        setText: (value) => setElementText(element, value),
    }));
}
export function getGenericResponseTargets() {
    const selector = [
        "[data-message-author-role='assistant']",
        "[data-testid*='assistant']",
        "[class*='assistant-message']",
        "[class*='response-content']",
        "article [class*='markdown']",
    ].join(",");
    return Array.from(document.querySelectorAll(selector)).filter(isVisible);
}
export function getElementText(element) {
    if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement)
        return element.value;
    return element.innerText || element.textContent || "";
}
export function setElementText(element, value) {
    if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
        const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
        setter?.call(element, value);
        element.dispatchEvent(new Event("input", { bubbles: true }));
        return;
    }
    element.textContent = value;
    element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
}
export function isVisible(element) {
    const box = element.getBoundingClientRect();
    return box.width > 0 && box.height > 0 && getComputedStyle(element).visibility !== "hidden";
}
export function hostMatches(urlOrHostname, domains) {
    let hostname = urlOrHostname;
    try {
        hostname = new URL(urlOrHostname).hostname;
    }
    catch { /* hostname input */ }
    hostname = hostname.toLowerCase().replace(/^www\./, "");
    return domains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
}
export function platformAdapter(name, domains, extraSubmit) {
    const base = genericEditorAdapter();
    return {
        ...base,
        name,
        matches: (input) => hostMatches(input, domains),
        isSubmitControl: (element) => {
            const label = `${element.getAttribute("aria-label") ?? ""} ${element.getAttribute("data-testid") ?? ""} ${element.getAttribute("title") ?? ""} ${element.textContent ?? ""}`.toLowerCase();
            return Boolean(extraSubmit?.test(label)) || base.isSubmitControl(element);
        },
    };
}
function genericSubmitControl(element) {
    const label = [element.getAttribute("aria-label"), element.getAttribute("data-testid"), element.textContent, element.getAttribute("title")].filter(Boolean).join(" ").toLowerCase();
    return element.matches("button, [role='button'], input[type='submit']") && /\b(send|submit|ask|prompt|run|generate|composer-submit)\b/.test(label);
}
function getEditorText(element) {
    const monaco = element.closest(".monaco-editor");
    if (monaco)
        return Array.from(monaco.querySelectorAll(".view-line")).map((line) => line.innerText).join("\n") || getElementText(element);
    const codeMirror = element.closest(".cm-editor, .CodeMirror");
    if (codeMirror)
        return codeMirror.querySelector(".cm-content, .CodeMirror-code")?.innerText || getElementText(element);
    return getElementText(element);
}
function dedupe(elements) { return [...new Set(elements)]; }
