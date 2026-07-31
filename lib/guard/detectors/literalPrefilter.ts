/**
 * Mandatory-literal prefilter for pattern rules.
 *
 * WHAT THIS IS FOR
 * ----------------
 * `detectPatterns` runs every rule's regex over every decode variant. On an 8 KB
 * benign payload that is ~571 rules x 2-10 variants of full-text regex scanning,
 * and measured profiling attributes ~39 ms of a ~49 ms guard pass to it. Almost
 * all of that work is provably wasted: a rule that can only match text
 * containing "previous instructions" cannot match text without that substring.
 *
 * So for each rule we extract a REQUIRED DISJUNCTION: a small set of literals of
 * which at least one must appear in any string the regex matches. If none of
 * them is in the haystack, the scan is skipped. A single literal is the common
 * case; a set is what makes the filter useful on this corpus, where most rules
 * are alternations of phrases (`(?:ignore|disregard|forget) ... instructions`).
 * A rule can also yield SEVERAL such sets — a conjunction of necessary
 * disjunctions — in which case any one of them being absent is enough to skip.
 * The test is a pure necessary condition, so it can only remove scans that would
 * have produced no findings — it can never change a finding, a score, a
 * severity, an offset, or a decision.
 *
 * WHY IT IS SAFE
 * --------------
 *  1. Bail-to-null. The extractor parses a deliberately small subset of regex
 *     syntax. Anything it cannot prove — a branch with no usable literal, a set
 *     that grows past the cost cap, an escape whose extent is unknown, `v`-mode
 *     classes, sticky patterns — yields `null`, meaning "no prefilter, run the
 *     rule". Being wrong conservatively costs performance, never detection.
 *  2. Optional and zero-width constructs contribute nothing. A quantifier that
 *     admits zero repetitions, a lookaround, an anchor, a character class, `.`,
 *     `\d`-style escapes and backreferences all cut the current literal run
 *     instead of extending it, because `ab+c` does not guarantee the contiguous
 *     substring "abc".
 *  3. ASCII-only applicability. The prefilter engages only when BOTH every
 *     literal and the haystack are pure ASCII. That removes every Unicode
 *     case-folding hazard (U+017F LATIN SMALL LETTER LONG S folding to "s",
 *     U+212A KELVIN SIGN folding to "k" under `iu`), because such characters
 *     cannot occur in an ASCII haystack.
 *  4. Verifiable at runtime. With SOTERAI_PREFILTER_VERIFY=1 every skip is
 *     re-checked by actually running the regex, and a skip that would have lost
 *     a match throws. The differential test suite and the expanded recall
 *     corpora run in that mode, so soundness is asserted over real attack
 *     inputs, not just unit cases.
 *  5. Kill switch. SOTERAI_DISABLE_LITERAL_PREFILTER=1 restores the exact
 *     previous execution path.
 *
 * It disables no detector, weakens no rule, relaxes no threshold, and caches no
 * input data: the only state kept is per-RegExp metadata, a one-entry lowercase
 * memo for the string currently being scanned, and a lossy 3-gram bitmap of that
 * same string.
 */

/**
 * The disjunctions a pattern was reduced to. Each one is a set of literals of
 * which at least one must occur in any match, and each is *independently*
 * necessary, so the scan can be skipped when ANY single set is absent.
 *
 * Several sets matter because the hottest rules on this corpus have the shape
 * `(?:cue)…(?:harm object)|(?:harm object)…(?:cue)`. Both branches require the
 * harm-object list, so it is necessary for the whole rule — but a haystack that
 * happens to contain one short cue ("checklist" contains "list") defeats the cue
 * set, and with only one set kept the rule had to run. Keeping the harm-object
 * set alongside it rules the rule out on that same haystack.
 */
export interface RequiredLiteral {
  /** ASCII only, non-empty, already lowercased when `caseInsensitive`. */
  literals: string[];
  caseInsensitive: boolean;
  /**
   * Two case-folded 3-gram hashes per literal (`probes[2i]`, `probes[2i+1]`),
   * used to rule a literal out against the haystack index without scanning.
   */
  probes: Int32Array;
  /**
   * The other necessary disjunctions, most selective first, checked only when
   * `literals` failed to rule the rule out. Absent when there is just one.
   */
  alsoRequired?: RequiredSet[];
}

/** One required disjunction together with its 3-gram probes. */
export interface RequiredSet {
  literals: string[];
  probes: Int32Array;
}

/** Shorter literals filter too little to pay for their own lookup. */
const MIN_LITERAL_LENGTH = 3;

/**
 * Cost cap on the size of the literal set.
 *
 * With the 3-gram index a literal that is absent costs two array lookups, so a
 * wide set is cheap: the price is paid only by literals the index cannot rule
 * out, and `MAX_FALLBACK_SEARCHES` bounds those. Wide sets matter because the
 * hottest rules in this codebase are `(?:25 production cues)…(?:harm object)`
 * shapes whose only provable requirement is the wide cue disjunction. Measured
 * on the 8 KB payload, `harmfulContentRequestDetector` had 4 of its 11 rules
 * unprovable at a cap of 24 — each one a ~45-literal union over a harm-object
 * list — and those 4 cost 3.1 ms of the 8 KB scan on their own.
 */
const MAX_ALTERNATIVES = 64;

/**
 * Substring searches allowed per (rule, haystack) before giving up and letting
 * the regex run. Giving up is always sound — it only forgoes a skip — and it
 * bounds the worst case where many literals survive the index but are absent.
 */
const MAX_FALLBACK_SEARCHES = 6;

/**
 * How many independently necessary disjunctions one rule may carry.
 *
 * An extra set is only consulted after every earlier one failed to rule the rule
 * out, and costs two index probes per literal plus at most
 * `MAX_FALLBACK_SEARCHES` substring searches, so the worst case for a rule that
 * is about to run a full regex pass anyway stays bounded at three probe sweeps
 * and 18 searches. Past three the ranked tail is near-duplicate unions of the
 * sets already kept, which rule almost nothing out on their own.
 */
const MAX_REQUIRED_SETS = 3;

/**
 * Below `GRAM_MIN_TEXT` there is no index, so every literal costs a real search.
 * A set wider than this is refused outright on those haystacks rather than
 * part-searched: short text is cheap for the regex too, so the trade stops
 * paying. Keeping this at the historical `MAX_ALTERNATIVES` means raising that
 * cap cannot add a single substring search to the small-payload path.
 */
const MAX_ALTERNATIVES_NO_INDEX = 24;

/** Guards against pathological nesting in a generated rule. */
const MAX_DEPTH = 12;
/** Escapes whose escaped form denotes exactly one literal character. */
const LITERAL_ESCAPES = new Set([
  "\\", "/", ".", "-", "+", "*", "?", "(", ")", "[", "]", "{", "}", "|", "^", "$", "=", "!", ":", ",", "<", ">", "#", "@", "&", "~", "%", "'", '"', ";", "`", " ",
]);

/** Escapes that denote one literal control character. */
const CONTROL_ESCAPES: Record<string, string> = { n: "\n", r: "\r", t: "\t", f: "\f", v: "\v" };

/** Argument-free escapes that match one character this extractor treats as unknown. */
const OPAQUE_ESCAPES = new Set(["d", "D", "w", "W", "s", "S", "b", "B"]);

/**
 * A CONJUNCTION of required disjunctions: every set in the list has at least one
 * member in any match, so each set is a necessary condition on its own. `null`
 * means "cannot be proven", and it propagates out of an alternation with one
 * unprovable branch, because a match may take that branch and contain none of
 * the other branches' literals.
 *
 * Dropping a set from a non-null list is always sound in the other direction: it
 * forgoes a possible skip and leaves every remaining set necessary. That is what
 * bounds the cost of carrying several.
 */
type Req = string[][] | null;

function isAsciiString(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    if (value.charCodeAt(i) > 127) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Case-folded 3-gram index
// ---------------------------------------------------------------------------
//
// Substring searching every literal of every rule is still one linear pass per
// (rule, variant) pair, which is why the first version of this prefilter saved
// nothing on an 8 KB payload: it replaced a regex scan with a `String.includes`
// scan of the same length. The index turns that into one pass over the haystack
// plus two array lookups per literal.
//
// Soundness: the index records the 3-grams that DO occur (case-folded). If a
// literal's 3-gram bit is clear, that 3-gram occurs nowhere in the haystack, so
// the literal cannot occur either. A set bit proves nothing — hash collisions and
// unrelated occurrences are both possible — so `String.includes` remains the
// authority for every literal the index cannot rule out.

/** 16384 bits (2 KB): low fill for an 8 KB haystack, one linear pass to build. */
const GRAM_BITS = 1 << 14;
const GRAM_MASK = GRAM_BITS - 1;
const GRAM_WORDS = GRAM_BITS >>> 5;

/** Below this length a direct `String.includes` is cheaper than an index. */
const GRAM_MIN_TEXT = 128;

/** ASCII lowercase fold of one char code. */
function fold(code: number): number {
  return code >= 65 && code <= 90 ? code + 32 : code;
}

function gramHash(a: number, b: number, c: number): number {
  return (((a * 131 + b) * 131 + c) >>> 0) & GRAM_MASK;
}

/** One linear pass: set a bit for every case-folded 3-gram in `text`. */
function buildGramIndex(text: string): Uint32Array {
  const bits = new Uint32Array(GRAM_WORDS);
  let a = fold(text.charCodeAt(0));
  let b = fold(text.charCodeAt(1));
  for (let i = 2; i < text.length; i += 1) {
    const c = fold(text.charCodeAt(i));
    const h = gramHash(a, b, c);
    bits[h >>> 5] |= 1 << (h & 31);
    a = b;
    b = c;
  }
  return bits;
}

/** First and last 3-gram of a literal; both must be present for a possible hit. */
function literalProbes(literals: string[]): Int32Array {
  const probes = new Int32Array(literals.length * 2);
  for (let i = 0; i < literals.length; i += 1) {
    const literal = literals[i];
    const first = gramHash(
      fold(literal.charCodeAt(0)),
      fold(literal.charCodeAt(1)),
      fold(literal.charCodeAt(2)),
    );
    const at = literal.length - 3;
    probes[i * 2] = first;
    probes[i * 2 + 1] =
      at > 0
        ? gramHash(
            fold(literal.charCodeAt(at)),
            fold(literal.charCodeAt(at + 1)),
            fold(literal.charCodeAt(at + 2)),
          )
        : first;
  }
  return probes;
}

/**
 * Reduce a candidate set: dedupe, drop any literal that contains another (the
 * shorter one is implied by it, so testing only the shorter stays sound and
 * costs less), and reject a set that is empty, too large, or has a member below
 * the useful length.
 */
function normaliseSet(literals: string[]): string[] | null {
  const unique = [...new Set(literals)];
  if (!unique.length) return null;
  for (const literal of unique) {
    if (literal.length < MIN_LITERAL_LENGTH) return null;
    if (!isAsciiString(literal)) return null;
  }
  const minimal = unique.filter(
    (candidate) => !unique.some((other) => other !== candidate && candidate.includes(other)),
  );
  if (minimal.length > MAX_ALTERNATIVES) return null;
  return minimal;
}

/**
 * How likely an arbitrary text is to contain at least one member of the set —
 * the quantity that decides whether keeping this set will ever remove a scan.
 *
 * Estimated as if text were independent coin flips, so a literal of length L
 * costs 2^-L and the set costs the sum. It is a crude model of English, but the
 * only thing it has to get right is the ordering, and there the exponential term
 * dominates: a 26-cue set built from "how" / "list" / "code" is worth far less
 * than a set of "ransomware" / "syn flood" / "credential stealer", and no count
 * of literals changes that. Nothing about soundness depends on this number — it
 * only chooses which provably necessary sets to keep.
 */
function hitEstimate(literals: string[]): number {
  let total = 0;
  for (const literal of literals) total += 2 ** -literal.length;
  return total;
}

/** Every member of `inner` is also a member of `outer`. */
function isSubsetOf(inner: string[], outer: string[]): boolean {
  if (inner.length > outer.length) return false;
  for (const literal of inner) {
    if (!outer.includes(literal)) return false;
  }
  return true;
}

/** Most selective first; on a tie the narrower set, which is cheaper to check. */
function bySelectivity(a: string[], b: string[]): number {
  const difference = hitEstimate(a) - hitEstimate(b);
  if (difference !== 0) return difference;
  return a.length - b.length;
}

/**
 * Reduce a bag of candidate sets to the conjunction that will be kept.
 *
 * Normalises each set, drops the ones that are unusable and the ones that add
 * nothing, then keeps the `MAX_REQUIRED_SETS` most selective. A set is redundant
 * when a set already kept is a subset of it: if none of the narrower set's
 * literals occurs then none of the wider set's does either, so the wider check
 * could never be the one that fires. Both kinds of dropping are sound — every
 * surviving set is still necessary, and the ones removed only ever cost a skip.
 */
function reduceConjunction(candidates: string[][]): Req {
  const usable: string[][] = [];
  const seen = new Set<string>();
  for (const candidate of candidates) {
    const set = normaliseSet(candidate);
    if (!set) continue; // unusable on its own; the other sets stay necessary
    const key = [...set].sort().join(" ");
    if (seen.has(key)) continue;
    seen.add(key);
    usable.push(set);
  }
  usable.sort(bySelectivity);
  const kept: string[][] = [];
  for (const set of usable) {
    if (kept.some((earlier) => isSubsetOf(earlier, set))) continue;
    kept.push(set);
    if (kept.length === MAX_REQUIRED_SETS) break;
  }
  return kept.length ? kept : null;
}

/**
 * Requirement of an alternation. A match takes exactly ONE branch, so a set is
 * necessary for the whole only if every branch implies it: taking one necessary
 * set from each branch and unioning them gives exactly such a set, and every
 * one-per-branch choice is a valid conjunct. The case that pays here is the one
 * where all branches require the same set and the union collapses back to it.
 *
 * The product is folded branch by branch and re-reduced at each step, which
 * bounds both the work and the result — dropping a partial union only forgoes
 * the conjuncts it would have grown into.
 */
function unionOf(branches: Req[]): Req {
  let combos: string[][] = [[]];
  for (const branch of branches) {
    if (branch === null) return null;
    const grown: string[][] = [];
    for (const combo of combos) {
      for (const set of branch) grown.push(combo.concat(set));
    }
    const reduced = reduceConjunction(grown);
    if (!reduced) return null; // every union outgrew the width cap
    combos = reduced;
  }
  return combos;
}

/**
 * Consume a quantifier at `src[i]`, if any.
 *
 * `optional` means the quantified atom may be absent from a match, so it must
 * not contribute to a literal at all. `quantified` means the run has to be cut
 * even when the atom is mandatory, because repetition breaks contiguity.
 */
function readQuantifier(src: string, i: number): { next: number; quantified: boolean; optional: boolean } {
  const ch = src[i];
  if (ch === "?" || ch === "*") {
    let next = i + 1;
    if (src[next] === "?" || src[next] === "+") next += 1; // lazy / possessive-style suffix
    return { next, quantified: true, optional: true };
  }
  if (ch === "+") {
    let next = i + 1;
    if (src[next] === "?" || src[next] === "+") next += 1;
    return { next, quantified: true, optional: false };
  }
  if (ch === "{") {
    const m = /^\{(\d*)(,(\d*))?\}/.exec(src.slice(i));
    if (!m) return { next: i, quantified: false, optional: false }; // literal brace
    const min = m[1] === "" ? Number.NaN : Number(m[1]);
    let next = i + m[0].length;
    if (src[next] === "?" || src[next] === "+") next += 1;
    // An unparsable or zero minimum is treated as optional (conservative).
    return { next, quantified: true, optional: !Number.isFinite(min) || min < 1 };
  }
  return { next: i, quantified: false, optional: false };
}
/** Index just past the character class opened at `src[open]` (`[`). -1 if unbalanced. */
function skipClass(src: string, open: number): number {
  let i = open + 1;
  if (src[i] === "^") i += 1;
  for (; i < src.length; i += 1) {
    const ch = src[i];
    if (ch === "\\") {
      i += 1;
      continue;
    }
    if (ch === "]") return i + 1;
  }
  return -1;
}

/**
 * Consume the escape sequence starting at `src[i]` (the backslash).
 *
 * `literal` is the single character the escape denotes, or `null` when the
 * escape is an opaque atom (a class like `\d`, a zero-width assertion like `\b`,
 * a backreference, a code-point escape). Returns `null` when the extent of the
 * escape cannot be determined, which bails out the whole pattern rather than
 * guessing where its argument ends — a wrong guess would invent a literal that
 * is not actually required, which is the one failure mode that could lose a
 * detection.
 */
function readEscape(src: string, i: number): { next: number; literal: string | null } | null {
  const esc = src[i + 1];
  if (esc === undefined) return null;
  if (LITERAL_ESCAPES.has(esc)) return { next: i + 2, literal: esc };
  if (CONTROL_ESCAPES[esc] !== undefined) return { next: i + 2, literal: CONTROL_ESCAPES[esc] };
  if (OPAQUE_ESCAPES.has(esc)) return { next: i + 2, literal: null };
  if (esc === "0") return { next: i + 2, literal: null };
  if (esc >= "1" && esc <= "9") {
    let j = i + 2;
    while (j < src.length && src[j] >= "0" && src[j] <= "9") j += 1;
    return { next: j, literal: null }; // backreference or octal escape
  }
  if (esc === "x") {
    if (!/^[0-9a-f]{2}/i.test(src.slice(i + 2, i + 4))) return null;
    return { next: i + 4, literal: null };
  }
  if (esc === "c") {
    if (!/^[a-z]/i.test(src.slice(i + 2, i + 3))) return null;
    return { next: i + 3, literal: null };
  }
  if (esc === "u") {
    if (src[i + 2] === "{") {
      const close = src.indexOf("}", i + 3);
      if (close < 0) return null;
      return { next: close + 1, literal: null };
    }
    if (!/^[0-9a-f]{4}/i.test(src.slice(i + 2, i + 6))) return null;
    return { next: i + 6, literal: null };
  }
  if (esc === "p" || esc === "P") {
    if (src[i + 2] !== "{") return null;
    const close = src.indexOf("}", i + 3);
    if (close < 0) return null;
    return { next: close + 1, literal: null };
  }
  if (esc === "k") {
    if (src[i + 2] !== "<") return null;
    const close = src.indexOf(">", i + 3);
    if (close < 0) return null;
    return { next: close + 1, literal: null };
  }
  if (esc === "q") return null; // only meaningful in `v` mode, which never reaches here
  // Any other escaped character is Annex-B "identity escape" territory. Treat it
  // as opaque rather than as the character itself: sound, just less selective.
  return { next: i + 2, literal: null };
}
/**
 * Classify the group opening at `src[open]` and return the index of its first
 * inner character. Lookarounds are zero-width, so their contents are parsed for
 * position only and contribute no requirement. Modifier groups (`(?i:...)`) and
 * anything else unrecognised bail out.
 */
function parseGroupPrefix(src: string, open: number): { next: number; kind: "capture" | "look" } | null {
  if (src[open + 1] !== "?") return { next: open + 1, kind: "capture" };
  const marker = src[open + 2];
  if (marker === ":") return { next: open + 3, kind: "capture" };
  if (marker === "=" || marker === "!") return { next: open + 3, kind: "look" };
  if (marker === "<") {
    const after = src[open + 3];
    if (after === "=" || after === "!") return { next: open + 4, kind: "look" };
    const close = src.indexOf(">", open + 3);
    if (close < 0) return null;
    return { next: close + 1, kind: "capture" };
  }
  return null;
}

function parseAlternation(src: string, from: number, depth: number): { next: number; req: Req } | null {
  if (depth > MAX_DEPTH) return null;
  const branches: Req[] = [];
  let cursor = from;
  for (;;) {
    const sequence = parseSequence(src, cursor, depth);
    if (!sequence) return null;
    branches.push(sequence.req);
    cursor = sequence.next;
    if (src[cursor] === "|") {
      cursor += 1;
      continue;
    }
    break;
  }
  return { next: cursor, req: branches.length === 1 ? branches[0] : unionOf(branches) };
}
function parseSequence(src: string, from: number, depth: number): { next: number; req: Req } | null {
  const parts: string[][] = [];
  let current = "";
  let i = from;
  const flush = () => {
    if (current.length >= MIN_LITERAL_LENGTH && isAsciiString(current)) parts.push([current]);
    current = "";
  };

  while (i < src.length) {
    const ch = src[i];
    if (ch === "|" || ch === ")") break;

    if (ch === "\\") {
      const escape = readEscape(src, i);
      if (!escape) return null;
      const quantifier = readQuantifier(src, escape.next);
      if (escape.literal === null || quantifier.optional) {
        flush();
        i = quantifier.next;
        continue;
      }
      current += escape.literal;
      i = quantifier.next;
      if (quantifier.quantified) flush();
      continue;
    }

    if (ch === "[") {
      const end = skipClass(src, i);
      if (end < 0) return null;
      flush();
      i = readQuantifier(src, end).next;
      continue;
    }

    if (ch === "(") {
      const prefix = parseGroupPrefix(src, i);
      if (!prefix) return null;
      const inner = parseAlternation(src, prefix.next, depth + 1);
      if (!inner || src[inner.next] !== ")") return null;
      const quantifier = readQuantifier(src, inner.next + 1);
      flush();
      // A mandatory group requires its own disjunctions even when repeated; an
      // optional one and any lookaround contribute nothing.
      if (prefix.kind === "capture" && !quantifier.optional && inner.req) {
        for (const set of inner.req) parts.push(set);
      }
      i = quantifier.next;
      continue;
    }

    if (ch === "^" || ch === "$") {
      flush(); // zero-width: ends the run, consumes nothing
      i += 1;
      continue;
    }

    if (ch === ".") {
      flush();
      i = readQuantifier(src, i + 1).next;
      continue;
    }

    if (ch === "*" || ch === "+" || ch === "?") return null; // quantifier with no atom

    const quantifier = readQuantifier(src, i + 1);
    if (quantifier.optional) {
      flush();
      i = quantifier.next;
      continue;
    }
    current += ch;
    i = quantifier.next;
    if (quantifier.quantified) flush();
  }

  flush();
  // A sequence requires ALL of its parts, so every part is a necessary condition
  // on its own and the whole bag can be kept (bounded and ranked) rather than
  // collapsed to the single best one.
  return { next: i, req: reduceConjunction(parts) };
}
/**
 * Extract the disjunctions of which each must contribute at least one literal to
 * every match of `pattern`, or `null` when no such set can be proven from the
 * subset of syntax this extractor understands.
 */
export function extractRequiredLiteral(pattern: RegExp): RequiredLiteral | null {
  const flags = pattern.flags;
  // Sticky patterns interact with lastIndex in ways the caller's global clone
  // does not model, and `v` classes may nest — do not prefilter either.
  if (flags.includes("y") || flags.includes("v")) return null;
  const caseInsensitive = flags.includes("i");
  const src = pattern.source;

  const parsed = parseAlternation(src, 0, 0);
  // A short read means an unbalanced `)` or syntax outside the subset.
  if (!parsed || parsed.next !== src.length || !parsed.req) return null;

  // Lowercasing can collapse members or create new containments, so re-reduce.
  const lowered = caseInsensitive
    ? parsed.req.map((set) => set.map((literal) => literal.toLowerCase()))
    : parsed.req;
  const sets = reduceConjunction(lowered);
  if (!sets) return null;
  const [primary, ...rest] = sets;
  return {
    literals: primary,
    caseInsensitive,
    probes: literalProbes(primary),
    alsoRequired: rest.length
      ? rest.map((set) => ({ literals: set, probes: literalProbes(set) }))
      : undefined,
  };
}

// ---------------------------------------------------------------------------
// Runtime plumbing
// ---------------------------------------------------------------------------

let disabled = process.env.SOTERAI_DISABLE_LITERAL_PREFILTER === "1";
let verify = process.env.SOTERAI_PREFILTER_VERIFY === "1";

/** True when the prefilter is off and the previous execution path is restored. */
export function isPrefilterDisabled(): boolean {
  return disabled;
}

/** True when every skip is re-checked by actually running the regex. */
export function isPrefilterVerify(): boolean {
  return verify;
}

/** Test-only: flip the flags in-process so one run can compare both paths. */
export function setPrefilterFlagsForTests(next: { disabled?: boolean; verify?: boolean }): void {
  if (next.disabled !== undefined) disabled = next.disabled;
  if (next.verify !== undefined) verify = next.verify;
}

/** Per-RegExp memo. `false` means "already tried, not prefilterable". */
const LITERAL_CACHE = new WeakMap<RegExp, RequiredLiteral | false>();

export function requiredLiteralFor(pattern: RegExp): RequiredLiteral | null {
  const cached = LITERAL_CACHE.get(pattern);
  if (cached !== undefined) return cached === false ? null : cached;
  let extracted: RequiredLiteral | null = null;
  try {
    extracted = extractRequiredLiteral(pattern);
  } catch {
    extracted = null; // never let the optimiser break detection
  }
  LITERAL_CACHE.set(pattern, extracted ?? false);
  return extracted;
}
export interface HaystackMeta {
  /** Pure ASCII — required for the prefilter to be applicable at all. */
  isAscii: boolean;
  /** ASCII lowercase copy, built only when a case-insensitive rule needs it. */
  lower: string | null;
  /**
   * Case-folded 3-gram index: `undefined` until first use, `null` for a haystack
   * too short to be worth indexing. A lossy fingerprint, not a copy, and it is
   * released with the rest of the metadata when the scan ends.
   */
  grams?: Uint32Array | null;
}

const META_BY_VARIANT = new WeakMap<object, HaystackMeta>();
let lastMetaText: string | null = null;
let lastMeta: HaystackMeta | null = null;

/**
 * Ascii/lowercase metadata for one haystack, memoised twice: on the variant
 * object (shared by every detector inside one analyzeText scope) and on the
 * most recent string identity (the raw-text-only path). Holds no copy of a
 * prompt beyond the scan that is running.
 */
export function haystackMeta(text: string, owner?: object): HaystackMeta {
  if (owner) {
    const hit = META_BY_VARIANT.get(owner);
    if (hit) return hit;
  }
  if (lastMetaText === text && lastMeta) {
    if (owner) META_BY_VARIANT.set(owner, lastMeta);
    return lastMeta;
  }
  const meta: HaystackMeta = { isAscii: isAsciiString(text), lower: null };
  lastMetaText = text;
  lastMeta = meta;
  if (owner) META_BY_VARIANT.set(owner, meta);
  return meta;
}

/** Release the one-entry memo (used by tests to prove nothing is retained). */
export function resetHaystackMemoForTests(): void {
  lastMetaText = null;
  lastMeta = null;
}

/**
 * True when the rule provably cannot match `text`: one of the disjunctions it
 * must satisfy has no member present.
 *
 * Applies only to pure-ASCII haystacks, so no Unicode case-folding equivalence
 * (U+017F -> s, U+212A -> k) can make an absent ASCII literal matchable.
 */
export function cannotMatch(text: string, meta: HaystackMeta, required: RequiredLiteral): boolean {
  if (!meta.isAscii) return false;
  let haystack: string;
  if (required.caseInsensitive) {
    if (meta.lower === null) meta.lower = text.toLowerCase();
    haystack = meta.lower;
  } else {
    haystack = text;
  }
  if (meta.grams === undefined) {
    meta.grams = text.length >= GRAM_MIN_TEXT ? buildGramIndex(text) : null;
  }
  const grams = meta.grams;
  if (setIsAbsent(haystack, grams, required.literals, required.probes)) return true;
  // The most selective set did not settle it. Every other set is necessary too,
  // and any one of them being absent rules the rule out just as conclusively.
  const also = required.alsoRequired;
  if (also !== undefined) {
    for (let i = 0; i < also.length; i += 1) {
      if (setIsAbsent(haystack, grams, also[i].literals, also[i].probes)) return true;
    }
  }
  return false;
}

/**
 * True when no member of one required disjunction occurs in `haystack`.
 *
 * `false` means "not proven absent", which covers both "a member is present" and
 * "proving it would cost more than the regex". The caller only skips on `true`,
 * so declining is always sound.
 */
function setIsAbsent(
  haystack: string,
  grams: Uint32Array | null,
  literals: string[],
  probes: Int32Array,
): boolean {
  // Without an index every literal costs a substring search, but the haystack is
  // then shorter than the index threshold, so all of them together are still
  // cheaper than one regex pass — up to a point. Past that the set is refused
  // instead of part-searched, which keeps the small-payload path exactly as
  // cheap as it was before wide sets became extractable.
  if (grams === null && literals.length > MAX_ALTERNATIVES_NO_INDEX) return false;
  const limit = grams === null ? literals.length : MAX_FALLBACK_SEARCHES;
  let searches = 0;
  for (let i = 0; i < literals.length; i += 1) {
    if (grams !== null) {
      // A clear bit proves the 3-gram is absent, so the literal is absent too.
      const first = probes[i * 2];
      if ((grams[first >>> 5] & (1 << (first & 31))) === 0) continue;
      const last = probes[i * 2 + 1];
      if ((grams[last >>> 5] & (1 << (last & 31))) === 0) continue;
    }
    // A set bit proves nothing: the substring search decides.
    searches += 1;
    if (searches > limit) return false; // too costly to prove — let the regex run
    if (haystack.includes(literals[i])) return false;
  }
  return true;
}
// ---------------------------------------------------------------------------
// Opt-in accounting (audit scripts only)
// ---------------------------------------------------------------------------

/** How much of the rule x variant scan matrix the prefilter actually removes. */
export interface PrefilterStats {
  /** `detectPatterns` invocations observed. */
  calls: number;
  /** Rule objects visited. */
  rules: number;
  /** Rules for which a required disjunction could be proven. */
  prefilterable: number;
  /** rule x variant pairs that would have been scanned without the prefilter. */
  scans: number;
  /** Of those, the ones proven impossible and skipped. */
  skipped: number;
}

let stats: PrefilterStats | null = null;

/** Off by default: when null, the hot path does no accounting at all. */
export function isPrefilterStatsEnabled(): boolean {
  return stats !== null;
}

export function startPrefilterStats(): void {
  stats = { calls: 0, rules: 0, prefilterable: 0, scans: 0, skipped: 0 };
}

export function stopPrefilterStats(): PrefilterStats | null {
  const collected = stats;
  stats = null;
  return collected;
}

/** Called once per `detectPatterns` invocation, never per scan. */
export function recordPrefilterStats(
  rules: number,
  prefilterable: number,
  scans: number,
  skipped: number,
): void {
  if (!stats) return;
  stats.calls += 1;
  stats.rules += rules;
  stats.prefilterable += prefilterable;
  stats.scans += scans;
  stats.skipped += skipped;
}

// ---------------------------------------------------------------------------
// Conjunction prefilter (AND-of-cues detectors)
// ---------------------------------------------------------------------------

/**
 * Paranoid check for SOTERAI_PREFILTER_VERIFY=1: prove that a skipped scan
 * really had no match. Throws loudly rather than silently losing a finding, so
 * the differential test suite fails on any unsound skip.
 */
export function assertRequiredLiteralAbsent(
  text: string,
  pattern: RegExp,
  label: string,
  required: RequiredLiteral,
): void {
  const probe = new RegExp(pattern.source, pattern.flags.replace(/[gy]/g, ""));
  if (probe.test(text)) {
    const sets = [required.literals, ...(required.alsoRequired ?? []).map((set) => set.literals)];
    throw new Error(
      `literal prefilter unsound: rule "${label}" would have matched despite missing every literal of ` +
        `one of its required sets ${JSON.stringify(sets)} (caseInsensitive=${required.caseInsensitive})`,
    );
  }
}

/**
 * True when a rule that requires EVERY pattern in `patterns` to match provably
 * cannot fire, because one of them requires a literal the haystack lacks.
 *
 * `detectPatterns` prefilters one pattern at a time. The generalized-intent tier
 * instead ANDs two or three broad cue alternations together, and there a single
 * provably-absent cue rules out the whole rule — including the cues the
 * extractor could prove nothing about, and including the rule's suppressors,
 * which only matter when the rule would otherwise fire. That makes the
 * conjunction the cheaper place to reject: one O(1) index probe can remove
 * several hundred-branch alternation scans.
 *
 * Soundness is exactly `cannotMatch`'s argument plus one step: if cue G cannot
 * match the haystack, no conjunction containing G can match it either.
 */
export function conjunctionCannotMatch(
  text: string,
  meta: HaystackMeta,
  patterns: RegExp[],
  label: string,
): boolean {
  if (disabled) {
    if (stats) recordRulePrefilterStats(0, 0);
    return false;
  }
  let prefilterable = 0;
  let skipped = 0;
  for (let i = 0; i < patterns.length; i += 1) {
    const required = requiredLiteralFor(patterns[i]);
    if (required === null) continue;
    prefilterable = 1;
    if (!cannotMatch(text, meta, required)) continue;
    if (verify) assertRequiredLiteralAbsent(text, patterns[i], label, required);
    skipped = 1;
    break;
  }
  if (stats) recordRulePrefilterStats(prefilterable, skipped);
  return skipped === 1;
}

/**
 * True when one standalone pattern provably cannot match `text`.
 *
 * `detectPatterns` inlines this check for the rule tables it owns, hoisting the
 * per-rule extraction out of its variant loop. Detectors that keep their own
 * scan loop — because a rule is a disjunction of long chained alternations, or
 * because the finding it builds is not rule-table shaped — need the same
 * primitive with the kill switch, the verifier and the accounting attached in
 * exactly one place instead of copied per detector.
 */
export function patternCannotMatch(
  text: string,
  meta: HaystackMeta,
  pattern: RegExp,
  label: string,
): boolean {
  if (disabled) {
    if (stats) recordRulePrefilterStats(0, 0);
    return false;
  }
  const required = requiredLiteralFor(pattern);
  if (required === null) {
    if (stats) recordRulePrefilterStats(0, 0);
    return false;
  }
  if (!cannotMatch(text, meta, required)) {
    if (stats) recordRulePrefilterStats(1, 0);
    return false;
  }
  if (verify) assertRequiredLiteralAbsent(text, pattern, label, required);
  if (stats) recordRulePrefilterStats(1, 1);
  return true;
}

/**
 * Accounting for one rule x haystack pair outside `detectPatterns`. Kept
 * separate from `recordPrefilterStats` so `calls` keeps meaning "detectPatterns
 * invocations", while rules/prefilterable/scans/skipped stay comparable across
 * every call site.
 */
function recordRulePrefilterStats(prefilterable: number, skipped: number): void {
  if (!stats) return;
  stats.rules += 1;
  stats.prefilterable += prefilterable;
  stats.scans += 1;
  stats.skipped += skipped;
}
