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
  "\\u2060-\\u2064", // word joiner, function application, invisible times/separator/plus
  "\\u2066-\\u2069", // bidi isolates
  "\\u061C",        // arabic letter mark (bidi)
  "\\uFEFF",        // BOM / zero-width no-break space
  "\\u180E",        // mongolian vowel separator
  "\\u034F",        // combining grapheme joiner
  "\\u115F\\u1160", // hangul choseong / jungseong fillers (render blank, used as spacers)
  "\\u17B4\\u17B5", // khmer inherent vowels (invisible)
  "\\u3164",        // hangul filler
  "\\uFFA0",        // halfwidth hangul filler
  "\\uFFF9-\\uFFFB", // interlinear annotation anchors
  "\\u20D0-\\u20FF", // combining marks (enclosing, strike-through etc.)
  "\\uFE00-\\uFE0F", // variation selectors
  "\\u{E0100}-\\u{E01EF}", // variation selectors supplement
  "\\u{E0000}-\\u{E007F}", // TAGS block — "ASCII smuggling": a full instruction hidden as
                           // codepoints that render as nothing at all. This was the whole gap.
  "\\u00AD",        // soft hyphen
  "\\u2000-\\u200A", // en/em spaces and friends
  "\\u202F\\u205F\\u3000", // narrow no-break, medium math, ideographic space
];

// `u` flag: required for the astral Tags/variation-selector ranges above, and it makes the class
// behave predictably over surrogate pairs. `g` is for `stripInvisible`'s `.replace()`; membership
// tests use the non-global twin below, because a `g` regex's `.test()` advances `lastIndex` and
// would then miss a match near the start of the *next* string it is handed.
const STRIP_RE = new RegExp("[" + STRIP_CLASSES.join("") + "]", "gu");
const STRIP_TEST_RE = new RegExp("[" + STRIP_CLASSES.join("") + "]", "u");

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
const HOMOGLYPH_TEST_RE = new RegExp("[" + HOMOGLYPH_KEYS.join("") + "]");

// The printable TAGS block (U+E0020..U+E007E) is a byte-for-byte mirror of ASCII 0x20..0x7E, which
// is what makes "ASCII smuggling" work: an attacker writes a whole instruction in tag codepoints,
// it renders as absolutely nothing, and the model reads it as plain text. `stripInvisible` removes
// these (so the *clean* view is benign), but detection also has to SEE the payload — so this maps
// them back to the ASCII they mirror, and the decoded view is scanned like any other.
const TAG_DECODE_RE = /[\u{E0020}-\u{E007E}]/gu;
const TAG_TEST_RE = /[\u{E0020}-\u{E007E}]/u;
function decodeTags(input: string): string {
  if (!TAG_TEST_RE.test(input)) return input;
  return input.replace(TAG_DECODE_RE, (ch) => String.fromCharCode((ch.codePointAt(0) as number) - 0xe0000));
}

// Cheap gate: does the text contain ANY tag codepoint or variation selector at all?
const SMUGGLE_TEST_RE = new RegExp("[\u{E0000}-\u{E007F}\uFE00-\uFE0F\u{E0100}-\u{E01EF}]", "u");
const isTagCp = (cp: number) => cp >= 0xe0000 && cp <= 0xe007f;
const isVariationSelectorCp = (cp: number) =>
  (cp >= 0xfe00 && cp <= 0xfe0f) || (cp >= 0xe0100 && cp <= 0xe01ef);

/**
 * Remove an *invisible smuggled payload* from text that is about to leave the user's machine (a
 * paste being inserted, a message being sent) while leaving every VISIBLE character byte-identical.
 * Detection (above) SEES the payload so the user is told; this NEUTRALIZES it so an attack the user
 * could never see is never delivered — and because it only ever touches invisible carriers, the
 * caller can apply it unconditionally: with nothing smuggled, `clean === text` and `removed === 0`.
 *
 * Two carriers are stripped; two legitimate look-alikes are deliberately preserved:
 *   - TAG codepoints (U+E0000..U+E007F) that are NOT part of a subdivision-flag emoji. A real flag
 *     is BLACK FLAG (U+1F3F4) + 2..6 tag letters + the CANCEL TAG terminator (U+E007F); the England
 *     and Scotland flags are exactly this. Anything else built from tag codepoints is "ASCII
 *     smuggling" — a whole instruction that renders as nothing — and is removed.
 *   - Runs of two or more consecutive variation selectors (U+FE00..FE0F, U+E0100..E01EF), which is
 *     byte smuggling. A SINGLE selector is a legitimate emoji presentation (one U+FE0F riding on an emoji) and is kept.
 */
export function stripSmuggledPayload(text: string): { clean: string; removed: number } {
  if (!text || !SMUGGLE_TEST_RE.test(text)) return { clean: text, removed: 0 };
  const cps = Array.from(text); // iterate by codepoint so astral tag/VS chars are one unit each
  const out: string[] = [];
  let removed = 0;
  for (let i = 0; i < cps.length; i++) {
    const ch = cps[i];
    const cp = ch.codePointAt(0) as number;

    // Legitimate subdivision-flag emoji: keep BLACK FLAG + its terminated tag-letter sequence.
    if (cp === 0x1f3f4) {
      let j = i + 1;
      const seq: string[] = [];
      let terminated = false;
      while (j < cps.length) {
        const p = cps[j].codePointAt(0) as number;
        if (p === 0xe007f) { seq.push(cps[j]); j++; terminated = true; break; } // CANCEL TAG ends it
        if (p >= 0xe0020 && p <= 0xe007e) { seq.push(cps[j]); j++; continue; }
        break;
      }
      out.push(ch);
      if (terminated && seq.length <= 7) out.push(...seq); // real flag (longest code is 5 letters)
      else removed += seq.length;                          // 🏴 + tag junk → strip the tag chars only
      i = j - 1;
      continue;
    }

    // Tag codepoints not attached to a flag base → smuggled ASCII.
    if (isTagCp(cp)) { removed++; continue; }

    // Variation selectors: keep an isolated one, strip a run of two or more (byte smuggling).
    if (isVariationSelectorCp(cp)) {
      let j = i;
      while (j < cps.length && isVariationSelectorCp(cps[j].codePointAt(0) as number)) j++;
      const runLen = j - i;
      if (runLen >= 2) { removed += runLen; i = j - 1; continue; }
      out.push(ch);
      continue;
    }

    out.push(ch);
  }
  return removed > 0 ? { clean: out.join(""), removed } : { clean: text, removed: 0 };
}

/** Leetspeak substitution seen in jailbreak / credential-leak prompts. */
const LEET_MAP: Record<string, string> = {
  "0": "o", "1": "i", "2": "z", "3": "e", "4": "a",
  "5": "s", "6": "g", "7": "t", "8": "b", "9": "g",
  "@": "a", "!": "i", "$": "s", "|": "l", "+": "t",
};
const LEET_RE = /[A-Za-z0-9@!$|+]{3,}/g;
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

  // ASCII smuggling: decode the TAGS mirror of ASCII back to readable text FIRST, before
  // `stripInvisible` (correctly) erases those codepoints — otherwise the smuggled instruction is
  // removed from every view and no detector ever sees it. This view carries the revealed payload.
  const detagged = decodeTags(text);
  if (detagged !== text) {
    const revealed = stripInvisible(detagged.normalize("NFKC"));
    if (revealed.trim()) views.add(revealed);
  }

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
 *
 * Uses the NON-global twins on purpose: `STRIP_RE`/`HOMOGLYPH_RE` carry the `g` flag for
 * `.replace()`, and `.test()` on a `g` regex advances `lastIndex`, so two calls in a row against
 * different strings would leave the second one starting its search partway in — and miss an
 * invisible character sitting before that offset. Measured: an obfuscated prompt was scanned
 * clean on every other call, purely from the length of the prompt scanned just before it.
 */
export function looksObfuscated(text: string): boolean {
  return STRIP_TEST_RE.test(text)
    || HOMOGLYPH_TEST_RE.test(text)
    || /[！-～]/.test(text)
    || /\b[A-Za-z]*[0-9@!$|+]+[A-Za-z][A-Za-z0-9@!$|+]*\b/.test(text);
}
