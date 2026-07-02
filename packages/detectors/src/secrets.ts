import { runRegexDetectors, type DetectorFinding } from "./core";

const SECRET_SPECS = [
  {
    type: "env_file",
    label: ".env or environment configuration",
    severity: "critical" as const,
    score: 40,
    pattern: /(?:^|[\\/\s])\.env(?:\.[a-z0-9_-]+)?\b|(?:^|\n)(?:[A-Z][A-Z0-9_]{2,}\s*=.*\n){2,}/gim,
    message: "Environment file or configuration snippet detected.",
  },
  {
    type: "aws_access_key",
    label: "AWS access key",
    severity: "critical" as const,
    score: 35,
    pattern: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g,
    message: "AWS access key detected.",
  },
  {
    type: "github_token",
    label: "GitHub token",
    severity: "critical" as const,
    score: 35,
    pattern: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{30,255}\b/g,
    message: "GitHub token detected.",
  },
  {
    type: "slack_token",
    label: "Slack token",
    severity: "critical" as const,
    score: 35,
    pattern: /\b(?:xox(?:b|p|o|a|r|s)-[A-Za-z0-9-]{10,}|slack[_-]?token\s*[:=]\s*["']?[A-Za-z0-9_\-./+=]{16,}["']?)/gi,
    message: "Slack token detected.",
  },
  {
    type: "jwt",
    label: "JWT token",
    severity: "high" as const,
    score: 28,
    pattern: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g,
    message: "JWT token detected.",
  },
  {
    type: "private_key",
    label: "Private key",
    severity: "critical" as const,
    score: 50,
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |)?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH |DSA |)?PRIVATE KEY-----/g,
    message: "Private key material detected.",
  },
  {
    type: "database_url",
    label: "Database URL",
    severity: "critical" as const,
    score: 40,
    pattern: /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis):\/\/[^\s"'<>]+/gi,
    message: "Database connection URL detected.",
  },
  {
    type: "api_key",
    label: "API key",
    severity: "high" as const,
    score: 25,
    pattern: /\b(?:api[_-]?key|secret[_-]?key|access[_-]?token|client[_-]?secret)\b\s*[:=]\s*["']?[A-Za-z0-9_\-./+=]{16,}["']?/gi,
    message: "API key or secret assignment detected.",
  },
  {
    type: "password",
    label: "Password",
    severity: "high" as const,
    score: 24,
    pattern: /\b(?:password|passwd|pwd)\b\s*[:=]\s*["']?[^"'\s]{8,}["']?/gi,
    message: "Password-like value detected.",
  },
];

export function detectSecrets(text: string): DetectorFinding[] {
  return runRegexDetectors(text, SECRET_SPECS);
}
