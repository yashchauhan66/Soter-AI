export const ABUSE_PREVIEW_GAPS = [
  "Route-wide enforcement on all cost-bearing API paths is not complete in this preview; current coverage focuses on guard input/output paths.",
  "Tenant-aware quota and budget controls exist as helpers; admin overrides and incident review UI are not complete.",
  "Public form/contact rate limiting is bounded but does not yet include CAPTCHA fallback or device-fingerprint heuristics.",
  "Spike detection thresholds require organization-specific tuning before production alerting is enabled.",
] as const;

export interface UsagePoint {
  timestamp: Date;
  count: number;
}

export function hardQuotaDecision(input: { used: number; limit: number; hardStop?: boolean }) {
  const exceeded = input.used >= input.limit;
  return {
    allowed: !(exceeded && input.hardStop !== false),
    exceeded,
    remaining: Math.max(0, input.limit - input.used),
    reason: exceeded ? "Hard quota reached." : "Within quota.",
  };
}

export function detectUsageSpike(points: UsagePoint[], multiplier = 3) {
  if (points.length < 3) return { spike: false, baseline: 0, observed: points.at(-1)?.count ?? 0, severity: "LOW" };
  const historical = points.slice(0, -1);
  const baseline = historical.reduce((sum, point) => sum + point.count, 0) / historical.length;
  const observed = points.at(-1)?.count ?? 0;
  const ratio = baseline ? observed / baseline : observed;
  return {
    spike: ratio >= multiplier,
    baseline,
    observed,
    ratio,
    severity: ratio >= multiplier * 2 ? "HIGH" : ratio >= multiplier ? "MEDIUM" : "LOW",
  };
}

export function buildAbuseSignal(input: { organizationId?: string; projectId?: string; signalType: string; severity: string; metadata?: Record<string, unknown> }) {
  return {
    organizationId: input.organizationId ?? null,
    projectId: input.projectId ?? null,
    signalType: input.signalType,
    severity: input.severity,
    status: "OPEN",
    metadata: input.metadata ?? {},
  };
}
