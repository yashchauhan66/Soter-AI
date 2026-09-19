import type { DetectorMatch } from "./types";
import {
    ASSIGN,
    CONNECTION_STRING_PASSWORD,
    KEY_PREFIX,
    OPAQUE_CREDENTIAL_KEYWORDS,
    OPAQUE_CREDENTIAL_VALUE,
} from "./detectors/SecretDetector";

/**
 * The unknown-vendor credential shape, built ONCE and used in both directions.
 *
 * It appears twice below — as a redaction rule and as a survivor check — and the
 * two must never drift, because `redactForSharing` hard-fails closed: if a
 * high-risk class survives redaction it replaces the ENTIRE message with a
 * placeholder. A survivor pattern that can match something the redaction rule
 * cannot remove would therefore not fail safe, it would silently make every
 * affected message unusable. Sharing one source makes
 * `survivor ⊆ redacted` true by construction rather than by review.
 *
 * Note the deliberate asymmetry with the DETECTOR: `opaque_credential` carries a
 * strict validator (key deny-list, entropy, character classes) because it can
 * BLOCK, while these two carry none. Redacting more than we block is the safe
 * direction — an over-redaction costs the model some context, an under-redaction
 * leaks a live credential.
 */
const OPAQUE_CREDENTIAL_SOURCE = `\\b${KEY_PREFIX}${OPAQUE_CREDENTIAL_KEYWORDS}${ASSIGN}${OPAQUE_CREDENTIAL_VALUE}["']?`;

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
    [/\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{20,255}\b/g, "[REDACTED_GITHUB_TOKEN]"],
    [/\bglpat-[A-Za-z0-9_-]{20,}\b/g, "[REDACTED_GITLAB_TOKEN]"],
    [/\bhf_[A-Za-z0-9]{20,}\b/g, "[REDACTED_HUGGINGFACE_TOKEN]"],
    [/\bnpm_[A-Za-z0-9]{36,}\b/g, "[REDACTED_NPM_TOKEN]"],
    [/\bpypi-[A-Za-z0-9_-]{20,}\b/g, "[REDACTED_PYPI_TOKEN]"],
    [/\bSG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}\b/g, "[REDACTED_SENDGRID_KEY]"],
    [/\bdop_v1_[a-f0-9]{64}\b/g, "[REDACTED_DIGITALOCEAN_TOKEN]"],
    [/\bshpat_[a-fA-F0-9]{32}\b/g, "[REDACTED_SHOPIFY_TOKEN]"],
    [/\bdapi[a-f0-9]{32,}\b/gi, "[REDACTED_DATABRICKS_TOKEN]"],
    [/\bsb[pa]_[A-Za-z0-9_-]{20,}\b/g, "[REDACTED_SUPABASE_KEY]"],
    [/\bgithub_pat_[A-Za-z0-9_]{20,}\b/g, "[REDACTED_GITHUB_FINE_GRAINED]"],
    [/\bdckr_pat_[A-Za-z0-9_-]{20,}\b/g, "[REDACTED_DOCKER_PAT]"],
    [/\bkey-[0-9a-zA-Z]{32}\b/g, "[REDACTED_MAILGUN_KEY]"],
    [/\bATBB[A-Za-z0-9]{20,}\b/g, "[REDACTED_BITBUCKET_TOKEN]"],
    [/\bgl(?:cbt|dt|rt)-[A-Za-z0-9_-]{20,}\b/g, "[REDACTED_GITLAB_CI_TOKEN]"],
    [/\batlasv1\.[A-Za-z0-9]{50,}\b/g, "[REDACTED_TERRAFORM_TOKEN]"],
    [/\b[MN][A-Za-z0-9]{23,}\.[\w-]{6}\.[\w-]{27,}\b/g, "[REDACTED_DISCORD_TOKEN]"],
    [/(?:DefaultEndpointsProtocol|AccountKey)=[A-Za-z0-9+/=]{20,}/gi, "[REDACTED_AZURE_STORAGE]"],
    [new RegExp(CONNECTION_STRING_PASSWORD, "gi"), "[REDACTED_CONNECTION_STRING]"],

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
    // Unknown-vendor credentials first: this keyword set is wider (bare `token`,
    // `auth`, `credentials`) and it reads the JSON/YAML form, which is the shape
    // every agent config file on disk actually uses.
    [new RegExp(OPAQUE_CREDENTIAL_SOURCE, "gi"), "[REDACTED_CREDENTIAL]"],
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
    ["github_token", /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{20,255}\b/],
    ["gitlab_token", /\bglpat-[A-Za-z0-9_-]{20,}\b/],
    ["huggingface_token", /\bhf_[A-Za-z0-9]{20,}\b/],
    ["npm_token", /\bnpm_[A-Za-z0-9]{36,}\b/],
    ["pypi_token", /\bpypi-[A-Za-z0-9_-]{20,}\b/],
    ["sendgrid_key", /\bSG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}\b/],
    ["digitalocean_token", /\bdop_v1_[a-f0-9]{64}\b/],
    ["shopify_token", /\bshpat_[a-fA-F0-9]{32}\b/],
    ["databricks_token", /\bdapi[a-f0-9]{32,}\b/i],
    ["supabase_key", /\bsb[pa]_[A-Za-z0-9_-]{20,}\b/],
    ["github_fine_grained", /\bgithub_pat_[A-Za-z0-9_]{20,}\b/],
    ["docker_pat", /\bdckr_pat_[A-Za-z0-9_-]{20,}\b/],
    ["mailgun_key", /\bkey-[0-9a-zA-Z]{32}\b/],
    ["bitbucket_token", /\bATBB[A-Za-z0-9]{20,}\b/],
    ["gitlab_ci_token", /\bgl(?:cbt|dt|rt)-[A-Za-z0-9_-]{20,}\b/],
    ["terraform_token", /\batlasv1\.[A-Za-z0-9]{50,}\b/],
    ["discord_token", /\b[MN][A-Za-z0-9]{23,}\.[\w-]{6}\.[\w-]{27,}\b/],
    ["azure_storage", /(?:DefaultEndpointsProtocol|AccountKey)=[A-Za-z0-9+/=]{20,}/i],
    ["connection_string", new RegExp(CONNECTION_STRING_PASSWORD, "i")],

    ["aws_access_key", /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
    ["anthropic_key", /\bsk-ant-[A-Za-z0-9_-]{20,}\b/],
    ["stripe_key", /\b(?:sk|pk|rk)_(?:test|live)_[A-Za-z0-9]{16,}\b/],
    ["razorpay_key", /\brzp_(?:test|live)_[A-Za-z0-9]{10,}\b/],
    ["ai_api_key", /\bsk-[A-Za-z0-9_-]{16,}\b/],
    ["bearer_token", /\bBearer\s+[A-Za-z0-9_\-.~+/]{8,}=*/i],
    ["slack_token", /\bxox(?:b|p|o|a|r|s)-[A-Za-z0-9-]{10,}\b/i],
    ["database_url", /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|mssql):\/\/[^\s"'<>]+/i],
    // Last: the only entry here that is not a vendor format. Removed by the
    // rule built from the same source in REDACTION_RULES above.
    ["opaque_credential", new RegExp(OPAQUE_CREDENTIAL_SOURCE, "i")],
];


/**
 * Credential classes the DETECTOR reports under a name that no survivor pattern
 * above happens to carry.
 *
 * The two lists were never the same vocabulary, and nothing said so. Survivor
 * patterns are named for what they REDACT; scan categories are named for what
 * the detector MATCHED. Where a vendor has both a strict and a broad rule the
 * names differ — the detector says `openai_api_key`, the survivor pattern says
 * `ai_api_key` — and because `collapseOverlappingMatches` keeps only the
 * highest-scoring match, a real OpenAI key was reported as `openai_api_key`
 * ALONE. The hook, keyed on the survivor names, did not recognise it.
 *
 * Measured on synthetic keys of each vendor's real shape, before this list
 * existed: 4 of 17 credential formats were actually blocked. A genuine OpenAI,
 * Anthropic, Groq, DeepSeek, Azure, Twilio or GitLab CI credential passed
 * straight through the hook that exists to stop it.
 *
 * These names need no survivor pattern of their own: every one of them is
 * already REMOVED by a redaction rule listed above, under that rule's name.
 * Widening the vocabulary therefore cannot cause a fail-closed scrub — it only
 * lets a consumer block on a category the scanner was already reporting.
 */
const BLOCKABLE_DETECTOR_CLASSES: readonly string[] = [
    "openai_api_key",           // redacted by the sk- rule (as ai_api_key)
    "anthropic_api_key",        // redacted by the sk-ant- rule
    "gemini_api_key",           // redacted by the AIza rule
    "groq_api_key",             // redacted by the gsk_ rule
    "deepseek_api_key",         // redacted by the sk- rule
    "aws_secret_key",           // redacted by the aws_secret_access_key rule
    "azure_storage_key",        // redacted by the AccountKey rule
    "twilio_auth_token",        // redacted by the opaque-credential rule (32 hex)
    "gitlab_ci_job_token",      // redacted by the glcbt/gldt/glrt rule
    "connection_string_password", // redacted by the connection-string rule
    "webhook_secret",           // redacted by the hooks.slack.com rule
];

/**
 * The names a consumer may block on: every survivor-verified class above, plus
 * the detector-reported credential classes that are redacted under a different
 * name. `scanBrokerRequest` reports these as scan categories and consumers key
 * their block/allow policy on them — see `HIGH_RISK_SECRET_CLASSES` in
 * @soterai/ide-protocol, which mirrors this list for dependency-free consumers
 * and is pinned to it by a test in the broker.
 *
 * This is a SUPERSET of the survivor patterns, not a mirror of them. Every
 * class the secret detector can report is either in here or carries a written
 * reason for being unblockable — pinned by `secret-class-coverage.test.ts`, so
 * a new detector cannot be added without deciding which.
 */
export const HIGH_RISK_SECRET_CLASS_NAMES: readonly string[] = [
    ...HIGH_RISK_SECRET_PATTERNS.map(([name]) => name),
    ...BLOCKABLE_DETECTOR_CLASSES,
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
