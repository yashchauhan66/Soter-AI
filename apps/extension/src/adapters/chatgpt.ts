import type { AiSiteAdapter, PromptTarget } from "./generic-editor";
import { genericEditorAdapter, getElementText, hostMatches, isVisible, setElementText } from "./generic-editor";

/**
 * ChatGPT-specific adapter with hardened selectors and fallback to generic.
 * Supports chatgpt.com and chat.openai.com.
 */
export function chatgptAdapter(): AiSiteAdapter {
  const generic = genericEditorAdapter();

  function matches(urlOrHostname: string): boolean {
    return hostMatches(urlOrHostname, ["chatgpt.com", "chat.openai.com"]);
  }

  function getPromptTargets(): PromptTarget[] {
    // ChatGPT-specific selectors (most specific first)
    const specificSelectors = [
      "#prompt-textarea",                    // Current ChatGPT textarea
      "textarea[placeholder='Send a message']", // Fallback placeholder
      "[data-message-input] textarea",        // Data attribute selector
      "form textarea:not([disabled])",        // Any enabled textarea in form
      "div[contenteditable='true']",          // Contenteditable fallback
      "div[role='textbox']",                  // Role-based fallback
    ];

    const elements = new Set<HTMLElement>();
    for (const selector of specificSelectors) {
      const found = document.querySelectorAll<HTMLElement>(selector);
      found.forEach(el => {
        if (isVisible(el) && !el.closest("[data-soter-overlay]")) {
          elements.add(el);
        }
      });
    }

    // If no site-specific elements found, fall back to generic
    if (elements.size === 0) {
      return generic.getPromptTargets();
    }

    return Array.from(elements).map(element => ({
      element,
      getText: () => getElementText(element),
      setText: (value: string) => setElementText(element, value),
    }));
  }

  function getResponseTargets(): HTMLElement[] {
    const selectors = [
      "[data-message-author-role='assistant']",
      "[data-testid='conversation-turn'] .markdown",
      "article .markdown",
      "[class*='message']:not([class*='user'])",
    ];
    const elements = new Set<HTMLElement>();
    for (const selector of selectors) {
      document.querySelectorAll<HTMLElement>(selector).forEach(el => {
        if (isVisible(el)) elements.add(el);
      });
    }
    if (elements.size === 0) return generic.getResponseTargets();
    return Array.from(elements);
  }

  function isSubmitControl(element: Element): boolean {
    // ChatGPT-specific send button detection
    const testId = element.getAttribute("data-testid");
    if (testId === "send-button") return true;

    const ariaLabel = element.getAttribute("aria-label")?.toLowerCase() ?? "";
    if (ariaLabel.includes("send")) return true;
    if (ariaLabel.includes("submit")) return true;

    const text = element.textContent?.toLowerCase() ?? "";
    if (text.includes("send") && !element.matches("a")) return true;

    return generic.isSubmitControl(element);
  }

  return {
    name: "chatgpt",
    matches,
    getPromptTargets,
    getResponseTargets,
    isSubmitControl,
    debug: () => ({
      adapter: "chatgpt",
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
