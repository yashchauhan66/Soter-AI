var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// packages/core/src/RegisteredSecretMatcher.ts
var RegisteredSecretMatcher_exports = {};
__export(RegisteredSecretMatcher_exports, {
  F19_DIAGNOSTIC: () => F19_DIAGNOSTIC,
  RegisteredSecretMatcher: () => RegisteredSecretMatcher,
  SECRET_ENTROPY_POLICY: () => SECRET_ENTROPY_POLICY,
  SECRET_MATCH_LIMITS: () => SECRET_MATCH_LIMITS
});
module.exports = __toCommonJS(RegisteredSecretMatcher_exports);
var import_node_util = require("node:util");

// packages/guard-core/src/detectors/utils.ts
function runRegexDetectors(text, specs) {
  const matches = [];
  for (const spec of specs) {
    const pattern = ensureGlobal(spec.pattern);
    let m;
    while ((m = pattern.exec(text)) !== null) {
      const value = m[0];
      if (!value) continue;
      if (spec.validator && !spec.validator(value)) continue;
      matches.push({
        type: spec.type,
        label: spec.label,
        severity: spec.severity,
        score: spec.score,
        start: m.index,
        end: m.index + value.length,
        match: value,
        message: spec.message,
        confidence: spec.confidence ?? 0.9
      });
    }
  }
  return matches;
}
var globalPatternCache = /* @__PURE__ */ new WeakMap();
function ensureGlobal(pattern) {
  if (pattern.global) {
    pattern.lastIndex = 0;
    return pattern;
  }
  let cached = globalPatternCache.get(pattern);
  if (!cached) {
    cached = new RegExp(pattern.source, `${pattern.flags}g`);
    globalPatternCache.set(pattern, cached);
  }
  cached.lastIndex = 0;
  return cached;
}

// packages/guard-core/src/detectors/SecretDetector.ts
var SECRET_DETECTOR_VERSION = "1.5.0";
var KEY_PREFIX = String.raw`[A-Za-z0-9_.\-]{0,40}`;
var ASSIGN = String.raw`["']?\s*[:=]\s*["']?`;
var OPAQUE_CREDENTIAL_KEYWORDS = String.raw`(?:secret|token|credentials?|password|passwd|auth|api[_-]?key|access[_-]?key)`;
var OPAQUE_CREDENTIAL_VALUE = String.raw`[A-Za-z0-9+/=_-]{28,}`;
var CONNECTION_STRING_PASSWORD = String.raw`\b(?:Server|Data Source|Host)=[^;\s]+;[^\n]{0,200}?(?:Password|Pwd)=[^;\s]{6,}`;
var SECRET_SPECS = [
  // ── Cloud Provider Keys ───────────────────────────────────────────────
  {
    type: "openai_api_key",
    label: "OpenAI API key",
    severity: "critical",
    score: 40,
    pattern: /\bsk-[A-Za-z0-9_-]{20,}T3BlbkFJ[A-Za-z0-9_-]{20,}\b/g,
    message: "OpenAI API key detected.",
    confidence: 0.95
  },
  {
    type: "openai_api_key",
    label: "OpenAI API key (project/service)",
    severity: "critical",
    score: 40,
    pattern: /\bsk-(?:proj|svcacct)-[A-Za-z0-9_-]{30,}\b/g,
    message: "OpenAI project/service API key detected.",
    confidence: 0.95
  },
  {
    type: "anthropic_api_key",
    label: "Anthropic API key",
    severity: "critical",
    score: 40,
    pattern: /\bsk-ant-[A-Za-z0-9_-]{30,}\b/g,
    message: "Anthropic API key detected.",
    confidence: 0.95
  },
  {
    type: "gemini_api_key",
    label: "Google Gemini API key",
    severity: "critical",
    score: 38,
    pattern: /\bAIza[A-Za-z0-9_-]{35}\b/g,
    message: "Google API key (possibly Gemini) detected.",
    confidence: 0.9
  },
  {
    type: "groq_api_key",
    label: "Groq API key",
    severity: "critical",
    score: 38,
    pattern: /\bgsk_[A-Za-z0-9_-]{30,}\b/g,
    message: "Groq API key detected.",
    confidence: 0.9
  },
  {
    type: "deepseek_api_key",
    label: "DeepSeek API key",
    severity: "critical",
    score: 38,
    pattern: /\bsk-[a-f0-9]{48,}\b/g,
    message: "DeepSeek-like API key detected.",
    confidence: 0.7
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
    confidence: 0.7
  },
  // ── Cloud Provider Credentials ────────────────────────────────────────
  {
    type: "aws_access_key",
    label: "AWS access key",
    severity: "critical",
    score: 40,
    pattern: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g,
    message: "AWS access key detected.",
    confidence: 0.95
  },
  {
    type: "aws_secret_key",
    label: "AWS secret key",
    severity: "critical",
    score: 45,
    pattern: new RegExp(`\\b${KEY_PREFIX}(?:aws_secret_access_key|secret_key)${ASSIGN}[A-Za-z0-9/+=]{40}["']?`, "gi"),
    message: "AWS secret access key detected.",
    confidence: 0.9
  },
  // ── VCS Tokens ────────────────────────────────────────────────────────
  {
    type: "github_token",
    label: "GitHub token",
    severity: "critical",
    score: 38,
    pattern: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{20,255}\b/g,
    message: "GitHub token detected.",
    confidence: 0.95
  },
  {
    type: "gitlab_token",
    label: "GitLab token",
    severity: "critical",
    score: 38,
    pattern: /\bglpat-[A-Za-z0-9_-]{20,}\b/g,
    message: "GitLab personal access token detected.",
    confidence: 0.95
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
    confidence: 0.8
  },
  {
    type: "bearer_token",
    label: "Bearer token",
    severity: "high",
    score: 30,
    pattern: /\bBearer\s+[A-Za-z0-9_\-.~+/]+=*\b/gi,
    message: "Bearer authorization token detected.",
    confidence: 0.8
  },
  // ── Keys & Certificates ───────────────────────────────────────────────
  {
    type: "private_key",
    label: "Private key",
    severity: "critical",
    score: 50,
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |ENCRYPTED )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH |DSA |ENCRYPTED )?PRIVATE KEY-----/g,
    message: "Private key material detected.",
    confidence: 0.99
  },
  // ── Database & Infrastructure ─────────────────────────────────────────
  {
    type: "database_url",
    label: "Database URL",
    severity: "critical",
    score: 42,
    pattern: /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|mssql):\/\/[^\s"'<>]{8,}/gi,
    message: "Database connection URL detected.",
    confidence: 0.95
  },
  {
    type: "webhook_secret",
    label: "Webhook secret/URL",
    severity: "high",
    score: 28,
    pattern: /\bhttps?:\/\/hooks\.slack\.com\/services\/T[A-Z0-9]{8,}\/B[A-Z0-9]{8,}\/[A-Za-z0-9]{20,}\b/g,
    message: "Slack webhook URL detected.",
    confidence: 0.95
  },
  // ── Payment Tokens ────────────────────────────────────────────────────
  {
    type: "stripe_key",
    label: "Stripe API key",
    severity: "critical",
    score: 40,
    pattern: /\b(?:sk|pk|rk)_(?:test|live)_[A-Za-z0-9]{20,}\b/g,
    message: "Stripe API key detected.",
    confidence: 0.95
  },
  {
    type: "razorpay_key",
    label: "Razorpay key",
    severity: "critical",
    score: 38,
    pattern: /\brzp_(?:test|live)_[A-Za-z0-9]{14,}\b/g,
    message: "Razorpay API key detected.",
    confidence: 0.95
  },
  // ── Generic Patterns ──────────────────────────────────────────────────
  {
    type: "generic_api_key",
    label: "API key assignment",
    severity: "high",
    score: 25,
    pattern: new RegExp(
      `\\b${KEY_PREFIX}(?:api[_-]?key|secret[_-]?key|access[_-]?token|client[_-]?secret)${ASSIGN}[A-Za-z0-9_\\-./+=]{16,}["']?`,
      "gi"
    ),
    message: "API key or secret assignment detected.",
    confidence: 0.8
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
    }
  },
  {
    type: "slack_token",
    label: "Slack token",
    severity: "critical",
    score: 36,
    pattern: /\bxox(?:b|p|o|a|r|s)-[A-Za-z0-9-]{10,}\b/gi,
    message: "Slack token detected.",
    confidence: 0.95
  },
  // ── Phase 4 expansions (v1.2.0) ───────────────────────────────────────
  {
    type: "huggingface_token",
    label: "Hugging Face token",
    severity: "critical",
    score: 38,
    pattern: /\bhf_[A-Za-z0-9]{20,}\b/g,
    message: "Hugging Face access token detected.",
    confidence: 0.95
  },
  {
    type: "npm_token",
    label: "npm access token",
    severity: "critical",
    score: 38,
    pattern: /\bnpm_[A-Za-z0-9]{36,}\b/g,
    message: "npm access token detected.",
    confidence: 0.95
  },
  {
    type: "pypi_token",
    label: "PyPI API token",
    severity: "critical",
    score: 38,
    pattern: /\bpypi-[A-Za-z0-9_-]{20,}\b/g,
    message: "PyPI API token detected.",
    confidence: 0.95
  },
  {
    type: "sendgrid_key",
    label: "SendGrid API key",
    severity: "critical",
    score: 38,
    pattern: /\bSG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}\b/g,
    message: "SendGrid API key detected.",
    confidence: 0.95
  },
  {
    type: "twilio_sid",
    label: "Twilio Account SID",
    severity: "high",
    score: 30,
    pattern: /\bAC[a-f0-9]{32}\b/g,
    message: "Twilio Account SID detected.",
    confidence: 0.9
  },
  {
    type: "azure_storage_key",
    label: "Azure storage connection string",
    severity: "critical",
    score: 42,
    pattern: /(?:DefaultEndpointsProtocol|AccountKey)=[A-Za-z0-9+/=]{20,}/gi,
    message: "Azure storage connection string fragment detected.",
    confidence: 0.9
  },
  {
    type: "discord_token",
    label: "Discord bot token",
    severity: "critical",
    score: 38,
    pattern: /\b[MN][A-Za-z0-9]{23,}\.[\w-]{6}\.[\w-]{27,}\b/g,
    message: "Discord bot token detected.",
    confidence: 0.85
  },
  {
    type: "digitalocean_token",
    label: "DigitalOcean token",
    severity: "critical",
    score: 36,
    pattern: /\bdop_v1_[a-f0-9]{64}\b/g,
    message: "DigitalOcean personal access token detected.",
    confidence: 0.95
  },
  {
    type: "shopify_token",
    label: "Shopify access token",
    severity: "critical",
    score: 38,
    pattern: /\bshpat_[a-fA-F0-9]{32}\b/g,
    message: "Shopify private app access token detected.",
    confidence: 0.95
  },
  {
    type: "databricks_token",
    label: "Databricks token",
    severity: "critical",
    score: 36,
    // Real Databricks PATs are dapi + 32 hex; accept 32+ for rotated/longer forms.
    pattern: /\bdapi[a-f0-9]{32,}\b/gi,
    message: "Databricks personal access token detected.",
    confidence: 0.9
  },
  {
    type: "supabase_key",
    label: "Supabase key",
    severity: "high",
    score: 32,
    pattern: /\bsb[pa]_[A-Za-z0-9_-]{20,}\b/g,
    message: "Supabase publishable/secret key detected.",
    confidence: 0.85
  },
  // ── Phase 4 v1.3.0 expansions ─────────────────────────────────────────
  {
    type: "bitbucket_token",
    label: "Bitbucket app password / token",
    severity: "critical",
    score: 36,
    pattern: /\bATBB[A-Za-z0-9]{20,}\b/g,
    message: "Bitbucket access token detected.",
    confidence: 0.9
  },
  {
    type: "heroku_key",
    label: "Heroku API key",
    severity: "critical",
    score: 36,
    pattern: /\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/g,
    message: "UUID-shaped credential (possible Heroku API key) detected.",
    confidence: 0.55,
    validator: (m) => /heroku|api[_-]?key|HEROKU/i.test(m) || false
  },
  {
    type: "mailgun_key",
    label: "Mailgun API key",
    severity: "critical",
    score: 36,
    pattern: /\bkey-[0-9a-zA-Z]{32}\b/g,
    message: "Mailgun API key detected.",
    confidence: 0.9
  },
  {
    type: "twilio_auth_token",
    label: "Twilio Auth Token assignment",
    severity: "critical",
    score: 38,
    pattern: new RegExp(`\\b${KEY_PREFIX}(?:twilio[_-]?(?:auth[_-]?)?token)${ASSIGN}[0-9a-f]{32}["']?`, "gi"),
    message: "Twilio auth token assignment detected.",
    confidence: 0.9
  },
  {
    type: "docker_pat",
    label: "Docker Hub personal access token",
    severity: "critical",
    score: 36,
    pattern: /\bdckr_pat_[A-Za-z0-9_-]{20,}\b/g,
    message: "Docker Hub personal access token detected.",
    confidence: 0.95
  },
  {
    type: "github_fine_grained",
    label: "GitHub fine-grained PAT",
    severity: "critical",
    score: 38,
    pattern: /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g,
    message: "GitHub fine-grained personal access token detected.",
    confidence: 0.95
  },
  {
    type: "gitlab_ci_job_token",
    label: "GitLab CI job / deploy token",
    severity: "critical",
    score: 36,
    pattern: /\bgl(?:cbt|dt|rt)-[A-Za-z0-9_-]{20,}\b/g,
    message: "GitLab CI/deploy/runner token detected.",
    confidence: 0.9
  },
  {
    type: "terraform_token",
    label: "Terraform Cloud / Enterprise token",
    severity: "critical",
    score: 36,
    // Terraform Cloud user tokens: atlasv1.<50+ base62 chars>
    pattern: /\batlasv1\.[A-Za-z0-9]{50,}\b/g,
    message: "Terraform Cloud / Enterprise token detected.",
    confidence: 0.95
  },
  {
    type: "connection_string_password",
    label: "Connection string with embedded password",
    severity: "critical",
    score: 40,
    pattern: new RegExp(CONNECTION_STRING_PASSWORD, "gi"),
    message: "Database connection string with embedded password detected.",
    confidence: 0.9
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
    }
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
      "gi"
    ),
    message: "Credential-shaped value assigned to a credential-named key (vendor not recognised).",
    confidence: 0.85,
    validator: isOpaqueCredential
  }
];
var FALSE_POSITIVE_ALLOWLIST = [
  // Whole-match placeholders only (do not over-match substrings of real tokens).
  /^(?:YOUR[_-]?API[_-]?KEY(?:[_-]?HERE)?|INSERT[_-]?API[_-]?KEY|REPLACE[_-]?ME|xxx+|placeholder|example[_-]?key|dummy[_-]?secret|changeme|not[_-]?a[_-]?real[_-]?key)$/i,
  // Explicit stub prefixes — require the stub form, not "sk-test" buried in longer real keys.
  /^sk-(?:test|example|fake|dummy)(?:[-_].*)?$/i,
  // AWS docs example key (AKIA…EXAMPLE).
  /^AKIA[A-Z0-9]{0,10}EXAMPLE$/i,
  // Pure repeated single character (after stripping non-alnum).
  /^(.)\1{15,}$/i
];
function shannonEntropy(s) {
  if (!s.length) return 0;
  const freq = /* @__PURE__ */ new Map();
  for (const ch of s) freq.set(ch, (freq.get(ch) ?? 0) + 1);
  let h = 0;
  for (const c of freq.values()) {
    const p = c / s.length;
    h -= p * Math.log2(p);
  }
  return h;
}
function isPlaceholderValue(m) {
  const v = m.trim();
  if (!/^(?:your|example|dummy|test|fake|sample|placeholder|xxx+|0{8,}|1{8,}|a{8,}|x{8,})/i.test(v)) return false;
  if (shannonEntropy(v) >= 3.5) return false;
  if (v.length >= 32) return false;
  return true;
}
function extractAssignedValue(match) {
  const assigned = match.match(/^[^=:\n]{1,80}[:=]\s*["']?(.+?)["']?\s*$/);
  return (assigned?.[1] ?? match).trim();
}
function isSecretReference(value) {
  return /^(?:process\.env|import\.meta\.env|os\.environ|Deno\.env|System\.getenv|ENV|process\[)\b/i.test(value) || /^\$\{?\{?\s*(?:secrets|env|vars|inputs)\./i.test(value) || // ${{ secrets.X }}
  /^\$\{[A-Za-z_][A-Za-z0-9_]*\}$/.test(value) || // ${VAR}
  /^\$[A-Za-z_][A-Za-z0-9_]*$/.test(value) || // $VAR
  /^%[A-Za-z_][A-Za-z0-9_]*%$/.test(value) || // %VAR%
  /^<[^<>]{1,60}>$/.test(value) || // <your-key-here>
  /^\{\{[^{}]{1,60}\}\}$/.test(value) || // {{ placeholder }}
  isIdentifierExpression(value);
}
function isIdentifierExpression(value) {
  if (value.length > 60 || !value.includes(".")) return false;
  if (!/^[A-Za-z_$][A-Za-z0-9_$]*(?:\.[A-Za-z_$][A-Za-z0-9_$]*)+$/.test(value)) return false;
  return value.split(".").every((seg) => seg.length <= 20);
}
var PLACEHOLDER_WORDS = /^(?:your|yours|mine|here|placeholder|changeme|change|replace|replaceme|example|examples|sample|dummy|fake|todo|insert|redacted|omitted|hidden|somekey|sometoken|dashboard|at|least|thirty|two|chars|characters)$/i;
function hasPlaceholderWord(value) {
  const words = value.split(/[_\-.\s]+/).filter(Boolean);
  if (words.length < 3) return false;
  const hits = words.filter((w) => PLACEHOLDER_WORDS.test(w)).length;
  return hits >= 2;
}
var NON_CREDENTIAL_KEY = /(?:^|[_.\-])(?:pub|public|publishable|anon|hashed|fingerprint|thumbprint|checksum|integrity|digest|etag|hash|sha\d*|md5|crc\d*|algorithm|algo|encoding|scheme|prefix|header|pattern|regex|expected|mock|fake|dummy|example|sample|placeholder|fixture|stub|invalid|revoked|redacted|masked|test)(?:[_.\-]|$)/i;
function isOpaqueCredential(match) {
  const assignAt = match.search(/["']?\s*[:=]/);
  if (assignAt <= 0) return false;
  const key = match.slice(0, assignAt);
  if (NON_CREDENTIAL_KEY.test(key)) return false;
  const value = extractAssignedValue(match).replace(/["']+$/, "");
  if (value.length < 28) return false;
  const words = value.split(/[_\-.]+/).filter(Boolean);
  if (words.length >= 4 && words.every((w) => /^[A-Za-z]+$/.test(w))) return false;
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/].filter((re) => re.test(value)).length;
  if (classes < 2) return false;
  return shannonEntropy(value) >= 3.6;
}
function isFalsePositive(match) {
  const m = match.trim();
  if (m.length < 8) return true;
  const value = extractAssignedValue(m);
  if (isSecretReference(value)) return true;
  if (hasPlaceholderWord(value)) return true;
  const providerPrefixed = /^(?:hf_|npm_|pypi-|dapi|dop_v1_|shpat_|sb[pa]_|dckr_pat_|github_pat_|glpat-|glcbt-|gldt-|glrt-|xox[bpoars]-|AKIA|ASIA|SG\.|ATBB|atlasv1\.|key-)/i.test(value) || /^(?:sk-ant-|sk-proj-|sk-svcacct-|gsk_)/i.test(value) || /^(?:sk|pk|rk)_(?:live)_[A-Za-z0-9]/i.test(value);
  if (providerPrefixed) {
    return false;
  }
  for (const re of FALSE_POSITIVE_ALLOWLIST) {
    re.lastIndex = 0;
    if (re.test(m) || re.test(value)) return true;
  }
  if (isPlaceholderValue(value)) return true;
  for (const candidate of [m, value]) {
    const alnum = candidate.replace(/[^A-Za-z0-9]/g, "");
    if (alnum.length >= 16 && /^(.)\1+$/i.test(alnum)) return true;
  }
  if (/\bAKIA[A-Z0-9]{16}\b/i.test(m) && /\bEXAMPLE\b/i.test(m)) return true;
  return false;
}
var SECRET_DETECTOR_CLASSES = [...new Set(SECRET_SPECS.map((s) => s.type))];
function detectSecrets(text) {
  const raw = runRegexDetectors(text, SECRET_SPECS);
  const matches = raw.filter((m) => !isFalsePositive(m.match));
  return {
    detectorName: "SecretDetector",
    detectorVersion: SECRET_DETECTOR_VERSION,
    matches
  };
}

// packages/core/src/RegisteredSecretMatcher.ts
var F19_DIAGNOSTIC = { views: 0, decodedBytes: 0, work: 0 };
var SECRET_MATCH_LIMITS = Object.freeze({
  maxRegistrations: 128,
  maxValueBytes: 4096,
  maxRegisteredBytes: 65536,
  maxParts: 32,
  maxInputBytes: 131072,
  maxVariantBytes: 1048576,
  maxDecodedCandidates: 128,
  maxDecodedBytes: 262144,
  maxMatches: 256,
  maxSearchWork: 67108864
});
var SECRET_ENTROPY_POLICY = Object.freeze({ minLength: 32, maxLength: 512, minClasses: 3, minBitsPerCharacter: 4.3 });
var OMIT_PROVIDER = /* @__PURE__ */ new Set(["generic_api_key", "password_assignment", "heroku_key", "high_entropy_token", "opaque_credential"]);
var utf8 = new import_node_util.TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
function validUnicode(text) {
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code >= 55296 && code <= 56319) {
      const next = text.charCodeAt(++i);
      if (!(next >= 56320 && next <= 57343)) return false;
    } else if (code >= 56320 && code <= 57343) return false;
  }
  return true;
}
function decision(status, matches = [], reason) {
  return Object.freeze({ status, matches: Object.freeze(matches), ...reason ? { reason } : {} });
}
function entropy(value) {
  const counts = /* @__PURE__ */ new Map();
  for (const char of value) counts.set(char, (counts.get(char) ?? 0) + 1);
  let result = 0;
  for (const count of counts.values()) {
    const p = count / value.length;
    result -= p * Math.log2(p);
  }
  return result;
}
var RegisteredSecretMatcher = class {
  #values = [];
  #needles = [];
  #invalid = false;
  #decodedCandidateLimit = SECRET_MATCH_LIMITS.maxDecodedCandidates;
  constructor(values, options = {}) {
    try {
      if (!options || typeof options !== "object" || Array.isArray(options) || Object.keys(options).some((key) => key !== "maxDecodedCandidates")) throw new Error();
      if (Object.hasOwn(options, "maxDecodedCandidates")) {
        const limit = options.maxDecodedCandidates;
        if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1024) throw new Error();
        this.#decodedCandidateLimit = limit;
      }
      if (!Array.isArray(values)) throw new Error();
      let total = 0, expanded = 0;
      const seen = /* @__PURE__ */ new Set();
      for (const text of values) {
        if (typeof text !== "string" || !text || text.length > SECRET_MATCH_LIMITS.maxValueBytes || !validUnicode(text)) throw new Error();
        const size = Buffer.byteLength(text, "utf8");
        if (size > SECRET_MATCH_LIMITS.maxValueBytes) throw new Error();
        total += size;
        if (total > SECRET_MATCH_LIMITS.maxRegisteredBytes) throw new Error();
        if (seen.has(text)) continue;
        seen.add(text);
        if (seen.size > SECRET_MATCH_LIMITS.maxRegistrations) throw new Error();
        const value = { id: `r${seen.size}`, text, short: Array.from(text).length < 8 };
        const bytes = Buffer.from(text, "utf8"), base64 = bytes.toString("base64"), base64url = bytes.toString("base64url");
        const variants = [
          ["raw", text],
          ["base64", base64],
          ["base64", base64.replace(/=+$/, "")],
          ["base64url", base64url],
          ["base64url", base64url + "=".repeat((4 - base64url.length % 4) % 4)],
          ["hex", bytes.toString("hex")],
          ["hex", bytes.toString("hex").toUpperCase()],
          ["url", encodeURIComponent(text)],
          ["json", JSON.stringify(text)],
          ["json", JSON.stringify(text).slice(1, -1)]
        ];
        const unique = /* @__PURE__ */ new Set();
        for (const [representation, variant] of variants) {
          if (unique.has(variant)) continue;
          unique.add(variant);
          expanded += Buffer.byteLength(variant, "utf8");
          if (expanded > SECRET_MATCH_LIMITS.maxVariantBytes) throw new Error();
          this.#needles.push({ value, text: variant, representation });
        }
        this.#values.push(value);
      }
    } catch {
      this.#invalid = true;
      this.#values = [];
      this.#needles = [];
    }
  }
  /** Replacement markers must not literally contain even a short registered
   * value. Input matching retains its separate conservative short-value rule. */
  isSafeReplacement(text) {
    try {
      if (this.#invalid || typeof text !== "string" || text.length > SECRET_MATCH_LIMITS.maxInputBytes || !validUnicode(text)) return false;
      if (this.#values.some((value) => text.includes(value.text))) return false;
      return this.inspectRequest([text]).status === "CLEAN";
    } catch {
      return false;
    }
  }
  inspectRequest(parts) {
    if (this.#invalid) return decision("WITHHELD", [], "registration_unavailable");
    try {
      if (!Array.isArray(parts) || parts.length > SECRET_MATCH_LIMITS.maxParts) throw new Error();
      let inputBytes = 0;
      for (const part of parts) {
        if (typeof part !== "string" || part.length > SECRET_MATCH_LIMITS.maxInputBytes + 2 * SECRET_MATCH_LIMITS.maxParts) throw new Error();
        inputBytes += Buffer.byteLength(part, "utf8");
        if (inputBytes > SECRET_MATCH_LIMITS.maxInputBytes + 2 * SECRET_MATCH_LIMITS.maxParts) throw new Error();
      }
      const text = parts.join("");
      if (!validUnicode(text) || Buffer.byteLength(text, "utf8") > SECRET_MATCH_LIMITS.maxInputBytes) throw new Error();
      const offsets = [];
      let cursor = 0;
      for (const part of parts) {
        offsets.push(cursor);
        cursor += part.length;
      }
      const matches = [], seenMatches = /* @__PURE__ */ new Set();
      let work = 0, decodedBytes = 0;
      const charge = (amount) => {
        work += amount;
        F19_DIAGNOSTIC.work = work;
        if (work > SECRET_MATCH_LIMITS.maxSearchWork) {
          F19_DIAGNOSTIC.limit = "work";
          throw new Error();
        }
      };
      const add = (kind, representation, start, end, registrationId) => {
        if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || start >= end || end > text.length) throw new Error();
        const key = `${kind}:${registrationId ?? ""}:${start}:${end}`;
        if (seenMatches.has(key)) return;
        seenMatches.add(key);
        if (matches.length >= SECRET_MATCH_LIMITS.maxMatches) throw new Error();
        const spans = [];
        for (let index = 0; index < parts.length; index++) {
          const from = Math.max(start, offsets[index]), to = Math.min(end, offsets[index] + parts[index].length);
          if (from < to) spans.push(Object.freeze({ index, start: from - offsets[index], end: to - offsets[index] }));
        }
        matches.push(Object.freeze({ kind, representation, ...registrationId ? { registrationId } : {}, start, end, parts: Object.freeze(spans) }));
      };
      const wholePart = (start, end) => start === 0 && end === text.length || parts.some((part, index) => offsets[index] === start && start + part.length === end);
      const pathSeparators = /* @__PURE__ */ new Set();
      charge(text.length);
      for (const url of text.matchAll(/\bhttps?:\/\/[^\s"'<>`]+/g)) {
        const path = url[0].indexOf("/", url[0].indexOf("://") + 3);
        if (path < 0) continue;
        for (let index = path; index < url[0].length; index++) if (url[0][index] === "/") pathSeparators.add(url.index + index);
      }
      for (const needle of this.#needles) {
        charge(text.length);
        let at = text.indexOf(needle.text);
        while (at !== -1) {
          const end = at + needle.text.length;
          const encoded = ["base64", "base64url", "hex"].includes(needle.representation);
          const alphabet = needle.representation === "hex" ? /[A-Fa-f0-9]/ : /[A-Za-z0-9+/_=\-]/;
          const separator = (index) => needle.representation !== "hex" && text[index] === "/" && pathSeparators.has(index);
          const boundary = !encoded || !(at > 0 && alphabet.test(text[at - 1]) && !separator(at - 1)) && !(end < text.length && alphabet.test(text[end]) && !separator(end));
          const explicitShortPart = needle.value.short && wholePart(at, end);
          if ((boundary || explicitShortPart) && (!needle.value.short || explicitShortPart)) add("registered", needle.representation, at, end, needle.value.id);
          at = text.indexOf(needle.text, at + 1);
        }
      }
      const views = [], seenViews = /* @__PURE__ */ new Set();
      const view = (decoded, start, end, representation) => {
        if (!decoded || !validUnicode(decoded)) return;
        const key = `${representation}:${start}:${end}`;
        if (seenViews.has(key)) return;
        seenViews.add(key);
        F19_DIAGNOSTIC.views = views.length;
        if (views.length >= (F19_DIAGNOSTIC.overrideCandidates || this.#decodedCandidateLimit)) {
          F19_DIAGNOSTIC.limit = "candidates";
          throw new Error();
        }
        decodedBytes += Buffer.byteLength(decoded, "utf8");
        F19_DIAGNOSTIC.decodedBytes = decodedBytes;
        if (decodedBytes > SECRET_MATCH_LIMITS.maxDecodedBytes) {
          F19_DIAGNOSTIC.limit = "decodedBytes";
          throw new Error();
        }
        views.push({ text: decoded, start, end, representation });
      };
      charge(text.length * 5);
      for (const token of text.matchAll(/[A-Fa-f0-9]{2,}/g)) {
        if (token[0].length % 2) continue;
        let decoded;
        try {
          decoded = utf8.decode(Buffer.from(token[0], "hex"));
        } catch {
          continue;
        }
        view(decoded, token.index, token.index + token[0].length, "hex");
      }
      for (const token of text.matchAll(/[A-Za-z0-9+/_\-]+={0,}/g)) {
        const source = token[0], start = token.index;
        if (source.length < 2) continue;
        let bytes, representation = "base64";
        if (/^[A-Fa-f0-9]+$/.test(source) && source.length % 2 === 0) {
          bytes = Buffer.from(source, "hex");
          representation = "hex";
        } else if (/^(?:[A-Za-z0-9+/]+={0,2}|[A-Za-z0-9_\-]+={0,2})$/.test(source)) {
          const unpadded = source.replace(/=+$/, ""), url = /[_\-]/.test(source);
          if (unpadded.length % 4 === 1) continue;
          const candidate = Buffer.from(unpadded, url ? "base64url" : "base64");
          const canonical = candidate.toString(url ? "base64url" : "base64").replace(/=+$/, "");
          const padding = "=".repeat((4 - unpadded.length % 4) % 4);
          if (canonical !== unpadded || source !== unpadded && source !== unpadded + padding) continue;
          bytes = candidate;
          representation = url ? "base64url" : "base64";
        }
        if (bytes) {
          let decoded;
          try {
            decoded = utf8.decode(bytes);
          } catch {
            continue;
          }
          view(decoded, start, start + source.length, representation);
        }
      }
      if (text.includes("%")) {
        let decoded;
        try {
          decoded = decodeURIComponent(text);
        } catch {
        }
        if (decoded !== void 0) view(decoded, 0, text.length, "url");
      }
      for (const token of text.matchAll(/[^\s"'<>`]+/g)) {
        if (!token[0].includes("%")) continue;
        let decoded;
        try {
          decoded = decodeURIComponent(token[0]);
        } catch {
          continue;
        }
        view(decoded, token.index, token.index + token[0].length, "url");
      }
      for (let index = 0; index < text.length; index++) {
        if (text[index] !== '"') continue;
        const start = index++;
        let closed = false;
        for (; index < text.length; index++) {
          if (text[index] === "\\") {
            index++;
            continue;
          }
          if (text[index] === '"') {
            closed = true;
            break;
          }
        }
        if (!closed) break;
        let decoded;
        try {
          decoded = JSON.parse(text.slice(start, index + 1));
        } catch {
          continue;
        }
        if (typeof decoded === "string") view(decoded, start, index + 1, "json");
      }
      if (text.includes("\\")) {
        let decoded;
        try {
          decoded = JSON.parse('"' + text + '"');
        } catch {
        }
        if (typeof decoded === "string") view(decoded, 0, text.length, "json");
      }
      const scanPatterns = (content, map, representation) => {
        charge(content.length * 65);
        for (const finding of detectSecrets(content).matches) {
          if (OMIT_PROVIDER.has(finding.type)) continue;
          if (!Number.isInteger(finding.start) || !Number.isInteger(finding.end) || finding.start < 0 || finding.start >= finding.end || finding.end > content.length) throw new Error();
          const [start, end] = map(finding.start, finding.end);
          add("provider", representation, start, end);
        }
        const assignment = /\b([A-Za-z_][A-Za-z0-9_.\-]{0,80})["']?\s*[:=]\s*["']?([A-Za-z0-9+/=_\-]+)["']?/g;
        for (const match of content.matchAll(assignment)) {
          const key = match[1], value = match[2];
          if (!/(?:secret|token|password|passwd|credentials?|api[_-]key|access[_-]key|auth)$/i.test(key)) continue;
          if (value.length < 32 || value.length > 512 || [/[A-Z]/, /[a-z]/, /[0-9]/, /[+/=_\-]/].filter((pattern) => pattern.test(value)).length < 3 || entropy(value) < 4.3) continue;
          const [start, end] = map(match.index, match.index + match[0].length);
          add("entropy", representation, start, end);
        }
      };
      scanPatterns(text, (start, end) => [start, end], "raw");
      for (const candidate of views) {
        for (const value of this.#values) {
          charge(candidate.text.length);
          if (value.short ? candidate.text === value.text : candidate.text.includes(value.text))
            add("registered", candidate.representation, candidate.start, candidate.end, value.id);
        }
        scanPatterns(candidate.text, () => [candidate.start, candidate.end], candidate.representation);
      }
      matches.sort((a, b) => a.start - b.start || a.end - b.end || (a.registrationId ?? "").localeCompare(b.registrationId ?? ""));
      return decision(matches.length ? "MATCHED" : "CLEAN", matches);
    } catch {
      return decision("WITHHELD", [], "matching_budget_or_input_unavailable");
    }
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  F19_DIAGNOSTIC,
  RegisteredSecretMatcher,
  SECRET_ENTROPY_POLICY,
  SECRET_MATCH_LIMITS
});
