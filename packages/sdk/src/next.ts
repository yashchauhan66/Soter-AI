import { GuardClient } from "./client";
import { CyberRakshakError } from "./errors";
import type { ClientOptions, GuardResult, MetadataValue } from "./types";

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
  const client = new GuardClient(options);
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
