export type ThreatIndicatorType = "domain" | "url" | "ip" | "keyword" | "hash";
export type ThreatSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface ThreatIndicator {
  id: string;
  type: ThreatIndicatorType;
  value: string;
  severity: ThreatSeverity;
  source: string;
  expiresAt?: string;
}

export interface ThreatIntelMatch {
  indicator: ThreatIndicator;
  evidence: string;
}

export function evaluateThreatIntel(text: string, indicators: ThreatIndicator[], now = new Date()) {
  const matches: ThreatIntelMatch[] = [];
  const normalized = text.toLowerCase();
  for (const indicator of indicators) {
    if (indicator.expiresAt && new Date(indicator.expiresAt).getTime() < now.getTime()) continue;
    const value = indicator.value.toLowerCase();
    const hit =
      indicator.type === "domain" ? domains(text).some((domain) => domain === value || domain.endsWith(`.${value}`)) :
      indicator.type === "url" ? normalized.includes(value) :
      indicator.type === "ip" ? ips(text).includes(value) :
      indicator.type === "hash" ? normalized.includes(value) :
      normalized.includes(value);
    if (hit) matches.push({ indicator, evidence: indicator.value });
  }
  let max: ThreatSeverity = "LOW";
  for (const match of matches) {
    if (riskOrder(match.indicator.severity) > riskOrder(max)) max = match.indicator.severity;
  }
  return {
    blocked: matches.some((match) => match.indicator.severity === "HIGH" || match.indicator.severity === "CRITICAL"),
    risk: matches.length ? max : "LOW",
    matches,
  };
}

function domains(text: string) {
  return [...text.matchAll(/https?:\/\/([^/\s)"']+)|\b([a-z0-9.-]+\.[a-z]{2,})\b/gi)]
    .map((match) => (match[1] ?? match[2] ?? "").toLowerCase().replace(/^www\./, ""))
    .filter(Boolean);
}

function ips(text: string) {
  return [...text.matchAll(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g)].map((match) => match[0]);
}

function riskOrder(severity: ThreatSeverity) {
  return { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 }[severity];
}
