import type { GuardFinding, RiskType, Severity } from "../types";

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
  const variants = shouldUseSecurityVariants(type) ? detectionVariants(text) : [{ kind: "raw", text }];
  const seen = new Set<string>();
  for (const rule of rules) {
    const flags = rule.pattern.flags.includes("g") ? rule.pattern.flags : `${rule.pattern.flags}g`;
    for (const variant of variants) {
      const regex = new RegExp(rule.pattern.source, flags);
      for (const match of variant.text.matchAll(regex)) {
        if (match.index === undefined) continue;
        const key = `${rule.label}:${variant.kind}:${match[0].slice(0, 80)}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const fullRange = variant.kind !== "raw";
        findings.push({
          type,
          label: fullRange ? `${rule.label} (${variant.kind})` : rule.label,
          severity: rule.severity,
          score: rule.score,
          matched: rule.sensitive ? undefined : match[0].slice(0, 120),
          message: fullRange ? `${rule.message} Detected after ${variant.kind} normalization.` : rule.message,
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
  return type === "PROMPT_INJECTION" || type === "JAILBREAK" || type === "SYSTEM_PROMPT_LEAK_ATTEMPT";
}

function detectionVariants(text: string) {
  const variants: Array<{ kind: string; text: string }> = [{ kind: "raw", text }];
  const decoded = decodeLightweightEncodings(text);
  pushVariant(variants, "decoded", decoded);
  const normalized = normalizeSecurityText(decoded);
  pushVariant(variants, "unicode", normalized);
  pushVariant(variants, "rot13", rot13(normalized));
  pushVariant(variants, "reverse", reverseText(normalized));
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
    .replace(/&(colon|semi|comma|period|lbrack|rbrack|lt|gt|quot|apos|amp);/gi, (_, name: string) => {
      const named: Record<string, string> = {
        amp: "&",
        apos: "'",
        colon: ":",
        comma: ",",
        gt: ">",
        lbrack: "[",
        lt: "<",
        period: ".",
        quot: "\"",
        rbrack: "]",
        semi: ";",
      };
      return named[name.toLowerCase()] ?? _;
    });
}

function normalizeSecurityText(text: string) {
  return Array.from(text.normalize("NFKC").replace(/[\u00AD\u034F\u061C\u115F\u1160\u17B4\u17B5\u180B-\u180F\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g, ""))
    .map((char) => CONFUSABLES[char] ?? char)
    .join("");
}

function rot13(text: string) {
  return text.replace(/[a-z]/gi, (char) => {
    const base = char <= "Z" ? 65 : 97;
    return String.fromCharCode(((char.charCodeAt(0) - base + 13) % 26) + base);
  });
}

function reverseText(text: string) {
  return Array.from(text).reverse().join("");
}

function safeCodePoint(value: number) {
  if (!Number.isSafeInteger(value) || value < 0 || value > 0x10ffff) return "";
  try {
    return String.fromCodePoint(value);
  } catch {
    return "";
  }
}

const CONFUSABLES: Record<string, string> = {
  "\u0391": "A",
  "\u0392": "B",
  "\u0395": "E",
  "\u0396": "Z",
  "\u0397": "H",
  "\u0399": "I",
  "\u039A": "K",
  "\u039C": "M",
  "\u039D": "N",
  "\u039F": "O",
  "\u03A1": "P",
  "\u03A4": "T",
  "\u03A5": "Y",
  "\u03A7": "X",
  "\u03B1": "a",
  "\u03BF": "o",
  "\u03C1": "p",
  "\u03C4": "t",
  "\u03C7": "x",
  "\u0412": "B",
  "\u0415": "E",
  "\u041A": "K",
  "\u041C": "M",
  "\u041D": "H",
  "\u041E": "O",
  "\u0420": "P",
  "\u0421": "C",
  "\u0422": "T",
  "\u0425": "X",
  "\u0430": "a",
  "\u0435": "e",
  "\u043E": "o",
  "\u0440": "p",
  "\u0441": "c",
  "\u0443": "y",
  "\u0445": "x",
};
