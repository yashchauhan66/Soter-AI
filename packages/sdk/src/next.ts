import { CyberRakshakClient } from "./client";
import { CyberRakshakError } from "./errors";
import type {
  ClientOptions,
  GuardInputRequest,
  GuardOutputRequest,
  GuardResult,
  MetadataValue,
} from "./types";

export interface SecureChatHandlerOptions extends ClientOptions {
  callLLM: (context: { safeInput: string; original: string; inputResult: GuardResult }) => Promise<string>;
  blockedResponse?: string;
  withholdResponse?: string;
}

interface IncomingBody {
  message?: unknown;
  userId?: unknown;
  sessionId?: unknown;
  metadata?: unknown;
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

/**
 * Returns a Next.js Route Handler that runs a chatbot turn through the input guard,
 * the consumer-provided LLM, and the output guard. Mount it under any POST route.
 */
export function secureChatHandler(options: SecureChatHandlerOptions) {
  if (!options.apiKey) throw new CyberRakshakError("apiKey is required.", { code: "config_error" });
  if (typeof options.callLLM !== "function") {
    throw new CyberRakshakError("callLLM is required.", { code: "config_error" });
  }
  const client = new CyberRakshakClient(options);
  const blockedReply = options.blockedResponse ?? "This request was blocked for security reasons.";
  const withholdReply = options.withholdResponse ?? "The response was withheld for safety.";

  return async function handler(request: Request) {
    let parsed: IncomingBody;
    try {
      parsed = (await request.json()) as IncomingBody;
    } catch {
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
    } catch (caught) {
      const status = (caught as { status?: number }).status ?? 500;
      const message = caught instanceof Error ? caught.message : "Secure chat failed.";
      return jsonResponse({ error: true, message }, status);
    }
  };
}

function stripOriginal(result: GuardResult) {
  const { ...rest } = result;
  return rest;
}

function jsonResponse(data: unknown, status: number) {
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
export function guardNextInput(client: CyberRakshakClient, input: GuardInputRequest): Promise<GuardResult> {
  return client.guardInput(input);
}

/** Output-guard counterpart of {@link guardNextInput}. */
export function guardNextOutput(client: CyberRakshakClient, input: GuardOutputRequest): Promise<GuardResult> {
  return client.guardOutput(input);
}

export interface GuardedRouteOptions extends ClientOptions {
  /** Field on the JSON body holding the user message. Default `"message"`. */
  inputField?: string;
  /** Your LLM call. Receives the safe (possibly redacted) input text. */
  callLLM: (safeInput: string) => Promise<string>;
  blockedResponse?: string;
  withholdResponse?: string;
}

/**
 * Convenience factory that returns a Next.js POST handler. Thin wrapper over
 * {@link secureChatHandler} with a configurable input field name. The API key
 * stays server-side; only redacted results are returned to the browser.
 */
export function createGuardedRoute(options: GuardedRouteOptions) {
  if (!options.callLLM) {
    throw new CyberRakshakError("callLLM is required.", { code: "config_error" });
  }
  const field = options.inputField ?? "message";
  const client = new CyberRakshakClient(options);
  const blockedReply = options.blockedResponse ?? "This request was blocked for security reasons.";
  const withholdReply = options.withholdResponse ?? "The response was withheld for safety.";

  return async function handler(request: Request) {
    let parsed: Record<string, unknown>;
    try {
      parsed = (await request.json()) as Record<string, unknown>;
    } catch {
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
      return jsonResponse(
        {
          reply,
          blocked: result.blocked,
          inputResult: stripOriginal(result.inputResult),
          outputResult: result.outputResult ? stripOriginal(result.outputResult) : undefined,
        },
        200,
      );
    } catch (caught) {
      const status = (caught as { status?: number }).status ?? 500;
      const message = caught instanceof Error ? caught.message : "Guarded route failed.";
      return jsonResponse({ error: true, message }, status);
    }
  };
}
