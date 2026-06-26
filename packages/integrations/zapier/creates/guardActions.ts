/**
 * Zapier "Create" actions for Soter Guard.
 *
 * Each action calls the Soter REST API and returns a normalized result.
 */

export const inputGuard = {
  key: "input_guard",
  noun: "Input Guard",
  display: {
    label: "Check Input for Threats",
    description: "Check user input for prompt injection, jailbreaks, PII, and other AI security threats.",
  },
  operation: {
    inputFields: [
      { key: "text", label: "Input Text", type: "text" as const, required: true, helpText: "The user message to check." },
      {
        key: "policyMode", label: "Policy Mode", type: "string" as const, required: false,
        choices: { MONITOR: "Monitor", BALANCED: "Balanced", STRICT: "Strict" }, default: "BALANCED",
      },
      {
        key: "onThreat", label: "On Threat", type: "string" as const, required: false,
        choices: { BLOCK: "Block", REDACT: "Redact", WARN: "Warn", CONTINUE: "Continue" }, default: "BLOCK",
      },
      { key: "projectId", label: "Project ID", type: "string" as const, required: false },
      { key: "metadata", label: "Metadata JSON", type: "text" as const, required: false },
    ],
    perform: async (z: ZapierZ, bundle: ZapierBundle) => {
      const baseUrl = (bundle.authData.baseUrl || "https://api.cybersecurityguard.com").replace(/\/$/, "");
      const meta: Record<string, unknown> = tryParseJson(bundle.inputData.metadata);
      const pid = bundle.inputData.projectId || bundle.authData.projectId;
      if (pid) meta.projectId = pid;
      if (bundle.inputData.policyMode) meta.policyMode = bundle.inputData.policyMode;

      const response = await z.request({
        url: `${baseUrl}/api/guard/input`,
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": bundle.authData.apiKey, "User-Agent": "soter-zapier/1.0" },
        body: JSON.stringify({ message: bundle.inputData.text, metadata: meta }),
      });

      const raw = response.json;
      const allowed = raw.allowed as boolean;
      const onThreat = bundle.inputData.onThreat || "BLOCK";
      let outputText = raw.safeText ?? raw.redactedText ?? bundle.inputData.text;
      let blocked = false;

      if (!allowed) {
        if (onThreat === "BLOCK") { blocked = true; outputText = ""; }
        else if (onThreat === "CONTINUE") { outputText = bundle.inputData.text; }
      }

      return { allowed, blocked, riskScore: raw.riskScore, categories: raw.riskTypes, safeText: outputText, reason: raw.reason, incidentId: raw.incidentId ?? null };
    },
  },
};

export const outputGuard = {
  key: "output_guard",
  noun: "Output Guard",
  display: {
    label: "Check AI Output for Threats",
    description: "Check AI-generated responses for unsafe content, system prompt leakage, and PII.",
  },
  operation: {
    inputFields: [
      { key: "text", label: "AI Output Text", type: "text" as const, required: true },
      {
        key: "policyMode", label: "Policy Mode", type: "string" as const, required: false,
        choices: { MONITOR: "Monitor", BALANCED: "Balanced", STRICT: "Strict" }, default: "BALANCED",
      },
      { key: "projectId", label: "Project ID", type: "string" as const, required: false },
    ],
    perform: async (z: ZapierZ, bundle: ZapierBundle) => {
      const baseUrl = (bundle.authData.baseUrl || "https://api.cybersecurityguard.com").replace(/\/$/, "");
      const meta: Record<string, unknown> = {};
      const pid = bundle.inputData.projectId || bundle.authData.projectId;
      if (pid) meta.projectId = pid;
      if (bundle.inputData.policyMode) meta.policyMode = bundle.inputData.policyMode;

      const response = await z.request({
        url: `${baseUrl}/api/guard/output`,
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": bundle.authData.apiKey, "User-Agent": "soter-zapier/1.0" },
        body: JSON.stringify({ aiResponse: bundle.inputData.text, metadata: meta }),
      });

      const raw = response.json;
      return { allowed: raw.allowed, riskScore: raw.riskScore, categories: raw.riskTypes, safeText: raw.safeText ?? raw.redactedText ?? bundle.inputData.text, reason: raw.reason };
    },
  },
};

export const piiRedactor = {
  key: "pii_redactor",
  noun: "PII Redactor",
  display: {
    label: "Redact PII from Text",
    description: "Redact personally identifiable information and secrets from text.",
  },
  operation: {
    inputFields: [
      { key: "text", label: "Text", type: "text" as const, required: true },
      {
        key: "redactionMode", label: "Redaction Mode", type: "string" as const, required: false,
        choices: { PARTIAL: "Partial", FULL: "Full", HASH: "Hash" }, default: "PARTIAL",
      },
      { key: "projectId", label: "Project ID", type: "string" as const, required: false },
    ],
    perform: async (z: ZapierZ, bundle: ZapierBundle) => {
      const baseUrl = (bundle.authData.baseUrl || "https://api.cybersecurityguard.com").replace(/\/$/, "");
      const meta: Record<string, unknown> = { _redactionMode: bundle.inputData.redactionMode || "PARTIAL" };
      const pid = bundle.inputData.projectId || bundle.authData.projectId;
      if (pid) meta.projectId = pid;

      const response = await z.request({
        url: `${baseUrl}/api/guard/input`,
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": bundle.authData.apiKey, "User-Agent": "soter-zapier/1.0" },
        body: JSON.stringify({ message: bundle.inputData.text, metadata: meta }),
      });

      const raw = response.json;
      return { safeText: raw.safeText ?? raw.redactedText ?? bundle.inputData.text, riskScore: raw.riskScore };
    },
  },
};

function tryParseJson(value?: string): Record<string, unknown> {
  if (!value?.trim()) return {};
  try { const p = JSON.parse(value); return typeof p === "object" && p && !Array.isArray(p) ? p : {}; } catch { return {}; }
}

interface ZapierZ { request(opts: Record<string, unknown>): Promise<{ json: Record<string, unknown> }>; }
interface ZapierBundle { authData: Record<string, string>; inputData: Record<string, string>; }
