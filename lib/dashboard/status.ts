/**
 * Dashboard status vocabulary.
 *
 * Two problems this fixes.
 *
 * **1. Users were reading enum names.** `StatusBadge` rendered its raw value, so
 * the console showed operators `ALLOW_WITH_REDACTION`,
 * `PROMPT_INJECTION_DETECTED`, and `COMPETITIVE_INTEL_EXTRACTION`. Screaming
 * snake case is a database detail; a security console should say "Redacted" and
 * "Prompt injection".
 *
 * **2. Tones were ad-hoc.** 60+ entries hard-coded `bg-red-400/10 text-red-300`
 * triplets, so "blocked" was styled several slightly different ways depending on
 * which enum reached the badge. Every status now maps to one of five semantic
 * intents, which resolve to the shared `.badge-*` classes in `globals.css`.
 *
 * Adding a status: add it here, not at the call site.
 */

/** Semantic intent, not a colour — renaming a colour must not touch 60 rows. */
export type StatusIntent = "success" | "info" | "warning" | "danger" | "neutral";

export interface StatusMeta {
  /** Human-readable label shown to operators. */
  label: string;
  intent: StatusIntent;
}

const INTENT_CLASS: Record<StatusIntent, string> = {
  success: "badge-success",
  info: "badge-info",
  warning: "badge-warning",
  danger: "badge-danger",
  neutral: "badge-neutral",
};

const STATUS: Record<string, StatusMeta> = {
  // ── Guard decisions ───────────────────────────────────────────────
  ALLOW: { label: "Allowed", intent: "success" },
  ALLOW_WITH_REDACTION: { label: "Allowed · redacted", intent: "info" },
  REDACT: { label: "Redacted", intent: "info" },
  REWRITE: { label: "Rewritten", intent: "info" },
  REVIEW: { label: "In review", intent: "info" },
  ASK_APPROVAL: { label: "Awaiting approval", intent: "warning" },
  TAKEOVER_REQUIRED: { label: "Takeover required", intent: "warning" },
  BLOCK: { label: "Blocked", intent: "danger" },
  BLOCKED: { label: "Blocked", intent: "danger" },
  DENY: { label: "Denied", intent: "danger" },
  DENIED: { label: "Denied", intent: "danger" },

  // ── Lifecycle / operational state ─────────────────────────────────
  ACTIVE: { label: "Active", intent: "success" },
  APPROVED: { label: "Approved", intent: "success" },
  GENERATED: { label: "Generated", intent: "success" },
  PASS: { label: "Passed", intent: "success" },
  SAFE_TO_EXECUTE: { label: "Safe to execute", intent: "success" },
  READY: { label: "Ready", intent: "info" },
  AVAILABLE: { label: "Available", intent: "info" },
  EXECUTED: { label: "Executed", intent: "info" },
  EXPORTED: { label: "Exported", intent: "info" },
  RESOLVED: { label: "Resolved", intent: "info" },
  EDITED_AND_APPROVED: { label: "Edited · approved", intent: "info" },
  PENDING: { label: "Pending", intent: "warning" },
  NEEDS_REVIEW: { label: "Needs review", intent: "warning" },
  REQUIRE_APPROVAL: { label: "Approval required", intent: "warning" },
  ALERT: { label: "Alert", intent: "warning" },
  WARNING: { label: "Warning", intent: "warning" },
  FAIL: { label: "Failed", intent: "danger" },
  QUARANTINED: { label: "Quarantined", intent: "danger" },
  IRREVERSIBLE: { label: "Irreversible", intent: "danger" },
  DRAFT: { label: "Draft", intent: "neutral" },
  DISABLED: { label: "Disabled", intent: "neutral" },
  DELETED: { label: "Deleted", intent: "neutral" },
  CANCELLED: { label: "Cancelled", intent: "neutral" },
  EXPIRED: { label: "Expired", intent: "neutral" },

  // ── MCP drift ─────────────────────────────────────────────────────
  PROMPT_INJECTION_DETECTED: { label: "Prompt injection", intent: "danger" },
  RISK_INCREASED: { label: "Risk increased", intent: "danger" },
  CAPABILITY_ADDED: { label: "Capability added", intent: "warning" },
  ENDPOINT_CHANGED: { label: "Endpoint changed", intent: "warning" },
  SCHEMA_CHANGED: { label: "Schema changed", intent: "info" },
  DESCRIPTION_CHANGED: { label: "Description changed", intent: "info" },
  CAPABILITY_REMOVED: { label: "Capability removed", intent: "neutral" },

  // ── Detected risk categories ──────────────────────────────────────
  TOXICITY: { label: "Toxic content", intent: "danger" },
  RECURSIVE_INJECTION: { label: "Recursive injection", intent: "danger" },
  SSRF_ATTEMPT: { label: "SSRF attempt", intent: "danger" },
  BIAS_DETECTED: { label: "Bias detected", intent: "warning" },
  COMPETITIVE_INTEL_EXTRACTION: { label: "Competitive intel probe", intent: "warning" },
  HALLUCINATION: { label: "Unsupported claim", intent: "warning" },

  // ── Incident severity / state ─────────────────────────────────────
  CRITICAL: { label: "Critical", intent: "danger" },
  MAJOR: { label: "Major", intent: "warning" },
  MINOR: { label: "Minor", intent: "info" },
  NONE: { label: "None", intent: "neutral" },
  INVESTIGATING: { label: "Investigating", intent: "danger" },
  IDENTIFIED: { label: "Identified", intent: "warning" },
  MONITORING: { label: "Monitoring", intent: "info" },
};

/**
 * Fall back to title case for an unmapped value.
 *
 * Deliberately still humanises rather than echoing the raw enum: a status added
 * to the schema but not to this file should degrade to "Some New State", not leak
 * `SOME_NEW_STATE` into the console.
 */
function humanise(value: string): string {
  return value
    .toLowerCase()
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function getStatusMeta(value: string): StatusMeta {
  return STATUS[value] ?? { label: humanise(value), intent: "neutral" };
}

export function getStatusClass(value: string): string {
  return INTENT_CLASS[getStatusMeta(value).intent];
}

export function intentClass(intent: StatusIntent): string {
  return INTENT_CLASS[intent];
}

/**
 * Risk levels are an *ordered* scale, so they keep their own colour ramp rather
 * than reusing the unordered status intents.
 */
export const RISK_LEVEL: Record<string, { label: string; className: string }> = {
  LOW: { label: "Low", className: "text-emerald-300" },
  MEDIUM: { label: "Medium", className: "text-amber-300" },
  HIGH: { label: "High", className: "text-orange-300" },
  CRITICAL: { label: "Critical", className: "text-rose-300" },
};

