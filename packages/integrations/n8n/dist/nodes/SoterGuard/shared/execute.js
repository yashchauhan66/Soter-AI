"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SINGLE_OUTPUT_ACTIONS = exports.PACKAGE_VERSION = void 0;
exports.outputCountForAction = outputCountForAction;
exports.executeSoterGuard = executeSoterGuard;
const n8n_workflow_1 = require("n8n-workflow");
const localEngine_1 = require("./localEngine");
exports.PACKAGE_VERSION = "0.6.0";
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
const ENGINE_LOCAL_HINT = "Set Detection Engine to Local to run the bundled rule engine in-process instead — no API key and no " +
    "network egress. Local mode is pattern-based and reports its own limitations on every item.";
const DEFAULT_REQUEST_TIMEOUT_MS = 20000;
const MAX_BATCH_CONCURRENCY = 20;
function readNodeOptions(ctx, itemIndex) {
    const engineRaw = ctx.getNodeParameter("detectionEngine", itemIndex, "CLOUD");
    const advanced = ctx.getNodeParameter("advancedOptions", itemIndex, {});
    const concurrency = Number(advanced.batchConcurrency ?? 1);
    const timeout = Number(advanced.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS);
    return {
        engine: engineRaw === "LOCAL" || engineRaw === "AUTO" ? engineRaw : "CLOUD",
        batchConcurrency: Number.isFinite(concurrency) ? Math.max(1, Math.min(MAX_BATCH_CONCURRENCY, Math.trunc(concurrency))) : 1,
        reuseIdenticalItems: advanced.reuseIdenticalItems !== false,
        parallelLayers: advanced.parallelLayers !== false,
        requestTimeoutMs: Number.isFinite(timeout) ? Math.max(1000, Math.min(120000, Math.trunc(timeout))) : DEFAULT_REQUEST_TIMEOUT_MS,
        includeRawResponse: advanced.includeRawResponse !== false,
    };
}
/**
 * Marks an API failure as "the endpoint might work if we asked again" so Auto
 * mode knows when falling back to the local engine is the right answer.
 *
 * The distinction matters more than it looks. A 5xx, a dropped connection or an
 * exhausted rate-limit window says nothing about the request, so re-running it
 * locally is a strictly better outcome than failing the item. A 401, 403 or 400
 * *is* about the request — the key is wrong, the plan does not include the
 * endpoint, the payload is invalid — and silently answering it with a weaker
 * engine would hide a misconfiguration the user needs to see.
 */
function tagTransient(error) {
    error.soterTransient = true;
    return error;
}
function isTransientApiError(error) {
    return Boolean(error && typeof error === "object" && error.soterTransient === true);
}
/**
 * Guarantees an n8n error type on the way out of the engine selector.
 *
 * Everything thrown below it is already a `NodeApiError` or a
 * `NodeOperationError`, so this is a backstop and not a conversion: re-wrapping
 * an n8n error would bury the message, the path, and the status code that make it
 * actionable, while an unexpected raw error still must not reach n8n bare.
 */
function asNodeError(node, error) {
    if (error instanceof n8n_workflow_1.NodeApiError || error instanceof n8n_workflow_1.NodeOperationError)
        return error;
    return new n8n_workflow_1.NodeOperationError(node, error);
}
/**
 * Runs the input items with a bounded number in flight, preserving item order in
 * the output regardless of the order they finish in.
 *
 * Concurrency defaults to 1, so the node keeps behaving exactly as it always has
 * unless a user asks for more: at 1 an item that throws stops the batch before
 * the next item is sent, which is what "stop on first error" has to mean. Above
 * 1, items already in flight when one fails still complete — that is inherent to
 * running them at once — and the earliest failure by item index is the one
 * reported, so the error a user sees does not depend on network timing.
 */
async function runWithConcurrency(count, limit, work) {
    if (limit <= 1) {
        for (let index = 0; index < count; index++) {
            await work(index);
        }
        return;
    }
    let next = 0;
    const failures = [];
    const workers = Array.from({ length: Math.min(limit, count) }, async () => {
        for (;;) {
            const index = next++;
            if (index >= count)
                return;
            try {
                await work(index);
            }
            catch (error) {
                failures.push({ index, error });
            }
        }
    });
    await Promise.all(workers);
    if (failures.length > 0) {
        failures.sort((a, b) => a.index - b.index);
        throw failures[0].error;
    }
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
 * - Guard Input / Guard Output: Flagged means the node actually stopped the
 *   item. That follows `blocked`, which follows On Threat, so choosing
 *   Redact/Warn/Continue keeps the item on Safe with its cleaned or annotated
 *   text — exactly what those settings were chosen for.
 * - Universal AI Firewall: the same, plus Flagged when any layer failed to
 *   answer. A layer that never ran has cleared nothing, so an item carrying an
 *   unchecked layer must not land on Safe as if six checks had passed.
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
        case "universalGuard":
            return result.blocked === true || result.degraded === true;
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
/**
 * Reads a text parameter, which is not the same thing as casting one.
 *
 * `getNodeParameter` returns whatever the user's expression evaluated to, so a
 * field declared `type: "string"` arrives as a number for `{{ $json.ticketId }}`,
 * as `null` for a missing key, and as an object for `{{ $json }}`. Every text
 * parameter in this file was read with `as string`, which is a compile-time
 * assertion the runtime never checks: the object case reached `text.trim()` and
 * failed with "text.trim is not a function", a message that names nothing the
 * user can act on and points at no field.
 *
 * Scalars are coerced, because a numeric ticket id is a real thing to scan and
 * `String(12345)` is exactly what the user meant. Objects and arrays are
 * refused instead of stringified: scanning `{"message":"..."}` would inspect
 * JSON punctuation and key names, then report a clean pass over text that was
 * never really examined — and a guard that reports protection it did not
 * perform is the one failure this package is built to avoid.
 */
function readText(ctx, node, name, itemIndex, fieldName) {
    const raw = ctx.getNodeParameter(name, itemIndex, "");
    if (typeof raw === "string")
        return raw;
    if (raw === null || raw === undefined)
        return "";
    if (typeof raw === "number" || typeof raw === "boolean" || typeof raw === "bigint")
        return String(raw);
    throw new n8n_workflow_1.NodeOperationError(node, `${fieldName} received ${Array.isArray(raw) ? "an array" : `a ${typeof raw}`} instead of text.`, {
        itemIndex,
        description: `Point the expression at the field that holds the text — for example ` +
            `{{ $json.message }} rather than {{ $json }}. The node will not scan a JSON dump and ` +
            `call the result checked.`,
    });
}
function readActionRequest(ctx, node, itemIndex, nodeVersion, action) {
    const request = {
        action,
        itemIndex,
        projectId: ctx.getNodeParameter("projectId", itemIndex, "") || undefined,
        metadata: buildMetadata(node, ctx.getNodeParameter("metadata", itemIndex, ""), nodeVersion >= 2 ? ctx.getNodeParameter("sessionId", itemIndex, "") : ""),
        text: "",
        onThreat: "BLOCK",
        profile: "MAXIMUM",
    };
    switch (action) {
        case "analyzeText":
            request.text = readText(ctx, node, "inputText", itemIndex, "Input Text");
            request.onThreat = "WARN";
            break;
        case "inputGuard":
            request.text = readText(ctx, node, "inputText", itemIndex, "Input Text");
            request.onThreat = ctx.getNodeParameter("onThreat", itemIndex);
            request.allowedTopics = splitList(ctx.getNodeParameter("allowedTopics", itemIndex, ""));
            request.systemPromptContext = readText(ctx, node, "systemPromptContext", itemIndex, "System Prompt Context");
            break;
        case "universalGuard":
            request.text = readText(ctx, node, "inputText", itemIndex, "Input Text");
            request.onThreat = ctx.getNodeParameter("onThreat", itemIndex);
            request.profile = ctx.getNodeParameter("protectionProfile", itemIndex);
            request.aiOutputText = readText(ctx, node, "universalOutputText", itemIndex, "AI Output Text");
            request.allowedTopics = splitList(ctx.getNodeParameter("allowedTopics", itemIndex, ""));
            request.systemPromptContext = readText(ctx, node, "systemPromptContext", itemIndex, "System Prompt Context");
            request.securityContext = readSecurityContext(ctx, node, itemIndex, nodeVersion);
            break;
        case "outputGuard":
            request.text = readText(ctx, node, "outputText", itemIndex, "AI Output Text");
            request.onThreat = ctx.getNodeParameter("onThreat", itemIndex);
            break;
        case "piiRedactor":
            request.text = readText(ctx, node, "piiText", itemIndex, "Text");
            break;
        case "ragScanner":
            request.text = readText(ctx, node, "ragText", itemIndex, "Document Text");
            request.documentId = readText(ctx, node, "documentId", itemIndex, "Document ID");
            request.documentSource = readText(ctx, node, "documentSource", itemIndex, "Document Source");
            break;
        case "workflowAudit":
            request.workflowJson = readText(ctx, node, "workflowJson", itemIndex, "Workflow JSON");
            break;
        default:
            throw new n8n_workflow_1.NodeOperationError(node, `Unknown action: ${action}`, { itemIndex });
    }
    return request;
}
/**
 * Identity of an item for within-execution reuse. Two items that would send a
 * byte-identical request get one answer, which is the difference between paying
 * for 500 calls and paying for the 12 distinct messages a deduplicated batch
 * actually contains. Every field that can change a verdict is in the key.
 */
function reuseKey(request) {
    return JSON.stringify([
        request.action,
        request.text,
        request.aiOutputText ?? "",
        request.onThreat,
        request.profile,
        request.projectId ?? "",
        request.documentId ?? "",
        request.documentSource ?? "",
        request.allowedTopics ?? [],
        request.systemPromptContext ?? "",
        request.workflowJson ?? "",
        request.securityContext ?? null,
        request.metadata ?? null,
    ]);
}
async function executeSoterGuard() {
    const items = this.getInputData();
    const node = this.getNode();
    // Version 1 published a single output. Routing is gated on the saved
    // typeVersion rather than on a parameter so an existing workflow keeps
    // receiving every item on output 0, including the ones it chose to let
    // through with Warn or Continue.
    const branchOutputs = (node.typeVersion ?? 1) >= 2;
    const nodeVersion = node.typeVersion ?? 1;
    // "Action" is noDataExpression, so it is one fixed value for the whole node.
    // Read it from the saved parameters when there is no item to read it against,
    // so the number of returned branches always matches the number of outputs the
    // canvas is drawing, even for an empty input batch.
    const nodeAction = items.length > 0
        ? this.getNodeParameter("action", 0)
        : (node.parameters?.action ?? "inputGuard");
    const shapeOutputs = (safe, flagged) => !branchOutputs || outputCountForAction(nodeAction) === 1 ? [safe] : [safe, flagged];
    if (items.length === 0)
        return shapeOutputs([], []);
    const options = readNodeOptions(this, 0);
    // Credentials are resolved lazily and exactly once. Audit n8n Workflow Security
    // never calls the API, and Local mode never calls it either, so demanding a key
    // before the first item is what made the node impossible to evaluate without an
    // account — and made a credential-less workflow fail on an action that needs no
    // credential.
    let clientPromise;
    const resolveClient = () => {
        if (!clientPromise) {
            clientPromise = (async () => {
                // The credential is optional on the node so Local mode and the audit can
                // run without one. That makes this the place where a Cloud-mode user with
                // no credential finds out, so the error has to name the fix rather than
                // surface n8n's generic "credentials not found".
                let credentials;
                try {
                    credentials = await this.getCredentials("soterApi");
                }
                catch {
                    throw new n8n_workflow_1.NodeOperationError(node, "This action needs a SoterAI credential, and none is selected.", {
                        description: ENGINE_LOCAL_HINT,
                    });
                }
                const apiKey = typeof credentials.apiKey === "string" ? credentials.apiKey.trim() : "";
                if (!apiKey) {
                    throw new n8n_workflow_1.NodeOperationError(node, "The selected SoterAI credential has no API key.", {
                        description: ENGINE_LOCAL_HINT,
                    });
                }
                return {
                    apiKey,
                    baseUrl: validateBaseUrl(node, credentials.baseUrl || "https://soterai.in"),
                    projectId: credentials.projectId || undefined,
                    timeoutMs: options.requestTimeoutMs,
                    includeRaw: options.includeRawResponse,
                };
            })();
        }
        return clientPromise;
    };
    const outcomes = new Array(items.length);
    const reuseCache = new Map();
    const runItem = async (i) => {
        try {
            const action = this.getNodeParameter("action", i);
            const request = readActionRequest(this, node, i, nodeVersion, action);
            const key = options.reuseIdenticalItems ? reuseKey(request) : undefined;
            let hit = key ? reuseCache.get(key) : undefined;
            if (!hit) {
                // The promise is cached *before* it is awaited, so duplicates that are
                // already in flight wait for this call instead of starting their own.
                // Caching the settled result only ever caught duplicates that arrived
                // after the first answer came back, which at any concurrency above 1 is
                // the minority of them.
                const started = { promise: runAction(this, node, options, resolveClient, request), itemIndex: i };
                if (key)
                    reuseCache.set(key, started);
                hit = started;
            }
            const result = await hit.promise;
            if (hit.itemIndex === i) {
                outcomes[i] = { json: result, flagged: isFlagged(action, result) };
                return;
            }
            // Marked, not hidden. A reader comparing two items with one incident id
            // between them needs to know why, and a reused answer is still an answer
            // about this item's text — it is the same text.
            const reused = { ...result, reusedResult: true, reusedFromItemIndex: hit.itemIndex };
            outcomes[i] = { json: reused, flagged: isFlagged(action, reused) };
        }
        catch (error) {
            if (this.continueOnFail()) {
                // An item whose check never completed has not been cleared by anything,
                // so it leaves through Flagged rather than Safe. Sending it down the
                // Safe branch would turn an API outage into a silent bypass.
                outcomes[i] = {
                    json: {
                        error: true,
                        message: sanitizeErrorMessage(error instanceof Error ? error.message : "SoterAI request failed."),
                    },
                    flagged: true,
                };
                return;
            }
            throw new n8n_workflow_1.NodeOperationError(node, error, { itemIndex: i });
        }
    };
    await runWithConcurrency(items.length, options.batchConcurrency, runItem);
    const safeItems = [];
    const flaggedItems = [];
    for (let i = 0; i < items.length; i++) {
        const outcome = outcomes[i];
        if (!outcome)
            continue;
        const entry = { json: outcome.json, pairedItem: { item: i } };
        if (branchOutputs && outcome.flagged)
            flaggedItems.push(entry);
        else
            safeItems.push(entry);
    }
    return shapeOutputs(safeItems, flaggedItems);
}
/**
 * Chooses the engine for one item and runs it.
 *
 * Auto is the only mode that switches, and it switches on one rule: the local
 * engine answers when the cloud engine could not be *asked*. A transient network
 * or server failure, an exhausted rate-limit window, or a missing credential all
 * mean the question never reached the API, and a weaker answer beats no answer.
 * A refused question — bad key, disabled endpoint, invalid payload — is reported,
 * because quietly downgrading it would hide the configuration error that caused it.
 */
async function runAction(ctx, node, options, resolveClient, request) {
    // The workflow audit is static analysis of JSON the user pasted in. It has
    // never needed the API, and it must not be gated behind a credential.
    if (request.action === "workflowAudit") {
        const audit = executeWorkflowAudit(node, request.workflowJson ?? "");
        audit.engine = "local";
        audit.engineDegraded = false;
        return audit;
    }
    if (options.engine === "LOCAL") {
        return stampLocalEngine(runLocalAction(node, options, request), null);
    }
    let client;
    try {
        client = await resolveClient();
    }
    catch (error) {
        if (options.engine !== "AUTO")
            throw asNodeError(node, error);
        return stampLocalEngine(runLocalAction(node, options, request), `No usable SoterAI credential: ${sanitizeErrorMessage(error instanceof Error ? error.message : "credential unavailable")}`);
    }
    try {
        const result = await runCloudAction(ctx, node, options, client, request);
        result.engine = "cloud";
        result.engineDegraded = false;
        return result;
    }
    catch (error) {
        if (options.engine !== "AUTO" || !isTransientApiError(error))
            throw asNodeError(node, error);
        return stampLocalEngine(runLocalAction(node, options, request), `The SoterAI API could not be reached, so this item was checked locally instead: ${sanitizeErrorMessage(error instanceof Error ? error.message : "request failed")}`);
    }
}
/**
 * Attaches what the local engine is and what it cannot do to the result itself.
 *
 * A weaker check that does not say it is weaker is the failure mode this whole
 * mode has to avoid: a workflow author reading `blocked: false` has no way to
 * know whether an ML classifier cleared the item or a regex did.
 */
function stampLocalEngine(result, fallbackReason) {
    result.engine = "local";
    result.engineDegraded = fallbackReason !== null;
    result.engineDetail = {
        version: localEngine_1.LOCAL_ENGINE_VERSION,
        ruleCount: localEngine_1.LOCAL_RULE_COUNT,
        limitations: localEngine_1.LOCAL_ENGINE_LIMITATIONS,
        ...(fallbackReason ? { fellBackFromCloud: fallbackReason } : {}),
    };
    return result;
}
async function runCloudAction(ctx, node, options, client, request) {
    const projectId = request.projectId || client.projectId;
    let result;
    switch (request.action) {
        case "analyzeText": {
            result = await executeInputGuard(ctx, client, {
                text: request.text,
                projectId,
                onThreat: "WARN",
                metadata: request.metadata,
            });
            result.operation = "analyzeText";
            result.outputText = result.safeText;
            break;
        }
        case "inputGuard": {
            result = await executeInputGuard(ctx, client, {
                text: request.text,
                projectId,
                onThreat: request.onThreat,
                metadata: request.metadata,
                allowedTopics: request.allowedTopics,
                systemPromptContext: request.systemPromptContext,
            });
            result.operation = "inputGuard";
            break;
        }
        case "universalGuard": {
            const context = request.securityContext ?? {};
            result = await executeUniversalGuard(ctx, options, client, {
                text: request.text,
                projectId,
                onThreat: request.onThreat,
                metadata: request.metadata,
                allowedTopics: request.allowedTopics,
                systemPromptContext: request.systemPromptContext,
                profile: request.profile,
                aiOutputText: request.aiOutputText,
                ragText: context.rag?.text,
                ragDocumentId: context.rag?.documentId,
                ragSource: context.rag?.source,
                tool: context.tool,
                memory: context.memory,
                outputDestinationType: context.output?.destinationType,
                outputDestinationName: context.output?.destinationName,
                protectedSources: context.output?.protectedSources,
            });
            result.operation = "universalGuard";
            break;
        }
        case "outputGuard": {
            result = await executeOutputGuard(ctx, client, {
                text: request.text,
                projectId,
                onThreat: request.onThreat,
                metadata: request.metadata,
            });
            result.operation = "outputGuard";
            break;
        }
        case "piiRedactor": {
            result = await executePiiRedactor(ctx, client, {
                text: request.text,
                projectId,
                metadata: request.metadata,
            });
            result.operation = "piiRedactor";
            break;
        }
        case "ragScanner": {
            result = await executeRagScanner(ctx, client, {
                text: request.text,
                projectId,
                documentId: request.documentId ?? "",
                source: request.documentSource ?? "api",
                metadata: request.metadata,
            });
            result.operation = "ragScanner";
            break;
        }
        default:
            throw new n8n_workflow_1.NodeOperationError(node, `Unknown action: ${request.action}`, { itemIndex: request.itemIndex });
    }
    return result;
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
 * The full upstream payload, sanitized, unless the user turned it off.
 *
 * It stays on by default because it is the only way to see a field the node does
 * not surface yet, but it can double or triple the size of an item, and a
 * thousand-item batch pinned in an execution log is a real cost. Turning it off
 * removes the key entirely rather than emitting an empty object, so an
 * expression can tell "not requested" from "the server returned nothing".
 */
function rawResponseFields(client, raw) {
    return client.includeRaw ? { rawResponse: sanitizeOutputObject(raw) } : {};
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
async function soterPost(ctx, client, path, body) {
    const url = `${client.baseUrl.replace(/\/$/, "")}${path}`;
    for (let attempt = 0;; attempt++) {
        let response;
        try {
            response = await ctx.helpers.httpRequest({
                method: "POST",
                url,
                headers: {
                    "Content-Type": "application/json",
                    "x-api-key": client.apiKey,
                    "User-Agent": USER_AGENT,
                },
                body: body,
                json: true,
                timeout: client.timeoutMs,
                returnFullResponse: true,
                ignoreHttpStatusErrors: true,
            });
        }
        catch (error) {
            // The request never got an answer: DNS, TLS, a refused connection, a
            // timeout. Nothing here says the request was wrong, so Auto mode may
            // answer it with the local engine.
            throw tagTransient(new n8n_workflow_1.NodeApiError(ctx.getNode(), error, {
                message: `SoterAI API request to ${path} failed. Check the Base URL and network access.`,
            }));
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
            const error = new n8n_workflow_1.NodeApiError(ctx.getNode(), data, {
                message: formatApiError(statusCode, data, path),
                httpCode: String(statusCode),
            });
            // A server fault or an exhausted rate-limit window is about capacity, not
            // about this request. A 4xx other than 429 is about this request — the key,
            // the plan, or the payload — and must surface instead of being answered by
            // a weaker engine.
            if (statusCode >= 500 || statusCode === 429 || statusCode === 408 || statusCode === 0)
                tagTransient(error);
            throw error;
        }
        return data;
    }
}
async function executeInputGuard(ctx, client, params) {
    validateText(ctx.getNode(), params.text, "Input Text");
    const meta = { ...params.metadata };
    if (params.projectId)
        meta.projectId = params.projectId;
    const raw = await soterPost(ctx, client, "/api/guard/input", {
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
        ...rawResponseFields(client, raw),
    };
    annotateThrottle(result, raw);
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
async function executeOutputGuard(ctx, client, params) {
    validateText(ctx.getNode(), params.text, "AI Output Text");
    const meta = { ...params.metadata };
    if (params.projectId)
        meta.projectId = params.projectId;
    const raw = await soterPost(ctx, client, "/api/guard/output", {
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
        ...rawResponseFields(client, raw),
    };
    annotateThrottle(result, raw);
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
// The check endpoint accepts at most 50 source ids per request, so the node
// stops at the same number rather than letting the API reject the whole call.
const MAX_PROTECTED_SOURCES = 50;
const SEMANTIC_SENSITIVITY_LEVELS = ["PUBLIC", "INTERNAL", "PRIVATE", "CONFIDENTIAL", "SECRET", "REGULATED", "SYSTEM_PROMPT"];
/**
 * "Protected Sources" is confidential data by definition, so an unspecified or
 * unrecognised level is treated as CONFIDENTIAL rather than passed through — an
 * unrecognised value fails the request schema and would take the whole egress
 * check down with it.
 */
function normalizeSensitivity(value) {
    const level = typeof value === "string" ? value.trim().toUpperCase() : "";
    return SEMANTIC_SENSITIVITY_LEVELS.includes(level) ? level : "CONFIDENTIAL";
}
/**
 * Turns the Protected Sources field into the `sourceIds` the egress check
 * actually accepts, registering any source that was supplied with its content.
 *
 * The node used to send the array as `sources`, a key the request schema does
 * not define. Zod strips unknown keys, so the field silently became
 * `sourceIds: []` and the egress check compared the AI output against nothing at
 * all — the layer reported a clean result while doing no comparison. Sources
 * also have to exist before they can be referenced (the check loads them by id
 * from the project's fingerprint table), so an inline snapshot is fingerprinted
 * first and only its id travels with the check.
 */
async function registerProtectedSources(ctx, client, sources, meta) {
    const sourceIds = [];
    const registeredSources = [];
    const skippedSources = [];
    for (const entry of sources.slice(0, MAX_PROTECTED_SOURCES)) {
        // A bare string is a source already registered against the project.
        if (typeof entry === "string") {
            const id = entry.trim();
            if (id)
                sourceIds.push(id);
            else
                skippedSources.push("(empty string)");
            continue;
        }
        if (!isRecord(entry)) {
            skippedSources.push(`(${typeof entry})`);
            continue;
        }
        const id = stringValue(entry.sourceId) ?? stringValue(entry.id) ?? stringValue(entry.name);
        if (!id) {
            skippedSources.push("(entry with no id)");
            continue;
        }
        const content = stringValue(entry.content) ?? stringValue(entry.text);
        if (!content) {
            // No snapshot to fingerprint: assume the caller registered it already.
            sourceIds.push(id);
            continue;
        }
        await soterPost(ctx, client, "/api/semantic-egress/source/fingerprint", {
            sourceId: id,
            sourceType: stringValue(entry.sourceType) ?? "n8n-workflow",
            sensitivityLevel: normalizeSensitivity(entry.sensitivityLevel),
            content,
            metadata: meta,
        });
        sourceIds.push(id);
        registeredSources.push(id);
    }
    // Named rather than dropped. A silently truncated source list is the same
    // failure as the silently ignored one this function exists to fix.
    if (sources.length > MAX_PROTECTED_SOURCES) {
        skippedSources.push(`${sources.length - MAX_PROTECTED_SOURCES} source(s) beyond the ${MAX_PROTECTED_SOURCES}-source API limit`);
    }
    return { sourceIds, registeredSources, skippedSources };
}
/**
 * Runs one optional Universal AI Firewall layer without letting its failure end
 * the item.
 *
 * The layers are independent checks of different things, and only the input
 * guard is mandatory. When an optional endpoint is missing from a deployment,
 * disabled for the key's plan, or gated by middleware, the honest outcome is
 * "this layer was not checked" — not the loss of the five layers that did run.
 * A failed layer never becomes a decision: `decideUniversal` is given only the
 * layers that answered, and the item is routed to Flagged because something in
 * it went unverified.
 *
 * In Auto mode a `localFallback` turns that unchecked layer into a locally
 * checked one. The result is tagged with the engine that produced it and keeps
 * the cloud error, so "this layer was answered by the rule engine because the
 * endpoint 401'd" stays readable — but the layer does count as evaluated, because
 * something did actually inspect it.
 */
async function optionalLayer(layer, hint, run, localFallback) {
    try {
        return { layer, ...(await run()) };
    }
    catch (error) {
        const message = sanitizeErrorMessage(error instanceof Error ? error.message : `The ${layer} layer could not be checked.`);
        if (localFallback) {
            return {
                layer,
                ...localFallback(),
                engine: "local",
                engineDegraded: true,
                cloudError: message,
                hint,
            };
        }
        return {
            layer,
            unavailable: true,
            error: message,
            hint,
        };
    }
}
// Passport verdicts that are about enrollment, not about the item's content.
const PASSPORT_CONFIG_POLICY_IDS = ["passport.session_missing", "passport.unknown"];
const PASSPORT_ENROLLMENT_HINT = "The tool check enforces zero-trust agent identity before it looks at the tool call, so it needs an " +
    "enrolled agent session: POST /api/agent/identity/create, then POST /api/agent/passport/issue with " +
    "that identity and this node's Session ID. Until that exists the layer reports an enrollment gap " +
    "instead of a verdict — remove the Tool Call layer from Security Context if you do not use passports.";
/**
 * `/api/agent/tool/check` answers HTTP 200 with decision BLOCK / riskLevel
 * CRITICAL when the session has no passport. That is a correct answer to the
 * question the endpoint was asked — it fails closed — but it is an answer about
 * enrollment, and reporting it as a content verdict makes every item in the
 * workflow look like a critical attack no matter what it says. The layer stays
 * non-allowing (it is excluded from the verdict, and its presence flags the
 * item) and is relabelled for what it is.
 */
function annotatePassportGap(check) {
    const matches = Array.isArray(check.policyMatches) ? check.policyMatches : [];
    const gap = matches.some((match) => isRecord(match) && typeof match.id === "string" && PASSPORT_CONFIG_POLICY_IDS.includes(match.id));
    if (!gap)
        return check;
    return {
        ...check,
        unavailable: true,
        configurationRequired: true,
        error: `The Tool Call layer was not evaluated: ${stringValue(check.reason) ?? "the agent session has no passport"}`,
        hint: PASSPORT_ENROLLMENT_HINT,
    };
}
/**
 * Runs the optional layers, either all at once or one after another.
 *
 * They are independent checks of different things — a document, a tool call, a
 * memory write, the model's answer — so nothing about them requires an order.
 * Running them together turns up to five sequential round trips into one, which
 * on a real deployment is the difference between roughly three seconds an item
 * and roughly six hundred milliseconds. The sequential path stays available for
 * deployments on a tight per-minute rate limit, where five simultaneous calls
 * per item is the thing that trips it.
 */
async function runLayers(runs, parallel) {
    if (parallel)
        return Promise.all(runs.map((run) => run()));
    const results = [];
    for (const run of runs) {
        results.push(await run());
    }
    return results;
}
async function executeUniversalGuard(ctx, options, client, params) {
    validateText(ctx.getNode(), params.text, "Input Text");
    const meta = {
        ...params.metadata,
        soteraiNodeMode: "universalGuard",
        protectionProfile: params.profile,
    };
    if (params.projectId)
        meta.projectId = params.projectId;
    // Auto mode is the only mode allowed to answer a layer with the local engine.
    // In Cloud mode an unavailable layer stays unavailable, because the user asked
    // for the cloud engine and needs to see that part of it did not run.
    const auto = options.engine === "AUTO";
    const checks = [];
    // The input guard is the one mandatory layer, so it is deliberately not
    // wrapped: if it cannot run, nothing has inspected the item and the node must
    // fail loudly rather than emit a partial verdict.
    const input = await executeInputGuard(ctx, client, {
        text: params.text,
        projectId: params.projectId,
        onThreat: "WARN",
        metadata: meta,
        allowedTopics: params.allowedTopics,
        systemPromptContext: params.systemPromptContext,
    });
    checks.push({ layer: "input", ...input });
    const layerRuns = [];
    if (params.ragText?.trim()) {
        const documentId = params.ragDocumentId?.trim() || `n8n-${Date.now()}`;
        const source = params.ragSource || "api";
        layerRuns.push(() => optionalLayer("rag", "Check that /api/rag/document/trust-score is available on the deployment at your Base URL and enabled for this key's plan.", () => executeRagScanner(ctx, client, {
            text: params.ragText,
            projectId: params.projectId,
            documentId,
            source,
            metadata: meta,
        }), auto ? () => (0, localEngine_1.scoreRagDocumentLocal)(params.ragText, documentId, source) : undefined));
    }
    if (params.tool) {
        // Name and action are configuration, not content: an incomplete Tool Call
        // layer is a mistake in the node, and no engine can guess what was meant.
        if (!params.tool.name.trim())
            throw new n8n_workflow_1.NodeOperationError(ctx.getNode(), "Tool Name is required when a Tool Call layer is added to Security Context.");
        if (!params.tool.action.trim())
            throw new n8n_workflow_1.NodeOperationError(ctx.getNode(), "Tool Action is required when a Tool Call layer is added to Security Context.");
        const tool = params.tool;
        const localToolCheck = () => (0, localEngine_1.checkToolCallLocal)({
            name: tool.name,
            action: tool.action,
            destination: tool.destination,
            target: tool.target,
            content: tool.content || params.text,
            riskContext: tool.riskContext,
        });
        const sessionId = typeof meta.sessionId === "string" ? meta.sessionId.trim() : "";
        if (!sessionId) {
            // Caught here rather than at the API, which would answer BLOCK / CRITICAL
            // for a missing sessionId and leave the author reading it as a threat. In
            // Auto mode there is a better answer than an error: check the payload with
            // the local engine and say plainly that the identity half did not run.
            if (!auto) {
                throw new n8n_workflow_1.NodeOperationError(ctx.getNode(), "A Tool Call layer needs a Session ID.", {
                    description: PASSPORT_ENROLLMENT_HINT,
                });
            }
            layerRuns.push(async () => ({
                layer: "tool",
                ...localToolCheck(),
                engine: "local",
                engineDegraded: true,
                cloudError: "No Session ID is set, so the passport-enforcing cloud tool check could not be called.",
                hint: PASSPORT_ENROLLMENT_HINT,
            }));
        }
        else {
            layerRuns.push(async () => {
                const cloudTool = annotatePassportGap(await optionalLayer("tool", "Check that /api/agent/tool/check is available on the deployment at your Base URL and enabled for this key's plan.", () => soterPost(ctx, client, "/api/agent/tool/check", {
                    sessionId,
                    agentName: typeof meta.agentName === "string" ? meta.agentName : "n8n-agent",
                    tool: tool.name,
                    action: tool.action,
                    target: tool.target || undefined,
                    content: tool.content || params.text,
                    destination: tool.destination,
                    riskContext: tool.riskContext,
                    metadata: meta,
                }), auto ? localToolCheck : undefined));
                // An enrollment gap is a 200 response, not a thrown error, so
                // optionalLayer's fallback never fires for it. Auto mode still has a
                // useful answer available, so it uses it.
                if (auto && cloudTool.unavailable === true) {
                    return {
                        layer: "tool",
                        ...localToolCheck(),
                        engine: "local",
                        engineDegraded: true,
                        cloudError: stringValue(cloudTool.error) ?? "The cloud tool check reported an enrollment gap instead of a verdict.",
                        hint: PASSPORT_ENROLLMENT_HINT,
                    };
                }
                return cloudTool;
            });
        }
    }
    if (params.memory) {
        const memory = params.memory;
        layerRuns.push(() => optionalLayer("memory", "Check that /api/agent/memory/check is available on the deployment at your Base URL and enabled for this key's plan.", () => soterPost(ctx, client, "/api/agent/memory/check", {
            sessionId: typeof meta.sessionId === "string" ? meta.sessionId : undefined,
            memoryAction: memory.action,
            content: memory.content || params.text,
            memoryType: memory.memoryType || "custom",
        }), auto
            ? () => localLayerFromAnalysis((0, localEngine_1.analyzeLocal)(memory.content || params.text, "INPUT"), "Checked by the local rule engine for poisoning, secrets and personal data in the memory write.")
            : undefined));
    }
    if (params.aiOutputText?.trim()) {
        const aiOutputText = params.aiOutputText;
        layerRuns.push(() => optionalLayer("output", "Check that /api/guard/output is available on the deployment at your Base URL.", () => executeOutputGuard(ctx, client, {
            text: aiOutputText,
            projectId: params.projectId,
            onThreat: "WARN",
            metadata: meta,
        }), auto
            ? () => localGuardResult({
                analysis: (0, localEngine_1.analyzeLocal)(aiOutputText, "OUTPUT"),
                direction: "output",
                originalText: aiOutputText,
                onThreat: "WARN",
                includeRaw: client.includeRaw,
            })
            : undefined));
        // Only offered when at least one source arrived with its text. Comparing an
        // output against zero sources and reporting ALLOW is the exact false-clean
        // shape the sourceIds fix existed to remove, so the layer stays unavailable
        // instead of pretending to have compared something.
        const inlineSources = toLocalEgressSources(params.protectedSources ?? []);
        const canCompareLocally = auto && inlineSources.some((source) => Boolean(source.content));
        layerRuns.push(() => optionalLayer("semanticEgress", "Check that /api/semantic-egress/check is available on the deployment at your Base URL and enabled for this key's plan. " +
            "A 401 here while the other layers succeed points at the endpoint, not at the API key.", async () => {
            // Registration happens inside the layer so a failure to fingerprint a
            // source degrades this one layer instead of the whole item.
            const sources = await registerProtectedSources(ctx, client, params.protectedSources ?? [], meta);
            const egress = await soterPost(ctx, client, "/api/semantic-egress/check", {
                sessionId: typeof meta.sessionId === "string" ? meta.sessionId : undefined,
                content: aiOutputText,
                destinationType: params.outputDestinationType || "FINAL_OUTPUT",
                destinationName: params.outputDestinationName || undefined,
                sourceIds: sources.sourceIds,
                metadata: meta,
            });
            return {
                ...egress,
                comparedSourceIds: sources.sourceIds,
                ...(sources.registeredSources.length ? { registeredSources: sources.registeredSources } : {}),
                ...(sources.skippedSources.length ? { skippedSources: sources.skippedSources } : {}),
            };
        }, canCompareLocally ? () => (0, localEngine_1.compareEgressLocal)(aiOutputText, inlineSources) : undefined));
    }
    checks.push(...(await runLayers(layerRuns, options.parallelLayers)));
    let outputText = params.aiOutputText?.trim() ? params.aiOutputText : input.outputText || params.text;
    const outputLayer = checks.find((check) => check.layer === "output");
    if (outputLayer && outputLayer.unavailable !== true) {
        outputText = outputLayer.outputText || params.aiOutputText || outputText;
    }
    return finalizeUniversalGuard({
        checks,
        profile: params.profile,
        onThreat: params.onThreat || "BLOCK",
        text: params.text,
        aiOutputText: params.aiOutputText,
        outputText,
    });
}
/**
 * Turns the layer results into the single verdict the node emits.
 *
 * Shared by both engines on purpose: the cloud and local firewalls disagree about
 * how good their answers are, but they must not disagree about the *shape* of the
 * answer, or a workflow that branches on `finalDecision` would break the moment
 * it fell back.
 */
function finalizeUniversalGuard(input) {
    const { checks } = input;
    // A layer that never answered is not a layer that passed. Only the layers that
    // returned a verdict feed the decision, the attribution, and the categories;
    // the ones that failed are reported separately and flag the item instead.
    const evaluated = checks.filter((check) => check.unavailable !== true);
    const degradedLayers = checks.filter((check) => check.unavailable === true).map((check) => String(check.layer));
    // Layers a weaker engine answered. Not degraded — something did inspect them —
    // but a reader deciding how much to trust an ALLOW needs to know which engine
    // produced each part of it.
    const locallyCheckedLayers = evaluated
        .filter((check) => check.engine === "local" && check.engineDegraded === true)
        .map((check) => String(check.layer));
    const final = decideUniversal(evaluated, input.profile);
    const safeText = firstString(evaluated, ["safeText", "safeContent", "contentRedacted"]) || input.outputText;
    // Attribution comes from whichever layer actually drove the verdict, not from
    // the first layer that happened to run — otherwise `primaryRiskType` would say
    // "input" on a run that was decided by the egress check. Scored through
    // `scoreFromCheck` rather than off a raw `riskScore` field, because the RAG
    // layer reports a *trust* score, where higher is better: read literally it
    // scored 0 and could never be named as the driving layer, however poisoned the
    // document was.
    const drivingLayer = evaluated.reduce((worst, check) => (scoreFromCheck(check) > scoreFromCheck(worst) ? check : worst), evaluated[0]);
    const enforced = enforceUniversalDecision({
        decision: final.decision,
        onThreat: input.onThreat,
        originalText: input.aiOutputText?.trim() ? input.aiOutputText : input.text,
        safeText,
    });
    const categories = collectCategories(evaluated);
    return {
        operation: "universalGuard",
        protectionProfile: input.profile,
        allowed: final.decision === "ALLOW" || final.decision === "REDACT" || final.decision === "REVIEW",
        blocked: enforced.blocked,
        // Reported apart from `blocked` on purpose: the item was not stopped by a
        // verdict, but part of it was never inspected, and those are different facts
        // for anyone reading the run afterwards.
        degraded: degradedLayers.length > 0,
        degradedLayers,
        fullyChecked: degradedLayers.length === 0,
        ...(locallyCheckedLayers.length ? { locallyCheckedLayers } : {}),
        throttled: checks.some((check) => check.throttled === true),
        needsHumanReview: final.decision === "ASK_APPROVAL",
        liveChatAction: final.decision === "ASK_APPROVAL" ? "SAFE_REPHRASE" : final.decision,
        finalDecision: final.decision,
        riskLevel: final.riskLevel,
        riskScore: final.riskScore,
        categories,
        primaryRiskType: drivingLayer?.primaryRiskType ?? null,
        categoryConfidence: drivingLayer?.categoryConfidence ?? {},
        drivingLayer: drivingLayer?.layer ?? null,
        reason: degradedLayers.length
            ? `${final.reason} Not checked: ${degradedLayers.join(", ")}.`
            : final.reason,
        userMessage: buildUserFacingMessage({
            allowed: final.decision === "ALLOW" || final.decision === "REVIEW",
            direction: input.aiOutputText?.trim() ? "output" : "input",
            action: final.decision,
            categories,
        }),
        developerMessage: buildDeveloperMessage({
            allowed: final.decision === "ALLOW" || final.decision === "REVIEW",
            direction: "workflow",
            reason: final.reason,
            riskScore: final.riskScore,
            categories,
        }),
        outputText: enforced.outputText,
        safeText,
        recommendedAction: final.recommendedAction,
        safeRephrasePrompt: final.decision === "ASK_APPROVAL" ? buildSafeRephrasePrompt(categories) : "",
        checks,
    };
}
// ---------------------------------------------------------------------------
// Local engine runners
//
// These produce the same result shape as the cloud runners above. That is the
// whole contract: a workflow written against Cloud mode keeps working when it
// runs on the local engine, and the only difference visible downstream is the
// `engine` field and the limitations attached to it.
// ---------------------------------------------------------------------------
const LOCAL_SEVERITY_SCORE = { CRITICAL: 92, HIGH: 72, MEDIUM: 42, LOW: 15 };
function runLocalAction(node, options, request) {
    switch (request.action) {
        case "analyzeText": {
            validateText(node, request.text, "Input Text");
            const result = localGuardResult({
                analysis: (0, localEngine_1.analyzeLocal)(request.text, "INPUT"),
                direction: "input",
                originalText: request.text,
                onThreat: "WARN",
                includeRaw: options.includeRawResponse,
            });
            result.operation = "analyzeText";
            result.outputText = result.safeText;
            return result;
        }
        case "inputGuard": {
            validateText(node, request.text, "Input Text");
            const result = localGuardResult({
                analysis: (0, localEngine_1.analyzeLocal)(request.text, "INPUT"),
                direction: "input",
                originalText: request.text,
                onThreat: request.onThreat,
                includeRaw: options.includeRawResponse,
            });
            result.operation = "inputGuard";
            return result;
        }
        case "outputGuard": {
            validateText(node, request.text, "AI Output Text");
            const result = localGuardResult({
                analysis: (0, localEngine_1.analyzeLocal)(request.text, "OUTPUT"),
                direction: "output",
                originalText: request.text,
                onThreat: request.onThreat,
                includeRaw: options.includeRawResponse,
            });
            result.operation = "outputGuard";
            return result;
        }
        case "piiRedactor": {
            validateText(node, request.text, "Text");
            const redaction = (0, localEngine_1.redactLocal)(request.text);
            const worst = redaction.entities.reduce((score, entity) => Math.max(score, LOCAL_SEVERITY_SCORE[entity.severity] ?? 0), 0);
            const result = {
                operation: "piiRedactor",
                safeText: redaction.safeText,
                outputText: redaction.safeText,
                detectedEntities: redaction.entities,
                riskScore: worst,
                // Every redaction in this mode is the node's own work, by definition.
                clientSideRedaction: redaction.count > 0,
                throttled: false,
            };
            if (redaction.count > 0) {
                result.clientSideRedactedTypes = [...new Set(redaction.entities.map((entity) => entity.type))];
                result.clientSideRedactionCount = redaction.count;
            }
            return result;
        }
        case "ragScanner": {
            validateText(node, request.text, "Document Text");
            const documentId = (request.documentId ?? "").trim();
            if (!documentId) {
                throw new n8n_workflow_1.NodeOperationError(node, "Document ID is required for RAG risk summary.");
            }
            const scored = (0, localEngine_1.scoreRagDocumentLocal)(request.text, documentId, request.documentSource || "api");
            return { operation: "ragScanner", ...scored };
        }
        case "universalGuard":
            return runLocalUniversalGuard(node, options, request);
        default:
            throw new n8n_workflow_1.NodeOperationError(node, `Unknown action: ${request.action}`, { itemIndex: request.itemIndex });
    }
}
/**
 * Builds a guard result from a local analysis, field for field with the cloud
 * builder — including the On Threat enforcement, which is node behaviour rather
 * than engine behaviour and must not change with the engine.
 */
function localGuardResult(input) {
    const { analysis } = input;
    const action = normalizeDecision(analysis.action) ?? (analysis.allowed ? "ALLOW" : "BLOCK");
    const result = {
        allowed: analysis.allowed,
        action,
        rawAction: analysis.action,
        riskScore: analysis.riskScore,
        categories: analysis.riskTypes,
        safeText: analysis.safeText,
        reason: analysis.reason,
        userMessage: buildUserFacingMessage({
            allowed: analysis.allowed,
            direction: input.direction,
            action,
            categories: analysis.riskTypes,
        }),
        developerMessage: buildDeveloperMessage({
            allowed: analysis.allowed,
            direction: input.direction,
            reason: analysis.reason,
            riskScore: analysis.riskScore,
            categories: analysis.riskTypes,
        }),
        primaryRiskType: analysis.primaryRiskType,
        categoryConfidence: analysis.categoryConfidence,
        latencyMs: analysis.latencyMs,
        findings: analysis.findings,
        // No incident is recorded anywhere: nothing left the instance. Present and
        // null rather than absent, so an expression can tell that apart from an old
        // node version that never had the field.
        incidentId: null,
        // Reputation gating is a server-side facility, so a local verdict is always
        // a statement about this item's text.
        throttled: false,
        ...(input.includeRaw ? { rawResponse: sanitizeOutputObject(analysis) } : {}),
    };
    if (!analysis.allowed && input.onThreat) {
        switch (input.onThreat) {
            case "BLOCK":
                result.blocked = true;
                result.outputText = "";
                break;
            case "REDACT":
                result.blocked = false;
                result.outputText = analysis.redactedText || "[REDACTED]";
                break;
            case "WARN":
                result.blocked = false;
                result.outputText = input.originalText;
                result.warning = analysis.reason;
                break;
            case "CONTINUE":
                result.blocked = false;
                result.outputText = input.originalText;
                break;
        }
    }
    else {
        result.blocked = false;
        result.outputText = analysis.safeText || input.originalText;
    }
    return result;
}
/** A local analysis in the shape `toLayerDecision` reads for a firewall layer. */
function localLayerFromAnalysis(analysis, note) {
    return {
        decision: normalizeDecision(analysis.action) ?? (analysis.allowed ? "ALLOW" : "BLOCK"),
        allowed: analysis.allowed,
        riskScore: analysis.riskScore,
        riskLevel: riskLevelFromScore(analysis.riskScore),
        reason: analysis.reason,
        findings: analysis.findings,
        safeText: analysis.safeText,
        engineNote: note,
    };
}
/** Protected Sources entries that carry their own text, for the local comparison. */
function toLocalEgressSources(sources) {
    const mapped = [];
    for (const entry of sources.slice(0, MAX_PROTECTED_SOURCES)) {
        if (typeof entry === "string") {
            const id = entry.trim();
            if (id)
                mapped.push({ id });
            continue;
        }
        if (!isRecord(entry))
            continue;
        const id = stringValue(entry.sourceId) ?? stringValue(entry.id) ?? stringValue(entry.name);
        if (!id)
            continue;
        mapped.push({
            id,
            content: stringValue(entry.content) ?? stringValue(entry.text),
            sensitivity: normalizeSensitivity(entry.sensitivityLevel),
        });
    }
    return mapped;
}
function runLocalUniversalGuard(node, options, request) {
    validateText(node, request.text, "Input Text");
    const context = request.securityContext ?? {};
    const checks = [];
    const input = localGuardResult({
        analysis: (0, localEngine_1.analyzeLocal)(request.text, "INPUT"),
        direction: "input",
        originalText: request.text,
        onThreat: "WARN",
        includeRaw: options.includeRawResponse,
    });
    checks.push({ layer: "input", ...input });
    if (context.rag?.text?.trim()) {
        const scored = (0, localEngine_1.scoreRagDocumentLocal)(context.rag.text, context.rag.documentId?.trim() || `n8n-${Date.now()}`, context.rag.source || "api");
        checks.push({ layer: "rag", ...scored });
    }
    if (context.tool) {
        if (!context.tool.name.trim())
            throw new n8n_workflow_1.NodeOperationError(node, "Tool Name is required when a Tool Call layer is added to Security Context.");
        if (!context.tool.action.trim())
            throw new n8n_workflow_1.NodeOperationError(node, "Tool Action is required when a Tool Call layer is added to Security Context.");
        checks.push({
            layer: "tool",
            ...(0, localEngine_1.checkToolCallLocal)({
                name: context.tool.name,
                action: context.tool.action,
                destination: context.tool.destination,
                target: context.tool.target,
                content: context.tool.content || request.text,
                riskContext: context.tool.riskContext,
            }),
        });
    }
    if (context.memory) {
        checks.push({
            layer: "memory",
            ...localLayerFromAnalysis((0, localEngine_1.analyzeLocal)(context.memory.content || request.text, "INPUT"), "Checked by the local rule engine for poisoning, secrets and personal data in the memory write."),
        });
    }
    let outputText = request.aiOutputText?.trim() ? request.aiOutputText : input.outputText || request.text;
    if (request.aiOutputText?.trim()) {
        const output = localGuardResult({
            analysis: (0, localEngine_1.analyzeLocal)(request.aiOutputText, "OUTPUT"),
            direction: "output",
            originalText: request.aiOutputText,
            onThreat: "WARN",
            includeRaw: options.includeRawResponse,
        });
        checks.push({ layer: "output", ...output });
        outputText = output.outputText || request.aiOutputText;
        const sources = toLocalEgressSources(context.output?.protectedSources ?? []);
        if (sources.some((source) => Boolean(source.content))) {
            checks.push({
                layer: "semanticEgress",
                ...(0, localEngine_1.compareEgressLocal)(request.aiOutputText, sources),
            });
        }
        else if (sources.length > 0) {
            // Sources were configured but none of them can be compared here. Saying so
            // is the only honest option: a clean egress verdict that compared nothing
            // is worse than no egress verdict.
            checks.push({
                layer: "semanticEgress",
                unavailable: true,
                error: "Protected Sources were listed by id only, and resolving a source id needs the cloud fingerprint store.",
                hint: "Supply each source's text inline (`[{ \"sourceId\": \"handbook\", \"content\": \"...\" }]`) to compare it locally, or use Cloud or Auto mode.",
            });
        }
    }
    return finalizeUniversalGuard({
        checks,
        profile: request.profile,
        onThreat: request.onThreat || "BLOCK",
        text: request.text,
        aiOutputText: request.aiOutputText,
        outputText,
    });
}
/**
 * Tells reputation / rate-limit gating apart from a verdict about the item.
 *
 * Adaptive abuse escalation is fingerprint-wide, so a few blocked probes
 * anywhere on the API key can turn the *next* call — a different feature,
 * carrying no attack signal — into a block whose only finding is "Adaptive
 * abuse escalation". Reported as a content threat, that sends a workflow author
 * hunting for a problem that is not in their data, so the node names it for
 * what it is instead.
 */
function detectThrottle(raw) {
    const riskTypes = Array.isArray(raw.riskTypes) ? raw.riskTypes.map((type) => String(type)) : [];
    const findings = Array.isArray(raw.findings) ? raw.findings : [];
    const escalation = findings.find((finding) => typeof finding?.label === "string" && /adaptive abuse escalation|rate limit/i.test(finding.label));
    const metadata = isRecord(raw.metadata) ? raw.metadata : undefined;
    const attacker = metadata && isRecord(metadata.attacker) ? metadata.attacker : undefined;
    const level = typeof attacker?.level === "string" ? attacker.level : undefined;
    if (!riskTypes.includes("RATE_LIMIT") && !escalation)
        return { throttled: false, level };
    return {
        throttled: true,
        level,
        reason: "SoterAI gated this call on caller reputation rather than on the content of this item" +
            `${level ? ` (reputation level ${level})` : ""}. ` +
            "Reputation is tracked per API key and client IP across every endpoint, so earlier blocked " +
            "requests from the same credential — including ones from other workflows — raise it. The " +
            "verdict on this item is therefore not a statement about this item's text.",
    };
}
/**
 * Stamps every guard result with whether the verdict came from the content or
 * from the caller's reputation, so a workflow can branch on the difference —
 * `throttled` is always present, not only when it is true, because an expression
 * reading an absent field cannot tell "not throttled" from "old node version".
 */
function annotateThrottle(result, raw) {
    const throttle = detectThrottle(raw);
    result.throttled = throttle.throttled;
    if (!throttle.throttled)
        return;
    result.throttleLevel = throttle.level ?? null;
    result.throttleReason = throttle.reason ?? null;
    result.developerMessage = `${String(result.developerMessage ?? "")} ${throttle.reason ?? ""}`.trim();
}
async function executePiiRedactor(ctx, client, params) {
    validateText(ctx.getNode(), params.text, "Text");
    const meta = { ...params.metadata };
    if (params.projectId)
        meta.projectId = params.projectId;
    const raw = await soterPost(ctx, client, "/api/guard/input", {
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
    const throttle = detectThrottle(raw);
    const serverRedacted = typeof raw.safeText === "string" ? raw.safeText : typeof raw.redactedText === "string" ? raw.redactedText : undefined;
    // Fail closed. This action's whole contract is "the text you get back has the
    // identifiers removed", so the one thing it must never do is hand the original
    // text back under the name `safeText` — a downstream node cannot tell the
    // difference, and the workflow then ships unredacted data believing it is
    // clean. That is what happened whenever the server reported personal data but
    // returned no redacted copy, including when the call was gated on reputation
    // instead of analysed.
    if (serverRedacted === undefined && (piiEntities.length > 0 || throttle.throttled)) {
        throw new n8n_workflow_1.NodeOperationError(ctx.getNode(), throttle.throttled
            ? "SoterAI gated this redaction request instead of answering it, so no redacted text came back."
            : "SoterAI reported personal data in this item but returned no redacted copy of the text.", {
            description: throttle.throttled
                ? `${throttle.reason} The node will not present the original, unredacted text as safe. Retry once the ` +
                    "reputation window has decayed, or use a separate API key for high-volume redaction traffic."
                : "The node will not present the original, unredacted text as safe. Check that the redaction " +
                    "policy is enabled for this project on the SoterAI deployment at your Base URL.",
        });
    }
    const baseText = serverRedacted ?? params.text;
    const net = (0, localEngine_1.redactUsSsn)(baseText);
    const detectedEntities = [...piiEntities];
    if (net.count > 0) {
        detectedEntities.push({
            type: "PII_DETECTED",
            label: `US SSN-like identifier (redacted by the node, ${net.count === 1 ? "1 match" : `${net.count} matches`})`,
            severity: "HIGH",
        });
    }
    const result = {
        safeText: net.text,
        outputText: net.text,
        detectedEntities: detectedEntities,
        riskScore: raw.riskScore ?? 0,
        // Named for what it is: the node's own regex, not something the API found.
        // A deployment carrying the server-side SSN rule leaves this false because
        // the text arrives already redacted and the net finds nothing to do.
        clientSideRedaction: net.count > 0,
        ...rawResponseFields(client, raw),
    };
    if (net.count > 0) {
        result.clientSideRedactedTypes = ["US_SSN"];
        result.clientSideRedactionCount = net.count;
    }
    if (throttle.throttled) {
        result.throttled = true;
        result.throttleLevel = throttle.level ?? null;
        result.throttleReason = throttle.reason ?? null;
    }
    return result;
}
/**
 * Risk categories that describe an attack carried *by the document* against the
 * pipeline or the agent that will read it. A document like this cannot be made
 * safe by redaction, so no trust verdict may recommend indexing it.
 *
 * Mirrors RAG_DOCUMENT_THREAT_TYPES in lib/agent-firewall/mvp3.ts. Kept local
 * because the node is deliberately zero-dependency, the same way the workflow
 * audit is duplicated here.
 */
const RAG_DOCUMENT_THREAT_TYPES = [
    "PROMPT_INJECTION",
    "JAILBREAK",
    "SYSTEM_PROMPT_LEAK_ATTEMPT",
    "SYSTEM_PROMPT_LEAKAGE",
    "DATA_EXFILTRATION",
    "RECURSIVE_INJECTION",
    "MEMORY_POISONING",
    "MCP_TOOL_POISONING",
    "ADVANCED_SMUGGLING",
    "MULTIMODAL_INJECTION",
    "RAG_POISONING",
];
/**
 * Finds document-borne attack findings that are severe enough that "index this"
 * cannot be a correct answer, whatever the server's own verdict field says.
 */
function severeDocumentThreats(findings) {
    if (!Array.isArray(findings))
        return [];
    const severe = [];
    for (const finding of findings) {
        if (!finding || typeof finding !== "object")
            continue;
        const entry = finding;
        const type = typeof entry.type === "string" ? entry.type.toUpperCase() : "";
        const severity = typeof entry.severity === "string" ? entry.severity.toUpperCase() : "";
        if (severity !== "HIGH" && severity !== "CRITICAL")
            continue;
        if (!RAG_DOCUMENT_THREAT_TYPES.includes(type))
            continue;
        severe.push({
            type,
            label: typeof entry.label === "string" ? entry.label : type,
            severity,
        });
    }
    return severe;
}
async function executeRagScanner(ctx, client, params) {
    validateText(ctx.getNode(), params.text, "Document Text");
    if (!params.documentId.trim()) {
        throw new n8n_workflow_1.NodeOperationError(ctx.getNode(), "Document ID is required for RAG risk summary.");
    }
    const raw = await soterPost(ctx, client, "/api/rag/document/trust-score", {
        projectId: params.projectId,
        documentId: params.documentId,
        content: params.text,
        source: params.source,
        metadata: params.metadata,
    });
    const findings = raw.findings ?? [];
    const serverTrustLevel = raw.trustLevel ?? "NEEDS_REVIEW";
    const serverRecommendedAction = raw.recommendedAction ?? "REVIEW";
    // A verdict that reports a HIGH-severity injection and recommends INDEX in the
    // same response is self-contradictory, and the node is the last place that can
    // catch it: whatever lands in `recommendedAction` is what the workflow author
    // branches on, and `isFlagged` treats INDEX as safe. Older or unpatched
    // deployments can still answer that way, so the node refuses it rather than
    // trusting the field. Both original values are kept so the override is
    // auditable instead of silently rewriting the server's answer.
    const severe = severeDocumentThreats(findings);
    const contradictory = severe.length > 0 && isAllowishRecommendation(serverRecommendedAction);
    const result = {
        trustScore: contradictory ? Math.min(raw.trustScore ?? 0, 20) : raw.trustScore ?? 0,
        trustLevel: contradictory ? "QUARANTINED" : serverTrustLevel,
        findings,
        recommendedAction: contradictory ? "QUARANTINE" : serverRecommendedAction,
        ...rawResponseFields(client, raw),
    };
    if (contradictory) {
        result.verdictOverridden = true;
        result.serverTrustLevel = serverTrustLevel;
        result.serverRecommendedAction = serverRecommendedAction;
        result.overrideReason =
            `The document trust verdict said ${serverRecommendedAction} while reporting ` +
                `${severe.length} ${severe.length === 1 ? "finding" : "findings"} of severity HIGH or above ` +
                `(${severe.map((f) => `${f.type}: ${f.label}`).join("; ")}). ` +
                "The node quarantined it instead so a poisoned document cannot reach the vector store.";
    }
    return result;
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
    // `readText` normalizes every parameter this node reads, so a non-string here
    // means a caller reached the layer some other way. Saying so beats the
    // "text.trim is not a function" this used to raise.
    if (typeof text !== "string") {
        throw new n8n_workflow_1.NodeOperationError(node, `${fieldName} must be text, not ${text === null ? "null" : typeof text}.`);
    }
    if (!text || !text.trim()) {
        throw new n8n_workflow_1.NodeOperationError(node, `${fieldName} is required.`);
    }
    if (text.length > 200000) {
        throw new n8n_workflow_1.NodeOperationError(node, `${fieldName} is too large. Keep text under 200,000 characters per item.`);
    }
}
function formatApiError(status, data, path) {
    if (status === 401 || status === 403) {
        // Naming the endpoint is the whole point of this branch. The Universal AI
        // Firewall calls up to six paths per item, and when one of them 401s while
        // the rest succeed, "check the API key" sends the reader to the one thing
        // that is demonstrably fine — the key works everywhere else. A middleware
        // that session-gates an API-key-only route produces exactly this shape, and
        // it is invisible without the path.
        const where = path ? ` on ${path}` : "";
        const upstream = typeof data.message === "string" ? ` Server said: ${sanitizeErrorMessage(data.message)}` : "";
        return (`SoterAI API returned HTTP ${status}${where}. If other SoterAI calls in this workflow ` +
            "succeed with the same credential, the key itself is valid — check that this endpoint " +
            `exists on the deployment at your Base URL and is enabled for the key's plan.${upstream}`);
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
