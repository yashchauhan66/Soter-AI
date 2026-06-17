import { db } from "../db";

export async function recordRequestMetric(metric: "guard_api_latency_ms" | "dashboard_latency_ms", durationMs: number, failed = false) {
  if (!failed && Math.random() > 0.1) return;
  await db.productionMetric.createMany({ data: [
    { metric: "request_total", value: 1, unit: "request", dimensions: { source: metric } },
    { metric, value: durationMs, unit: "ms" },
    ...(failed ? [{ metric: "request_error", value: 1, unit: "error", dimensions: { source: metric } }] : []),
  ] }).catch((error) => console.error("[CyberRakshak] Failed to record request metric", metric, error));
}
