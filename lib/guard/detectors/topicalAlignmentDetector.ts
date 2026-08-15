import type { GuardFinding } from "../types";

// Topical alignment: does this message have anything to do with what the tenant
// says their assistant is for?
//
// This is NOT a security detector. A support bot asked about football is not
// under attack — it is being misused, or the user is lost. That is why
// OFF_TOPIC is weighted 15 (see RISK_WEIGHTS), below the 31 REWRITE band, so it
// can never on its own change what happens to a request. It exists so the caller
// can *see* the drift and decide.
//
// Three deliberate properties:
//
//   1. FAIL-OPEN AND OFF BY DEFAULT. No `allowedTopics` and no
//      `systemPromptContext` → this returns nothing at all. Every existing
//      caller is therefore unaffected, which is the only reason it is safe to
//      register in the default INPUT pipeline.
//
//   2. DETERMINISTIC, ZERO-DEPENDENCY. Tier 1 is lexical coverage: what share of
//      the message's content words appear in the topic vocabulary. No model, no
//      network, no embedding table — so it costs microseconds and cannot fail
//      differently in production than in a test. It is genuinely shallow: it
//      matches words, not meaning, and "my parcel never showed up" scores 0
//      against the topic "shipping" unless "parcel" or "showed" is in the
//      vocabulary. That is the honest limit of Tier 1, and it is why the default
//      threshold is a permissive 0.25 rather than something that reads well in a
//      demo. Tier 2 (semantic) is the existing opt-in `llmJudge` tier — this
//      detector's mid-band output is what a caller escalates there.
//
//   3. IT REFUSES TO JUDGE WHEN IT CANNOT. Under `MIN_CONTENT_TOKENS` content
//      words there is not enough signal for coverage to mean anything: "thanks!"
//      would score 0.0 and be reported as off-topic. Short messages, greetings
//      and pleasantries are passed through silently.

export interface TopicalAlignmentConfig {
  /**
   * The subjects this assistant is for — e.g. `["billing", "refunds", "order
   * tracking"]`. Multi-word entries are matched both as a phrase and as their
   * individual words.
   */
  allowedTopics?: string[];
  /**
   * The tenant's system prompt (or any description of the assistant's job).
   * Its vocabulary is folded into the topic set, which makes the guard more
   * permissive — a longer prompt means a wider allowed vocabulary. That
   * direction is intentional: over-firing on a legitimate user is the expensive
   * error here, not missing a wanderer.
   */
  systemPromptContext?: string;
  /**
   * Coverage below this is reported as OFF_TOPIC. Default 0.25 — a message need
   * only be a quarter on-topic to pass.
   */
  minTopicRelevance?: number;
}

export const DEFAULT_MIN_TOPIC_RELEVANCE = 0.25;

/** Below this many content words, coverage is noise rather than evidence. */
const MIN_CONTENT_TOKENS = 4;

// Function words carry no topic signal, so leaving them in would dilute coverage
// toward zero for long polite sentences and toward one for terse ones. This is
// the standard short English list plus the conversational filler that dominates
// chat traffic ("please", "hello", "thanks").
const STOPWORDS = new Set([
  "the", "and", "for", "are", "but", "not", "you", "all", "any", "can", "her", "was", "one", "our",
  "out", "day", "get", "has", "him", "his", "how", "its", "may", "new", "now", "old", "see", "two",
  "who", "boy", "did", "she", "use", "way", "why", "with", "this", "that", "from", "they", "have",
  "will", "your", "what", "when", "make", "like", "time", "just", "know", "take", "into", "then",
  "them", "some", "could", "would", "there", "their", "about", "which", "were", "been", "than",
  "also", "much", "very", "want", "need", "does", "doing", "done", "should", "please", "thanks",
  "thank", "hello", "help", "tell", "give", "here", "more", "most", "such", "only", "over", "back",
  "well", "even", "many", "must", "shall", "might", "these", "those", "being", "having", "where",
  "while", "after", "before", "again", "still", "every", "other", "another", "because", "between",
]);

/** Crude, deliberately conservative English suffix stripping. */
function stem(word: string): string {
  if (word.length <= 4) return word;
  if (word.endsWith("ies") && word.length > 5) return `${word.slice(0, -3)}y`;
  for (const suffix of ["ing", "ers", "er", "ed", "es", "s"]) {
    if (word.endsWith(suffix) && word.length - suffix.length >= 4) {
      return word.slice(0, -suffix.length);
    }
  }
  return word;
}

function contentTokens(text: string): string[] {
  const raw = text.toLowerCase().match(/[a-z0-9']+/g) ?? [];
  const out: string[] = [];
  for (const token of raw) {
    const word = token.replace(/'/g, "");
    if (word.length < 3) continue;
    if (STOPWORDS.has(word)) continue;
    out.push(stem(word));
  }
  return out;
}

function buildVocabulary(config: TopicalAlignmentConfig): Set<string> {
  const vocabulary = new Set<string>();
  for (const topic of config.allowedTopics ?? []) {
    for (const token of contentTokens(topic)) vocabulary.add(token);
  }
  for (const token of contentTokens(config.systemPromptContext ?? "")) vocabulary.add(token);
  return vocabulary;
}

export interface TopicalRelevance {
  /** 0-1 share of the message's distinct content words found in the topic set. */
  relevance: number;
  /** The words that matched, for the explanation. */
  matched: string[];
  /** True when the guard declined to judge (no config, or too little text). */
  skipped: boolean;
}

/**
 * Lexical coverage of the message against the configured topic vocabulary.
 *
 * Distinct words, not total occurrences: repeating "refund" six times is one
 * piece of evidence that the message is about refunds, not six. A verbatim
 * multi-word topic phrase short-circuits to 1 — if the user literally wrote
 * "order tracking", arguing about coverage ratios would be perverse.
 */
export function scoreTopicalRelevance(
  text: string,
  config: TopicalAlignmentConfig,
): TopicalRelevance {
  const vocabulary = buildVocabulary(config);
  if (vocabulary.size === 0) return { relevance: 1, matched: [], skipped: true };

  const lowered = text.toLowerCase();
  for (const topic of config.allowedTopics ?? []) {
    const phrase = topic.trim().toLowerCase();
    if (phrase.includes(" ") && lowered.includes(phrase)) {
      return { relevance: 1, matched: [phrase], skipped: false };
    }
  }

  const tokens = new Set(contentTokens(text));
  if (tokens.size < MIN_CONTENT_TOKENS) return { relevance: 1, matched: [], skipped: true };

  const matched = [...tokens].filter((token) => vocabulary.has(token));
  return {
    relevance: Number((matched.length / tokens.size).toFixed(3)),
    matched,
    skipped: false,
  };
}

/**
 * A single advisory OFF_TOPIC finding, or nothing.
 *
 * Deliberately not a `Detector` — the signature is `(text, config)`, because a
 * topic guard with no topics is meaningless and threading the config through the
 * shared `(text) => GuardFinding[]` shape would mean a module-level global.
 * `analyzeText` calls it directly when the caller supplied topics.
 */
export function topicalAlignmentDetector(
  text: string,
  config: TopicalAlignmentConfig,
): GuardFinding[] {
  const threshold = config.minTopicRelevance ?? DEFAULT_MIN_TOPIC_RELEVANCE;
  const { relevance, skipped } = scoreTopicalRelevance(text, config);
  if (skipped || relevance >= threshold) return [];

  const topics = (config.allowedTopics ?? []).slice(0, 6).join(", ");
  return [
    {
      type: "OFF_TOPIC",
      label: "Off-topic request",
      severity: "LOW",
      // Scaled within the category weight so a message with *some* overlap ranks
      // below one with none, which is what makes `categoryConfidence` readable
      // here rather than a constant.
      score: Math.max(5, Math.round(15 * (1 - relevance / threshold))),
      message:
        `Topic relevance ${relevance.toFixed(2)} is below the configured minimum ${threshold}` +
        (topics ? ` for: ${topics}.` : ".") +
        " Advisory only — this does not by itself block or rewrite the request.",
    },
  ];
}
