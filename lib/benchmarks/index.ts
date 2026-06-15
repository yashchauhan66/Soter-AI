import { performance } from "perf_hooks";

export const BENCHMARK_PREVIEW_GAPS = [
  "Scheduled benchmark pipeline, dataset versioning, and trend history are not complete in this preview.",
  "Public-safe accuracy snapshots require dataset size, language mix, threshold, and limitation disclosure before publication.",
  "Accuracy claims are internal-only; no external audit, no production traffic replay, and no third-party certification are claimed.",
  "Multilingual coverage matrix and per-language thresholds require representative authorized datasets before production use.",
] as const;

export interface BenchmarkCase {
  id: string;
  category: string;
  language: string;
  text: string;
  expectedLabel: string;
}

export interface BenchmarkPrediction {
  label: string;
  confidence: number;
}

export async function runBenchmarkCases(cases: BenchmarkCase[], classify: (text: string) => BenchmarkPrediction | Promise<BenchmarkPrediction>) {
  const results = [];
  for (const item of cases) {
    const started = performance.now();
    const prediction = await classify(item.text);
    const latencyMs = Math.round(performance.now() - started);
    results.push({
      id: item.id,
      category: item.category,
      language: item.language,
      expectedLabel: item.expectedLabel,
      predictedLabel: prediction.label,
      confidence: prediction.confidence,
      latencyMs,
      correct: prediction.label === item.expectedLabel,
    });
  }
  return { results, metrics: calculateBenchmarkMetrics(results) };
}

export function calculateBenchmarkMetrics(results: Array<{ expectedLabel: string; predictedLabel: string; latencyMs: number; correct: boolean }>) {
  const positives = results.filter((result) => result.expectedLabel !== "SAFE");
  const predictedPositive = results.filter((result) => result.predictedLabel !== "SAFE");
  const truePositive = results.filter((result) => result.expectedLabel !== "SAFE" && result.predictedLabel !== "SAFE").length;
  const falsePositive = results.filter((result) => result.expectedLabel === "SAFE" && result.predictedLabel !== "SAFE").length;
  const falseNegative = results.filter((result) => result.expectedLabel !== "SAFE" && result.predictedLabel === "SAFE").length;
  const precision = predictedPositive.length ? truePositive / predictedPositive.length : 1;
  const recall = positives.length ? truePositive / positives.length : 1;
  const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
  const latencies = results.map((result) => result.latencyMs).sort((a, b) => a - b);
  return {
    total: results.length,
    precision,
    recall,
    f1,
    falsePositiveRate: results.length ? falsePositive / results.length : 0,
    falseNegativeRate: results.length ? falseNegative / results.length : 0,
    latency: {
      p50: percentile(latencies, 0.5),
      p95: percentile(latencies, 0.95),
      p99: percentile(latencies, 0.99),
    },
  };
}

function percentile(values: number[], p: number) {
  if (!values.length) return 0;
  return values[Math.min(values.length - 1, Math.floor((values.length - 1) * p))];
}

