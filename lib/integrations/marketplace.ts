import { sanitizeMetadata } from "@/lib/guard/logSafety";

export const MARKETPLACE_PROVIDERS = ["SLACK", "MS_TEAMS", "JIRA", "GITHUB"] as const;

export function redactIntegrationPayload(payload: Record<string, unknown>) {
  return sanitizeMetadata(payload);
}

export function integrationDisplayName(provider: string) {
  if (provider === "MS_TEAMS") return "Microsoft Teams";
  return provider.slice(0, 1) + provider.slice(1).toLowerCase();
}
