import type { AiSiteAdapter, PromptTarget } from "./generic-editor";
import { genericEditorAdapter, getElementText, hostMatches, isVisible, setElementText } from "./generic-editor";

/**
 * Perplexity.ai-specific adapter with hardened selectors and fallback to generic.
 */
export function perplexityAdapter(): AiSiteAdapter {
  const generic = genericEditorAdapter();

  function matches(urlOrHostname: string): boolean {
    return hostMatches(urlOrHostname, ["perplexity.ai", "www.perplexity.ai"]);
  }

  function getPromptTargets(): PromptTarget[] {
    const specificSelectors = [
      "textarea[placeholder*='Ask anything']",
      "textarea[placeholder*='perplexity']",
      "textarea[placeholder*='search']",
      "textarea:not([disabled])",
      "div[contenteditable='true']",
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

    if (elements.length === 0) return generic.getPromptTargets();

    return elements.map(element => ({
      element,
      getText: () => getElementText(element),
      setText: (value: string) => setElementText(element, value),
    }));
  }

  function getResponseTargets(): HTMLElement[] {
    const selectors = [
      "[class*='answer']",
      "[class*='response']",
      ".prose",
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
    if (ariaLabel.includes("ask")) return true;
    if (ariaLabel.includes("search")) return true;
    if (ariaLabel.includes("submit")) return true;

    const text = element.textContent?.toLowerCase() ?? "";
    if (text.includes("ask")) return true;
    if (text.includes("search")) return true;

    return generic.isSubmitControl(element);
  }

  return {
    name: "perplexity",
    matches,
    getPromptTargets,
    getResponseTargets,
    isSubmitControl,
    debug: () => ({
      adapter: "perplexity",
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
