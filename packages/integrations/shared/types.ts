/**
 * Shared types for Soter Guard integration nodes.
 *
 * These describe the *normalised* node-facing contract. They are deliberately
 * decoupled from the raw Soter REST `GuardResult` so that every platform
 * (n8n, Flowise, Langflow, Dify, Zapier, Make, Botpress, Voiceflow) exposes the
 * same simple fields documented in docs/integrations. The raw API response is
 * always preserved on `rawResponse` for power users.
 *
 * NOTE: these mirror — but do not import from — `lib/guard/types.ts` and the
 * Soter JS SDK, on purpose. The integration packages must build standalone
 * without the Next.js app or `@soter/sdk` installed.
 */

/** Policy strictness, mapped to the project's policy engine server-side. */
export type PolicyMode = "MONITOR" | "BALANCED" | "STRICT";

/** What the node should do locally when Soter flags a threat. */
export type OnThreat = "BLOCK" | "REDACT" | "WARN" | "CONTINUE";

/** Redaction strategy for the PII redactor action. */
export type RedactionMode = "PARTIAL" | "FULL" | "HASH";

/** Direction passed to the public analyze endpoint. */
export type GuardDirection = "INPUT" | "OUTPUT";

/** Primitive metadata values accepted by the Soter API (max 20 keys server-side). */
export type MetadataValue = string | number | boolean | null;
export type Metadata = Record<string, MetadataValue>;

/** Options every client method accepts. */
export interface SoterClientOptions {
  /** Soter API key (`sk_...`). Required for authenticated endpoints. */
  apiKey: string;
  /** Base URL of the Soter API, e.g. https://api.cybersecurityguard.com */
  baseUrl?: string;
  /** Default project id applied to requests when not given per-call. */
  projectId?: string;
  /** Request timeout in milliseconds (default 8000). */
  timeoutMs?: number;
  /** Number of network retries on transient failures (default 1). */
  maxRetries?: number;
  /** Backoff between retries in ms (default 250). */
  retryBackoffMs?: number;
  /** Inject a custom fetch (tests / non-global-fetch runtimes). */
  fetch?: typeof fetch;
  /** Extra headers merged into every request (never overrides auth). */
  headers?: Record<string, string>;
  /** Emit non-sensitive debug logs via console.debug. */
  debug?: boolean;
}

export interface CheckInput {
  text: string;
  projectId?: string;
  policyMode?: PolicyMode;
  /** Optional correlation ids forwarded to Soter for audit logs. */
  userId?: string;
  sessionId?: string;
  metadata?: Metadata;
}

export interface CheckOutput {
  text: string;
  projectId?: string;
  policyMode?: PolicyMode;
  sessionId?: string;
  metadata?: Metadata;
}

export interface RedactPiiInput {
  text: string;
  projectId?: string;
  redactionMode?: RedactionMode;
  metadata?: Metadata;
}

export interface ScanRagInput {
  /** Full document text, or pre-split chunks. One of these is required. */
  text?: string;
  chunks?: string[];
  projectId?: string;
  /** Stable id for the document (used for de-dup server-side). */
  documentId?: string;
  sourceName?: string;
  source?: "upload" | "url" | "email" | "api" | "unknown";
  metadata?: Metadata;
}

export interface CreateIncidentInput {
  platform: string;
  workflowId?: string;
  /** The guard result that triggered the incident. */
  result?: GuardCheckResult;
  riskScore?: number;
  reason?: string;
  metadata?: Metadata;
}

/** Normalised result returned by checkInput / checkOutput. */
export interface GuardCheckResult {
  allowed: boolean;
  riskScore: number;
  /** Risk categories (maps from the API `riskTypes`). */
  categories: string[];
  /** Redacted/rewritten safe text when the API produced one. */
  safeText?: string;
  reason: string;
  /** Incident id when the API surfaced one (else undefined). */
  incidentId?: string;
  /** Raw, unmodified API response for advanced use. */
  rawResponse: unknown;
}

export interface RedactPiiResult {
  safeText: string;
  detectedEntities: DetectedEntity[];
  riskScore: number;
  rawResponse: unknown;
}

export interface DetectedEntity {
  type: string;
  label: string;
  severity: string;
  /** Masked sample only — never the raw matched secret. */
  sample?: string;
}

export interface ScanRagResult {
  allowed: boolean;
  riskScore: number;
  issues: RagIssue[];
  safeText?: string;
  safeChunks?: string[];
  incidentId?: string;
  rawResponse: unknown;
}

export interface RagIssue {
  type: string;
  severity: string;
  message: string;
}

export interface CreateIncidentResult {
  incidentId?: string;
  dashboardUrl?: string;
  rawResponse: unknown;
}
