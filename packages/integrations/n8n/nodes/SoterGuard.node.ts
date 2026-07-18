import type {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  IDataObject,
  JsonObject,
} from "n8n-workflow";
import { NodeApiError, NodeOperationError } from "n8n-workflow";

const PACKAGE_VERSION = "0.3.0";
const USER_AGENT = `n8n-nodes-soterai/${PACKAGE_VERSION}`;
const MAX_SANITIZE_DEPTH = 8;
const MAX_METADATA_STRING_LENGTH = 500;

export class SoterGuard implements INodeType {
  description: INodeTypeDescription = {
    displayName: "SoterAI",
    name: "soterGuard",
    icon: "file:soterai.png",
    group: ["transform"],
    version: 1,
    subtitle: '={{$parameter["action"]}}',
    description: "Detect prompt injection, jailbreaks, secrets, PII, and unsafe AI instructions in n8n workflows",
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
            name: "Universal AI Firewall (Best Protection)",
            value: "universalGuard",
            description: "One drop-in guard for prompts, RAG context, tools, memory, output, PII, and data leakage",
            action: "Protect an AI workflow end to end",
          },
          {
            name: "Guard Input",
            value: "inputGuard",
            description: "Check user message before it reaches the LLM",
            action: "Check user input for threats",
          },
          {
            name: "Guard Output",
            value: "outputGuard",
            description: "Check AI response before it is sent to the user",
            action: "Check AI output for threats",
          },
          {
            name: "Redact Secrets or PII",
            value: "piiRedactor",
            description: "Redact sensitive data (PII, secrets) from any text",
            action: "Redact PII from text",
          },
          {
            name: "Get RAG Risk Summary",
            value: "ragScanner",
            description: "Scan documents/chunks before adding to RAG/vector DB",
            action: "Scan RAG document for threats",
          },
          {
            name: "Audit n8n Workflow Security",
            value: "workflowAudit",
            description: "Score an exported n8n workflow for AI, tool, webhook, code, RAG, and data-leak risks",
            action: "Audit an n8n workflow for AI security risks",
          },
          {
            name: "Analyze Text",
            value: "analyzeText",
            description: "Analyze text and return a risk summary without local blocking",
            action: "Analyze text for AI security risks",
          },
        ],
        default: "universalGuard",
      },

      // Input Guard fields
      {
        displayName: "Input Text",
        name: "inputText",
        type: "string",
        typeOptions: { rows: 4 },
        default: "",
        required: true,
        displayOptions: { show: { action: ["analyzeText", "inputGuard", "universalGuard"] } },
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
      {
        displayName: "AI Output Text",
        name: "universalOutputText",
        type: "string",
        typeOptions: { rows: 4 },
        default: "",
        displayOptions: { show: { action: ["universalGuard"] } },
        description: "Optional AI response to check before sending, saving, or calling another tool",
      },
      {
        displayName: "Security Context JSON",
        name: "securityContextJson",
        type: "string",
        typeOptions: { rows: 5 },
        default: "",
        displayOptions: { show: { action: ["universalGuard"] } },
        description: "Optional advanced context for RAG, tool calls, memory, output destination, or protected sources",
      },
      {
        displayName: "Protection Profile",
        name: "protectionProfile",
        type: "options",
        options: [
          {
            name: "Maximum Protection",
            value: "MAXIMUM",
            description: "Strict fail-closed protection for production AI agents and public chatbots",
          },
          {
            name: "Strict",
            value: "STRICT",
            description: "Block critical threats and require review for high-risk behavior",
          },
          {
            name: "Balanced",
            value: "BALANCED",
            description: "Lower-friction protection for internal workflows and testing",
          },
        ],
        default: "MAXIMUM",
        displayOptions: { show: { action: ["universalGuard"] } },
        description: "How aggressively the Universal AI Firewall should enforce decisions",
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
      {
        displayName: "Workflow JSON",
        name: "workflowJson",
        type: "string",
        typeOptions: { rows: 10 },
        default: "={{JSON.stringify($json)}}",
        required: true,
        displayOptions: { show: { action: ["workflowAudit"] } },
        description: "Exported n8n workflow JSON to audit before production use",
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
        displayOptions: { show: { action: ["inputGuard", "outputGuard", "universalGuard"] } },
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
    const baseUrl = validateBaseUrl((credentials.baseUrl as string) || "https://soterai.in");
    const credentialProjectId = (credentials.projectId as string) || undefined;

    for (let i = 0; i < items.length; i++) {
      try {
        const action = this.getNodeParameter("action", i) as string;
        const projectId = (this.getNodeParameter("projectId", i, "") as string) || credentialProjectId;
        const metadataRaw = this.getNodeParameter("metadata", i, "") as string;
        const metadata = metadataRaw ? parseMetadata(metadataRaw) : undefined;

        let result: IDataObject;

        switch (action) {
          case "analyzeText": {
            const text = this.getNodeParameter("inputText", i) as string;
            result = await executeInputGuard(apiKey, baseUrl, {
              text, projectId, onThreat: "WARN", metadata,
            });
            result.operation = "analyzeText";
            result.outputText = result.safeText;
            break;
          }
          case "inputGuard": {
            const text = this.getNodeParameter("inputText", i) as string;
            const onThreat = this.getNodeParameter("onThreat", i) as string;
            result = await executeInputGuard(apiKey, baseUrl, {
              text, projectId, onThreat, metadata,
            });
            result.operation = "inputGuard";
            break;
          }
          case "universalGuard": {
            const text = this.getNodeParameter("inputText", i) as string;
            const onThreat = this.getNodeParameter("onThreat", i) as string;
            const profile = this.getNodeParameter("protectionProfile", i) as ProtectionProfile;
            const aiOutputText = this.getNodeParameter("universalOutputText", i, "") as string;
            const securityContext = parseSecurityContext(this.getNodeParameter("securityContextJson", i, "") as string);
            result = await executeUniversalGuard(apiKey, baseUrl, {
              text,
              projectId,
              onThreat,
              metadata,
              profile,
              aiOutputText,
              ragText: securityContext.rag?.text,
              ragDocumentId: securityContext.rag?.documentId,
              ragSource: securityContext.rag?.source,
              tool: securityContext.tool,
              memory: securityContext.memory,
              outputDestinationType: securityContext.output?.destinationType,
              outputDestinationName: securityContext.output?.destinationName,
              protectedSources: securityContext.output?.protectedSources,
            });
            result.operation = "universalGuard";
            break;
          }
          case "outputGuard": {
            const text = this.getNodeParameter("outputText", i) as string;
            const onThreat = this.getNodeParameter("onThreat", i) as string;
            result = await executeOutputGuard(apiKey, baseUrl, {
              text, projectId, onThreat, metadata,
            });
            result.operation = "outputGuard";
            break;
          }
          case "piiRedactor": {
            const text = this.getNodeParameter("piiText", i) as string;
            result = await executePiiRedactor(apiKey, baseUrl, {
              text, projectId, metadata,
            });
            result.operation = "piiRedactor";
            break;
          }
          case "ragScanner": {
            const text = this.getNodeParameter("ragText", i) as string;
            const documentId = this.getNodeParameter("documentId", i) as string;
            const source = this.getNodeParameter("documentSource", i) as string;
            result = await executeRagScanner(apiKey, baseUrl, {
              text, projectId, documentId, source, metadata,
            });
            result.operation = "ragScanner";
            break;
          }
          case "workflowAudit": {
            const workflowJson = this.getNodeParameter("workflowJson", i) as string;
            result = executeWorkflowAudit(workflowJson);
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
              message: sanitizeErrorMessage(error instanceof Error ? error.message : "SoterAI request failed."),
            },
          });
          continue;
        }
        if (error instanceof NodeOperationError || error instanceof NodeApiError) {
          throw error;
        }
        throw new NodeApiError(this.getNode(), error as JsonObject, { itemIndex: i });
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

type ProtectionProfile = "BALANCED" | "STRICT" | "MAXIMUM";
type MemoryAction = "NONE" | "STORE" | "READ" | "UPDATE" | "DELETE";
type ToolDestination = "external" | "internal" | "local" | "unknown";
type UniversalDecision = "ALLOW" | "BLOCK" | "REDACT" | "ASK_APPROVAL" | "REVIEW";
type UniversalRisk = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

interface UniversalGuardParams extends GuardParams {
  profile: ProtectionProfile;
  aiOutputText?: string;
  ragText?: string;
  ragDocumentId?: string;
  ragSource?: string;
  tool?: {
    name: string;
    action: string;
    destination: ToolDestination;
    target?: string;
    content?: string;
    riskContext?: Record<string, unknown>;
  };
  memory?: {
    action: Exclude<MemoryAction, "NONE">;
    content?: string;
    memoryType?: string;
  };
  outputDestinationType?: string;
  outputDestinationName?: string;
  protectedSources?: unknown[];
}

interface SecurityContext {
  rag?: {
    text?: string;
    documentId?: string;
    source?: string;
  };
  tool?: {
    name: string;
    action: string;
    destination: ToolDestination;
    target?: string;
    content?: string;
    riskContext?: Record<string, unknown>;
  };
  memory?: {
    action: Exclude<MemoryAction, "NONE">;
    content?: string;
    memoryType?: string;
  };
  output?: {
    destinationType?: string;
    destinationName?: string;
    protectedSources?: unknown[];
  };
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
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  let response: Response;

  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "User-Agent": USER_AGENT,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("SoterAI API request timed out after 20 seconds.");
    }
    throw new Error("SoterAI API request failed. Check the Base URL and network access.");
  } finally {
    clearTimeout(timeout);
  }

  let data: Record<string, unknown> = {};
  try {
    data = await response.json() as Record<string, unknown>;
  } catch {
    data = {};
  }

  if (!response.ok) {
    throw new Error(formatApiError(response.status, data));
  }

  return data;
}

async function executeInputGuard(
  apiKey: string,
  baseUrl: string,
  params: GuardParams,
): Promise<IDataObject> {
  validateText(params.text, "Input Text");
  const meta: Record<string, unknown> = { ...params.metadata };
  if (params.projectId) meta.projectId = params.projectId;

  const raw = await soterPost(apiKey, baseUrl, "/api/guard/input", {
    message: params.text,
    metadata: meta,
  });

  const allowed = raw.allowed as boolean;
  const action = normalizeDecision(raw.action) ?? (allowed ? "ALLOW" : "BLOCK");
  const result: IDataObject = {
    allowed,
    action,
    rawAction: (raw.action as string) ?? null,
    riskScore: (raw.riskScore as number) ?? 0,
    categories: (raw.riskTypes as string[]) ?? [],
    safeText: (raw.safeText as string) ?? (raw.redactedText as string) ?? params.text,
    reason: (raw.reason as string) ?? "",
    userMessage: buildUserFacingMessage({
      allowed,
      direction: "input",
      action,
      categories: (raw.riskTypes as string[]) ?? [],
    }),
    developerMessage: buildDeveloperMessage({
      allowed,
      direction: "input",
      reason: (raw.reason as string) ?? "",
      riskScore: (raw.riskScore as number) ?? 0,
      categories: (raw.riskTypes as string[]) ?? [],
    }),
    incidentId: (raw.incidentId as string) ?? null,
    rawResponse: sanitizeOutputObject(raw),
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
  validateText(params.text, "AI Output Text");
  const meta: Record<string, unknown> = { ...params.metadata };
  if (params.projectId) meta.projectId = params.projectId;

  const raw = await soterPost(apiKey, baseUrl, "/api/guard/output", {
    aiResponse: params.text,
    metadata: meta,
  });

  const allowed = raw.allowed as boolean;
  const action = normalizeDecision(raw.action) ?? (allowed ? "ALLOW" : "BLOCK");
  const result: IDataObject = {
    allowed,
    action,
    rawAction: (raw.action as string) ?? null,
    riskScore: (raw.riskScore as number) ?? 0,
    categories: (raw.riskTypes as string[]) ?? [],
    safeText: (raw.safeText as string) ?? (raw.redactedText as string) ?? params.text,
    reason: (raw.reason as string) ?? "",
    userMessage: buildUserFacingMessage({
      allowed,
      direction: "output",
      action,
      categories: (raw.riskTypes as string[]) ?? [],
    }),
    developerMessage: buildDeveloperMessage({
      allowed,
      direction: "output",
      reason: (raw.reason as string) ?? "",
      riskScore: (raw.riskScore as number) ?? 0,
      categories: (raw.riskTypes as string[]) ?? [],
    }),
    incidentId: (raw.incidentId as string) ?? null,
    rawResponse: sanitizeOutputObject(raw),
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

async function executeUniversalGuard(
  apiKey: string,
  baseUrl: string,
  params: UniversalGuardParams,
): Promise<IDataObject> {
  validateText(params.text, "Input Text");
  const meta: Record<string, unknown> = {
    ...params.metadata,
    soteraiNodeMode: "universalGuard",
    protectionProfile: params.profile,
  };
  if (params.projectId) meta.projectId = params.projectId;

  const checks: IDataObject[] = [];
  const input = await executeInputGuard(apiKey, baseUrl, {
    text: params.text,
    projectId: params.projectId,
    onThreat: "WARN",
    metadata: meta,
  });
  checks.push({ layer: "input", ...input });

  if (params.ragText?.trim()) {
    const documentId = params.ragDocumentId?.trim() || `n8n-${Date.now()}`;
    const rag = await executeRagScanner(apiKey, baseUrl, {
      text: params.ragText,
      projectId: params.projectId,
      documentId,
      source: params.ragSource || "api",
      metadata: meta,
    });
    checks.push({ layer: "rag", ...rag });
  }

  if (params.tool) {
    if (!params.tool.name.trim()) throw new Error("Tool Name is required when Check Tool Call is enabled.");
    if (!params.tool.action.trim()) throw new Error("Tool Action is required when Check Tool Call is enabled.");
    const tool = await soterPost(apiKey, baseUrl, "/api/agent/tool/check", {
      sessionId: typeof meta.sessionId === "string" ? meta.sessionId : undefined,
      agentName: typeof meta.agentName === "string" ? meta.agentName : "n8n-agent",
      tool: params.tool.name,
      action: params.tool.action,
      target: params.tool.target || undefined,
      content: params.tool.content || params.text,
      destination: params.tool.destination,
      riskContext: params.tool.riskContext,
      metadata: meta,
    });
    checks.push({ layer: "tool", ...tool });
  }

  if (params.memory) {
    const memory = await soterPost(apiKey, baseUrl, "/api/agent/memory/check", {
      sessionId: typeof meta.sessionId === "string" ? meta.sessionId : undefined,
      memoryAction: params.memory.action,
      content: params.memory.content || params.text,
      memoryType: params.memory.memoryType || "custom",
    });
    checks.push({ layer: "memory", ...memory });
  }

  let outputText = params.aiOutputText?.trim() ? params.aiOutputText : (input.outputText as string) || params.text;
  if (params.aiOutputText?.trim()) {
    const output = await executeOutputGuard(apiKey, baseUrl, {
      text: params.aiOutputText,
      projectId: params.projectId,
      onThreat: "WARN",
      metadata: meta,
    });
    outputText = (output.outputText as string) || params.aiOutputText;
    checks.push({ layer: "output", ...output });

    const egress = await soterPost(apiKey, baseUrl, "/api/semantic-egress/check", {
      sessionId: typeof meta.sessionId === "string" ? meta.sessionId : undefined,
      content: params.aiOutputText,
      destinationType: params.outputDestinationType || "FINAL_OUTPUT",
      destinationName: params.outputDestinationName || undefined,
      sources: params.protectedSources ?? [],
      metadata: meta,
    });
    checks.push({ layer: "semanticEgress", ...egress });
  }

  const final = decideUniversal(checks, params.profile);
  const safeText = firstString(checks, ["safeText", "safeContent", "contentRedacted"]) || outputText;
  const enforced = enforceUniversalDecision({
    decision: final.decision,
    onThreat: params.onThreat || "BLOCK",
    originalText: params.aiOutputText?.trim() ? params.aiOutputText : params.text,
    safeText,
  });

  return {
    operation: "universalGuard",
    protectionProfile: params.profile,
    allowed: final.decision === "ALLOW" || final.decision === "REDACT" || final.decision === "REVIEW",
    blocked: enforced.blocked,
    needsHumanReview: final.decision === "ASK_APPROVAL",
    liveChatAction: final.decision === "ASK_APPROVAL" ? "SAFE_REPHRASE" : final.decision,
    finalDecision: final.decision,
    riskLevel: final.riskLevel,
    riskScore: final.riskScore,
    categories: collectCategories(checks),
    reason: final.reason,
    userMessage: buildUserFacingMessage({
      allowed: final.decision === "ALLOW" || final.decision === "REVIEW",
      direction: params.aiOutputText?.trim() ? "output" : "input",
      action: final.decision,
      categories: collectCategories(checks),
    }),
    developerMessage: buildDeveloperMessage({
      allowed: final.decision === "ALLOW" || final.decision === "REVIEW",
      direction: "workflow",
      reason: final.reason,
      riskScore: final.riskScore,
      categories: collectCategories(checks),
    }),
    outputText: enforced.outputText,
    safeText,
    recommendedAction: final.recommendedAction,
    safeRephrasePrompt: final.decision === "ASK_APPROVAL" ? buildSafeRephrasePrompt(collectCategories(checks)) : "",
    checks,
  };
}

async function executePiiRedactor(
  apiKey: string,
  baseUrl: string,
  params: PiiParams,
): Promise<IDataObject> {
  validateText(params.text, "Text");
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
    rawResponse: sanitizeOutputObject(raw),
  };
}

async function executeRagScanner(
  apiKey: string,
  baseUrl: string,
  params: RagParams,
): Promise<IDataObject> {
  validateText(params.text, "Document Text");
  if (!params.documentId.trim()) {
    throw new Error("Document ID is required for RAG risk summary.");
  }
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
    rawResponse: sanitizeOutputObject(raw),
  };
}

function parseMetadata(raw: string): Record<string, unknown> | undefined {
  if (!raw.trim()) return undefined;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return sanitizeRequestMetadata(parsed as Record<string, unknown>);
    }
  } catch {
    throw new Error("Metadata JSON must be a valid JSON object.");
  }
  throw new Error("Metadata JSON must be a valid JSON object.");
}

function parseOptionalJsonObject(raw: string, fieldName: string): Record<string, unknown> | undefined {
  if (!raw.trim()) return undefined;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    throw new Error(`${fieldName} must be a valid JSON object.`);
  }
  throw new Error(`${fieldName} must be a valid JSON object.`);
}

function validateBaseUrl(raw: string): string {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("SoterAI Base URL must be a valid URL.");
  }

  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error("SoterAI Base URL must not include credentials, query parameters, or fragments.");
  }

  const isLocalDevHost = ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);
  if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && isLocalDevHost)) {
    throw new Error("SoterAI Base URL must use HTTPS, except http://localhost for local development.");
  }

  parsed.pathname = parsed.pathname.replace(/\/+$/, "");
  return parsed.toString().replace(/\/$/, "");
}

function sanitizeRequestMetadata(metadata?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!metadata) return undefined;
  return sanitizeMetadataValue(metadata, 0) as Record<string, unknown>;
}

function sanitizeMetadataValue(value: unknown, depth: number, key?: string): unknown {
  if (depth > MAX_SANITIZE_DEPTH) return "[REDACTED_DEPTH_LIMIT]";
  if (isSensitiveKey(key)) return "[REDACTED]";
  if (typeof value === "string") {
    const sanitized = sanitizeErrorMessage(value);
    return sanitized.length > MAX_METADATA_STRING_LENGTH ? `${sanitized.slice(0, MAX_METADATA_STRING_LENGTH)}...[TRUNCATED]` : sanitized;
  }
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => sanitizeMetadataValue(item, depth + 1));
  if (value && typeof value === "object") {
    const sanitized: Record<string, unknown> = {};
    for (const [entryKey, entryValue] of Object.entries(value as Record<string, unknown>).slice(0, 50)) {
      sanitized[entryKey] = sanitizeMetadataValue(entryValue, depth + 1, entryKey);
    }
    return sanitized;
  }
  return value;
}

function parseOptionalJsonArray(raw: string, fieldName: string): unknown[] | undefined {
  if (!raw.trim()) return undefined;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    throw new Error(`${fieldName} must be a valid JSON array.`);
  }
  throw new Error(`${fieldName} must be a valid JSON array.`);
}

function parseSecurityContext(raw: string): SecurityContext {
  if (!raw.trim()) return {};
  const parsed = parseOptionalJsonObject(raw, "Security Context JSON") ?? {};
  const context: SecurityContext = {};

  if (isRecord(parsed.rag)) {
    context.rag = {
      text: stringValue(parsed.rag.text),
      documentId: stringValue(parsed.rag.documentId),
      source: stringValue(parsed.rag.source) ?? "api",
    };
  }

  if (isRecord(parsed.tool)) {
    const name = stringValue(parsed.tool.name);
    const action = stringValue(parsed.tool.action);
    if (!name || !action) {
      throw new Error("Security Context JSON tool requires name and action.");
    }
    context.tool = {
      name,
      action,
      destination: toolDestinationValue(parsed.tool.destination),
      target: stringValue(parsed.tool.target),
      content: stringValue(parsed.tool.content),
      riskContext: isRecord(parsed.tool.riskContext) ? parsed.tool.riskContext : undefined,
    };
  }

  if (isRecord(parsed.memory)) {
    const action = memoryActionValue(parsed.memory.action);
    if (action !== "NONE") {
      context.memory = {
        action,
        content: stringValue(parsed.memory.content),
        memoryType: stringValue(parsed.memory.memoryType) ?? "custom",
      };
    }
  }

  if (isRecord(parsed.output)) {
    context.output = {
      destinationType: stringValue(parsed.output.destinationType),
      destinationName: stringValue(parsed.output.destinationName),
      protectedSources: Array.isArray(parsed.output.protectedSources) ? parsed.output.protectedSources : undefined,
    };
  }

  return context;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function toolDestinationValue(value: unknown): ToolDestination {
  return value === "external" || value === "internal" || value === "local" || value === "unknown" ? value : "unknown";
}

function memoryActionValue(value: unknown): MemoryAction {
  return value === "STORE" || value === "READ" || value === "UPDATE" || value === "DELETE" ? value : "NONE";
}

function decideUniversal(checks: IDataObject[], profile: ProtectionProfile) {
  const layerDecisions = checks.map(toLayerDecision);
  const worst = layerDecisions.reduce((current, item) => riskRank(item.riskLevel) > riskRank(current.riskLevel) ? item : current, {
    decision: "ALLOW" as UniversalDecision,
    riskLevel: "LOW" as UniversalRisk,
    riskScore: 0,
    reason: "All enabled AI security checks passed.",
    layer: "universal",
  });
  const blocked = layerDecisions.find((item) => item.decision === "BLOCK");
  const redacted = layerDecisions.find((item) => item.decision === "REDACT");
  const approval = layerDecisions.find((item) => item.decision === "ASK_APPROVAL");
  const review = layerDecisions.find((item) => item.decision === "REVIEW");
  let decision: UniversalDecision = blocked?.decision ?? approval?.decision ?? redacted?.decision ?? review?.decision ?? "ALLOW";

  if (profile === "MAXIMUM") {
    if (worst.riskLevel === "CRITICAL" || worst.riskScore >= 75) decision = "BLOCK";
    else if (worst.riskLevel === "HIGH" || worst.riskScore >= 55) decision = "ASK_APPROVAL";
    else if (decision === "REVIEW") decision = "ASK_APPROVAL";
  } else if (profile === "STRICT") {
    if (worst.riskLevel === "CRITICAL" || worst.riskScore >= 85) decision = "BLOCK";
    else if (worst.riskLevel === "HIGH" || worst.riskScore >= 65) decision = decision === "REDACT" ? "REDACT" : "ASK_APPROVAL";
  }

  return {
    decision,
    riskLevel: worst.riskLevel,
    riskScore: worst.riskScore,
    reason: `${worst.layer}: ${worst.reason}`,
    recommendedAction: recommendedActionForDecision(decision),
  };
}

function toLayerDecision(check: IDataObject) {
  const layer = typeof check.layer === "string" ? check.layer : "unknown";
  let decision = normalizeDecision(check.decision);
  const allowed = typeof check.allowed === "boolean" ? check.allowed : undefined;
  if (!decision && allowed === false) decision = "BLOCK";
  if (!decision && typeof check.recommendedAction === "string") {
    const action = check.recommendedAction.toUpperCase();
    if (action.includes("QUARANTINE")) decision = "BLOCK";
    else if (action.includes("REDACT")) decision = "REDACT";
    else if (action.includes("REVIEW")) decision = "REVIEW";
  }
  const riskLevel = normalizeRisk(check.riskLevel) ?? riskLevelFromScore(scoreFromCheck(check));
  return {
    layer,
    decision: decision ?? "ALLOW" as UniversalDecision,
    riskLevel,
    riskScore: scoreFromCheck(check),
    reason: typeof check.reason === "string"
      ? check.reason
      : typeof check.trustLevel === "string"
        ? `RAG trust level ${check.trustLevel}`
        : "Check completed.",
  };
}

function normalizeDecision(value: unknown): UniversalDecision | undefined {
  if (value === "ALLOW" || value === "BLOCK" || value === "REDACT" || value === "ASK_APPROVAL" || value === "REVIEW") return value;
  if (value === "HUMAN_REVIEW" || value === "REQUIRE_APPROVAL") return "ASK_APPROVAL";
  if (value === "ALLOW_WITH_REDACTION" || value === "REWRITE") return "REDACT";
  if (value === "TAKEOVER_REQUIRED") return "ASK_APPROVAL";
  return undefined;
}

function normalizeRisk(value: unknown): UniversalRisk | undefined {
  if (value === "LOW" || value === "MEDIUM" || value === "HIGH" || value === "CRITICAL") return value;
  return undefined;
}

function riskLevelFromScore(score: number): UniversalRisk {
  if (score >= 85) return "CRITICAL";
  if (score >= 60) return "HIGH";
  if (score >= 30) return "MEDIUM";
  return "LOW";
}

function scoreFromCheck(check: IDataObject): number {
  if (typeof check.riskScore === "number") return normalizeScore(check.riskScore);
  if (typeof check.semanticRiskScore === "number") return normalizeScore(check.semanticRiskScore);
  if (typeof check.trustScore === "number") return Math.max(0, Math.min(100, 100 - check.trustScore));
  return riskScoreForLevel(normalizeRisk(check.riskLevel));
}

function normalizeScore(score: number) {
  const scaled = score <= 1 ? score * 100 : score;
  return Math.max(0, Math.min(100, Math.round(scaled)));
}

function riskScoreForLevel(level?: UniversalRisk) {
  switch (level) {
    case "CRITICAL": return 95;
    case "HIGH": return 75;
    case "MEDIUM": return 45;
    case "LOW":
    default: return 10;
  }
}

function riskRank(level: UniversalRisk) {
  return { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 }[level];
}

function enforceUniversalDecision(input: {
  decision: UniversalDecision;
  onThreat: string;
  originalText: string;
  safeText: string;
}) {
  if (input.decision === "REDACT") {
    return { blocked: false, outputText: input.safeText || "[REDACTED]" };
  }
  const threat = input.decision !== "ALLOW" && input.decision !== "REVIEW";
  if (!threat) return { blocked: false, outputText: input.safeText || input.originalText };
  switch (input.onThreat) {
    case "REDACT":
      return { blocked: false, outputText: input.safeText || "[REDACTED]" };
    case "WARN":
    case "CONTINUE":
      return { blocked: false, outputText: input.originalText };
    case "BLOCK":
    default:
      return { blocked: true, outputText: "" };
  }
}

function collectCategories(checks: IDataObject[]) {
  const values = new Set<string>();
  for (const check of checks) {
    const categories = check.categories ?? check.riskTypes;
    if (Array.isArray(categories)) {
      for (const category of categories) {
        if (typeof category === "string") values.add(category);
      }
    }
    const findings = check.findings;
    if (Array.isArray(findings)) {
      for (const finding of findings) {
        if (finding && typeof finding === "object" && "type" in finding && typeof finding.type === "string") {
          values.add(finding.type);
        }
      }
    }
  }
  return [...values];
}

function firstString(checks: IDataObject[], fields: string[]) {
  for (const check of checks) {
    for (const field of fields) {
      const value = check[field];
      if (typeof value === "string" && value.trim()) return value;
    }
  }
  return undefined;
}

function recommendedActionForDecision(decision: UniversalDecision) {
  switch (decision) {
    case "BLOCK": return "Do not continue the AI workflow item.";
    case "REDACT": return "Use outputText/safeText downstream instead of the original text.";
    case "ASK_APPROVAL": return "In live chat, ask the user for a safer rephrase and log the item for later review. In internal workflows, route to approval before executing.";
    case "REVIEW": return "Continue only in monitored or low-risk workflows; review before external release.";
    case "ALLOW":
    default: return "Continue the workflow.";
  }
}

function buildSafeRephrasePrompt(categories: string[]) {
  const values = new Set(categories);
  if (values.has("SECRET_DETECTED") || values.has("PII_DETECTED") || values.has("INDIA_PII_DETECTED")) {
    return "Please remove sensitive personal data, passwords, API keys, tokens, or private identifiers and send the request again.";
  }
  if (values.has("DATA_EXFILTRATION")) {
    return "Please remove private or confidential data-sharing instructions and describe the normal task you want help with.";
  }
  if (values.has("PROMPT_INJECTION") || values.has("JAILBREAK") || values.has("SYSTEM_PROMPT_LEAK_ATTEMPT")) {
    return "Please rephrase your request as a normal task without instructions to bypass rules or reveal private instructions.";
  }
  return "Please rephrase this as a clear, safe task and try again.";
}

function buildUserFacingMessage(input: {
  allowed: boolean;
  direction: "input" | "output";
  action?: string;
  categories?: string[];
}) {
  const categories = new Set(input.categories ?? []);
  if (input.action === "ASK_APPROVAL") {
    return "I need a safer version of this request before I can continue. Please remove sensitive data or bypass-style instructions and try again.";
  }
  if (input.action === "REDACT") {
    return "I removed sensitive information so we can continue safely.";
  }
  if (input.allowed) {
    return input.direction === "input"
      ? "Thanks. Your request passed the safety check and is being processed."
      : "Here is the safe response.";
  }
  if (categories.has("SECRET_DETECTED") || categories.has("PII_DETECTED") || categories.has("INDIA_PII_DETECTED")) {
    return "I cannot process this as-is because it may contain sensitive personal or secret information. Please remove passwords, API keys, tokens, private identifiers, or confidential data and try again.";
  }
  if (categories.has("PROMPT_INJECTION") || categories.has("JAILBREAK") || categories.has("SYSTEM_PROMPT_LEAK_ATTEMPT")) {
    return "I cannot help with requests that try to bypass safety rules or reveal private instructions. Please rephrase your request with the task you want completed.";
  }
  if (categories.has("DATA_EXFILTRATION")) {
    return "I cannot help send or expose private data. Please remove confidential details and try again.";
  }
  return "I cannot process this request safely as written. Please rephrase it with a clear, safe task and try again.";
}

function buildDeveloperMessage(input: {
  allowed: boolean;
  direction: "input" | "output" | "workflow";
  reason: string;
  riskScore: number;
  categories?: string[];
}) {
  const score = normalizeScore(input.riskScore);
  const categories = (input.categories ?? []).length ? input.categories?.join(", ") : "none";
  if (input.allowed) {
    return `SoterAI allowed this ${input.direction}. Risk score: ${score}. Categories: ${categories}.`;
  }
  return `SoterAI flagged this ${input.direction}. Risk score: ${score}. Categories: ${categories}. Reason: ${input.reason || "No reason returned."}`;
}

function executeWorkflowAudit(workflowJson: string): IDataObject {
  validateText(workflowJson, "Workflow JSON");
  const workflow = parseWorkflowJson(workflowJson);
  const nodes = Array.isArray(workflow.nodes) ? workflow.nodes.filter(isWorkflowNode) : [];
  const connections = workflow.connections && typeof workflow.connections === "object" ? workflow.connections as Record<string, unknown> : {};
  const findings: Array<Record<string, unknown>> = [];

  if (nodes.length === 0) {
    findings.push(auditFinding(
      "workflow.empty",
      "HIGH",
      "No workflow nodes were found.",
      "Export the full n8n workflow JSON and scan it before production use.",
      "LLM03:2025 Supply Chain",
    ));
  }

  const hasSoterNode = nodes.some((node) => node.type === "n8n-nodes-soterai.soterGuard");
  const hasUniversalGuard = nodes.some((node) => node.type === "n8n-nodes-soterai.soterGuard" && getParam(node, "action") === "universalGuard");
  const hasAiAgent = nodes.some((node) => /langchain\.agent|ai.?agent/i.test(`${node.type} ${node.name}`));
  const hasToolLikeNode = nodes.some((node) => isToolLikeNode(node));
  const hasWebhook = nodes.some((node) => /webhook|formTrigger/i.test(node.type));
  const hasRespond = nodes.some((node) => /respondToWebhook|webhook/i.test(node.type));
  const hasRagOrVector = nodes.some((node) => /vector|pinecone|qdrant|weaviate|supabase|retriever|document|embedding|splitter/i.test(`${node.type} ${node.name}`));
  const hasMemory = nodes.some((node) => /memory|chatMemory|windowBuffer/i.test(`${node.type} ${node.name}`));

  if ((hasAiAgent || hasToolLikeNode || hasRagOrVector) && !hasUniversalGuard) {
    findings.push(auditFinding(
      "soterai.universal_guard_missing",
      "CRITICAL",
      "AI, tool, or RAG workflow does not use SoterAI Universal AI Firewall.",
      "Place Universal AI Firewall before the LLM/AI Agent and again before external output or tool execution.",
      "LLM01:2025 Prompt Injection",
    ));
  } else if (!hasSoterNode) {
    findings.push(auditFinding(
      "soterai.guard_missing",
      "HIGH",
      "No SoterAI guard node was found in this workflow.",
      "Add SoterAI Universal AI Firewall or a focused SoterAI guard before risky AI steps.",
      "LLM05:2025 Improper Output Handling",
    ));
  }

  for (const node of nodes) {
    const searchable = `${node.name} ${node.type} ${JSON.stringify(node.parameters ?? {})}`;
    if (/code|function|python/i.test(node.type)) {
      findings.push(auditFinding(
        "n8n.code_node",
        "HIGH",
        `Code execution node detected: ${node.name}.`,
        "Avoid executing LLM-generated content in Code nodes. Gate any AI-generated code or parameters through Universal AI Firewall and use least-privilege credentials.",
        "LLM05:2025 Improper Output Handling",
        node.name,
      ));
    }
    if (/httpRequest/i.test(node.type) || /webhook|http|https:\/\//i.test(searchable)) {
      findings.push(auditFinding(
        "n8n.external_http",
        hasAiAgent ? "HIGH" : "MEDIUM",
        `External HTTP or webhook behavior detected near ${node.name}.`,
        "Check destination allowlists and scan AI-generated payloads with Universal AI Firewall before any external request.",
        "LLM02:2025 Sensitive Information Disclosure",
        node.name,
      ));
    }
    if (/credential|api[_ -]?key|token|secret|password|bearer/i.test(searchable)) {
      findings.push(auditFinding(
        "workflow.secret_reference",
        "CRITICAL",
        `Credential-like text appears in node parameters for ${node.name}.`,
        "Keep secrets in n8n credentials only. Do not store tokens, passwords, or API keys in workflow JSON or prompts.",
        "LLM02:2025 Sensitive Information Disclosure",
        node.name,
      ));
    }
    if (/langchain\.agent|ai.?agent/i.test(`${node.type} ${node.name}`) && !hasUniversalGuard) {
      findings.push(auditFinding(
        "ai_agent.unprotected",
        "CRITICAL",
        `AI Agent node appears unprotected: ${node.name}.`,
        "Gate user input, retrieved context, tool calls, memory writes, and final output with Universal AI Firewall.",
        "LLM06:2025 Excessive Agency",
        node.name,
      ));
    }
    if (/memory|chatMemory|windowBuffer/i.test(`${node.type} ${node.name}`) && !hasUniversalGuard) {
      findings.push(auditFinding(
        "agent.memory_unprotected",
        "HIGH",
        `Agent memory is present without Universal AI Firewall: ${node.name}.`,
        "Scan memory writes for poisoning, secrets, and PII before storage.",
        "LLM04:2025 Data and Model Poisoning",
        node.name,
      ));
    }
    if (/vector|pinecone|qdrant|weaviate|supabase|retriever|document|embedding|splitter/i.test(`${node.type} ${node.name}`) && !hasUniversalGuard) {
      findings.push(auditFinding(
        "rag.ingestion_unprotected",
        "HIGH",
        `RAG/vector workflow component detected: ${node.name}.`,
        "Scan documents and chunks before indexing and before sending retrieved context to the LLM.",
        "LLM08:2025 Vector and Embedding Weaknesses",
        node.name,
      ));
    }
    if (/respondToWebhook|email|gmail|slack|telegram|discord|notion|sheets/i.test(node.type) && !hasUniversalGuard) {
      findings.push(auditFinding(
        "output.egress_unprotected",
        "HIGH",
        `External or user-visible output node may send unscanned AI content: ${node.name}.`,
        "Run AI Output Text through Universal AI Firewall with the correct Output Destination Type before this node.",
        "LLM05:2025 Improper Output Handling",
        node.name,
      ));
    }
  }

  if (hasWebhook && hasAiAgent && !hasUniversalGuard) {
    findings.push(auditFinding(
      "webhook_to_agent_no_gate",
      "CRITICAL",
      "Public/webhook input can reach an AI Agent without a Universal AI Firewall gate.",
      "Place Universal AI Firewall immediately after Webhook/Form Trigger and block on `blocked === true`.",
      "LLM01:2025 Prompt Injection",
    ));
  }

  if (hasRespond && hasAiAgent && !hasUniversalGuard) {
    findings.push(auditFinding(
      "agent_to_user_no_output_gate",
      "HIGH",
      "AI Agent output appears able to reach a user or external endpoint without output scanning.",
      "Place Universal AI Firewall after the LLM/AI Agent and before Respond/Webhook/Email/HTTP nodes.",
      "LLM02:2025 Sensitive Information Disclosure",
    ));
  }

  const score = calculateWorkflowSecurityScore(findings);
  const riskLevel = riskLevelFromScore(100 - score);
  return {
    operation: "workflowAudit",
    workflowName: typeof workflow.name === "string" ? workflow.name : "Untitled workflow",
    securityScore: score,
    riskLevel,
    readyForProduction: score >= 85 && !findings.some((finding) => finding.severity === "CRITICAL"),
    summary: summarizeWorkflowAudit(score, findings),
    findings,
    quickWins: workflowQuickWins(findings, { hasUniversalGuard, hasAiAgent, hasRagOrVector, hasMemory, hasToolLikeNode }),
    recommendedSoterAIPlacement: recommendedSoterAIPlacement(nodes, connections),
    owaspCoverage: [
      "LLM01:2025 Prompt Injection",
      "LLM02:2025 Sensitive Information Disclosure",
      "LLM04:2025 Data and Model Poisoning",
      "LLM05:2025 Improper Output Handling",
      "LLM06:2025 Excessive Agency",
      "LLM08:2025 Vector and Embedding Weaknesses",
      "LLM10:2025 Unbounded Consumption",
    ],
  };
}

interface WorkflowNode {
  name: string;
  type: string;
  parameters?: Record<string, unknown>;
}

function parseWorkflowJson(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
  } catch {
    throw new Error("Workflow JSON must be a valid exported n8n workflow object.");
  }
  throw new Error("Workflow JSON must be a valid exported n8n workflow object.");
}

function isWorkflowNode(value: unknown): value is WorkflowNode {
  return Boolean(value && typeof value === "object" && typeof (value as WorkflowNode).name === "string" && typeof (value as WorkflowNode).type === "string");
}

function getParam(node: WorkflowNode, key: string): unknown {
  return node.parameters && typeof node.parameters === "object" ? node.parameters[key] : undefined;
}

function isToolLikeNode(node: WorkflowNode) {
  return /tool|httpRequest|gmail|slack|telegram|discord|notion|sheets|database|postgres|mysql|mongo|airtable|github|jira|linear/i.test(`${node.type} ${node.name}`);
}

function auditFinding(id: string, severity: UniversalRisk, message: string, recommendation: string, owasp: string, nodeName?: string) {
  return { id, severity, nodeName: nodeName ?? null, message, recommendation, owasp };
}

function calculateWorkflowSecurityScore(findings: Array<Record<string, unknown>>) {
  const penalty = findings.reduce((total, finding) => {
    switch (finding.severity) {
      case "CRITICAL": return total + 28;
      case "HIGH": return total + 16;
      case "MEDIUM": return total + 8;
      case "LOW": return total + 3;
      default: return total;
    }
  }, 0);
  return Math.max(0, Math.min(100, 100 - penalty));
}

function summarizeWorkflowAudit(score: number, findings: Array<Record<string, unknown>>) {
  const critical = findings.filter((finding) => finding.severity === "CRITICAL").length;
  const high = findings.filter((finding) => finding.severity === "HIGH").length;
  if (critical > 0) return `High-risk workflow: ${critical} critical and ${high} high findings. Add Universal AI Firewall gates before production.`;
  if (score < 85) return `Needs hardening: ${high} high findings. Add guard placement and least-privilege controls.`;
  return "Strong baseline: no critical findings detected by the n8n workflow audit.";
}

function workflowQuickWins(findings: Array<Record<string, unknown>>, context: Record<string, boolean>) {
  const wins = new Set<string>();
  if (!context.hasUniversalGuard) wins.add("Use Universal AI Firewall (Maximum Protection) directly after public inputs and before external outputs.");
  if (context.hasToolLikeNode) wins.add("Scan every AI-generated tool/function call before execution and require approval for external or mutating actions.");
  if (context.hasRagOrVector) wins.add("Scan RAG documents before indexing and scan retrieved context before the LLM consumes it.");
  if (context.hasMemory) wins.add("Scan memory writes for poisoning, secrets, and PII before storing them.");
  if (findings.some((finding) => finding.id === "workflow.secret_reference")) wins.add("Move every secret/API key/token into n8n credentials and rotate anything exposed in workflow JSON.");
  wins.add("Route IF nodes on `blocked`, `finalDecision`, and `riskLevel` so risky items cannot silently continue.");
  return [...wins];
}

function recommendedSoterAIPlacement(nodes: WorkflowNode[], connections: Record<string, unknown>) {
  const publicInputs = nodes.filter((node) => /webhook|formTrigger|chatTrigger|telegramTrigger|emailRead/i.test(`${node.type} ${node.name}`)).map((node) => node.name);
  const aiNodes = nodes.filter((node) => /langchain|openAi|anthropic|gemini|llm|ai.?agent|chain/i.test(`${node.type} ${node.name}`)).map((node) => node.name);
  const outputNodes = nodes.filter((node) => /respondToWebhook|httpRequest|email|gmail|slack|telegram|discord|notion|sheets/i.test(`${node.type} ${node.name}`)).map((node) => node.name);
  return {
    beforeLlm: publicInputs.length ? publicInputs.map((name) => `Place Universal AI Firewall immediately after ${name}.`) : ["Place Universal AI Firewall before the first LLM/AI Agent node."],
    beforeTools: aiNodes.length ? aiNodes.map((name) => `Inspect tool calls produced by ${name} before execution.`) : ["Enable Check Tool Call when an AI step can call tools."],
    beforeOutput: outputNodes.length ? outputNodes.map((name) => `Place Universal AI Firewall before ${name} for output and egress scanning.`) : ["Place Universal AI Firewall before any user-visible or external output."],
    connectionCount: Object.keys(connections).length,
  };
}

function validateText(text: string, fieldName: string): void {
  if (!text || !text.trim()) {
    throw new Error(`${fieldName} is required.`);
  }
  if (text.length > 200000) {
    throw new Error(`${fieldName} is too large. Keep text under 200,000 characters per item.`);
  }
}

function formatApiError(status: number, data: Record<string, unknown>): string {
  if (status === 401 || status === 403) {
    return "SoterAI API authentication failed. Check the API key and Base URL.";
  }
  if (status === 408 || status === 504) {
    return "SoterAI API request timed out upstream. Retry the workflow or reduce payload size.";
  }
  if (status === 413) {
    return "SoterAI API rejected the payload as too large. Reduce the text size and retry.";
  }
  if (status === 429) {
    return "SoterAI API rate limit reached. Retry later or reduce workflow concurrency.";
  }
  const message = typeof data.message === "string" ? sanitizeErrorMessage(data.message) : "";
  return message || `SoterAI API error ${status}.`;
}

function sanitizeErrorMessage(message: string): string {
  return message
    .replace(/sk-[A-Za-z0-9_-]+/g, "sk-[REDACTED]")
    .replace(/sk_[A-Za-z0-9_-]+/g, "sk_[REDACTED]")
    .replace(/gh[pousr]_[A-Za-z0-9_]+/g, "gh_[REDACTED]")
    .replace(/npm_[A-Za-z0-9_]+/g, "npm_[REDACTED]")
    .replace(/\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g, "AWS_ACCESS_KEY_[REDACTED]")
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [REDACTED]")
    .replace(/\b(?:authorization|x-api-key|api[-_]?key|token|secret|password)[=:]\s*[^,\s}]+/gi, (match) => {
      const separator = match.includes(":") ? ":" : "=";
      return `${match.slice(0, match.indexOf(separator))}${separator}[REDACTED]`;
    })
    .replace(/\b(?:postgres|postgresql|mysql|mongodb|redis):\/\/[^\s]+/gi, (match) => {
      const schemeEnd = match.indexOf("://");
      return `${match.slice(0, schemeEnd + 3)}[REDACTED]`;
    });
}

function sanitizeOutputObject(value: Record<string, unknown>): IDataObject {
  return sanitizeOutputValue(value, 0) as IDataObject;
}

function sanitizeOutputValue(value: unknown, depth: number, key?: string): unknown {
  if (depth > MAX_SANITIZE_DEPTH) return "[REDACTED_DEPTH_LIMIT]";
  if (isSensitiveKey(key)) return "[REDACTED]";
  if (typeof value === "string") return sanitizeErrorMessage(value);
  if (Array.isArray(value)) return value.map((item) => sanitizeOutputValue(item, depth + 1));
  if (value && typeof value === "object") {
    const sanitized: Record<string, unknown> = {};
    for (const [entryKey, entryValue] of Object.entries(value as Record<string, unknown>)) {
      sanitized[entryKey] = sanitizeOutputValue(entryValue, depth + 1, entryKey);
    }
    return sanitized;
  }
  return value;
}

function isSensitiveKey(key?: string): boolean {
  return Boolean(key && /(?:api[-_]?key|authorization|bearer|credential|password|secret|token|private[-_]?key)/i.test(key));
}
