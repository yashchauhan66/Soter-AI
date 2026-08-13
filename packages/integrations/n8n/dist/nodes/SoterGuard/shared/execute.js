"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SINGLE_OUTPUT_ACTIONS = exports.PACKAGE_VERSION = void 0;
exports.outputCountForAction = outputCountForAction;
exports.executeSoterGuard = executeSoterGuard;
const n8n_workflow_1 = require("n8n-workflow");
exports.PACKAGE_VERSION = "0.5.1";
const USER_AGENT = `n8n-nodes-soterai/${exports.PACKAGE_VERSION}`;
const MAX_SANITIZE_DEPTH = 8;
const MAX_METADATA_STRING_LENGTH = 500;
// Rate-limit backoff. execute() iterates the input items in a loop, so a batch
// workflow issues one guard call per item back to back and can legitimately
// out-run the per-minute limit. The API answers 429 with a Retry-After telling
// us exactly how long the window has left — waiting it out turns what used to
// be a hard workflow failure at item N into a short pause.
const MAX_RATE_LIMIT_RETRIES = 3;
const MAX_RETRY_WAIT_MS = 65000;
const DEFAULT_RETRY_WAIT_MS = 5000;
/**
 * Actions that route their items across the Safe/Flagged outputs on node
 * version 2. "Redact Secrets or PII" is deliberately absent: it never rejects
 * anything, it just returns a cleaned copy, so a second output would always be
 * empty. This mirrors n8n's own Guardrails node, where the classify operation
 * branches and the sanitize operation does not.
 */
exports.SINGLE_OUTPUT_ACTIONS = ["piiRedactor"];
function outputCountForAction(action) {
    return exports.SINGLE_OUTPUT_ACTIONS.includes(action) ? 1 : 2;
}
/**
 * Reads Retry-After (RFC 7231: delta-seconds or an HTTP-date) and clamps it to
 * a bound we are willing to block the workflow for. Returns null when the value
 * is missing or unusable so the caller can fall back to its own backoff.
 */
function parseRetryAfterMs(headers) {
    if (!headers || typeof headers !== "object")
        return null;
    const bag = headers;
    const raw = bag["retry-after"] ?? bag["Retry-After"];
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (typeof value !== "string" && typeof value !== "number")
        return null;
    const text = String(value).trim();
    if (!text)
        return null;
    const seconds = Number(text);
    if (Number.isFinite(seconds)) {
        if (seconds < 0)
            return null;
        return Math.min(seconds * 1000, MAX_RETRY_WAIT_MS);
    }
    const dateMs = Date.parse(text);
    if (Number.isNaN(dateMs))
        return null;
    const delta = dateMs - Date.now();
    if (delta <= 0)
        return 0;
    return Math.min(delta, MAX_RETRY_WAIT_MS);
}
/**
 * Decides which output an item leaves through on node version 2.
 *
 * The rule is one sentence per action family so it stays predictable:
 *
 * - Guard Input / Guard Output / Universal AI Firewall: Flagged means the node
 *   actually stopped the item. That follows `blocked`, which follows On Threat,
 *   so choosing Redact/Warn/Continue keeps the item on Safe with its cleaned or
 *   annotated text — exactly what those settings were chosen for.
 * - Analyze Text / RAG Risk Summary: these cannot stop anything, so Flagged
 *   means the item failed the check. Without this a report-only action would
 *   silently pass a detected threat straight into the model.
 * - Audit n8n Workflow Security: Flagged means the workflow is not production
 *   ready.
 * - Redact Secrets or PII: never flagged; it has a single output.
 */
function isFlagged(action, result) {
    switch (action) {
        case "piiRedactor":
            return false;
        case "workflowAudit":
            return result.readyForProduction !== true;
        case "ragScanner":
            return !isAllowishRecommendation(result.recommendedAction);
        case "analyzeText":
            return result.allowed === false;
        default:
            return result.blocked === true;
    }
}
/**
 * The RAG endpoint answers with a recommended action rather than a boolean. Any
 * value we do not positively recognise as "safe to index" counts as flagged, so
 * an unfamiliar verdict from a newer server fails closed instead of quietly
 * landing on the Safe branch.
 */
function isAllowishRecommendation(value) {
    if (typeof value !== "string")
        return false;
    return ["ALLOW", "ACCEPT", "INDEX", "CONTINUE", "TRUSTED"].includes(value.trim().toUpperCase());
}
async function executeSoterGuard() {
    const items = this.getInputData();
    const node = this.getNode();
    // Version 1 published a single output. Routing is gated on the saved
    // typeVersion rather than on a parameter so an existing workflow keeps
    // receiving every item on output 0, including the ones it chose to let
    // through with Warn or Continue.
    const branchOutputs = (node.typeVersion ?? 1) >= 2;
    const safeItems = [];
    const flaggedItems = [];
    const emit = (json, itemIndex, flagged) => {
        const entry = { json, pairedItem: { item: itemIndex } };
        if (branchOutputs && flagged)
            flaggedItems.push(entry);
        else
            safeItems.push(entry);
    };
    const credentials = await this.getCredentials("soterApi");
    const apiKey = credentials.apiKey;
    const baseUrl = validateBaseUrl(node, credentials.baseUrl || "https://soterai.in");
    const credentialProjectId = credentials.projectId || undefined;
    // "Action" is noDataExpression, so it is one fixed value for the whole node.
    // Read it once up front so the number of returned branches always matches the
    // number of outputs the canvas is drawing, even for an empty input batch.
    const nodeAction = items.length > 0
        ? this.getNodeParameter("action", 0)
        : (node.parameters?.action ?? "inputGuard");
    const nodeVersion = node.typeVersion ?? 1;
    for (let i = 0; i < items.length; i++) {
        try {
            const action = this.getNodeParameter("action", i);
            const projectId = this.getNodeParameter("projectId", i, "") || credentialProjectId;
            const metadata = buildMetadata(node, this.getNodeParameter("metadata", i, ""), nodeVersion >= 2 ? this.getNodeParameter("sessionId", i, "") : "");
            let result;
            switch (action) {
                case "analyzeText": {
                    const text = this.getNodeParameter("inputText", i);
                    result = await executeInputGuard(this, apiKey, baseUrl, {
                        text, projectId, onThreat: "WARN", metadata,
                    });
                    result.operation = "analyzeText";
                    result.outputText = result.safeText;
                    break;
                }
                case "inputGuard": {
                    const text = this.getNodeParameter("inputText", i);
                    const onThreat = this.getNodeParameter("onThreat", i);
                    result = await executeInputGuard(this, apiKey, baseUrl, {
                        text, projectId, onThreat, metadata,
                        allowedTopics: splitList(this.getNodeParameter("allowedTopics", i, "")),
                        systemPromptContext: this.getNodeParameter("systemPromptContext", i, ""),
                    });
                    result.operation = "inputGuard";
                    break;
                }
                case "universalGuard": {
                    const text = this.getNodeParameter("inputText", i);
                    const onThreat = this.getNodeParameter("onThreat", i);
                    const profile = this.getNodeParameter("protectionProfile", i);
                    const aiOutputText = this.getNodeParameter("universalOutputText", i, "");
                    const securityContext = readSecurityContext(this, node, i, nodeVersion);
                    result = await executeUniversalGuard(this, apiKey, baseUrl, {
                        text,
                        projectId,
                        onThreat,
                        metadata,
                        allowedTopics: splitList(this.getNodeParameter("allowedTopics", i, "")),
                        systemPromptContext: this.getNodeParameter("systemPromptContext", i, ""),
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
                    const text = this.getNodeParameter("outputText", i);
                    const onThreat = this.getNodeParameter("onThreat", i);
                    result = await executeOutputGuard(this, apiKey, baseUrl, {
                        text, projectId, onThreat, metadata,
                    });
                    result.operation = "outputGuard";
                    break;
                }
                case "piiRedactor": {
                    const text = this.getNodeParameter("piiText", i);
                    result = await executePiiRedactor(this, apiKey, baseUrl, {
                        text, projectId, metadata,
                    });
                    result.operation = "piiRedactor";
                    break;
                }
                case "ragScanner": {
                    const text = this.getNodeParameter("ragText", i);
                    const documentId = this.getNodeParameter("documentId", i);
                    const source = this.getNodeParameter("documentSource", i);
                    result = await executeRagScanner(this, apiKey, baseUrl, {
                        text, projectId, documentId, source, metadata,
                    });
                    result.operation = "ragScanner";
                    break;
                }
                case "workflowAudit": {
                    const workflowJson = this.getNodeParameter("workflowJson", i);
                    result = executeWorkflowAudit(node, workflowJson);
                    break;
                }
                default:
                    throw new n8n_workflow_1.NodeOperationError(node, `Unknown action: ${action}`, { itemIndex: i });
            }
            emit(result, i, isFlagged(action, result));
        }
        catch (error) {
            if (this.continueOnFail()) {
                // An item whose check never completed has not been cleared by anything,
                // so it leaves through Flagged rather than Safe. Sending it down the
                // Safe branch would turn an API outage into a silent bypass.
                emit({
                    error: true,
                    message: sanitizeErrorMessage(error instanceof Error ? error.message : "SoterAI request failed."),
                }, i, true);
                continue;
            }
            throw new n8n_workflow_1.NodeOperationError(node, error, { itemIndex: i });
        }
    }
    if (!branchOutputs || outputCountForAction(nodeAction) === 1) {
        return [safeItems];
    }
    return [safeItems, flaggedItems];
}
/**
 * Fields that exist so a caller can tell *why* a verdict happened, not just what
 * it was. `categories[0]` used to be read as "the reason" but it is detector
 * registration order — that is how a SQL injection ends up labelled
 * PROMPT_INJECTION. `primaryRiskType` is the server's actual answer.
 */
function calibrationFields(raw) {
    return {
        primaryRiskType: raw.primaryRiskType ?? null,
        categoryConfidence: raw.categoryConfidence ?? {},
        latencyMs: typeof raw.latencyMs === "number" ? raw.latencyMs : null,
    };
}
/**
 * Comma/newline separated free text -> the array the API expects.
 *
 * Bounded to match the server schema (50 entries, 120 chars each). Trimming here
 * rather than letting the request 400 keeps a long topic list from failing the
 * whole item with a validation error the user cannot easily connect to this field.
 */
function splitList(value) {
    if (!value)
        return [];
    return value
        .split(/[,\n]/)
        .map((entry) => entry.trim().slice(0, 120))
        .filter(Boolean)
        .slice(0, 50);
}
async function soterPost(ctx, apiKey, baseUrl, path, body) {
    const url = `${baseUrl.replace(/\/$/, "")}${path}`;
    for (let attempt = 0;; attempt++) {
        let response;
        try {
            response = await ctx.helpers.httpRequest({
                method: "POST",
                url,
                headers: {
                    "Content-Type": "application/json",
                    "x-api-key": apiKey,
                    "User-Agent": USER_AGENT,
                },
                body: body,
                json: true,
                timeout: 20000,
                returnFullResponse: true,
                ignoreHttpStatusErrors: true,
            });
        }
        catch (error) {
            throw new n8n_workflow_1.NodeApiError(ctx.getNode(), error, {
                message: "SoterAI API request failed. Check the Base URL and network access.",
            });
        }
        const statusCode = typeof response.statusCode === "number" ? response.statusCode : 0;
        const data = (response.body && typeof response.body === "object" ? response.body : {});
        // Guard calls are pure analysis — they create no resource — so replaying one
        // after the rate-limit window rolls over is safe.
        if (statusCode === 429 && attempt < MAX_RATE_LIMIT_RETRIES) {
            const retryAfterMs = parseRetryAfterMs(response.headers);
            // Back off exponentially only when the server did not tell us how long to
            // wait; when it did, its number is authoritative.
            const waitMs = retryAfterMs ?? Math.min(DEFAULT_RETRY_WAIT_MS * 2 ** attempt, MAX_RETRY_WAIT_MS);
            await (0, n8n_workflow_1.sleep)(waitMs);
            continue;
        }
        if (statusCode < 200 || statusCode >= 300) {
            throw new n8n_workflow_1.NodeApiError(ctx.getNode(), data, {
                message: formatApiError(statusCode, data),
                httpCode: String(statusCode),
            });
        }
        return data;
    }
}
async function executeInputGuard(ctx, apiKey, baseUrl, params) {
    validateText(ctx.getNode(), params.text, "Input Text");
    const meta = { ...params.metadata };
    if (params.projectId)
        meta.projectId = params.projectId;
    const raw = await soterPost(ctx, apiKey, baseUrl, "/api/guard/input", {
        message: params.text,
        metadata: meta,
        ...(params.allowedTopics?.length ? { allowedTopics: params.allowedTopics } : {}),
        ...(params.systemPromptContext?.trim()
            ? { systemPromptContext: params.systemPromptContext.trim() }
            : {}),
    });
    const allowed = raw.allowed;
    const action = normalizeDecision(raw.action) ?? (allowed ? "ALLOW" : "BLOCK");
    const result = {
        allowed,
        action,
        rawAction: raw.action ?? null,
        riskScore: raw.riskScore ?? 0,
        categories: raw.riskTypes ?? [],
        safeText: raw.safeText ?? raw.redactedText ?? params.text,
        reason: raw.reason ?? "",
        userMessage: buildUserFacingMessage({
            allowed,
            direction: "input",
            action,
            categories: raw.riskTypes ?? [],
        }),
        developerMessage: buildDeveloperMessage({
            allowed,
            direction: "input",
            reason: raw.reason ?? "",
            riskScore: raw.riskScore ?? 0,
            categories: raw.riskTypes ?? [],
        }),
        ...calibrationFields(raw),
        incidentId: raw.incidentId ?? null,
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
async function executeOutputGuard(ctx, apiKey, baseUrl, params) {
    validateText(ctx.getNode(), params.text, "AI Output Text");
    const meta = { ...params.metadata };
    if (params.projectId)
        meta.projectId = params.projectId;
    const raw = await soterPost(ctx, apiKey, baseUrl, "/api/guard/output", {
        aiResponse: params.text,
        metadata: meta,
    });
    const allowed = raw.allowed;
    const action = normalizeDecision(raw.action) ?? (allowed ? "ALLOW" : "BLOCK");
    const result = {
        allowed,
        action,
        rawAction: raw.action ?? null,
        riskScore: raw.riskScore ?? 0,
        categories: raw.riskTypes ?? [],
        safeText: raw.safeText ?? raw.redactedText ?? params.text,
        reason: raw.reason ?? "",
        userMessage: buildUserFacingMessage({
            allowed,
            direction: "output",
            action,
            categories: raw.riskTypes ?? [],
        }),
        developerMessage: buildDeveloperMessage({
            allowed,
            direction: "output",
            reason: raw.reason ?? "",
            riskScore: raw.riskScore ?? 0,
            categories: raw.riskTypes ?? [],
        }),
        ...calibrationFields(raw),
        incidentId: raw.incidentId ?? null,
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
async function executeUniversalGuard(ctx, apiKey, baseUrl, params) {
    validateText(ctx.getNode(), params.text, "Input Text");
    const meta = {
        ...params.metadata,
        soteraiNodeMode: "universalGuard",
        protectionProfile: params.profile,
    };
    if (params.projectId)
        meta.projectId = params.projectId;
    const checks = [];
    const input = await executeInputGuard(ctx, apiKey, baseUrl, {
        text: params.text,
        projectId: params.projectId,
        onThreat: "WARN",
        metadata: meta,
        allowedTopics: params.allowedTopics,
        systemPromptContext: params.systemPromptContext,
    });
    checks.push({ layer: "input", ...input });
    if (params.ragText?.trim()) {
        const documentId = params.ragDocumentId?.trim() || `n8n-${Date.now()}`;
        const rag = await executeRagScanner(ctx, apiKey, baseUrl, {
            text: params.ragText,
            projectId: params.projectId,
            documentId,
            source: params.ragSource || "api",
            metadata: meta,
        });
        checks.push({ layer: "rag", ...rag });
    }
    if (params.tool) {
        if (!params.tool.name.trim())
            throw new n8n_workflow_1.NodeOperationError(ctx.getNode(), "Tool Name is required when a Tool Call layer is added to Security Context.");
        if (!params.tool.action.trim())
            throw new n8n_workflow_1.NodeOperationError(ctx.getNode(), "Tool Action is required when a Tool Call layer is added to Security Context.");
        const tool = await soterPost(ctx, apiKey, baseUrl, "/api/agent/tool/check", {
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
        const memory = await soterPost(ctx, apiKey, baseUrl, "/api/agent/memory/check", {
            sessionId: typeof meta.sessionId === "string" ? meta.sessionId : undefined,
            memoryAction: params.memory.action,
            content: params.memory.content || params.text,
            memoryType: params.memory.memoryType || "custom",
        });
        checks.push({ layer: "memory", ...memory });
    }
    let outputText = params.aiOutputText?.trim() ? params.aiOutputText : input.outputText || params.text;
    if (params.aiOutputText?.trim()) {
        const output = await executeOutputGuard(ctx, apiKey, baseUrl, {
            text: params.aiOutputText,
            projectId: params.projectId,
            onThreat: "WARN",
            metadata: meta,
        });
        outputText = output.outputText || params.aiOutputText;
        checks.push({ layer: "output", ...output });
        const egress = await soterPost(ctx, apiKey, baseUrl, "/api/semantic-egress/check", {
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
    // Attribution comes from whichever layer actually drove the verdict, not from
    // the first layer that happened to run — otherwise `primaryRiskType` would say
    // "input" on a run that was decided by the egress check.
    const drivingLayer = checks.reduce((worst, check) => (check.riskScore ?? 0) > (worst?.riskScore ?? 0) ? check : worst, checks[0]);
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
        primaryRiskType: drivingLayer?.primaryRiskType ?? null,
        categoryConfidence: drivingLayer?.categoryConfidence ?? {},
        drivingLayer: drivingLayer?.layer ?? null,
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
async function executePiiRedactor(ctx, apiKey, baseUrl, params) {
    validateText(ctx.getNode(), params.text, "Text");
    const meta = { ...params.metadata };
    if (params.projectId)
        meta.projectId = params.projectId;
    const raw = await soterPost(ctx, apiKey, baseUrl, "/api/guard/input", {
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
        outputText: raw.safeText ?? raw.redactedText ?? params.text,
        detectedEntities: piiEntities,
        riskScore: raw.riskScore ?? 0,
        rawResponse: sanitizeOutputObject(raw),
    };
}
async function executeRagScanner(ctx, apiKey, baseUrl, params) {
    validateText(ctx.getNode(), params.text, "Document Text");
    if (!params.documentId.trim()) {
        throw new n8n_workflow_1.NodeOperationError(ctx.getNode(), "Document ID is required for RAG risk summary.");
    }
    const raw = await soterPost(ctx, apiKey, baseUrl, "/api/rag/document/trust-score", {
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
        rawResponse: sanitizeOutputObject(raw),
    };
}
/**
 * Metadata reaches the API from two places on version 2: the free-form JSON
 * field and the dedicated Session ID field. They are merged before sanitising
 * so the promoted field gets exactly the same redaction and depth limits as
 * anything typed into the JSON blob.
 */
function buildMetadata(node, raw, sessionId) {
    const merged = raw.trim() ? parseJsonObject(node, raw, "Metadata JSON") : {};
    const trimmedSessionId = sessionId.trim();
    if (trimmedSessionId)
        merged.sessionId = trimmedSessionId;
    if (Object.keys(merged).length === 0)
        return undefined;
    return sanitizeRequestMetadata(merged);
}
function parseJsonObject(node, raw, fieldName) {
    let parsed;
    try {
        parsed = JSON.parse(raw);
    }
    catch {
        throw new n8n_workflow_1.NodeOperationError(node, `${fieldName} must be a valid JSON object.`);
    }
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
        return parsed;
    }
    throw new n8n_workflow_1.NodeOperationError(node, `${fieldName} must be a valid JSON object.`);
}
function parseOptionalJsonObject(node, raw, fieldName) {
    if (!raw.trim())
        return undefined;
    return parseJsonObject(node, raw, fieldName);
}
function validateBaseUrl(node, raw) {
    let parsed;
    try {
        parsed = new URL(raw);
    }
    catch {
        throw new n8n_workflow_1.NodeOperationError(node, "SoterAI Base URL must be a valid URL.");
    }
    if (parsed.username || parsed.password || parsed.search || parsed.hash) {
        throw new n8n_workflow_1.NodeOperationError(node, "SoterAI Base URL must not include credentials, query parameters, or fragments.");
    }
    const isLocalDevHost = ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);
    if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && isLocalDevHost)) {
        throw new n8n_workflow_1.NodeOperationError(node, "SoterAI Base URL must use HTTPS, except http://localhost for local development.");
    }
    parsed.pathname = parsed.pathname.replace(/\/+$/, "");
    return parsed.toString().replace(/\/$/, "");
}
function sanitizeRequestMetadata(metadata) {
    if (!metadata)
        return undefined;
    return sanitizeMetadataValue(metadata, 0);
}
function sanitizeMetadataValue(value, depth, key) {
    if (depth > MAX_SANITIZE_DEPTH)
        return "[REDACTED_DEPTH_LIMIT]";
    if (isSensitiveKey(key))
        return "[REDACTED]";
    if (typeof value === "string") {
        const sanitized = sanitizeErrorMessage(value);
        return sanitized.length > MAX_METADATA_STRING_LENGTH ? `${sanitized.slice(0, MAX_METADATA_STRING_LENGTH)}...[TRUNCATED]` : sanitized;
    }
    if (Array.isArray(value))
        return value.slice(0, 50).map((item) => sanitizeMetadataValue(item, depth + 1));
    if (value && typeof value === "object") {
        const sanitized = {};
        for (const [entryKey, entryValue] of Object.entries(value).slice(0, 50)) {
            sanitized[entryKey] = sanitizeMetadataValue(entryValue, depth + 1, entryKey);
        }
        return sanitized;
    }
    return value;
}
/**
 * Version 2 collects the RAG/tool/memory/egress layers through guided fields, so
 * a new user never has to hand-write JSON for the most advanced action. Version 1
 * keeps reading the raw JSON field, because that is what its saved workflows hold.
 */
function readSecurityContext(ctx, node, itemIndex, nodeVersion) {
    if (nodeVersion >= 2) {
        return securityContextFromCollection(node, ctx.getNodeParameter("securityContext", itemIndex, {}));
    }
    return parseSecurityContext(node, ctx.getNodeParameter("securityContextJson", itemIndex, ""));
}
function securityContextFromCollection(node, collection) {
    const context = {};
    const rag = collection.rag;
    if (isRecord(rag) && stringValue(rag.text)) {
        context.rag = {
            text: stringValue(rag.text),
            documentId: stringValue(rag.documentId),
            source: stringValue(rag.source) ?? "api",
        };
    }
    const tool = collection.tool;
    if (isRecord(tool)) {
        const name = stringValue(tool.name);
        const action = stringValue(tool.action);
        // Only enforce the pair once the layer is actually in use. An added-then-
        // emptied Tool Call section should behave like "no tool layer", not fail
        // every item with a validation error.
        if (name || action) {
            if (!name || !action) {
                throw new n8n_workflow_1.NodeOperationError(node, "Security Context: a Tool Call layer needs both Tool Name and Tool Action.");
            }
            context.tool = {
                name,
                action,
                destination: toolDestinationValue(tool.destination),
                target: stringValue(tool.target),
                content: stringValue(tool.content),
                riskContext: parseOptionalJsonObject(node, stringValue(tool.riskContext) ?? "", "Security Context: Risk Context"),
            };
        }
    }
    const memory = collection.memory;
    if (isRecord(memory)) {
        const action = memoryActionValue(memory.action);
        if (action !== "NONE") {
            context.memory = {
                action,
                content: stringValue(memory.content),
                memoryType: stringValue(memory.memoryType) ?? "custom",
            };
        }
    }
    const output = collection.output;
    if (isRecord(output)) {
        const protectedSources = parseOptionalJsonArray(node, stringValue(output.protectedSources) ?? "", "Security Context: Protected Sources");
        const destinationType = stringValue(output.destinationType);
        const destinationName = stringValue(output.destinationName);
        if (destinationType || destinationName || protectedSources) {
            context.output = { destinationType, destinationName, protectedSources };
        }
    }
    return context;
}
function parseOptionalJsonArray(node, raw, fieldName) {
    if (!raw.trim())
        return undefined;
    let parsed;
    try {
        parsed = JSON.parse(raw);
    }
    catch {
        throw new n8n_workflow_1.NodeOperationError(node, `${fieldName} must be a valid JSON array.`);
    }
    if (Array.isArray(parsed))
        return parsed;
    throw new n8n_workflow_1.NodeOperationError(node, `${fieldName} must be a valid JSON array.`);
}
function parseSecurityContext(node, raw) {
    if (!raw.trim())
        return {};
    const parsed = parseOptionalJsonObject(node, raw, "Security Context JSON") ?? {};
    const context = {};
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
            throw new n8n_workflow_1.NodeOperationError(node, "Security Context JSON tool requires name and action.");
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
function isRecord(value) {
    return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
function stringValue(value) {
    return typeof value === "string" && value.trim() ? value : undefined;
}
function toolDestinationValue(value) {
    return value === "external" || value === "internal" || value === "local" || value === "unknown" ? value : "unknown";
}
function memoryActionValue(value) {
    return value === "STORE" || value === "READ" || value === "UPDATE" || value === "DELETE" ? value : "NONE";
}
function decideUniversal(checks, profile) {
    const layerDecisions = checks.map(toLayerDecision);
    const worst = layerDecisions.reduce((current, item) => riskRank(item.riskLevel) > riskRank(current.riskLevel) ? item : current, {
        decision: "ALLOW",
        riskLevel: "LOW",
        riskScore: 0,
        reason: "All enabled AI security checks passed.",
        layer: "universal",
    });
    const blocked = layerDecisions.find((item) => item.decision === "BLOCK");
    const redacted = layerDecisions.find((item) => item.decision === "REDACT");
    const approval = layerDecisions.find((item) => item.decision === "ASK_APPROVAL");
    const review = layerDecisions.find((item) => item.decision === "REVIEW");
    let decision = blocked?.decision ?? approval?.decision ?? redacted?.decision ?? review?.decision ?? "ALLOW";
    if (profile === "MAXIMUM") {
        if (worst.riskLevel === "CRITICAL" || worst.riskScore >= 75)
            decision = "BLOCK";
        else if (worst.riskLevel === "HIGH" || worst.riskScore >= 55)
            decision = "ASK_APPROVAL";
        else if (decision === "REVIEW")
            decision = "ASK_APPROVAL";
    }
    else if (profile === "STRICT") {
        if (worst.riskLevel === "CRITICAL" || worst.riskScore >= 85)
            decision = "BLOCK";
        else if (worst.riskLevel === "HIGH" || worst.riskScore >= 65)
            decision = decision === "REDACT" ? "REDACT" : "ASK_APPROVAL";
    }
    return {
        decision,
        riskLevel: worst.riskLevel,
        riskScore: worst.riskScore,
        reason: `${worst.layer}: ${worst.reason}`,
        recommendedAction: recommendedActionForDecision(decision),
    };
}
function toLayerDecision(check) {
    const layer = typeof check.layer === "string" ? check.layer : "unknown";
    let decision = normalizeDecision(check.decision);
    const allowed = typeof check.allowed === "boolean" ? check.allowed : undefined;
    if (!decision && allowed === false)
        decision = "BLOCK";
    if (!decision && typeof check.recommendedAction === "string") {
        const action = check.recommendedAction.toUpperCase();
        if (action.includes("QUARANTINE"))
            decision = "BLOCK";
        else if (action.includes("REDACT"))
            decision = "REDACT";
        else if (action.includes("REVIEW"))
            decision = "REVIEW";
    }
    const riskLevel = normalizeRisk(check.riskLevel) ?? riskLevelFromScore(scoreFromCheck(check));
    return {
        layer,
        decision: decision ?? "ALLOW",
        riskLevel,
        riskScore: scoreFromCheck(check),
        reason: typeof check.reason === "string"
            ? check.reason
            : typeof check.trustLevel === "string"
                ? `RAG trust level ${check.trustLevel}`
                : "Check completed.",
    };
}
function normalizeDecision(value) {
    if (value === "ALLOW" || value === "BLOCK" || value === "REDACT" || value === "ASK_APPROVAL" || value === "REVIEW")
        return value;
    if (value === "HUMAN_REVIEW" || value === "REQUIRE_APPROVAL")
        return "ASK_APPROVAL";
    if (value === "ALLOW_WITH_REDACTION" || value === "REWRITE")
        return "REDACT";
    if (value === "TAKEOVER_REQUIRED")
        return "ASK_APPROVAL";
    return undefined;
}
function normalizeRisk(value) {
    if (value === "LOW" || value === "MEDIUM" || value === "HIGH" || value === "CRITICAL")
        return value;
    return undefined;
}
function riskLevelFromScore(score) {
    if (score >= 85)
        return "CRITICAL";
    if (score >= 60)
        return "HIGH";
    if (score >= 30)
        return "MEDIUM";
    return "LOW";
}
function scoreFromCheck(check) {
    if (typeof check.riskScore === "number")
        return normalizeScore(check.riskScore);
    if (typeof check.semanticRiskScore === "number")
        return normalizeScore(check.semanticRiskScore);
    if (typeof check.trustScore === "number")
        return Math.max(0, Math.min(100, 100 - check.trustScore));
    return riskScoreForLevel(normalizeRisk(check.riskLevel));
}
function normalizeScore(score) {
    const scaled = score <= 1 ? score * 100 : score;
    return Math.max(0, Math.min(100, Math.round(scaled)));
}
function riskScoreForLevel(level) {
    switch (level) {
        case "CRITICAL": return 95;
        case "HIGH": return 75;
        case "MEDIUM": return 45;
        case "LOW":
        default: return 10;
    }
}
function riskRank(level) {
    return { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 }[level];
}
function enforceUniversalDecision(input) {
    if (input.decision === "REDACT") {
        return { blocked: false, outputText: input.safeText || "[REDACTED]" };
    }
    const threat = input.decision !== "ALLOW" && input.decision !== "REVIEW";
    if (!threat)
        return { blocked: false, outputText: input.safeText || input.originalText };
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
function collectCategories(checks) {
    const values = new Set();
    for (const check of checks) {
        const categories = check.categories ?? check.riskTypes;
        if (Array.isArray(categories)) {
            for (const category of categories) {
                if (typeof category === "string")
                    values.add(category);
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
function firstString(checks, fields) {
    for (const check of checks) {
        for (const field of fields) {
            const value = check[field];
            if (typeof value === "string" && value.trim())
                return value;
        }
    }
    return undefined;
}
function recommendedActionForDecision(decision) {
    switch (decision) {
        case "BLOCK": return "Do not continue the AI workflow item.";
        case "REDACT": return "Use outputText/safeText downstream instead of the original text.";
        case "ASK_APPROVAL": return "In live chat, ask the user for a safer rephrase and log the item for later review. In internal workflows, route to approval before executing.";
        case "REVIEW": return "Continue only in monitored or low-risk workflows; review before external release.";
        case "ALLOW":
        default: return "Continue the workflow.";
    }
}
function buildSafeRephrasePrompt(categories) {
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
function buildUserFacingMessage(input) {
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
function buildDeveloperMessage(input) {
    const score = normalizeScore(input.riskScore);
    const categories = (input.categories ?? []).length ? input.categories?.join(", ") : "none";
    if (input.allowed) {
        return `SoterAI allowed this ${input.direction}. Risk score: ${score}. Categories: ${categories}.`;
    }
    return `SoterAI flagged this ${input.direction}. Risk score: ${score}. Categories: ${categories}. Reason: ${input.reason || "No reason returned."}`;
}
function executeWorkflowAudit(node, workflowJson) {
    validateText(node, workflowJson, "Workflow JSON");
    const workflow = parseWorkflowJson(node, workflowJson);
    const nodes = Array.isArray(workflow.nodes) ? workflow.nodes.filter(isWorkflowNode) : [];
    const connections = workflow.connections && typeof workflow.connections === "object" ? workflow.connections : {};
    const findings = [];
    if (nodes.length === 0) {
        findings.push(auditFinding("workflow.empty", "HIGH", "No workflow nodes were found.", "Export the full n8n workflow JSON and scan it before production use.", "LLM03:2025 Supply Chain"));
    }
    const hasSoterNode = nodes.some((wfNode) => wfNode.type === "n8n-nodes-soterai.soterGuard");
    const hasUniversalGuard = nodes.some((wfNode) => wfNode.type === "n8n-nodes-soterai.soterGuard" && getParam(wfNode, "action") === "universalGuard");
    const hasAiAgent = nodes.some((wfNode) => /langchain\.agent|ai.?agent/i.test(`${wfNode.type} ${wfNode.name}`));
    const hasToolLikeNode = nodes.some((wfNode) => isToolLikeNode(wfNode));
    const hasWebhook = nodes.some((wfNode) => /webhook|formTrigger/i.test(wfNode.type));
    const hasRespond = nodes.some((wfNode) => /respondToWebhook|webhook/i.test(wfNode.type));
    const hasRagOrVector = nodes.some((wfNode) => /vector|pinecone|qdrant|weaviate|supabase|retriever|document|embedding|splitter/i.test(`${wfNode.type} ${wfNode.name}`));
    const hasMemory = nodes.some((wfNode) => /memory|chatMemory|windowBuffer/i.test(`${wfNode.type} ${wfNode.name}`));
    if ((hasAiAgent || hasToolLikeNode || hasRagOrVector) && !hasUniversalGuard) {
        findings.push(auditFinding("soterai.universal_guard_missing", "CRITICAL", "AI, tool, or RAG workflow does not use SoterAI Universal AI Firewall.", "Place Universal AI Firewall before the LLM/AI Agent and again before external output or tool execution.", "LLM01:2025 Prompt Injection"));
    }
    else if (!hasSoterNode) {
        findings.push(auditFinding("soterai.guard_missing", "HIGH", "No SoterAI guard node was found in this workflow.", "Add SoterAI Universal AI Firewall or a focused SoterAI guard before risky AI steps.", "LLM05:2025 Improper Output Handling"));
    }
    for (const wfNode of nodes) {
        const searchable = `${wfNode.name} ${wfNode.type} ${JSON.stringify(wfNode.parameters ?? {})}`;
        if (/code|function|python/i.test(wfNode.type)) {
            findings.push(auditFinding("n8n.code_node", "HIGH", `Code execution node detected: ${wfNode.name}.`, "Avoid executing LLM-generated content in Code nodes. Gate any AI-generated code or parameters through Universal AI Firewall and use least-privilege credentials.", "LLM05:2025 Improper Output Handling", wfNode.name));
        }
        if (/httpRequest/i.test(wfNode.type) || /webhook|http|https:\/\//i.test(searchable)) {
            findings.push(auditFinding("n8n.external_http", hasAiAgent ? "HIGH" : "MEDIUM", `External HTTP or webhook behavior detected near ${wfNode.name}.`, "Check destination allowlists and scan AI-generated payloads with Universal AI Firewall before any external request.", "LLM02:2025 Sensitive Information Disclosure", wfNode.name));
        }
        if (/credential|api[_ -]?key|token|secret|password|bearer/i.test(searchable)) {
            findings.push(auditFinding("workflow.secret_reference", "CRITICAL", `Credential-like text appears in node parameters for ${wfNode.name}.`, "Keep secrets in n8n credentials only. Do not store tokens, passwords, or API keys in workflow JSON or prompts.", "LLM02:2025 Sensitive Information Disclosure", wfNode.name));
        }
        if (/langchain\.agent|ai.?agent/i.test(`${wfNode.type} ${wfNode.name}`) && !hasUniversalGuard) {
            findings.push(auditFinding("ai_agent.unprotected", "CRITICAL", `AI Agent node appears unprotected: ${wfNode.name}.`, "Gate user input, retrieved context, tool calls, memory writes, and final output with Universal AI Firewall.", "LLM06:2025 Excessive Agency", wfNode.name));
        }
        if (/memory|chatMemory|windowBuffer/i.test(`${wfNode.type} ${wfNode.name}`) && !hasUniversalGuard) {
            findings.push(auditFinding("agent.memory_unprotected", "HIGH", `Agent memory is present without Universal AI Firewall: ${wfNode.name}.`, "Scan memory writes for poisoning, secrets, and PII before storage.", "LLM04:2025 Data and Model Poisoning", wfNode.name));
        }
        if (/vector|pinecone|qdrant|weaviate|supabase|retriever|document|embedding|splitter/i.test(`${wfNode.type} ${wfNode.name}`) && !hasUniversalGuard) {
            findings.push(auditFinding("rag.ingestion_unprotected", "HIGH", `RAG/vector workflow component detected: ${wfNode.name}.`, "Scan documents and chunks before indexing and before sending retrieved context to the LLM.", "LLM08:2025 Vector and Embedding Weaknesses", wfNode.name));
        }
        if (/respondToWebhook|email|gmail|slack|telegram|discord|notion|sheets/i.test(wfNode.type) && !hasUniversalGuard) {
            findings.push(auditFinding("output.egress_unprotected", "HIGH", `External or user-visible output node may send unscanned AI content: ${wfNode.name}.`, "Run AI Output Text through Universal AI Firewall with the correct Output Destination Type before this node.", "LLM05:2025 Improper Output Handling", wfNode.name));
        }
    }
    if (hasWebhook && hasAiAgent && !hasUniversalGuard) {
        findings.push(auditFinding("webhook_to_agent_no_gate", "CRITICAL", "Public/webhook input can reach an AI Agent without a Universal AI Firewall gate.", "Place Universal AI Firewall immediately after Webhook/Form Trigger and block on `blocked === true`.", "LLM01:2025 Prompt Injection"));
    }
    if (hasRespond && hasAiAgent && !hasUniversalGuard) {
        findings.push(auditFinding("agent_to_user_no_output_gate", "HIGH", "AI Agent output appears able to reach a user or external endpoint without output scanning.", "Place Universal AI Firewall after the LLM/AI Agent and before Respond/Webhook/Email/HTTP nodes.", "LLM02:2025 Sensitive Information Disclosure"));
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
function parseWorkflowJson(node, raw) {
    let parsed;
    try {
        parsed = JSON.parse(raw);
    }
    catch {
        throw new n8n_workflow_1.NodeOperationError(node, "Workflow JSON must be a valid exported n8n workflow object.");
    }
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
        return parsed;
    throw new n8n_workflow_1.NodeOperationError(node, "Workflow JSON must be a valid exported n8n workflow object.");
}
function isWorkflowNode(value) {
    return Boolean(value && typeof value === "object" && typeof value.name === "string" && typeof value.type === "string");
}
function getParam(node, key) {
    return node.parameters && typeof node.parameters === "object" ? node.parameters[key] : undefined;
}
function isToolLikeNode(node) {
    return /tool|httpRequest|gmail|slack|telegram|discord|notion|sheets|database|postgres|mysql|mongo|airtable|github|jira|linear/i.test(`${node.type} ${node.name}`);
}
function auditFinding(id, severity, message, recommendation, owasp, nodeName) {
    return { id, severity, nodeName: nodeName ?? null, message, recommendation, owasp };
}
function calculateWorkflowSecurityScore(findings) {
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
function summarizeWorkflowAudit(score, findings) {
    const critical = findings.filter((finding) => finding.severity === "CRITICAL").length;
    const high = findings.filter((finding) => finding.severity === "HIGH").length;
    if (critical > 0)
        return `High-risk workflow: ${critical} critical and ${high} high findings. Add Universal AI Firewall gates before production.`;
    if (score < 85)
        return `Needs hardening: ${high} high findings. Add guard placement and least-privilege controls.`;
    return "Strong baseline: no critical findings detected by the n8n workflow audit.";
}
function workflowQuickWins(findings, context) {
    const wins = new Set();
    if (!context.hasUniversalGuard)
        wins.add("Use Universal AI Firewall (Maximum Protection) directly after public inputs and before external outputs.");
    if (context.hasToolLikeNode)
        wins.add("Scan every AI-generated tool/function call before execution and require approval for external or mutating actions.");
    if (context.hasRagOrVector)
        wins.add("Scan RAG documents before indexing and scan retrieved context before the LLM consumes it.");
    if (context.hasMemory)
        wins.add("Scan memory writes for poisoning, secrets, and PII before storing them.");
    if (findings.some((finding) => finding.id === "workflow.secret_reference"))
        wins.add("Move every secret/API key/token into n8n credentials and rotate anything exposed in workflow JSON.");
    wins.add("Connect the SoterAI node's Flagged output, or route IF nodes on `blocked`, `finalDecision`, and `riskLevel`, so risky items cannot silently continue.");
    return [...wins];
}
function recommendedSoterAIPlacement(nodes, connections) {
    const publicInputs = nodes.filter((node) => /webhook|formTrigger|chatTrigger|telegramTrigger|emailRead/i.test(`${node.type} ${node.name}`)).map((node) => node.name);
    const aiNodes = nodes.filter((node) => /langchain|openAi|anthropic|gemini|llm|ai.?agent|chain/i.test(`${node.type} ${node.name}`)).map((node) => node.name);
    const outputNodes = nodes.filter((node) => /respondToWebhook|httpRequest|email|gmail|slack|telegram|discord|notion|sheets/i.test(`${node.type} ${node.name}`)).map((node) => node.name);
    return {
        beforeLlm: publicInputs.length ? publicInputs.map((name) => `Place Universal AI Firewall immediately after ${name}.`) : ["Place Universal AI Firewall before the first LLM/AI Agent node."],
        beforeTools: aiNodes.length ? aiNodes.map((name) => `Inspect tool calls produced by ${name} before execution.`) : ["Add a Tool Call layer to Security Context when an AI step can call tools."],
        beforeOutput: outputNodes.length ? outputNodes.map((name) => `Place Universal AI Firewall before ${name} for output and egress scanning.`) : ["Place Universal AI Firewall before any user-visible or external output."],
        connectionCount: Object.keys(connections).length,
    };
}
function validateText(node, text, fieldName) {
    if (!text || !text.trim()) {
        throw new n8n_workflow_1.NodeOperationError(node, `${fieldName} is required.`);
    }
    if (text.length > 200000) {
        throw new n8n_workflow_1.NodeOperationError(node, `${fieldName} is too large. Keep text under 200,000 characters per item.`);
    }
}
function formatApiError(status, data) {
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
        return (`SoterAI API rate limit still exceeded after ${MAX_RATE_LIMIT_RETRIES} retries. ` +
            "Reduce workflow concurrency or upgrade the plan for a higher per-minute limit.");
    }
    const message = typeof data.message === "string" ? sanitizeErrorMessage(data.message) : "";
    return message || `SoterAI API error ${status}.`;
}
function sanitizeErrorMessage(message) {
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
function sanitizeOutputObject(value) {
    return sanitizeOutputValue(value, 0);
}
function sanitizeOutputValue(value, depth, key) {
    if (depth > MAX_SANITIZE_DEPTH)
        return "[REDACTED_DEPTH_LIMIT]";
    if (isSensitiveKey(key))
        return "[REDACTED]";
    if (typeof value === "string")
        return sanitizeErrorMessage(value);
    if (Array.isArray(value))
        return value.map((item) => sanitizeOutputValue(item, depth + 1));
    if (value && typeof value === "object") {
        const sanitized = {};
        for (const [entryKey, entryValue] of Object.entries(value)) {
            sanitized[entryKey] = sanitizeOutputValue(entryValue, depth + 1, entryKey);
        }
        return sanitized;
    }
    return value;
}
function isSensitiveKey(key) {
    return Boolean(key && /(?:api[-_]?key|authorization|bearer|credential|password|secret|token|private[-_]?key)/i.test(key));
}
