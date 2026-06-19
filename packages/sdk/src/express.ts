import { CyberRakshakClient } from "./client";
import type { ClientOptions, GuardResult, MetadataValue } from "./types";

/**
 * Minimal structural types so the SDK does not take a hard dependency on
 * `@types/express`. Any Express-compatible request/response satisfies these.
 */
export interface ExpressRequestLike {
  body?: unknown;
  cyberrakshak?: { inputResult?: GuardResult; outputResult?: GuardResult };
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

function asMetadata(value: unknown): Record<string, MetadataValue> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const out: Record<string, MetadataValue> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof raw === "string" || typeof raw === "number" || typeof raw === "boolean" || raw === null) {
      out[key] = raw;
    }
  }
  return out;
}

function readString(body: unknown, field: string): string {
  if (body && typeof body === "object" && field in (body as Record<string, unknown>)) {
    const value = (body as Record<string, unknown>)[field];
    if (typeof value === "string") return value;
  }
  return "";
}

/**
 * Express middleware that runs the request body's message through the input
 * guard. On block it ends the request with a safe message; otherwise it
 * attaches the result to `req.cyberrakshak.inputResult` and continues. The API
 * key stays server-side.
 */
export function cyberRakshakInputMiddleware(options: InputMiddlewareOptions) {
  const client = new CyberRakshakClient(options);
  const field = options.field ?? "message";
  const blockedResponse = options.blockedResponse ?? "This request was blocked for security reasons.";
  const rewriteBody = options.rewriteBody ?? true;

  return async function middleware(req: ExpressRequestLike, res: ExpressResponseLike, next: ExpressNext) {
    const message = readString(req.body, field);
    if (!message.trim()) {
      res.status(400).json({ error: true, message: `${field} is required.` });
      return;
    }
    try {
      const result = await client.guardInput({
        message,
        metadata: asMetadata((req.body as Record<string, unknown> | undefined)?.metadata),
      });
      req.cyberrakshak = { ...(req.cyberrakshak ?? {}), inputResult: result };
      if (client.shouldBlock(result)) {
        res.status(200).json({ blocked: true, reply: result.safeText ?? blockedResponse });
        return;
      }
      if (rewriteBody && req.body && typeof req.body === "object") {
        const safe = client.getSafeText(result, message) ?? message;
        (req.body as Record<string, unknown>)[field] = safe;
      }
      next();
    } catch (caught) {
      next(caught);
    }
  };
}

/**
 * Express middleware for the output side. Intended to wrap an AI response that
 * was placed on `res.locals[sourceField]` (or the request body) before this
 * middleware runs. Blocks unsafe output and exposes the result.
 */
export function cyberRakshakOutputMiddleware(options: OutputMiddlewareOptions) {
  const client = new CyberRakshakClient(options);
  const field = options.field ?? "aiResponse";
  const blockedResponse = options.blockedResponse ?? "The response was withheld for safety.";
  const rewriteBody = options.rewriteBody ?? true;

  return async function middleware(req: ExpressRequestLike, res: ExpressResponseLike, next: ExpressNext) {
    const fromLocals = res.locals && typeof res.locals[field] === "string" ? (res.locals[field] as string) : "";
    const aiResponse = fromLocals || readString(req.body, field);
    if (!aiResponse.trim()) {
      res.status(400).json({ error: true, message: `${field} is required for output guarding.` });
      return;
    }
    try {
      const result = await client.guardOutput({ aiResponse });
      req.cyberrakshak = { ...(req.cyberrakshak ?? {}), outputResult: result };
      if (client.shouldBlock(result)) {
        res.status(200).json({ blocked: true, reply: result.safeText ?? blockedResponse });
        return;
      }
      if (rewriteBody && res.locals) {
        res.locals[field] = client.getSafeText(result, aiResponse) ?? aiResponse;
      }
      next();
    } catch (caught) {
      next(caught);
    }
  };
}
