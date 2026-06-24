import { detectPatterns, type PatternRule } from "./helpers";

const secret = (pattern: RegExp, label: string, token = "[REDACTED_SECRET]"): PatternRule => ({
  pattern, label, redactionToken: token, sensitive: true, severity: "CRITICAL", score: 70,
  message: `${label} detected. Rotate it if this value is real.`,
});

const rules: PatternRule[] = [
  secret(/\bsk-(?:proj-)?[A-Za-z0-9_-]{8,}\b/, "OpenAI-like API key"),
  secret(/\bAIza[0-9A-Za-z_-]{30,}\b/, "Google/Gemini-like API key"),
  secret(/\b(?:ghp|gho|ghu|ghs|github_pat)_[A-Za-z0-9_]{20,}\b/, "GitHub token"),
  secret(/\bAKIA[0-9A-Z]{16}\b/, "AWS access key"),
  secret(/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}(?:\.[A-Za-z0-9_-]+)?\b/, "JWT token", "[REDACTED_JWT]"),
  secret(/\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis):\/\/[^\s]+/i, "Database URL", "[REDACTED_DATABASE_URL]"),
  secret(/\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{8,}\b/, "Stripe or Razorpay-like key"),
  secret(/\brzp_(?:live|test)_[A-Za-z0-9]{8,}\b/, "Razorpay-like key"),
  secret(/\b[A-Z][A-Z0-9_]{2,}\s*=\s*["']?[A-Za-z0-9_./+:-]{6,}["']?/, "Environment secret assignment"),
  secret(/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]+?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i, "Private key block"),
  secret(/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i, "Private key header", "[REDACTED_PRIVATE_KEY]"),
  secret(/\b(?:your\s+)?secret\s+key\s+is\s+[A-Za-z0-9_]{6,}\b/i, "Generic secret key disclosure"),
  secret(/\bxox[baprs]-[A-Za-z0-9-]{20,}\b/, "Slack token", "[REDACTED_SLACK_TOKEN]"),
  secret(/\bya29\.[A-Za-z0-9._-]{10,}\b/, "Google OAuth token", "[REDACTED_OAUTH_TOKEN]"),
  secret(/\b(?:my |the )?password (?:is |= )["']?[A-Za-z0-9!@#$%^&*()_+]{4,}["']?(?:[.!]| do not|\b)/i, "Password disclosure"),
  secret(/\bxox[parb]-[A-Za-z0-9-]{10,}\b/i, "Slack webhook/token"),
];

export function secretsDetector(text: string) {
  return detectPatterns(text, "SECRET_DETECTED", rules);
}
