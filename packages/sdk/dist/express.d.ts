import type { ClientOptions, GuardResult } from "./types";
/**
 * Minimal structural types so the SDK does not take a hard dependency on
 * `@types/express`. Any Express-compatible request/response satisfies these.
 */
export interface ExpressRequestLike {
    body?: unknown;
    cyberrakshak?: {
        inputResult?: GuardResult;
        outputResult?: GuardResult;
    };
    [key: string]: unknown;
}
export interface ExpressResponseLike {
    status(code: number): ExpressResponseLike;
    json(body: unknown): unknown;
    locals?: Record<string, unknown>;
}
export type ExpressNext = (error?: unknown) => void;
export interface InputMiddlewareOptions extends ClientOptions {
    /** Body field holding the user message. Default `"message"`. */
    field?: string;
    /** Response sent when the input guard blocks. */
    blockedResponse?: string;
    /**
     * When false, the original/redacted text is left untouched. When true (default)
     * the request body field is replaced with the safe text before `next()`.
     */
    rewriteBody?: boolean;
}
export interface OutputMiddlewareOptions extends ClientOptions {
    /** Body field holding the AI response. Default `"aiResponse"`. */
    field?: string;
    blockedResponse?: string;
    rewriteBody?: boolean;
}
/**
 * Express middleware that runs the request body's message through the input
 * guard. On block it ends the request with a safe message; otherwise it
 * attaches the result to `req.cyberrakshak.inputResult` and continues. The API
 * key stays server-side.
 */
export declare function cyberRakshakInputMiddleware(options: InputMiddlewareOptions): (req: ExpressRequestLike, res: ExpressResponseLike, next: ExpressNext) => Promise<void>;
/**
 * Express middleware for the output side. Intended to wrap an AI response that
 * was placed on `res.locals[sourceField]` (or the request body) before this
 * middleware runs. Blocks unsafe output and exposes the result.
 */
export declare function cyberRakshakOutputMiddleware(options: OutputMiddlewareOptions): (req: ExpressRequestLike, res: ExpressResponseLike, next: ExpressNext) => Promise<void>;
//# sourceMappingURL=express.d.ts.map