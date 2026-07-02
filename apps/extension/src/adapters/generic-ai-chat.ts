import type { AiSiteAdapter, PromptTarget } from "./generic-editor";
import { genericEditorAdapter, getElementText, hostMatches, isVisible, setElementText } from "./generic-editor";

/**
 * Generic AI chat adapter for unknown AI destinations.
 * Uses broad selectors and heuristics to identify chat-like interfaces.
 */
export function genericAIChatAdapter(): AiSiteAdapter {
  const generic = genericEditorAdapter();

  function matches(urlOrHostname: string): boolean {
    // Match any hostname as fallback
    return true;
  }

  function getPromptTargets(): PromptTarget[] {
    // Broad selectors for any chat-like interface
    const selectors = [
      "textarea:not([disabled]):not([type='hidden'])",
      "div[contenteditable='true']:not([data-soter-overlay])",
      "div[role='textbox']",
      "[data-message-input] textarea",
      ".chat-input textarea",
      ".prompt-input textarea",
      "form textarea:not([disabled])",
    ];

    const seen = new Set<HTMLElement>();
    const elements: HTMLElement[] = [];
    for (const selector of selectors) {
      const found = document.querySelectorAll<HTMLElement>(selector);
      found.forEach(el => {
        if (isVisible(el) && !el.closest("[data-soter-overlay]") && !seen.has(el)) {
          seen.add(el);
          elements.push(el);
        }
      });
    }

    if (elements.length === 0) return generic.getPromptTargets();

    return elements.map(element => ({
      element,
      getText: () => getElementText(element),
      setText: (value: string) => setElementText(element, value),
    }));
  }

  function getResponseTargets(): HTMLElement[] {
    const selectors = [
      "[class*='assistant-message']",
      "[class*='response-content']",
      "[class*='chat-message']:not([class*='user'])",
      "[data-message-author-role='assistant']",
      ".message:not(.user)",
      "article .markdown",
    ];
    const seen = new Set<HTMLElement>();
    document.querySelectorAll<HTMLElement>(selectors.join(",")).forEach(el => {
      if (isVisible(el) && !seen.has(el)) seen.add(el);
    });
    if (seen.size === 0) return generic.getResponseTargets();
    return Array.from(seen);
  }

  function isSubmitControl(element: Element): boolean {
    const label = [
      element.getAttribute("aria-label"),
      element.getAttribute("data-testid"),
      element.textContent,
      element.getAttribute("title"),
    ].filter(Boolean).join(" ").toLowerCase();

    return /send|submit|ask|prompt|run|generate|composer.submit|chat/.test(label) && 
      (element.matches("button, [role='button'], input[type='submit']") ||
       element.matches("[class*='send'], [class*='submit']"));
  }

  return {
    name: "generic-ai-chat",
    matches,
    getPromptTargets,
    getResponseTargets,
    isSubmitControl,
    debug: () => ({
      adapter: "generic-ai-chat",
      matched: true,
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
