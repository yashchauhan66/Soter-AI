"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.soterOutputMiddleware = exports.soterInputMiddleware = void 0;
exports.cyberRakshakInputMiddleware = cyberRakshakInputMiddleware;
exports.cyberRakshakOutputMiddleware = cyberRakshakOutputMiddleware;
const client_1 = require("./client");
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
function readString(body, field) {
    if (body && typeof body === "object" && field in body) {
        const value = body[field];
        if (typeof value === "string")
            return value;
    }
    return "";
}
/**
 * Express middleware that runs the request body's message through the input
 * guard. On block it ends the request with a safe message; otherwise it
 * attaches the result to `req.cyberrakshak.inputResult` and continues. The API
 * key stays server-side.
 */
function cyberRakshakInputMiddleware(options) {
    const client = new client_1.CyberRakshakClient(options);
    const field = options.field ?? "message";
    const blockedResponse = options.blockedResponse ?? "This request was blocked for security reasons.";
    const rewriteBody = options.rewriteBody ?? true;
    return async function middleware(req, res, next) {
        const message = readString(req.body, field);
        if (!message.trim()) {
            res.status(400).json({ error: true, message: `${field} is required.` });
            return;
        }
        try {
            const result = await client.guardInput({
                message,
                metadata: asMetadata(req.body?.metadata),
            });
            req.cyberrakshak = { ...(req.cyberrakshak ?? {}), inputResult: result };
            req.soter = { ...(req.soter ?? {}), inputResult: result };
            if (client.shouldBlock(result)) {
                res.status(200).json({ blocked: true, reply: result.safeText ?? blockedResponse });
                return;
            }
            if (rewriteBody && req.body && typeof req.body === "object") {
                const safe = client.getSafeText(result, message) ?? message;
                req.body[field] = safe;
            }
            next();
        }
        catch (caught) {
            next(caught);
        }
    };
}
/** Soter-branded alias for new integrations. */
exports.soterInputMiddleware = cyberRakshakInputMiddleware;
/**
 * Express middleware for the output side. Intended to wrap an AI response that
 * was placed on `res.locals[sourceField]` (or the request body) before this
 * middleware runs. Blocks unsafe output and exposes the result.
 */
function cyberRakshakOutputMiddleware(options) {
    const client = new client_1.CyberRakshakClient(options);
    const field = options.field ?? "aiResponse";
    const blockedResponse = options.blockedResponse ?? "The response was withheld for safety.";
    const rewriteBody = options.rewriteBody ?? true;
    return async function middleware(req, res, next) {
        const fromLocals = res.locals && typeof res.locals[field] === "string" ? res.locals[field] : "";
        const aiResponse = fromLocals || readString(req.body, field);
        if (!aiResponse.trim()) {
            res.status(400).json({ error: true, message: `${field} is required for output guarding.` });
            return;
        }
        try {
            const result = await client.guardOutput({ aiResponse });
            req.cyberrakshak = { ...(req.cyberrakshak ?? {}), outputResult: result };
            req.soter = { ...(req.soter ?? {}), outputResult: result };
            if (client.shouldBlock(result)) {
                res.status(200).json({ blocked: true, reply: result.safeText ?? blockedResponse });
                return;
            }
            if (rewriteBody && res.locals) {
                res.locals[field] = client.getSafeText(result, aiResponse) ?? aiResponse;
            }
            next();
        }
        catch (caught) {
            next(caught);
        }
    };
}
/** Soter-branded alias for new integrations. */
exports.soterOutputMiddleware = cyberRakshakOutputMiddleware;
