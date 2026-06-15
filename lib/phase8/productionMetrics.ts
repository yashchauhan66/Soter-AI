import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

const PRODUCTION_METRICS = [
  "guard_api_latency_ms",
  "dashboard_latency_ms",
  "request_total",
  "request_error",
] as const;

type ProductionMetricName = (typeof PRODUCTION_METRICS)[number];

interface ProductionMetricAggregateRow {
  metric: ProductionMetricName;
  sampleCount: bigint | number;
  p50: number | null;
  p95: number | null;
}

export interface ProductionMetricSummary {
  guardApiP50: number | null;
  guardApiP95: number | null;
  dashboardP95: number | null;
  requestCount: number;
  errorCount: number;
}

function countFor(rows: Map<ProductionMetricName, ProductionMetricAggregateRow>, metric: ProductionMetricName) {
  return Number(rows.get(metric)?.sampleCount ?? 0);
}

function percentileFor(
  rows: Map<ProductionMetricName, ProductionMetricAggregateRow>,
  metric: ProductionMetricName,
  percentile: "p50" | "p95",
) {
  return rows.get(metric)?.[percentile] ?? null;
}

export function normalizeProductionMetricSummary(rows: ProductionMetricAggregateRow[]): ProductionMetricSummary {
  const byMetric = new Map(rows.map((row) => [row.metric, row]));
  return {
    guardApiP50: percentileFor(byMetric, "guard_api_latency_ms", "p50"),
    guardApiP95: percentileFor(byMetric, "guard_api_latency_ms", "p95"),
    dashboardP95: percentileFor(byMetric, "dashboard_latency_ms", "p95"),
    requestCount: countFor(byMetric, "request_total"),
    errorCount: countFor(byMetric, "request_error"),
  };
}

export async function getProductionMetricSummary(since: Date): Promise<ProductionMetricSummary> {
  const rows = await db.$queryRaw<ProductionMetricAggregateRow[]>(Prisma.sql`
    SELECT
      "metric",
      COUNT(*)::bigint AS "sampleCount",
      percentile_cont(0.5) WITHIN GROUP (ORDER BY "value") AS "p50",
      percentile_cont(0.95) WITHIN GROUP (ORDER BY "value") AS "p95"
    FROM "ProductionMetric"
    WHERE "recordedAt" >= ${since}
      AND "metric" IN (${Prisma.join([...PRODUCTION_METRICS])})
    GROUP BY "metric"
  `);
  return normalizeProductionMetricSummary(rows);
}
