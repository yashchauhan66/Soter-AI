import type { DetectorMatch } from "./types";

/**
 * Redactor — strips sensitive content and replaces with safe tokens.
 * Never exposes raw secrets, PII, or credentials.
 *
 * Redaction is defense-in-depth:
 *   1. Position-based redaction of detector findings (precise, typed tokens).
 *   2. An ALWAYS-ON pattern safety-net pass that runs even when findings are
 *      supplied, so any secret a detector missed is still masked.
 *
 * Placeholder tokens ([REDACTED_*]) never match the secret patterns, so the
 * safety-net pass is idempotent over already-redacted output.
 */

// Ordered most-specific → least-specific so precise labels win before the
// broad catch-alls. Every high-risk credential class listed here MUST be
// covered so it can never survive into redactedText.
const REDACTION_RULES: Array<[RegExp, string]> = [
    // ── Private keys / certificates (multiline) ───────────────────────────
    [/-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP |ENCRYPTED )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH |DSA |PGP |ENCRYPTED )?PRIVATE KEY-----/g, "[REDACTED_PRIVATE_KEY]"],
    // ── JWT (relaxed: short middle/signature segments allowed) ────────────
    [/\beyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{2,}\.[A-Za-z0-9_-]{2,}\b/g, "[REDACTED_JWT]"],
    // ── VCS tokens ────────────────────────────────────────────────────────
    [/\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{30,255}\b/g, "[REDACTED_GITHUB_TOKEN]"],
    [/\bglpat-[A-Za-z0-9_-]{20,}\b/g, "[REDACTED_GITLAB_TOKEN]"],
    // ── Cloud / provider keys ─────────────────────────────────────────────
    [/\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g, "[REDACTED_AWS_ACCESS_KEY]"],
    [/(?:aws_secret_access_key|secret_key)\s*[:=]\s*["']?[A-Za-z0-9/+=]{40}["']?/gi, "[REDACTED_AWS_SECRET_KEY]"],
    [/\bsk-ant-[A-Za-z0-9_-]{20,}\b/g, "[REDACTED_ANTHROPIC_KEY]"],
    [/\bAIza[A-Za-z0-9_-]{35}\b/g, "[REDACTED_GOOGLE_KEY]"],
    [/\bgsk_[A-Za-z0-9_-]{20,}\b/g, "[REDACTED_GROQ_KEY]"],
    // Payment keys use sk_/pk_/rk_ (underscore) — match before the generic sk- rule.
    [/\b(?:sk|pk|rk)_(?:test|live)_[A-Za-z0-9]{16,}\b/g, "[REDACTED_STRIPE_KEY]"],
    [/\brzp_(?:test|live)_[A-Za-z0-9]{10,}\b/g, "[REDACTED_RAZORPAY_KEY]"],
    // Broad AI provider key (OpenAI-like `sk-...`, dash form). Calibrated to
    // catch test/canary keys that lack the strict middle marker.
    [/\bsk-[A-Za-z0-9_-]{16,}\b/g, "[REDACTED_API_KEY]"],
    // ── Auth tokens ───────────────────────────────────────────────────────
    [/\bBearer\s+[A-Za-z0-9_\-.~+/]{8,}=*/gi, "[REDACTED_BEARER_TOKEN]"],
    [/\bxox(?:b|p|o|a|r|s)-[A-Za-z0-9-]{10,}\b/gi, "[REDACTED_SLACK_TOKEN]"],
    // ── Infrastructure ────────────────────────────────────────────────────
    [/\bhttps?:\/\/hooks\.slack\.com\/services\/T[A-Z0-9]{8,}\/B[A-Z0-9]{8,}\/[A-Za-z0-9]{20,}\b/g, "[REDACTED_WEBHOOK_SECRET]"],
    [/\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|mssql):\/\/[^\s"'<>]+/gi, "[REDACTED_DATABASE_URL]"],
    // ── Generic assignments (last, broadest) ──────────────────────────────
    [/\b(?:api[_-]?key|secret[_-]?key|access[_-]?token|client[_-]?secret|password|passwd|pwd)\b\s*[:=]\s*["']?[^"'\s]{8,}["']?/gi, "[REDACTED_SECRET]"],
    // ── PII ───────────────────────────────────────────────────────────────
    [/\b[2-9]\d{3}\s?\d{4}\s?\d{4}\b/g, "[REDACTED_AADHAAR]"],
    [/\b[A-Z]{5}[0-9]{4}[A-Z]\b/g, "[REDACTED_PAN]"],
    [/\b[0-3][0-9][A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]\b/g, "[REDACTED_GSTIN]"],
    [/\b[A-Z]{4}0[A-Z0-9]{6}\b/g, "[REDACTED_IFSC]"],
    [/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[REDACTED_EMAIL]"],
    [/(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b/g, "[REDACTED_PHONE]"],
    [/\b\d{3}-\d{2}-\d{4}\b/g, "[REDACTED_SSN]"],
];

/**
 * High-risk secret patterns used to *verify* that redacted output is clean.
 * Only credential/secret classes (not lower-risk PII) — a leak of any of these
 * into redactedText is a release blocker.
 */
const HIGH_RISK_SECRET_PATTERNS: Array<[string, RegExp]> = [
    ["private_key", /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP |ENCRYPTED )?PRIVATE KEY-----/],
    ["jwt", /\beyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{2,}\.[A-Za-z0-9_-]{2,}\b/],
    ["github_token", /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{30,255}\b/],
    ["gitlab_token", /\bglpat-[A-Za-z0-9_-]{20,}\b/],
    ["aws_access_key", /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
    ["anthropic_key", /\bsk-ant-[A-Za-z0-9_-]{20,}\b/],
    ["stripe_key", /\b(?:sk|pk|rk)_(?:test|live)_[A-Za-z0-9]{16,}\b/],
    ["razorpay_key", /\brzp_(?:test|live)_[A-Za-z0-9]{10,}\b/],
    ["ai_api_key", /\bsk-[A-Za-z0-9_-]{16,}\b/],
    ["bearer_token", /\bBearer\s+[A-Za-z0-9_\-.~+/]{8,}=*/i],
    ["slack_token", /\bxox(?:b|p|o|a|r|s)-[A-Za-z0-9-]{10,}\b/i],
    ["database_url", /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|mssql):\/\/[^\s"'<>]+/i],
];

/**
 * Redact sensitive content. Detector findings (when supplied) are masked by
 * position first, then a pattern safety-net pass ALWAYS runs so undetected
 * secrets are still removed. The result is guaranteed free of the high-risk
 * secret classes in {@link HIGH_RISK_SECRET_PATTERNS}.
 */
export function redactText(text: string, findings?: DetectorMatch[]): string {
    let output = text;

    // 1. Position-based redaction for precise, typed tokens.
    if (findings?.length) {
        const ranges = findings
            .filter((f) => f.start !== undefined && f.end !== undefined && f.match)
            .map((f) => ({ start: f.start, end: f.end, token: `[REDACTED_${f.type.toUpperCase()}]` }))
            .sort((a, b) => b.start - a.start);
        let lastStart = Number.POSITIVE_INFINITY;
        for (const r of ranges) {
            if (r.end > lastStart) continue; // skip overlapping ranges
            output = `${output.slice(0, r.start)}${r.token}${output.slice(r.end)}`;
            lastStart = r.start;
        }
    }

    // 2. ALWAYS-ON pattern safety-net pass (idempotent over redacted tokens).
    for (const [pattern, replacement] of REDACTION_RULES) {
        output = output.replace(pattern, replacement);
    }
    return output;
}

/**
 * Returns the list of high-risk secret classes that still appear in `text`.
 * Used by DecisionEngine and tests to assert redaction actually worked.
 */
export function findSurvivingSecrets(text: string): string[] {
    const survivors: string[] = [];
    for (const [name, pattern] of HIGH_RISK_SECRET_PATTERNS) {
        if (pattern.test(text)) survivors.push(name);
    }
    return survivors;
}

/** True if any high-risk secret pattern survives in `text`. */
export function containsRawSecret(text: string): boolean {
    for (const [, pattern] of HIGH_RISK_SECRET_PATTERNS) {
        if (pattern.test(text)) return true;
    }
    return false;
}

/**
 * Guaranteed-safe redaction for content leaving the machine (clipboard, AI
 * prompt, remote escalation). Runs the full safety net and hard-fails closed:
 * if any secret still survives, returns a fully scrubbed placeholder rather
 * than risk leaking raw material.
 */
export function redactForSharing(text: string, findings?: DetectorMatch[]): string {
    const redacted = redactText(text, findings);
    const survivors = findSurvivingSecrets(redacted);
    if (survivors.length === 0) return redacted;
    // Fail closed — strip the offending lines entirely.
    return redacted
        .split("\n")
        .map((line) => (containsRawSecret(line) ? "[REDACTED_LINE_CONTAINED_SECRET]" : line))
        .join("\n");
}

export function redactMatch(match: string, type: string): string {
    if (match.length <= 6) return `[${type.toUpperCase()}]`;
    return `${match.slice(0, 2)}${"*".repeat(Math.min(match.length - 4, 16))}${match.slice(-2)}`;
}
