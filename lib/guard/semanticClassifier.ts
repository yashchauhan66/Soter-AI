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

/**
 * Hash one character n-gram and bucket it, continuing from a prefix hash that was
 * computed once at module load.
 *
 * Decides exactly what `addFeatureRange(vector, `c${n}:`, collapsed, i, n)` decided:
 * same FNV-1a state, same feature code units in the same order, same U+0001 sign
 * continuation. What it no longer does is re-hash the three-character prefix for
 * every window — three of the seven multiply-steps a 3-gram needed — or call
 * `charCodeAt` per window position, which across the 3/4/5-gram passes meant about
 * twelve calls per character of an 8 KB payload.
 */
function addGramFeature(
  vector: Float64Array,
  prefixHash: number,
  codes: Uint16Array,
  start: number,
  length: number,
): void {
  let hash = prefixHash;
  for (let i = start; i < start + length; i += 1) {
    hash ^= codes[i];
    hash = Math.imul(hash, 0x01000193);
  }
  const index = (hash >>> 0) % DIM;

  // The sign hash is FNV-1a over the same feature followed by U+0001.
  hash ^= 1;
  hash = Math.imul(hash, 0x01000193);
  vector[index] += ((hash >>> 0) & 1) === 0 ? 1 : -1;
}

/** `c3:` / `c4:` / `c5:` are fixed, so their FNV-1a prefix states are too. */
const GRAM_PREFIX_HASH = [3, 4, 5].map((n) => {
  const prefix = `c${n}:`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < prefix.length; i += 1) {
    hash ^= prefix.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash;
});

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
  const codes = new Uint16Array(collapsed.length);
  for (let i = 0; i < collapsed.length; i += 1) codes[i] = collapsed.charCodeAt(i);
  for (let n = 3; n <= 5; n += 1) {
    if (collapsed.length < n) continue;
    const prefixHash = GRAM_PREFIX_HASH[n - 3];
    for (let i = 0; i + n <= collapsed.length; i += 1) {
      addGramFeature(vector, prefixHash, codes, i, n);
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

/**
 * Pack prototypes into one contiguous buffer of `count * DIM` doubles.
 *
 * Storing 1,085 prototypes as 1,085 separate 4 KB Float64Arrays makes every
 * similarity sweep a pointer chase over ~4.4 MB of scattered heap — far past L2,
 * so the classifier was bound by cache misses rather than arithmetic (measured
 * ~5 ms per call even for a 16-byte input). One flat buffer walks memory in
 * order. The arithmetic is unchanged: each prototype's dot product still sums
 * `i = 0..DIM-1` in the same order over the same doubles, so scores are
 * bit-for-bit identical to the array-of-arrays form.
 */
function packPrototypes(vectors: Float64Array[]): Float64Array {
  const flat = new Float64Array(vectors.length * DIM);
  for (let p = 0; p < vectors.length; p += 1) flat.set(vectors[p], p * DIM);
  return flat;
}

/**
 * The input's non-zero dimensions, collected once per call into a reusable
 * scratch buffer (`classifySemantic` is synchronous and never re-enters, so a
 * module-level scratch cannot be observed by a second caller).
 *
 * Feature hashing is sparse: a 16-byte payload lands in 28 of the 512 buckets
 * and a 62-byte attack string in 165, so a dense sweep spends 80-95% of its
 * multiply-adds on `0 * x`. Skipping those terms is bit-exact, not an
 * approximation: each omitted product is exactly ±0.0, adding ±0.0 to a sum that
 * starts at +0.0 leaves it unchanged and can never make it -0.0, and the
 * surviving terms are still accumulated in ascending index order. Verified by
 * comparing raw (unrounded) doubles over all 1,088 seeds — zero mismatches.
 */
const nonzeroScratch = new Int32Array(DIM);

function collectNonzero(vector: Float64Array): number {
  let count = 0;
  for (let i = 0; i < DIM; i += 1) {
    if (vector[i] !== 0) nonzeroScratch[count++] = i;
  }
  return count;
}

function dotSparse(vector: Float64Array, other: Float64Array, count: number): number {
  let total = 0;
  for (let k = 0; k < count; k += 1) {
    const i = nonzeroScratch[k];
    total += vector[i] * other[i];
  }
  return total;
}

/** Highest cosine similarity of `vector` to any prototype packed in `flat`. */
function maxSimilarityPacked(vector: Float64Array, flat: Float64Array, count: number): number {
  let best = -1;
  for (let base = 0; base < flat.length; base += DIM) {
    let total = 0;
    for (let k = 0; k < count; k += 1) {
      const i = nonzeroScratch[k];
      total += vector[i] * flat[base + i];
    }
    if (total > best) best = total;
  }
  return best;
}

// Precomputed once at module load. Each seed is kept as its own unit prototype
// (not averaged) so multi-modal families are represented by every distinct
// sub-pattern. Cosine similarity to an (also unit) input is a single dot product.
//
// Each family carries its seeds packed into one contiguous buffer plus its
// blurred centroid — a cheap secondary signal that captures the family's shared
// "gist" and is averaged with the sharp 1-NN score so a text that is broadly
// on-theme but not close to any single seed still scores. Families keep the
// `Object.keys(SEMANTIC_SEEDS)` order, so the first-family-wins tie-break on
// equal scores is the same as before.
const FAMILY_PROTOTYPES: Array<{
  family: SemanticFamily;
  seeds: Float64Array;
  centroid: Float64Array;
}> = (Object.keys(SEMANTIC_SEEDS) as SemanticFamily[]).map((family) => ({
  family,
  seeds: packPrototypes(SEMANTIC_SEEDS[family].map((seed) => embed(seed))),
  centroid: centroid(SEMANTIC_SEEDS[family]),
}));

const BENIGN_PROTOTYPES: Float64Array = packPrototypes(
  SEMANTIC_BENIGN_SEEDS.map((seed) => embed(seed)),
);

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
  const nonzero = collectNonzero(vector);

  // Benign score blends the sharpest matching benign seed with the benign gist.
  const benignNn = maxSimilarityPacked(vector, BENIGN_PROTOTYPES, nonzero);
  const benignCentroidSim = dotSparse(vector, BENIGN_CENTROID, nonzero);
  const benignSimilarity = 0.7 * benignNn + 0.3 * benignCentroidSim;

  let bestFamily: SemanticFamily | null = null;
  let bestScore = -1;
  for (const { family, seeds, centroid: familyCentroid } of FAMILY_PROTOTYPES) {
    // Blend the sharp 1-NN score (recall on distinct sub-patterns) with the
    // family centroid (recall on broadly on-theme phrasings). 1-NN dominates.
    const nn = maxSimilarityPacked(vector, seeds, nonzero);
    const gist = dotSparse(vector, familyCentroid, nonzero);
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
