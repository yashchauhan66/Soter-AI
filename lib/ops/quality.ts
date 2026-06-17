export interface QualityFeedbackRow {
  feedback: "FALSE_POSITIVE" | "FALSE_NEGATIVE" | "CORRECT";
  detector?: string | null;
  accepted?: boolean;
}

export function detectionQualityMetrics(rows: QualityFeedbackRow[]) {
  const total = rows.length;
  const falsePositives = rows.filter((row) => row.feedback === "FALSE_POSITIVE").length;
  const falseNegatives = rows.filter((row) => row.feedback === "FALSE_NEGATIVE").length;
  const accepted = rows.filter((row) => row.accepted).length;
  const detectorCounts = new Map<string, number>();
  for (const row of rows) {
    if (row.feedback !== "FALSE_POSITIVE" || !row.detector) continue;
    detectorCounts.set(row.detector, (detectorCounts.get(row.detector) ?? 0) + 1);
  }
  const topNoisyDetector = [...detectorCounts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Not enough feedback";
  return {
    total,
    falsePositiveRate: total ? falsePositives / total : 0,
    falseNegativeRate: total ? falseNegatives / total : 0,
    accepted,
    topNoisyDetector,
  };
}

export const PRODUCTION_THRESHOLDS = {
  guardApiP95Ms: 800,
  dashboardP95Ms: 2000,
  errorRatePercent: 1,
  webhookFailurePercent: 3,
  billingFailures: 1,
  workerBacklog: 100,
  ragQueueBacklog: 50,
  ocrQueueBacklog: 25,
} as const;
