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
        key: "policyMode",
        label: "Policy Mode",
        type: "string" as const,
        required: false,
        choices: { MONITOR: "Monitor", BALANCED: "Balanced", STRICT: "Strict" },
        default: "BALANCED",
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
        bundle.authData.baseUrl || "https://api.soterai.dev"
      ).replace(/\/$/, "");
      const meta: Record<string, unknown> = tryParseJson(
        bundle.inputData.metadata,
      );
      const pid = bundle.inputData.projectId || bundle.authData.projectId;
      if (pid) meta.projectId = pid;
      if (bundle.inputData.policyMode)
        meta.policyMode = bundle.inputData.policyMode;

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
        key: "policyMode",
        label: "Policy Mode",
        type: "string" as const,
        required: false,
        choices: { MONITOR: "Monitor", BALANCED: "Balanced", STRICT: "Strict" },
        default: "BALANCED",
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
        bundle.authData.baseUrl || "https://api.soterai.dev"
      ).replace(/\/$/, "");
      const meta: Record<string, unknown> = {};
      const pid = bundle.inputData.projectId || bundle.authData.projectId;
      if (pid) meta.projectId = pid;
      if (bundle.inputData.policyMode)
        meta.policyMode = bundle.inputData.policyMode;

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
        key: "redactionMode",
        label: "Redaction Mode",
        type: "string" as const,
        required: false,
        choices: { PARTIAL: "Partial", FULL: "Full", HASH: "Hash" },
        default: "PARTIAL",
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
        bundle.authData.baseUrl || "https://api.soterai.dev"
      ).replace(/\/$/, "");
      const meta: Record<string, unknown> = {
        _redactionMode: bundle.inputData.redactionMode || "PARTIAL",
      };
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
        key: "sourceName",
        label: "Source Name",
        type: "string" as const,
        required: false,
        helpText: "Name or identifier of the document source (e.g. filename, URL).",
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
      riskScore: 0.01,
      issues: [],
      safeText: "This is a clean document with no embedded threats.",
    },
    perform: async (z: ZapierZ, bundle: ZapierBundle) => {
      const baseUrl = (
        bundle.authData.baseUrl || "https://api.soterai.dev"
      ).replace(/\/$/, "");
      const meta: Record<string, unknown> = {
        _ragScan: true,
      };
      if (bundle.inputData.sourceName)
        meta._sourceName = bundle.inputData.sourceName;
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

      const raw = response.json;
      return {
        allowed: raw.allowed,
        riskScore: raw.riskScore,
        issues: raw.riskTypes ?? [],
        safeText:
          raw.safeText ?? raw.redactedText ?? bundle.inputData.text,
      };
    },
  },
};

export const createIncident = {
  key: "create_incident",
  noun: "Incident",
  display: {
    label: "Create Incident",
    description:
      "Log a security incident to the SoterAI dashboard. Note: requires admin API access.",
  },
  operation: {
    inputFields: [
      {
        key: "platform",
        label: "Platform",
        type: "string" as const,
        required: true,
        helpText: "The platform where the incident occurred (e.g. zapier, slack, custom).",
      },
      {
        key: "workflowId",
        label: "Workflow ID",
        type: "string" as const,
        required: false,
        helpText: "Identifier of the workflow that triggered the incident.",
      },
      {
        key: "riskScore",
        label: "Risk Score",
        type: "number" as const,
        required: false,
        helpText: "Risk score between 0 and 1.",
      },
      {
        key: "reason",
        label: "Reason",
        type: "text" as const,
        required: false,
        helpText: "Human-readable description of why the incident was created.",
      },
    ],
    sample: {
      incidentId: "inc_abc123",
      dashboardUrl: "https://app.soterai.dev/incidents/inc_abc123",
    },
    perform: async (z: ZapierZ, bundle: ZapierBundle) => {
      const baseUrl = (
        bundle.authData.baseUrl || "https://api.soterai.dev"
      ).replace(/\/$/, "");

      try {
        const response = await z.request({
          url: `${baseUrl}/api/ops/incidents`,
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": bundle.authData.apiKey,
            "User-Agent": "soterai-zapier/1.0",
          },
          body: JSON.stringify({
            platform: bundle.inputData.platform,
            workflowId: bundle.inputData.workflowId || undefined,
            riskScore: bundle.inputData.riskScore
              ? Number(bundle.inputData.riskScore)
              : undefined,
            reason: bundle.inputData.reason || undefined,
          }),
        });

        const raw = response.json;
        return {
          incidentId: raw.incidentId ?? raw.id ?? null,
          dashboardUrl: raw.dashboardUrl ?? null,
        };
      } catch (err: unknown) {
        return {
          incidentId: null,
          dashboardUrl: null,
          error: err instanceof Error ? err.message : "Failed to create incident",
        };
      }
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
  ): Promise<{ json: Record<string, unknown> }>;
}
interface ZapierBundle {
  authData: Record<string, string>;
  inputData: Record<string, string>;
}
