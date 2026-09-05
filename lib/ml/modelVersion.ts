/**
 * Single source of truth for which on-disk model artifact the guard's ML tier
 * loads by default.
 *
 * Before this module existed the default was written out three times, and the
 * three copies disagreed:
 *
 *   lib/ml/onnxBackend.ts          -> models/ml-classifier-v3/{model.onnx,labels.json}
 *   lib/ml/multilingualSemantic.ts -> models/ml-classifier-v4/model.onnx (no env override at all)
 *   scripts/guard-benchmark/*      -> a mix of v1, v2, v3 and v4
 *
 * So the artifact a benchmark measured was not necessarily the artifact
 * production served, and nothing failed loudly when they diverged — the guard
 * just scored a different model than the one that was signed off.
 *
 * ── Why v3 and not v14 ────────────────────────────────────────────────────────
 * models/ml-classifier-v14 is the newest artifact and has the widest label set
 * (14 classes vs v3's 9) and the best calibration (ECE 0.0027). It is
 * deliberately NOT the default yet: its eval_results.json shows several labels
 * that have never been threshold-calibrated (`"threshold_inert": true` at 0.05)
 * and three with recall well below the rest — ENCODING_OBFUSCATION 0.68,
 * MULTI_TURN_ESCALATION 0.72, MODEL_EXTRACTION 0.70 at 0.78 precision. Promoting
 * it is a measured decision that needs `npm run ml:verify:v4` and
 * `npm run benchmark:honest` run against the held-out corpora first, not a
 * constant edit. Point ML_ONNX_MODEL_PATH / ML_ONNX_LABELS_PATH at v14 to
 * evaluate it, and change DEFAULT_MODEL_DIR here once those numbers exist.
 */

/** Directory holding the artifact served by default. */
export const DEFAULT_MODEL_DIR = "models/ml-classifier-v3";

/** Newest trained artifact. Not the default — see the note above. */
export const LATEST_MODEL_DIR = "models/ml-classifier-v14";

export const DEFAULT_MODEL_PATH = `${DEFAULT_MODEL_DIR}/model.onnx`;
export const DEFAULT_LABELS_PATH = `${DEFAULT_MODEL_DIR}/labels.json`;

/**
 * Resolves the model path an ML consumer should load: an explicit argument wins,
 * then the operator's ML_ONNX_MODEL_PATH, then the shipped default.
 *
 * Reading the environment variable here is the point. multilingualSemantic.ts
 * took only a constructor default, which meant an operator who moved the
 * deployment onto a different artifact moved the classifier but silently left
 * the semantic detector on whatever was hard-coded.
 */
export function resolveModelPath(explicitPath?: string): string {
  return explicitPath ?? process.env.ML_ONNX_MODEL_PATH ?? DEFAULT_MODEL_PATH;
}

/** Companion to resolveModelPath for the label map. */
export function resolveLabelsPath(explicitPath?: string): string {
  return explicitPath ?? process.env.ML_ONNX_LABELS_PATH ?? DEFAULT_LABELS_PATH;
}

/**
 * The multilingual semantic detector (lib/ml/multilingualSemantic.ts) uses a
 * model as a sentence *embedder*, not as a classifier: it embeds ATTACK_SEEDS at
 * init and compares cosine similarity at request time. That makes it a separate
 * choice from the classification artifact above — swapping it changes the
 * embedding space, and therefore the meaning of every similarity threshold — so
 * it gets its own constant and its own override rather than silently following
 * ML_ONNX_MODEL_PATH.
 *
 * It stays on v4 because that is the artifact the current thresholds were set
 * against. What changed here is only that the value is declared once and is now
 * overridable at all; it used to be a bare constructor default, so an operator
 * who moved the deployment to a different artifact moved the classifier and left
 * this detector behind with no way to say otherwise.
 */
export const DEFAULT_SEMANTIC_MODEL_DIR = "models/ml-classifier-v4";
export const DEFAULT_SEMANTIC_MODEL_PATH = `${DEFAULT_SEMANTIC_MODEL_DIR}/model.onnx`;

export function resolveSemanticModelPath(explicitPath?: string): string {
  return explicitPath ?? process.env.ML_ONNX_SEMANTIC_MODEL_PATH ?? DEFAULT_SEMANTIC_MODEL_PATH;
}
