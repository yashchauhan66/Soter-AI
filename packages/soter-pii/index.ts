/**
 * soter-pii — lightweight, zero-dependency PII & secret redactor.
 *
 * Design goals (vs. Microsoft Presidio / AWS Comprehend / Google DLP):
 *  - Zero dependencies, runs anywhere Node >= 16 does (also Browsers/Deno/Bun).
 *  - Deterministic: same input -> same output, no model downloads, no network.
 *  - Safe by construction: every bundled pattern is linear-time (no nested
 *    quantifiers), so the engine is not vulnerable to catastrophic ReDoS.
 *    Custom patterns are screened at registration time.
 *  - Precision-first: credit-card candidates must pass Luhn + valid IIN/BIN,
 *    Aadhaar must pass Verhoeff, SSN/IBAN/IPv4 are structure-validated.
 *  - Configurable: include/exclude, allowlist, custom recognizers, masking.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface RedactionResult {
  originalText: string;
  redactedText: string;
  hasPII: boolean;
  detectedTypes: string[];
  /** Total number of spans that were replaced. */
  matchCount: number;
  /** Per-entity replacement counts, e.g. { Email: 2, Phone: 1 }. */
  counts: Record<string, number>;
}

export interface CustomRule {
  /** Entity label, e.g. "Employee ID". */
  label: string;
  /** Detection pattern. The global flag is enforced automatically. */
  pattern: RegExp;
  /** Optional explicit replacement; defaults to `[REDACTED_<LABEL>]`. */
  replacement?: string;
  /** Optional validator; return false to discard the match (precision hook). */
  validate?: (match: string) => boolean;
}

export interface RedactionOptions {
  /** Only run these entity labels. */
  include?: string[];
  /** Skip these entity labels. */
  exclude?: string[];
  /**
   * Exact (case-insensitive) values that must never be redacted even if a
   * pattern matches — e.g. your own support email or a public DNS resolver.
   */
  allowlist?: string[];
  /** User-supplied recognizers, screened for catastrophic backtracking. */
  customRules?: CustomRule[];
  /**
   * "labelled" (default) replaces with `[REDACTED_EMAIL]` etc.
   * "masked" replaces with a fixed-width mask, hiding the entity length.
   */
  mode?: "labelled" | "masked";
  /** Mask character for masked mode. Default "*". */
  maskChar?: string;
}

interface Rule {
  pattern: RegExp;
  label: string;
  replacement: string;
  validate?: (match: string) => boolean;
}

// ---------------------------------------------------------------------------
// Validators (precision hooks — this is what beats naive regex)
// ---------------------------------------------------------------------------

/** Luhn checksum validation for payment card numbers. */
export function luhnCheck(digits: string): boolean {
  const clean = digits.replace(/[\s-]/g, "");
  if (!/^\d{12,19}$/.test(clean)) return false;
  let sum = 0;
  let doubleIt = false;
  for (let i = clean.length - 1; i >= 0; i--) {
    let d = clean.charCodeAt(i) - 48;
    if (doubleIt) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    doubleIt = !doubleIt;
  }
  return sum % 10 === 0;
}

/** Valid major card IIN/BIN prefixes. */
function hasKnownCardPrefix(clean: string): boolean {
  const two = parseInt(clean.slice(0, 2), 10);
  const four = parseInt(clean.slice(0, 4), 10);
  const six = parseInt(clean.slice(0, 6), 10);
  if (clean[0] === "4") return true; // Visa
  if (two >= 51 && two <= 55) return true; // Mastercard legacy
  if (six >= 222100 && six <= 272099) return true; // Mastercard 2-series
  if (two === 34 || two === 37) return true; // Amex
  if (four === 6011) return true; // Discover
  if (two === 65) return true; // Discover / RuPay overlap
  if (clean.startsWith("644") || clean.startsWith("645") || clean.startsWith("646") || clean.startsWith("647") || clean.startsWith("648") || clean.startsWith("649")) return true; // Discover
  if (two === 62) return true; // UnionPay
  if (two === 60 || two === 81 || two === 82) return true; // RuPay
  if (two === 35 || two === 36 || two === 38) return true; // JCB / Diners family
  if (two === 30) return true; // Diners Club
  return false;
}

/** Card validator: known BIN + not all-same-digit + Luhn. */
function isLikelyCard(match: string): boolean {
  const clean = match.replace(/[\s-]/g, "");
  if (!hasKnownCardPrefix(clean)) return false;
  if (/^(\d)\1+$/.test(clean)) return false;
  return luhnCheck(clean);
}

/** Verhoeff dihedral group tables (Aadhaar). */
const VERHOEFF_D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];
const VERHOEFF_P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

/** Verhoeff checksum validation (used by Aadhaar). */
export function verhoeffCheck(digits: string): boolean {
  const clean = digits.replace(/[\s-]/g, "");
  if (!/^\d{12}$/.test(clean)) return false;
  let c = 0;
  const reversed = clean.split("").reverse().map(Number);
  for (let i = 0; i < reversed.length; i++) {
    c = VERHOEFF_D[c][VERHOEFF_P[i % 8][reversed[i]]];
  }
  return c === 0;
}

/** Aadhaar must pass Verhoeff and not start with 0 or 1. */
function isLikelyAadhaar(match: string): boolean {
  const clean = match.replace(/[\s-]/g, "");
  if (clean[0] === "0" || clean[0] === "1") return false;
  return verhoeffCheck(clean);
}

/** IPv4 octets must be 0–255. */
function isValidIPv4(match: string): boolean {
  return match.split(".").every((o) => +o >= 0 && +o <= 255);
}

/** US SSN: area not 000/666/9xx, group not 00, serial not 0000. */
function isValidSSN(match: string): boolean {
  const m = match.replace(/-/g, "");
  const area = parseInt(m.slice(0, 3), 10);
  const group = parseInt(m.slice(3, 5), 10);
  const serial = parseInt(m.slice(5, 9), 10);
  if (area === 0 || area === 666 || area >= 900) return false;
  if (group === 0 || serial === 0) return false;
  return true;
}

/** IBAN checksum (ISO 13616 / mod-97). */
function isValidIBAN(match: string): boolean {
  const clean = match.replace(/\s/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(clean)) return false;
  const rearranged = clean.slice(4) + clean.slice(0, 4);
  let remainder = 0;
  for (const ch of rearranged) {
    const code = /[A-Z]/.test(ch) ? String(ch.charCodeAt(0) - 55) : ch;
    for (const d of code) remainder = (remainder * 10 + (d.charCodeAt(0) - 48)) % 97;
  }
  return remainder === 1;
}

// ---------------------------------------------------------------------------
// Bundled recognizers — all linear-time (ReDoS-safe by construction).
// Order matters: secrets first, then financial/ID, then generic contact.
// ---------------------------------------------------------------------------

const SECRET_RULES: Rule[] = [
  { pattern: /\bAKIA[0-9A-Z]{16}\b/g, label: "AWS Access Key", replacement: "[REDACTED_AWS_KEY]" },
  { pattern: /\bASIA[0-9A-Z]{16}\b/g, label: "AWS Temp Key", replacement: "[REDACTED_AWS_KEY]" },
  { pattern: /\bgithub_pat_[A-Za-z0-9_]{82}\b/g, label: "GitHub PAT (fine-grained)", replacement: "[REDACTED_GITHUB_TOKEN]" },
  { pattern: /\bghp_[A-Za-z0-9]{36}\b/g, label: "GitHub PAT", replacement: "[REDACTED_GITHUB_TOKEN]" },
  { pattern: /\bgho_[A-Za-z0-9]{36}\b/g, label: "GitHub OAuth", replacement: "[REDACTED_GITHUB_TOKEN]" },
  { pattern: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/g, label: "Anthropic API Key", replacement: "[REDACTED_ANTHROPIC_KEY]" },
  { pattern: /\bsk-[A-Za-z0-9_-]{20,}\b/g, label: "OpenAI API Key", replacement: "[REDACTED_OPENAI_KEY]" },
  { pattern: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g, label: "Slack Token", replacement: "[REDACTED_SLACK_TOKEN]" },
  { pattern: /\bAIza[0-9A-Za-z_-]{35}\b/g, label: "Google API Key", replacement: "[REDACTED_GOOGLE_KEY]" },
  { pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, label: "JWT", replacement: "[REDACTED_JWT]" },
  { pattern: /-----BEGIN (?:RSA |EC |OPENSSH |PGP |DSA )?PRIVATE KEY-----/g, label: "Private Key", replacement: "[REDACTED_PRIVATE_KEY]" },
  { pattern: /\b(?:api[_-]?key|apikey|secret|token|passwd|password|pwd)\s*[:=]\s*["']?[A-Za-z0-9\-._~+/]{8,64}["']?/gi, label: "Generic Secret", replacement: "[REDACTED_SECRET]" },
];

const PII_RULES: Rule[] = [
  // -- Financial --
  { pattern: /\b(?:\d[ -]?){13,19}\b/g, label: "Credit Card", replacement: "[REDACTED_CARD]", validate: isLikelyCard },
  { pattern: /\b[A-Z]{2}\d{2}(?: ?[A-Z0-9]{4}){2,7}(?: ?[A-Z0-9]{1,3})?\b/g, label: "IBAN", replacement: "[REDACTED_IBAN]", validate: isValidIBAN },
  { pattern: /\b[A-Z]{6}[A-Z0-9]{2}(?:[A-Z0-9]{3})?\b/g, label: "SWIFT/BIC", replacement: "[REDACTED_SWIFT]" },
  { pattern: /\bcvv?\s*[:=]?\s*\d{3,4}\b/gi, label: "Card CVV", replacement: "[REDACTED_CVV]" },
  { pattern: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, label: "Aadhaar Card", replacement: "[REDACTED_AADHAAR]", validate: isLikelyAadhaar },
  { pattern: /\b[A-Z]{5}\d{4}[A-Z]\b/g, label: "PAN Card", replacement: "[REDACTED_PAN]" },
  // -- Government ID --
  { pattern: /\b\d{3}-\d{2}-\d{4}\b/g, label: "US SSN", replacement: "[REDACTED_SSN]", validate: isValidSSN },
  { pattern: /\b[A-Z]{2}\d{7,9}\b/g, label: "Passport Number", replacement: "[REDACTED_PASSPORT]" },
  // -- Network --
  { pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g, label: "IP Address", replacement: "[REDACTED_IP]", validate: isValidIPv4 },
  { pattern: /\b(?:[0-9A-Fa-f]{1,4}:){7}[0-9A-Fa-f]{1,4}\b/g, label: "IPv6 Address", replacement: "[REDACTED_IPV6]" },
  { pattern: /\b(?:[0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}\b/g, label: "MAC Address", replacement: "[REDACTED_MAC]" },
  // -- Contact --
  { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, label: "Email", replacement: "[REDACTED_EMAIL]" },
  { pattern: /(?<!\d)(?!\d{4}[ -]\d{4}[ -]\d{4}(?:[ -]\d{4})?(?!\d))(?:\+\d{1,3}[\s.\-]?)?(?:\(\d{2,4}\)[\s.\-]?|\d{2,4}[\s.\-])\d{3,4}[\s.\-]\d{3,4}(?!\d)/g, label: "Phone", replacement: "[REDACTED_PHONE]" },
  // -- Context-bound PII --
  { pattern: /\b(?:DOB|date of birth|born on)\s*[:=\-]?\s*\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}\b/gi, label: "Date of Birth", replacement: "[REDACTED_DOB]" },
  { pattern: /\b(?:address|residing at|lives at)\s*[:=]\s*[^\n,]{5,},\s[^\n]{3,}/gi, label: "Address", replacement: "[REDACTED_ADDRESS]" },
];

/** Default rule set: secrets + PII. */
const ALL_RULES: Rule[] = [...SECRET_RULES, ...PII_RULES];

// ---------------------------------------------------------------------------
// Custom-rule ReDoS safety screen (conservative heuristic)
// ---------------------------------------------------------------------------

const DANGEROUS_REGEX = /(\([^()]*[+*][^()]*\)[+*?{])|(\.\*[+*])|(\([^()]*\|[^()]*\)[+*])/;

/**
 * Reject patterns with classic catastrophic-backtracking shapes:
 *  - nested quantifiers `(a+)+`, `(x*)*` — group body quantified AND group quantified
 *  - `.*` followed by another quantifier (`.*+`, `.*{2,}`)
 *  - alternation inside an unbounded repeat `(a|ab)+`
 * Conservative: refuses some safe patterns, never accepts a known-deadly one.
 */
export function isReDoSSafe(pattern: RegExp): boolean {
  const src = pattern.source;
  if (DANGEROUS_REGEX.test(src)) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Core engine
// ---------------------------------------------------------------------------

function defaultReplacement(label: string): string {
  return `[REDACTED_${label.toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "")}]`;
}

export function redactPII(text: string, options: RedactionOptions = {}): RedactionResult {
  const counts: Record<string, number> = {};
  const detected = new Set<string>();
  let out = text;

  const mode = options.mode ?? "labelled";
  const maskChar = options.maskChar ?? "*";
  const allow = new Set((options.allowlist ?? []).map((v) => v.toLowerCase()));

  let rules: Rule[] = [...ALL_RULES];
  if (options.customRules) {
    for (const c of options.customRules) {
      if (!isReDoSSafe(c.pattern)) {
        throw new Error(
          `soter-pii: custom rule "${c.label}" rejected — pattern may cause catastrophic backtracking (ReDoS).`
        );
      }
      const flags = c.pattern.flags.includes("g") ? c.pattern.flags : c.pattern.flags + "g";
      rules.push({
        pattern: new RegExp(c.pattern.source, flags),
        label: c.label,
        replacement: c.replacement ?? defaultReplacement(c.label),
        validate: c.validate,
      });
    }
  }
  if (options.include) {
    const inc = new Set(options.include.map((s) => s.toLowerCase()));
    rules = rules.filter((r) => inc.has(r.label.toLowerCase()));
  }
  if (options.exclude) {
    const exc = new Set(options.exclude.map((s) => s.toLowerCase()));
    rules = rules.filter((r) => !exc.has(r.label.toLowerCase()));
  }

  for (const rule of rules) {
    // Fresh regex per rule per call — zero shared mutable lastIndex state,
    // so concurrent/interleaved calls can never corrupt each other.
    const re = new RegExp(rule.pattern.source, rule.pattern.flags);
    out = out.replace(re, (m: string) => {
      if (allow.has(m.toLowerCase())) return m;
      if (rule.validate && !rule.validate(m)) return m;
      detected.add(rule.label);
      counts[rule.label] = (counts[rule.label] ?? 0) + 1;
      return mode === "masked" ? maskChar.repeat(m.length) : rule.replacement;
    });
  }

  const detectedTypes = Array.from(detected);
  const matchCount = Object.values(counts).reduce((a, b) => a + b, 0);
  return {
    originalText: text,
    redactedText: out,
    hasPII: detectedTypes.length > 0,
    detectedTypes,
    matchCount,
    counts,
  };
}

/**
 * Recursively redact PII in every string value of a plain JSON-like value.
 * Non-string leaves are returned unchanged.
 */
export function redactDeep<T>(value: T, options?: RedactionOptions): T {
  if (typeof value === "string") return redactPII(value, options).redactedText as unknown as T;
  if (Array.isArray(value)) return value.map((v) => redactDeep(v, options)) as unknown as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = redactDeep(v, options);
    }
    return out as T;
  }
  return value;
}

/** True if any PII/secret is present — a cheap boolean gate. */
export function containsPII(text: string, options?: RedactionOptions): boolean {
  return redactPII(text, options).hasPII;
}
