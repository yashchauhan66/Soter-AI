import { db } from "./db";
import { getRedis } from "./redis";
import { getMonthlyUsage } from "./rateLimit";

export type BadgeStatus = "PROTECTED" | "MONITORING_ACTIVE" | "ISSUES_FOUND" | "INACTIVE";

export interface PublicBadgeStatus {
  slug: string;
  brandColor: string | null;
  status: BadgeStatus;
  monitoringActive: boolean;
  monthRequestsScanned: number;
  monthRisksBlocked: number;
  lastActivity: string | null;
  message: string;
  alignment: string;
}

export const PUBLIC_BADGE_STATUS_FIELDS = [
  "slug",
  "brandColor",
  "status",
  "monitoringActive",
  "monthRequestsScanned",
  "monthRisksBlocked",
  "lastActivity",
  "message",
  "alignment",
] as const;

export function publicProjectName(publicName: string | null | undefined) {
  return publicName?.trim() || "Protected AI application";
}

export async function loadBadgeStatus(slug: string): Promise<PublicBadgeStatus | null> {
  const project = await db.project.findUnique({
    where: { badgeSlug: slug },
    select: {
      id: true,
      badgeEnabled: true,
      client: { select: { agency: { select: { branding: { select: { brandColor: true } } } } } },
    },
  });
  if (!project) return null;
  const branding = project.client?.agency?.branding ?? null;

  if (!project.badgeEnabled) {
    return {
      slug,
      brandColor: branding?.brandColor ?? null,
      status: "INACTIVE",
      monitoringActive: false,
      monthRequestsScanned: 0,
      monthRisksBlocked: 0,
      lastActivity: null,
      message: "Badge disabled by the project owner.",
      alignment: "OWASP LLM Top 10 aligned",
    };
  }

  // Redis-backed cache: badge status changes slowly, cache for 60 seconds.
  const redis = getRedis();
  const cacheKey = `badge:${slug}`;
  try {
    const cached = await redis.get<string>(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached) as PublicBadgeStatus;
      return parsed;
    }    } catch (cacheError) {
      console.error("[SoterAI] Badge cache read error:", cacheError);
    }

  const monthStart = new Date();
  monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0);

  const usage = await getMonthlyUsage(project.id);
  const [blocked, lastLog, recentIssue] = await Promise.all([
    db.guardLog.count({ where: { projectId: project.id, action: "BLOCK", createdAt: { gte: monthStart } } }),
    db.guardLog.findFirst({ where: { projectId: project.id }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
    db.guardLog.findFirst({
      where: {
        projectId: project.id,
        action: "BLOCK",
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
  ]);

  const monitoringActive = usage.requestCount > 0;
  let status: BadgeStatus;
  let message: string;
  if (recentIssue) {
    status = "ISSUES_FOUND";
    message = "Risks blocked in the last 24 hours. The gateway is working as designed.";
  } else if (monitoringActive) {
    status = "PROTECTED";
    message = "The guard is active and scanning every chatbot turn.";
  } else {
    status = "MONITORING_ACTIVE";
    message = "Badge active; no traffic observed this month yet.";
  }

  const result: PublicBadgeStatus = {
    slug,
    brandColor: branding?.brandColor ?? null,
    status,
    monitoringActive,
    monthRequestsScanned: usage.requestCount,
    monthRisksBlocked: blocked,
    lastActivity: lastLog?.createdAt?.toISOString() ?? null,
    message,
    alignment: "OWASP LLM Top 10 aligned",
  };    // Cache for 60 seconds to reduce DB load on public badge embeds.
  try {
    await redis.set(cacheKey, JSON.stringify(result), { ex: 60 });
  } catch (cacheError) {
    console.error("[SoterAI] Badge cache write error:", cacheError);
  }

  return result;
}
