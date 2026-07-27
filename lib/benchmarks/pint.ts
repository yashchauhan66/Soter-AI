import { readFileSync } from "node:fs";
import { analyzeText } from "../guard/analyze";
import type { RiskType } from "../guard/types";
import type { BenchmarkCase, BenchmarkPrediction } from "./index";

export interface PintScore {
  total: number;
  positives: number;
  negatives: number;
  truePositive: number;
  trueNegative: number;
  falsePositive: number;
  falseNegative: number;
  positiveAccuracy: number;
  negativeAccuracy: number;
  balancedAccuracy: number;
  rawAccuracy: number;
  precision: number;
  recall: number;
  falsePositiveRate: number;
  perCategory: PintCategoryScore[];
}

export interface PintCategoryScore {
  category: string;
  total: number;
  positives: number;
  negatives: number;
  accuracy: number;
  positiveAccuracy: number;
  negativeAccuracy: number;
}

export interface PintRow {
  text: string;
  category: string;
  label: boolean;
}

export interface PintResult {
  id: string;
  category: string;
  expectedLabel: "ATTACK" | "SAFE";
  predictedLabel: "ATTACK" | "SAFE";
  correct: boolean;
  confidence: number;
}

const PINT_PROMPT_ATTACK_TYPES = new Set<RiskType>([
  "PROMPT_INJECTION",
  "JAILBREAK",
  "SYSTEM_PROMPT_LEAK_ATTEMPT",
  "RECURSIVE_INJECTION",
  "MCP_TOOL_POISONING",
  "MEMORY_POISONING",
  "DATA_EXFILTRATION",
]);

export function loadPintYamlFile(filePath: string): BenchmarkCase[] {
  return parsePintYaml(readFileSync(filePath, "utf8"));
}

export function parsePintYaml(contents: string): BenchmarkCase[] {
  const rows = parseYamlRows(contents);
  return rows
    .filter((row) => row.text.trim().length > 0)
    .map((row, index) => ({
      id: `pint-${index + 1}`,
      category: row.category || "unknown",
      language: "unknown",
      text: row.text,
      expectedLabel: row.label ? "ATTACK" : "SAFE",
    }));
}

export function classifyPintWithGuard(text: string): BenchmarkPrediction {
  const guard = analyzeText(text, "INPUT");
  const detected = guard.riskTypes.some((type) => PINT_PROMPT_ATTACK_TYPES.has(type));
  return {
    label: detected ? "ATTACK" : "SAFE",
    confidence: detected ? Math.max(0.5, guard.riskScore / 100) : Math.max(0.5, 1 - guard.riskScore / 100),
  };
}

export async function runPintBenchmark(
  cases: BenchmarkCase[],
  classify: (text: string) => BenchmarkPrediction | Promise<BenchmarkPrediction> = classifyPintWithGuard,
): Promise<{ results: PintResult[]; score: PintScore }> {
  const results: PintResult[] = [];
  for (const item of cases) {
    const prediction = await classify(item.text);
    const expectedLabel = item.expectedLabel === "SAFE" ? "SAFE" : "ATTACK";
    const predictedLabel = prediction.label === "SAFE" ? "SAFE" : "ATTACK";
    results.push({
      id: item.id,
      category: item.category,
      expectedLabel,
      predictedLabel,
      correct: expectedLabel === predictedLabel,
      confidence: prediction.confidence,
    });
  }
  return { results, score: scorePintResults(results) };
}

export function scorePintResults(results: PintResult[]): PintScore {
  const positives = results.filter((result) => result.expectedLabel === "ATTACK");
  const negatives = results.filter((result) => result.expectedLabel === "SAFE");
  const truePositive = positives.filter((result) => result.predictedLabel === "ATTACK").length;
  const trueNegative = negatives.filter((result) => result.predictedLabel === "SAFE").length;
  const falsePositive = negatives.length - trueNegative;
  const falseNegative = positives.length - truePositive;
  const positiveAccuracy = rate(truePositive, positives.length);
  const negativeAccuracy = rate(trueNegative, negatives.length);
  const balancedAccuracy = (positiveAccuracy + negativeAccuracy) / 2;
  const rawAccuracy = rate(results.filter((result) => result.correct).length, results.length);
  const precision = rate(truePositive, truePositive + falsePositive);

  const categories = Array.from(new Set(results.map((result) => result.category))).sort();
  const perCategory = categories.map((category) => {
    const subset = results.filter((result) => result.category === category);
    const subsetPositives = subset.filter((result) => result.expectedLabel === "ATTACK");
    const subsetNegatives = subset.filter((result) => result.expectedLabel === "SAFE");
    return {
      category,
      total: subset.length,
      positives: subsetPositives.length,
      negatives: subsetNegatives.length,
      accuracy: rate(subset.filter((result) => result.correct).length, subset.length),
      positiveAccuracy: rate(
        subsetPositives.filter((result) => result.predictedLabel === "ATTACK").length,
        subsetPositives.length,
      ),
      negativeAccuracy: rate(
        subsetNegatives.filter((result) => result.predictedLabel === "SAFE").length,
        subsetNegatives.length,
      ),
    };
  });

  return {
    total: results.length,
    positives: positives.length,
    negatives: negatives.length,
    truePositive,
    trueNegative,
    falsePositive,
    falseNegative,
    positiveAccuracy,
    negativeAccuracy,
    balancedAccuracy,
    rawAccuracy,
    precision,
    recall: positiveAccuracy,
    falsePositiveRate: rate(falsePositive, negatives.length),
    perCategory,
  };
}

function parseYamlRows(contents: string): PintRow[] {
  const rows: Array<Partial<PintRow>> = [];
  let current: Partial<PintRow> | undefined;
  const lines = contents.replace(/\r\n/g, "\n").split("\n");

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index];
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const listMatch = rawLine.match(/^\s*-\s+([A-Za-z_][\w-]*)\s*:\s*(.*)$/);
    if (listMatch) {
      current = {};
      rows.push(current);
      index = assignYamlField(lines, index, listMatch[1], listMatch[2], current);
      continue;
    }

    const fieldMatch = rawLine.match(/^\s+([A-Za-z_][\w-]*)\s*:\s*(.*)$/);
    if (fieldMatch && current) {
      index = assignYamlField(lines, index, fieldMatch[1], fieldMatch[2], current);
    }
  }

  return rows
    .map((row) => ({
      text: String(row.text ?? ""),
      category: String(row.category ?? "unknown"),
      label: Boolean(row.label),
    }))
    .filter((row) => row.text.length > 0);
}

function assignYamlField(
  lines: string[],
  index: number,
  key: string,
  rawValue: string,
  target: Partial<PintRow>,
): number {
  if (!(key === "text" || key === "category" || key === "label")) return index;
  if (rawValue.trim() === "|" || rawValue.trim() === ">") {
    const baseIndent = leadingSpaces(lines[index]);
    const block: string[] = [];
    let next = index + 1;
    for (; next < lines.length; next += 1) {
      const line = lines[next];
      const indent = leadingSpaces(line);
      const startsNextListItem = /^\s*-\s+[A-Za-z_][\w-]*\s*:/.test(line);
      const startsSiblingField = /^\s+[A-Za-z_][\w-]*\s*:/.test(line) && indent <= baseIndent + 2;
      if (line.trim() && (startsNextListItem || startsSiblingField || indent <= baseIndent)) break;
      block.push(line.replace(/^\s{2,}/, ""));
    }
    const text = rawValue.trim() === ">" ? block.join(" ").replace(/\s+/g, " ").trim() : block.join("\n").trim();
    target[key] = coerceYamlValue(key, text) as never;
    return next - 1;
  }
  target[key] = coerceYamlValue(key, rawValue) as never;
  return index;
}

function coerceYamlValue(key: string, raw: string): string | boolean {
  const unquoted = unquoteYamlScalar(raw.trim());
  if (key === "label") return /^(true|1|yes)$/i.test(unquoted);
  return unquoted;
}

function unquoteYamlScalar(value: string): string {
  const hashComment = value.match(/^([^"'].*?)\s+#/);
  const withoutComment = hashComment ? hashComment[1].trim() : value;
  if (withoutComment.startsWith('"') && withoutComment.endsWith('"')) {
    try {
      return JSON.parse(withoutComment) as string;
    } catch {
      return withoutComment.slice(1, -1);
    }
  }
  if (withoutComment.startsWith("'") && withoutComment.endsWith("'")) {
    return withoutComment.slice(1, -1).replace(/''/g, "'");
  }
  return withoutComment;
}

function leadingSpaces(line: string): number {
  return line.length - line.trimStart().length;
}

function rate(numerator: number, denominator: number): number {
  return denominator === 0 ? 1 : numerator / denominator;
}
