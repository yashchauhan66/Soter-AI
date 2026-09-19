import type { DetectorResult, RegexDetectorSpec } from "../types";
import { runRegexDetectors } from "./utils";

export const SECRET_DETECTOR_VERSION = "1.5.0";

/**
 * The keyword→value bridge shared by every keyword-anchored rule below.
 *
 * Credentials reach us in two shapes, and the rules used to see only one:
 *
 *   .env / shell   AGENTROUTER_TOKEN=<value>
 *   JSON / YAML    "AGENTROUTER_TOKEN": "<value>"
 *
 * The old bridge was `\b(?:token|…)\b\s*[:=]`, which is blind to both halves of
 * the JSON form. `\b` cannot match between `AGENTROUTER` and `TOKEN` because `_`
 * is a word character, so a keyword used as an identifier SUFFIX never matched;
 * and in JSON a closing quote sits between the key and the colon, so `\s*[:=]`
 * never reached it either.
 *
 * Measured before this change: `api_key=<48 chars>` was detected, while
 * `AGENTROUTER_TOKEN=<the same 48 chars>` and EVERY JSON form — including a
 * plain `{ "token": "<48 high-entropy chars>" }` — were missed entirely. That
 * gap is load-bearing, because every agent credential file on disk is JSON
 * (`.claude/settings.json`, `.cursor/mcp.json`, `.codex/auth.json`,
 * `.docker/config.json`).
 *
 * Widening the KEY side does not widen what is reported: the value side still
 * has to clear `isFalsePositive()` (placeholder allowlist, entropy, repeated
 * characters), which is where a documentation stub is actually suppressed.
 */
export const KEY_PREFIX = String.raw`[A-Za-z0-9_.\-]{0,40}`;

/**
 * `= value`, `: value`, `": "value"`, `:value` — with optional quoting on both
 * sides. Deliberately a flat, bounded sequence with no nested quantifier: this
 * fragment is interpolated into rules that run over whole files, so it must not
 * be able to backtrack.
 */
export const ASSIGN = String.raw`["']?\s*[:=]\s*["']?`;

/**
 * The keyword set and value shape for an UNKNOWN-VENDOR credential.
 *
 * Exported because `Redactor` must redact exactly what this detects. The two
 * are load-bearing on each other: `opaque_credential` is a high-risk class, and
 * `redactForSharing` hard-fails closed — it replaces the WHOLE message with a
 * placeholder when a high-risk class survives redaction. So a detector that can
 * find a shape the redactor cannot remove does not fail safe, it fails useless.
 */
export const OPAQUE_CREDENTIAL_KEYWORDS = String.raw`(?:secret|token|credentials?|password|passwd|auth|api[_-]?key|access[_-]?key)`;
export const OPAQUE_CREDENTIAL_VALUE = String.raw`[A-Za-z0-9+/=_-]{28,}`;

/**
 * A database connection string carrying an inline password.
 *
 * Shared with `Redactor` for the same reason as the shape above: it is a
 * high-risk class, so its redaction rule and its survivor check must move
 * together or `redactForSharing` starts scrubbing lines it cannot clean.
 *
 * The middle is `[^\n]{0,200}?` and not `[^;\n]*` because a connection string
 * has more than two fields. `[^;\n]*` cannot cross a semicolon, so the rule only
 * ever matched `Server=…;Password=…` — the shape in the test fixtures, and not
 * the shape anyone writes. Measured: every realistic form missed, including the
 * ADO.NET `Data Source=…;Initial Catalog=…;User ID=…;Password=…`, which meant a
 * live database password reached the model reported only as a generic
 * `password_assignment`, a class the hook does not block.
 *
 * Bounded and lazy, with no nested quantifier: this runs over whole files.
 */
export const CONNECTION_STRING_PASSWORD = String.raw`\b(?:Server|Data Source|Host)=[^;\s]+;[^\n]{0,200}?(?:Password|Pwd)=[^;\s]{6,}`;

const SECRET_SPECS: RegexDetectorSpec[] = [
    // ── Cloud Provider Keys ───────────────────────────────────────────────
    {
        type: "openai_api_key",
        label: "OpenAI API key",
        severity: "critical",
        score: 40,
        pattern: /\bsk-[A-Za-z0-9_-]{20,}T3BlbkFJ[A-Za-z0-9_-]{20,}\b/g,
        message: "OpenAI API key detected.",
        confidence: 0.95,
    },
    {
        type: "openai_api_key",
        label: "OpenAI API key (project/service)",
        severity: "critical",
        score: 40,
        pattern: /\bsk-(?:proj|svcacct)-[A-Za-z0-9_-]{30,}\b/g,
        message: "OpenAI project/service API key detected.",
        confidence: 0.95,
    },
    {
        type: "anthropic_api_key",
        label: "Anthropic API key",
        severity: "critical",
        score: 40,
        pattern: /\bsk-ant-[A-Za-z0-9_-]{30,}\b/g,
        message: "Anthropic API key detected.",
        confidence: 0.95,
    },
    {
        type: "gemini_api_key",
        label: "Google Gemini API key",
        severity: "critical",
        score: 38,
        pattern: /\bAIza[A-Za-z0-9_-]{35}\b/g,
        message: "Google API key (possibly Gemini) detected.",
        confidence: 0.9,
    },
    {
        type: "groq_api_key",
        label: "Groq API key",
        severity: "critical",
        score: 38,
        pattern: /\bgsk_[A-Za-z0-9_-]{30,}\b/g,
        message: "Groq API key detected.",
        confidence: 0.9,
    },
    {
        type: "deepseek_api_key",
        label: "DeepSeek API key",
        severity: "critical",
        score: 38,
        pattern: /\bsk-[a-f0-9]{48,}\b/g,
        message: "DeepSeek-like API key detected.",
        confidence: 0.7,
    },
    {
        // Broad catch-all for OpenAI-like `sk-...` keys (dash form) that lack the
        // strict middle marker — covers test/canary/rotated keys. Lower confidence
        // by design; redaction treats it as high-risk regardless.
        type: "ai_api_key",
        label: "AI provider API key (sk-...)",
        severity: "critical",
        score: 35,
        pattern: /\bsk-[A-Za-z0-9_-]{16,}\b/g,
        message: "Generic AI provider API key (sk-...) detected.",
        confidence: 0.7,
    },
    // ── Cloud Provider Credentials ────────────────────────────────────────
    {
        type: "aws_access_key",
        label: "AWS access key",
        severity: "critical",
        score: 40,
        pattern: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g,
        message: "AWS access key detected.",
        confidence: 0.95,
    },
    {
        type: "aws_secret_key",
        label: "AWS secret key",
        severity: "critical",
        score: 45,
        pattern: new RegExp(`\\b${KEY_PREFIX}(?:aws_secret_access_key|secret_key)${ASSIGN}[A-Za-z0-9/+=]{40}["']?`, "gi"),
        message: "AWS secret access key detected.",
        confidence: 0.9,
    },
    // ── VCS Tokens ────────────────────────────────────────────────────────
    {
        type: "github_token",
        label: "GitHub token",
        severity: "critical",
        score: 38,
        pattern: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{20,255}\b/g,
        message: "GitHub token detected.",
        confidence: 0.95,
    },
    {
        type: "gitlab_token",
        label: "GitLab token",
        severity: "critical",
        score: 38,
        pattern: /\bglpat-[A-Za-z0-9_-]{20,}\b/g,
        message: "GitLab personal access token detected.",
        confidence: 0.95,
    },
    // ── Auth Tokens ───────────────────────────────────────────────────────
    {
        type: "jwt",
        label: "JWT token",
        severity: "high",
        score: 30,
        // Relaxed: allow short middle/signature segments (test & unsigned tokens).
        pattern: /\beyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{2,}\.[A-Za-z0-9_-]{2,}\b/g,
        message: "JWT token detected.",
        confidence: 0.8,
    },
    {
        type: "bearer_token",
        label: "Bearer token",
        severity: "high",
        score: 30,
        pattern: /\bBearer\s+[A-Za-z0-9_\-.~+/]+=*\b/gi,
        message: "Bearer authorization token detected.",
        confidence: 0.8,
    },
    // ── Keys & Certificates ───────────────────────────────────────────────
    {
        type: "private_key",
        label: "Private key",
        severity: "critical",
        score: 50,
        pattern: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |ENCRYPTED )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH |DSA |ENCRYPTED )?PRIVATE KEY-----/g,
        message: "Private key material detected.",
        confidence: 0.99,
    },
    // ── Database & Infrastructure ─────────────────────────────────────────
    {
        type: "database_url",
        label: "Database URL",
        severity: "critical",
        score: 42,
        pattern: /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|mssql):\/\/[^\s"'<>]{8,}/gi,
        message: "Database connection URL detected.",
        confidence: 0.95,
    },
    {
        type: "webhook_secret",
        label: "Webhook secret/URL",
        severity: "high",
        score: 28,
        pattern: /\bhttps?:\/\/hooks\.slack\.com\/services\/T[A-Z0-9]{8,}\/B[A-Z0-9]{8,}\/[A-Za-z0-9]{20,}\b/g,
        message: "Slack webhook URL detected.",
        confidence: 0.95,
    },
    // ── Payment Tokens ────────────────────────────────────────────────────
    {
        type: "stripe_key",
        label: "Stripe API key",
        severity: "critical",
        score: 40,
        pattern: /\b(?:sk|pk|rk)_(?:test|live)_[A-Za-z0-9]{20,}\b/g,
        message: "Stripe API key detected.",
        confidence: 0.95,
    },
    {
        type: "razorpay_key",
        label: "Razorpay key",
        severity: "critical",
        score: 38,
        pattern: /\brzp_(?:test|live)_[A-Za-z0-9]{14,}\b/g,
        message: "Razorpay API key detected.",
        confidence: 0.95,
    },
    // ── Generic Patterns ──────────────────────────────────────────────────
    {
        type: "generic_api_key",
        label: "API key assignment",
        severity: "high",
        score: 25,
        pattern: new RegExp(
            `\\b${KEY_PREFIX}(?:api[_-]?key|secret[_-]?key|access[_-]?token|client[_-]?secret)${ASSIGN}[A-Za-z0-9_\\-./+=]{16,}["']?`,
            "gi",
        ),
        message: "API key or secret assignment detected.",
        confidence: 0.8,
    },
    {
        type: "password_assignment",
        label: "Password",
        severity: "high",
        score: 24,
        pattern: new RegExp(`\\b${KEY_PREFIX}(?:password|passwd|pwd)${ASSIGN}[^"'\\s]{8,}["']?`, "gi"),
        message: "Password-like value detected.",
        confidence: 0.75,
        // A single short all-lowercase word is a service default, not a password:
        // `POSTGRES_PASSWORD: postgres` in a CI compose file was the loudest
        // remaining source of noise. The length bound keeps real passphrases
        // (`correcthorsebatterystaple`) reported.
        validator: (m) => {
            const v = extractAssignedValue(m).replace(/["']/g, "");
            return !(/^[a-z]+$/.test(v) && v.length <= 12);
        },
    },
    {
        type: "slack_token",
        label: "Slack token",
        severity: "critical",
        score: 36,
        pattern: /\bxox(?:b|p|o|a|r|s)-[A-Za-z0-9-]{10,}\b/gi,
        message: "Slack token detected.",
        confidence: 0.95,
    },
    // ── Phase 4 expansions (v1.2.0) ───────────────────────────────────────
    {
        type: "huggingface_token",
        label: "Hugging Face token",
        severity: "critical",
        score: 38,
        pattern: /\bhf_[A-Za-z0-9]{20,}\b/g,
        message: "Hugging Face access token detected.",
        confidence: 0.95,
    },
    {
        type: "npm_token",
        label: "npm access token",
        severity: "critical",
        score: 38,
        pattern: /\bnpm_[A-Za-z0-9]{36,}\b/g,
        message: "npm access token detected.",
        confidence: 0.95,
    },
    {
        type: "pypi_token",
        label: "PyPI API token",
        severity: "critical",
        score: 38,
        pattern: /\bpypi-[A-Za-z0-9_-]{20,}\b/g,
        message: "PyPI API token detected.",
        confidence: 0.95,
    },
    {
        type: "sendgrid_key",
        label: "SendGrid API key",
        severity: "critical",
        score: 38,
        pattern: /\bSG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}\b/g,
        message: "SendGrid API key detected.",
        confidence: 0.95,
    },
    {
        type: "twilio_sid",
        label: "Twilio Account SID",
        severity: "high",
        score: 30,
        pattern: /\bAC[a-f0-9]{32}\b/g,
        message: "Twilio Account SID detected.",
        confidence: 0.9,
    },
    {
        type: "azure_storage_key",
        label: "Azure storage connection string",
        severity: "critical",
        score: 42,
        pattern: /(?:DefaultEndpointsProtocol|AccountKey)=[A-Za-z0-9+/=]{20,}/gi,
        message: "Azure storage connection string fragment detected.",
        confidence: 0.9,
    },
    {
        type: "discord_token",
        label: "Discord bot token",
        severity: "critical",
        score: 38,
        pattern: /\b[MN][A-Za-z0-9]{23,}\.[\w-]{6}\.[\w-]{27,}\b/g,
        message: "Discord bot token detected.",
        confidence: 0.85,
    },
    {
        type: "digitalocean_token",
        label: "DigitalOcean token",
        severity: "critical",
        score: 36,
        pattern: /\bdop_v1_[a-f0-9]{64}\b/g,
        message: "DigitalOcean personal access token detected.",
        confidence: 0.95,
    },
    {
        type: "shopify_token",
        label: "Shopify access token",
        severity: "critical",
        score: 38,
        pattern: /\bshpat_[a-fA-F0-9]{32}\b/g,
        message: "Shopify private app access token detected.",
        confidence: 0.95,
    },
    {
        type: "databricks_token",
        label: "Databricks token",
        severity: "critical",
        score: 36,
        // Real Databricks PATs are dapi + 32 hex; accept 32+ for rotated/longer forms.
        pattern: /\bdapi[a-f0-9]{32,}\b/gi,
        message: "Databricks personal access token detected.",
        confidence: 0.9,
    },
    {
        type: "supabase_key",
        label: "Supabase key",
        severity: "high",
        score: 32,
        pattern: /\bsb[pa]_[A-Za-z0-9_-]{20,}\b/g,
        message: "Supabase publishable/secret key detected.",
        confidence: 0.85,
    },
    // ── Phase 4 v1.3.0 expansions ─────────────────────────────────────────
    {
        type: "bitbucket_token",
        label: "Bitbucket app password / token",
        severity: "critical",
        score: 36,
        pattern: /\bATBB[A-Za-z0-9]{20,}\b/g,
        message: "Bitbucket access token detected.",
        confidence: 0.9,
    },
    {
        type: "heroku_key",
        label: "Heroku API key",
        severity: "critical",
        score: 36,
        pattern: /\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/g,
        message: "UUID-shaped credential (possible Heroku API key) detected.",
        confidence: 0.55,
        validator: (m) => /heroku|api[_-]?key|HEROKU/i.test(m) || false,
    },
    {
        type: "mailgun_key",
        label: "Mailgun API key",
        severity: "critical",
        score: 36,
        pattern: /\bkey-[0-9a-zA-Z]{32}\b/g,
        message: "Mailgun API key detected.",
        confidence: 0.9,
    },
    {
        type: "twilio_auth_token",
        label: "Twilio Auth Token assignment",
        severity: "critical",
        score: 38,
        pattern: new RegExp(`\\b${KEY_PREFIX}(?:twilio[_-]?(?:auth[_-]?)?token)${ASSIGN}[0-9a-f]{32}["']?`, "gi"),
        message: "Twilio auth token assignment detected.",
        confidence: 0.9,
    },
    {
        type: "docker_pat",
        label: "Docker Hub personal access token",
        severity: "critical",
        score: 36,
        pattern: /\bdckr_pat_[A-Za-z0-9_-]{20,}\b/g,
        message: "Docker Hub personal access token detected.",
        confidence: 0.95,
    },
    {
        type: "github_fine_grained",
        label: "GitHub fine-grained PAT",
        severity: "critical",
        score: 38,
        pattern: /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g,
        message: "GitHub fine-grained personal access token detected.",
        confidence: 0.95,
    },
    {
        type: "gitlab_ci_job_token",
        label: "GitLab CI job / deploy token",
        severity: "critical",
        score: 36,
        pattern: /\bgl(?:cbt|dt|rt)-[A-Za-z0-9_-]{20,}\b/g,
        message: "GitLab CI/deploy/runner token detected.",
        confidence: 0.9,
    },
    {
        type: "terraform_token",
        label: "Terraform Cloud / Enterprise token",
        severity: "critical",
        score: 36,
        // Terraform Cloud user tokens: atlasv1.<50+ base62 chars>
        pattern: /\batlasv1\.[A-Za-z0-9]{50,}\b/g,
        message: "Terraform Cloud / Enterprise token detected.",
        confidence: 0.95,
    },

    {
        type: "connection_string_password",
        label: "Connection string with embedded password",
        severity: "critical",
        score: 40,
        pattern: new RegExp(CONNECTION_STRING_PASSWORD, "gi"),
        message: "Database connection string with embedded password detected.",
        confidence: 0.9,
    },
    {
        type: "high_entropy_token",
        label: "High-entropy token assignment",
        severity: "high",
        score: 22,
        // Quoting is optional on BOTH sides: the quoted form is JSON/YAML, the
        // unquoted form is `.env`. Requiring quotes here used to mean a bare
        // `TOKEN=<48 high-entropy chars>` in a shell env file was never a match.
        // `auth` and `credential` are safe to accept as bare keywords here only
        // because ASSIGN anchors what follows: `author: "…"` cannot match, since
        // after `auth` the next character must be a quote, colon or equals.
        pattern: new RegExp(`\\b${KEY_PREFIX}(?:token|secret|credentials?|auth|api[_-]?key|auth[_-]?key)${ASSIGN}([A-Za-z0-9+/=_-]{32,})["']?`, "gi"),
        message: "High-entropy token assignment detected.",
        confidence: 0.65,
        validator: (m) => {
            const val = m.replace(/^[^:=]*[:=]\s*["']?/, "").replace(/["']$/, "");
            return shannonEntropy(val) >= 3.5 && !isPlaceholderValue(val);
        },
    },
    {
        type: "opaque_credential",
        label: "Credential for an unrecognised vendor",
        severity: "critical",
        // 26 is chosen against `collapseOverlappingMatches`, which keeps only
        // the highest-scoring match in an overlapping span. It must sit ABOVE
        // the three generic classes this one supersedes (high_entropy_token 22,
        // password_assignment 24, generic_api_key 25) and BELOW every named
        // class, the lowest of which is webhook_secret at 28.
        //
        // "Below every named class" is not conservatism, it is a measured
        // requirement. PARTIAL overlap is enough to collapse: on
        // `JWT_SECRET=eyJhbGci….….…`, this rule's value stops at the first dot
        // while `jwt` spans the whole token, and the two spans still intersect.
        // At 31 this rule won that collapse and the `jwt` category vanished from
        // the scan — caught by the broker's production-.env test. Losing a
        // category is not cosmetic: the hook's block list is keyed on category
        // names, so swallowing a named class can silently un-block it.
        score: 26,
        pattern: new RegExp(
            `\\b${KEY_PREFIX}${OPAQUE_CREDENTIAL_KEYWORDS}${ASSIGN}${OPAQUE_CREDENTIAL_VALUE}["']?`,
            "gi",
        ),
        message: "Credential-shaped value assigned to a credential-named key (vendor not recognised).",
        confidence: 0.85,
        validator: isOpaqueCredential,
    },
];

/** Values that look secret-shaped but are known placeholders / docs examples. */
const FALSE_POSITIVE_ALLOWLIST: RegExp[] = [
    // Whole-match placeholders only (do not over-match substrings of real tokens).
    /^(?:YOUR[_-]?API[_-]?KEY(?:[_-]?HERE)?|INSERT[_-]?API[_-]?KEY|REPLACE[_-]?ME|xxx+|placeholder|example[_-]?key|dummy[_-]?secret|changeme|not[_-]?a[_-]?real[_-]?key)$/i,
    // Explicit stub prefixes — require the stub form, not "sk-test" buried in longer real keys.
    /^sk-(?:test|example|fake|dummy)(?:[-_].*)?$/i,
    // AWS docs example key (AKIA…EXAMPLE).
    /^AKIA[A-Z0-9]{0,10}EXAMPLE$/i,
    // Pure repeated single character (after stripping non-alnum).
    /^(.)\1{15,}$/i,
];

function shannonEntropy(s: string): number {
    if (!s.length) return 0;
    const freq = new Map<string, number>();
    for (const ch of s) freq.set(ch, (freq.get(ch) ?? 0) + 1);
    let h = 0;
    for (const c of freq.values()) {
        const p = c / s.length;
        h -= p * Math.log2(p);
    }
    return h;
}

/**
 * Placeholder heuristic for the *value* side of an assignment.
 *
 * A bare prefix test is too aggressive: real-world credentials routinely start
 * with these words (`test_sk_live_...`, environment-scoped keys, zero-padded
 * account ids), and suppressing them is a false NEGATIVE — the secret ships to
 * the model with no finding at all. A genuine placeholder is short and
 * low-entropy; a real credential is long and high-entropy. Require BOTH the
 * placeholder prefix AND low entropy before suppressing.
 */
function isPlaceholderValue(m: string): boolean {
    const v = m.trim();
    if (!/^(?:your|example|dummy|test|fake|sample|placeholder|xxx+|0{8,}|1{8,}|a{8,}|x{8,})/i.test(v)) return false;
    // High-entropy content after a "test"-ish prefix is a real credential shape,
    // not documentation. Keep it.
    if (shannonEntropy(v) >= 3.5) return false;
    // Long values are not hand-typed placeholders regardless of prefix.
    if (v.length >= 32) return false;
    return true;
}

function extractAssignedValue(match: string): string {
    // For assignment-shaped matches (key = value / key: value), evaluate the value side.
    const assigned = match.match(/^[^=:\n]{1,80}[:=]\s*["']?(.+?)["']?\s*$/);
    return (assigned?.[1] ?? match).trim();
}

/**
 * A value that NAMES where a secret lives is not a secret.
 *
 * `apiKey: process.env.SOTER_API_KEY` is the CORRECT way to hold a credential,
 * and reporting it is pure over-defense — it would make the guard object to
 * ordinary source files precisely for doing the right thing. Measured while
 * widening the keyword bridge above, this one shape was the single largest
 * source of new findings across this repo, far ahead of any real secret.
 *
 * Anchored at the START of the value so a reference is suppressed while a
 * literal that merely mentions one (`"sk-live-process-env"`) is not.
 */
function isSecretReference(value: string): boolean {
    return (
        /^(?:process\.env|import\.meta\.env|os\.environ|Deno\.env|System\.getenv|ENV|process\[)\b/i.test(value) ||
        /^\$\{?\{?\s*(?:secrets|env|vars|inputs)\./i.test(value) ||   // ${{ secrets.X }}
        /^\$\{[A-Za-z_][A-Za-z0-9_]*\}$/.test(value) ||               // ${VAR}
        /^\$[A-Za-z_][A-Za-z0-9_]*$/.test(value) ||                   // $VAR
        /^%[A-Za-z_][A-Za-z0-9_]*%$/.test(value) ||                   // %VAR%
        /^<[^<>]{1,60}>$/.test(value) ||                              // <your-key-here>
        /^\{\{[^{}]{1,60}\}\}$/.test(value) ||                        // {{ placeholder }}
        isIdentifierExpression(value)
    );
}

/**
 * A dotted code identifier — `Prisma.ApiKeyGetPayload`, `previous.soterApiKey`
 * — is a reference to a value, not the value. Same family as `process.env.X`,
 * found in the same measurement: a type alias and a property read were being
 * reported as API keys.
 *
 * The length bounds are what keep real credentials out. A JWT is also
 * dot-separated `[A-Za-z0-9_-]`, but its segments run far past 20 characters,
 * as do SendGrid's (`SG.<22>.<43>`); both stay detected.
 */
function isIdentifierExpression(value: string): boolean {
    if (value.length > 60 || !value.includes(".")) return false;
    if (!/^[A-Za-z_$][A-Za-z0-9_$]*(?:\.[A-Za-z_$][A-Za-z0-9_$]*)+$/.test(value)) return false;
    return value.split(".").every((seg) => seg.length <= 20);
}

/**
 * Documentation placeholders that are not anchored at the start of the value.
 *
 * `isPlaceholderValue` only looks at the first word, so it cannot see
 * `ck_live_your_key_here` or `ci-report-signing-secret-at-least-thirty-two-chars`
 * — both of which are long and high-entropy enough to clear every other gate.
 * These matter more than they look: once a generic class can BLOCK, a stale
 * placeholder in a quickstart doc becomes a refusal the user cannot explain.
 *
 * Tested per word, so a real credential is unaffected — an opaque token does
 * not split into English words on `_`, `-` or `.`.
 */
const PLACEHOLDER_WORDS =
    /^(?:your|yours|mine|here|placeholder|changeme|change|replace|replaceme|example|examples|sample|dummy|fake|todo|insert|redacted|omitted|hidden|somekey|sometoken|dashboard|at|least|thirty|two|chars|characters)$/i;

function hasPlaceholderWord(value: string): boolean {
    const words = value.split(/[_\-.\s]+/).filter(Boolean);
    if (words.length < 3) return false;              // opaque tokens do not split into words
    const hits = words.filter((w) => PLACEHOLDER_WORDS.test(w)).length;
    return hits >= 2;                                 // one coincidence is not a placeholder
}

/**
 * Key names whose value is credential-SHAPED but not a credential.
 *
 * Only the prefix position needs covering. The bridge is
 * `KEY_PREFIX + keyword + ASSIGN`, so the matched key always *ends* with the
 * credential keyword — `token_name:` or `secret_type:` never match in the first
 * place, and only what sits in front of the keyword can mislead us.
 *
 * The separator anchors are load-bearing: without them `test` would suppress
 * `latest_token` and `attestation_token`, which are credentials.
 *
 * `test` is here deliberately. A key literally named `test_*` in checked-in
 * source is overwhelmingly a fixture, and a genuine test-environment credential
 * still has its vendor shape (`sk_test_`, `rzp_test_`) matched by the rules
 * above, which do not consult this list.
 */
const NON_CREDENTIAL_KEY =
    /(?:^|[_.\-])(?:pub|public|publishable|anon|hashed|fingerprint|thumbprint|checksum|integrity|digest|etag|hash|sha\d*|md5|crc\d*|algorithm|algo|encoding|scheme|prefix|header|pattern|regex|expected|mock|fake|dummy|example|sample|placeholder|fixture|stub|invalid|revoked|redacted|masked|test)(?:[_.\-]|$)/i;

/**
 * The gate that makes an unknown-vendor credential safe to BLOCK on.
 *
 * Every other high-risk class is a vendor format — `ghp_…`, `sk-ant-…` — so its
 * regex alone is proof. This class has no format to lean on: the only evidence
 * is that a credential-named key holds a credential-shaped value. Blocking on
 * that is only honest if the shape test is strict, because a false positive here
 * is no longer a noisy warning — it is a refusal the user cannot explain.
 *
 * Hence four independent gates, each of which alone would be too weak:
 * the key must not name a public or derived value, the value must be long,
 * mixed-case-or-digit, and high-entropy. A slug, a hex id, an all-caps
 * constant, a documentation placeholder and an English phrase each fail at
 * least one.
 */
function isOpaqueCredential(match: string): boolean {
    const assignAt = match.search(/["']?\s*[:=]/);
    if (assignAt <= 0) return false;
    const key = match.slice(0, assignAt);
    if (NON_CREDENTIAL_KEY.test(key)) return false;

    const value = extractAssignedValue(match).replace(/["']+$/, "");
    if (value.length < 28) return false;

    // Checked before entropy: a long hyphenated English default clears 3.6 bits
    // comfortably, so entropy on its own would not catch it.
    const words = value.split(/[_\-.]+/).filter(Boolean);
    if (words.length >= 4 && words.every((w) => /^[A-Za-z]+$/.test(w))) return false;

    // Two character classes is what separates a generated credential from a
    // slug, a lowercase hex id, or an ALL_CAPS constant name.
    const classes = [/[a-z]/, /[A-Z]/, /[0-9]/].filter((re) => re.test(value)).length;
    if (classes < 2) return false;

    return shannonEntropy(value) >= 3.6;
}

function isFalsePositive(match: string): boolean {
    const m = match.trim();
    if (m.length < 8) return true;
    const value = extractAssignedValue(m);
    if (isSecretReference(value)) return true;
    if (hasPlaceholderWord(value)) return true;
    // Provider-prefixed real tokens must never be suppressed by generic FP rules
    // except explicit stub forms (sk-test-..., sk-example-...).
    const providerPrefixed =
        /^(?:hf_|npm_|pypi-|dapi|dop_v1_|shpat_|sb[pa]_|dckr_pat_|github_pat_|glpat-|glcbt-|gldt-|glrt-|xox[bpoars]-|AKIA|ASIA|SG\.|ATBB|atlasv1\.|key-)/i.test(value) ||
        /^(?:sk-ant-|sk-proj-|sk-svcacct-|gsk_)/i.test(value) ||
        /^(?:sk|pk|rk)_(?:live)_[A-Za-z0-9]/i.test(value);

    if (providerPrefixed) {
        // A real provider prefix plus the provider's exact body shape is a
        // credential format, not a placeholder. Do NOT suppress it for low body
        // entropy (e.g. repeated chars): entropy is not a validity signal for a
        // fixed-format token, and these bodies are assigned by the provider, not
        // chosen by the user. Placeholder suppression lives in the allowlist /
        // stub branches below, which target non-provider shapes.
        return false;
    }
    for (const re of FALSE_POSITIVE_ALLOWLIST) {
        re.lastIndex = 0;
        if (re.test(m) || re.test(value)) return true;
    }
    if (isPlaceholderValue(value)) return true;
    // Pure placeholder hex / repeated chars on the whole match or value
    for (const candidate of [m, value]) {
        const alnum = candidate.replace(/[^A-Za-z0-9]/g, "");
        if (alnum.length >= 16 && /^(.)\1+$/i.test(alnum)) return true;
    }
    // AWS example key embedded in longer assignment text
    if (/\bAKIA[A-Z0-9]{16}\b/i.test(m) && /\bEXAMPLE\b/i.test(m)) return true;
    return false;
}



/**
 * Every class this detector can report, in declaration order.
 *
 * Exported so `secret-class-coverage.test.ts` can hold the block vocabulary to
 * account. A scan category that no consumer recognises is a credential the hook
 * silently allows, and that is invisible from inside either list on its own.
 */
export const SECRET_DETECTOR_CLASSES: readonly string[] = [...new Set(SECRET_SPECS.map((s) => s.type))];

export function detectSecrets(text: string): DetectorResult {
    const raw = runRegexDetectors(text, SECRET_SPECS);
    // Phase 4 FP control: drop known placeholders / docs examples so they do
    // not inflate risk scores or trigger redaction of intentional stubs.
    const matches = raw.filter((m) => !isFalsePositive(m.match));
    return {
        detectorName: "SecretDetector",
        detectorVersion: SECRET_DETECTOR_VERSION,
        matches,
    };
}


