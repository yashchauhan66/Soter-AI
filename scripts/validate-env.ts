#!/usr/bin/env tsx
/**
 * Production Environment Validator
 *
 * Validates that all required environment variables are set, properly formatted,
 * and safe for production deployment. Run before deploying:
 *
 *   npx tsx scripts/validate-env.ts [--strict] [--file .env.production]
 *
 * Exit codes:
 *   0 — all checks passed
 *   1 — one or more required vars missing or invalid
 *   2 — one or more warnings (non-blocking)
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

// ─── Types ───────────────────────────────────────────────────────────────────

type Severity = "ERROR" | "WARN" | "INFO";

interface ValidationEntry {
  name: string;
  required: boolean;
  description: string;
  validate?: (value: string) => { ok: boolean; message?: string };
  productionOnly?: boolean;
}

interface ValidationResult {
  name: string;
  severity: Severity;
  message: string;
}

// ─── Env file parser ─────────────────────────────────────────────────────────

function parseEnvFile(filePath: string): Record<string, string> {
  if (!existsSync(filePath)) return {};
  const content = readFileSync(filePath, "utf8");
  const env: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("[")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    // Strip surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key) env[key] = value;
  }
  return env;
}

// ─── Validators ──────────────────────────────────────────────────────────────

function minLength(min: number) {
  return (value: string) => ({
    ok: value.length >= min,
    message: value.length < min ? `must be at least ${min} characters (got ${value.length})` : undefined,
  });
}

function matches(pattern: RegExp, label: string) {
  return (value: string) => ({
    ok: pattern.test(value),
    message: !pattern.test(value) ? `does not match expected ${label} format` : undefined,
  });
}

function isNotPlaceholder() {
  return (value: string) => {
    const placeholders = ["replace", "replace-with", "your-", "CHANGE_ME", "TODO", "xxx", "placeholder"];
    const isPlaceholder = placeholders.some((p) => value.toLowerCase().includes(p));
    return { ok: !isPlaceholder, message: isPlaceholder ? "still contains a placeholder value" : undefined };
  };
}

function isNotWeak() {
  return (value: string) => {
    const weak = ["password", "secret", "123456", "admin", "test", "example", "default"];
    const isWeak = weak.some((w) => value.toLowerCase().includes(w) && value.length < 40);
    return { ok: !isWeak, message: isWeak ? "appears to be a weak or default secret" : undefined };
  };
}

function isUrl() {
  return (value: string) => {
    try {
      new URL(value);
      return { ok: true };
    } catch {
      return { ok: false, message: "is not a valid URL" };
    }
  };
}

function isInteger(min?: number, max?: number) {
  return (value: string) => {
    const n = Number(value);
    if (!Number.isInteger(n)) return { ok: false, message: "must be an integer" };
    if (min !== undefined && n < min) return { ok: false, message: `must be >= ${min}` };
    if (max !== undefined && n > max) return { ok: false, message: `must be <= ${max}` };
    return { ok: true };
  };
}

function isBoolean() {
  return (value: string) => ({
    ok: ["true", "false", "1", "0"].includes(value.toLowerCase()),
    message: !["true", "false", "1", "0"].includes(value.toLowerCase()) ? "must be true/false/1/0" : undefined,
  });
}

// ─── Validation definitions ──────────────────────────────────────────────────

const validations: ValidationEntry[] = [
  // ─── Critical (required in production) ───
  {
    name: "DATABASE_URL",
    required: true,
    description: "PostgreSQL connection string",
    validate: (v) => {
      if (!v.startsWith("postgresql://") && !v.startsWith("postgres://")) return { ok: false, message: "must start with postgresql:// or postgres://" };
      if (v.includes("127.0.0.1") || v.includes("localhost")) return { ok: false, message: "must not point to localhost in production" };
      return { ok: true };
    },
  },
  {
    name: "NEXTAUTH_SECRET",
    required: true,
    description: "NextAuth.js signing secret",
    validate: minLength(32),
  },
  {
    name: "NEXTAUTH_URL",
    required: true,
    description: "NextAuth.js canonical URL",
    validate: (v) => {
      const urlCheck = isUrl()(v);
      if (!urlCheck.ok) return urlCheck;
      if (v.includes("localhost")) return { ok: false, message: "must not be localhost in production" };
      return { ok: true };
    },
  },
  {
    name: "API_KEY_PEPPER",
    required: true,
    description: "HMAC pepper for API key hashing",
    validate: (v) => {
      const len = minLength(32)(v);
      if (!len.ok) return len;
      return isNotWeak()(v);
    },
  },
  {
    name: "POSTGRES_PASSWORD",
    required: true,
    description: "PostgreSQL root password (for Docker Compose)",
    validate: minLength(16),
  },
  {
    name: "NODE_ENV",
    required: true,
    description: "Node environment",
    validate: (v) => ({
      ok: v === "production",
      message: v !== "production" ? `expected "production", got "${v}"` : undefined,
    }),
  },

  // ─── Security secrets ───
  {
    name: "WEBHOOK_WORKER_TOKEN",
    required: true,
    description: "Auth token for webhook worker cron endpoint",
    validate: (v) => {
      const len = minLength(32)(v);
      if (!len.ok) return len;
      return isNotPlaceholder()(v);
    },
  },
  {
    name: "REPORT_SIGNING_SECRET",
    required: true,
    description: "HMAC secret for signed reports",
    validate: minLength(32),
  },
  {
    name: "SECRET_STORE_PROVIDER",
    required: true,
    description: "Webhook secret store provider",
    validate: (v) => {
      const allowed = ["local", "aws-kms", "gcp-kms", "vault"];
      return { ok: allowed.includes(v), message: !allowed.includes(v) ? `must be one of: ${allowed.join(", ")}` : undefined };
    },
  },
  {
    name: "LOCAL_SECRET_STORE_KEY",
    required: false,
    description: "Key for local secret store (only if provider=local)",
    validate: (v) => {
      if (v.length < 32) return { ok: false, message: "must be at least 32 characters" };
      return isNotPlaceholder()(v);
    },
  },
  {
    name: "SCIM_TOKEN_PEPPER",
    required: true,
    description: "Pepper for SCIM token hashing",
    validate: minLength(32),
  },

  // ─── Vector / RAG ───
  {
    name: "VECTOR_PROVIDER",
    required: true,
    description: "Vector store provider",
    validate: (v) => {
      const disallowed = ["memory"];
      return { ok: !disallowed.includes(v), message: disallowed.includes(v) ? `"memory" provider is not allowed in production` : undefined };
    },
  },

  // ─── Feature flags ───
  {
    name: "ENABLE_SEMANTIC_DETECTORS",
    required: false,
    description: "Enable semantic ML detectors",
    validate: isBoolean(),
  },
  {
    name: "ENABLE_MULTILINGUAL_DETECTORS",
    required: false,
    description: "Enable multilingual detectors",
    validate: isBoolean(),
  },

  // ─── Email ───
  {
    name: "EMAIL_PROVIDER",
    required: true,
    description: "Email delivery provider",
    validate: (v) => {
      const allowed = ["mock", "resend", "aws-ses", "smtp"];
      return { ok: allowed.includes(v), message: !allowed.includes(v) ? `must be one of: ${allowed.join(", ")}` : undefined };
    },
  },
  {
    name: "EMAIL_FROM",
    required: true,
    description: "Sender email address",
    validate: (v) => {
      if (v.includes("example.com") || v.includes("test")) return { ok: false, message: "must not use example/test domain in production" };
      return { ok: true };
    },
  },

  // ─── Numeric limits ───
  {
    name: "MAX_GUARD_TEXT_LENGTH",
    required: false,
    description: "Maximum guard text length",
    validate: isInteger(100, 100000),
  },
  {
    name: "DEFAULT_RPM",
    required: false,
    description: "Default requests per minute",
    validate: isInteger(1, 10000),
  },

  // ─── Webhook / Redis ───
  {
    name: "WEBHOOK_WORKER_HEALTH_PORT",
    required: false,
    description: "Webhook worker health check port",
    validate: isInteger(1024, 65535),
  },
  {
    name: "SIEM_WORKER_INTERVAL_MS",
    required: false,
    description: "SIEM worker poll interval in ms",
    validate: isInteger(1000, 300000),
  },
];

// ─── Main ────────────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  const strictMode = args.includes("--strict");
  const fileIdx = args.indexOf("--file");
  const inlineFile = args.find((arg) => arg.startsWith("--file="))?.slice("--file=".length);
  const positionalFile = args.find((arg, index) => {
    if (arg.startsWith("-")) return false;
    return index === 0 || args[index - 1] !== "--file";
  });
  const envFile = inlineFile ?? (fileIdx !== -1 ? args[fileIdx + 1] : positionalFile) ?? ".env.production";

  const filePath = resolve(process.cwd(), envFile);
  const fileEnv = parseEnvFile(filePath);
  const processEnv = process.env as Record<string, string>;
  const merged: Record<string, string> = { ...fileEnv, ...processEnv };

  const results: ValidationResult[] = [];

  console.log(`\n╔══════════════════════════════════════════════════════════════╗`);
  console.log(`║         CyberRakshak Guard — Production Env Validator       ║`);
  console.log(`╚══════════════════════════════════════════════════════════════╝\n`);
  console.log(`  File:  ${filePath}`);
  console.log(`  Mode:  ${strictMode ? "STRICT (errors = failure)" : "Standard (warnings are non-blocking)"}\n`);

  for (const entry of validations) {
    const value = merged[entry.name];

    if (!value) {
      if (entry.required) {
        results.push({ name: entry.name, severity: "ERROR", message: `MISSING — ${entry.description}` });
      } else {
        results.push({ name: entry.name, severity: "INFO", message: `not set (optional — ${entry.description})` });
      }
      continue;
    }

    if (entry.validate) {
      const check = entry.validate(value);
      if (!check.ok) {
        results.push({ name: entry.name, severity: "ERROR", message: `${check.message} — ${entry.description}` });
      } else {
        results.push({ name: entry.name, severity: "INFO", message: `OK — ${entry.description}` });
      }
    } else {
      results.push({ name: entry.name, severity: "INFO", message: `OK — ${entry.description}` });
    }
  }

  // Report
  const errors = results.filter((r) => r.severity === "ERROR");
  const warnings = results.filter((r) => r.severity === "WARN");
  const passed = results.filter((r) => r.severity === "INFO");

  for (const r of results) {
    const icon = r.severity === "ERROR" ? "✖" : r.severity === "WARN" ? "⚠" : "✔";
    const color = r.severity === "ERROR" ? "\x1b[31m" : r.severity === "WARN" ? "\x1b[33m" : "\x1b[32m";
    console.log(`  ${color}${icon}\x1b[0m ${r.name.padEnd(35)} ${r.message}`);
  }

  console.log(`\n  ── Summary ──────────────────────────────────────────────`);
  console.log(`  Passed:    ${passed.length}`);
  console.log(`  Errors:    ${errors.length}`);
  console.log(`  Warnings:  ${warnings.length}`);
  console.log(`  ────────────────────────────────────────────────────────\n`);

  if (errors.length > 0) {
    console.log("  ✖ PRODUCTION READINESS: FAIL\n");
    process.exit(1);
  }

  if (warnings.length > 0 && strictMode) {
    console.log("  ⚠ PRODUCTION READINESS: FAIL (strict mode)\n");
    process.exit(2);
  }

  console.log("  ✔ PRODUCTION READINESS: PASS\n");
  process.exit(0);
}

main();
