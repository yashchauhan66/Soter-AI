/**
 * SoterAI Guard — Flowise Custom Nodes
 *
 * Checks user messages for prompt injection, jailbreaks, PII leakage,
 * and other threats before they reach the LLM.
 *
 * Installation:
 * 1. npm install flowise-nodes-soterai, or copy dist/ to your Flowise custom nodes directory
 * 2. Set your SoterAI API key in the node configuration
 * 3. Connect before your LLM node in the flow
 */

interface SoterInputGuardParams {
  apiKey: string;
  baseUrl?: string;
  projectId?: string;
  policyMode?: "MONITOR" | "BALANCED" | "STRICT";
  onThreat?: "BLOCK" | "REDACT" | "WARN" | "CONTINUE";
}

interface SoterGuardResult {
  allowed: boolean;
  riskScore: number;
  categories: string[];
  safeText: string;
  reason: string;
  blocked: boolean;
  rawResponse: unknown;
}

class SoterInputGuard_Tools {
  label = "SoterAI Input Guard";
  name = "soterInputGuard";
  version = 1.0;
  type = "SoterInputGuard";
  icon = "soterai.png";
  category = "Security";
  description = "Check user input for prompt injection, jailbreaks, and threats before LLM processing";
  baseClasses = [this.type, "Tool"];

  inputs = [
    {
      label: "SoterAI API Key",
      name: "apiKey",
      type: "password",
      placeholder: "sk_...",
    },
    {
      label: "Base URL",
      name: "baseUrl",
      type: "string",
      default: "https://api.cybersecurityguard.com",
      optional: true,
    },
    {
      label: "Project ID",
      name: "projectId",
      type: "string",
      optional: true,
    },
    {
      label: "Policy Mode",
      name: "policyMode",
      type: "options",
      options: [
        { label: "Monitor", name: "MONITOR" },
        { label: "Balanced", name: "BALANCED" },
        { label: "Strict", name: "STRICT" },
      ],
      default: "BALANCED",
      optional: true,
    },
    {
      label: "On Threat",
      name: "onThreat",
      type: "options",
      options: [
        { label: "Block", name: "BLOCK" },
        { label: "Redact", name: "REDACT" },
        { label: "Warn", name: "WARN" },
        { label: "Continue", name: "CONTINUE" },
      ],
      default: "BLOCK",
      optional: true,
    },
  ];

  async init(nodeData: Record<string, unknown>): Promise<SoterInputGuardParams> {
    const inputs = nodeData.inputs as Record<string, unknown>;
    return {
      apiKey: inputs.apiKey as string,
      baseUrl: (inputs.baseUrl as string) || "https://api.cybersecurityguard.com",
      projectId: inputs.projectId as string | undefined,
      policyMode: (inputs.policyMode as SoterInputGuardParams["policyMode"]) || "BALANCED",
      onThreat: (inputs.onThreat as SoterInputGuardParams["onThreat"]) || "BLOCK",
    };
  }

  async run(params: SoterInputGuardParams, input: string): Promise<string> {
    const result = await callSoterGuard(
      params.apiKey,
      params.baseUrl!,
      "/api/guard/input",
      { message: input },
      params.projectId,
      params.policyMode,
    );

    const guardResult = applyThreatPolicy(result, params.onThreat ?? "BLOCK", input);

    if (guardResult.blocked) {
      return JSON.stringify({
        blocked: true,
        reason: guardResult.reason,
        riskScore: guardResult.riskScore,
      });
    }

    return guardResult.safeText;
  }
}

class SoterOutputGuard_Tools {
  label = "SoterAI Output Guard";
  name = "soterOutputGuard";
  version = 1.0;
  type = "SoterOutputGuard";
  icon = "soterai.png";
  category = "Security";
  description = "Check AI output for unsafe content, system prompt leakage, and PII before sending to the user";
  baseClasses = [this.type, "Tool"];

  inputs = [
    {
      label: "SoterAI API Key",
      name: "apiKey",
      type: "password",
      placeholder: "sk_...",
    },
    {
      label: "Base URL",
      name: "baseUrl",
      type: "string",
      default: "https://api.cybersecurityguard.com",
      optional: true,
    },
    {
      label: "Project ID",
      name: "projectId",
      type: "string",
      optional: true,
    },
    {
      label: "Policy Mode",
      name: "policyMode",
      type: "options",
      options: [
        { label: "Monitor", name: "MONITOR" },
        { label: "Balanced", name: "BALANCED" },
        { label: "Strict", name: "STRICT" },
      ],
      default: "BALANCED",
      optional: true,
    },
    {
      label: "On Threat",
      name: "onThreat",
      type: "options",
      options: [
        { label: "Block", name: "BLOCK" },
        { label: "Redact", name: "REDACT" },
        { label: "Warn", name: "WARN" },
        { label: "Continue", name: "CONTINUE" },
      ],
      default: "BLOCK",
      optional: true,
    },
  ];

  async init(nodeData: Record<string, unknown>): Promise<SoterInputGuardParams> {
    const inputs = nodeData.inputs as Record<string, unknown>;
    return {
      apiKey: inputs.apiKey as string,
      baseUrl: (inputs.baseUrl as string) || "https://api.cybersecurityguard.com",
      projectId: inputs.projectId as string | undefined,
      policyMode: (inputs.policyMode as SoterInputGuardParams["policyMode"]) || "BALANCED",
      onThreat: (inputs.onThreat as SoterInputGuardParams["onThreat"]) || "BLOCK",
    };
  }

  async run(params: SoterInputGuardParams, input: string): Promise<string> {
    const result = await callSoterGuard(
      params.apiKey,
      params.baseUrl!,
      "/api/guard/output",
      { aiResponse: input },
      params.projectId,
      params.policyMode,
    );

    const guardResult = applyThreatPolicy(result, params.onThreat ?? "BLOCK", input);

    if (guardResult.blocked) {
      return "The AI response was blocked for security reasons.";
    }

    return guardResult.safeText;
  }
}

class SoterPiiRedactor_Tools {
  label = "SoterAI PII Redactor";
  name = "soterPiiRedactor";
  version = 1.0;
  type = "SoterPiiRedactor";
  icon = "soterai.png";
  category = "Security";
  description = "Redact PII, secrets, and sensitive data from text";
  baseClasses = [this.type, "Tool"];

  inputs = [
    {
      label: "SoterAI API Key",
      name: "apiKey",
      type: "password",
      placeholder: "sk_...",
    },
    {
      label: "Base URL",
      name: "baseUrl",
      type: "string",
      default: "https://api.cybersecurityguard.com",
      optional: true,
    },
    {
      label: "Project ID",
      name: "projectId",
      type: "string",
      optional: true,
    },
    {
      label: "Redaction Mode",
      name: "redactionMode",
      type: "options",
      options: [
        { label: "Partial", name: "PARTIAL" },
        { label: "Full", name: "FULL" },
        { label: "Hash", name: "HASH" },
      ],
      default: "PARTIAL",
      optional: true,
    },
  ];

  async init(nodeData: Record<string, unknown>): Promise<{ apiKey: string; baseUrl: string; projectId?: string; redactionMode: string }> {
    const inputs = nodeData.inputs as Record<string, unknown>;
    return {
      apiKey: inputs.apiKey as string,
      baseUrl: (inputs.baseUrl as string) || "https://api.cybersecurityguard.com",
      projectId: inputs.projectId as string | undefined,
      redactionMode: (inputs.redactionMode as string) || "PARTIAL",
    };
  }

  async run(params: { apiKey: string; baseUrl: string; projectId?: string; redactionMode: string }, input: string): Promise<string> {
    const meta: Record<string, unknown> = { _redactionMode: params.redactionMode };
    if (params.projectId) meta.projectId = params.projectId;

    const result = await callSoterGuard(
      params.apiKey,
      params.baseUrl,
      "/api/guard/input",
      { message: input },
      params.projectId,
      undefined,
    );

    return (result.safeText as string) ?? (result.redactedText as string) ?? input;
  }
}

class SoterRagScanner_Tools {
  label = "SoterAI RAG Scanner";
  name = "soterRagScanner";
  version = 1.0;
  type = "SoterRagScanner";
  icon = "soterai.png";
  category = "Security";
  description = "Scan documents for threats before adding to RAG/vector databases";
  baseClasses = [this.type, "Tool"];

  inputs = [
    {
      label: "SoterAI API Key",
      name: "apiKey",
      type: "password",
      placeholder: "sk_...",
    },
    {
      label: "Base URL",
      name: "baseUrl",
      type: "string",
      default: "https://api.cybersecurityguard.com",
      optional: true,
    },
    {
      label: "Project ID",
      name: "projectId",
      type: "string",
      optional: true,
    },
    {
      label: "Source Name",
      name: "sourceName",
      type: "string",
      optional: true,
    },
    {
      label: "Policy Mode",
      name: "policyMode",
      type: "options",
      options: [
        { label: "Monitor", name: "MONITOR" },
        { label: "Balanced", name: "BALANCED" },
        { label: "Strict", name: "STRICT" },
      ],
      default: "BALANCED",
      optional: true,
    },
  ];

  async init(nodeData: Record<string, unknown>): Promise<{
    apiKey: string;
    baseUrl: string;
    projectId?: string;
    sourceName?: string;
    policyMode?: string;
  }> {
    const inputs = nodeData.inputs as Record<string, unknown>;
    return {
      apiKey: inputs.apiKey as string,
      baseUrl: (inputs.baseUrl as string) || "https://api.cybersecurityguard.com",
      projectId: inputs.projectId as string | undefined,
      sourceName: inputs.sourceName as string | undefined,
      policyMode: (inputs.policyMode as string) || "BALANCED",
    };
  }

  async run(
    params: { apiKey: string; baseUrl: string; projectId?: string; sourceName?: string; policyMode?: string },
    input: string,
  ): Promise<string> {
    const metadata: Record<string, unknown> = { _ragScan: true };
    if (params.sourceName) metadata._sourceName = params.sourceName;
    if (params.projectId) metadata.projectId = params.projectId;
    if (params.policyMode) metadata.policyMode = params.policyMode;

    const response = await fetch(`${params.baseUrl.replace(/\/$/, "")}/api/guard/input`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": params.apiKey,
        "User-Agent": "soterai-flowise/1.0",
      },
      body: JSON.stringify({ message: input, metadata }),
    });

    const data = (await response.json()) as Record<string, unknown>;
    if (!response.ok) {
      throw new Error(typeof data.message === "string" ? data.message : `SoterAI API error ${response.status}`);
    }

    const findings = (data.findings as Array<Record<string, unknown>>) ?? [];
    const issues = findings.map((f) => ({
      type: f.type,
      severity: f.severity,
      message: f.message ?? f.label ?? "",
    }));

    return JSON.stringify({
      allowed: data.allowed ?? true,
      riskScore: data.riskScore ?? 0,
      issues,
      safeText: (data.safeText as string) ?? (data.redactedText as string) ?? input,
    });
  }
}

// -- Shared HTTP helper --

async function callSoterGuard(
  apiKey: string,
  baseUrl: string,
  path: string,
  body: Record<string, unknown>,
  projectId?: string,
  policyMode?: string,
): Promise<Record<string, unknown>> {
  const metadata: Record<string, unknown> = {};
  if (projectId) metadata.projectId = projectId;
  if (policyMode) metadata.policyMode = policyMode;

  const response = await fetch(`${baseUrl.replace(/\/$/, "")}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "User-Agent": "soterai-flowise/1.0",
    },
    body: JSON.stringify({ ...body, metadata }),
  });

  const data = await response.json() as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(typeof data.message === "string" ? data.message : `SoterAI API error ${response.status}`);
  }
  return data;
}

function applyThreatPolicy(
  raw: Record<string, unknown>,
  onThreat: string,
  originalText: string,
): SoterGuardResult {
  const allowed = raw.allowed as boolean;
  const riskScore = (raw.riskScore as number) ?? 0;
  const categories = (raw.riskTypes as string[]) ?? [];
  const reason = (raw.reason as string) ?? "";
  const safeText = (raw.safeText as string) ?? (raw.redactedText as string) ?? originalText;

  if (allowed) {
    return { allowed: true, riskScore, categories, safeText, reason, blocked: false, rawResponse: raw };
  }

  switch (onThreat) {
    case "BLOCK":
      return { allowed: false, riskScore, categories, safeText: "", reason, blocked: true, rawResponse: raw };
    case "REDACT":
      return { allowed: false, riskScore, categories, safeText, reason, blocked: false, rawResponse: raw };
    case "WARN":
      return { allowed: false, riskScore, categories, safeText: originalText, reason, blocked: false, rawResponse: raw };
    case "CONTINUE":
      return { allowed: true, riskScore, categories, safeText: originalText, reason, blocked: false, rawResponse: raw };
    default:
      return { allowed: false, riskScore, categories, safeText: "", reason, blocked: true, rawResponse: raw };
  }
}

module.exports = {
  nodeClass: SoterInputGuard_Tools,
  SoterOutputGuard: SoterOutputGuard_Tools,
  SoterPiiRedactor: SoterPiiRedactor_Tools,
  SoterRagScanner: SoterRagScanner_Tools,
};

export { SoterInputGuard_Tools, SoterOutputGuard_Tools, SoterPiiRedactor_Tools, SoterRagScanner_Tools };
