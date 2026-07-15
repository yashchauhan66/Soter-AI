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
 *   2. At module load, every seed phrase for each attack family and a benign
 *      control set is embedded and kept as an individual prototype vector.
 *   3. Classification uses *nearest-prototype* similarity: the input's score for
 *      a family is its highest cosine similarity to ANY single seed in that
 *      family (a 1-NN estimate), and its benign score is the highest similarity
 *      to any benign seed. The decision is the best attack score minus the
 *      benign score (the "margin").
 *
 * Why nearest-prototype and not an averaged centroid: attack families are
 * multi-modal (an "instruction override" and a "combine-the-parts" injection are
 * both PROMPT_INJECTION but point in different directions). Averaging blurs those
 * modes into a single vector that matches none of them well, capping recall on
 * novel phrasings. Taking the max over individual seeds lets each distinct
 * sub-pattern vote, which generalizes far better — adding a paraphrase widens
 * coverage directly instead of being diluted into an average.
 *
 * It is intentionally used as a *recall booster that routes to human review*,
 * never as a standalone hard block — see analyzeText. Cosine of two unit vectors
 * is a dot product, so scoring is O(seeds * dim) and still sub-millisecond.
 */

const DIM = 512;

// Decision thresholds. Calibrated (see scripts/guard-benchmark/ml-tier-heldout.ts
// and the 300-case benign control) so paraphrased attacks clear the bar while
// security-adjacent benign prose does not. Nearest-prototype similarity runs
// higher than centroid similarity, so these floors are set accordingly. Because
// a hit only routes to HUMAN_REVIEW (and only when the rules found nothing),
// they are tuned for recall with a bounded false-positive cost.
const MARGIN_THRESHOLD = 0.07;
const MIN_ATTACK_SIMILARITY = 0.44;

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

/** Highest cosine similarity of `vector` to any prototype in `prototypes`. */
function maxSimilarity(vector: Float64Array, prototypes: Float64Array[]): number {
  let best = -1;
  for (const prototype of prototypes) {
    const similarity = dot(vector, prototype);
    if (similarity > best) best = similarity;
  }
  return best;
}

// Precomputed once at module load. Each seed is kept as its own unit prototype
// (not averaged) so multi-modal families are represented by every distinct
// sub-pattern. Cosine similarity to an (also unit) input is a single dot product.
const FAMILY_PROTOTYPES: Array<{ family: SemanticFamily; vectors: Float64Array[] }> = (
  Object.keys(SEMANTIC_SEEDS) as SemanticFamily[]
).map((family) => ({
  family,
  vectors: SEMANTIC_SEEDS[family].map((seed) => embed(seed)),
}));

const BENIGN_PROTOTYPES: Float64Array[] = SEMANTIC_BENIGN_SEEDS.map((seed) => embed(seed));

// A blurred centroid per family, kept as a cheap secondary signal: it captures
// the family's shared "gist" and is averaged with the sharp 1-NN score so a text
// that is broadly on-theme but not close to any single seed still scores.
const FAMILY_CENTROIDS: Array<{ family: SemanticFamily; vector: Float64Array }> = (
  Object.keys(SEMANTIC_SEEDS) as SemanticFamily[]
).map((family) => ({ family, vector: centroid(SEMANTIC_SEEDS[family]) }));

const BENIGN_CENTROID = centroid(SEMANTIC_BENIGN_SEEDS);

/**
 * Classifies a text as an attack family or benign based on nearest-prototype
 * similarity. Deterministic and storage-free; safe to call on the guard hot path.
 */
export function classifySemantic(text: string): SemanticAssessment {
  const clean = text.trim();
  if (clean.length < 8) {
    return { family: null, isAttack: false, score: 0, margin: 0, benignSimilarity: 0 };
  }

  const vector = embed(clean);

  // Benign score blends the sharpest matching benign seed with the benign gist.
  const benignNn = maxSimilarity(vector, BENIGN_PROTOTYPES);
  const benignCentroidSim = dot(vector, BENIGN_CENTROID);
  const benignSimilarity = 0.7 * benignNn + 0.3 * benignCentroidSim;

  const centroidByFamily = new Map<SemanticFamily, number>();
  for (const { family, vector: centroidVector } of FAMILY_CENTROIDS) {
    centroidByFamily.set(family, dot(vector, centroidVector));
  }

  let bestFamily: SemanticFamily | null = null;
  let bestScore = -1;
  for (const { family, vectors } of FAMILY_PROTOTYPES) {
    // Blend the sharp 1-NN score (recall on distinct sub-patterns) with the
    // family centroid (recall on broadly on-theme phrasings). 1-NN dominates.
    const nn = maxSimilarity(vector, vectors);
    const gist = centroidByFamily.get(family) ?? 0;
    const score = 0.75 * nn + 0.25 * gist;
    if (score > bestScore) {
      bestScore = score;
      bestFamily = family;
    }
  }

  const margin = bestScore - benignSimilarity;
  const isAttack =
    bestFamily !== null && bestScore >= MIN_ATTACK_SIMILARITY && margin >= MARGIN_THRESHOLD;

  return {
    family: isAttack ? bestFamily : null,
    isAttack,
    score: Number(bestScore.toFixed(4)),
    margin: Number(margin.toFixed(4)),
    benignSimilarity: Number(benignSimilarity.toFixed(4)),
  };
}
