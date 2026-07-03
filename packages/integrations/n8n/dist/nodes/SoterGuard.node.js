"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SoterGuard = void 0;
const n8n_workflow_1 = require("n8n-workflow");
class SoterGuard {
    constructor() {
        this.description = {
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
    }
    async execute() {
        const items = this.getInputData();
        const returnData = [];
        const credentials = await this.getCredentials("soterApi");
        const apiKey = credentials.apiKey;
        const baseUrl = credentials.baseUrl || "https://soterai.in";
        const credentialProjectId = credentials.projectId || undefined;
        for (let i = 0; i < items.length; i++) {
            try {
                const action = this.getNodeParameter("action", i);
                const projectId = this.getNodeParameter("projectId", i, "") || credentialProjectId;
                const metadataRaw = this.getNodeParameter("metadata", i, "");
                const metadata = metadataRaw ? parseMetadata(metadataRaw) : undefined;
                let result;
                switch (action) {
                    case "inputGuard": {
                        const text = this.getNodeParameter("inputText", i);
                        const onThreat = this.getNodeParameter("onThreat", i);
                        result = await executeInputGuard(apiKey, baseUrl, {
                            text, projectId, onThreat, metadata,
                        });
                        break;
                    }
                    case "outputGuard": {
                        const text = this.getNodeParameter("outputText", i);
                        const onThreat = this.getNodeParameter("onThreat", i);
                        result = await executeOutputGuard(apiKey, baseUrl, {
                            text, projectId, onThreat, metadata,
                        });
                        break;
                    }
                    case "piiRedactor": {
                        const text = this.getNodeParameter("piiText", i);
                        result = await executePiiRedactor(apiKey, baseUrl, {
                            text, projectId, metadata,
                        });
                        break;
                    }
                    case "ragScanner": {
                        const text = this.getNodeParameter("ragText", i);
                        const documentId = this.getNodeParameter("documentId", i);
                        const source = this.getNodeParameter("documentSource", i);
                        result = await executeRagScanner(apiKey, baseUrl, {
                            text, projectId, documentId, source, metadata,
                        });
                        break;
                    }
                    default:
                        throw new n8n_workflow_1.NodeOperationError(this.getNode(), `Unknown action: ${action}`, { itemIndex: i });
                }
                returnData.push({ json: result });
            }
            catch (error) {
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
exports.SoterGuard = SoterGuard;
async function soterPost(apiKey, baseUrl, path, body) {
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
    const data = await response.json();
    if (!response.ok) {
        const msg = typeof data.message === "string" ? data.message : `SoterAI API error ${response.status}`;
        throw new Error(msg);
    }
    return data;
}
async function executeInputGuard(apiKey, baseUrl, params) {
    const meta = { ...params.metadata };
    if (params.projectId)
        meta.projectId = params.projectId;
    const raw = await soterPost(apiKey, baseUrl, "/api/guard/input", {
        message: params.text,
        metadata: meta,
    });
    const allowed = raw.allowed;
    const result = {
        allowed,
        riskScore: raw.riskScore ?? 0,
        categories: raw.riskTypes ?? [],
        safeText: raw.safeText ?? raw.redactedText ?? params.text,
        reason: raw.reason ?? "",
        incidentId: raw.incidentId ?? null,
        rawResponse: raw,
    };
    if (!allowed && params.onThreat) {
        switch (params.onThreat) {
            case "BLOCK":
                result.blocked = true;
                result.outputText = "";
                break;
            case "REDACT":
                result.blocked = false;
                result.outputText = raw.safeText ?? raw.redactedText ?? "[REDACTED]";
                break;
            case "WARN":
                result.blocked = false;
                result.outputText = params.text;
                result.warning = raw.reason ?? "";
                break;
            case "CONTINUE":
                result.blocked = false;
                result.outputText = params.text;
                break;
        }
    }
    else {
        result.blocked = false;
        result.outputText = raw.safeText ?? raw.redactedText ?? params.text;
    }
    return result;
}
async function executeOutputGuard(apiKey, baseUrl, params) {
    const meta = { ...params.metadata };
    if (params.projectId)
        meta.projectId = params.projectId;
    const raw = await soterPost(apiKey, baseUrl, "/api/guard/output", {
        aiResponse: params.text,
        metadata: meta,
    });
    const allowed = raw.allowed;
    const result = {
        allowed,
        riskScore: raw.riskScore ?? 0,
        categories: raw.riskTypes ?? [],
        safeText: raw.safeText ?? raw.redactedText ?? params.text,
        reason: raw.reason ?? "",
        incidentId: raw.incidentId ?? null,
        rawResponse: raw,
    };
    if (!allowed && params.onThreat) {
        switch (params.onThreat) {
            case "BLOCK":
                result.blocked = true;
                result.outputText = "";
                break;
            case "REDACT":
                result.blocked = false;
                result.outputText = raw.safeText ?? raw.redactedText ?? "[REDACTED]";
                break;
            case "WARN":
                result.blocked = false;
                result.outputText = params.text;
                result.warning = raw.reason ?? "";
                break;
            case "CONTINUE":
                result.blocked = false;
                result.outputText = params.text;
                break;
        }
    }
    else {
        result.blocked = false;
        result.outputText = raw.safeText ?? raw.redactedText ?? params.text;
    }
    return result;
}
async function executePiiRedactor(apiKey, baseUrl, params) {
    const meta = { ...params.metadata };
    if (params.projectId)
        meta.projectId = params.projectId;
    const raw = await soterPost(apiKey, baseUrl, "/api/guard/input", {
        message: params.text,
        metadata: meta,
    });
    const findings = raw.findings ?? [];
    const piiEntities = findings
        .filter((f) => f.type === "PII_DETECTED" || f.type === "INDIA_PII_DETECTED" || f.type === "SECRET_DETECTED")
        .map((f) => ({
        type: f.type,
        label: f.label,
        severity: f.severity,
    }));
    return {
        safeText: raw.safeText ?? raw.redactedText ?? params.text,
        detectedEntities: piiEntities,
        riskScore: raw.riskScore ?? 0,
        rawResponse: raw,
    };
}
async function executeRagScanner(apiKey, baseUrl, params) {
    const raw = await soterPost(apiKey, baseUrl, "/api/rag/document/trust-score", {
        projectId: params.projectId,
        documentId: params.documentId,
        content: params.text,
        source: params.source,
        metadata: params.metadata,
    });
    return {
        trustScore: raw.trustScore ?? 0,
        trustLevel: raw.trustLevel ?? "NEEDS_REVIEW",
        findings: raw.findings ?? [],
        recommendedAction: raw.recommendedAction ?? "REVIEW",
        rawResponse: raw,
    };
}
function parseMetadata(raw) {
    if (!raw.trim())
        return undefined;
    try {
        const parsed = JSON.parse(raw);
        if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
            return parsed;
        }
    }
    catch {
        // Ignore invalid JSON so optional metadata does not break the workflow.
    }
    return undefined;
}
