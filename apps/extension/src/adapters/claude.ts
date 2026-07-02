import type { AiSiteAdapter, PromptTarget } from "./generic-editor";
import { genericEditorAdapter, getElementText, hostMatches, isVisible, setElementText } from "./generic-editor";

/**
 * Claude.ai-specific adapter with hardened selectors and fallback to generic.
 */
export function claudeAdapter(): AiSiteAdapter {
  const generic = genericEditorAdapter();

  function matches(urlOrHostname: string): boolean {
    return hostMatches(urlOrHostname, ["claude.ai"]);
  }

  function getPromptTargets(): PromptTarget[] {
    // Claude-specific selectors (most specific first)
    const specificSelectors = [
      "div[contenteditable='true']",                 // Claude uses contenteditable div
      "div[contenteditable='true']:not([id='']):not([data-soter-overlay])",
      "textarea",                                     // Fallback
      "div[role='textbox']",                         // Role-based
    ];

    const seen = new Set<HTMLElement>();
    const elements: HTMLElement[] = [];
    for (const selector of specificSelectors) {
      const found = document.querySelectorAll<HTMLElement>(selector);
      found.forEach(el => {
        if (isVisible(el) && !el.closest("[data-soter-overlay]") && !seen.has(el)) {
          seen.add(el);
          elements.push(el);
        }
      });
    }

    // If no site-specific elements found, fall back to generic
    if (elements.length === 0) {
      return generic.getPromptTargets();
    }

    return elements.map(element => ({
      element,
      getText: () => getElementText(element),
      setText: (value: string) => setElementText(element, value),
    }));
  }

  function getResponseTargets(): HTMLElement[] {
    const selectors = [
      "[data-message-author-role='assistant']",
      ".font-claude-message",
      "[class*='message']:not([class*='user'])",
      ".prose p",
      "article",
    ];
    const seen = new Set<HTMLElement>();
    document.querySelectorAll<HTMLElement>(selectors.join(",")).forEach(el => {
      if (isVisible(el) && !seen.has(el)) seen.add(el);
    });
    if (seen.size === 0) return generic.getResponseTargets();
    return Array.from(seen);
  }

  function isSubmitControl(element: Element): boolean {
    const ariaLabel = element.getAttribute("aria-label")?.toLowerCase() ?? "";
    if (ariaLabel.includes("send")) return true;
    if (ariaLabel.includes("submit")) return true;
    if (ariaLabel.includes("message")) return true;

    const testId = element.getAttribute("data-testid")?.toLowerCase() ?? "";
    if (testId.includes("send")) return true;

    const text = element.textContent?.toLowerCase() ?? "";
    if (text.includes("send")) return true;

    return generic.isSubmitControl(element);
  }

  return {
    name: "claude",
    matches,
    getPromptTargets,
    getResponseTargets,
    isSubmitControl,
    debug: () => ({
      adapter: "claude",
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
