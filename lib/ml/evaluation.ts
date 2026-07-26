// Phase 6: classifier evaluation. Computes precision, recall, F1, FP/FN rates,
// and per-risk recall for a given model version against a dataset, then
// persists the result and seeds the false-positive / false-negative review
// queue.

import { db } from "../db";
import type {
  MLDataset,
  MLDatasetExample,
  MLLabel,
  MLModelEvaluation,
  MLModelVersion,
} from "@prisma/client";
import { ALL_ML_LABELS } from "./registry";
import { expectedCalibrationError } from "./thresholds";
import type { ModelBackend } from "./types";

export interface EvaluationOptions {
  seedReviewQueue?: boolean;
  reviewLimit?: number;
}

export interface PerRiskMetric {
  total: number;
  correct: number;
  recall: number;
  precision: number;
  f1: number;
  falsePositives: number;
  falseNegatives: number;
}

export interface EvaluationMetrics {
  precision: number;
  recall: number;
  f1: number;
  falsePositiveRate: number;
  falseNegativeRate: number;
  calibrationError: number;
  totalExamples: number;
  perRisk: Record<string, PerRiskMetric>;
}

export interface EvaluationOutcome {
  evaluation: MLModelEvaluation;
  metrics: EvaluationMetrics;
  predictions: Array<{
    exampleId: string;
    expected: MLLabel;
    predicted: MLLabel;
    confidence: number;
    correct: boolean;
  }>;
}

const POSITIVE_LABELS: MLLabel[] = ALL_ML_LABELS.filter((label) => label !== "SAFE");
const isPositive = (label: MLLabel) => POSITIVE_LABELS.includes(label);

export async function evaluateModel(
  modelVersion: MLModelVersion,
  dataset: MLDataset & { examples?: MLDatasetExample[] },
  backend: ModelBackend,
  options: EvaluationOptions = {},
): Promise<EvaluationOutcome> {
  const examples = dataset.examples ?? (await db.mLDatasetExample.findMany({ where: { datasetId: dataset.id } }));
  const start = Date.now();
  const predictions = [] as EvaluationOutcome["predictions"];
  let tp = 0;
  let fp = 0;
  let fn = 0;
  let tn = 0;
  const perRisk: Record<string, PerRiskMetric> = {};
  const reviewItems: Array<{
    exampleId: string;
    expected: MLLabel;
    predicted: MLLabel;
    confidence: number;
    text: string;
  }> = [];

  for (const example of examples) {
    let predicted: MLLabel = "SAFE";
    let confidence = 0.5;
    try {
      const inference = await backend.infer(example.redactedText, example.label === "UNSAFE_OUTPUT" ? "OUTPUT" : "INPUT");
      predicted = inference.predictedLabel;
      confidence = inference.confidence;
    } catch {
      // Backend failed — treat as SAFE; this is the safety fallback signal.
      predicted = "SAFE";
      confidence = 0.4;
    }
    const correct = predicted === example.label;
    predictions.push({
      exampleId: example.id,
      expected: example.label,
      predicted,
      confidence,
      correct,
    });
    // These aggregate metrics are binary safety metrics (SAFE vs any risk), not
    // exact multiclass accuracy. A risky sample predicted as a different risky
    // category is still a caught attack and must count as TP here; the exact
    // category error remains visible in perRisk and the review queue.
    if (isPositive(example.label) && isPositive(predicted)) tp += 1;
    if (isPositive(example.label) && !isPositive(predicted)) fn += 1;
    if (!isPositive(example.label) && isPositive(predicted)) fp += 1;
    if (!isPositive(example.label) && !isPositive(predicted)) tn += 1;
    if (!correct && (options.seedReviewQueue ?? true)) {
      reviewItems.push({
        exampleId: example.id,
        expected: example.label,
        predicted,
        confidence,
        text: example.redactedText,
      });
    }
  }

  const precision = tp / Math.max(1, tp + fp);
  const recall = tp / Math.max(1, tp + fn);
  const f1 = (2 * precision * recall) / Math.max(Number.EPSILON, precision + recall);
  const falsePositiveRate = fp / Math.max(1, fp + tn);
  const falseNegativeRate = fn / Math.max(1, fn + tp);
  const calibrationError = expectedCalibrationError(predictions);

  for (const label of ALL_ML_LABELS) {
    const labelPredictions = predictions.filter((item) => item.predicted === label);
    const labelTruth = predictions.filter((item) => item.expected === label);
    const labelTp = predictions.filter((item) => item.expected === label && item.predicted === label).length;
    const labelFp = labelPredictions.length - labelTp;
    const labelFn = labelTruth.length - labelTp;
    const labelPrecision = labelTp / Math.max(1, labelTp + labelFp);
    const labelRecall = labelTp / Math.max(1, labelTp + labelFn);
    perRisk[label] = {
      total: labelTruth.length,
      correct: labelTp,
      recall: labelRecall,
      precision: labelPrecision,
      f1: (2 * labelPrecision * labelRecall) / Math.max(Number.EPSILON, labelPrecision + labelRecall),
      falsePositives: labelFp,
      falseNegatives: labelFn,
    };
  }

  const metrics: EvaluationMetrics = {
    precision,
    recall,
    f1,
    falsePositiveRate,
    falseNegativeRate,
    calibrationError,
    totalExamples: examples.length,
    perRisk,
  };

  const evaluation = await db.mLModelEvaluation.create({
    data: {
      organizationId: modelVersion.organizationId,
      modelVersionId: modelVersion.id,
      datasetId: dataset.id,
      precision,
      recall,
      f1,
      falsePositiveRate,
      falseNegativeRate,
      calibrationError,
      perRisk: perRisk as object,
      totalExamples: examples.length,
      durationMs: Date.now() - start,
    },
  });

  if (reviewItems.length && (options.seedReviewQueue ?? true)) {
    const cap = options.reviewLimit ?? 50;
    const slice = reviewItems.slice(0, cap);
    await db.mLReviewQueue.createMany({
      data: slice.map((item) => ({
        organizationId: modelVersion.organizationId,
        modelVersionId: modelVersion.id,
        kind: item.expected !== "SAFE" ? "FALSE_NEGATIVE" : "FALSE_POSITIVE",
        expectedLabel: item.expected,
        predictedLabel: item.predicted,
        redactedText: item.text,
        confidence: item.confidence,
      })),
    });
  }

  return { evaluation, metrics, predictions };
}

export async function compareEvaluations(currentId: string, previousId: string) {
  const [current, previous] = await Promise.all([
    db.mLModelEvaluation.findUnique({ where: { id: currentId } }),
    db.mLModelEvaluation.findUnique({ where: { id: previousId } }),
  ]);
  if (!current || !previous) return null;
  return {
    f1Delta: current.f1 - previous.f1,
    recallDelta: current.recall - previous.recall,
    precisionDelta: current.precision - previous.precision,
    fpRateDelta: current.falsePositiveRate - previous.falsePositiveRate,
    regressed: current.f1 < previous.f1 - 0.02 || current.recall < previous.recall - 0.03,
  };
}
