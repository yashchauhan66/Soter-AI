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
    description: "Protect AI workflows with SoterAI - input/output guard, PII redaction, RAG document scanning",
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
        ],
        default: "inputGuard",
      },

      // Input Guard fields
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

      // Output Guard fields
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

      // PII Redactor fields
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
      // RAG Scanner fields
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
        displayName: "Document ID",
        name: "documentId",
        type: "string",
        default: "",
        required: true,
        displayOptions: { show: { action: ["ragScanner"] } },
        description: "Stable identifier used to track the document scan",
      },
      {
        displayName: "Document Source",
        name: "documentSource",
        type: "options",
        options: [
          { name: "API", value: "api" },
          { name: "Email", value: "email" },
          { name: "File Upload", value: "upload" },
          { name: "URL", value: "url" },
          { name: "Unknown", value: "unknown" },
        ],
        default: "api",
        displayOptions: { show: { action: ["ragScanner"] } },
        description: "Where the document entered the RAG pipeline",
      },

      // Common fields
      {
        displayName: "Project ID",
        name: "projectId",
        type: "string",
        default: "",
        description: "SoterAI project ID (overrides the credential default)",
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
    const baseUrl = (credentials.baseUrl as string) || "https://soterai.publicvm.com";
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
            const onThreat = this.getNodeParameter("onThreat", i) as string;
            result = await executeInputGuard(apiKey, baseUrl, {
              text, projectId, onThreat, metadata,
            });
            break;
          }
          case "outputGuard": {
            const text = this.getNodeParameter("outputText", i) as string;
            const onThreat = this.getNodeParameter("onThreat", i) as string;
            result = await executeOutputGuard(apiKey, baseUrl, {
              text, projectId, onThreat, metadata,
            });
            break;
          }
          case "piiRedactor": {
            const text = this.getNodeParameter("piiText", i) as string;
            result = await executePiiRedactor(apiKey, baseUrl, {
              text, projectId, metadata,
            });
            break;
          }
          case "ragScanner": {
            const text = this.getNodeParameter("ragText", i) as string;
            const documentId = this.getNodeParameter("documentId", i) as string;
            const source = this.getNodeParameter("documentSource", i) as string;
            result = await executeRagScanner(apiKey, baseUrl, {
              text, projectId, documentId, source, metadata,
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

// Helpers

interface GuardParams {
  text: string;
  projectId?: string;
  onThreat?: string;
  metadata?: Record<string, unknown>;
}

interface PiiParams {
  text: string;
  projectId?: string;
  metadata?: Record<string, unknown>;
}

interface RagParams {
  text: string;
  projectId?: string;
  documentId: string;
  source: string;
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
      "User-Agent": "n8n-nodes-soterai/0.2.0",
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
  const raw = await soterPost(apiKey, baseUrl, "/api/rag/document/trust-score", {
    projectId: params.projectId,
    documentId: params.documentId,
    content: params.text,
    source: params.source,
    metadata: params.metadata,
  });

  return {
    trustScore: (raw.trustScore as number) ?? 0,
    trustLevel: (raw.trustLevel as string) ?? "NEEDS_REVIEW",
    findings: (raw.findings as IDataObject[]) ?? [],
    recommendedAction: (raw.recommendedAction as string) ?? "REVIEW",
    rawResponse: raw as IDataObject,
  };
}

function parseMetadata(raw: string): Record<string, unknown> | undefined {
  if (!raw.trim()) return undefined;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return parsed;
    }
  } catch {
    // Ignore invalid JSON so optional metadata does not break the workflow.
  }
  return undefined;
}
