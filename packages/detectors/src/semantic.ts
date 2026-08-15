import type { DetectorFinding } from "./core";
import { normalizeForDetection } from "./normalize";

/**
 * On-device Semantic Injection Shield (Gap #1 closer).
 *
 * Why: pure regex rules catch *known* phrasings but miss novel jailbreaks
 * ("paraphrase attacks"). Competitors (Lakera, Palo Alto) close this with large
 * server-side transformers; we close it on-device with a tiny, transparent,
 * zero-dependency scoring engine plus a pluggable WASM/ONNX hook.
 *
 * Design goals:
 *  - Runs in browser (extension) and Node with no network and no native deps.
 *  - O(n) token scan, no recursion, no catastrophic regex.
 *  - Additive signal: emits a DetectorFinding that the scanner merges with regex
 *    results; never blocks on its own below the configured threshold, so it
 *    can't introduce a new false-positive-axis that regex never had.
 */

export interface SemanticScore {
  /** 0..100 risk score for prompt-injection / jailbreak intent. */
  score: number;
  /** Highest individual signal labels that fired, for the audit trail. */
  signals: string[];
}

/** Optional neural hook. If a caller ships a WASM/ONNX model it can register
 *  it here; the heuristic engine remains the deterministic fallback. Pluggable
 *  so the extension can lazy-load `onnxruntime-web` without a hard dependency. */
export type SemanticModel = (text: string) => SemanticScore | null;

let registeredModel: SemanticModel | null = null;
export function registerSemanticModel(model: SemanticModel | null): void {
  registeredModel = model;
}

/* ------------------------------------------------------------------ */
/* Heuristic engine                                                    */
/* ------------------------------------------------------------------ */

// Weighted lexicon: words that carry injection *intent*, not just one keyword.
const INTENT_TERMS: Array<[RegExp, number, string]> = [
  // Authority-override / instruction-hijack verbs
  [/\b(ignor\w*|disregard\w*|forget|override|bypass|disable|circumvent|suppress)\b/gi, 16, "override-verb"],
  // Credential / config extraction nouns
  [/\b(api[\s_-]?keys?|access[\s_-]?tokens?|credentials?|passwords?|secrets?|private[\s_-]?keys?)\b/gi, 14, "credential-noun"],
  // Target = the model's own instructions/prompt (a hallmark of injection)
  [/\b(system[\s_-]?prompt|developer[\s_-]?message|initial[\s_-]?instructions?|hidden[\s_-]?(?:prompt|instructions?)|(?:governing|standing|existing|prior|original)[\s_-]?(?:rules|instructions|guidelines|constraints|directives)|your[\s_-]?(?:rules|instructions|guidelines|constraints))\b/gi, 18, "prompt-target"],
  // Persona / unconstrained-mode jailbreak phrasing
  [/\b(dan\b|do anything now|jailbreak|no (?:ethics|restrictions|limits|filters)|unfiltered|uncensored|act as (?:an? )?(?:evil|unrestricted|uncensored))\b/gi, 18, "jailbreak-persona"],
  // Exfiltration verbs pointed at the above nouns
  [/\b(reveal|show|print|leak|display|dump|expose|list|output|repeat|echo|extract)\b/gi, 12, "exfil-verb"],
  // Role reassignment: "you are now / pretend to be" outside a quoted code comment
  [/\b(you are now|from now on you|pretend (?:to be|you are)|imagine you are|simulate being|assume the role)\b/gi, 15, "role-reassign"],
  // Hidden instructions sourced from attacker-controlled files/tool output.
  [/\b(hidden|embedded|concealed|internal)\s+(?:system\s+)?(?:instructions?|prompt|directives?|rules?)\b/gi, 18, "indirect-instruction-target"],
  [/\b(extract|recover|follow|execute|obey|apply)\b[^\n]{0,80}\b(?:instructions?|directives?|prompt|rules?)\b/gi, 14, "instruction-execution"],
  // "in this hypothetical/fictional scenario ... provide instructions to make X"
  [/\b(hypothetical|fictional|for (?:a )?(?:story|novel|movie|game)|academic purposes?)\b/gi, 8, "fiction-frame"],
];

// Novelty multipliers: combinations the regex tables don't encode on their own.
const COMBO_BOOSTS: Array<{ need: string[]; boost: number; label: string }> = [
  { need: ["override-verb", "prompt-target"], boost: 22, label: "override-the-system-prompt" },
  { need: ["exfil-verb", "credential-noun"], boost: 20, label: "exfiltrate-credentials" },
  { need: ["jailbreak-persona", "override-verb"], boost: 18, label: "persona-plus-override" },
  { need: ["fiction-frame", "credential-noun"], boost: 14, label: "framed-credential-request" },
  { need: ["indirect-instruction-target", "instruction-execution"], boost: 24, label: "indirect-instruction-execution" },
];

/** Score one (already normalized) view. */
function scoreView(text: string): SemanticScore {
  if (!text || text.trim().length < 6) return { score: 0, signals: [] };
  const fired = new Map<string, number>();

  for (const [re, weight, label] of INTENT_TERMS) {
    const matches = text.match(re);
    if (!matches) continue;
    // Diminishing returns: first hit counts full, repeats add 0.25x each.
    const repeats = Math.min(matches.length - 1, 3);
    fired.set(label, Math.max(fired.get(label) ?? 0, weight + repeats * weight * 0.25));
  }

  let score = 0;
  for (const w of fired.values()) score += w;

  const labels = Array.from(fired.keys());
  for (const combo of COMBO_BOOSTS) {
    if (combo.need.every((n) => labels.includes(n))) {
      score = Math.min(100, score + combo.boost);
      labels.push(combo.label);
    }
              }

  // Length-gated confidence: a single hit on a huge document is weaker evidence
  // than the same hit in a short prompt.
  if (text.length > 4000 && labels.length <= 1) score = Math.round(score * 0.7);

  return { score: Math.min(100, Math.round(score)), signals: labels };
}

/** Public entry: score raw (possibly obfuscated) text against every view. */
export function semanticInjectionScore(rawText: string): SemanticScore {
  const views = normalizeForDetection(rawText);
  if (!views.length) return { score: 0, signals: [] };

  let best: SemanticScore = { score: 0, signals: [] };
  for (const view of views) {
    // Prefer a registered neural model when present, else heuristic.
    const scored = registeredModel?.(view) ?? scoreView(view);
    if (scored.score > best.score) best = scored;
  }
  return best;
}

/**
 * Emit a DetectorFinding when the semantic score crosses the threshold.
 * Default threshold 55 — high enough that a lone benign keyword ("show me how
 * jwt works") stays below it, low enough to catch real paraphrased jailbreaks.
 */
export function detectSemanticInjection(
  rawText: string,
  threshold = 55,
): DetectorFinding[] {
  const { score, signals } = semanticInjectionScore(rawText);
  if (score < threshold) return [];
  return [
    {
      type: "prompt_injection_semantic",
      label: "Semantic prompt-injection (paraphrase-resistant)",
      severity: score >= 75 ? "high" : "medium",
      score,
      start: 0,
      end: Math.min(rawText.length, 200),
      match: rawText.slice(0, 200),
      message: `Paraphrase-resistant injection intent (signals: ${signals.slice(0, 4).join(", ") || "combined"}).`,
    },
  ];
}
