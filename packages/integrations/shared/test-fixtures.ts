/**
 * Test fixtures and mock factory for integration client tests.
 *
 * These simulate Soter API responses without hitting a real server.
 * They match the exact response shape of the guard/input and guard/output
 * endpoints (see app/api/guard/input/route.ts).
 */

import type { GuardCheckResult, RedactPiiResult, ScanRagResult, CreateIncidentResult } from "./types";

export const MOCK_API_KEY = "sk_test_integration_000000000000";
export const MOCK_BASE_URL = "https://mock.soter.test";
export const MOCK_PROJECT_ID = "proj_test_001";

export interface MockGuardApiResponse {
  allowed: boolean;
  action: string;
  riskScore: number;
  riskTypes: string[];
  reason: string;
  safeText?: string;
  redactedText?: string;
  findings: Array<{
    type: string;
    label: string;
    severity: string;
    score: number;
    message: string;
    matched?: string;
  }>;
  metadata?: Record<string, unknown>;
}

export const SAFE_INPUT_RESPONSE: MockGuardApiResponse = {
  allowed: true,
  action: "ALLOW",
  riskScore: 0.05,
  riskTypes: ["LOW_RISK"],
  reason: "No threats detected.",
  findings: [],
};

export const INJECTION_BLOCKED_RESPONSE: MockGuardApiResponse = {
  allowed: false,
  action: "BLOCK",
  riskScore: 0.95,
  riskTypes: ["PROMPT_INJECTION", "JAILBREAK"],
  reason: "Prompt injection attempt detected.",
  findings: [
    {
      type: "PROMPT_INJECTION",
      label: "Injection attempt",
      severity: "CRITICAL",
      score: 0.95,
      message: "Detected prompt injection pattern in user input.",
    },
  ],
};

export const PII_REDACTED_RESPONSE: MockGuardApiResponse = {
  allowed: true,
  action: "ALLOW_WITH_REDACTION",
  riskScore: 0.6,
  riskTypes: ["PII_DETECTED"],
  reason: "PII detected and redacted.",
  safeText: "My email is [EMAIL_REDACTED] and my phone is [PHONE_REDACTED].",
  redactedText: "My email is [EMAIL_REDACTED] and my phone is [PHONE_REDACTED].",
  findings: [
    {
      type: "PII_DETECTED",
      label: "Email address",
      severity: "MEDIUM",
      score: 0.7,
      message: "Email address detected.",
      matched: "user@example.com",
    },
    {
      type: "PII_DETECTED",
      label: "Phone number",
      severity: "MEDIUM",
      score: 0.65,
      message: "Phone number detected.",
      matched: "+1234567890",
    },
  ],
};

export const UNSAFE_OUTPUT_RESPONSE: MockGuardApiResponse = {
  allowed: false,
  action: "BLOCK",
  riskScore: 0.88,
  riskTypes: ["UNSAFE_OUTPUT"],
  reason: "AI output contains potentially harmful content.",
  findings: [
    {
      type: "UNSAFE_OUTPUT",
      label: "Harmful content",
      severity: "HIGH",
      score: 0.88,
      message: "Output contains potentially harmful instructions.",
    },
  ],
};

export const RAG_TRUST_RESPONSE = {
  trustScore: 85,
  trustLevel: "TRUSTED",
  findings: [],
  recommendedAction: "INDEX",
};

export const RAG_QUARANTINED_RESPONSE = {
  trustScore: 20,
  trustLevel: "QUARANTINED",
  findings: [
    {
      type: "PROMPT_INJECTION",
      label: "Embedded injection",
      severity: "HIGH",
      score: 0.82,
      message: "Document contains embedded prompt injection.",
    },
  ],
  recommendedAction: "QUARANTINE",
};

export function createMockFetch(responseMap?: Record<string, { status: number; body: unknown }>): typeof fetch {
  const defaults: Record<string, { status: number; body: unknown }> = {
    "/api/guard/input": { status: 200, body: SAFE_INPUT_RESPONSE },
    "/api/guard/output": { status: 200, body: SAFE_INPUT_RESPONSE },
    "/api/rag/document/trust-score": { status: 200, body: RAG_TRUST_RESPONSE },
    "/api/ops/incidents": { status: 200, body: { incidentId: "inc_mock_001" } },
    ...responseMap,
  };

  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const path = new URL(url).pathname;
    const entry = defaults[path];

    if (!entry) {
      return new Response(JSON.stringify({ message: "Not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(entry.body), {
      status: entry.status,
      headers: { "Content-Type": "application/json" },
    });
  };
}

export function createFailingFetch(error: Error): typeof fetch {
  return async (): Promise<Response> => {
    throw error;
  };
}

export function create429Fetch(retryAfter = 60): typeof fetch {
  return async (): Promise<Response> => {
    return new Response(
      JSON.stringify({ message: "Rate limit exceeded." }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(retryAfter),
        },
      },
    );
  };
}

export function create401Fetch(): typeof fetch {
  return async (): Promise<Response> => {
    return new Response(
      JSON.stringify({ message: "Invalid API key." }),
      {
        status: 401,
        headers: { "Content-Type": "application/json" },
      },
    );
  };
}
