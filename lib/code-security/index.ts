import { createHash, randomUUID } from "node:crypto";
import type {
  CodeReviewCategory,
  CodeReviewContext,
  CodeReviewFinding,
  CodeReviewResult,
  CodeReviewSeverity,
} from "./types";

export type CodeReviewInput = {
  code: string;
  filename?: string;
  language?: string;
  context?: Partial<CodeReviewContext>;
};

type Rule = {
  id: string;
  title: string;
  category: CodeReviewCategory;
  severity: CodeReviewSeverity;
  pattern: RegExp;
  description: string;
  remediation: string;
  standards: string[];
  languages?: string[];
  when?: (context: CodeReviewContext) => boolean;
};

const DEFAULT_CONTEXT: CodeReviewContext = {
  environment: "production",
  internetExposed: true,
  handlesSensitiveData: false,
  containsAuthCode: false,
  aiGenerated: true,
};

const RULES: Rule[] = [
  {
    id: "SEC-001", title: "Hard-coded credential", category: "SECRETS", severity: "CRITICAL",
    pattern: /(?:api[_-]?key|client[_-]?secret|password|passwd|access[_-]?token|auth[_-]?token)\s*[:=]\s*["'`](?!process\.env|os\.environ|env\.|\$\{|<|your-|example|test)[^"'`\s]{8,}["'`]/i,
    description: "A credential-like value is embedded in source code and may leak through version control, logs, or AI context.",
    remediation: "Revoke and rotate the value, remove it from Git history, and load the replacement from an approved secret manager.",
    standards: ["OWASP A02:2021", "OWASP ASVS V6", "SOC 2 CC6.1", "ISO 27001 A.8.24"],
  },
  {
    id: "SEC-002", title: "Private key material", category: "SECRETS", severity: "CRITICAL",
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i,
    description: "Private key material appears in the reviewed change.",
    remediation: "Remove and rotate the key immediately. Store private keys outside the repository in a managed key or secret service.",
    standards: ["OWASP A02:2021", "OWASP ASVS V6", "SOC 2 CC6.1"],
  },
  {
    id: "SEC-003", title: "Provider token exposed", category: "SECRETS", severity: "CRITICAL",
    pattern: /\b(?:sk-(?:proj-)?[A-Za-z0-9_-]{12,}|(?:ghp|gho|ghu|ghs|github_pat)_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,})\b/,
    description: "A token matching a known cloud, source-control, AI, or collaboration provider format was found.",
    remediation: "Revoke the token, purge it from repository history, and replace it with a short-lived secret-manager reference.",
    standards: ["OWASP A02:2021", "OWASP ASVS V6", "SOC 2 CC6.1"],
  },
  {
    id: "INJ-001", title: "Dynamic code execution", category: "INJECTION", severity: "CRITICAL",
    pattern: /\b(?:eval|Function)\s*\(\s*(?:req\.|request\.|user|input|body|params|query)/i,
    description: "Untrusted input appears to reach a dynamic code execution primitive.",
    remediation: "Remove dynamic evaluation. Parse input into an allow-listed command or data structure and execute only fixed application logic.",
    standards: ["OWASP A03:2021", "OWASP ASVS V5", "CWE-95"],
  },
  {
    id: "INJ-002", title: "Shell command injection", category: "INJECTION", severity: "CRITICAL",
    pattern: /(?:exec|execSync|spawn|system|popen)\s*\(\s*(?:`[^`]*\$\{|[^,\n]*(?:req\.|request\.|user|input|body|params|query))/i,
    description: "User-controlled data may be interpolated into an operating-system command.",
    remediation: "Avoid the shell, pass fixed executables and separated arguments, and strictly allow-list every accepted value.",
    standards: ["OWASP A03:2021", "OWASP ASVS V5", "CWE-78"],
  },
  {
    id: "INJ-003", title: "Potential SQL injection", category: "INJECTION", severity: "HIGH",
    pattern: /(?:query|execute|\$queryRawUnsafe)\s*\(\s*(?:`[^`]*(?:\$\{|\+)|["'][^"']*["']\s*\+)/i,
    description: "A database query appears to be built by string interpolation or concatenation.",
    remediation: "Use parameterized queries or the ORM's safe tagged-template/query builder API. Never concatenate request data into SQL.",
    standards: ["OWASP A03:2021", "OWASP ASVS V5", "CWE-89"],
  },
  {
    id: "AUTH-001", title: "JWT decoded without verification", category: "AUTHORIZATION", severity: "HIGH",
    pattern: /(?:jwt\.)?decode\s*\(\s*(?:token|jwt|req\.|request\.)/i,
    description: "A JWT is decoded but its signature, issuer, audience, and lifetime may not be verified.",
    remediation: "Use the library's verify operation with an explicit algorithm allow-list, issuer, audience, and expiration validation.",
    standards: ["OWASP A07:2021", "OWASP ASVS V2", "SOC 2 CC6.1"],
  },
  {
    id: "AUTH-002", title: "Plaintext password comparison", category: "AUTHORIZATION", severity: "CRITICAL",
    pattern: /(?:password|passwd)\s*(?:===|==)\s*(?:req\.|request\.|body\.|input\.|user\.)/i,
    description: "Password material appears to be compared directly instead of through a password hashing function.",
    remediation: "Store passwords using Argon2id, scrypt, or bcrypt with appropriate parameters and use the library's constant-time verify function.",
    standards: ["OWASP A02:2021", "OWASP ASVS V2", "CWE-256"],
  },
  {
    id: "AUTH-003", title: "Authentication route without visible authorization guard", category: "AUTHORIZATION", severity: "MEDIUM",
    pattern: /(?:export\s+async\s+function\s+(?:POST|PUT|PATCH|DELETE)|(?:app|router)\.(?:post|put|patch|delete))\b/i,
    description: "A state-changing handler was found in code marked as authentication-sensitive, but no recognized access-control guard is visible in this snippet.",
    remediation: "Enforce authentication and object/tenant-level authorization on the server before reading or mutating protected resources.",
    standards: ["OWASP A01:2021", "OWASP ASVS V4", "SOC 2 CC6.3"],
    when: (context) => context.containsAuthCode,
  },
  {
    id: "CRYPTO-001", title: "Weak password hashing or digest", category: "CRYPTOGRAPHY", severity: "HIGH",
    pattern: /(?:createHash\s*\(\s*["'](?:md5|sha1)["']|\b(?:md5|sha1)\s*\(.*(?:password|token|secret))/i,
    description: "A broken or fast digest appears to protect security-sensitive material.",
    remediation: "Use Argon2id/scrypt/bcrypt for passwords and SHA-256 or stronger only where a general cryptographic digest is appropriate.",
    standards: ["OWASP A02:2021", "OWASP ASVS V6", "CWE-327"],
  },
  {
    id: "CFG-001", title: "TLS certificate verification disabled", category: "SECURITY_CONFIG", severity: "HIGH",
    pattern: /(?:rejectUnauthorized\s*:\s*false|NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*["']?0)/i,
    description: "TLS peer verification is disabled, enabling interception of credentials and application data.",
    remediation: "Restore certificate verification and configure the correct CA bundle for private infrastructure.",
    standards: ["OWASP A05:2021", "OWASP ASVS V9", "SOC 2 CC6.7"],
  },
  {
    id: "CFG-002", title: "Wildcard CORS on an internet-exposed service", category: "SECURITY_CONFIG", severity: "MEDIUM",
    pattern: /(?:Access-Control-Allow-Origin["']?\s*[:,]\s*["']\*["']|cors\s*\(\s*\{[^}]*origin\s*:\s*["']\*["'])/i,
    description: "The service permits cross-origin access from any website.",
    remediation: "Allow-list exact trusted origins and keep credentialed requests disabled unless they are explicitly required.",
    standards: ["OWASP A05:2021", "OWASP ASVS V14"],
    when: (context) => context.internetExposed,
  },
  {
    id: "DATA-001", title: "Sensitive data written to logs", category: "DATA_EXPOSURE", severity: "HIGH",
    pattern: /console\.(?:log|info|debug|error)\s*\([^\n]*(?:password|secret|token|authorization|cookie|ssn|aadhaar|credit.?card)/i,
    description: "Sensitive or credential-bearing data may be written to application logs.",
    remediation: "Log only allow-listed metadata. Redact credentials and regulated identifiers before structured logging.",
    standards: ["OWASP A09:2021", "OWASP ASVS V7", "SOC 2 CC7.2", "ISO 27001 A.8.15"],
  },
  {
    id: "DATA-002", title: "Unescaped HTML rendering", category: "DATA_EXPOSURE", severity: "HIGH",
    pattern: /dangerouslySetInnerHTML\s*=\s*\{\s*\{\s*__html\s*:\s*(?!sanitize|DOMPurify)/i,
    description: "HTML is rendered without a visible sanitization boundary, which can lead to stored or reflected XSS.",
    remediation: "Render plain text where possible. Otherwise sanitize with a maintained allow-list sanitizer immediately before rendering.",
    standards: ["OWASP A03:2021", "OWASP ASVS V5", "CWE-79"],
  },
  {
    id: "AI-001", title: "Model output reaches code execution", category: "AI_BOUNDARY", severity: "CRITICAL",
    pattern: /(?:eval|exec|execSync|Function|system)\s*\([^\n]*(?:completion|modelOutput|aiResponse|llmResponse|generatedCode)/i,
    description: "AI-generated output appears to reach a code or command execution sink without a deterministic safety boundary.",
    remediation: "Treat model output as untrusted. Use a sandbox, strict schemas, capability allow-lists, resource limits, and human approval for consequential execution.",
    standards: ["OWASP LLM05:2025", "OWASP A03:2021", "NIST AI RMF Govern 1.7"],
  },
];

const AUTH_GUARD = /(?:requireUser|requireAuth|authorize|isAuthenticated|requireProjectPermission|auth\s*\(|getServerSession|passport\.authenticate)/i;
const SEVERITY_WEIGHT: Record<CodeReviewSeverity, number> = { CRITICAL: 35, HIGH: 22, MEDIUM: 10, LOW: 4 };

export function reviewCodeSecurity(input: CodeReviewInput): CodeReviewResult {
  const context: CodeReviewContext = { ...DEFAULT_CONTEXT, ...input.context };
  const language = (input.language || inferLanguage(input.filename || "")).toLowerCase();
  const lines = input.code.split(/\r?\n/);
  const findings: CodeReviewFinding[] = [];

  for (const rule of RULES) {
    if (rule.languages && !rule.languages.includes(language)) continue;
    if (rule.when && !rule.when(context)) continue;
    if (rule.id === "AUTH-003" && AUTH_GUARD.test(input.code)) continue;

    lines.forEach((line, index) => {
      const reviewLine = normalizeDiffLine(line);
      if (reviewLine === null || isCommentOnly(reviewLine)) return;
      rule.pattern.lastIndex = 0;
      if (!rule.pattern.test(reviewLine)) return;
      findings.push({
        id: `${rule.id}-${index + 1}`,
        ruleId: rule.id,
        title: rule.title,
        description: rule.description,
        remediation: rule.remediation,
        severity: adjustSeverity(rule.severity, context),
        category: rule.category,
        line: index + 1,
        evidence: redactEvidence(reviewLine),
        standards: rule.standards,
      });
    });
  }

  const deduped = findings.filter((finding, index, all) =>
    all.findIndex((candidate) => candidate.ruleId === finding.ruleId && candidate.line === finding.line) === index,
  );
  const counts = countSeverities(deduped);
  const rawScore = deduped.reduce((total, finding) => total + SEVERITY_WEIGHT[finding.severity], 0);
  const contextualBonus = deduped.length > 0
    ? (context.environment === "production" ? 5 : 0) + (context.handlesSensitiveData ? 5 : 0)
    : 0;
  const riskScore = Math.min(100, rawScore + contextualBonus);
  const decision = counts.CRITICAL > 0 || counts.HIGH >= 2 ? "FAIL" : deduped.length > 0 ? "REVIEW" : "PASS";

  return {
    reviewId: `csr_${randomUUID()}`,
    generatedAt: new Date().toISOString(),
    decision,
    riskScore,
    summary: summaryFor(decision, counts),
    findings: deduped,
    counts,
    context,
    metadata: {
      filename: input.filename || "pasted-code",
      language,
      linesReviewed: lines.length,
      engineVersion: "2026.06",
      contentStored: false,
    },
    compliance: complianceFor(deduped),
    disclaimer: "Automated evidence supports review but does not certify compliance or replace threat modeling, dependency analysis, and human code review.",
  };
}

function normalizeDiffLine(line: string) {
  if (/^(?:---|\+\+\+|@@)/.test(line) || line.startsWith("-")) return null;
  return line.startsWith("+") ? line.slice(1) : line;
}

function isCommentOnly(line: string) {
  return /^\s*(?:\/\/|#(?!include)|\*)/.test(line);
}

function redactEvidence(line: string) {
  const compact = line.trim().slice(0, 240);
  return compact
    .replace(/\b(?:sk-(?:proj-)?[A-Za-z0-9_-]+|(?:ghp|gho|ghu|ghs|github_pat)_[A-Za-z0-9_]+|AKIA[0-9A-Z]+|xox[baprs]-[A-Za-z0-9-]+)\b/g, "[REDACTED_TOKEN]")
    .replace(/((?:api[_-]?key|client[_-]?secret|password|passwd|access[_-]?token|auth[_-]?token)\s*[:=]\s*["'`])[^"'`]+/gi, "$1[REDACTED]");
}

function adjustSeverity(severity: CodeReviewSeverity, context: CodeReviewContext): CodeReviewSeverity {
  if (severity === "MEDIUM" && context.environment === "production" && context.handlesSensitiveData) return "HIGH";
  return severity;
}

function countSeverities(findings: CodeReviewFinding[]) {
  return findings.reduce<Record<CodeReviewSeverity, number>>((counts, finding) => {
    counts[finding.severity] += 1;
    return counts;
  }, { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 });
}

function inferLanguage(filename: string) {
  const extension = filename.split(".").pop()?.toLowerCase();
  return ({ ts: "typescript", tsx: "typescript", js: "javascript", jsx: "javascript", py: "python", rb: "ruby", php: "php", java: "java", go: "go", cs: "csharp" } as Record<string, string>)[extension || ""] || "unknown";
}

function summaryFor(decision: CodeReviewResult["decision"], counts: Record<CodeReviewSeverity, number>) {
  if (decision === "PASS") return "No high-confidence security issues were detected in the submitted code.";
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  return `${total} finding${total === 1 ? "" : "s"} detected: ${counts.CRITICAL} critical, ${counts.HIGH} high, ${counts.MEDIUM} medium, and ${counts.LOW} low.`;
}

function complianceFor(findings: CodeReviewFinding[]): CodeReviewResult["compliance"] {
  const frameworks = [
    ["OWASP Top 10", ["A01 Access Control", "A02 Cryptographic Failures", "A03 Injection", "A05 Misconfiguration"]],
    ["SOC 2", ["CC6 Logical Access", "CC7 System Operations"]],
    ["ISO/IEC 27001", ["A.8.15 Logging", "A.8.24 Cryptography", "A.8.25 Secure Development"]],
    ["NIST SSDF", ["PW.4 Secure Coding", "PW.7 Code Review", "RV.1 Vulnerability Identification"]],
  ] as const;
  return frameworks.map(([framework, controls]) => ({
    framework,
    status: findings.length ? "ATTENTION" : "PASS",
    controls: [...controls],
    note: findings.length ? `${findings.length} automated finding(s) require triage and remediation evidence.` : "Automated checks passed; retain review evidence and complete required manual controls.",
  }));
}

export function codeReviewFingerprint(input: CodeReviewInput) {
  return createHash("sha256").update(input.code).digest("hex");
}

export type { CodeReviewResult } from "./types";
