export const SOTER_EXTENSION_VERSION = "0.1.0";

export const AI_DESTINATION_DOMAINS = [
  "chatgpt.com",
  "chat.openai.com",
  "claude.ai",
  "gemini.google.com",
  "bard.google.com",
  "perplexity.ai",
  "poe.com",
] as const;

export const AI_DESTINATION_MATCHES = [
  "*://chatgpt.com/*",
  "*://chat.openai.com/*",
  "*://claude.ai/*",
  "*://gemini.google.com/*",
  "*://bard.google.com/*",
  "*://www.perplexity.ai/*",
  "*://perplexity.ai/*",
  "*://poe.com/*",
] as const;

export const DEFAULT_POLICY_VERSION = "local-default-1";
export const POLICY_CACHE_KEY = "soter.policy.cache";
export const EXTENSION_STATE_KEY = "soter.extension.state";
export const LAST_SCAN_KEY = "soter.latest.scan";
