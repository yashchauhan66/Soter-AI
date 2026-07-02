import type { PolicyAction } from "../../policy-engine/src/types";

export type AIDestinationCategory = "public_ai" | "browser_coding" | "local_ai" | "ide" | "cli_api" | "custom";
export type DestinationRiskLevel = "low" | "medium" | "high" | "critical";
export type DestinationLoggingMode = "metadata_only" | "redacted_prompt" | "disabled" | "full_prompt_explicit_admin_enabled";

export interface AIDestinationPolicy {
  id: string;
  destinationId: string;
  organizationId?: string;
  name: string;
  category: AIDestinationCategory;
  domains: string[];
  urlPatterns: string[];
  defaultRiskLevel: DestinationRiskLevel;
  riskLevel?: DestinationRiskLevel;
  enabled: boolean;
  allowedDepartments: string[];
  allowedRoles: string[];
  policyOverrides: Record<string, PolicyAction>;
  responseScanningEnabled: boolean;
  loggingMode: DestinationLoggingMode;
  createdAt?: string;
  updatedAt?: string;
}

export const BUILT_IN_AI_DESTINATIONS: Omit<AIDestinationPolicy, "organizationId">[] = [
  preset("chatgpt", "ChatGPT", "public_ai", ["chatgpt.com", "chat.openai.com"], "high"),
  preset("claude", "Claude", "public_ai", ["claude.ai"], "high"),
  preset("gemini", "Gemini", "public_ai", ["gemini.google.com", "bard.google.com"], "high"),
  preset("perplexity", "Perplexity", "public_ai", ["perplexity.ai"], "high"),
  preset("poe", "Poe", "public_ai", ["poe.com"], "high"),
  preset("openrouter", "OpenRouter", "public_ai", ["openrouter.ai"], "high"),
  preset("replit", "Replit", "browser_coding", ["replit.com"], "high"),
  preset("stackblitz", "StackBlitz", "browser_coding", ["stackblitz.com"], "high"),
  preset("codesandbox", "CodeSandbox", "browser_coding", ["codesandbox.io"], "high"),
  preset("github-codespaces", "GitHub Codespaces", "browser_coding", ["github.dev"], "high", ["https://*.github.dev/*"]),
  preset("bolt", "Bolt", "browser_coding", ["bolt.new"], "high"),
  preset("v0", "v0", "browser_coding", ["v0.dev"], "high"),
  preset("lovable", "Lovable", "browser_coding", ["lovable.dev"], "high"),
  preset("openwebui", "Open WebUI", "local_ai", [], "medium", ["http://localhost:*/*", "http://127.0.0.1:*/*"]),
  preset("ollama", "Ollama", "local_ai", [], "medium", ["http://localhost:11434/*", "http://127.0.0.1:11434/*"]),
  preset("lm-studio", "LM Studio", "local_ai", [], "medium", ["http://localhost:1234/*", "http://127.0.0.1:1234/*"]),
  preset("anythingllm", "AnythingLLM", "local_ai", [], "medium", ["http://localhost:3001/*", "http://127.0.0.1:3001/*"]),
  preset("text-generation-webui", "text-generation-webui", "local_ai", [], "medium", ["http://localhost:7860/*", "http://127.0.0.1:7860/*"]),
  preset("vscode", "VS Code", "ide", [], "medium"),
  preset("cursor", "Cursor", "ide", [], "medium"),
  preset("windsurf", "Windsurf", "ide", [], "medium"),
  preset("jetbrains", "JetBrains", "ide", [], "medium"),
  preset("ollama-api", "Ollama API", "cli_api", [], "high", ["http://localhost:11434/api/*"]),
  preset("openai-compatible-local", "OpenAI-compatible local endpoints", "cli_api", [], "high"),
  preset("n8n-ai", "n8n AI nodes", "cli_api", [], "high"),
];

function preset(destinationId: string, name: string, category: AIDestinationCategory, domains: string[], defaultRiskLevel: DestinationRiskLevel, urlPatterns: string[] = []): Omit<AIDestinationPolicy, "organizationId"> {
  return {
    id: destinationId,
    destinationId,
    name,
    category,
    domains,
    urlPatterns,
    defaultRiskLevel,
    riskLevel: defaultRiskLevel,
    enabled: true,
    allowedDepartments: ["all"],
    allowedRoles: ["all"],
    policyOverrides: {},
    responseScanningEnabled: true,
    loggingMode: "metadata_only",
  };
}

export function matchAIDestination(urlValue: string, destinations: AIDestinationPolicy[], department?: string, role?: string) {
  let url: URL;
  try {
    url = new URL(urlValue);
  } catch {
    return undefined;
  }
  return destinations.find((destination) => destination.enabled
    && scopeAllows(destination.allowedDepartments, department)
    && scopeAllows(destination.allowedRoles, role)
    && (destination.domains.some((domain) => domainMatches(url.hostname, domain))
      || destination.urlPatterns.some((pattern) => urlPatternMatches(url, pattern))));
}

export function isLocalAIUrl(urlValue: string) {
  try {
    const hostname = new URL(urlValue).hostname.toLowerCase();
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "0.0.0.0" || /^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname);
  } catch {
    return false;
  }
}

export function urlPatternMatches(url: URL, pattern: string) {
  const trimmed = pattern.trim();
  if (!trimmed) return false;
  try {
    const escaped = trimmed.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
    return new RegExp(`^${escaped}$`, "i").test(url.href);
  } catch {
    return false;
  }
}

function domainMatches(hostname: string, pattern: string) {
  const actual = hostname.toLowerCase().replace(/^www\./, "");
  const wanted = pattern.toLowerCase().replace(/^\*\./, "").replace(/^www\./, "");
  return wanted === "*" || actual === wanted || actual.endsWith(`.${wanted}`);
}

function scopeAllows(values: string[], current?: string) {
  if (!values.length || values.some((value) => value.toLowerCase() === "all")) return true;
  return Boolean(current && values.some((value) => value.toLowerCase() === current.toLowerCase()));
}
