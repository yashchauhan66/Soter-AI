import { detectPatterns, type PatternRule } from "./helpers";

const secret = (pattern: RegExp, label: string, token = "[REDACTED_SECRET]"): PatternRule => ({
  pattern, label, redactionToken: token, sensitive: true, severity: "CRITICAL", score: 70,
  message: `${label} detected. Rotate it if this value is real.`,
});

const rules: PatternRule[] = [
  secret(/(?:search|scan|inspect|look through|read).{0,120}(?:memory|context|conversation|tool outputs?|environment|env).{0,180}(?:api keys?|tokens?|passwords?|webhook secrets?|database urls?|private environment variables?|env vars?|credentials?)/i, "Secret extraction request"),
  secret(/(?:return|list|show|print|extract|export).{0,160}(?:values? that look like|all values?|all secrets?|all credentials?|api keys?|tokens?|passwords?|database credentials?|(?:all|your|every)\s+(?:the\s+)?(?:private\s+|secret\s+|runtime\s+)?environment\s+variables?|environment\s+variables?\s+(?:currently\s+)?(?:set|in\s+your\s+(?:runtime|process|environment|context|session))|(?:all|your|every)\s+env\s+vars?)/i, "Secret listing request"),
  secret(/\b(?:RAZORPAY_KEY_SECRET|DATABASE_URL|NEXTAUTH_SECRET|JWT_SECRET|AUTH_SECRET|SOTER_TEST_SECRET_DO_NOT_LEAK_[A-Z0-9_-]*|API_KEYS?|WEBHOOK_SECRET)\b/i, "Named secret reference"),
  secret(/\b(?:sk-\*|pk_\*|AWS keys?|GitHub tokens?)\b/i, "Secret-family harvesting request"),
  secret(/(?:return|list|show|print|extract|export|dump).{0,80}\bJWT tokens?\b/i, "JWT token harvesting request"),
  secret(/\bsk-(?:proj-)?[A-Za-z0-9_-]{8,}\b/, "OpenAI-like API key"),
  secret(/\bAIza[0-9A-Za-z_-]{30,}\b/, "Google/Gemini-like API key"),
  secret(/\b(?:ghp|gho|ghu|ghs|github_pat)_[A-Za-z0-9_]{20,}\b/, "GitHub token"),
  secret(/\bAKIA[0-9A-Z]{16}\b/, "AWS access key"),
  secret(/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}(?:\.[A-Za-z0-9_-]+)?\b/, "JWT token", "[REDACTED_JWT]"),
  secret(/\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis):\/\/[^\s]+/i, "Database URL", "[REDACTED_DATABASE_URL]"),
  secret(/\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{8,}\b/, "Stripe or Razorpay-like key"),
  secret(/\brzp_(?:live|test)_[A-Za-z0-9]{8,}\b/, "Razorpay-like key"),
  secret(/\b(?:synthetic|fake|test)[_-]?(?:api[_-]?key|secret|token)[_-][A-Za-z0-9_-]{4,}\b/i, "Synthetic or test API key"),
  secret(/\b[A-Z][A-Z0-9_]{2,}\s*=\s*["']?[A-Za-z0-9_./+:-]{6,}["']?/, "Environment secret assignment"),
  secret(/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]+?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i, "Private key block"),
  secret(/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i, "Private key header", "[REDACTED_PRIVATE_KEY]"),
  secret(/\b(?:your\s+)?secret\s+key\s+is\s+[A-Za-z0-9_]{6,}\b/i, "Generic secret key disclosure"),
  secret(/\bxox[baprs]-[A-Za-z0-9-]{20,}\b/, "Slack token", "[REDACTED_SLACK_TOKEN]"),
  secret(/\bya29\.[A-Za-z0-9._-]{10,}\b/, "Google OAuth token", "[REDACTED_OAUTH_TOKEN]"),
  secret(/\b(?:my |the )?password (?:is |= )["']?[A-Za-z0-9!@#$%^&*()_+]{4,}["']?(?:[.!]| do not|\b)/i, "Password disclosure"),
  secret(/\bxox[parb]-[A-Za-z0-9-]{10,}\b/i, "Slack webhook/token"),

  // --- Vendor formats added 2026-08-09 after a measured blind spot ---
  //
  // WHY THESE ARE HERE AND WHY THEY ARE REGEXES, NOT TRAINING DATA
  //   Measured through the production path (scripts/ml/eval-secret-formats.ts):
  //   with a verified-neutral carrier sentence, the SAME credential token is
  //   classified SECRET in one phrasing and PROMPT_INJECTION in another. The
  //   model keys on the surrounding words, not the token shape — which the
  //   training corpus explains exactly: of 4,488 SECRET rows in
  //   ml-augmented-v7.jsonl, 56.9% spell punctuation out as words ("ghp
  //   underscore abc123"), only 6.2% contain a literal credential-shaped token,
  //   and ghp_/xoxb-/glpat-/npm_/AIza appear ZERO times in literal form.
  //
  //   A credential prefix is a PUBLISHED CONSTANT, not a pattern to be inferred.
  //   `glpat-` means a GitLab PAT with certainty no classifier can improve on, so
  //   a deterministic rule is strictly the right tier — same argument as the
  //   existing sk-/AKIA/ghp_ rules directly above. This closes the detection gap
  //   NOW, and a v8 retrain with literal-format rows is what would fix the model
  //   itself. The two are complementary; this is not a substitute for that.
  //
  //   Lengths are the vendor-documented minimums, deliberately not tightened to
  //   exact values: vendors extend token length over time, and a rule that
  //   silently stops matching after a rotation is worse than a slightly loose one
  //   whose false-positive surface is a fixed literal prefix.
  //
  //   The body CHARSET is loose for the same reason, and this was measured rather
  //   than assumed. Five families (shopify, databricks, digitalocean, supabase,
  //   twilio) are documented as hex bodies, and hex-only rules matched 0% of them
  //   in the fresh-format eval because the fixture generates a wider alphabet.
  //   The fixture is the unrealistic one there — but that is exactly the point:
  //   the eval was written before the rules, and a rule that only fires on a body
  //   charset someone assumed correctly is a rule that fails silently the day a
  //   vendor widens it. The literal prefix (`dop_v1_`, `shpat_`, `dapi`) is the
  //   discriminating signal and carries essentially no false-positive surface on
  //   its own, so the charset is not asked to do work it cannot be trusted with.
  //
  //   Verified against datasets/secret-format-benign.jsonl (156 rows of git SHAs,
  //   UUIDs, docker digests, trace IDs, order numbers, package versions and
  //   credential-vocabulary-but-benign prose) so these prefixes do not fire on
  //   ordinary engineering chat.
  secret(/\bglpat-[A-Za-z0-9_-]{20,}\b/, "GitLab personal access token"),
  secret(/\bgldt-[A-Za-z0-9_-]{20,}\b/, "GitLab deploy token"),
  secret(/\bnpm_[A-Za-z0-9]{36}\b/, "npm access token"),
  secret(/\bhf_[A-Za-z0-9]{30,}\b/, "Hugging Face token"),
  secret(/\bshp(?:at|ca|pa|ss)_[A-Za-z0-9]{32,}\b/, "Shopify access token"),
  secret(/\bdop_v1_[A-Za-z0-9]{60,}\b/, "DigitalOcean personal access token"),
  secret(/\bdoo_v1_[A-Za-z0-9]{60,}\b/, "DigitalOcean OAuth token"),
  secret(/\bSG\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{30,}\b/, "SendGrid API key"),
  secret(/\bpypi-AgEIcHlwaS5vcmc[A-Za-z0-9_-]{20,}\b/, "PyPI upload token"),
  secret(/\bdapi[A-Za-z0-9]{32,}\b/, "Databricks personal access token"),
  secret(/\bgsk_[A-Za-z0-9]{40,}\b/, "Groq API key"),
  secret(/\bsbp_[A-Za-z0-9]{40,}\b/i, "Supabase service key"),
  secret(/\bfigd_[A-Za-z0-9_-]{40,}\b/, "Figma personal access token"),
  secret(/\blin_api_[A-Za-z0-9]{40,}\b/, "Linear API key"),
  secret(/\bntn_[A-Za-z0-9]{40,}\b/, "Notion integration token"),
  secret(/\bdp\.pt\.[A-Za-z0-9]{40,}\b/, "Doppler service token"),
  secret(/\btvly-[A-Za-z0-9]{28,}\b/, "Tavily API key"),
  // Twilio Account SIDs are `AC` + 32 hex and are NOT themselves secret — they
  // are the username half of the pair and appear in public docs and dashboards.
  // Kept hex-tight and scored as a credential only because a SID in a message is
  // a reliable indicator that the auth token is nearby; widening the charset here
  // would start matching ordinary `AC`-prefixed identifiers for no detection gain.
  secret(/\bAC[a-f0-9]{32}\b/, "Twilio Account SID"),
  secret(/\bhttps:\/\/hooks\.slack\.com\/services\/T[A-Za-z0-9]{6,}\/B[A-Za-z0-9]{6,}\/[A-Za-z0-9]{20,}/, "Slack incoming webhook URL", "[REDACTED_SLACK_WEBHOOK]"),
  secret(/\bhttps:\/\/discord(?:app)?\.com\/api\/webhooks\/\d{15,}\/[A-Za-z0-9_-]{60,}/, "Discord webhook URL", "[REDACTED_DISCORD_WEBHOOK]"),
  // Azure connection strings carry the key inline; AccountKey= is the anchor that
  // distinguishes a credential-bearing string from a plain endpoint reference.
  secret(/\bAccountKey=[A-Za-z0-9+/]{60,}={0,2}/, "Azure Storage account key", "[REDACTED_AZURE_KEY]"),
  secret(/\bSharedAccessKey=[A-Za-z0-9+/]{30,}={0,2}/, "Azure Service Bus / Event Hub key", "[REDACTED_AZURE_KEY]"),
];

export function secretsDetector(text: string) {
  return detectPatterns(text, "SECRET_DETECTED", rules);
}
