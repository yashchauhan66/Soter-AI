import { domainFromUrl } from "./scanner";

export type SourceAppCategory = "email" | "document" | "spreadsheet" | "source_code" | "ticketing" | "crm" | "chat" | "knowledge_base" | "internal_app" | "unknown";

export interface SourceAppConfig {
  id: string;
  name: string;
  domains: string[];
  category: SourceAppCategory;
  enabled: boolean;
  sensitivity: "low" | "medium" | "high" | "critical";
}

export function matchSourceApp(url: string, sourceApps: SourceAppConfig[]) {
  const domain = domainFromUrl(url);
  return sourceApps.find((app) => app.enabled && app.domains.some((pattern) => domainMatches(domain, pattern)));
}

function domainMatches(actual: string, pattern: string) {
  const normalizedActual = actual.toLowerCase().replace(/^www\./, "");
  const normalizedPattern = pattern.toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^\*\./, "");
  return normalizedActual === normalizedPattern || normalizedActual.endsWith(`.${normalizedPattern}`);
}
