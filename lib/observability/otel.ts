import { randomBytes } from "crypto";

export interface TraceSpan { traceId: string; spanId: string; name: string; startedAt: number; attributes: Record<string, string | number | boolean> }

export function startSecuritySpan(name: string, attributes: TraceSpan["attributes"] = {}): TraceSpan {
  return { traceId: randomBytes(16).toString("hex"), spanId: randomBytes(8).toString("hex"), name, startedAt: Date.now(), attributes };
}

export async function endSecuritySpan(span: TraceSpan, status: "OK" | "ERROR", extra: TraceSpan["attributes"] = {}) {
  const record = { traceId: span.traceId, spanId: span.spanId, name: span.name, startTimeUnixMs: span.startedAt, endTimeUnixMs: Date.now(), status, attributes: { ...span.attributes, ...extra } };
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  if (endpoint) {
    await fetch(`${endpoint.replace(/\/$/, "")}/v1/traces`, { method: "POST", headers: { "content-type": "application/json", ...(process.env.OTEL_EXPORTER_OTLP_HEADERS ? Object.fromEntries(process.env.OTEL_EXPORTER_OTLP_HEADERS.split(",").map((pair) => pair.split("=", 2) as [string, string])) : {}) }, body: JSON.stringify({ resourceSpans: [{ resource: { attributes: [{ key: "service.name", value: { stringValue: "cyberrakshak-guard" } }] }, scopeSpans: [{ spans: [record] }] }] }), signal: AbortSignal.timeout(5_000) }).catch((error) => console.warn("[CyberRakshak] OpenTelemetry export failed", error));
  }
  return record;
}

export async function withSecuritySpan<T>(name: string, attributes: TraceSpan["attributes"], operation: () => Promise<T>): Promise<T> {
  const span = startSecuritySpan(name, attributes);
  try { const result = await operation(); await endSecuritySpan(span, "OK"); return result; }
  catch (error) { await endSecuritySpan(span, "ERROR", { "error.type": error instanceof Error ? error.name : "UnknownError" }); throw error; }
}
