"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.secureChatHandler = secureChatHandler;
exports.guardNextInput = guardNextInput;
exports.guardNextOutput = guardNextOutput;
exports.createGuardedRoute = createGuardedRoute;
const client_1 = require("./client");
const errors_1 = require("./errors");
function asMetadata(value) {
    if (!value || typeof value !== "object" || Array.isArray(value))
        return undefined;
    const out = {};
    for (const [key, raw] of Object.entries(value)) {
        if (typeof raw === "string" || typeof raw === "number" || typeof raw === "boolean" || raw === null) {
            out[key] = raw;
        }
    }
    return out;
}
/**
 * Returns a Next.js Route Handler that runs a chatbot turn through the input guard,
 * the consumer-provided LLM, and the output guard. Mount it under any POST route.
 */
function secureChatHandler(options) {
    if (!options.apiKey)
        throw new errors_1.CyberRakshakError("apiKey is required.", { code: "config_error" });
    if (typeof options.callLLM !== "function") {
        throw new errors_1.CyberRakshakError("callLLM is required.", { code: "config_error" });
    }
    const client = new client_1.CyberRakshakClient(options);
    const blockedReply = options.blockedResponse ?? "This request was blocked for security reasons.";
    const withholdReply = options.withholdResponse ?? "The response was withheld for safety.";
    return async function handler(request) {
        let parsed;
        try {
            parsed = (await request.json());
        }
        catch {
            return jsonResponse({ error: true, message: "Request body must be valid JSON." }, 400);
        }
        const message = typeof parsed.message === "string" ? parsed.message : "";
        if (!message.trim()) {
            return jsonResponse({ error: true, message: "message is required." }, 400);
        }
        try {
            const result = await client.secureChat({
                message,
                userId: typeof parsed.userId === "string" ? parsed.userId : undefined,
                sessionId: typeof parsed.sessionId === "string" ? parsed.sessionId : undefined,
                metadata: asMetadata(parsed.metadata),
                callLLM: options.callLLM,
                blockedResponse: blockedReply,
            });
            const reply = result.blocked && result.outputResult ? withholdReply : result.reply;
            return jsonResponse({
                reply,
                blocked: result.blocked,
                inputResult: stripOriginal(result.inputResult),
                outputResult: result.outputResult ? stripOriginal(result.outputResult) : undefined,
            }, 200);
        }
        catch (caught) {
            const status = caught.status ?? 500;
            const message = caught instanceof Error ? caught.message : "Secure chat failed.";
            return jsonResponse({ error: true, message }, status);
        }
    };
}
function stripOriginal(result) {
    const { ...rest } = result;
    return rest;
}
function jsonResponse(data, status) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
}
/**
 * Run a single request body through the input guard from inside a Next.js
 * Route Handler / Server Action. Returns the typed {@link GuardResult}.
 * Use `client.shouldBlock(result)` to decide whether to proceed.
 */
function guardNextInput(client, input) {
    return client.guardInput(input);
}
/** Output-guard counterpart of {@link guardNextInput}. */
function guardNextOutput(client, input) {
    return client.guardOutput(input);
}
/**
 * Convenience factory that returns a Next.js POST handler. Thin wrapper over
 * {@link secureChatHandler} with a configurable input field name. The API key
 * stays server-side; only redacted results are returned to the browser.
 */
function createGuardedRoute(options) {
    if (!options.callLLM) {
        throw new errors_1.CyberRakshakError("callLLM is required.", { code: "config_error" });
    }
    const field = options.inputField ?? "message";
    const client = new client_1.CyberRakshakClient(options);
    const blockedReply = options.blockedResponse ?? "This request was blocked for security reasons.";
    const withholdReply = options.withholdResponse ?? "The response was withheld for safety.";
    return async function handler(request) {
        let parsed;
        try {
            parsed = (await request.json());
        }
        catch {
            return jsonResponse({ error: true, message: "Request body must be valid JSON." }, 400);
        }
        const raw = parsed[field];
        const message = typeof raw === "string" ? raw : "";
        if (!message.trim()) {
            return jsonResponse({ error: true, message: `${field} is required.` }, 400);
        }
        try {
            const result = await client.secureChat({
                message,
                userId: typeof parsed.userId === "string" ? parsed.userId : undefined,
                sessionId: typeof parsed.sessionId === "string" ? parsed.sessionId : undefined,
                metadata: asMetadata(parsed.metadata),
                callLLM: ({ safeInput }) => options.callLLM(safeInput),
                blockedResponse: blockedReply,
            });
            const reply = result.blocked && result.outputResult ? withholdReply : result.reply;
            return jsonResponse({
                reply,
                blocked: result.blocked,
                inputResult: stripOriginal(result.inputResult),
                outputResult: result.outputResult ? stripOriginal(result.outputResult) : undefined,
            }, 200);
        }
        catch (caught) {
            const status = caught.status ?? 500;
            const message = caught instanceof Error ? caught.message : "Guarded route failed.";
            return jsonResponse({ error: true, message }, status);
        }
    };
}
