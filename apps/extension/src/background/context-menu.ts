export const SCAN_CONTEXT_MENU_ID = "soter-scan-selection";

/**
 * Only used if the manifest cannot be read, which should not happen inside the extension's own
 * service worker. Kept minimal on purpose — the manifest below is the real list.
 */
const FALLBACK_PATTERNS = [
  "https://chatgpt.com/*",
  "https://chat.openai.com/*",
  "https://claude.ai/*",
  "https://gemini.google.com/*",
  "https://www.perplexity.ai/*",
  "https://poe.com/*",
];

/**
 * The pages the extension actually guards, taken from the manifest rather than retyped.
 *
 * The menu previously carried its own hand-written list of eight patterns, two of which
 * (`bard.google.com`, bare `perplexity.ai`) the extension has no host permission for at all,
 * while twelve real guarded destinations — openrouter, replit, stackblitz, codesandbox,
 * github.dev, bolt.new, v0.dev, lovable.dev, openwebui and soterai.in among them — were
 * missing. So on more than half of the sites Soter protects, "Scan with Soter" simply did not
 * appear in the right-click menu, and nothing in the code connected that list to the manifest
 * that defines the coverage. Deriving it removes the ability to drift.
 */
export function guardedDocumentUrlPatterns(): string[] {
  try {
    const scripts = chrome.runtime.getManifest().content_scripts ?? [];
    const patterns = new Set<string>();
    for (const script of scripts) {
      for (const match of script.matches ?? []) patterns.add(match);
    }
    return patterns.size > 0 ? Array.from(patterns) : FALLBACK_PATTERNS;
  } catch {
    return FALLBACK_PATTERNS;
  }
}

export function registerContextMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: SCAN_CONTEXT_MENU_ID,
      title: "Scan selection with Soter",
      contexts: ["selection"],
      documentUrlPatterns: guardedDocumentUrlPatterns(),
    });
  });
}
