import type { DetectorResult, RegexDetectorSpec } from "../types";
import { runRegexDetectors } from "./utils";

export const SECRET_DETECTOR_VERSION = "1.3.0";

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
        pattern: /(?:aws_secret_access_key|secret_key)\s*[:=]\s*["']?[A-Za-z0-9/+=]{40}["']?/gi,
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
        pattern: /\b(?:api[_-]?key|secret[_-]?key|access[_-]?token|client[_-]?secret)\b\s*[:=]\s*["']?[A-Za-z0-9_\-./+=]{16,}["']?/gi,
        message: "API key or secret assignment detected.",
        confidence: 0.8,
    },
    {
        type: "password_assignment",
        label: "Password",
        severity: "high",
        score: 24,
        pattern: /\b(?:password|passwd|pwd)\b\s*[:=]\s*["']?[^"'\s]{8,}["']?/gi,
        message: "Password-like value detected.",
        confidence: 0.75,
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
        pattern: /(?:twilio[_-]?(?:auth[_-]?)?token)\s*[:=]\s*["']?[0-9a-f]{32}["']?/gi,
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
        pattern: /\b(?:Server|Data Source|Host)=[^;\s]+;[^;\n]*(?:Password|Pwd)=[^;\s]{6,}/gi,
        message: "Database connection string with embedded password detected.",
        confidence: 0.9,
    },
    {
        type: "high_entropy_token",
        label: "High-entropy token assignment",
        severity: "high",
        score: 22,
        pattern: /\b(?:token|secret|api[_-]?key|auth[_-]?key)\b\s*[:=]\s*["']([A-Za-z0-9+/=_-]{32,})["']/gi,
        message: "High-entropy token assignment detected.",
        confidence: 0.65,
        validator: (m) => {
            const val = m.replace(/^[^:=]*[:=]\s*["']?/, "").replace(/["']$/, "");
            return shannonEntropy(val) >= 3.5 && !isPlaceholderValue(val);
        },
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

function isPlaceholderValue(m: string): boolean {
    return /^(?:your|example|dummy|test|fake|sample|placeholder|xxx+|0{8,}|1{8,}|a{8,}|x{8,})/i.test(m.trim());
}

function extractAssignedValue(match: string): string {
    // For assignment-shaped matches (key = value / key: value), evaluate the value side.
    const assigned = match.match(/^[^=:\n]{1,80}[:=]\s*["']?(.+?)["']?\s*$/);
    return (assigned?.[1] ?? match).trim();
}

function isFalsePositive(match: string): boolean {
    const m = match.trim();
    if (m.length < 8) return true;
    const value = extractAssignedValue(m);
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


