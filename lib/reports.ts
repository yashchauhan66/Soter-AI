import { Prisma } from "@prisma/client";
import { db } from "./db";

export async function buildMonthlyReport(projectId: string, date = new Date()) {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
  const logs = await db.guardLog.findMany({ where: { projectId, createdAt: { gte: start, lt: end } }, select: { action: true, direction: true, riskScore: true, riskTypes: true } });
  const counts = new Map<string, number>();
  logs.flatMap((log) => log.riskTypes).filter((type) => type !== "LOW_RISK").forEach((type) => counts.set(type, (counts.get(type) ?? 0) + 1));
  const topRiskTypes = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([type, count]) => ({ type, count })).slice(0, 5);
  const recommendations = buildRecommendations(logs, counts);
  return {
    month: date.getUTCMonth() + 1,
    year: date.getUTCFullYear(),
    totalRequests: logs.length,
    blockedRequests: logs.filter((log) => log.action === "BLOCK").length,
    redactedRequests: logs.filter((log) => log.action === "ALLOW_WITH_REDACTION").length,
    avgRiskScore: logs.length ? Math.round(logs.reduce((sum, log) => sum + log.riskScore, 0) / logs.length) : 0,
    topRiskTypes,
    mostCommonRisk: topRiskTypes[0]?.type ?? "No material risks detected",
    recommendations,
  };
}

export async function generateAndStoreMonthlyReport(projectId: string, date = new Date()) {
  const summary = await buildMonthlyReport(projectId, date);
  await db.report.upsert({
    where: {
      projectId_month_year: {
        projectId,
        month: summary.month,
        year: summary.year,
      },
    },
    create: {
      projectId,
      month: summary.month,
      year: summary.year,
      totalRequests: summary.totalRequests,
      blockedRequests: summary.blockedRequests,
      redactedRequests: summary.redactedRequests,
      avgRiskScore: summary.avgRiskScore,
      topRiskTypes: summary.topRiskTypes as Prisma.InputJsonValue,
      recommendations: summary.recommendations as Prisma.InputJsonValue,
    },
    update: {
      totalRequests: summary.totalRequests,
      blockedRequests: summary.blockedRequests,
      redactedRequests: summary.redactedRequests,
      avgRiskScore: summary.avgRiskScore,
      topRiskTypes: summary.topRiskTypes as Prisma.InputJsonValue,
      recommendations: summary.recommendations as Prisma.InputJsonValue,
    },
  });
  return summary;
}

function buildRecommendations(
  logs: Array<{ direction: string; riskTypes: string[] }>,
  counts: Map<string, number>,
) {
  const recommendations = new Set<string>();
  if ((counts.get("SYSTEM_PROMPT_LEAK_ATTEMPT") ?? 0) > 0) {
    recommendations.add("Keep strict blocking enabled for system prompt leak attempts.");
  }
  if ((counts.get("PII_DETECTED") ?? 0) + (counts.get("INDIA_PII_DETECTED") ?? 0) > 0) {
    recommendations.add("Avoid placing personal data in prompts and use the returned redacted safeText.");
  }
  if ((counts.get("SECRET_DETECTED") ?? 0) > 0) {
    recommendations.add("Rotate exposed credentials and review secret-bearing workflows immediately.");
  }
  if (!logs.some((log) => log.direction === "OUTPUT")) {
    recommendations.add("Add the output guard to every model response before it reaches users.");
  }
  recommendations.add("Review blocked and high-risk logs weekly.");
  recommendations.add("Rotate API keys regularly and deactivate unused keys.");
  return [...recommendations];
}
