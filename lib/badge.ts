import { db } from "./db";
import { getMonthlyUsage } from "./rateLimit";

export type BadgeStatus = "PROTECTED" | "MONITORING_ACTIVE" | "ISSUES_FOUND" | "INACTIVE";

export interface PublicBadgeStatus {
  slug: string;
  projectName: string;
  agencyName: string | null;
  brandColor: string | null;
  status: BadgeStatus;
  monitoringActive: boolean;
  monthRequestsScanned: number;
  monthRisksBlocked: number;
  lastActivity: string | null;
  message: string;
  alignment: string;
}

export function publicProjectName(publicName: string | null | undefined) {
  return publicName?.trim() || "Protected AI application";
}

export async function loadBadgeStatus(slug: string): Promise<PublicBadgeStatus | null> {
  const project = await db.project.findUnique({
    where: { badgeSlug: slug },
    include: { client: { include: { agency: { include: { branding: true } } } }, user: true },
  });
  if (!project) return null;
  const branding = project.client?.agency?.branding ?? null;
  const agencyName = branding?.agencyName ?? project.client?.agency?.name ?? null;
  const publicName = publicProjectName(project.publicName);

  if (!project.badgeEnabled) {
    return {
      slug,
      projectName: publicName,
      agencyName,
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

  return {
    slug,
    projectName: publicName,
    agencyName,
    brandColor: branding?.brandColor ?? null,
    status,
    monitoringActive,
    monthRequestsScanned: usage.requestCount,
    monthRisksBlocked: blocked,
    lastActivity: lastLog?.createdAt?.toISOString() ?? null,
    message,
    alignment: "OWASP LLM Top 10 aligned",
  };
}
