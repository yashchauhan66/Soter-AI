import { readFileSync, writeFileSync } from "node:fs";
import { analyzeText } from "../../lib/guard/analyze";

type PintCase = {
  text: string;
  category: string;
  label: boolean;
};

type ScoredPintCase = PintCase & {
  predicted: boolean;
  correct: boolean;
  action: string;
  riskScore: number;
  riskTypes: string[];
};

const PROMPT_ATTACK_TYPES = new Set([
  "PROMPT_INJECTION",
  "JAILBREAK",
  "SYSTEM_PROMPT_LEAK_ATTEMPT",
  "RECURSIVE_INJECTION",
  "DATA_EXFILTRATION_ATTEMPT",
]);

function argValue(name: string, fallback?: string): string | undefined {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return fallback;
  return process.argv[idx + 1] ?? fallback;
}

function unquote(value: string): string {
  const trimmed = value.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1).replace(/\\"/g, '"').replace(/\\n/g, "\n");
  }
  return trimmed;
}

function parseYamlish(input: string): PintCase[] {
  const cases: PintCase[] = [];
  let current: Partial<PintCase> = {};

  function flush() {
    if (typeof current.text === "string" && typeof current.category === "string" && typeof current.label === "boolean") {
      cases.push({ text: current.text, category: current.category, label: current.label });
    }
    current = {};
  }

  for (const rawLine of input.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    if (line.startsWith("- ")) {
      flush();
      const rest = line.slice(2).trim();
      if (rest.startsWith("text:")) current.text = unquote(rest.slice("text:".length));
      continue;
    }
    const sep = line.indexOf(":");
    if (sep === -1) continue;
    const key = line.slice(0, sep).trim();
    const value = line.slice(sep + 1).trim();
    if (key === "text") current.text = unquote(value);
    if (key === "category") current.category = unquote(value);
    if (key === "label") current.label = /^(true|1|yes)$/i.test(value);
  }
  flush();
  return cases;
}

function normalizeJsonRecord(record: Record<string, unknown>): PintCase | null {
  const text = record.text ?? record.prompt ?? record.attack_prompt;
  const category = record.category ?? record.family ?? "prompt_injection";
  const label = record.label ?? record.isAttack ?? record.is_attack ?? record.record_type;
  if (typeof text !== "string") return null;
  const boolLabel =
    typeof label === "boolean"
      ? label
      : typeof label === "string"
        ? !["false", "safe", "benign", "0", "none"].includes(label.toLowerCase())
        : Boolean(label);
  return { text, category: String(category), label: boolLabel };
}

function loadCases(path: string): PintCase[] {
  const raw = readFileSync(path, "utf8");
  if (path.endsWith(".json")) {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) throw new Error("JSON input must be an array");
    return parsed.map((item) => normalizeJsonRecord(item as Record<string, unknown>)).filter((item): item is PintCase => item !== null);
  }
  if (path.endsWith(".jsonl")) {
    return raw
      .split(/\r?\n/)
      .filter((line) => line.trim())
      .map((line) => normalizeJsonRecord(JSON.parse(line) as Record<string, unknown>))
      .filter((item): item is PintCase => item !== null);
  }
  return parseYamlish(raw);
}

function predictPromptAttack(text: string): { predicted: boolean; action: string; riskScore: number; riskTypes: string[] } {
  const result = analyzeText(text, "INPUT");
  const predicted = result.riskTypes.some((riskType) => PROMPT_ATTACK_TYPES.has(riskType));
  return {
    predicted,
    action: result.action,
    riskScore: result.riskScore,
    riskTypes: result.riskTypes,
  };
}

function evaluate(cases: PintCase[]) {
  const scored: ScoredPintCase[] = cases.map((item) => {
    const prediction = predictPromptAttack(item.text);
    return {
      ...item,
      ...prediction,
      correct: prediction.predicted === item.label,
    };
  });

  const buckets = new Map<string, { correct: number; total: number }>();
  for (const item of scored) {
    const key = `${item.category}\t${item.label}`;
    const bucket = buckets.get(key) ?? { correct: 0, total: 0 };
    bucket.total += 1;
    if (item.correct) bucket.correct += 1;
    buckets.set(key, bucket);
  }

  const bucketMetrics = [...buckets.entries()].map(([key, value]) => {
    const [category, label] = key.split("\t");
    return {
      category,
      label: label === "true",
      accuracy: value.correct / Math.max(1, value.total),
      correct: value.correct,
      total: value.total,
    };
  });
  const balancedScore = bucketMetrics.reduce((sum, item) => sum + item.accuracy, 0) / Math.max(1, bucketMetrics.length);
  return {
    model: "soterai_guard_analyzeText",
    total: scored.length,
    balancedScore,
    bucketMetrics,
    misses: scored.filter((item) => !item.correct).map((item) => ({
      text: item.text,
      category: item.category,
      label: item.label,
      predicted: item.predicted,
      action: item.action,
      riskScore: item.riskScore,
      riskTypes: item.riskTypes,
    })),
  };
}

function main() {
  const input = argValue("--input");
  const out = argValue("--out");
  if (!input) {
    console.error("Usage: npx tsx scripts/ml/soterai-pint-eval.ts --input benchmark/data/example-dataset.yaml [--out results.json]");
    process.exit(1);
  }
  const report = evaluate(loadCases(input));
  const json = JSON.stringify(report, null, 2);
  if (out) writeFileSync(out, `${json}\n`, "utf8");
  console.log(json);
}

main();
