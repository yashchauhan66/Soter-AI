import type {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  IDataObject,
} from "n8n-workflow";
import { NodeOperationError } from "n8n-workflow";

export class SoterGuard implements INodeType {
  description: INodeTypeDescription = {
    displayName: "SoterAI",
    name: "soterGuard",
    icon: "file:soterai.png",
    group: ["transform"],
    version: 1,
    subtitle: '={{$parameter["action"]}}',
    description: "Protect AI workflows with SoterAI — input/output guard, PII redaction, RAG document scanning",
    defaults: {
      name: "SoterAI",
    },
    inputs: ["main"],
    outputs: ["main"],
    credentials: [
      {
        name: "soterApi",
        required: true,
      },
    ],
    properties: [
      {
        displayName: "Action",
        name: "action",
        type: "options",
        noDataExpression: true,
        options: [
          {
            name: "SoterAI Input Guard",
            value: "inputGuard",
            description: "Check user message before it reaches the LLM",
            action: "Check user input for threats",
          },
          {
            name: "SoterAI Output Guard",
            value: "outputGuard",
            description: "Check AI response before it is sent to the user",
            action: "Check AI output for threats",
          },
          {
            name: "SoterAI PII Redactor",
            value: "piiRedactor",
            description: "Redact sensitive data (PII, secrets) from any text",
            action: "Redact PII from text",
          },
          {
            name: "SoterAI RAG Scanner",
            value: "ragScanner",
            description: "Scan documents/chunks before adding to RAG/vector DB",
            action: "Scan RAG document for threats",
          },
          {
            name: "SoterAI Incident Logger",
            value: "incidentLogger",
            description: "Log a security incident to the SoterAI ops dashboard. Requires admin access; returns a graceful no-op if the caller lacks permissions.",
            action: "Log security incident",
          },
        ],
        default: "inputGuard",
      },

      // ── Input Guard fields ──
      {
        displayName: "Input Text",
        name: "inputText",
        type: "string",
        typeOptions: { rows: 4 },
        default: "",
        required: true,
        displayOptions: { show: { action: ["inputGuard"] } },
        description: "The user message to check for prompt injection, jailbreaks, and other threats",
      },

      // ── Output Guard fields ──
      {
        displayName: "AI Output Text",
        name: "outputText",
        type: "string",
        typeOptions: { rows: 4 },
        default: "",
        required: true,
        displayOptions: { show: { action: ["outputGuard"] } },
        description: "The AI-generated response to check before sending to the user",
      },

      // ── PII Redactor fields ──
      {
        displayName: "Text",
        name: "piiText",
        type: "string",
        typeOptions: { rows: 4 },
        default: "",
        required: true,
        displayOptions: { show: { action: ["piiRedactor"] } },
        description: "The text to scan and redact PII from",
      },
      {
        displayName: "Redaction Mode",
        name: "redactionMode",
        type: "options",
        options: [
          { name: "Partial", value: "PARTIAL", description: "Partially mask sensitive data" },
          { name: "Full", value: "FULL", description: "Fully replace sensitive data with tokens" },
          { name: "Hash", value: "HASH", description: "Replace with deterministic hashes" },
        ],
        default: "PARTIAL",
        displayOptions: { show: { action: ["piiRedactor"] } },
        description: "How to redact detected PII",
      },

      // ── RAG Scanner fields ──
      {
        displayName: "Document Text",
        name: "ragText",
        type: "string",
        typeOptions: { rows: 4 },
        default: "",
        required: true,
        displayOptions: { show: { action: ["ragScanner"] } },
        description: "Document or chunk text to scan before adding to a vector database",
      },
      {
        displayName: "Source Name",
        name: "sourceName",
        type: "string",
        default: "",
        displayOptions: { show: { action: ["ragScanner"] } },
        description: 'Optional label for the document source (e.g. "uploaded-pdf", "web-scrape")',
      },

      // ── Incident Logger fields ──
      {
        displayName: "Platform",
        name: "incidentPlatform",
        type: "string",
        default: "n8n",
        required: true,
        displayOptions: { show: { action: ["incidentLogger"] } },
        description: 'Platform where the incident originated (e.g. "n8n", "slack", "api")',
      },
      {
        displayName: "Workflow ID",
        name: "incidentWorkflowId",
        type: "string",
        default: "",
        required: true,
        displayOptions: { show: { action: ["incidentLogger"] } },
        description: "ID of the workflow or process where the incident was detected",
      },
      {
        displayName: "Risk Score",
        name: "incidentRiskScore",
        type: "number",
        typeOptions: { minValue: 0, maxValue: 1, numberStepSize: 0.01 },
        default: 0,
        required: true,
        displayOptions: { show: { action: ["incidentLogger"] } },
        description: "Risk score from 0.0 (safe) to 1.0 (critical)",
      },
      {
        displayName: "Reason",
        name: "incidentReason",
        type: "string",
        typeOptions: { rows: 2 },
        default: "",
        required: true,
        displayOptions: { show: { action: ["incidentLogger"] } },
        description: "Human-readable reason or description for the incident",
      },

      // ── Common fields ──
      {
        displayName: "Project ID",
        name: "projectId",
        type: "string",
        default: "",
        description: "SoterAI project ID (overrides the credential default)",
      },
      {
        displayName: "Policy Mode",
        name: "policyMode",
        type: "options",
        options: [
          { name: "Monitor", value: "MONITOR", description: "Log threats but allow all traffic" },
          { name: "Balanced", value: "BALANCED", description: "Block high-risk, allow medium with redaction" },
          { name: "Strict", value: "STRICT", description: "Block anything above low risk" },
        ],
        default: "BALANCED",
        displayOptions: { show: { action: ["inputGuard", "outputGuard"] } },
        description: "Server-side policy strictness",
      },
      {
        displayName: "On Threat",
        name: "onThreat",
        type: "options",
        options: [
          { name: "Block", value: "BLOCK", description: "Stop the workflow item" },
          { name: "Redact", value: "REDACT", description: "Continue with redacted safe text" },
          { name: "Warn", value: "WARN", description: "Continue but flag the threat in output" },
          { name: "Continue", value: "CONTINUE", description: "Ignore the threat and continue" },
        ],
        default: "BLOCK",
        displayOptions: { show: { action: ["inputGuard", "outputGuard"] } },
        description: "What to do locally when SoterAI flags a threat",
      },
      {
        displayName: "Metadata JSON",
        name: "metadata",
        type: "string",
        typeOptions: { rows: 2 },
        default: "",
        description: "Optional JSON metadata to attach to the request for audit logging",
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];

    const credentials = await this.getCredentials("soterApi");
    const apiKey = credentials.apiKey as string;
    const baseUrl = (credentials.baseUrl as string) || "https://api.soterai.dev";
    const credentialProjectId = (credentials.projectId as string) || undefined;

    for (let i = 0; i < items.length; i++) {
      try {
        const action = this.getNodeParameter("action", i) as string;
        const projectId = (this.getNodeParameter("projectId", i, "") as string) || credentialProjectId;
        const metadataRaw = this.getNodeParameter("metadata", i, "") as string;
        const metadata = metadataRaw ? parseMetadata(metadataRaw) : undefined;

        let result: IDataObject;

        switch (action) {
          case "inputGuard": {
            const text = this.getNodeParameter("inputText", i) as string;
            const policyMode = this.getNodeParameter("policyMode", i) as string;
            const onThreat = this.getNodeParameter("onThreat", i) as string;
            result = await executeInputGuard(apiKey, baseUrl, {
              text, projectId, policyMode, onThreat, metadata,
            });
            break;
          }
          case "outputGuard": {
            const text = this.getNodeParameter("outputText", i) as string;
            const policyMode = this.getNodeParameter("policyMode", i) as string;
            const onThreat = this.getNodeParameter("onThreat", i) as string;
            result = await executeOutputGuard(apiKey, baseUrl, {
              text, projectId, policyMode, onThreat, metadata,
            });
            break;
          }
          case "piiRedactor": {
            const text = this.getNodeParameter("piiText", i) as string;
            const redactionMode = this.getNodeParameter("redactionMode", i) as string;
            result = await executePiiRedactor(apiKey, baseUrl, {
              text, projectId, redactionMode, metadata,
            });
            break;
          }
          case "ragScanner": {
            const text = this.getNodeParameter("ragText", i) as string;
            const sourceName = this.getNodeParameter("sourceName", i, "") as string;
            result = await executeRagScanner(apiKey, baseUrl, {
              text, projectId, sourceName, metadata,
            });
            break;
          }
          case "incidentLogger": {
            const platform = this.getNodeParameter("incidentPlatform", i) as string;
            const workflowId = this.getNodeParameter("incidentWorkflowId", i) as string;
            const riskScore = this.getNodeParameter("incidentRiskScore", i) as number;
            const reason = this.getNodeParameter("incidentReason", i) as string;
            result = await executeIncidentLogger(apiKey, baseUrl, {
              platform, workflowId, riskScore, reason, projectId, metadata,
            });
            break;
          }
          default:
            throw new NodeOperationError(this.getNode(), `Unknown action: ${action}`, { itemIndex: i });
        }

        returnData.push({ json: result });
      } catch (error) {
        if (this.continueOnFail()) {
          returnData.push({
            json: {
              error: true,
              message: error instanceof Error ? error.message : "SoterAI request failed.",
            },
          });
          continue;
        }
        throw error;
      }
    }

    return [returnData];
  }
}

// ── Helpers ────────────────────────────────────────────────────────────

interface GuardParams {
  text: string;
  projectId?: string;
  policyMode?: string;
  onThreat?: string;
  metadata?: Record<string, unknown>;
}

interface PiiParams {
  text: string;
  projectId?: string;
  redactionMode?: string;
  metadata?: Record<string, unknown>;
}

interface RagParams {
  text: string;
  projectId?: string;
  sourceName?: string;
  metadata?: Record<string, unknown>;
}

interface IncidentParams {
  platform: string;
  workflowId: string;
  riskScore: number;
  reason: string;
  projectId?: string;
  metadata?: Record<string, unknown>;
}

async function soterPost(
  apiKey: string,
  baseUrl: string,
  path: string,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const url = `${baseUrl.replace(/\/$/, "")}${path}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "User-Agent": "n8n-nodes-soterai/0.1.0",
    },
    body: JSON.stringify(body),
  });

  const data = await response.json() as Record<string, unknown>;

  if (!response.ok) {
    const msg = typeof data.message === "string" ? data.message : `SoterAI API error ${response.status}`;
    throw new Error(msg);
  }

  return data;
}

async function executeInputGuard(
  apiKey: string,
  baseUrl: string,
  params: GuardParams,
): Promise<IDataObject> {
  const meta: Record<string, unknown> = { ...params.metadata };
  if (params.projectId) meta.projectId = params.projectId;
  if (params.policyMode) meta.policyMode = params.policyMode;

  const raw = await soterPost(apiKey, baseUrl, "/api/guard/input", {
    message: params.text,
    metadata: meta,
  });

  const allowed = raw.allowed as boolean;
  const result: IDataObject = {
    allowed,
    riskScore: (raw.riskScore as number) ?? 0,
    categories: (raw.riskTypes as string[]) ?? [],
    safeText: (raw.safeText as string) ?? (raw.redactedText as string) ?? params.text,
    reason: (raw.reason as string) ?? "",
    incidentId: (raw.incidentId as string) ?? null,
    rawResponse: raw as IDataObject,
  };

  if (!allowed && params.onThreat) {
    switch (params.onThreat) {
      case "BLOCK":
        result.blocked = true;
        result.outputText = "";
        break;
      case "REDACT":
        result.blocked = false;
        result.outputText = (raw.safeText as string) ?? (raw.redactedText as string) ?? "[REDACTED]";
        break;
      case "WARN":
        result.blocked = false;
        result.outputText = params.text;
        result.warning = (raw.reason as string) ?? "";
        break;
      case "CONTINUE":
        result.blocked = false;
        result.outputText = params.text;
        break;
    }
  } else {
    result.blocked = false;
    result.outputText = (raw.safeText as string) ?? (raw.redactedText as string) ?? params.text;
  }

  return result;
}

async function executeOutputGuard(
  apiKey: string,
  baseUrl: string,
  params: GuardParams,
): Promise<IDataObject> {
  const meta: Record<string, unknown> = { ...params.metadata };
  if (params.projectId) meta.projectId = params.projectId;
  if (params.policyMode) meta.policyMode = params.policyMode;

  const raw = await soterPost(apiKey, baseUrl, "/api/guard/output", {
    aiResponse: params.text,
    metadata: meta,
  });

  const allowed = raw.allowed as boolean;
  const result: IDataObject = {
    allowed,
    riskScore: (raw.riskScore as number) ?? 0,
    categories: (raw.riskTypes as string[]) ?? [],
    safeText: (raw.safeText as string) ?? (raw.redactedText as string) ?? params.text,
    reason: (raw.reason as string) ?? "",
    incidentId: (raw.incidentId as string) ?? null,
    rawResponse: raw as IDataObject,
  };

  if (!allowed && params.onThreat) {
    switch (params.onThreat) {
      case "BLOCK":
        result.blocked = true;
        result.outputText = "";
        break;
      case "REDACT":
        result.blocked = false;
        result.outputText = (raw.safeText as string) ?? (raw.redactedText as string) ?? "[REDACTED]";
        break;
      case "WARN":
        result.blocked = false;
        result.outputText = params.text;
        result.warning = (raw.reason as string) ?? "";
        break;
      case "CONTINUE":
        result.blocked = false;
        result.outputText = params.text;
        break;
    }
  } else {
    result.blocked = false;
    result.outputText = (raw.safeText as string) ?? (raw.redactedText as string) ?? params.text;
  }

  return result;
}

async function executePiiRedactor(
  apiKey: string,
  baseUrl: string,
  params: PiiParams,
): Promise<IDataObject> {
  const meta: Record<string, unknown> = { ...params.metadata };
  if (params.projectId) meta.projectId = params.projectId;
  if (params.redactionMode) meta._redactionMode = params.redactionMode;

  const raw = await soterPost(apiKey, baseUrl, "/api/guard/input", {
    message: params.text,
    metadata: meta,
  });

  const findings = (raw.findings as Array<Record<string, unknown>>) ?? [];
  const piiEntities = findings
    .filter((f) => f.type === "PII_DETECTED" || f.type === "INDIA_PII_DETECTED" || f.type === "SECRET_DETECTED")
    .map((f) => ({
      type: f.type,
      label: f.label,
      severity: f.severity,
    }));

  return {
    safeText: (raw.safeText as string) ?? (raw.redactedText as string) ?? params.text,
    detectedEntities: piiEntities as unknown as IDataObject[],
    riskScore: (raw.riskScore as number) ?? 0,
    rawResponse: raw as IDataObject,
  };
}

async function executeRagScanner(
  apiKey: string,
  baseUrl: string,
  params: RagParams,
): Promise<IDataObject> {
  const meta: Record<string, unknown> = { ...params.metadata, _ragScan: true };
  if (params.projectId) meta.projectId = params.projectId;
  if (params.sourceName) meta._sourceName = params.sourceName;

  const raw = await soterPost(apiKey, baseUrl, "/api/guard/input", {
    message: params.text,
    metadata: meta,
  });

  const findings = (raw.findings as Array<Record<string, unknown>>) ?? [];
  const issues = findings.map((f) => ({
    type: f.type,
    severity: f.severity,
    message: f.message ?? f.label,
  }));

  return {
    allowed: raw.allowed as boolean,
    riskScore: (raw.riskScore as number) ?? 0,
    issues: issues as unknown as IDataObject[],
    safeText: (raw.safeText as string) ?? (raw.redactedText as string) ?? params.text,
    incidentId: (raw.incidentId as string) ?? null,
    rawResponse: raw as IDataObject,
  };
}

async function executeIncidentLogger(
  apiKey: string,
  baseUrl: string,
  params: IncidentParams,
): Promise<IDataObject> {
  const body: Record<string, unknown> = {
    platform: params.platform,
    workflowId: params.workflowId,
    riskScore: params.riskScore,
    reason: params.reason,
  };
  if (params.projectId) body.projectId = params.projectId;
  if (params.metadata) body.metadata = params.metadata;

  try {
    const raw = await soterPost(apiKey, baseUrl, "/api/ops/incidents", body);
    return {
      logged: true,
      incidentId: (raw.incidentId as string) ?? (raw.id as string) ?? null,
      rawResponse: raw as IDataObject,
    };
  } catch (error) {
    // Graceful no-op: if the caller lacks admin permissions, return success with logged=false
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message.includes("403") || message.includes("401") || message.includes("Forbidden") || message.includes("Unauthorized")) {
      return {
        logged: false,
        reason: "Insufficient permissions to log incidents. Admin access is required.",
        rawResponse: { error: message } as IDataObject,
      };
    }
    throw error;
  }
}

function parseMetadata(raw: string): Record<string, unknown> | undefined {
  if (!raw.trim()) return undefined;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return parsed;
    }
  } catch {
    // ignore invalid JSON — don't break the workflow for optional metadata
  }
  return undefined;
}
