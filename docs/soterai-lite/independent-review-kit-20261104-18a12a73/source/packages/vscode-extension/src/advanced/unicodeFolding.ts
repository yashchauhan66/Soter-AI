/**
 * Gap B — deterministic, obfuscation-resistant text folding.
 *
 * PromptInjectionLiteDetector documents zero-width interruption, letter-spacing,
 * and homoglyph substitution as known regex bypasses. This module folds each of
 * those evasions back to plain text so the SAME guard-core detectors catch them,
 * with no model download and no cloud call.
 *
 * Code points are declared numerically rather than as escape sequences so no
 * invisible character ever appears literally in source, where it would be
 * unreviewable in a diff.
 */

/** Zero-width, bidi-override, soft-hyphen, BOM and Mongolian vowel separator. */
const INVISIBLE_RANGES: Array<[number, number]> = [
    [0x200b, 0x200f], // zero-width space .. RTL mark
    [0x202a, 0x202e], // bidi embedding / override
    [0x2060, 0x2064], // word joiner .. invisible plus
    [0x00ad, 0x00ad], // soft hyphen
    [0xfeff, 0xfeff], // BOM / zero-width no-break space
    [0x180e, 0x180e], // Mongolian vowel separator
];

/** Combining marks used to visually corrupt a keyword without changing letters. */
const COMBINING_RANGES: Array<[number, number]> = [
    [0x0300, 0x036f],
    [0x1ab0, 0x1aff],
    [0x20d0, 0x20f0],
];

/** Greek + Cyrillic blocks — the source of the common Latin homoglyphs. */
const CONFUSABLE_RANGES: Array<[number, number]> = [
    [0x0370, 0x03ff],
    [0x0400, 0x04ff],
];

function classFrom(ranges: Array<[number, number]>): RegExp {
    const body = ranges
        .map(([from, to]) => (from === to ? String.fromCharCode(from) : `${String.fromCharCode(from)}-${String.fromCharCode(to)}`))
        .join("");
    return new RegExp(`[${body}]`, "g");
}

export const INVISIBLE_CHARS = classFrom(INVISIBLE_RANGES);
export const COMBINING_MARKS = classFrom(COMBINING_RANGES);
export const CONFUSABLE_SCRIPTS = classFrom(CONFUSABLE_RANGES);

/** Leetspeak substitutions, applied only when folding for detection. */
const LEET: Record<string, string> = {
    "0": "o",
    "1": "i",
    "3": "e",
    "4": "a",
    "5": "s",
    "7": "t",
    "8": "b",
    "@": "a",
    $: "s",
};
const LEET_CHARS = /[0134578@$]/g;

/**
 * Cyrillic/Greek lookalikes mapped to their Latin twin. These characters are
 * visible, so they stay literal here — that is exactly what makes the mapping
 * reviewable.
 */
const HOMOGLYPH: Record<string, string> = {
    "а": "a", "е": "e", "о": "o", "р": "p", "с": "c", "х": "x",
    "у": "y", "і": "i", "ј": "j", "һ": "h", "ѕ": "s", "ӏ": "l",
    "А": "A", "Е": "E", "О": "O", "Р": "P", "С": "C", "Х": "X",
    "В": "B", "Н": "H", "К": "K", "М": "M", "Т": "T",
    "Β": "B", "Η": "H", "Κ": "K", "Μ": "M", "Ν": "N", "Ρ": "P",
    "Τ": "T", "Ζ": "Z", "Ι": "I", "Ο": "O",
    "ο": "o", "α": "a", "ι": "i", "ν": "v", "ρ": "p", "τ": "t",
};

/** Strip invisible unicode, normalize compatibility forms, fold homoglyphs. */
export function foldUnicode(text: string): string {
    const stripped = text.replace(INVISIBLE_CHARS, "").normalize("NFKC").replace(COMBINING_MARKS, "");
    return stripped.replace(CONFUSABLE_SCRIPTS, (c) => HOMOGLYPH[c] ?? c);
}

/** Fold unicode, then decode leetspeak so "1gn0r3" reads as "ignore". */
export function deobfuscate(text: string): string {
    return foldUnicode(text).replace(LEET_CHARS, (c) => LEET[c] ?? c);
}

/** Collapse "i g n o r e   a l l" style letter-spacing back into words. */
export function collapseSpacedLetters(text: string): string {
    return foldUnicode(text).replace(
        /(?:\b[A-Za-z]\b[ \t.\-_*]{1,3}){3,}[A-Za-z]\b/g,
        (run) => run.replace(/[ \t.\-_*]+/g, ""),
    );
}

/**
 * Decode base64 blobs that turn out to hold readable text, so instructions
 * smuggled as an encoded payload are scanned as plain text. Blobs that decode
 * to binary (real keys, hashes, images) are dropped.
 */
export function decodeBase64Blobs(text: string, limit = 5): string[] {
    const out: string[] = [];
    const re = /\b[A-Za-z0-9+/]{24,}={0,2}\b/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
        if (out.length >= limit) break;
        try {
            const decoded = Buffer.from(m[0], "base64").toString("utf8");
            if (decoded.length < 8) continue;
            const printable = (decoded.match(/[ -~\s]/g) ?? []).length;
            if (printable / decoded.length > 0.85) out.push(decoded);
        } catch {
            /* not valid base64 — ignore */
        }
    }
    return out;
}

/** Count invisible characters — used for scoring, not folding. */
export function countInvisible(text: string): number {
    return (text.match(INVISIBLE_CHARS) ?? []).length;
}

/** True when Latin text is mixed with Greek/Cyrillic lookalikes. */
export function hasMixedScript(text: string): boolean {
    CONFUSABLE_SCRIPTS.lastIndex = 0;
    return /[a-zA-Z]/.test(text) && CONFUSABLE_SCRIPTS.test(text);
}

/** Ratio of leetspeak characters to letters — high values signal substitution. */
export function leetRatio(text: string): number {
    const letters = (text.match(/[a-z]/gi) ?? []).length || 1;
    return (text.match(LEET_CHARS) ?? []).length / letters;
}

/**
 * Every normalized view of the text worth re-scanning. Each variant is scanned
 * independently by the caller and the findings are merged.
 */
export function obfuscationVariants(text: string): Array<{ name: string; text: string }> {
    const variants: Array<{ name: string; text: string }> = [{ name: "raw", text }];
    const push = (name: string, value: string) => {
        if (value && value !== text && !variants.some((v) => v.text === value)) variants.push({ name, text: value });
    };
    push("unicode-folded", foldUnicode(text));
    push("leet-decoded", deobfuscate(text));
    push("spacing-collapsed", collapseSpacedLetters(text));
    push("reversed", [...foldUnicode(text)].reverse().join(""));
    for (const decoded of decodeBase64Blobs(text)) push("base64-decoded", decoded);
    return variants;
}

/** Score how "smuggled" the text looks (0 = clean, 100 = blatant). */
export function detectObfuscation(text: string): number {
    let score = 0;
    const invisible = countInvisible(text);
    if (invisible > 0) score += Math.min(40, invisible * 4);
    if (leetRatio(text) > 0.2) score += 30;
    if (hasMixedScript(text)) score += 25;
    if (collapseSpacedLetters(text) !== foldUnicode(text)) score += 25;
    if (decodeBase64Blobs(text, 1).length > 0) score += 20;
    return Math.min(100, score);
}
