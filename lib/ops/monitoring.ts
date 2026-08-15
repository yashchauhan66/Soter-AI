import { db } from "../db";

// Workflow audit is tracked apart from `guard_api_latency_ms` on purpose: it is a
// static analysis of a whole workflow export, so its latency is an order of
// magnitude larger than a guard call. Folding it in would inflate the guard
// percentiles published in docs/LATENCY-SLA.md.
export async function recordRequestMetric(metric: "guard_api_latency_ms" | "dashboard_latency_ms" | "workflow_audit_latency_ms", durationMs: number, failed = false) {
  if (!failed && Math.random() > 0.1) return;
  await db.productionMetric.createMany({ data: [
    { metric: "request_total", value: 1, unit: "request", dimensions: { source: metric } },
    { metric, value: durationMs, unit: "ms" },
    ...(failed ? [{ metric: "request_error", value: 1, unit: "error", dimensions: { source: metric } }] : []),
  ] }).catch((error) => console.error("[SoterAI] Failed to record request metric", metric, error));
}
