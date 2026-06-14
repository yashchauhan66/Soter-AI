import { db } from "../lib/db";
import { phase5Benchmark } from "../lib/classifiers/datasets/phase5Benchmark";
import { runClassifierBenchmark } from "../lib/classifiers/evaluation";
import { HeuristicMLBackend } from "../lib/ml/training";

async function main() {
  // Phase 5 rule + multilingual classifier metrics.
  const metrics = await runClassifierBenchmark(phase5Benchmark);
  console.log("\nPhase 5 rule-based classifier metrics:");
  console.log(JSON.stringify({ ...metrics, results: metrics.results.filter((result) => !result.correct) }, null, 2));

  // Phase 6 heuristic ML backend metrics over the same benchmark for parity.
  const backend = new HeuristicMLBackend();
  let correct = 0;
  let calibration = 0;
  const perRisk: Record<string, { total: number; correct: number; recall: number }> = {};
  for (const example of phase5Benchmark) {
    const inference = await backend.infer(example.text, example.label === "UNSAFE_OUTPUT" ? "OUTPUT" : "INPUT");
    const ok = inference.predictedLabel === example.label;
    correct += ok ? 1 : 0;
    calibration += Math.abs(inference.confidence - Number(ok));
    const bucket = perRisk[example.label] ?? { total: 0, correct: 0, recall: 0 };
    bucket.total += 1;
    bucket.correct += Number(ok);
    bucket.recall = bucket.correct / bucket.total;
    perRisk[example.label] = bucket;
  }
  console.log("\nPhase 6 heuristic ML backend metrics:");
  console.log(
    JSON.stringify(
      {
        accuracy: correct / phase5Benchmark.length,
        calibrationError: calibration / phase5Benchmark.length,
        perRisk,
      },
      null,
      2,
    ),
  );

  if (process.env.DATABASE_URL && process.env.PERSIST_CLASSIFIER_EVAL === "true") {
    const dataset = await db.classifierDataset.findFirst({ where: { organizationId: null, name: "Phase 5 benchmark", version: "1.0.0" } }) ?? await db.classifierDataset.create({ data: { name: "Phase 5 benchmark", version: "1.0.0", isBuiltIn: true, examples: { create: phase5Benchmark.map((example) => ({ text: example.text, label: example.label, language: example.language, metadata: { benchmarkId: example.id } })) } } });
    await db.classifierRun.create({ data: { datasetId: dataset.id, detectorVersion: process.env.DETECTOR_VERSION ?? "phase6-rule-v1", status: "COMPLETED", precision: metrics.precision, recall: metrics.recall, f1: metrics.f1, falsePositiveRate: metrics.falsePositiveRate, falseNegativeRate: metrics.falseNegativeRate, calibrationError: metrics.calibrationError, completedAt: new Date(), results: { create: metrics.results.map((result) => ({ expectedLabel: result.expectedLabel, predictedLabel: result.predictedLabel, confidence: result.confidence, correct: result.correct, riskType: result.riskType, metadata: { benchmarkId: result.exampleId } })) } } });
  }
}

main().finally(() => db.$disconnect());
