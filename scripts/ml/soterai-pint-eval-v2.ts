import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { analyzeText } from "../../lib/guard/analyze";

type PintCase = { id: string; text: string; category: string; label: boolean };
type ScoredCase = PintCase & {
  predicted: boolean;
  correct: boolean;
  action: string;
  riskScore: number;
  riskTypes: string[];
  latencyMs: number;
};

const VERSION = "soterai-pint-eval/v2";
const TAXONOMY = "SOTERAI-ML-TAXONOMY-v1";
const FORMULA = "mean over non-empty (category, boolean-label) buckets of correct_b / total_b";
const PINT_CATEGORIES = new Set(["prompt_injection", "jailbreak", "hard_negatives", "chat", "documents"]);
const POSITIVE_TYPES = new Set([
  "PROMPT_INJECTION",
  "JAILBREAK",
  "SYSTEM_PROMPT_LEAK_ATTEMPT",
  "RECURSIVE_INJECTION",
  "RAG_POISONING",
]);

function arg(name: string, fallback?: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index < 0 ? fallback : (process.argv[index + 1] ?? fallback);
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function unquote(value: string): string {
  const text = value.trim();
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
    return text.slice(1, -1).replace(/\\"/g, '"').replace(/\\n/g, "\n");
  }
  return text;
}

function parseYaml(input: string): Array<Omit<PintCase, "id">> {
  const output: Array<Omit<PintCase, "id">> = [];
  let current: Partial<Omit<PintCase, "id">> = {};
  const flush = () => {
    if (typeof current.text === "string" && typeof current.category === "string" && typeof current.label === "boolean") {
      output.push({ text: current.text, category: current.category, label: current.label });
    }
    current = {};
  };
  for (const raw of input.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    if (line.startsWith("- ")) {
      flush();
      const rest = line.slice(2).trim();
      if (rest.startsWith("text:")) current.text = unquote(rest.slice(5));
      continue;
    }
    const separator = line.indexOf(":");
    if (separator < 0) continue;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (key === "text") current.text = unquote(value);
    if (key === "category") current.category = unquote(value);
    if (key === "label") current.label = /^(true|1|yes)$/i.test(value);
  }
  flush();
  return output;
}

function normalizeJson(record: Record<string, unknown>): Omit<PintCase, "id"> | null {
  const text = record.text ?? record.prompt ?? record.attack_prompt ?? record.behavior;
  const category = record.category ?? record.family ?? "prompt_injection";
  const value = record.label ?? record.isAttack ?? record.is_attack ?? record.record_type;
  if (typeof text !== "string") return null;
  const label = typeof value === "boolean"
    ? value
    : typeof value === "string"
      ? !["false", "safe", "benign", "0", "none"].includes(value.toLowerCase())
      : Boolean(value);
  return { text, category: String(category), label };
}

function load(path: string): { raw: Buffer; cases: PintCase[] } {
  const raw = readFileSync(path);
  const input = raw.toString("utf8");
  let records: Array<Omit<PintCase, "id">>;
  if (path.endsWith(".json")) {
    const parsed = JSON.parse(input) as unknown;
    if (!Array.isArray(parsed)) throw new Error("JSON input must be an array");
    records = parsed.map((item) => normalizeJson(item as Record<string, unknown>)).filter((item): item is Omit<PintCase, "id"> => item !== null);
  } else if (path.endsWith(".jsonl")) {
    records = input.split(/\r?\n/).filter(Boolean).map((line) => normalizeJson(JSON.parse(line) as Record<string, unknown>)).filter((item): item is Omit<PintCase, "id"> => item !== null);
  } else {
    records = parseYaml(input);
  }
  return {
    raw,
    cases: records.map((item, index) => ({ ...item, id: sha256(`${index}\u001f${item.category}\u001f${item.label}\u001f${item.text}`) })),
  };
}

function score(cases: Array<Pick<ScoredCase, "category" | "label" | "correct">>): number {
  const buckets = new Map<string, { correct: number; total: number }>();
  for (const item of cases) {
    const key = `${item.category}\t${item.label}`;
    const bucket = buckets.get(key) ?? { correct: 0, total: 0 };
    bucket.total += 1;
    if (item.correct) bucket.correct += 1;
    buckets.set(key, bucket);
  }
  const values = [...buckets.values()].map((item) => item.correct / item.total);
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}

function randomGenerator(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((left, right) => left - right);
  if (!sorted.length) return 0;
  const position = (sorted.length - 1) * p;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  return lower === upper ? sorted[lower] : sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

function bootstrap(scored: ScoredCase[], iterations: number, seed: number) {
  const buckets = new Map<string, ScoredCase[]>();
  for (const item of scored) {
    const key = `${item.category}\t${item.label}`;
    buckets.set(key, [...(buckets.get(key) ?? []), item]);
  }
  const random = randomGenerator(seed);
  const values: number[] = [];
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const sample: ScoredCase[] = [];
    for (const bucket of buckets.values()) {
      for (let index = 0; index < bucket.length; index += 1) sample.push(bucket[Math.floor(random() * bucket.length)]);
    }
    values.push(score(sample));
  }
  return {
    method: "stratified (category,label) percentile bootstrap",
    confidenceLevel: 0.95,
    iterations,
    seed,
    lower: percentile(values, 0.025),
    upper: percentile(values, 0.975),
  };
}

function evaluate(cases: PintCase[], iterations: number, seed: number) {
  const scored: ScoredCase[] = cases.map((item) => {
    const start = performance.now();
    const result = analyzeText(item.text, "INPUT");
    const latencyMs = performance.now() - start;
    const predicted = result.riskTypes.some((riskType) => POSITIVE_TYPES.has(riskType));
    return { ...item, predicted, correct: predicted === item.label, action: result.action, riskScore: result.riskScore, riskTypes: result.riskTypes, latencyMs };
  });
  const categories = [...new Set(scored.map((item) => item.category))].sort();
  const pintSchemaCompatible = categories.every((category) => PINT_CATEGORIES.has(category));
  const tp = scored.filter((item) => item.label && item.predicted).length;
  const tn = scored.filter((item) => !item.label && !item.predicted).length;
  const fp = scored.filter((item) => !item.label && item.predicted).length;
  const fn = scored.filter((item) => item.label && !item.predicted).length;
  const bucketKeys = [...new Set(scored.map((item) => `${item.category}\t${item.label}`))].sort();
  const bucketMetrics = bucketKeys.map((key) => {
    const [category, label] = key.split("\t");
    const bucket = scored.filter((item) => item.category === category && String(item.label) === label);
    return { category, label: label === "true", total: bucket.length, correct: bucket.filter((item) => item.correct).length, accuracy: bucket.filter((item) => item.correct).length / bucket.length };
  });
  const latencies = scored.map((item) => item.latencyMs);
  const slice = (category: string, label: boolean) => scored.filter((item) => item.category === category && item.label === label);
  const documents = slice("documents", true);
  const hardNegatives = slice("hard_negatives", false);
  return {
    evaluatorVersion: VERSION,
    taxonomyVersion: TAXONOMY,
    model: "soterai_guard_analyzeText",
    task: pintSchemaCompatible ? "prompt_manipulation" : "unknown_or_mixed_task",
    comparability: pintSchemaCompatible ? "SCHEMA_COMPATIBLE_PROVENANCE_STILL_REQUIRES_VERIFICATION" : "NOT_DIRECTLY_COMPARABLE_TO_PINT",
    balancedScoreDefinition: FORMULA,
    total: scored.length,
    categories,
    balancedScore: score(scored),
    balancedScore95Ci: bootstrap(scored, iterations, seed),
    confusionMatrix: { truePositive: tp, trueNegative: tn, falsePositive: fp, falseNegative: fn },
    promptManipulationRecall: tp / Math.max(1, tp + fn),
    benignFalsePositiveRate: fp / Math.max(1, fp + tn),
    indirectDocumentRecall: documents.length ? documents.filter((item) => item.correct).length / documents.length : null,
    hardNegativeAccuracy: hardNegatives.length ? hardNegatives.filter((item) => item.correct).length / hardNegatives.length : null,
    bucketMetrics,
    latencyMs: { count: latencies.length, p50: percentile(latencies, 0.5), p95: percentile(latencies, 0.95), p99: percentile(latencies, 0.99), max: Math.max(0, ...latencies) },
    predictions: scored.map(({ text: _text, ...item }) => item),
    misses: scored.filter((item) => !item.correct).map(({ text, ...item }) => ({ ...item, textSha256: sha256(text) })),
  };
}

function main() {
  const input = arg("--input");
  const output = arg("--out");
  const iterations = Number(arg("--bootstrap-iterations", "2000"));
  const seed = Number(arg("--bootstrap-seed", "42"));
  if (!input) throw new Error("Usage: npx tsx scripts/ml/soterai-pint-eval-v2.ts --input benchmark.yaml [--out results.json]");
  if (!Number.isSafeInteger(iterations) || iterations < 1) throw new Error("bootstrap iterations must be a positive integer");
  const loaded = load(input);
  const sourcePath = "scripts/ml/soterai-pint-eval-v2.ts";
  const configuration = { version: VERSION, taxonomy: TAXONOMY, positiveTypes: [...POSITIVE_TYPES].sort(), formula: FORMULA, iterations, seed };
  const report = {
    ...evaluate(loaded.cases, iterations, seed),
    input: input.replace(/\\/g, "/"),
    benchmarkSha256: sha256(loaded.raw),
    evaluatorSourceSha256: sha256(readFileSync(sourcePath)),
    configurationSha256: sha256(JSON.stringify(configuration)),
  };
  const json = JSON.stringify(report, null, 2);
  if (output) writeFileSync(output, `${json}\n`, "utf8");
  console.log(json);
}

main();