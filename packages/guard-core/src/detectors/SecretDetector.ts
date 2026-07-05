import type { DetectorResult, RegexDetectorSpec } from "../types";
import { runRegexDetectors } from "./utils";

export const SECRET_DETECTOR_VERSION = "1.1.0";

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
        pattern: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{30,255}\b/g,
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
];

export function detectSecrets(text: string): DetectorResult {
    return {
        detectorName: "SecretDetector",
        detectorVersion: SECRET_DETECTOR_VERSION,
        matches: runRegexDetectors(text, SECRET_SPECS),
    };
}
