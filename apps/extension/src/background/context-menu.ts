export const SCAN_CONTEXT_MENU_ID = "soter-scan-selection";

export function registerContextMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: SCAN_CONTEXT_MENU_ID,
      title: "Scan with Soter",
      contexts: ["selection"],
      documentUrlPatterns: [
        "*://chatgpt.com/*",
        "*://chat.openai.com/*",
        "*://claude.ai/*",
        "*://gemini.google.com/*",
        "*://bard.google.com/*",
        "*://perplexity.ai/*",
        "*://www.perplexity.ai/*",
        "*://poe.com/*",
      ],
    });
  });
}
