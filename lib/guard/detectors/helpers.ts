import type { GuardFinding, RiskType, Severity } from '../types';

export interface PatternRule {
  pattern: RegExp;
  label: string;
  message: string;
  severity: Severity;
  score: number;
  redactionToken?: string;
  sensitive?: boolean;
}

export function detectPatterns(text: string, type: RiskType, rules: PatternRule[]) {
  const findings: GuardFinding[] = [];
  const variants = shouldUseSecurityVariants(type)
    ? detectionVariants(text)
    : [{ kind: 'raw', text }];
  const seen = new Set<string>();
  for (const rule of rules) {
    const flags = rule.pattern.flags.includes('g') ? rule.pattern.flags : `${rule.pattern.flags}g`;
    for (const variant of variants) {
      const regex = new RegExp(rule.pattern.source, flags);
      for (const match of variant.text.matchAll(regex)) {
        if (match.index === undefined) continue;
        const key = `${rule.label}:${variant.kind}:${match[0].slice(0, 80)}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const fullRange = variant.kind !== 'raw';
        findings.push({
          type,
          label: fullRange ? `${rule.label} (${variant.kind})` : rule.label,
          severity: rule.severity,
          score: rule.score,
          matched: rule.sensitive ? undefined : match[0].slice(0, 120),
          message: fullRange
            ? `${rule.message} Detected after ${variant.kind} normalization.`
            : rule.message,
          start: fullRange ? 0 : match.index,
          end: fullRange ? text.length : match.index + match[0].length,
          redactionToken: rule.redactionToken,
        });
        if (findings.length >= 20) return findings;
      }
    }
  }
  return findings;
}

function shouldUseSecurityVariants(type: RiskType) {
  return (
    type === 'PROMPT_INJECTION' || type === 'JAILBREAK' || type === 'SYSTEM_PROMPT_LEAK_ATTEMPT'
  );
}

function detectionVariants(text: string) {
  const variants: Array<{ kind: string; text: string }> = [{ kind: 'raw', text }];
  const decoded = decodeLightweightEncodings(text);
  pushVariant(variants, 'decoded', decoded);
  const normalized = normalizeSecurityText(decoded);
  pushVariant(variants, 'unicode', normalized);
  for (const variant of decodeEncodedPayloadVariants(normalized))
    pushVariant(variants, variant.kind, variant.text);
  pushVariant(variants, 'leet', normalizeLeetspeak(normalized));
  pushVariant(variants, 'compact', compactSecurityText(normalized));
  pushVariant(variants, 'rot13', rot13(normalized));
  for (const variant of caesarShiftVariants(normalized))
    pushVariant(variants, variant.kind, variant.text);
  pushVariant(variants, 'reverse', reverseText(normalized));
  return variants;
}

function pushVariant(variants: Array<{ kind: string; text: string }>, kind: string, value: string) {
  if (!value || variants.some((variant) => variant.text === value)) return;
  variants.push({ kind, text: value });
}

function decodeLightweightEncodings(text: string) {
  const percentDecoded = text.replace(/%([0-9a-f]{2})/gi, (_, hex: string) =>
    String.fromCharCode(Number.parseInt(hex, 16)),
  );
  return percentDecoded
    .replace(/&#x([0-9a-f]+);?/gi, (_, hex: string) => safeCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);?/g, (_, decimal: string) => safeCodePoint(Number.parseInt(decimal, 10)))
    .replace(
      /&(colon|semi|comma|period|lbrack|rbrack|lt|gt|quot|apos|amp);/gi,
      (_, name: string) => {
        const named: Record<string, string> = {
          amp: '&',
          apos: "'",
          colon: ':',
          comma: ',',
          gt: '>',
          lbrack: '[',
          lt: '<',
          period: '.',
          quot: '"',
          rbrack: ']',
          semi: ';',
        };
        return named[name.toLowerCase()] ?? _;
      },
    );
}

function normalizeSecurityText(text: string) {
  // Decompose first (NFKD) and strip combining diacritical marks so accented
  // and combining-mark evasions collapse to their base letters
  // (e.g. "i\u0307gn\u00F3re" \u2192 "ignore"). Without this, attackers could drop detection
  // to zero simply by sprinkling diacritics over keywords. We then re-fold with
  // NFKC to normalize fullwidth/compatibility forms and remove invisible
  // formatting characters before mapping confusables to ASCII. This runs only
  // on the detection-scanning variant, never on redaction or forwarded text.
  const folded = text
    .normalize('NFKD')
    .replace(/\p{Mn}+/gu, '')
    .normalize('NFKC')
    .replace(
      /[\u00AD\u034F\u061C\u115F\u1160\u17B4\u17B5\u180B-\u180F\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g,
      '',
    );
  return Array.from(folded)
    .map((char) => CONFUSABLES[char] ?? char)
    .join('');
}

function decodeEncodedPayloadVariants(text: string) {
  const variants: Array<{ kind: string; text: string }> = [];
  pushDecodedVariants(variants, 'base64', decodeBase64Payloads(text));
  pushDecodedVariants(variants, 'hex', decodeHexPayloads(text));
  pushDecodedVariants(variants, 'decimal-bytes', decodeNumberBytePayloads(text));
  pushDecodedVariants(variants, 'binary-bytes', decodeBinaryBytePayloads(text));
  pushDecodedVariants(variants, 'morse', decodeMorsePayloads(text));
  return variants;
}

function pushDecodedVariants(
  variants: Array<{ kind: string; text: string }>,
  kind: string,
  values: string[],
) {
  for (const value of values) {
    if (!value || value.length === 0 || variants.some((variant) => variant.text === value))
      continue;
    variants.push({ kind, text: value });
  }
}

function decodeBase64Payloads(text: string) {
  return decodeTokenPayloads(text, /\b[A-Za-z0-9+/_-]{16,}={0,2}\b/g, (token) => {
    if (/^[0-9a-f]+$/i.test(token)) return undefined;
    const normalized = token.replace(/-/g, '+').replace(/_/g, '/');
    if (normalized.length % 4 === 1) return undefined;
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    try {
      const decoded = Buffer.from(padded, 'base64').toString('utf8');
      return isLikelyDecodedText(decoded) ? decoded : undefined;
    } catch {
      return undefined;
    }
  });
}

function decodeHexPayloads(text: string) {
  const escaped = decodeTokenPayloads(text, /(?:\\x[0-9a-f]{2}){4,}/gi, (token) => {
    const hex = token.replace(/\\x/gi, '');
    return decodeHexString(hex);
  });
  return [
    ...escaped,
    ...decodeTokenPayloads(text, /\b(?:0x)?[0-9a-f]{16,}\b/gi, (token) => {
      const hex = token.replace(/^0x/i, '');
      if (hex.length % 2 !== 0) return undefined;
      return decodeHexString(hex);
    }),
  ];
}

function decodeNumberBytePayloads(text: string) {
  return decodeTokenPayloads(text, /(?:\b0?\d{2,3}\b[\s,;:/|-]+){5,}\b0?\d{2,3}\b/g, (token) => {
    const bytes = token
      .split(/[^0-9]+/)
      .filter(Boolean)
      .map((value) => Number.parseInt(value, 10));
    if (bytes.length < 6 || bytes.some((value) => !isPrintableByte(value))) return undefined;
    const decoded = String.fromCharCode(...bytes);
    return isLikelyDecodedText(decoded) ? decoded : undefined;
  });
}

function decodeBinaryBytePayloads(text: string) {
  return decodeTokenPayloads(text, /(?:\b[01]{8}\b[\s,;:/|-]+){5,}\b[01]{8}\b/g, (token) => {
    const bytes = token
      .split(/[^01]+/)
      .filter(Boolean)
      .map((value) => Number.parseInt(value, 2));
    if (bytes.length < 6 || bytes.some((value) => !isPrintableByte(value))) return undefined;
    const decoded = String.fromCharCode(...bytes);
    return isLikelyDecodedText(decoded) ? decoded : undefined;
  });
}

function decodeMorsePayloads(text: string) {
  return decodeTokenPayloads(text, /(?:[.\-]{1,5}|\/)(?:\s+(?:[.\-]{1,5}|\/)){5,}/g, (token) => {
    const parts = token.trim().split(/\s+/);
    const decoded: string[] = [];
    let valid = 0;
    for (const part of parts) {
      if (part === '/') {
        decoded.push(' ');
        continue;
      }
      const letter = MORSE[part];
      if (!letter) return undefined;
      decoded.push(letter);
      valid += 1;
    }
    const value = decoded.join('').replace(/\s+/g, ' ').trim();
    return valid >= 6 && isLikelyDecodedText(value) ? value : undefined;
  });
}

function decodeTokenPayloads(
  text: string,
  pattern: RegExp,
  decode: (token: string) => string | undefined,
) {
  const variants = new Set<string>();
  let replaced = text;
  for (const match of text.matchAll(pattern)) {
    const token = match[0];
    const decoded = decode(token);
    if (!decoded || decoded === token) continue;
    variants.add(decoded);
    replaced = replaced.replace(token, decoded);
  }
  if (replaced !== text) variants.add(replaced);
  return [...variants];
}

function decodeHexString(hex: string) {
  try {
    const decoded = Buffer.from(hex, 'hex').toString('utf8');
    return isLikelyDecodedText(decoded) ? decoded : undefined;
  } catch {
    return undefined;
  }
}

function normalizeLeetspeak(text: string) {
  return text.replace(/[01345789@$]/g, (char) => LEET[char] ?? char);
}

function compactSecurityText(text: string) {
  return text.replace(/[^A-Za-z0-9]+/g, '');
}

function rot13(text: string) {
  return text.replace(/[a-z]/gi, (char) => {
    const base = char <= 'Z' ? 65 : 97;
    return String.fromCharCode(((char.charCodeAt(0) - base + 13) % 26) + base);
  });
}

function caesarShiftVariants(text: string) {
  const letters = text.match(/[a-z]/gi)?.length ?? 0;
  if (letters < 12 || text.length > 2000) return [];
  const compactLength = text.replace(/\s/g, '').length || 1;
  if (letters / compactLength < 0.6) return [];

  const variants: Array<{ kind: string; text: string }> = [];
  for (let shift = 1; shift < 26; shift += 1) {
    if (shift === 13) continue;
    const shifted = caesarShift(text, shift);
    if (SECURITY_WORDS.test(shifted)) variants.push({ kind: `caesar-${shift}`, text: shifted });
  }
  return variants;
}

function caesarShift(text: string, shift: number) {
  return text.replace(/[a-z]/gi, (char) => {
    const base = char <= 'Z' ? 65 : 97;
    return String.fromCharCode(((char.charCodeAt(0) - base - shift + 26) % 26) + base);
  });
}

function reverseText(text: string) {
  return Array.from(text).reverse().join('');
}

function isPrintableByte(value: number) {
  return value === 9 || value === 10 || value === 13 || (value >= 32 && value <= 126);
}

function isLikelyDecodedText(value: string) {
  if (value.length < 6 || value.includes('\uFFFD')) return false;
  const chars = Array.from(value);
  const printable = chars.filter(
    (char) => !/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(char),
  ).length;
  const hasWordShape = /[a-z]{4}/i.test(value) || /\p{L}{2}/u.test(value);
  return printable / chars.length >= 0.9 && hasWordShape;
}

function safeCodePoint(value: number) {
  if (!Number.isSafeInteger(value) || value < 0 || value > 0x10ffff) return '';
  try {
    return String.fromCodePoint(value);
  } catch {
    return '';
  }
}

const SECURITY_WORDS =
  /\b(?:ignore|disregard|system|prompt|instructions?|jailbreak|bypass|reveal|safety|policy|developer|exfiltrate|credentials?)\b/i;

const LEET: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '8': 'b',
  '9': 'g',
  '@': 'a',
  $: 's',
};

const MORSE: Record<string, string> = {
  '.-': 'a',
  '-...': 'b',
  '-.-.': 'c',
  '-..': 'd',
  '.': 'e',
  '..-.': 'f',
  '--.': 'g',
  '....': 'h',
  '..': 'i',
  '.---': 'j',
  '-.-': 'k',
  '.-..': 'l',
  '--': 'm',
  '-.': 'n',
  '---': 'o',
  '.--.': 'p',
  '--.-': 'q',
  '.-.': 'r',
  '...': 's',
  '-': 't',
  '..-': 'u',
  '...-': 'v',
  '.--': 'w',
  '-..-': 'x',
  '-.--': 'y',
  '--..': 'z',
  '.----': '1',
  '..---': '2',
  '...--': '3',
  '....-': '4',
  '.....': '5',
  '-....': '6',
  '--...': '7',
  '---..': '8',
  '----.': '9',
  '-----': '0',
};

const CONFUSABLES: Record<string, string> = {
  // ── Greek ─────────────────────────────────────────────
  '\u0391': 'A', // Greek Alpha → A
  '\u0392': 'B', // Greek Beta → B
  '\u0395': 'E', // Greek Epsilon → E
  '\u0396': 'Z', // Greek Zeta → Z
  '\u0397': 'H', // Greek Eta → H
  '\u0399': 'I', // Greek Iota → I
  '\u039A': 'K', // Greek Kappa → K
  '\u039C': 'M', // Greek Mu → M
  '\u039D': 'N', // Greek Nu → N
  '\u039F': 'O', // Greek Omicron → O
  '\u03A1': 'P', // Greek Rho → P
  '\u03A4': 'T', // Greek Tau → T
  '\u03A5': 'Y', // Greek Upsilon → Y
  '\u03A7': 'X', // Greek Chi → X
  '\u03B1': 'a', // Greek alpha → a
  '\u03B7': 'n', // Greek eta → n
  '\u03B9': 'i', // Greek iota → i
  '\u03BA': 'k', // Greek kappa → k
  '\u03BD': 'v', // Greek nu → v
  '\u03BF': 'o', // Greek omicron → o
  '\u03C1': 'p', // Greek rho → p
  '\u03C2': 's', // Greek final sigma → s
  '\u03C4': 't', // Greek tau → t
  '\u03C7': 'x', // Greek chi → x

  // ── Cyrillic Upper-case ──────────────────────────────
  '\u0401': 'E', // Cyrillic Yo → E
  '\u0406': 'I', // Cyrillic Byelorussian-Ukrainian I → I
  '\u0412': 'B', // Cyrillic Ve → B
  '\u0415': 'E', // Cyrillic Ie → E
  '\u041A': 'K', // Cyrillic Ka → K
  '\u041C': 'M', // Cyrillic Em → M
  '\u041D': 'H', // Cyrillic En → H
  '\u041E': 'O', // Cyrillic O → O
  '\u0420': 'P', // Cyrillic Er → P
  '\u0421': 'C', // Cyrillic Es → C
  '\u0422': 'T', // Cyrillic Te → T
  '\u0425': 'X', // Cyrillic Ha → X

  // ── Cyrillic Lower-case ──────────────────────────────
  '\u0430': 'a', // Cyrillic a → a
  '\u0435': 'e', // Cyrillic ie → e
  '\u043E': 'o', // Cyrillic o → o
  '\u0440': 'p', // Cyrillic er → p
  '\u0441': 'c', // Cyrillic es → c
  '\u0443': 'y', // Cyrillic u → y
  '\u0445': 'x', // Cyrillic ha → x
  '\u0451': 'e', // Cyrillic io → e
  '\u0456': 'i', // Cyrillic Byelorussian-Ukrainian i → i
};
