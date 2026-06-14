import { db } from "./db";
import { getCurrentUser } from "./auth";

export async function getOrCreateAgency() {
  const user = await getCurrentUser();
  const existing = await db.agency.findUnique({ where: { userId: user.id }, include: { branding: true } });
  if (existing) return existing;
  return db.agency.create({
    data: { userId: user.id, name: user.name ? `${user.name} Agency` : "Demo Agency" },
    include: { branding: true },
  });
}

export async function listClients() {
  const agency = await getOrCreateAgency();
  const clients = await db.client.findMany({
    where: { agencyId: agency.id },
    include: {
      projects: { select: { id: true, name: true, plan: true, badgeSlug: true, badgeEnabled: true } },
      _count: { select: { projects: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return { agency, clients };
}

export async function getClientWithStats(clientId: string) {
  const agency = await getOrCreateAgency();
  const client = await db.client.findFirst({
    where: { id: clientId, agencyId: agency.id },
    include: { projects: true },
  });
  if (!client) return null;
  const projectIds = client.projects.map((project) => project.id);
  if (!projectIds.length) {
    return { agency, client, totals: { requests: 0, blocked: 0, redacted: 0, avgRisk: 0 } };
  }
  const [totalRequests, blocked, redacted, avgRisk] = await Promise.all([
    db.guardLog.count({ where: { projectId: { in: projectIds } } }),
    db.guardLog.count({ where: { projectId: { in: projectIds }, action: "BLOCK" } }),
    db.guardLog.count({ where: { projectId: { in: projectIds }, action: "ALLOW_WITH_REDACTION" } }),
    db.guardLog.aggregate({ where: { projectId: { in: projectIds } }, _avg: { riskScore: true } }),
  ]);
  return {
    agency,
    client,
    totals: {
      requests: totalRequests,
      blocked,
      redacted,
      avgRisk: Math.round(avgRisk._avg.riskScore ?? 0),
    },
  };
}
