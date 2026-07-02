import type { PolicyAction, PolicySeverity } from "../../../../packages/policy-engine/src/types";

export interface FingerprintRecord {
  fingerprintSetId: string;
  documentName: string;
  category: string;
  sensitivity: PolicySeverity;
  action: PolicyAction;
  chunkHashes: string[];
  shingleHashes: string[];
}

export interface LocalFingerprintMatch {
  matchedFingerprintSetId: string;
  matchedDocumentName: string;
  category: string;
  similarityScore: number;
  sensitivity: PolicySeverity;
  recommendedAction: PolicyAction;
  matchType: "exact" | "fuzzy";
  confidence: PolicySeverity;
  matchedChunkCount: number;
  totalComparedChunks: number;
  evidence: string;
}

export async function matchLocalFingerprints(text: string, records: FingerprintRecord[], minimumSimilarity = 0.18) {
  const candidate = await createBrowserFingerprint(text);
  const chunks = new Set(candidate.chunkHashes);
  const shingles = new Set(candidate.shingleHashes);
  const matches: LocalFingerprintMatch[] = [];

  for (const record of records) {
    const exactChunkMatches = record.chunkHashes.filter((hash) => chunks.has(hash)).length;
    const fuzzyShingleMatches = record.shingleHashes.filter((hash) => shingles.has(hash)).length;
    const exactRatio = record.chunkHashes.length ? exactChunkMatches / record.chunkHashes.length : 0;
    const fuzzyRatio = record.shingleHashes.length ? fuzzyShingleMatches / record.shingleHashes.length : 0;
    const similarityScore = Math.max(exactRatio, fuzzyRatio);
    if (exactChunkMatches === 0 && (fuzzyShingleMatches === 0 || similarityScore < minimumSimilarity)) continue;
    matches.push({
      matchedFingerprintSetId: record.fingerprintSetId,
      matchedDocumentName: record.documentName,
      category: record.category,
      similarityScore: Number(similarityScore.toFixed(4)),
      sensitivity: record.sensitivity,
      recommendedAction: record.action,
      matchType: exactChunkMatches > 0 ? "exact" : "fuzzy",
      confidence: confidenceForMatch(exactChunkMatches, similarityScore),
      matchedChunkCount: exactChunkMatches + fuzzyShingleMatches,
      totalComparedChunks: record.chunkHashes.length + record.shingleHashes.length,
      evidence: exactChunkMatches > 0
        ? "Exact fingerprint match detected against confidential dataset"
        : `Fuzzy fingerprint match detected (similarity: ${Number(similarityScore.toFixed(4))})`,
    });
  }
  return matches.sort((left, right) => right.similarityScore - left.similarityScore);
}

function confidenceForMatch(exactChunkMatches: number, similarityScore: number): PolicySeverity {
  if (exactChunkMatches > 0 || similarityScore >= 0.72) return "critical";
  if (similarityScore >= 0.48) return "high";
  if (similarityScore >= 0.24) return "medium";
  return "low";
}

async function createBrowserFingerprint(text: string) {
  const chunks = chunkText(text);
  const shingles = shingleText(text);
  return {
    chunkHashes: await Promise.all(chunks.map(sha256Browser)),
    shingleHashes: Array.from(new Set(await Promise.all(shingles.map(sha256Browser)))),
  };
}

function normalizeText(text: string) {
  return text.normalize("NFKC").replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().toLowerCase();
}

function chunkText(text: string, chunkSize = 900) {
  const normalized = normalizeText(text);
  if (!normalized) return [];
  const chunks: string[] = [];
  for (let index = 0; index < normalized.length; index += chunkSize) {
    const chunk = normalized.slice(index, index + chunkSize).trim();
    if (chunk.length >= 24) chunks.push(chunk);
  }
  return chunks.length ? chunks : [normalized];
}

function shingleText(text: string, nGram = 5) {
  const words = normalizeText(text).replace(/[^\p{L}\p{N}]+/gu, " ").split(/\s+/).filter(Boolean);
  if (words.length < nGram) return words.length ? [words.join(" ")] : [];
  const shingles: string[] = [];
  for (let index = 0; index <= words.length - nGram; index += 1) shingles.push(words.slice(index, index + nGram).join(" "));
  return shingles;
}

async function sha256Browser(value: string) {
  const data = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
