// Phase 6: dataset import / merge utilities.
// Inputs may arrive as JSON arrays, JSONL streams, or simple CSV. All examples
// are redacted before persistence so we never store raw PII or secrets.

import { db } from "../db";
import type { MLDataset, MLDatasetExample, MLLabel } from "@prisma/client";
import { normalizeExample, type MLDatasetExampleInput } from "./types";

const ALLOWED_LABELS: MLLabel[] = [
  "SAFE",
  "PROMPT_INJECTION",
  "JAILBREAK",
  "SYSTEM_PROMPT_LEAK_ATTEMPT",
  "PII",
  "SECRET",
  "UNSAFE_OUTPUT",
  "RAG_POISONING",
  "DATA_EXFILTRATION_ATTEMPT",
];

export class DatasetParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DatasetParseError";
  }
}

function asLabel(value: unknown): MLLabel {
  if (typeof value !== "string") throw new DatasetParseError("Label must be a string.");
  const upper = value.toUpperCase();
  if (!ALLOWED_LABELS.includes(upper as MLLabel)) {
    throw new DatasetParseError(`Unsupported label: ${value}. Allowed: ${ALLOWED_LABELS.join(", ")}.`);
  }
  return upper as MLLabel;
}

export function parseJsonDataset(input: string): MLDatasetExampleInput[] {
  const trimmed = input.trim();
  if (!trimmed) return [];
  // JSONL: one object per line.
  if (trimmed.startsWith("{") && trimmed.includes("\n")) {
    return trimmed
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        try {
          const obj = JSON.parse(line);
          return mapObjectToExample(obj);
        } catch (error) {
          throw new DatasetParseError(`Invalid JSONL line: ${(error as Error).message}`);
        }
      });
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch (error) {
    throw new DatasetParseError(`Invalid JSON: ${(error as Error).message}`);
  }
  if (!Array.isArray(parsed)) throw new DatasetParseError("Top-level JSON must be an array.");
  return parsed.map(mapObjectToExample);
}

export function parseCsvDataset(input: string): MLDatasetExampleInput[] {
  const lines = input.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) return [];
  const header = parseCsvLine(lines[0]).map((column) => column.toLowerCase());
  const textIdx = header.indexOf("text");
  const labelIdx = header.indexOf("label");
  if (textIdx === -1 || labelIdx === -1) {
    throw new DatasetParseError("CSV header must contain text and label columns.");
  }
  const langIdx = header.indexOf("language");
  const sourceIdx = header.indexOf("source");
  const examples: MLDatasetExampleInput[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cols = parseCsvLine(lines[i]);
    if (!cols[textIdx]) continue;
    examples.push({
      text: cols[textIdx],
      label: asLabel(cols[labelIdx]),
      language: langIdx >= 0 ? (cols[langIdx] || "en") : "en",
      source: sourceIdx >= 0 ? cols[sourceIdx] : undefined,
    });
  }
  return examples;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === "\"" && line[i + 1] === "\"") { current += "\""; i += 1; }
      else if (ch === "\"") { inQuotes = false; }
      else { current += ch; }
    } else {
      if (ch === ",") { result.push(current); current = ""; }
      else if (ch === "\"") { inQuotes = true; }
      else { current += ch; }
    }
  }
  result.push(current);
  return result;
}

function mapObjectToExample(value: unknown): MLDatasetExampleInput {
  if (!value || typeof value !== "object") throw new DatasetParseError("Each example must be an object.");
  const obj = value as Record<string, unknown>;
  const text = typeof obj.text === "string" ? obj.text : null;
  if (!text) throw new DatasetParseError("Each example needs a `text` field.");
  return {
    text,
    label: asLabel(obj.label),
    language: typeof obj.language === "string" ? obj.language : "en",
    source: typeof obj.source === "string" ? obj.source : undefined,
    metadata: typeof obj.metadata === "object" && obj.metadata !== null ? (obj.metadata as Record<string, unknown>) : undefined,
  };
}

export interface CreateDatasetInput {
  organizationId: string;
  name: string;
  description?: string;
  examples: MLDatasetExampleInput[];
}

export async function createDatasetWithExamples(input: CreateDatasetInput): Promise<MLDataset & { exampleCount: number }> {
  // Each call creates a new version so dataset history is preserved.
  const previous = await db.mLDataset.findFirst({
    where: { organizationId: input.organizationId, name: input.name },
    orderBy: { version: "desc" },
  });
  const version = (previous?.version ?? 0) + 1;
  if (previous) {
    await db.mLDataset.update({ where: { id: previous.id }, data: { isActive: false } });
  }
  const dataset = await db.mLDataset.create({
    data: {
      organizationId: input.organizationId,
      name: input.name,
      description: input.description,
      version,
      isActive: true,
    },
  });
  if (input.examples.length > 0) {
    const normalized = input.examples.map(normalizeExample);
    await db.mLDatasetExample.createMany({
      data: normalized.map((example) => ({
        datasetId: dataset.id,
        redactedText: example.redactedText,
        label: example.label,
        language: example.language ?? "en",
        source: example.source ?? null,
        metadata: example.metadata ? (example.metadata as object) : undefined,
      })),
    });
  }
  return { ...dataset, exampleCount: input.examples.length };
}

export async function appendExamples(datasetId: string, examples: MLDatasetExampleInput[]): Promise<number> {
  if (!examples.length) return 0;
  const normalized = examples.map(normalizeExample);
  await db.mLDatasetExample.createMany({
    data: normalized.map((example) => ({
      datasetId,
      redactedText: example.redactedText,
      label: example.label,
      language: example.language ?? "en",
      source: example.source ?? null,
      metadata: example.metadata ? (example.metadata as object) : undefined,
    })),
  });
  return examples.length;
}

export async function listDatasets(organizationId: string) {
  return db.mLDataset.findMany({
    where: { organizationId },
    orderBy: [{ name: "asc" }, { version: "desc" }],
    include: { _count: { select: { examples: true } } },
  });
}

export async function loadDatasetExamples(datasetId: string, take = 5_000): Promise<MLDatasetExample[]> {
  return db.mLDatasetExample.findMany({ where: { datasetId }, take });
}
