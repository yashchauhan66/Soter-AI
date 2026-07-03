import {
  SEMANTIC_BENIGN_SEEDS,
  SEMANTIC_SEEDS,
  type SemanticFamily,
} from "./semanticSeeds";

/**
 * Lightweight, dependency-free semantic classifier for novel / unseen attacks.
 *
 * The regex detectors are precise but brittle: they only catch phrasings someone
 * anticipated. This layer adds a cheap embedding-based similarity check so a
 * prompt that *means* "ignore your instructions and jailbreak" is flagged even
 * when its exact wording has never been added to a rule.
 *
 * How it works (no model, no network, fully deterministic):
 *   1. Each text is embedded via feature hashing over word unigrams/bigrams and
 *      character n-grams into a fixed-dimension L2-normalized vector.
 *   2. At module load, seed phrases for each attack family and a benign control
 *      set are embedded and averaged into centroids.
 *   3. Classification is the cosine similarity of the input to the nearest attack
 *      centroid minus its similarity to the benign centroid (the "margin").
 *
 * It is intentionally used as a *recall booster that routes to human review*,
 * never as a standalone hard block — see analyzeText. Cosine of two unit vectors
 * is a dot product, so scoring is O(dim) and sub-millisecond.
 */

const DIM = 512;

// Decision thresholds. Tuned against the seed corpus + held-out novel attacks so
// paraphrased attacks clear the bar while security-adjacent benign prose does
// not. Because a hit only routes to HUMAN_REVIEW (and only when the rules found
// nothing), these are set for recall with a bounded false-positive cost.
const MARGIN_THRESHOLD = 0.06;
const MIN_ATTACK_SIMILARITY = 0.58;

export interface SemanticAssessment {
  family: SemanticFamily | null;
  isAttack: boolean;
  score: number; // nearest attack-family cosine similarity, 0-1
  margin: number; // attack similarity minus benign similarity
  benignSimilarity: number;
}

// FNV-1a — fast, deterministic, well-distributed 32-bit string hash.
function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function addFeature(vector: Float64Array, feature: string): void {
  const index = fnv1a(feature) % DIM;
  // A second, independent hash decides the sign so collisions tend to cancel
  // rather than always reinforce.
  const sign = (fnv1a(`${feature}`) & 1) === 0 ? 1 : -1;
  vector[index] += sign;
}

/** Embed text into an L2-normalized feature-hashed vector. */
export function embed(text: string): Float64Array {
  const vector = new Float64Array(DIM);
  const normalized = text.toLowerCase().normalize("NFKC");

  const words = normalized.split(/[^a-z0-9]+/).filter(Boolean);
  for (const word of words) addFeature(vector, `w:${word}`);
  for (let i = 0; i + 1 < words.length; i += 1) {
    addFeature(vector, `b:${words[i]}_${words[i + 1]}`);
  }

  // Character n-grams over a space-collapsed form capture sub-word and
  // cross-word structure (helps with spacing / minor obfuscation).
  const collapsed = ` ${words.join(" ")} `;
  for (const n of [3, 4, 5]) {
    if (collapsed.length < n) continue;
    for (let i = 0; i + n <= collapsed.length; i += 1) {
      addFeature(vector, `c${n}:${collapsed.slice(i, i + n)}`);
    }
  }

  let magnitude = 0;
  for (let i = 0; i < DIM; i += 1) magnitude += vector[i] * vector[i];
  magnitude = Math.sqrt(magnitude);
  if (magnitude > 0) {
    for (let i = 0; i < DIM; i += 1) vector[i] /= magnitude;
  }
  return vector;
}

function centroid(texts: string[]): Float64Array {
  const sum = new Float64Array(DIM);
  for (const text of texts) {
    const vector = embed(text);
    for (let i = 0; i < DIM; i += 1) sum[i] += vector[i];
  }
  let magnitude = 0;
  for (let i = 0; i < DIM; i += 1) magnitude += sum[i] * sum[i];
  magnitude = Math.sqrt(magnitude);
  if (magnitude > 0) {
    for (let i = 0; i < DIM; i += 1) sum[i] /= magnitude;
  }
  return sum;
}

function dot(a: Float64Array, b: Float64Array): number {
  let total = 0;
  for (let i = 0; i < DIM; i += 1) total += a[i] * b[i];
  return total;
}

// Precomputed once at module load. Centroids are unit vectors, so cosine
// similarity to an (also unit) input vector is a single dot product.
const FAMILY_CENTROIDS: Array<{ family: SemanticFamily; vector: Float64Array }> = (
  Object.keys(SEMANTIC_SEEDS) as SemanticFamily[]
).map((family) => ({ family, vector: centroid(SEMANTIC_SEEDS[family]) }));

const BENIGN_CENTROID = centroid(SEMANTIC_BENIGN_SEEDS);

/**
 * Classifies a text as an attack family or benign based on centroid similarity.
 * Deterministic and storage-free; safe to call on the guard hot path.
 */
export function classifySemantic(text: string): SemanticAssessment {
  const clean = text.trim();
  if (clean.length < 8) {
    return { family: null, isAttack: false, score: 0, margin: 0, benignSimilarity: 0 };
  }

  const vector = embed(clean);
  const benignSimilarity = dot(vector, BENIGN_CENTROID);

  let bestFamily: SemanticFamily | null = null;
  let bestSimilarity = -1;
  for (const { family, vector: centroidVector } of FAMILY_CENTROIDS) {
    const similarity = dot(vector, centroidVector);
    if (similarity > bestSimilarity) {
      bestSimilarity = similarity;
      bestFamily = family;
    }
  }

  const margin = bestSimilarity - benignSimilarity;
  const isAttack =
    bestFamily !== null && bestSimilarity >= MIN_ATTACK_SIMILARITY && margin >= MARGIN_THRESHOLD;

  return {
    family: isAttack ? bestFamily : null,
    isAttack,
    score: Number(bestSimilarity.toFixed(4)),
    margin: Number(margin.toFixed(4)),
    benignSimilarity: Number(benignSimilarity.toFixed(4)),
  };
}
