/**
 * Lightweight, dependency-free validation + masking helpers.
 *
 * We intentionally avoid pulling `zod` into the integration packages so they
 * stay tiny and easy to vendor into platform marketplaces. Validation mirrors
 * the server-side limits in `lib/validations.ts` (text length, metadata shape)
 * so users get a clear local error before a network round-trip.
 */

import { SoterValidationError } from "./errors";
import type { Metadata, MetadataValue, PolicyMode, OnThreat, RedactionMode } from "./types";

/**
 * Client-side maximum text length for early validation.
 * The server default is 8 000 (configurable via MAX_GUARD_TEXT_LENGTH env).
 * We use a higher ceiling here so the integration client does not reject
 * text that a self-hosted server with a raised limit would accept. The
 * server always enforces its own limit and returns a clear 400 error.
 */
export const MAX_TEXT_LENGTH = 50_000;
export const MAX_METADATA_KEYS = 20;

const POLICY_MODES: readonly PolicyMode[] = ["MONITOR", "BALANCED", "STRICT"];
const ON_THREAT: readonly OnThreat[] = ["BLOCK", "REDACT", "WARN", "CONTINUE"];
const REDACTION_MODES: readonly RedactionMode[] = ["PARTIAL", "FULL", "HASH"];

export function assertNonEmptyText(value: unknown, field = "text"): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new SoterValidationError(`${field} is required and must be a non-empty string.`);
  }
  if (value.length > MAX_TEXT_LENGTH) {
    throw new SoterValidationError(`${field} exceeds the maximum length of ${MAX_TEXT_LENGTH} characters.`);
  }
  return value;
}

export function assertApiKey(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new SoterValidationError("A Soter API key is required.");
  }
  return value.trim();
}

export function normalizePolicyMode(value: unknown, fallback: PolicyMode = "BALANCED"): PolicyMode {
  if (value == null || value === "") return fallback;
  const upper = String(value).toUpperCase() as PolicyMode;
  if (!POLICY_MODES.includes(upper)) {
    throw new SoterValidationError(`policyMode must be one of: ${POLICY_MODES.join(", ")}.`);
  }
  return upper;
}

export function normalizeOnThreat(value: unknown, fallback: OnThreat = "BLOCK"): OnThreat {
  if (value == null || value === "") return fallback;
  const upper = String(value).toUpperCase() as OnThreat;
  if (!ON_THREAT.includes(upper)) {
    throw new SoterValidationError(`onThreat must be one of: ${ON_THREAT.join(", ")}.`);
  }
  return upper;
}

export function normalizeRedactionMode(value: unknown, fallback: RedactionMode = "PARTIAL"): RedactionMode {
  if (value == null || value === "") return fallback;
  const upper = String(value).toUpperCase() as RedactionMode;
  if (!REDACTION_MODES.includes(upper)) {
    throw new SoterValidationError(`redactionMode must be one of: ${REDACTION_MODES.join(", ")}.`);
  }
  return upper;
}

/**
 * Parse a metadata input that may arrive as a JSON string (common from
 * drag-and-drop UIs) or an object. Enforces the server's 20-key limit and
 * primitive-value rule.
 */
export function normalizeMetadata(value: unknown): Metadata | undefined {
  if (value == null || value === "") return undefined;
  let obj: unknown = value;
  if (typeof value === "string") {
    try {
      obj = JSON.parse(value);
    } catch {
      throw new SoterValidationError("metadata must be valid JSON.");
    }
  }
  if (typeof obj !== "object" || Array.isArray(obj) || obj === null) {
    throw new SoterValidationError("metadata must be a JSON object.");
  }
  const entries = Object.entries(obj as Record<string, unknown>);
  if (entries.length > MAX_METADATA_KEYS) {
    throw new SoterValidationError(`metadata may contain at most ${MAX_METADATA_KEYS} fields.`);
  }
  const out: Metadata = {};
  for (const [key, raw] of entries) {
    if (!key || key.length > 64) {
      throw new SoterValidationError("metadata keys must be 1-64 characters.");
    }
    if (raw === null || typeof raw === "string" || typeof raw === "boolean" || typeof raw === "number") {
      out[key] = raw as MetadataValue;
    } else {
      // Stringify nested values so we never reject a workflow outright.
      out[key] = JSON.stringify(raw).slice(0, 500);
    }
  }
  return out;
}

/**
 * Mask an API key for safe display/logging: keeps a short prefix + suffix only.
 * SECURITY: every place that might surface a key to a UI or log MUST route
 * through this. Never print the raw value.
 */
export function maskApiKey(apiKey: string | undefined | null): string {
  if (!apiKey) return "(none)";
  const trimmed = String(apiKey).trim();
  if (trimmed.length <= 8) return "****";
  return `${trimmed.slice(0, 4)}…${trimmed.slice(-4)}`;
}
