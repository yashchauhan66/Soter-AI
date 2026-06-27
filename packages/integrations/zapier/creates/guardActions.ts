/**
 * Zapier "Create" actions for SoterAI.
 *
 * Each action calls the SoterAI REST API and returns a normalized result.
 */

export const inputGuard = {
  key: "input_guard",
  noun: "Input Guard",
  display: {
    label: "Check Input Safety",
    description:
      "Check user input for prompt injection, jailbreaks, PII, and other AI security threats using SoterAI.",
  },
  operation: {
    inputFields: [
      {
        key: "text",
        label: "Input Text",
        type: "text" as const,
        required: true,
        helpText: "The user message to check.",
      },
      {
        key: "onThreat",
        label: "On Threat",
        type: "string" as const,
        required: false,
        choices: {
          BLOCK: "Block",
          REDACT: "Redact",
          WARN: "Warn",
          CONTINUE: "Continue",
        },
        default: "BLOCK",
      },
      {
        key: "projectId",
        label: "Project ID",
        type: "string" as const,
        required: false,
      },
      {
        key: "metadata",
        label: "Metadata JSON",
        type: "text" as const,
        required: false,
      },
    ],
    sample: {
      allowed: true,
      blocked: false,
      riskScore: 0.05,
      categories: [],
      safeText: "What is the weather today?",
      reason: null,
      incidentId: null,
    },
    perform: async (z: ZapierZ, bundle: ZapierBundle) => {
      const baseUrl = (
        bundle.authData.baseUrl || "https://soterai.publicvm.com"
      ).replace(/\/$/, "");
      const meta: Record<string, unknown> = tryParseJson(
        bundle.inputData.metadata,
      );
      const pid = bundle.inputData.projectId || bundle.authData.projectId;
      if (pid) meta.projectId = pid;
      const response = await z.request({
        url: `${baseUrl}/api/guard/input`,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": bundle.authData.apiKey,
          "User-Agent": "soterai-zapier/1.0",
        },
        body: JSON.stringify({ message: bundle.inputData.text, metadata: meta }),
      });
      response.throwForStatus();

      const raw = response.json;
      const allowed = raw.allowed as boolean;
      const onThreat = bundle.inputData.onThreat || "BLOCK";
      let outputText =
        raw.safeText ?? raw.redactedText ?? bundle.inputData.text;
      let blocked = false;

      if (!allowed) {
        if (onThreat === "BLOCK") {
          blocked = true;
          outputText = "";
        } else if (onThreat === "CONTINUE") {
          outputText = bundle.inputData.text;
        }
      }

      return {
        allowed,
        blocked,
        riskScore: raw.riskScore,
        categories: raw.riskTypes,
        safeText: outputText,
        reason: raw.reason,
        incidentId: raw.incidentId ?? null,
      };
    },
  },
};

export const outputGuard = {
  key: "output_guard",
  noun: "Output Guard",
  display: {
    label: "Check Output Safety",
    description:
      "Check AI-generated responses for unsafe content, system prompt leakage, and PII using SoterAI.",
  },
  operation: {
    inputFields: [
      {
        key: "text",
        label: "AI Output Text",
        type: "text" as const,
        required: true,
      },
      {
        key: "projectId",
        label: "Project ID",
        type: "string" as const,
        required: false,
      },
    ],
    sample: {
      allowed: true,
      riskScore: 0.02,
      categories: [],
      safeText: "The weather today is sunny with a high of 75F.",
      reason: null,
    },
    perform: async (z: ZapierZ, bundle: ZapierBundle) => {
      const baseUrl = (
        bundle.authData.baseUrl || "https://soterai.publicvm.com"
      ).replace(/\/$/, "");
      const meta: Record<string, unknown> = {};
      const pid = bundle.inputData.projectId || bundle.authData.projectId;
      if (pid) meta.projectId = pid;
      const response = await z.request({
        url: `${baseUrl}/api/guard/output`,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": bundle.authData.apiKey,
          "User-Agent": "soterai-zapier/1.0",
        },
        body: JSON.stringify({
          aiResponse: bundle.inputData.text,
          metadata: meta,
        }),
      });
      response.throwForStatus();

      const raw = response.json;
      return {
        allowed: raw.allowed,
        riskScore: raw.riskScore,
        categories: raw.riskTypes,
        safeText:
          raw.safeText ?? raw.redactedText ?? bundle.inputData.text,
        reason: raw.reason,
      };
    },
  },
};

export const piiRedactor = {
  key: "pii_redactor",
  noun: "PII Redactor",
  display: {
    label: "Redact PII From Text",
    description:
      "Redact personally identifiable information and secrets from text using SoterAI.",
  },
  operation: {
    inputFields: [
      {
        key: "text",
        label: "Text",
        type: "text" as const,
        required: true,
      },
      {
        key: "projectId",
        label: "Project ID",
        type: "string" as const,
        required: false,
      },
    ],
    sample: {
      safeText: "Contact me at [EMAIL REDACTED] or call [PHONE REDACTED].",
      riskScore: 0.6,
    },
    perform: async (z: ZapierZ, bundle: ZapierBundle) => {
      const baseUrl = (
        bundle.authData.baseUrl || "https://soterai.publicvm.com"
      ).replace(/\/$/, "");
      const meta: Record<string, unknown> = {};
      const pid = bundle.inputData.projectId || bundle.authData.projectId;
      if (pid) meta.projectId = pid;

      const response = await z.request({
        url: `${baseUrl}/api/guard/input`,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": bundle.authData.apiKey,
          "User-Agent": "soterai-zapier/1.0",
        },
        body: JSON.stringify({
          message: bundle.inputData.text,
          metadata: meta,
        }),
      });
      response.throwForStatus();

      const raw = response.json;
      return {
        safeText:
          raw.safeText ?? raw.redactedText ?? bundle.inputData.text,
        riskScore: raw.riskScore,
      };
    },
  },
};

export const ragScanner = {
  key: "rag_scanner",
  noun: "RAG Scanner",
  display: {
    label: "Scan RAG Document",
    description:
      "Scan documents for threats before adding to RAG/vector databases.",
  },
  operation: {
    inputFields: [
      {
        key: "text",
        label: "Document Text",
        type: "text" as const,
        required: true,
        helpText: "The document content to scan before RAG ingestion.",
      },
      {
        key: "documentId",
        label: "Document ID",
        type: "string" as const,
        required: true,
        helpText: "Stable identifier used to track this document scan.",
      },
      {
        key: "source",
        label: "Document Source",
        type: "string" as const,
        required: false,
        choices: { api: "API", email: "Email", upload: "File Upload", url: "URL", unknown: "Unknown" },
        default: "api",
      },
      {
        key: "projectId",
        label: "Project ID",
        type: "string" as const,
        required: false,
      },
    ],
    sample: {
      trustScore: 75,
      trustLevel: "TRUSTED",
      findings: [],
      recommendedAction: "INDEX",
    },
    perform: async (z: ZapierZ, bundle: ZapierBundle) => {
      const baseUrl = (
        bundle.authData.baseUrl || "https://soterai.publicvm.com"
      ).replace(/\/$/, "");
      const pid = bundle.inputData.projectId || bundle.authData.projectId;

      const response = await z.request({
        url: `${baseUrl}/api/rag/document/trust-score`,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": bundle.authData.apiKey,
          "User-Agent": "soterai-zapier/1.0",
        },
        body: JSON.stringify({
          projectId: pid || undefined,
          documentId: bundle.inputData.documentId,
          content: bundle.inputData.text,
          source: bundle.inputData.source || "api",
        }),
      });
      response.throwForStatus();

      const raw = response.json;
      return {
        trustScore: raw.trustScore,
        trustLevel: raw.trustLevel,
        findings: raw.findings ?? [],
        recommendedAction: raw.recommendedAction,
      };
    },
  },
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function tryParseJson(value?: string): Record<string, unknown> {
  if (!value?.trim()) return {};
  try {
    const p = JSON.parse(value);
    return typeof p === "object" && p && !Array.isArray(p) ? p : {};
  } catch {
    return {};
  }
}

/* ------------------------------------------------------------------ */
/*  Minimal Zapier type stubs                                         */
/* ------------------------------------------------------------------ */

interface ZapierZ {
  request(
    opts: Record<string, unknown>,
  ): Promise<{
    json: Record<string, unknown>;
    throwForStatus(): void;
  }>;
}
interface ZapierBundle {
  authData: Record<string, string>;
  inputData: Record<string, string>;
}
