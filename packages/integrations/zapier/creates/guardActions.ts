/**
 * Zapier "Create" actions for SoterAI — the four original guard actions.
 *
 * Each action calls the SoterAI REST API and returns a normalized result. The
 * remaining eight actions live in their own files; everything shared (base-URL
 * validation, the POST helper, the calibration and topic field sets) is in
 * ./shared so there is one copy of each.
 */

import {
  CALIBRATION_OUTPUT_FIELDS,
  TOPIC_INPUT_FIELDS,
  calibrationFields,
  getBaseUrl,
  resolveProjectId,
  topicRequestFields,
  tryParseJson,
  type ZapierBundle,
  type ZapierZ,
} from "./shared";

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
        key: "project",
        label: "Project ID",
        type: "string" as const,
        required: false,
        helpText:
          "Optional SoterAI project ID. Leave blank to use the default project from your connected account.",
      },
      {
        key: "metadata",
        label: "Metadata JSON",
        type: "text" as const,
        required: false,
      },
      ...TOPIC_INPUT_FIELDS,
    ],
    sample: {
      allowed: true,
      blocked: false,
      riskScore: 0.05,
      categories: [],
      safeText: "What is the weather today?",
      reason: null,
      incidentId: null,
      primaryRiskType: null,
      categoryConfidence: {},
      latencyMs: 4,
    },
    outputFields: [
      { key: "allowed", label: "Allowed", type: "boolean" as const },
      { key: "blocked", label: "Blocked", type: "boolean" as const },
      { key: "riskScore", label: "Risk Score", type: "number" as const },
      { key: "categories", label: "Risk Categories", list: true },
      { key: "safeText", label: "Safe Text", type: "string" as const },
      { key: "reason", label: "Reason", type: "string" as const },
      { key: "incidentId", label: "Incident ID", type: "string" as const },
      ...CALIBRATION_OUTPUT_FIELDS,
    ],
    perform: async (z: ZapierZ, bundle: ZapierBundle) => {
      const baseUrl = getBaseUrl(bundle);
      const meta: Record<string, unknown> = tryParseJson(
        bundle.inputData.metadata,
      );
      const pid = resolveProjectId(bundle);
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
          ...topicRequestFields(bundle),
        }),
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
        ...calibrationFields(raw),
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
        key: "project",
        label: "Project ID",
        type: "string" as const,
        required: false,
        helpText:
          "Optional SoterAI project ID. Leave blank to use the default project from your connected account.",
      },
    ],
    sample: {
      allowed: true,
      riskScore: 0.02,
      categories: [],
      safeText: "The weather today is sunny with a high of 75F.",
      reason: null,
      primaryRiskType: null,
      categoryConfidence: {},
      latencyMs: 3,
    },
    outputFields: [
      { key: "allowed", label: "Allowed", type: "boolean" as const },
      { key: "riskScore", label: "Risk Score", type: "number" as const },
      { key: "categories", label: "Risk Categories", list: true },
      { key: "safeText", label: "Safe Text", type: "string" as const },
      { key: "reason", label: "Reason", type: "string" as const },
      ...CALIBRATION_OUTPUT_FIELDS,
    ],
    perform: async (z: ZapierZ, bundle: ZapierBundle) => {
      const baseUrl = getBaseUrl(bundle);
      const meta: Record<string, unknown> = {};
      const pid = resolveProjectId(bundle);
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
        ...calibrationFields(raw),
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
        key: "project",
        label: "Project ID",
        type: "string" as const,
        required: false,
        helpText:
          "Optional SoterAI project ID. Leave blank to use the default project from your connected account.",
      },
    ],
    sample: {
      safeText: "Contact me at [EMAIL REDACTED] or call [PHONE REDACTED].",
      riskScore: 0.6,
    },
    outputFields: [
      { key: "safeText", label: "Redacted Text", type: "string" as const },
      { key: "riskScore", label: "Risk Score", type: "number" as const },
    ],
    perform: async (z: ZapierZ, bundle: ZapierBundle) => {
      const baseUrl = getBaseUrl(bundle);
      const meta: Record<string, unknown> = {};
      const pid = resolveProjectId(bundle);
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
        key: "document_key",
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
        key: "project",
        label: "Project ID",
        type: "string" as const,
        required: false,
        helpText:
          "Optional SoterAI project ID. Leave blank to use the default project from your connected account.",
      },
    ],
    sample: {
      trustScore: 75,
      trustLevel: "TRUSTED",
      findings: [],
      recommendedAction: "INDEX",
    },
    outputFields: [
      { key: "trustScore", label: "Trust Score", type: "number" as const },
      { key: "trustLevel", label: "Trust Level", type: "string" as const },
      { key: "findings", label: "Findings", list: true },
      {
        key: "recommendedAction",
        label: "Recommended Action",
        type: "string" as const,
      },
    ],
    perform: async (z: ZapierZ, bundle: ZapierBundle) => {
      const baseUrl = getBaseUrl(bundle);
      const pid = resolveProjectId(bundle);

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
          documentId: bundle.inputData.document_key,
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
/*  Helpers, types, and base-URL validation now live in ./shared.      */
/*  They were moved there when the app grew from 4 actions to 12 —     */
/*  a second copy of the SSRF check is a second chance to get it wrong.*/
/* ------------------------------------------------------------------ */
