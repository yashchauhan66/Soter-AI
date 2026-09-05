import { detectPatterns, type PatternRule } from "./helpers";

const rules: PatternRule[] = [
  {
    pattern:
      /[\u202A-\u202E\u2066-\u2069\u200B-\u200F\uFEFF\u034F\u061C\u180B-\u180F]/,
    label: "Invisible Unicode smuggling",
    message: "Invisible or bidirectional Unicode control characters were detected in untrusted input.",
    severity: "MEDIUM",
    score: 35,
  },
  {
    pattern:
      /(?:unicode|homoglyph|confusable|zero-width|bidi|rtl override|variation selector|tag character)[\s\S]{0,160}(?:bypass|hide|smuggle|invisible|instruction|prompt)/i,
    label: "Advanced Unicode smuggling",
    message: "The request indicates an attempt to hide or smuggle instructions with Unicode tricks.",
    severity: "HIGH",
    score: 45,
  },
  // ── Word-level spelling channels ──────────────────────────────────────────
  // helpers.ts decodes both of these back to plaintext and re-scans it, so a
  // real payload also lights up the injection rules. These two rules cover the
  // channel itself, which is evidence even when the decode is ambiguous: a
  // prompt does not accidentally contain six consecutive NATO code words or four
  // consecutive pig-latin words.
  {
    pattern:
      /(?:\b(?:alfa|alpha|bravo|charlie|delta|echo|foxtrot|golf|hotel|india|juliett?|kilo|lima|mike|november|oscar|papa|quebec|romeo|sierra|tango|uniform|victor|whisk(?:e)?y|x-?ray|yankee|zulu)\b[^A-Za-z]{0,4}){6,}/i,
    label: "Phonetic-alphabet spelling channel",
    message: "Text is spelled out letter-by-letter with the NATO phonetic alphabet, an obfuscation channel.",
    severity: "MEDIUM",
    score: 40,
  },
  {
    pattern: /(?:\b[a-z]{3,}(?:way|yay|ay)\b[^A-Za-z]{0,4}){4,}/i,
    label: "Pig-latin obfuscation channel",
    message: "A run of pig-latin words was detected, which is used to slip keywords past filters.",
    severity: "MEDIUM",
    score: 40,
  },
  // ── Covert reply channels ─────────────────────────────────────────────────
  // Asking for protected content to be encoded into the SHAPE of an allowed
  // reply (acrostic, first letters, whitespace, capitalisation) is exfiltration
  // that no output scanner keyed on the content itself will see.
  {
    pattern:
      /\b(?:hide|conceal|embed|encode|smuggle|bury|slip|place|put)\b[\s\S]{0,110}\b(?:system\s+prompt|instructions?|rules?|guidelines?|api\s+keys?|credentials?|secrets?|password|conversation|context|training\s+data)\b[\s\S]{0,110}\b(?:first\s+letters?|first\s+letter\s+of\s+each|acrostic|initials?|every\s+(?:nth|\d+(?:st|nd|rd|th)?)\s+(?:word|letter|character)|capitali[sz]ation|whitespace|trailing\s+spaces?|punctuation|line\s+breaks?|emoji|zero-?width)\b/i,
    label: "Covert reply-channel exfiltration",
    message: "Requests protected content be hidden in the structure of an otherwise normal reply.",
    severity: "HIGH",
    score: 62,
  },
  {
    pattern:
      /\b(?:answer|reply|respond)\b[\s\S]{0,60}\bnormally\b[\s\S]{0,60}\bbut\b[\s\S]{0,110}\b(?:hide|conceal|encode|embed|smuggle)\b[\s\S]{0,110}\b(?:so\s+(?:only\s+)?i\s+can\s+(?:recover|read|decode|see)|only\s+i\s+(?:can|will)|without\s+(?:anyone|the\s+user|them)\s+(?:noticing|seeing|knowing))\b/i,
    label: "Steganographic reply request",
    message: "Requests a normal-looking reply that secretly carries protected data.",
    severity: "HIGH",
    score: 62,
  },
];

export function advancedUnicodeSmugglingDetector(text: string) {
  return detectPatterns(text, "ADVANCED_SMUGGLING", rules);
}

