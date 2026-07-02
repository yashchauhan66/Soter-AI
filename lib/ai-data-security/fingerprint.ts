import { createHash } from "crypto";
import { createPrivacySafePreview } from "../../packages/shared/src/privacy";

export type FingerprintAction = "warn" | "redact" | "rewrite" | "block" | "require_justification" | "require_approval";
export type FingerprintSensitivity = "low" | "medium" | "high" | "critical";
export type FingerprintMatchType = "exact" | "fuzzy" | "semantic";

export interface FingerprintRecord {
  fingerprintSetId: string;
  documentName: string;
  category: string;
  sensitivity: FingerprintSensitivity;
  action: FingerprintAction;
  chunkHashes: string[];
  shingleHashes: string[];
}

export interface FingerprintMatchResult {
  matchedFingerprintSetId: string;
  matchedDocumentName: string;
  category: string;
  similarityScore: number;
  confidence: FingerprintSensitivity;
  sensitivity: FingerprintSensitivity;
  recommendedAction: FingerprintAction;
  matchType: FingerprintMatchType;
  evidence: {
    exactChunkMatches: number;
    fuzzyShingleMatches: number;
    rawTextStored: false;
  };
}

export function normalizeFingerprintText(text: string) {
  return text
    .normalize("NFKC")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .toLowerCase();
}

export function sha256Hex(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function chunkText(text: string, chunkSize = 900) {
  const normalized = normalizeFingerprintText(text);
  if (!normalized) return [];
  const chunks: string[] = [];
  for (let index = 0; index < normalized.length; index += chunkSize) {
    const chunk = normalized.slice(index, index + chunkSize).trim();
    if (chunk.length >= 24) chunks.push(chunk);
  }
  return chunks.length ? chunks : [normalized];
}

export function shingleText(text: string, nGram = 5) {
  const words = normalizeFingerprintText(text).replace(/[^\p{L}\p{N}]+/gu, " ").split(/\s+/).filter(Boolean);
  if (words.length < nGram) return words.length ? [words.join(" ")] : [];
  const shingles: string[] = [];
  for (let index = 0; index <= words.length - nGram; index += 1) {
    shingles.push(words.slice(index, index + nGram).join(" "));
  }
  return shingles;
}

export function createPrivacySafeFingerprint(text: string) {
  const chunks = chunkText(text);
  const shingles = shingleText(text);
  return {
    chunkHashes: chunks.map(sha256Hex),
    shingleHashes: Array.from(new Set(shingles.map(sha256Hex))),
    rawTextStored: false as const,
    algorithms: {
      exact: "sha256:normalized-text-chunk:v1",
      fuzzy: "sha256:word-shingle-5:v1",
      semantic: "planned:not-enabled",
    },
  };
}

export function matchFingerprintText(text: string, records: FingerprintRecord[], minimumSimilarity = 0.18) {
  const candidate = createPrivacySafeFingerprint(text);
  const candidateChunks = new Set(candidate.chunkHashes);
  const candidateShingles = new Set(candidate.shingleHashes);
  const matches: FingerprintMatchResult[] = [];

  for (const record of records) {
    const exactChunkMatches = record.chunkHashes.filter((hash) => candidateChunks.has(hash)).length;
    const fuzzyShingleMatches = record.shingleHashes.filter((hash) => candidateShingles.has(hash)).length;
    const exactRatio = record.chunkHashes.length ? exactChunkMatches / record.chunkHashes.length : 0;
    const fuzzyRatio = record.shingleHashes.length ? fuzzyShingleMatches / record.shingleHashes.length : 0;
    const similarityScore = Math.max(exactRatio, fuzzyRatio);
    if (exactChunkMatches === 0 && (fuzzyShingleMatches === 0 || similarityScore < minimumSimilarity)) continue;

    const confidence = confidenceForSimilarity(exactChunkMatches, similarityScore);
    matches.push({
      matchedFingerprintSetId: record.fingerprintSetId,
      matchedDocumentName: record.documentName,
      category: record.category,
      similarityScore: Number(similarityScore.toFixed(4)),
      confidence,
      sensitivity: record.sensitivity,
      recommendedAction: record.action,
      matchType: exactChunkMatches > 0 ? "exact" : "fuzzy",
      evidence: { exactChunkMatches, fuzzyShingleMatches, rawTextStored: false },
    });
  }

  return matches.sort((left, right) => right.similarityScore - left.similarityScore);
}

function confidenceForSimilarity(exactChunkMatches: number, similarityScore: number): FingerprintSensitivity {
  if (exactChunkMatches > 0 || similarityScore >= 0.72) return "critical";
  if (similarityScore >= 0.48) return "high";
  if (similarityScore >= 0.24) return "medium";
  return "low";
}

export function redactedPreview(text: string, maxLength = 500) {
  return createPrivacySafePreview({ rawText: text, contextType: "fingerprint", logMode: "redacted_prompt", maxLength });
}
