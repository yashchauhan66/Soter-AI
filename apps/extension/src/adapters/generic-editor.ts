export interface PromptTarget {
  element: HTMLElement;
  getText(): string;
  setText(value: string): void;
}

export interface DebugInfo {
  adapter: string;
  matched: boolean;
  promptTargets: Array<{ tag: string; id: string; className: string; visible: boolean; textLength: number }>;
  responseTargets: Array<{ tag: string; className: string; textLength: number }>;
  submitControls: Array<{ tag: string; id: string; text: string; ariaLabel: string | null; dataTestId: string | null }>;
}

export interface AiSiteAdapter {
  name: string;
  matches(urlOrHostname: string): boolean;
  getPromptTargets(): PromptTarget[];
  getResponseTargets(): HTMLElement[];
  isSubmitControl(element: Element): boolean;
  /** Optional debug method that logs selector status without leaking prompt content */
  debug?(): DebugInfo;
}

export function genericEditorAdapter(): AiSiteAdapter {
  return {
    name: "generic-editor",
    matches: () => true,
    getPromptTargets: getGenericPromptTargets,
    getResponseTargets: getGenericResponseTargets,
    isSubmitControl: genericSubmitControl,
  };
}

export const genericAdapter = genericEditorAdapter;

export function getGenericPromptTargets(): PromptTarget[] {
  const selector = [
    "textarea",
    "[contenteditable='true']",
    "div[role='textbox']",
    ".monaco-editor textarea.inputarea",
    ".cm-editor .cm-content[contenteditable='true']",
    ".CodeMirror textarea",
  ].join(",");
  const elements = Array.from(document.querySelectorAll<HTMLElement>(selector));
  return dedupe(elements)
    .filter((element) => isVisible(element) && !element.closest("[data-soter-overlay]"))
    .map((element) => ({
      element,
      getText: () => getEditorText(element),
      setText: (value: string) => setElementText(element, value),
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
  return Array.from(document.querySelectorAll<HTMLElement>(selector)).filter(isVisible);
}

export function getElementText(element: HTMLElement) {
  if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) return element.value;
  return element.innerText || element.textContent || "";
}

export function setElementText(element: HTMLElement, value: string) {
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

export function isVisible(element: HTMLElement) {
  const box = element.getBoundingClientRect();
  return box.width > 0 && box.height > 0 && getComputedStyle(element).visibility !== "hidden";
}

export function hostMatches(urlOrHostname: string, domains: string[]) {
  let hostname = urlOrHostname;
  try { hostname = new URL(urlOrHostname).hostname; } catch { /* hostname input */ }
  hostname = hostname.toLowerCase().replace(/^www\./, "");
  return domains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
}

export function platformAdapter(name: string, domains: string[], extraSubmit?: RegExp): AiSiteAdapter {
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

function genericSubmitControl(element: Element) {
  const label = [element.getAttribute("aria-label"), element.getAttribute("data-testid"), element.textContent, element.getAttribute("title")].filter(Boolean).join(" ").toLowerCase();
  return element.matches("button, [role='button'], input[type='submit']") && /\b(send|submit|ask|prompt|run|generate|composer-submit)\b/.test(label);
}

function getEditorText(element: HTMLElement) {
  const monaco = element.closest(".monaco-editor");
  if (monaco) return Array.from(monaco.querySelectorAll<HTMLElement>(".view-line")).map((line) => line.innerText).join("\n") || getElementText(element);
  const codeMirror = element.closest(".cm-editor, .CodeMirror");
  if (codeMirror) return codeMirror.querySelector<HTMLElement>(".cm-content, .CodeMirror-code")?.innerText || getElementText(element);
  return getElementText(element);
}

function dedupe(elements: HTMLElement[]) { return [...new Set(elements)]; }
