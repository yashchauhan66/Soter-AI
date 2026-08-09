/**
 * Anti-Evasion Normalizer (Gap closer).
 *
 * Attackers hide malicious instructions and secrets behind Unicode tricks so a
 * naive scanner never "sees" the dangerous words. We normalize before detection:
 *   - Zero-Width / invisible characters
 *   - Combining, enclosing marks, bidi controls
 *   - Cyrillic/Greek homoglyphs -> ASCII
 *   - Full-width ASCII -> ASCII
 *   - Leetspeak -> letters
 *   - Base64-wrapped payloads (decoded candidate views)
 *   - Caesar / ROT13
 *
 * All invisible / control codepoints are expressed with \uXXXX escapes so the
 * source file stays ASCII-safe and never breaks the JS regex literal parser.
 */

/** Strip helpers: build regexes from escaped codepoints (ASCII-safe source). */
const STRIP_CLASSES: string[] = [
  "\\u200B-\\u200F", // zero-width space, ZWNJ, ZWJ, LRM, RLM
  "\\u202A-\\u202E", // bidi embedding / override controls
  "\\u2066-\\u2069", // bidi isolates
  "\\uFEFF",        // BOM / zero-width no-break space
  "\\u180E",        // mongolian vowel separator
  "\\u034F",        // combining grapheme joiner
  "\\u20D0-\\u20FF", // combining marks (enclosing, strike-through etc.)
  "\\uFE00-\\uFE0F", // variation selectors
  "\\u00AD",        // soft hyphen
  "\\u2000-\\u200A", // en/em spaces and friends
  "\\u202F\\u205F\\u3000", // narrow no-break, medium math, ideographic space
];

const STRIP_RE = new RegExp("[" + STRIP_CLASSES.join("") + "]", "g");

/** Strip invisible unicode + bidi overrides. Safe to call on any string. */
export function stripInvisible(input: string): string {
  return input.replace(STRIP_RE, "");
}

/** Common Cyrillic/Greek lookalike letters -> ASCII (keyed by escaped codepoints). */
const HOMOGLYPH_MAP: Record<string, string> = {
  // Cyrillic lowercase
  "а": "a", "е": "e", "о": "o", "р": "p",
  "с": "c", "у": "y", "х": "x", "і": "i",
  "ј": "j", "ѕ": "s", "һ": "h",
  "ԁ": "d", "ԍ": "g", "ԛ": "q",
  // Cyrillic uppercase
  "А": "A", "В": "B", "Е": "E", "К": "K",
  "М": "M", "Н": "H", "О": "O", "Р": "P",
  "С": "C", "Т": "T", "Х": "X", "І": "I",
  "Ј": "J", "Ѕ": "S",
  // Greek
  "α": "a", "ο": "o", "ρ": "p", "τ": "t",
  "υ": "u", "χ": "x", "ι": "i", "ν": "v",
};

const HOMOGLYPH_KEYS = Object.keys(HOMOGLYPH_MAP);
const HOMOGLYPH_RE = new RegExp("[" + HOMOGLYPH_KEYS.join("") + "]", "g");

/** Leetspeak substitution seen in jailbreak / credential-leak prompts. */
const LEET_MAP: Record<string, string> = {
  "0": "o", "1": "i", "2": "z", "3": "e", "4": "a",
  "5": "s", "6": "g", "7": "t", "8": "b", "9": "g",
  "@": "a", "!": "i", "$": "s", "|": "l", "+": "t",
};
const LEET_RE = /[A-Za-z0-9@!$|+]{4,}/g;
const LEET_CHAR_RE = /[0-9@!$|+]/g;

/**
 * Produce candidate views for detection. We run detectors against each view and
 * merge the worst (highest-risk) result upstream. Multiple views avoid wrongly
 * rewriting a harmless token — leet-decode is offered as an extra view, not a
 * replacement, so a normal "MFA 101" prompt never gets flipped.
 */
export function normalizeForDetection(text: string): string[] {
  const views = new Set<string>();
  if (!text) return [];

  // Structural normalization: NFKC folds compatibility + full-width forms.
  const nfkc = stripInvisible(text.normalize("NFKC"));
  if (nfkc.trim()) views.add(nfkc);

  // Homoglyph-folded view. Regex's global replace only touches the mapped keys.
  let folded = nfkc.replace(HOMOGLYPH_RE, (ch) => HOMOGLYPH_MAP[ch] ?? ch);
  folded = foldFullwidth(folded);

  views.add(folded);
  views.add(collapseRepeats(folded));

  // Leet-decode view.
  const leet = deLeet(folded);
  if (leet !== folded) views.add(leet);
  views.add(collapseRepeats(leet));

  // Base64-embedded payloads.
  for (const decoded of extractBase64(text)) views.add(decoded);

  // ROT13 (most common Caesar obfuscation in jailbreak prompts).
  views.add(rot13(folded));

  return Array.from(views).filter((v) => v.trim().length > 0);
}

/** Fold full-width ASCII (U+FF01..FF5E) back to ASCII. */
function foldFullwidth(input: string): string {
  return input.replace(/[！-～]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0xfee0),
  );
}

/** Collapse 3+ consecutive identical chars ("ignnnnore" -> "ignore"). */
function collapseRepeats(input: string): string {
  return input.replace(/(.)\1{2,}/gi, "$1");
}

/** Decode leetspeak only inside mixed alpha+symbol words (keeps pure tokens). */
function deLeet(input: string): string {
  return input.replace(LEET_RE, (word) => {
    if (!/[A-Za-z]/.test(word) || !/[0-9@!$|+]/.test(word)) return word;
    return word.replace(LEET_CHAR_RE, (ch) => LEET_MAP[ch] ?? ch);
  });
}

/** Decode obvious base64 blobs into candidate views (printable-only, capped). */
function extractBase64(text: string): string[] {
  const out: string[] = [];
  const re = /\b[A-Za-z0-9+/]{24,}={0,2}\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null && out.length < 4) {
    try {
      const raw = decodeBase64(m[0]);
      const printable = raw.replace(/[^\x20-\x7E]/g, "").length;
      if (raw.length > 0 && printable / raw.length > 0.75 && raw.trim()) out.push(raw);
    } catch {
      /* not valid base64 — skip */
    }
  }
  return out;
}

/** Decode base64 to latin1 text across browser (atob) and Node (Buffer). */
function decodeBase64(input: string): string {
  if (typeof atob === "function") return atob(input);
  // Node / worker fallback without a hard Buffer type dependency.
  const Buf = (globalThis as { Buffer?: { from(s: string, enc: string): { toString(enc: string): string } } }).Buffer;
  if (Buf) return Buf.from(input, "base64").toString("latin1");
  throw new Error("no base64 decoder available");
}

/** ROT13 (letters only). */
function rot13(input: string): string {
  return input.replace(/[a-z]/gi, (ch) => {
    const base = ch >= "a" && ch <= "z" ? 97 : 65;
    return String.fromCharCode(((ch.charCodeAt(0) - base + 13) % 26) + base);
  });
}

/**
 * Cheap pre-check so the (relatively expensive) multi-view normalization only runs
 * when there is a realistic chance of obfuscation. Keeps the hot path fast.
 */
export function looksObfuscated(text: string): boolean {
  return STRIP_RE.test(text)
    || HOMOGLYPH_RE.test(text)
    || /[！-～]/.test(text)
    || /\b[A-Za-z]*[0-9@!$|+]+[A-Za-z][A-Za-z0-9@!$|+]*\b/.test(text);
}
