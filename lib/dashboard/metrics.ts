import { Prisma } from "@prisma/client";
import { db } from "../db";

interface RiskCountRow {
  label: string;
  value: bigint | number;
}

export interface RiskCount {
  label: string;
  value: number;
}

export function normalizeRiskCounts(rows: RiskCountRow[]): RiskCount[] {
  return rows.map((row) => ({ label: row.label, value: Number(row.value) }));
}

export async function getTopRiskTypes(projectId: string, since: Date, limit = 5): Promise<RiskCount[]> {
  const boundedLimit = Math.min(20, Math.max(1, Math.trunc(limit)));
  const rows = await db.$queryRaw<RiskCountRow[]>(Prisma.sql`
    SELECT risk_type AS label, COUNT(*)::bigint AS value
    FROM "GuardLog"
    CROSS JOIN LATERAL unnest("riskTypes") AS risk_type
    WHERE "projectId" = ${projectId}
      AND "createdAt" >= ${since}
      AND risk_type <> 'LOW_RISK'
    GROUP BY risk_type
    ORDER BY value DESC, risk_type ASC
    LIMIT ${boundedLimit}
  `);
  return normalizeRiskCounts(rows);
}
