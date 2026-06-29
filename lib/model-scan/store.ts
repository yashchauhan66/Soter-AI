import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import type { ModelScanReport } from "./index";

/**
 * Persist a scan result. Raw SQL (like lib/supply-chain) so it does not depend
 * on a freshly generated Prisma client at type-check time.
 */
export async function storeModelScan(input: {
  organizationId: string;
  projectId?: string | null;
  scannedById?: string | null;
  report: ModelScanReport;
}): Promise<{ id: string }> {
  const id = `mscan_${randomUUID()}`;
  const r = input.report;
  await db.$executeRaw`
    INSERT INTO "ModelArtifactScan"
      ("id","organizationId","projectId","filename","format","sizeBytes","sha256","verdict","riskScore","highestSeverity","findingCount","report","scannedById","createdAt")
    VALUES
      (${id}, ${input.organizationId}, ${input.projectId ?? null}, ${r.filename ?? "unnamed"}, ${r.format},
       ${r.sizeBytes}, ${r.sha256}, ${r.verdict}, ${r.riskScore}, ${r.highestSeverity}, ${r.findings.length},
       ${JSON.stringify(r)}::jsonb, ${input.scannedById ?? null}, NOW())
  `;
  return { id };
}

export async function recentModelScans(organizationId: string, limit = 20) {
  return db.$queryRaw<Array<{
    id: string; filename: string; format: string; verdict: string;
    riskScore: number; highestSeverity: string; sha256: string; createdAt: Date;
  }>>`
    SELECT "id","filename","format","verdict","riskScore","highestSeverity","sha256","createdAt"
    FROM "ModelArtifactScan"
    WHERE "organizationId" = ${organizationId}
    ORDER BY "createdAt" DESC
    LIMIT ${limit}
  `;
}

export async function modelScanStats(organizationId: string) {
  const rows = await db.$queryRaw<Array<{ verdict: string; count: bigint }>>`
    SELECT "verdict", COUNT(*)::bigint AS count
    FROM "ModelArtifactScan"
    WHERE "organizationId" = ${organizationId}
    GROUP BY "verdict"
  `;
  const stats = { total: 0, malicious: 0, suspicious: 0, safe: 0, unverified: 0 };
  for (const row of rows) {
    const n = Number(row.count);
    stats.total += n;
    if (row.verdict === "MALICIOUS") stats.malicious = n;
    else if (row.verdict === "SUSPICIOUS") stats.suspicious = n;
    else if (row.verdict === "SAFE") stats.safe = n;
    else stats.unverified += n;
  }
  return stats;
}
